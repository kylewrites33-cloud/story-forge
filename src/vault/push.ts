// Sending the outbox up. One action is one save: every note it touches is read as the vault has it now, changed, and
// written together, or nothing is written. If the vault moved while the save was being made (the team, another device),
// the source asks for the plan again on the newer notes, so Kyle's change lands on top and nothing of theirs is lost.
import { makeNote } from '../lib/vault-index.ts';
import { saveChoice } from '../lib/write-queue.ts';
import type { NoteRecord, VaultSource } from '../lib/types.ts';
import { editMessage, editText } from './apply.ts';
import type { Action } from './ops.ts';

/** The line for the vault's history: the first change's own line, with the others named under it. */
function messageFor(lines: string[]): string {
  if (lines.length < 2) return lines[0] || 'app: save';
  const [subject, ...body] = lines[0].split('\n');
  const also = lines.slice(1).map((l) => '- ' + l.split('\n')[0]);
  return subject + '\n\nSaved together with:\n' + also.join('\n') + (body.join('\n').trim() ? '\n\n' + body.join('\n').trim() : '');
}

/** How many notes are read at once before a save. */
const READS = 6;

/** Save actions as one step: all of them go up together, or none does. Answers the notes they touched as the vault now
 * has them, for the saved copy. */
export async function pushActions(source: VaultSource, actions: Action[]): Promise<NoteRecord[]> {
  if (!source.commit) throw new Error('This vault cannot be changed from the app.');
  const paths = [...new Set(actions.flatMap((a) => a.ops.map((op) => op.path)))];
  // What the last plan read and made, kept for the answer: the plan may run more than once.
  let now = new Map<string, string>();
  let was = new Map<string, { text: string; sha: string }>();
  const res = await source.commit(async (read) => {
    now = new Map();
    was = new Map();
    for (let i = 0; i < paths.length; i += READS) {
      const some = paths.slice(i, i + READS);
      const got = await Promise.all(some.map((p) => read(p)));
      // A note that is gone (moved or renamed elsewhere) cannot take a change; the rest still saves.
      got.forEach((cur, j) => { if (cur) { was.set(some[j], cur); now.set(some[j], cur.text); } });
    }
    const lines: string[] = [];
    actions.forEach((a) => a.ops.forEach((op) => {
      const text = now.get(op.path);
      if (text === undefined) return;
      const next = editText(text, op.edit);
      if (next !== text) lines.push(editMessage(text, op.edit));
      now.set(op.path, next);
    }));
    const writes = paths.filter((p) => now.has(p) && now.get(p) !== was.get(p)!.text).map((path) => ({ path, text: now.get(path)! }));
    return writes.length ? { message: messageFor(lines), writes } : null;
  });
  return paths.filter((p) => now.has(p)).map((path) => makeNote(path, (res && res.shas[path]) || was.get(path)!.sha, now.get(path)!));
}

/** Save one action as one step. */
export const pushAction = (source: VaultSource, action: Action): Promise<NoteRecord[]> => pushActions(source, [action]);

/** The old way, one note at a time through write-queue's saveChoice. Kept behind a switch in Settings until the new
 * way has run on the real book (2026-11-11); a failure part-way can leave an action half saved, as it always could. */
async function pushLegacy(source: VaultSource, action: Action): Promise<NoteRecord[]> {
  const out: NoteRecord[] = [];
  for (const op of action.ops) {
    try {
      out.push(await saveChoice(source, op.edit.choice));
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
    }
  }
  return out;
}

export interface PushResult {
  /** Notes as the vault now has them. */
  saved: NoteRecord[];
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
  const out: PushResult = { saved: [], done: [], failed: {}, error: null };
  const one = async (a: Action): Promise<boolean> => {
    try {
      out.saved.push(...await (opts.legacy ? pushLegacy(source, a) : pushAction(source, a)));
      out.done.push(a.id);
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
        out.saved.push(...await pushActions(source, group));
        out.done.push(...group.map((a) => a.id));
        continue;
      } catch (e) {
        if (wait(e)) { out.error = (e as Error).message; return out; }
      }
    }
    for (const a of group) if (!(await one(a))) return out;
  }
  return out;
}
