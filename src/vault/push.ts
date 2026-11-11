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
  const a = Frontmatter.parse(found).data || {}, b = Frontmatter.parse(shown).data || {};
  return ['type', 'id', 'title', 'created'].every((k) => String(a[k]) === String(b[k]));
}

/** How many notes are read at once before a save. */
const READS = 6;

export interface Pushed {
  /** Notes as the vault now has them. */
  saved: NoteRecord[];
  /** New notes that were saved under another path than they were shown with (their ID was taken meanwhile): old path to new. */
  renames: Record<string, string>;
}

/** Save actions as one step: all of them go up together, or none does. Answers the notes they touched as the vault now
 * has them, for the saved copy. */
export async function pushActions(source: VaultSource, actions: Action[]): Promise<Pushed> {
  if (!source.commit) throw new Error('This vault cannot be changed from the app.');
  const ops = actions.flatMap((a) => a.ops);
  const creates = new Set(ops.filter((op) => op.kind === 'create').map((op) => op.path));
  // Notes that are in the vault already and take an edit. A note this save itself adds is not read.
  const paths = [...new Set(ops.filter((op) => op.kind === 'edit' && !creates.has(op.path)).map((op) => op.path))];
  // What the last plan read and made, kept for the answer: the plan may run more than once.
  let now = new Map<string, string>();
  let was = new Map<string, { text: string; sha: string }>();
  let renames: Record<string, string> = {};
  const res = await source.commit(async (head) => {
    now = new Map();
    was = new Map();
    renames = {};
    for (let i = 0; i < paths.length; i += READS) {
      const some = paths.slice(i, i + READS);
      const got = await Promise.all(some.map((p) => head.read(p)));
      // A note that is gone (moved or renamed elsewhere) cannot take a change; the rest still saves.
      got.forEach((cur, j) => { if (cur) { was.set(some[j], cur); now.set(some[j], cur.text); } });
    }
    // New notes take their IDs from the files the vault has now, and from the ones this same save adds before them.
    const files = creates.size ? (await head.files()).slice() : [];
    const lines: string[] = [];
    for (const op of ops) {
      if (op.kind === 'create') {
        const there = files.some((f) => f.path === op.path) ? await head.read(op.path) : null;
        if (there && sameNote(there.text, op.text)) {
          // Saved by an earlier try. Changes that wait for it are made on the note as the vault has it.
          if (!was.has(op.path)) { was.set(op.path, there); now.set(op.path, there.text); }
          continue;
        }
        const made = make(op.make, files, op.payload, op.id);
        files.push({ path: made.path, sha: '' });
        now.set(made.path, made.text);
        if (made.path !== op.path) renames[op.path] = made.path;
        lines.push(made.message);
        continue;
      }
      const path = renames[op.path] || op.path;
      const text = now.get(path);
      if (text === undefined) continue;
      const next = editText(text, op.edit);
      if (next !== text) lines.push(editMessage(text, op.edit, path));
      now.set(path, next);
    }
    const writes = [...now].filter(([path, text]) => !was.has(path) || text !== was.get(path)!.text).map(([path, text]) => ({ path, text }));
    return writes.length ? { message: messageFor(lines), writes } : null;
  });
  return { saved: [...now].map(([path, text]) => makeNote(path, (res && res.shas[path]) || was.get(path)!.sha, text)), renames };
}

/** Save one action as one step. */
export const pushAction = (source: VaultSource, action: Action): Promise<Pushed> => pushActions(source, [action]);

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
  const out: Pushed = { saved: [], renames: {} };
  for (const op of action.ops) {
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
export async function pushAll(source: VaultSource, list: Action[], opts: { legacy?: boolean } = {}): Promise<PushResult> {
  const out: PushResult = { saved: [], renames: {}, done: [], failed: {}, error: null };
  // An action later in the list may be about a note an earlier save in this same push gave another path.
  const follow = (a: Action): Action => (a.ops.some((op) => out.renames[op.path]) ? settle([a], [], {}, out.renames)[0] : a);
  const take = (p: Pushed, ids: string[]) => { out.saved.push(...p.saved); Object.assign(out.renames, p.renames); out.done.push(...ids); };
  const one = async (a: Action): Promise<boolean> => {
    try {
      take(await (opts.legacy ? pushLegacy(source, follow(a)) : pushAction(source, follow(a))), [a.id]);
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
        take(await pushActions(source, group.map(follow)), group.map((a) => a.id));
        continue;
      } catch (e) {
        if (wait(e)) { out.error = (e as Error).message; return out; }
      }
    }
    for (const a of group) if (!(await one(a))) return out;
  }
  return out;
}
