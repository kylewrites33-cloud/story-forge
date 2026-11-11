// Sending the outbox up. One action is one save: every note it touches is read as the vault has it now, changed, and
// written together, or nothing is written. If the vault moved while the save was being made (the team, another device),
// the source asks for the plan again on the newer notes, so Kyle's change lands on top and nothing of theirs is lost.
import { Frontmatter } from '../lib/frontmatter.js';
import { makeNote } from '../lib/vault-index.ts';
import { saveChoice } from '../lib/write-queue.ts';
import type { NoteRecord, VaultSource } from '../lib/types.ts';
import { editMessage, editText } from './apply.ts';
import { make } from './makers.ts';
import type { Action, Edit } from './ops.ts';
import { settle } from './outbox.ts';
import { planChapters } from './chapters.ts';
import { Tree } from './tree.ts';

/** The line for the vault's history: the first change's own line, with the others named under it. */
function messageFor(lines: string[]): string {
  if (lines.length < 2) return lines[0] || 'app: save';
  const [subject, ...body] = lines[0].split('\n');
  const also = lines.slice(1).map((l) => '- ' + l.split('\n')[0]);
  return subject + '\n\nSaved together with:\n' + also.join('\n') + (body.join('\n').trim() ? '\n\n' + body.join('\n').trim() : '');
}

/** Is the note found at a new note's own path that same note? Then an earlier try saved it and the answer never
 * reached the device (the connection dropped at the last moment), and adding it again would make it twice. */
function sameNote(found: string, shown: string): boolean {
  const a = Frontmatter.parse(found), b = Frontmatter.parse(shown);
  const x = a.data || {}, y = b.data || {};
  // The same kind, ID, title and day, and the words Kyle wrote still open it (the team may have written under them since).
  return ['type', 'id', 'title', 'created'].every((k) => String(x[k]) === String(y[k])) && String(a.body || '').trim().startsWith(String(b.body || '').trim());
}

export interface Pushed {
  /** Notes as the vault now has them. */
  saved: NoteRecord[];
  /** New notes that were saved under another path than they were shown with (their ID was taken meanwhile): old path to new. */
  renames: Record<string, string>;
  /** Files the save took out of the vault (a note that got a new file name leaves its old one). */
  removed: string[];
}

export interface PushOptions {
  /** The vault as the device has it, so a save that must look at many notes reads only the ones that changed since. */
  known?: Record<string, NoteRecord>;
}

/** Save actions as one step: all of them go up together, or none does. Answers the notes they touched as the vault now
 * has them, for the saved copy. */
export async function pushActions(source: VaultSource, actions: Action[], opts: PushOptions = {}): Promise<Pushed> {
  if (!source.commit) throw new Error('This vault cannot be changed from the app.');
  const ops = actions.flatMap((a) => a.ops);
  const creates = new Set(ops.filter((op) => op.kind === 'create').map((op) => op.path));
  // Notes that are in the vault already and take an edit. A note this save itself adds is not read.
  const paths = [...new Set(ops.filter((op) => op.kind === 'edit' && !creates.has(op.path)).map((op) => op.path))];
  // What the last plan read and made, kept for the answer: the plan may run more than once.
  let tree: Tree | null = null;
  let renames: Record<string, string> = {};
  const res = await source.commit(async (head) => {
    const t = tree = new Tree(head);
    renames = {};
    // A note that is gone (moved or renamed elsewhere) cannot take a change; the rest still saves.
    await t.readMany(paths);
    const lines: string[] = [];
    for (const op of ops) {
      if (op.kind === 'chapters') {
        lines.push((await planChapters(t, op.book, op.change, op.why, opts.known)).message);
        continue;
      }
      if (op.kind === 'create') {
        // New notes take their IDs from the files the vault has now, and from the ones this same save adds before them.
        const files = await t.files();
        const there = files.some((f) => f.path === op.path) ? await t.read(op.path) : null;
        // Saved by an earlier try: changes that wait for it are made on the note as the vault has it.
        if (there != null && sameNote(there, op.text)) continue;
        const made = make(op.make, files, op.payload, op.id);
        t.write(made.path, made.text);
        if (made.path !== op.path) renames[op.path] = made.path;
        lines.push(made.message);
        continue;
      }
      const path = renames[op.path] || op.path;
      const text = await t.read(path);
      if (text == null) continue;
      const next = editText(text, op.edit);
      if (next !== text) lines.push(editMessage(text, op.edit, path));
      t.write(path, next);
    }
    const { writes, removes } = t.changes();
    return writes.length || (removes && removes.length) ? { message: messageFor(lines), writes, removes } : null;
  });
  const t = tree as Tree | null;
  return { saved: t ? t.saved((res && res.shas) || {}) : [], renames, removed: t && res ? t.removed() : [] };
}

/** Save one action as one step. */
export const pushAction = (source: VaultSource, action: Action, opts: PushOptions = {}): Promise<Pushed> => pushActions(source, [action], opts);

/** One edit to one note the old way: read it, change it, write it, and again if it changed in between. */
async function saveEdit(source: VaultSource, path: string, edit: Edit): Promise<NoteRecord> {
  if (!source.readFresh || !source.write) throw new Error('This vault cannot be changed from the app.');
  for (let attempt = 0; ; attempt++) {
    const { text, sha } = await source.readFresh(path);
    const next = editText(text, edit);
    if (next === text) return makeNote(path, sha, text);
    try {
      return makeNote(path, await source.write(path, next, sha, editMessage(text, edit, path)), next);
    } catch (e) {
      if (!((e as { conflict?: boolean }).conflict && attempt < 3)) throw e;
    }
  }
}

/** The old way, one note at a time through the calls the app made before. Kept behind a switch in Settings until the
 * new way has run on the real book (2026-11-11); a failure part-way can leave an action half saved, as it always could. */
async function pushLegacy(source: VaultSource, action: Action): Promise<Pushed> {
  const out: Pushed = { saved: [], renames: {}, removed: [] };
  for (const op of action.ops) {
    if (op.kind === 'chapters') {
      // Chapter numbers have no old way through here: the old code is called from the page itself while the switch is on.
      const p = await pushActions(source, [{ ...action, ops: [op] }]);
      out.saved.push(...p.saved);
      out.removed.push(...p.removed);
      continue;
    }
    if (op.kind === 'create') {
      if (!source.write) throw new Error('This vault cannot be changed from the app.');
      for (let attempt = 0; ; attempt++) {
        const files = (await source.tree()).files;
        if (source.readFresh && files.some((f) => f.path === op.path)) {
          const there = await source.readFresh(op.path);
          if (sameNote(there.text, op.text)) { out.saved.push(makeNote(op.path, there.sha, there.text)); break; }
        }
        const made = make(op.make, files, op.payload, op.id);
        try {
          out.saved.push(makeNote(made.path, await source.write(made.path, made.text, '', made.message), made.text));
          if (made.path !== op.path) out.renames[op.path] = made.path;
          break;
        } catch (e) {
          // Another note took that name a moment ago: count again.
          if (!((e as { conflict?: boolean }).conflict && attempt < 3)) throw e;
        }
      }
      continue;
    }
    const path = out.renames[op.path] || op.path;
    try {
      if (op.edit.type === 'choice') out.saved.push(await saveChoice(source, path === op.path ? op.edit.choice : { ...op.edit.choice, path }));
      else out.saved.push(await saveEdit(source, path, op.edit));
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
    }
  }
  return out;
}

export interface PushResult {
  /** Notes as the vault now has them. */
  saved: NoteRecord[];
  /** New notes saved under another path than they were shown with: old path to new. */
  renames: Record<string, string>;
  /** Files the saves took out of the vault. */
  removed: string[];
  /** Ids of the actions that are finished: saved, or nothing left to save them to. */
  done: string[];
  /** Ids of the actions that failed for a reason other than the connection, each with a plain sentence. */
  failed: Record<string, string>;
  /** A plain sentence when something did not save. */
  error: string | null;
}

/** The most actions that go up as one save when several are waiting (after time offline). */
const TOGETHER = 40;
/** Is this failure the connection, or GitHub asking the app to wait? Then everything stays for the next try. */
const wait = (e: unknown): boolean => { const st = (e as { status?: number }).status; return st === 0 || st === 429; };

/** Save every waiting action in order. One action is one save. When several wait (Kyle was offline), they go up
 * together, up to forty a save; if a group will not save, its actions go one at a time so only the one at fault waits.
 * Stops at the first connection failure and keeps the rest for next time. */
export async function pushAll(source: VaultSource, list: Action[], opts: PushOptions & { legacy?: boolean } = {}): Promise<PushResult> {
  const out: PushResult = { saved: [], renames: {}, removed: [], done: [], failed: {}, error: null };
  // An action later in the list may be about a note an earlier save in this same push gave another path.
  const follow = (a: Action): Action => (a.ops.some((op) => out.renames[op.path]) ? settle([a], [], {}, out.renames)[0] : a);
  const take = (p: Pushed, ids: string[]) => { out.saved.push(...p.saved); Object.assign(out.renames, p.renames); out.removed.push(...p.removed); out.done.push(...ids); };
  const one = async (a: Action): Promise<boolean> => {
    try {
      take(await (opts.legacy ? pushLegacy(source, follow(a)) : pushAction(source, follow(a), opts)), [a.id]);
    } catch (e) {
      out.error = (e as Error).message;
      if (wait(e)) return false;
      out.failed[a.id] = (e as Error).message;
    }
    return true;
  };
  for (let i = 0; i < list.length; i += TOGETHER) {
    const group = list.slice(i, i + TOGETHER);
    if (group.length > 1 && !opts.legacy) {
      try {
        take(await pushActions(source, group.map(follow), opts), group.map((a) => a.id));
        continue;
      } catch (e) {
        if (wait(e)) { out.error = (e as Error).message; return out; }
      }
    }
    for (const a of group) if (!(await one(a))) return out;
  }
  return out;
}
