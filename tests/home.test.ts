import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { addRecent, continueList, labelHue, labelsOf, lastWorked, parseOutline, readingLine, sceneMatches, sortBooks } from '../src/lib/home.ts';
import { applyToData, applyToText, editChange } from '../src/lib/ideas.ts';
import { sceneHeader } from '../src/lib/format.ts';
import { cleanLook, DEFAULT_LOOK } from '../src/lib/page.ts';
import { coverFile } from '../src/lib/vault-index.ts';
import type { BookEntry, NoteRecord, VaultIndex } from '../src/lib/types.ts';

const book = (folder: string, title: string, seriesName: string, number: number | null, scenes: string[]): BookEntry =>
  ({ path: folder + '/Book.md', folder, seriesFolder: 'Series/' + seriesName, seriesName, title, number, stage: 'draft', scenes });
const scene = (path: string, data: Record<string, unknown>, body = ''): NoteRecord => ({ path, sha: 'x', type: 'scene', data: { type: 'scene', ...data }, body, error: null });

test('the recent list keeps one entry per scene, newest first, and at most twelve', () => {
  let list = addRecent([], 'a', new Date('2026-10-18T01:00:00Z'));
  list = addRecent(list, 'b', new Date('2026-10-18T02:00:00Z'));
  list = addRecent(list, 'a', new Date('2026-10-18T03:00:00Z'));
  assert.deepEqual(list.map((r) => r.path), ['a', 'b']);
  for (let i = 0; i < 20; i++) list = addRecent(list, 'p' + i, new Date());
  assert.equal(list.length, 12);
});

test('Continue where you left off skips scenes no longer in the vault, and books sort by last worked on', () => {
  const b1 = book('Series/Q/Books/1 One', 'One', 'Q', 1, ['s1']);
  const b2 = book('Series/Q/Books/2 Two', 'Two', 'Q', 2, ['s2']);
  const index = { books: [b1, b2], notes: { s1: scene('s1', {}), s2: scene('s2', {}) } } as unknown as VaultIndex;
  const recent = [{ path: 'gone', at: '2026-10-18T05:00:00Z' }, { path: 's1', at: '2026-10-18T04:00:00Z' }, { path: 's2', at: '2026-10-17T04:00:00Z' }];
  assert.deepEqual(continueList(index, recent).map((c) => c.book.title), ['One', 'Two']);
  const worked = lastWorked(index, recent);
  assert.deepEqual(sortBooks([b2, b1], '', 'recent', worked).map((b) => b.title), ['One', 'Two']);
  assert.deepEqual(sortBooks([b1, b2], '', 'name', {}).map((b) => b.title), ['One', 'Two']);
  assert.deepEqual(sortBooks([b1, b2], 'two', 'recent', worked).map((b) => b.title), ['Two']);
  assert.deepEqual(sortBooks([b1, b2], 'q', 'series', {}).map((b) => b.title), ['One', 'Two']);
});

test('reading line: pages and time', () => {
  assert.equal(readingLine(0), '');
  assert.equal(readingLine(2500), 'about 10 pages · 10 minutes to read');
  assert.equal(readingLine(90000), 'about 360 pages · 6 hours to read');
  assert.equal(readingLine(15100, { wordsPerPage: 300, wordsPerMinute: 200 }), 'about 50 pages · 1 hour 16 minutes to read');
});

test('the Chapter Grid filter matches every word in the card or the text', () => {
  const s = scene('s', { id: 'S-001', title: 'The mill', cast: ['[[Grey]]', '[[Rue]]'], labels: ['flashback'] }, 'The frost came early.');
  assert.ok(sceneMatches(s, 'grey'));
  assert.ok(sceneMatches(s, 'FLASHBACK frost'));
  assert.ok(sceneMatches(s, ''));
  assert.ok(!sceneMatches(s, 'grey pip'));
});

test('labels: from a list or a line, with a steady colour', () => {
  assert.deepEqual(labelsOf(['a', ' b ']), ['a', 'b']);
  assert.deepEqual(labelsOf('needs research, flashback'), ['needs research', 'flashback']);
  assert.deepEqual(labelsOf(undefined), []);
  assert.equal(labelHue('Flashback'), labelHue('flashback '));
});

test('an outline becomes chapters and scene titles', () => {
  const list = parseOutline('Chapter 1: The Frost\n- Grey finds the dead field\n2. Rue brings the letter\n\n## Chapter 2 - The Offer\nThe buyer arrives\n');
  assert.deepEqual(list, [
    { chapter: 1, chapterTitle: 'The Frost', title: 'Grey finds the dead field' },
    { chapter: 1, chapterTitle: '', title: 'Rue brings the letter' },
    { chapter: 2, chapterTitle: 'The Offer', title: 'The buyer arrives' }
  ]);
  assert.deepEqual(parseOutline('One\nTwo', 5).map((s) => s.chapter), [5, 5]);
});

test('editing labels on a card writes a list, and clearing them removes the line', () => {
  const text = '---\ntype: scene\nid: S-001\ntitle: A\nstatus: drafted\n---\nWords.\n';
  const out = applyToText(text, editChange({ labels: 'flashback,  needs research ' }));
  assert.deepEqual(Frontmatter.parse(out).data.labels, ['flashback', 'needs research']);
  assert.match(out, /labels:\n  - flashback\n  - needs research\n/);
  assert.deepEqual(applyToData({}, editChange({ labels: 'a, b' })).labels, ['a', 'b']);
  const cleared = applyToText(out, editChange({ labels: ' , ' }));
  assert.equal(Frontmatter.parse(cleared).data.labels, undefined);
  assert.match(cleared, /Words\.\n$/);
});

test('a book cover is a picture named Cover in the book folder', () => {
  const files = [{ path: 'Series/Q/Books/1 One/Scenes/Cover.jpg', sha: 'a' }, { path: 'Series/Q/Books/1 One/Cover.png', sha: 'b' }];
  assert.deepEqual(coverFile(files, 'Series/Q/Books/1 One'), { path: 'Series/Q/Books/1 One/Cover.png', sha: 'b' });
  assert.equal(coverFile(files, 'Series/Q/Books/2 Two'), null);
});

test('page look: unknown values fall back to the defaults', () => {
  assert.deepEqual(cleanLook(null), DEFAULT_LOOK);
  assert.deepEqual(cleanLook({ size: 'huge', paper: 'purple', font: 'readable' }), { ...DEFAULT_LOOK, size: 'huge', font: 'readable' });
});

test('a scene is headed by its one-line summary, or its title until it has one', () => {
  assert.equal(sceneHeader({ id: 'S-001', title: 'All around him the woods', headline: 'Grey camps in the stone circle.' }), 'Grey camps in the stone circle.');
  assert.equal(sceneHeader({ id: 'S-001', title: 'All around him the woods', headline: '  ' }), 'All around him the woods');
  assert.equal(sceneHeader({ id: 'S-001' }), 'S-001');
  assert.equal(sceneHeader({}, 'this scene'), 'this scene');
});
