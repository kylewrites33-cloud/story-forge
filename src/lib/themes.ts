// The Themes heatmap: the book's theme notes (its Themes folder) down the side, its chapters across. A cell's strength is
// how often the theme's keywords appear in the chapter's prose (whole words, any case); a mark shows where a scene card
// links the theme in any of its fields. Each cell keeps the lines that matched, to show when it is pressed.
import { lineAround } from './codex.ts';
import { linkName, toNumber } from './links.ts';
import { bookNotesOf, storyScenes, stringList } from './seeing.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

export interface ChapterCol { key: string; num: number | null; title: string; scenes: NoteRecord[] }

export interface ThemeHit { scene: NoteRecord; line: string; count: number }

export interface ThemeCell {
  /** Keyword matches in the chapter's prose. */
  count: number;
  /** Scenes of the chapter whose card links the theme. */
  cards: NoteRecord[];
  /** The lines that matched, one per sentence, in reading order. */
  hits: ThemeHit[];
}

export interface ThemeRow { note: NoteRecord; name: string; kind: string; keywords: string[]; cells: ThemeCell[]; total: number }

/** The book's story scenes by chapter, in reading order; scenes with no chapter make one column at the end. */
export function chapterCols(scenes: NoteRecord[]): ChapterCol[] {
  const out: ChapterCol[] = [];
  let none: ChapterCol | null = null;
  scenes.forEach((s) => {
    const num = toNumber(s.data.chapter);
    if (num == null) { if (!none) none = { key: 'none', num: null, title: '', scenes: [] }; none.scenes.push(s); return; }
    let col = out.find((c) => c.num === num);
    if (!col) { col = { key: 'c' + num, num, title: '', scenes: [] }; out.push(col); }
    if (!col.title && typeof s.data.chapter_title === 'string') col.title = s.data.chapter_title.trim();
    col.scenes.push(s);
  });
  if (none) out.push(none);
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** One pattern for a theme's keywords as whole words in any case, longest first; null when it has none. */
export function keywordPattern(keywords: string[]): RegExp | null {
  const words = keywords.map((k) => k.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!words.length) return null;
  return new RegExp('(?<![\\p{L}\\p{N}])(?:' + words.map(esc).join('|') + ')(?![\\p{L}\\p{N}])', 'giu');
}

/** Every link a card makes in any of its fields: [[links]] inside text, and the names in list fields. */
export function cardLinks(data: Record<string, unknown>): string[] {
  const out: string[] = [];
  Object.keys(data).forEach((k) => {
    if (k === 'type' || k === 'id' || k === 'title') return;
    const v = data[k];
    const values = Array.isArray(v) ? v.flat() : [v];
    values.forEach((x) => {
      if (typeof x !== 'string') return;
      const re = /\[\[([^\]]+)\]\]/g;
      let m: RegExpExecArray | null;
      let any = false;
      while ((m = re.exec(x))) { out.push(linkName('[[' + m[1] + ']]')); any = true; }
      if (!any && Array.isArray(v)) out.push(linkName(x));
    });
  });
  return out.filter(Boolean);
}

/** Matches of a pattern in a scene's prose, grouped by the sentence they fall in. */
export function hitsIn(scene: NoteRecord, re: RegExp | null): ThemeHit[] {
  if (!re) return [];
  const out: ThemeHit[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scene.body))) {
    const line = lineAround(scene.body, m.index, m.index + m[0].length);
    const same = out.find((h) => h.line === line);
    if (same) same.count++;
    else out.push({ scene, line, count: 1 });
  }
  return out;
}

export function bookThemes(index: VaultIndex, book: BookEntry): NoteRecord[] {
  return bookNotesOf(index, book, 'theme').filter((n) => String(n.data.name || '').trim())
    .sort((a, b) => String(a.data.name).localeCompare(String(b.data.name)));
}

export function themeGrid(index: VaultIndex, book: BookEntry): { chapters: ChapterCol[]; rows: ThemeRow[]; max: number } {
  const chapters = chapterCols(storyScenes(index, book));
  const linksOf = new Map<string, string[]>();
  chapters.forEach((c) => c.scenes.forEach((s) => linksOf.set(s.path, cardLinks(s.data).map((x) => x.toLowerCase()))));
  let max = 0;
  const rows = bookThemes(index, book).map((note) => {
    const name = String(note.data.name).trim();
    const keywords = stringList(note.data.keywords);
    const re = keywordPattern(keywords.length ? keywords : [name]);
    const cells = chapters.map((c) => {
      const hits = c.scenes.flatMap((s) => hitsIn(s, re));
      const count = hits.reduce((n, h) => n + h.count, 0);
      if (count > max) max = count;
      return { count, cards: c.scenes.filter((s) => (linksOf.get(s.path) || []).indexOf(name.toLowerCase()) >= 0), hits };
    });
    return { note, name, kind: String(note.data.kind || ''), keywords, cells, total: cells.reduce((n, c) => n + c.count, 0) };
  });
  return { chapters, rows, max };
}

/** How strong a cell looks, 0 (none) to 4, against the busiest cell of the grid. */
export function heatLevel(count: number, max: number): number {
  if (!count || !max) return 0;
  return Math.max(1, Math.min(4, Math.ceil((count / max) * 4)));
}
