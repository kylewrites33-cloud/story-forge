// The outbox: everything Kyle has done that the vault does not have yet, in order. It lives in this browser's
// localStorage, one list per vault, so nothing is lost when the connection drops or the app closes.
import { loadQueue, sameSlot, saveQueue, type Choice } from '../lib/write-queue.ts';
import { choiceAction, type Action, type Op } from './ops.ts';

const KEY = 'story-forge.outbox.';

type Store = Storage | null;
const store = (): Store => globalThis.localStorage ?? null;

function valid(a: unknown): a is Action {
  const x = a as Action;
  return Boolean(x && typeof x.id === 'string' && typeof x.at === 'string' && Array.isArray(x.ops)
    && x.ops.every((op) => op && op.kind === 'edit' && typeof op.path === 'string' && op.edit && op.edit.type === 'choice' && op.edit.choice));
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

/** The choice an op carries. */
const choiceOf = (op: Op): Choice => op.edit.choice;

/** Add an action. A newer choice replaces a waiting one in the same place on the same note (a second Keep after a Drop);
 * a second edit to a note that has not saved yet joins the first, so neither is lost. An action left with nothing to do goes. */
export function add(list: Action[], action: Action): Action[] {
  const ops = action.ops.map((op) => {
    const c = choiceOf(op);
    if (c.decision !== 'edit') return op;
    let fields: Record<string, string> = {};
    list.forEach((a) => a.ops.forEach((x) => { if (sameSlot(choiceOf(x), c)) fields = { ...fields, ...(choiceOf(x).fields || {}) }; }));
    return { ...op, edit: { ...op.edit, choice: { ...c, fields: { ...fields, ...(c.fields || {}) } } } };
  });
  const rest: Action[] = [];
  list.forEach((a) => {
    const left = a.ops.filter((x) => !ops.some((op) => sameSlot(choiceOf(x), choiceOf(op))));
    if (left.length === a.ops.length) rest.push(a);
    else if (left.length) rest.push({ ...a, ops: left });
  });
  return rest.concat({ ...action, ops });
}

/** The waiting choices, oldest first, each with its action's failure if it has one: what the boards show as "saving". */
export function choicesOf(list: Action[]): Choice[] {
  const out: Choice[] = [];
  list.forEach((a) => a.ops.forEach((op) => out.push(a.error ? { ...choiceOf(op), error: a.error } : choiceOf(op))));
  return out;
}

/** The outbox after a push: actions that went up (or whose notes are gone) leave, failures keep their sentence.
 * Actions added while the push was running are untouched, because the push only names the ones it handled. */
export function settle(list: Action[], done: string[], failed: Record<string, string>): Action[] {
  return list.filter((a) => done.indexOf(a.id) < 0).map((a) => (failed[a.id] ? { ...a, error: failed[a.id] } : a));
}
