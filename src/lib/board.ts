// The Chapter Grid: a book's scenes grouped by chapter, in reading order.
import { toNumber } from './links.ts';
import type { NoteRecord, Schema } from './types.ts';

export interface ChapterGroup {
  key: string;
  num: number | null;
  title: string;
  scenes: NoteRecord[];
  words: number;
}

/** Group scenes (already in reading order) by the board's groupBy property, chapters in number order, no chapter last. */
export function chapterGroups(schema: Schema, scenes: NoteRecord[]): ChapterGroup[] {
  const board = schema.boards['chapter-grid'];
  const by = (board && board.groupBy) || 'chapter';
  const map = new Map<string, ChapterGroup>();
  const list: ChapterGroup[] = [];
  scenes.forEach((s) => {
    const num = toNumber(s.data[by]);
    const key = num == null ? 'none' : String(num);
    let g = map.get(key);
    if (!g) {
      g = { key, num, title: '', scenes: [], words: 0 };
      map.set(key, g);
      list.push(g);
    }
    g.scenes.push(s);
    if (!g.title && typeof s.data.chapter_title === 'string') g.title = s.data.chapter_title;
    g.words += toNumber(s.data.words) || 0;
  });
  list.sort((a, b) => (a.num == null ? 1 : b.num == null ? -1 : a.num - b.num));
  return list;
}

export function chapterHeading(g: ChapterGroup): string {
  if (g.num == null) return 'No chapter yet';
  return 'Chapter ' + g.num + (g.title ? ': ' + g.title : '');
}
