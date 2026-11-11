// Changing a book's chapter numbers from the writing screen's chapter list (Kyle, 2026-10-22: hold a chapter for "Add a
// chapter below" and "Move chapter"). A chapter's number lives on its scenes and on the notes that belong to a chapter
// by number (beats, plan, scrap, to-dos, scene notes). Beats, plans and scraps are also named "Chapter N beats.md" and
// so on, so those files get the new number in their name as well. Reading order is each scene's `order`, so a chapter
// that moves takes new orders between its new neighbours.
// The Edit room's change lists ("Chapter N changes.md") are chapter notes too and follow the same way. Two lists are
// kept by chapter number outside any chapter note, and `renumberLists` moves them along: the chapters Kyle is through
// in the Rewrite tab (`rewrite_done` on the book note) and the sections of Chapter Titles.md (2026-11-11: before this
// a chapter added, moved or deleted during an edit left all three pointing at the wrong chapter).
import { Frontmatter } from './frontmatter.js';
import { toNumber } from './links.ts';
import { rewriteDone, withRewriteList } from './rewrite.ts';
import { renumberTitles, TITLES_FILE } from './titles.ts';
import type { NoteRecord, VaultSource } from './types.ts';

/** Note types that carry a `chapter` number. The ones in NAMED are also named after their chapter. */
const CHAPTER_TYPES = ['scene', 'task', 'scene-notes', 'chapter-beats', 'chapter-plan', 'chapter-scrap', 'chapter-changes'];
const NAMED = ['chapter-beats', 'chapter-plan', 'chapter-scrap', 'chapter-changes'];

export interface Shift {
  path: string;
  type: string;
  from: number;
  to: number;
  /** Where the note lives after the move (the same path unless its name carries the chapter number). */
  newPath: string;
  /** A scene of a chapter that moves: its new place in reading order. */
  order?: number;
  /** Saved under a passing name first, because another chapter's note still has its new name (a move, not a shift). */
  via?: string;
}

const NAME_RE = /\/Chapter (\d+)( [^/]*\.md)$/;

/** Every note of the book whose chapter is in `map`, with its new number. */
function shiftsFor(notes: Record<string, NoteRecord>, bookFolder: string, map: (ch: number) => number | null): Shift[] {
  const out: Shift[] = [];
  Object.values(notes).forEach((n) => {
    if (!n.path.startsWith(bookFolder + '/') || CHAPTER_TYPES.indexOf(n.type) < 0) return;
    const ch = toNumber(n.data.chapter);
    const to = ch == null ? null : map(ch);
    if (ch == null || to == null || to === ch) return;
    const m = NAMED.indexOf(n.type) >= 0 ? NAME_RE.exec(n.path) : null;
    const newPath = m && Number(m[1]) === ch ? n.path.replace(NAME_RE, '/Chapter ' + to + m[2]) : n.path;
    out.push({ path: n.path, type: n.type, from: ch, to, newPath });
  });
  return out;
}

/** Every note of the book in a chapter after `after`, one chapter up, highest chapter first, so a stop half way leaves a
 * gap, never two chapters with the same number. */
export function chapterShifts(notes: Record<string, NoteRecord>, bookFolder: string, after: number): Shift[] {
  return shiftsFor(notes, bookFolder, (ch) => (ch > after ? ch + 1 : null))
    .sort((a, b) => b.from - a.from || a.path.localeCompare(b.path));
}

/** Move chapter `from` to number `to`; the chapters in between close up by one. `scenes` is the book in reading order.
 * The moving chapter's named notes go to a passing name first and to their own name last, so no two files clash. */
export function chapterMove(notes: Record<string, NoteRecord>, bookFolder: string, scenes: NoteRecord[], from: number, to: number): Shift[] {
  if (from === to) return [];
  const up = to < from;
  const map = (ch: number) => (ch === from ? to : up ? (ch >= to && ch < from ? ch + 1 : null) : (ch > from && ch <= to ? ch - 1 : null));
  const all = shiftsFor(notes, bookFolder, map);
  // New reading order for the moving scenes: before chapter `to`'s first scene (moving up) or after its last (down).
  const moving = scenes.filter((n) => toNumber(n.data.chapter) === from);
  const rest = scenes.filter((n) => toNumber(n.data.chapter) !== from);
  const inTo = rest.filter((n) => toNumber(n.data.chapter) === to);
  let prev: NoteRecord | null, next: NoteRecord | null;
  if (inTo.length) {
    const at = rest.indexOf(up ? inTo[0] : inTo[inTo.length - 1]);
    prev = up ? rest[at - 1] || null : rest[at];
    next = up ? rest[at] : rest[at + 1] || null;
  } else {
    prev = rest[rest.length - 1] || null;
    next = null;
  }
  const ord = (n: NoteRecord | null) => (n && typeof n.data.order === 'number' ? n.data.order : null);
  const a = ord(prev), b = ord(next);
  const lo = a != null ? a : b != null ? b - moving.length - 1 : 0;
  const step = a != null && b != null ? (b - lo) / (moving.length + 1) : 1;
  const orders = new Map(moving.map((n, i) => [n.path, Math.round((lo + step * (i + 1)) * 1000) / 1000]));
  all.forEach((s) => {
    if (s.type === 'scene' && orders.has(s.path)) s.order = orders.get(s.path);
    if (s.from === from && s.newPath !== s.path) s.via = s.newPath.replace(/\.md$/, ' (moving).md');
  });
  // The moving chapter first (to its passing names), then the others in an order that never lands on a taken name,
  // then the moving chapter's named notes to their own names.
  const key = (s: Shift) => (s.from === from ? -1e9 : up ? -s.from : s.from);
  return all.sort((x, y) => key(x) - key(y) || x.path.localeCompare(y.path));
}

/** The note's text with its new chapter number (and order). A title like "Chapter 7 beats" follows the number. */
export function shiftedText(text: string, s: Shift): string {
  let out = Frontmatter.setScalar(text, 'chapter', s.to);
  if (s.order != null) out = Frontmatter.setScalar(out, 'order', s.order);
  const data = Frontmatter.parse(out).data || {};
  const title = typeof data.title === 'string' ? data.title : '';
  const m = /^Chapter (\d+)( .*)?$/.exec(title);
  if (NAMED.indexOf(s.type) >= 0 && m && Number(m[1]) === s.from) out = Frontmatter.setScalar(out, 'title', 'Chapter ' + s.to + (m[2] || ''));
  return out;
}

/** Save every shift, one save per note (two for a note that passes through another name). Throws a plain sentence if
 * one cannot be saved. */
export async function applyShifts(source: VaultSource, shifts: Shift[], why: string): Promise<void> {
  if (!source.readFresh || !source.write) throw new Error('This vault cannot be changed from the app.');
  const write = source.write.bind(source);
  const rename = async (from: string, to: string, text: string, sha: string, msg: string) => {
    if (!source.remove) throw new Error('This vault cannot rename notes from the app.');
    const made = await write(to, text, '', msg);
    await source.remove(from, sha, msg);
    return made;
  };
  const later: { from: string; to: string; text: string; sha: string; msg: string }[] = [];
  for (const s of shifts) {
    const msg = 'chapters: chapter ' + s.from + ' is now ' + s.to + ' (' + s.path.slice(s.path.lastIndexOf('/') + 1).replace(/\.md$/, '') + ')\n\n' + why;
    try {
      for (let attempt = 0; ; attempt++) {
        const { text, sha } = await source.readFresh(s.path);
        const next = shiftedText(text, s);
        try {
          if (s.newPath === s.path) {
            if (next !== text) await write(s.path, next, sha, msg);
          } else if (s.via) {
            const viaSha = await rename(s.path, s.via, next, sha, msg);
            later.push({ from: s.via, to: s.newPath, text: next, sha: viaSha, msg });
          } else await rename(s.path, s.newPath, next, sha, msg);
          break;
        } catch (e) {
          if ((e as { conflict?: boolean }).conflict && attempt === 0 && s.newPath === s.path) continue;
          throw e;
        }
      }
    } catch (e) {
      throw new Error('Chapter ' + s.from + ' could not become chapter ' + s.to + ' (' + (e as Error).message + '). Press Sync and look at the chapter list before trying again.');
    }
  }
  for (const l of later) {
    try {
      await rename(l.from, l.to, l.text, l.sha, l.msg);
    } catch (e) {
      throw new Error('A note could not get its new name (' + (e as Error).message + '). It is saved as ' + l.from.slice(l.from.lastIndexOf('/') + 1) + '.');
    }
  }
}

/** After chapter `gone` is deleted, every later chapter closes up by one, lowest first, so each note moves into a number
 * (and a file name) the one before it has just left. `left` are notes already taken away (they are not shifted). */
export function chapterCloseUp(notes: Record<string, NoteRecord>, bookFolder: string, gone: number, left: string[] = []): Shift[] {
  return shiftsFor(notes, bookFolder, (ch) => (ch > gone ? ch - 1 : null))
    .filter((s) => left.indexOf(s.path) < 0)
    .sort((a, b) => a.from - b.from || a.path.localeCompare(b.path));
}

/** The notes that belong to chapter `ch` by number and are not scenes (beats, plan, scrap, to-dos, scene notes, the
 * Edit room's change list). */
export function chapterNotes(notes: Record<string, NoteRecord>, bookFolder: string, ch: number): NoteRecord[] {
  return Object.values(notes).filter((n) => n.path.startsWith(bookFolder + '/') && n.type !== 'scene' && CHAPTER_TYPES.indexOf(n.type) >= 0 &&
    toNumber(n.data.chapter) === ch && !/\/(Archive|Snapshots|Exports)\//.test(n.path.slice(bookFolder.length)));
}

/** Move every note in `shifts` up one chapter to make room for a new chapter. */
export async function makeRoom(source: VaultSource, shifts: Shift[], newChapter: number): Promise<void> {
  await applyShifts(source, shifts, 'Chapters after ' + (newChapter - 1) + ' move up one to make room for a new chapter ' + newChapter + '. Added in the Sparrow app.');
}

/** Renaming a chapter (Kyle, 2026-10-22: tap the chapter's name on the page, or hold it in the list). A chapter's name is
 * the `chapter_title` of its scenes: the new name goes on the chapter's first scene and on every scene that already
 * carries one, so no older name is left to show. An empty name takes the line off them. */
export function chapterTitleEdits(scenes: NoteRecord[], title: string): string[] {
  const clean = title.replace(/\s+/g, ' ').trim();
  return scenes.filter((n, i) => {
    const had = typeof n.data.chapter_title === 'string' && n.data.chapter_title !== '';
    return clean ? (i === 0 || had) && n.data.chapter_title !== clean : had;
  }).map((n) => n.path);
}

/** A chapter's number after a change, for the lists kept by number: `null` means the chapter is gone. */
export type ChapterMap = (ch: number) => number | null;
/** A new chapter goes in after chapter `after`. */
export const roomMap = (after: number): ChapterMap => (ch) => (ch > after ? ch + 1 : ch);
/** Chapter `from` becomes chapter `to`; the chapters in between close up by one. */
export const moveMap = (from: number, to: number): ChapterMap => (ch) =>
  ch === from ? to : to < from ? (ch >= to && ch < from ? ch + 1 : ch) : (ch > from && ch <= to ? ch - 1 : ch);
/** Chapter `gone` is deleted; the chapters after it close up by one. */
export const closeMap = (gone: number): ChapterMap => (ch) => (ch === gone ? null : ch > gone ? ch - 1 : ch);

/** The book's two lists kept by chapter number follow a renumbering: `rewrite_done` on the book note and the
 * `## Chapter N` sections of Chapter Titles.md. Each is one save and only when it changes. Returns the title options of
 * a deleted chapter (or ''), so the caller can put them in the Archive. Throws a plain sentence. */
export async function renumberLists(source: VaultSource, notes: Record<string, NoteRecord>, bookFolder: string, map: ChapterMap, why: string): Promise<string> {
  if (!source.readFresh || !source.write) throw new Error('This vault cannot be changed from the app.');
  const readFresh = source.readFresh.bind(source), write = source.write.bind(source);
  const save = async (path: string, what: string, change: (text: string) => string) => {
    try {
      for (let attempt = 0; ; attempt++) {
        const { text, sha } = await readFresh(path);
        const next = change(text);
        if (next === text) return;
        try {
          await write(path, next, sha, 'chapters: ' + what + ' follows the new chapter numbers\n\n' + why);
          return;
        } catch (e) {
          if ((e as { conflict?: boolean }).conflict && attempt === 0) continue;
          throw e;
        }
      }
    } catch (e) {
      throw new Error('The chapters have their new numbers, but ' + what + ' could not follow (' + (e as Error).message + '). Tell the team so they can set it right.');
    }
  };
  const bookPath = bookFolder + '/Book.md';
  if (notes[bookPath] && rewriteDone(notes[bookPath]).length) {
    await save(bookPath, 'the list of chapters you are through in the Rewrite tab', (text) => {
      const now = rewriteDone({ data: (Frontmatter.parse(text).data || {}) as Record<string, unknown> });
      const next = now.map(map).filter((n): n is number => n != null);
      return next.join() === now.join() ? text : withRewriteList(text, next);
    });
  }
  let gone = '';
  const titlesPath = bookFolder + '/' + TITLES_FILE;
  if (notes[titlesPath]) {
    await save(titlesPath, 'the chapter titles list', (text) => {
      const r = renumberTitles(text, map);
      gone = r.gone;
      return r.text;
    });
  }
  return gone;
}
