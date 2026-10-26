// The Chapter Grid: a book's scenes grouped by chapter, in reading order.
import { toNumber } from './links.ts';
import { sceneHeader } from './format.ts';
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

/** A chapter's name as it is now: the `chapter_title` on its scenes (Kyle, 2026-10-26: Continue showed a scene's old
 * title after the chapter was renamed). `scenes` is the book's scene notes in reading order. */
export function chapterName(scenes: NoteRecord[], chapter: number | null): string {
  if (chapter == null) return '';
  const s = scenes.find((n) => toNumber(n.data.chapter) === chapter && typeof n.data.chapter_title === 'string' && n.data.chapter_title.trim() !== '');
  return s ? String(s.data.chapter_title).trim() : '';
}

/** How to name a scene wherever it stands for its chapter (Continue, Keep writing, Find, Next): the chapter's current
 * name, and the scene's own header only when the chapter has no name or more than one scene. */
export function sceneLabel(scenes: NoteRecord[], note: NoteRecord): { chapter: string; scene: string } {
  const num = toNumber(note.data.chapter);
  const name = chapterName(scenes, num);
  const shared = num != null && scenes.filter((n) => toNumber(n.data.chapter) === num).length > 1;
  const chapter = num == null ? '' : 'Chapter ' + num + (name ? ': ' + name : '');
  return { chapter, scene: !name || shared ? sceneHeader(note.data) : '' };
}
