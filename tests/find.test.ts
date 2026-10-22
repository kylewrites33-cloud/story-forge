import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findIn } from '../src/lib/find.ts';
import type { VaultIndex, BookEntry } from '../src/lib/types.ts';

const note = (path: string, type: string, data: Record<string, unknown>) => ({ path, type, data: { type, ...data }, body: '', sha: '' });
const book = { folder: 'B', seriesFolder: 'S', seriesName: 'S', title: 'B', number: 1, stage: '', path: 'B/Book.md', scenes: ['B/Scenes/a.md', 'B/Scenes/b.md'], ideas: ['B/Ideas/i.md'] } as unknown as BookEntry;
const index = {
  notes: {
    'B/Scenes/a.md': note('B/Scenes/a.md', 'scene', { title: 'Claw Marks', chapter: 24 }),
    'B/Scenes/b.md': note('B/Scenes/b.md', 'scene', { title: 'The preorders', chapter: 33 }),
    'B/Ideas/i.md': note('B/Ideas/i.md', 'idea', { title: 'Grey lies about the claws' })
  },
  series: [], books: [book]
} as unknown as VaultIndex;

test('a number finds the chapter', () => {
  assert.deepEqual(findIn(index, book, '33').map((h) => h.path), ['B/Scenes/b.md']);
});
test('words find scenes and ideas', () => {
  assert.deepEqual(findIn(index, book, 'claw').map((h) => h.kind), ['scene', 'idea']);
});
test('nothing without a book or a query', () => {
  assert.equal(findIn(index, null, 'claw').length, 0);
  assert.equal(findIn(index, book, '  ').length, 0);
});
