// The outbox: everything Kyle has done that the vault does not have yet, in order. It lives in this browser's
// localStorage, one list per vault, so nothing is lost when the connection drops or the app closes.
import { loadQueue, sameSlot, saveQueue, type Choice } from '../lib/write-queue.ts';
import { isMaker } from './makers.ts';
import { choiceAction, type Action, type Op } from './ops.ts';

const KEY = 'story-forge.outbox.';

type Store = Storage | null;
const store = (): Store => globalThis.localStorage ?? null;

function validOp(op: Op): boolean {
  if (!op || typeof op.path !== 'string') return false;
  if (op.kind === 'edit') return Boolean(op.edit && op.edit.type === 'choice' && op.edit.choice);
  if (op.kind === 'create') return isMaker(op.make) && typeof op.text === 'string' && typeof op.id === 'string' && Boolean(op.payload);
  return false;
}

function valid(a: unknown): a is Action {
  const x = a as Action;
  return Boolean(x && typeof x.id === 'string' && typeof x.at === 'string' && Array.isArray(x.ops) && x.ops.every(validOp));
}

/** The waiting actions for a vault. Choices left in the old queue (before 2026-11-11) move over the first time, once. */
export function loadOutbox(sourceKey: string, s: Store = store()): Action[] {
  let list: Action[] = [];
  try {
    const raw = s && s.getItem(KEY + sourceKey);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed.filter(valid);
  } catch {
    list = [];
  }
  const old = loadQueue(sourceKey, s);
  if (old.length) {
    list = old.reduce((acc, c) => add(acc, choiceAction([c], new Date(c.at || Date.now()))), list);
    saveOutbox(sourceKey, list, s);
    // Only let go of the old list once the new one is safely written.
    let kept = false;
    try { kept = Boolean(s && s.getItem(KEY + sourceKey)); } catch { kept = false; }
    if (kept) saveQueue(sourceKey, [], s);
  }
  return list;
}

export function saveOutbox(sourceKey: string, list: Action[], s: Store = store()): void {
  try {
    if (!s) return;
    if (list.length) s.setItem(KEY + sourceKey, JSON.stringify(list));
    else s.removeItem(KEY + sourceKey);
  } catch {
    /* storage full or turned off: the action still saves now if the connection holds */
  }
}

/** The choice an op carries, if it is one. */
const choiceOf = (op: Op): Choice | null => (op.kind === 'edit' ? op.edit.choice : null);
const sameSpot = (a: Op, b: Op): boolean => { const x = choiceOf(a), y = choiceOf(b); return Boolean(x && y && sameSlot(x, y)); };

/** Add an action. A newer choice replaces a waiting one in the same place on the same note (a second Keep after a Drop);
 * a second edit to a note that has not saved yet joins the first, so neither is lost. An action left with nothing to do
 * goes. A new note never replaces anything. */
export function add(list: Action[], action: Action): Action[] {
  const ops = action.ops.map((op): Op => {
    if (op.kind !== 'edit' || op.edit.choice.decision !== 'edit') return op;
    const c = op.edit.choice;
    let fields: Record<string, string> = {};
    list.forEach((a) => a.ops.forEach((x) => { if (sameSpot(x, op)) fields = { ...fields, ...(choiceOf(x)!.fields || {}) }; }));
    return { ...op, edit: { ...op.edit, choice: { ...c, fields: { ...fields, ...(c.fields || {}) } } } };
  });
  const rest: Action[] = [];
  list.forEach((a) => {
    const left = a.ops.filter((x) => !ops.some((op) => sameSpot(x, op)));
    if (left.length === a.ops.length) rest.push(a);
    else if (left.length) rest.push({ ...a, ops: left });
  });
  return rest.concat({ ...action, ops });
}

/** The waiting choices, oldest first, each with its action's failure if it has one. */
export function choicesOf(list: Action[]): Choice[] {
  const out: Choice[] = [];
  list.forEach((a) => a.ops.forEach((op) => { const c = choiceOf(op); if (c) out.push(a.error ? { ...c, error: a.error } : c); }));
  return out;
}

/** What waits on each note, by path, for the "Saving" and "Not saved" marks on cards. A new note that has not gone up
 * yet counts as waiting too. */
export function waitingOf(list: Action[]): Record<string, Choice> {
  const out: Record<string, Choice> = {};
  list.forEach((a) => a.ops.forEach((op) => {
    const c: Choice = choiceOf(op) || { path: op.path, decision: 'edit', reason: '', at: a.at };
    out[op.path] = a.error ? { ...c, error: a.error } : c;
  }));
  return out;
}

/** How many changes wait. */
export function waitingCount(list: Action[]): number {
  return list.reduce((n, a) => n + a.ops.length, 0);
}

/** An op pointed at a note's new path. */
function repoint(op: Op, to: string): Op {
  return op.kind === 'edit' ? { ...op, path: to, edit: { ...op.edit, choice: { ...op.edit.choice, path: to } } } : { ...op, path: to };
}

/** The outbox after a push: actions that went up (or whose notes are gone) leave, failures keep their sentence.
 * Actions added while the push was running are untouched, because the push only names the ones it handled. If a new
 * note was saved under another ID than it was shown with, what still waits for that note follows it (`renames`). */
export function settle(list: Action[], done: string[], failed: Record<string, string>, renames: Record<string, string> = {}): Action[] {
  const moved = Object.keys(renames).length > 0;
  return list.filter((a) => done.indexOf(a.id) < 0).map((a) => {
    const next = moved && a.ops.some((op) => renames[op.path]) ? { ...a, ops: a.ops.map((op) => (renames[op.path] ? repoint(op, renames[op.path]) : op)) } : a;
    return failed[a.id] ? { ...next, error: failed[a.id] } : next;
  });
}
