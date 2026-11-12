// The outbox: everything Kyle has done that the vault does not have yet, in order. It lives in this browser's
// localStorage, one list per vault, so nothing is lost when the connection drops or the app closes.
import { clearChoices, loadChoices, type ChangeStatus } from '../lib/changes.ts';
import { sameSlot, type Choice } from './choice.ts';
import { isMaker } from './makers.ts';
import { choiceAction, marksAction, type Action, type Op } from './ops.ts';
import { validChange } from './text.ts';
import { PREF, storeOf } from '../lib/prefs.ts';

const KEY = PREF.outbox;
const LANDED = PREF.landed;
/** Where choices waited before the outbox (until 2026-11-11). Read once to move them over; a device that has not opened
 * the app since then may still hold some. */
const OLD_QUEUE = PREF.oldQueue;

type Store = Storage | null;
const store = (): Store => storeOf();

function validOp(op: Op): boolean {
  if (!op || typeof op.path !== 'string') return false;
  if (op.kind === 'edit') return Boolean(op.edit && ((op.edit.type === 'choice' && op.edit.choice) || (op.edit.type === 'marks' && op.edit.marks && typeof op.edit.marks === 'object') || (op.edit.type === 'text' && validChange(op.edit.change))));
  if (op.kind === 'retitle') return typeof op.title === 'string' && Boolean(op.title) && (op.what === 'scene' || op.what === 'recipe');
  if (op.kind === 'create') return isMaker(op.make) && typeof op.text === 'string' && typeof op.id === 'string' && Boolean(op.payload);
  return false;
}

function valid(a: unknown): a is Action {
  const x = a as Action;
  return Boolean(x && typeof x.id === 'string' && typeof x.at === 'string' && Array.isArray(x.ops) && x.ops.every(validOp));
}

function oldQueue(sourceKey: string, s: Store): Choice[] {
  try {
    const raw = s && s.getItem(OLD_QUEUE + sourceKey);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((c) => c && typeof c.path === 'string' && typeof c.decision === 'string') : [];
  } catch {
    return [];
  }
}

/** The waiting actions for a vault. What was left in the two older lists moves over the first time, once: choices in
 * the old queue (before 2026-11-11) and answers on the team's changes (the Edit room's own list until then). */
export function loadOutbox(sourceKey: string, s: Store = store()): Action[] {
  let list: Action[] = [];
  try {
    const raw = s && s.getItem(KEY + sourceKey);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed.filter(valid);
  } catch {
    list = [];
  }
  const old = oldQueue(sourceKey, s);
  const marks = loadChoices(sourceKey, s);
  const notes = Object.keys(marks).filter((path) => marks[path] && typeof marks[path] === 'object' && Object.keys(marks[path]).length);
  if (old.length || notes.length) {
    list = old.reduce((acc, c) => add(acc, choiceAction([c], new Date(c.at || Date.now()))), list);
    // An answer already waiting in the outbox is newer than the same one in the old list.
    list = notes.reduce((acc, path) => add(acc, marksAction(path, { ...marks[path], ...waitingMarks(acc, path) })), list);
    saveOutbox(sourceKey, list, s);
    // Only let go of the old lists once the new one is safely written.
    let kept = false;
    try { kept = Boolean(s && s.getItem(KEY + sourceKey)); } catch { kept = false; }
    if (kept) { try { if (s) s.removeItem(OLD_QUEUE + sourceKey); } catch { /* it is read again next time, and adds nothing twice */ } clearChoices(sourceKey, s); }
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

/** Actions that have gone up but may not be in the saved copy on this device yet. The saved copy is written a moment
 * after a save (it copies the whole vault), and the app can be closed in that moment. Until the copy is written, the
 * action stays here, so the app can show it again when it opens with the older copy and no connection. */
export function loadLanded(sourceKey: string, s: Store = store()): Action[] {
  try {
    const raw = s && s.getItem(LANDED + sourceKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(valid) : [];
  } catch {
    return [];
  }
}

export function saveLanded(sourceKey: string, list: Action[], s: Store = store()): void {
  try {
    if (!s) return;
    if (list.length) s.setItem(LANDED + sourceKey, JSON.stringify(list));
    else s.removeItem(LANDED + sourceKey);
  } catch {
    /* storage full or turned off: the next sync puts the saved copy right */
  }
}

/** The actions a push sent up, as they should be shown on an older saved copy. A new note that was saved under another
 * ID than it was shown with is left out: the next sync brings it. */
export function landedOf(sent: Action[], done: string[], renames: Record<string, string> = {}): Action[] {
  const out: Action[] = [];
  sent.forEach((a) => {
    if (done.indexOf(a.id) < 0) return;
    const ops = a.ops.filter((op) => !renames[op.path]);
    if (ops.length) out.push({ id: a.id, at: a.at, ops });
  });
  return out;
}

/** The choice an op carries, if it is one. */
const choiceOf = (op: Op): Choice | null => (op.kind === 'edit' && op.edit.type === 'choice' ? op.edit.choice : null);
/** The answers on a chapter's changes an op carries, if it is that. */
const marksOf = (op: Op): Record<string, ChangeStatus> | null => (op.kind === 'edit' && op.edit.type === 'marks' ? op.edit.marks : null);
/** Do two ops stand in the same place: the same choice slot on the same note, or answers on the same changes note? */
const sameSpot = (a: Op, b: Op): boolean => {
  const x = choiceOf(a), y = choiceOf(b);
  if (x && y) return sameSlot(x, y);
  return Boolean(marksOf(a) && marksOf(b) && a.path === b.path);
};

/** Every answer waiting for one changes note, the newer winning. */
function waitingMarks(list: Action[], path: string): Record<string, ChangeStatus> {
  let out: Record<string, ChangeStatus> = {};
  list.forEach((a) => a.ops.forEach((op) => { const m = marksOf(op); if (m && op.path === path) out = { ...out, ...m }; }));
  return out;
}

/** Add an action. A newer choice replaces a waiting one in the same place on the same note (a second Keep after a Drop);
 * a second edit to a note that has not saved yet joins the first, so neither is lost, and so do answers on the same
 * chapter's changes, the newer answer to a change winning. An action left with nothing to do goes. A new note never
 * replaces anything. */
export function add(list: Action[], action: Action): Action[] {
  const ops = action.ops.map((op): Op => {
    if (op.kind !== 'edit') return op;
    if (op.edit.type === 'marks') {
      let marks: Record<string, ChangeStatus> = {};
      list.forEach((a) => a.ops.forEach((x) => { if (sameSpot(x, op)) marks = { ...marks, ...marksOf(x)! }; }));
      return { ...op, edit: { ...op.edit, marks: { ...marks, ...op.edit.marks } } };
    }
    if (op.edit.type !== 'choice' || op.edit.choice.decision !== 'edit') return op;
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
  return op.kind === 'edit' && op.edit.type === 'choice' ? { ...op, path: to, edit: { ...op.edit, choice: { ...op.edit.choice, path: to } } } : { ...op, path: to };
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
