import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addToScrap, scrapFor, scrapHead, scrapPath } from '../src/lib/plans.ts';
import type { NoteRecord } from '../src/lib/types.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';

test('a chapter\'s scrap lives in the book\'s Chapter Scraps folder', () => {
  assert.equal(scrapPath(BOOK, 3), BOOK + '/Chapter Scraps/Chapter 3 scrap.md');
  assert.match(scrapHead(3), /type: chapter-scrap/);
  assert.match(scrapHead(3), /title: Chapter 3 scrap/);
  assert.match(scrapHead(3), /chapter: 3/);
});

test('the scrap is found by book and chapter', () => {
  const note = (path: string, type: string, chapter: number) => ({ path, type, data: { type, chapter } }) as unknown as NoteRecord;
  const notes: Record<string, NoteRecord> = {
    a: note(BOOK + '/Chapter Plans/Chapter 3 plan.md', 'chapter-plan', 3),
    b: note(BOOK + '/Chapter Scraps/Chapter 3 scrap.md', 'chapter-scrap', 3),
    c: note('Series/Other/Books/1 X/Chapter Scraps/Chapter 3 scrap.md', 'chapter-scrap', 3),
  };
  assert.equal(scrapFor(notes, BOOK, 3), notes.b);
  assert.equal(scrapFor(notes, BOOK, 4), null);
  assert.equal(scrapFor(notes, BOOK, null), null);
});

test('moved words go at the end of the scrap, a blank line after what was there', () => {
  assert.equal(addToScrap('', '  Grey left. '), 'Grey left.\n');
  assert.equal(addToScrap('Old line.\n\n', 'New line.'), 'Old line.\n\nNew line.\n');
  assert.equal(addToScrap('Old line.', '   '), 'Old line.');
});
