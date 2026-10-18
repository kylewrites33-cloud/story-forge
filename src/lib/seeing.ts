// What the "seeing the book" pages (Promises, Plot Grid, Timeline, Themes, Cast web) share: the book's story scenes in
// reading order, and the notes of one type that belong to a book or its series.
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

/** The book's scenes in reading order, without test drives. */
export function storyScenes(index: VaultIndex, book: BookEntry): NoteRecord[] {
  return book.scenes.map((p) => index.notes[p]).filter((n): n is NoteRecord => Boolean(n) && n.data.kind !== 'test');
}

/** Notes of this type inside the book's folder, by path. */
export function bookNotesOf(index: VaultIndex, book: BookEntry, type: string): NoteRecord[] {
  return Object.values(index.notes).filter((n) => n.type === type && n.path.startsWith(book.folder + '/')).sort((a, b) => a.path.localeCompare(b.path));
}

/** Notes of this type in the book's series but outside every book (series canon), by path. */
export function seriesNotesOf(index: VaultIndex, book: BookEntry, type: string): NoteRecord[] {
  return Object.values(index.notes).filter((n) => n.type === type && n.path.startsWith(book.seriesFolder + '/') && n.path.indexOf('/Books/', book.seriesFolder.length) < 0)
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Where a board of this book lives, for warnings (the same address route.ts makes). */
export function boardHref(board: string, folder: string): string {
  return '#/board/' + board + '/' + encodeURIComponent(folder);
}

/** A scene's ID, as written on its card. */
export function sceneId(n: NoteRecord): string {
  return String(n.data.id || '').trim();
}

/** A list property as plain strings ("S-012", "[[S-012 The Crack]]" both give the text inside). */
export function stringList(v: unknown): string[] {
  if (v == null || v === '') return [];
  const list = Array.isArray(v) ? v : [v];
  return list.flat().map((x) => String(x ?? '').trim()).filter(Boolean);
}
