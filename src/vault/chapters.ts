// A change to a book's chapter numbers as one save: a chapter moved, or room made for a new one. Every note that
// carries a chapter number follows (scenes, to-dos, scene notes, beats, plan, scrap, the Edit room's change list), the
// ones named after their chapter get their new file name, and the two lists kept by number follow too (the chapters
// Kyle is through in the Rewrite tab, and the Chapter Titles note). All of it lands together or not at all, so a
// chapter can no longer be left half moved, and no file needs a passing name on the way.
import { chapterCloseUp, chapterMove, chapterShifts, closeMap, moveMap, roomMap, shiftedText, type ChapterMap, type Shift } from '../lib/chapters.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { toNumber } from '../lib/links.ts';
import { rewriteDone, withRewriteList } from '../lib/rewrite.ts';
import { renumberTitles, TITLES_FILE } from '../lib/titles.ts';
import { compareScenes, makeNote } from '../lib/vault-index.ts';
import type { NoteRecord } from '../lib/types.ts';
import type { ChapterChange } from './ops.ts';
import type { Tree } from './tree.ts';

/** Where a book's notes with a chapter number live, when the device knows of none elsewhere. */
const FOLDERS = ['Scenes', 'Tasks', 'Scene Notes', 'Chapter Beats', 'Chapter Plans', 'Chapter Scraps', 'Changes'];
const SKIP = /\/(Archive|Snapshots|Exports)\//;
const TYPES = ['scene', 'task', 'scene-notes', 'chapter-beats', 'chapter-plan', 'chapter-scrap', 'chapter-changes'];

/** What was done, for the vault's history and for anything that must follow. */
export interface ChaptersDone {
  message: string;
  /** The title options of a chapter that is gone ('' when none), so they can be kept in the Archive. */
  goneTitles: string;
}

const name = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');

/** Make the change on the vault as the save sees it. `known` is the vault as the device has it: a note whose file has
 * not changed since is not read again, only the ones that move. Throws a plain sentence when the change cannot be
 * made; nothing is saved then. */
export async function planChapters(tree: Tree, book: string, change: ChapterChange, why: string, known: Record<string, NoteRecord> = {}): Promise<ChaptersDone> {
  const files = await tree.files();
  // The folders to look in: the usual ones, and any other where the device has seen such a note.
  const folders = new Set(FOLDERS.map((f) => book + '/' + f + '/'));
  Object.keys(known).forEach((p) => { if (p.startsWith(book + '/') && TYPES.indexOf(known[p].type) >= 0) folders.add(p.slice(0, p.lastIndexOf('/') + 1)); });
  const candidates = files.filter((f) => f.path.endsWith('.md') && !SKIP.test(f.path.slice(book.length)) && folders.has(f.path.slice(0, f.path.lastIndexOf('/') + 1)));
  const notes: Record<string, NoteRecord> = {};
  const unread = candidates.filter((f) => {
    const k = known[f.path];
    if (k && f.sha && k.sha === f.sha && !tree.touched(f.path)) { notes[f.path] = k; return false; }
    return true;
  }).map((f) => f.path);
  await tree.readMany(unread);
  for (const p of unread) {
    const text = await tree.read(p);
    if (text != null) notes[p] = makeNote(p, '', text);
  }
  const scenes = Object.values(notes).filter((n) => n.type === 'scene').sort(compareScenes);
  const chapters = scenes.map((n) => toNumber(n.data.chapter)).filter((n): n is number => n != null);
  const last = chapters.length ? Math.max(...chapters) : 0;

  let shifts: Shift[], map: ChapterMap, subject: string;
  if (change.type === 'move') {
    if (chapters.indexOf(change.from) < 0) throw new Error('Chapter ' + change.from + ' is not in the book as the vault has it now. Press Sync and look at the chapter list.');
    if (!Number.isInteger(change.to) || change.to < 1 || change.to > last) throw new Error('Choose a chapter number from 1 to ' + last + '.');
    shifts = chapterMove(notes, book, scenes, change.from, change.to);
    map = moveMap(change.from, change.to);
    subject = 'chapters: chapter ' + change.from + ' is now chapter ' + change.to;
  } else if (change.type === 'room') {
    shifts = chapterShifts(notes, book, change.after);
    map = roomMap(change.after);
    subject = 'chapters: room for a new chapter ' + (change.after + 1);
  } else {
    shifts = chapterCloseUp(notes, book, change.gone);
    map = closeMap(change.gone);
    subject = 'chapters: chapter ' + change.gone + ' is gone, the chapters after it close up';
  }

  // Every note that moves, with its new text; then old names out and new names in, so no two files ever clash.
  await tree.readMany(shifts.map((s) => s.path));
  const moved: { s: Shift; text: string }[] = [];
  for (const s of shifts) {
    const text = await tree.read(s.path);
    if (text != null) moved.push({ s, text: shiftedText(text, s) });
  }
  moved.forEach(({ s }) => { if (s.newPath !== s.path) tree.remove(s.path); });
  const taken = new Set((await tree.files()).map((f) => f.path));
  for (const { s, text } of moved) {
    if (s.newPath !== s.path && taken.has(s.newPath)) throw new Error('The book already has a note called ' + name(s.newPath) + ' that is not chapter ' + s.to + '\'s. Ask the team to look at it; nothing was changed.');
    taken.add(s.newPath);
    tree.write(s.newPath, text);
  }

  // The two lists kept by chapter number.
  const bookPath = book + '/Book.md';
  const bookText = files.some((f) => f.path === bookPath) ? await tree.read(bookPath) : null;
  if (bookText != null) {
    const was = rewriteDone({ data: (Frontmatter.parse(bookText).data || {}) as Record<string, unknown> });
    const next = was.map(map).filter((n): n is number => n != null);
    if (was.length && next.join() !== was.join()) tree.write(bookPath, withRewriteList(bookText, next));
  }
  let goneTitles = '';
  const titlesPath = book + '/' + TITLES_FILE;
  const titlesText = files.some((f) => f.path === titlesPath) ? await tree.read(titlesPath) : null;
  if (titlesText != null) {
    const r = renumberTitles(titlesText, map);
    goneTitles = r.gone;
    if (r.text !== titlesText) tree.write(titlesPath, r.text);
  }
  const n = moved.length;
  return { message: subject + '\n\n' + why + ' ' + n + ' note' + (n === 1 ? '' : 's') + ' followed, in one save.', goneTitles };
}
