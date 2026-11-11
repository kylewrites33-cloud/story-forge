// The writing page's own saves through the one saving system. The page (and the chapter page, the beats page, the plan
// and scrap boxes) keeps Kyle's words on the device as he types, as before (src/lib/drafts.ts); when it saves, the
// words go up here as one action, sent at once: the scene with what changed elsewhere merged in, and, when a version
// clashed with his, that version kept as a copy in the same save. A copy Kyle asks for is one save too.
// With "The old way" picked in Settings, or a vault that cannot take one save of many files, the older functions run.
import * as old from '../lib/drafts.ts';
import type { Draft, SaveResult } from '../lib/drafts.ts';
import { joinNote, orderBetween } from '../lib/scenes.ts';
import type { NoteRecord, VaultSource } from '../lib/types.ts';
import { createAction, wordsAction, type Op } from './ops.ts';
import { pushAction } from './push.ts';
import { oldSaving } from './switch.ts';

const newWay = (source: VaultSource): boolean => Boolean(source.commit) && !oldSaving();

/** Save a draft's words, with ops that belong in the same save (`also`: a copy made first, a new scene). */
export async function saveWords(source: VaultSource, d: Draft, now: Date, also: Op[] = []): Promise<SaveResult & { saved: SaveResult['note'][]; renames: Record<string, string> }> {
  const res = await pushAction(source, wordsAction(d.path, d, also, now));
  const note = res.saved.find((n) => n.path === d.path);
  if (!note) throw new Error('The save went up but the scene did not come back with it. Press Sync.');
  return { note, clash: (res.clashes || {})[d.path] || null, merged: (res.merged || []).indexOf(d.path) >= 0, saved: res.saved, renames: res.renames };
}

/** Save a draft to the vault: what changed elsewhere is merged in, a clashing version is kept as a copy, Kyle's words
 * are written. One save. */
export async function saveDraft(source: VaultSource, d: Draft, now: Date): Promise<SaveResult> {
  if (!newWay(source)) return old.saveDraft(source, d, now);
  const { note, clash, merged } = await saveWords(source, d, now);
  return { note, clash, merged };
}

/** The op that keeps a body as its note's next copy (snapshot), numbered at the save from the copies the vault has. */
export function copyOp(note: { path: string; data: Record<string, unknown> }, body: string, label: string, now: Date, files: { path: string; sha: string }[] = []): Op {
  return createAction('copy', { of: note.path, id: typeof note.data.id === 'string' ? note.data.id : '', body, label, at: now.toISOString() }, files, now).ops[0];
}

/** Save a body as the note's next copy. Returns the new file's path. */
export async function saveSnapshot(source: VaultSource, note: { path: string; data: Record<string, unknown> }, body: string, label: string, now: Date): Promise<string> {
  if (!newWay(source)) return old.saveSnapshot(source, note, body, label, now);
  const op = copyOp(note, body, label, now, (await source.tree()).files);
  const res = await pushAction(source, { id: 'copy-' + now.getTime().toString(36), at: now.toISOString(), ops: [op] });
  return res.renames[op.path] || op.path;
}

/** Split a scene at the cursor as one save: a copy of the whole scene first ("before split"), the words after the
 * cursor as a new scene right after this one, and this scene with the words before it. `before` is this scene's body
 * once split. Before, these were three saves, and a failure between them left the words in both scenes. */
export async function splitWords(source: VaultSource, note: NoteRecord, next: NoteRecord | null, d: Draft, before: string, after: string,
  title: string, bookFolder: string, now: Date): Promise<SaveResult & { created: NoteRecord }> {
  const files = (await source.tree()).files;
  const chapter = typeof note.data.chapter === 'number' && isFinite(note.data.chapter) ? note.data.chapter : null;
  const scene = createAction('scene', {
    s: {
      bookFolder, title, chapter, chapterTitle: typeof note.data.chapter_title === 'string' ? note.data.chapter_title : '',
      order: orderBetween(note, next), status: String(note.data.status || 'drafted'), from: note, body: after
    },
    at: now.toISOString(), why: 'Split from ' + [note.data.id, note.data.title].filter(Boolean).join(' ') + ' in the Sparrow app.'
  }, files, now).ops[0];
  const r = await saveWords(source, { ...d, body: before, freshHeadline: true }, now, [scene, copyOp(note, d.body, 'before split', now, files)]);
  const to = r.renames[scene.path] || scene.path;
  const created = r.saved.find((n) => n.path === to);
  if (!created) throw new Error('The split went up but the new scene did not come back with it. Press Sync.');
  return { note: r.note, clash: r.clash, merged: r.merged, created };
}

/** Join the next scene onto the end of this one as one save: this scene with both sets of words, the next scene's note
 * to the book's Archive, and a note to the team to update what still names it. `joined` is this scene's body once
 * joined and `nextBody` the next scene's words that went into it. Before, these were four saves. Answers whether the
 * team got its note. */
export async function joinWords(source: VaultSource, note: NoteRecord, next: NoteRecord, d: Draft, joined: string, nextBody: string,
  mentions: NoteRecord[], bookFolder: string, now: Date): Promise<SaveResult & { told: boolean }> {
  const join: Op = { kind: 'join', path: next.path, into: note.path, book: bookFolder, body: nextBody, mentions: mentions.map((n) => n.path), at: now.toISOString() };
  const r = await saveWords(source, { ...d, body: joined, freshHeadline: true }, now, [join]);
  return { note: r.note, clash: r.clash, merged: r.merged, told: r.saved.some((n) => n.path === joinNote(bookFolder, next, note, [], now).path) };
}

/** Does this vault save the writing page's words the new way now? */
export const newWords = newWay;
