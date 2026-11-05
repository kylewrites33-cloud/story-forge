import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookStatus, continueBooks } from '../src/lib/bookstatus.ts';
import type { BookEntry, FileEntry, NoteRecord, VaultIndex } from '../src/lib/types.ts';

const scene = (path: string, chapter: number, body = 'Words.', status = 'drafted'): NoteRecord =>
  ({ path, sha: 'x', type: 'scene', data: { type: 'scene', chapter, status, words: 1000 }, body, error: null });
const bookNote = (path: string, data: Record<string, unknown>): NoteRecord => ({ path, sha: 'x', type: 'book', data: { type: 'book', ...data }, body: '', error: null });

function setup(folder: string, stage: string, chapters: number, extra: Partial<BookEntry> = {}, data: Record<string, unknown> = {}) {
  const scenes = Array.from({ length: chapters }, (_, i) => scene(folder + '/Scenes/S-00' + (i + 1) + ' C' + (i + 1) + '.md', i + 1));
  const book = { path: folder + '/Book.md', folder, seriesFolder: 'Series/Q', seriesName: 'Q', title: folder, number: 1, stage, scenes: scenes.map((s) => s.path), ...extra } as BookEntry;
  const notes: Record<string, NoteRecord> = { [book.path]: bookNote(book.path, { stage, ...data }) };
  scenes.forEach((s) => { notes[s.path] = s; });
  return { book, notes, scenes };
}

test('a published book is done, with nothing to continue', () => {
  const { book, notes } = setup('B1', 'done', 3);
  const index = { books: [book], notes } as unknown as VaultIndex;
  const st = bookStatus(index, book, [{ path: book.scenes[0], at: '2026-11-05T10:00:00Z' }]);
  assert.equal(st.phase, 'published');
  assert.equal(st.stage, 'Published');
  assert.equal(st.active, false);
});

test('the rewrite pass counts chapters through and opens the last chapter Kyle was in, or the next one', () => {
  const { book, notes } = setup('B2', 'draft', 4, {}, { rewrite_done: [1, 2] });
  book.drafts = [{ number: 1, note: null, files: [{ path: 'B2/Drafts/Draft 1/x.md', sha: 'a' } as FileEntry] }];
  book.rewrite = book.scenes.map((p) => ({ path: 'B2/Drafts/Rewrite/' + p.slice(p.lastIndexOf('/') + 1), sha: 'r' } as FileEntry));
  const index = { books: [book], notes } as unknown as VaultIndex;
  const inThree = bookStatus(index, book, [{ path: book.scenes[2], at: '2026-11-05T10:00:00Z' }]);
  assert.equal(inThree.phase, 'rewrite');
  assert.equal(inThree.stage, 'Draft 1 to 2: the rewrite');
  assert.equal(inThree.percent, 50);
  assert.equal(inThree.detail, '2 of 4 chapters through');
  assert.equal(inThree.go, book.scenes[2]);
  assert.equal(inThree.goLabel, 'Keep editing');
  // Last opened chapter 1, already through: carry on at the next one not through.
  const back = bookStatus(index, book, [{ path: book.scenes[0], at: '2026-11-05T10:00:00Z' }]);
  assert.equal(back.go, book.scenes[2]);
});

test('a first draft counts only chapters Kyle marked done', () => {
  const { book, notes, scenes } = setup('B3', 'draft', 4, {}, { target_words: 4000 });
  scenes[0].data.status = 'revised';
  const index = { books: [book], notes } as unknown as VaultIndex;
  const st = bookStatus(index, book, [{ path: book.scenes[1], at: '2026-11-05T09:00:00Z' }]);
  assert.equal(st.phase, 'writing');
  assert.equal(st.stage, 'Draft 1: writing');
  assert.equal(st.percent, 25);
  assert.equal(st.detail, '1 of 4 chapters done');
  assert.equal(st.go, book.scenes[1]);
});

test('Continue where you left off: one card per active book, newest first, published books left out', () => {
  const a = setup('A', 'draft', 2), b = setup('B', 'done', 2), c = setup('C', 'draft', 2);
  const index = { books: [a.book, b.book, c.book], notes: { ...a.notes, ...b.notes, ...c.notes } } as unknown as VaultIndex;
  const recent = [
    { path: a.book.scenes[1], at: '2026-11-05T12:00:00Z' }, { path: a.book.scenes[0], at: '2026-11-05T11:00:00Z' },
    { path: b.book.scenes[0], at: '2026-11-05T10:00:00Z' }, { path: c.book.scenes[0], at: '2026-11-05T13:00:00Z' }
  ];
  const list = continueBooks(index.books.map((book) => ({ book, status: bookStatus(index, book, recent) })));
  assert.deepEqual(list.map((x) => x.book.folder), ['C', 'A']);
});
