import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookStatus } from '../src/lib/bookstatus.ts';
import { publishDate, publishLine, sixOf, sixStages } from '../src/lib/bookstages.ts';
import type { BookEntry, FileEntry, NoteRecord, VaultIndex } from '../src/lib/types.ts';

const scene = (path: string, chapter: number, body = 'Words.'): NoteRecord =>
  ({ path, sha: 'x', type: 'scene', data: { type: 'scene', chapter, status: 'drafted', words: 1000 }, body, error: null });

function setup(stage: string, data: Record<string, unknown> = {}) {
  const folder = 'B';
  const scenes = [1, 2, 3, 4].map((c) => scene(folder + '/Scenes/S-00' + c + '.md', c));
  const book = { path: folder + '/Book.md', folder, seriesFolder: 'S', seriesName: 'S', title: 'B', number: 1, stage, scenes: scenes.map((s) => s.path) } as BookEntry;
  const notes: Record<string, NoteRecord> = { [book.path]: { path: book.path, sha: 'x', type: 'book', data: { type: 'book', stage, ...data }, body: '', error: null } };
  scenes.forEach((s) => { notes[s.path] = s; });
  notes['B/Chapter Beats/Chapter 1 beats.md'] = { path: 'B/Chapter Beats/Chapter 1 beats.md', sha: 'x', type: 'chapter-beats', data: { chapter: 1 }, body: '## Beat', error: null };
  return { book, index: { books: [book], notes } as unknown as VaultIndex };
}

test('workflow stage titles map onto the six stages', () => {
  assert.equal(sixOf('Market research'), 'market');
  assert.equal(sixOf('Story planning: premise and cast seeds'), 'planning');
  assert.equal(sixOf('Pre-writing: test drives'), 'planning');
  assert.equal(sixOf('Outlining'), 'outlining');
  assert.equal(sixOf('Publishing (proposed 2026-10-31, not yet kept)'), 'publishing');
  assert.equal(sixOf('Writing'), null);
});

test('a book in the rewrite: writing done, editing a third of the way through pass 1, outlining counts chapters with beats', () => {
  const { book, index } = setup('draft', { rewrite_done: [1, 2] });
  book.drafts = [{ number: 1, note: null, files: [{ path: 'B/Drafts/Draft 1/x.md', sha: 'a' } as FileEntry] }];
  book.rewrite = book.scenes.map((p) => ({ path: 'B/Drafts/Rewrite/' + p.slice(p.lastIndexOf('/') + 1), sha: 'r' } as FileEntry));
  const status = bookStatus(index, book, []);
  const six = sixStages({ index, book, stages: [], statuses: {}, status });
  const by = Object.fromEntries(six.map((s) => [s.key, s]));
  assert.equal(by.writing.percent, 100);
  assert.equal(by.editing.current, true);
  assert.equal(by.editing.percent, 17); // half of pass 1 of 3
  assert.equal(by.outlining.percent, 100); // earlier stages count as done once the book has moved on
  assert.equal(by.outlining.elsewhere, true);
  assert.match(by.outlining.detail, /beats or a plan for 1 of 4 chapters/);
  assert.equal(by.writing.elsewhere, false);
  assert.equal(by.publishing.percent, 0);
});

test('a published book is 100% everywhere with nothing current', () => {
  const { book, index } = setup('done');
  const six = sixStages({ index, book, stages: [], statuses: {}, status: bookStatus(index, book, []) });
  assert.ok(six.every((s) => s.percent === 100 && !s.current && !s.elsewhere));
});

test('the publish date reads YYYY-MM-DD and counts the days', () => {
  assert.equal(publishDate({ data: { publish_date: '2026-11-21' } }), '2026-11-21');
  assert.equal(publishDate({ data: { publish_date: 'soon' } }), null);
  assert.match(publishLine('2026-11-21', new Date(2026, 10, 6, 15)), /Nov 21, 2026 · 15 days away$/);
  assert.match(publishLine('2026-11-06', new Date(2026, 10, 6, 15)), /today$/);
});
