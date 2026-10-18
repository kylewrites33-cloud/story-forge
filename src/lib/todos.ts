// A chapter's to-dos: task notes in the book's own Tasks folder that name a `chapter` (and maybe a `scene`). Kyle adds
// them beside the page; the team adds them after its checks (`generated: true`) and can mark fixed ones done. Studio
// to-dos (the vault's Tasks folder) are a separate list.
import { Frontmatter } from './frontmatter.js';
import { idNumber, toNumber } from './links.ts';
import { safeTitle } from './scenes.ts';
import { makeNote } from './vault-index.ts';
import type { BookEntry, FileEntry, NoteRecord, VaultIndex, VaultSource } from './types.ts';

export const OPEN_STATUSES = ['open', 'doing'];

export function isOpen(n: NoteRecord): boolean {
  return OPEN_STATUSES.indexOf(String(n.data.status || 'open')) >= 0;
}

/** Every to-do of a book, open ones first, then by chapter and ID. */
export function bookTodos(index: VaultIndex, book: BookEntry): NoteRecord[] {
  const pre = book.folder + '/Tasks/';
  return (index.tasks || []).map((p) => index.notes[p]).filter((n) => Boolean(n) && n.path.startsWith(pre))
    .sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || (toNumber(a.data.chapter) ?? 9999) - (toNumber(b.data.chapter) ?? 9999)
      || (idNumber(a.data.id) || 0) - (idNumber(b.data.id) || 0));
}

/** The to-dos of one chapter (a chapter number, or null for scenes with no chapter yet). */
export function chapterTodos(todos: NoteRecord[], chapter: number | null): NoteRecord[] {
  return todos.filter((n) => (toNumber(n.data.chapter) ?? null) === chapter);
}

/** Whether a task note is a book's to-do rather than a studio one. */
export function isBookTodo(index: VaultIndex, n: NoteRecord): boolean {
  return index.books.some((b) => n.path.startsWith(b.folder + '/Tasks/'));
}

/** The next free task ID in a book's Tasks folder, the way `sf next-id task --book` counts it. */
export function nextBookTaskId(files: FileEntry[], bookFolder: string): string {
  const pre = bookFolder + '/Tasks/';
  let max = 0;
  files.forEach((f) => {
    if (!f.path.startsWith(pre)) return;
    const m = /^T-(\d+)/.exec(f.path.slice(pre.length));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'T-' + String(max + 1).padStart(3, '0');
}

export interface NewTodo {
  title: string;
  chapter: number | null;
  /** A scene ID when the to-do is about one scene, or ''. */
  scene: string;
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function todoText(id: string, t: NewTodo, now: Date): string {
  const data: Record<string, unknown> = { type: 'task', id, title: t.title, owner: 'Kyle', status: 'open' };
  if (t.chapter != null) data.chapter = t.chapter;
  if (/^S-\d{3}$/.test(t.scene)) data.scene = t.scene;
  data.created = ymd(now);
  return Frontmatter.join(data, '\nKyle added this beside the page in the Story Forge app.\n');
}

/** Add a to-do to a book's Tasks folder as Kyle's commit. */
export async function createTodo(source: VaultSource, bookFolder: string, t: NewTodo, now: Date): Promise<NoteRecord> {
  if (!source.write) throw new Error('This vault cannot be changed from the app.');
  const title = safeTitle(t.title);
  if (!title) throw new Error('Write the to-do first.');
  for (let attempt = 0; ; attempt++) {
    const { files } = await source.tree();
    const id = nextBookTaskId(files, bookFolder);
    const path = bookFolder + '/Tasks/' + id + ' ' + title + '.md';
    const text = todoText(id, { ...t, title }, now);
    try {
      const sha = await source.write(path, text, '', 'tasks: add ' + id + ' ' + title + '\n\nAdded beside the page in the Story Forge app.');
      return makeNote(path, sha, text);
    } catch (e) {
      if ((e as { conflict?: boolean }).conflict && attempt < 3) continue;
      throw e;
    }
  }
}

/** Where a to-do is, in Kyle's words: "Chapter 3 · S-012". */
export function todoPlace(n: NoteRecord): string {
  const ch = toNumber(n.data.chapter);
  return [ch != null ? 'Chapter ' + ch : '', String(n.data.scene || '')].filter(Boolean).join(' · ');
}
