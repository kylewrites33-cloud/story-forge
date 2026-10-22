// Making room for a chapter in the middle of a book (Kyle, 2026-10-22: a long press on a chapter in the writing
// screen's list offers "Add a chapter below"). Every chapter after the new one moves up by one: its scenes, and the
// notes that belong to a chapter by number (beats, plan, scrap, to-dos, scene notes). Beats, plans and scraps are named
// "Chapter N beats.md" and so on, so those files get the new number in their name as well.
import { Frontmatter } from './frontmatter.js';
import { toNumber } from './links.ts';
import type { NoteRecord, VaultSource } from './types.ts';

/** Note types that carry a `chapter` number. The ones in NAMED are also named after their chapter. */
const CHAPTER_TYPES = ['scene', 'task', 'scene-notes', 'chapter-beats', 'chapter-plan', 'chapter-scrap'];
const NAMED = ['chapter-beats', 'chapter-plan', 'chapter-scrap'];

export interface Shift {
  path: string;
  type: string;
  from: number;
  to: number;
  /** Where the note lives after the move (the same path unless its name carries the chapter number). */
  newPath: string;
}

const NAME_RE = /\/Chapter (\d+)( [^/]*\.md)$/;

/** Every note of the book in a chapter after `after`, highest chapter first, so a stop half way leaves a gap, never two
 * chapters with the same number. */
export function chapterShifts(notes: Record<string, NoteRecord>, bookFolder: string, after: number): Shift[] {
  const out: Shift[] = [];
  Object.values(notes).forEach((n) => {
    if (!n.path.startsWith(bookFolder + '/') || CHAPTER_TYPES.indexOf(n.type) < 0) return;
    const ch = toNumber(n.data.chapter);
    if (ch == null || ch <= after) return;
    const m = NAMED.indexOf(n.type) >= 0 ? NAME_RE.exec(n.path) : null;
    const newPath = m && Number(m[1]) === ch ? n.path.replace(NAME_RE, '/Chapter ' + (ch + 1) + m[2]) : n.path;
    out.push({ path: n.path, type: n.type, from: ch, to: ch + 1, newPath });
  });
  return out.sort((a, b) => b.from - a.from || a.path.localeCompare(b.path));
}

/** The note's text with its new chapter number. A title like "Chapter 7 beats" follows the number; nothing else changes. */
export function shiftedText(text: string, s: Shift): string {
  let out = Frontmatter.setScalar(text, 'chapter', s.to);
  const data = Frontmatter.parse(out).data || {};
  const title = typeof data.title === 'string' ? data.title : '';
  const m = /^Chapter (\d+)( .*)?$/.exec(title);
  if (NAMED.indexOf(s.type) >= 0 && m && Number(m[1]) === s.from) out = Frontmatter.setScalar(out, 'title', 'Chapter ' + s.to + (m[2] || ''));
  return out;
}

/** Move every note in `shifts` up one chapter, one save each. Throws a plain sentence if one cannot be saved. */
export async function makeRoom(source: VaultSource, shifts: Shift[], newChapter: number): Promise<void> {
  if (!source.readFresh || !source.write) throw new Error('This vault cannot be changed from the app.');
  const why = 'Chapters after ' + (newChapter - 1) + ' move up one to make room for a new chapter ' + newChapter + '. Added in the Sparrow app.';
  for (const s of shifts) {
    const msg = 'chapters: chapter ' + s.from + ' is now ' + s.to + ' (' + s.path.slice(s.path.lastIndexOf('/') + 1).replace(/\.md$/, '') + ')\n\n' + why;
    try {
      for (let attempt = 0; ; attempt++) {
        const { text, sha } = await source.readFresh(s.path);
        const next = shiftedText(text, s);
        try {
          if (s.newPath === s.path) {
            if (next !== text) await source.write(s.path, next, sha, msg);
          } else {
            if (!source.remove) throw new Error('This vault cannot rename notes from the app.');
            await source.write(s.newPath, next, '', msg);
            await source.remove(s.path, sha, msg);
          }
          break;
        } catch (e) {
          if ((e as { conflict?: boolean }).conflict && attempt === 0 && s.newPath === s.path) continue;
          throw e;
        }
      }
    } catch (e) {
      throw new Error('Chapter ' + s.from + ' could not move up to ' + s.to + ' (' + (e as Error).message + '). Press Sync and look at the chapter list before trying again.');
    }
  }
}
