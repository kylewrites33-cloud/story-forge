// A chapter has its own ID that never changes (`chapter_id`, CH-007; redesign step 5, Kyle 2026-11-12: "do step 5").
// A chapter is the scenes that share a `chapter` number, and they share the ID. A chapter's other notes (beats, plan,
// scrap, the Edit room's changes, scene notes, to-dos) carry the same ID, and that line says which chapter they belong
// to: the `chapter` number written on them, and the "Chapter 7" in a file name, are labels. So a note stays with its
// chapter when chapters are added, moved or deleted, whoever wrote it and whatever number it was written with.
// The vault's tool keeps the same rules (author-business System/Tools/chapter-ids.mjs) and gave the first IDs.
import { toNumber } from './links.ts';
import type { NoteRecord } from './types.ts';

/** The kinds of note that belong to a chapter and are not scenes. */
export const CHAPTER_NOTE_TYPES = ['task', 'scene-notes', 'chapter-beats', 'chapter-plan', 'chapter-scrap', 'chapter-changes'];

const BOOK_RE = /^(Series\/[^/]+\/Books\/[^/]+)\//;
/** The folder of the book a path is in, or ''. */
export const bookOf = (path: string): string => { const m = BOOK_RE.exec(path); return m ? m[1] : ''; };

const ID_RE = /^CH-(\d+)$/;
export const chapterId = (n: number): string => 'CH-' + String(n).padStart(3, '0');
const idNumber = (id: unknown): number | null => { const m = ID_RE.exec(String(id || '')); return m ? Number(m[1]) : null; };
/** A note's chapter ID, or '' when it has none (or one that is not an ID). */
export const idOf = (n: { data: Record<string, unknown> }): string => (idNumber(n.data.chapter_id) != null ? String(n.data.chapter_id) : '');

/** The notes with every chapter note's `chapter` read from its ID: the number its chapter's scenes have now. A note
 * with no ID, or whose chapter the book no longer has, keeps the number written on it. Notes that need no change are
 * the same objects, and so is the list when none does. */
export function resolveChapters<T extends Record<string, NoteRecord> | NoteRecord[]>(notes: T): T {
  const list: NoteRecord[] = Array.isArray(notes) ? notes : Object.values(notes);
  const carriers = list.filter((n) => CHAPTER_NOTE_TYPES.indexOf(n.type) >= 0 && idOf(n));
  if (!carriers.length) return notes;
  const now = new Map<string, number>();
  list.forEach((n) => {
    if (n.type !== 'scene' || !idOf(n)) return;
    const ch = toNumber(n.data.chapter);
    if (ch != null) now.set(bookOf(n.path) + '#' + idOf(n), ch);
  });
  const fixed = new Map<string, NoteRecord>();
  carriers.forEach((n) => {
    const ch = now.get(bookOf(n.path) + '#' + idOf(n));
    if (ch == null || toNumber(n.data.chapter) === ch) return;
    fixed.set(n.path, { ...n, data: { ...n.data, chapter: ch } });
  });
  if (!fixed.size) return notes;
  if (Array.isArray(notes)) return notes.map((n) => fixed.get(n.path) || n) as T;
  const out: Record<string, NoteRecord> = { ...notes };
  fixed.forEach((n, p) => { out[p] = n; });
  return out as T;
}

/** A chapter-carrying note as a save sees it. `touched`: this save adds or changes it. */
export interface IdNote { path: string; type: string; chapter: number | null; id: string; touched: boolean }

/** The chapter IDs a save must write so the book stays right, given the book's scenes (all of them) and the chapter
 * notes the save touches. Answers path to ID. Nothing at all while the book has no chapter IDs yet.
 * - Every scene of a chapter carries the chapter's ID. An ID is at home in the chapter where most scenes carry it;
 *   scenes this save did not touch count far more than ones it did, so a scene moved into a chapter takes that
 *   chapter's ID, and a chapter that only changed its number keeps its own.
 * - A chapter with no ID (a new one) gets the next number no chapter has had.
 * - A chapter note the save touches that has a number and no ID gets its chapter's ID. One with an ID keeps it. */
export function planChapterIds(scenes: IdNote[], others: IdNote[], alsoUsed: string[] = []): Map<string, string> {
  const out = new Map<string, string>();
  if (!scenes.some((s) => s.id) && !others.some((o) => o.id)) return out;
  const groups = new Map<number, IdNote[]>();
  scenes.forEach((s) => { if (s.chapter != null) { if (!groups.has(s.chapter)) groups.set(s.chapter, []); groups.get(s.chapter)!.push(s); } });
  const numbers = Array.from(groups.keys()).sort((a, b) => a - b);
  const votes = new Map<string, Map<number, number>>();
  numbers.forEach((n) => groups.get(n)!.forEach((s) => {
    if (!s.id) return;
    if (!votes.has(s.id)) votes.set(s.id, new Map());
    const v = votes.get(s.id)!;
    v.set(n, (v.get(n) || 0) + (s.touched ? 1 : 1000));
  }));
  const claim = new Map<number, { id: string; votes: number }>();
  Array.from(votes.keys()).sort().forEach((id) => {
    const v = Array.from(votes.get(id)!.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const had = claim.get(v[0][0]);
    if (!had || had.votes < v[0][1]) claim.set(v[0][0], { id, votes: v[0][1] });
  });
  let top = Math.max(0, ...scenes.concat(others).map((n) => idNumber(n.id) || 0), ...alsoUsed.map((id) => idNumber(id) || 0));
  const ids = new Map<number, string>();
  numbers.forEach((n) => { ids.set(n, claim.has(n) ? claim.get(n)!.id : chapterId(++top)); });
  scenes.forEach((s) => { const id = s.chapter == null ? '' : ids.get(s.chapter) || ''; if (id && s.id !== id) out.set(s.path, id); });
  others.forEach((o) => { const id = o.chapter == null ? '' : ids.get(o.chapter) || ''; if (id && !o.id && o.touched) out.set(o.path, id); });
  return out;
}

const HEAD_RE = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

/** The note's text with its chapter_id line set: changed in place when it has one, else added under the `chapter`
 * line. No other line changes. */
export function withChapterId(text: string, id: string): string {
  const m = HEAD_RE.exec(text);
  if (!m) return text;
  const block = m[1];
  const next = /^chapter_id:.*$/m.test(block) ? block.replace(/^chapter_id:.*$/m, 'chapter_id: ' + id)
    : /^chapter:.*$/m.test(block) ? block.replace(/^(chapter:.*)$/m, '$1\nchapter_id: ' + id)
    : block + '\nchapter_id: ' + id;
  const at = text.indexOf(block, m.index);
  return text.slice(0, at) + next + text.slice(at + block.length);
}
