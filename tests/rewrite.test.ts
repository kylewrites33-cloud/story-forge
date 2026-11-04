import assert from 'node:assert/strict';
import { test } from 'node:test';
import { align, bringOver, paragraphs, rewriteFiles, rewriteFor, rewriteProgress, rowAt, similarity, takeOut } from '../src/lib/rewrite.ts';

const B = 'Series/S/Books/1 B';

test('the rewrite copies are found by file name, then by scene ID', () => {
  const files = [
    { path: B + '/Drafts/Rewrite/S-001 Opening.md', sha: 'a' },
    { path: B + '/Drafts/Rewrite/S-002 Barn.md', sha: 'b' },
    { path: B + '/Drafts/Rewrite/deeper/x.md', sha: 'c' },
    { path: B + '/Drafts/Draft 1/S-001 Opening.md', sha: 'd' },
    { path: B + '/Scenes/S-001 Opening.md', sha: 'e' }
  ];
  const copies = rewriteFiles(files, B);
  assert.deepEqual(copies.map((f) => f.sha), ['a', 'b']);
  assert.equal(rewriteFor(copies, { path: B + '/Scenes/S-001 Opening.md', data: { id: 'S-001' } })!.sha, 'a');
  assert.equal(rewriteFor(copies, { path: B + '/Scenes/S-002 Barn at night.md', data: { id: 'S-002' } })!.sha, 'b');
  assert.equal(rewriteFor(copies, { path: B + '/Scenes/S-003 New.md', data: { id: 'S-003' } }), null);
});

test('paragraphs are runs of lines between blank lines, with their places', () => {
  const t = 'One.\n\nTwo *a*\nstill two.\n\n\n> Screen\n> more\n\nFour.  \n';
  const p = paragraphs(t);
  assert.deepEqual(p.map((x) => x.text), ['One.', 'Two *a*\nstill two.', '> Screen\n> more', 'Four.']);
  assert.equal(t.slice(p[1].at, p[1].end), 'Two *a*\nstill two.');
  assert.equal(t.slice(p[3].at, p[3].end), 'Four.');
  assert.deepEqual(paragraphs(''), []);
});

test('similar paragraphs line up, and added or cut ones get rows of their own', () => {
  assert.equal(similarity('The barn was cold.', 'The barn was cold.'), 1);
  assert.ok(similarity('The barn was cold and dark that night.', 'That night the barn was dark and cold.') > 0.9);
  assert.ok(similarity('The barn was cold.', 'Rue laughed at the kids.') < 0.3);
  const mine = ['Basil sat in the barn.', 'Rue had the kids on the roof.', 'Cayenne fell.'];
  const theirs = ['Basil sat cross-legged in the barn.', 'A new paragraph about snow and slimes.', 'Rue kept the kids walking the roof.', 'Cayenne fell.'];
  const rows = align(mine, theirs);
  assert.deepEqual(rows.map((r) => [r.mine, r.theirs]), [[0, 0], [null, 1], [1, 2], [2, 3]]);
  assert.equal(rows[3].score, 1);
  assert.deepEqual(align(['Only mine.'], []).map((r) => [r.mine, r.theirs]), [[0, null]]);
  assert.deepEqual(align([], ['Only theirs.']).map((r) => [r.mine, r.theirs]), [[null, 0]]);
  // A paragraph the Writer cut and one it added where unlike words sit: no false pairing.
  const r2 = align(['Kyle wrote this one.', 'And this.'], ['Something else entirely here.', 'And this.']);
  assert.deepEqual(r2.map((r) => [r.mine, r.theirs]), [[0, null], [null, 0], [1, 1]]);
});

test('bringing a paragraph over replaces Kyle\'s, or puts a new one in after the one before it', () => {
  const text = 'One.\n\nTwo.\n\nThree.\n';
  const mine = paragraphs(text);
  const rows = align(mine.map((p) => p.text), ['One more.', 'Added here.', 'Two.', 'Three.']);
  assert.deepEqual(rows.map((r) => [r.mine, r.theirs]), [[0, 0], [null, 1], [1, 2], [2, 3]]);
  const a = bringOver(text, mine, rows, 0, 'One more.');
  assert.equal(a.text, 'One more.\n\nTwo.\n\nThree.\n');
  assert.equal(a.text.slice(a.at, a.end), 'One more.');
  const b = bringOver(text, mine, rows, 1, 'Added here.\n');
  assert.equal(b.text, 'One.\n\nAdded here.\n\nTwo.\n\nThree.\n');
  assert.equal(b.text.slice(b.at, b.end), 'Added here.');
  const first = bringOver(text, mine, [{ mine: null, theirs: 0, score: 0 }, ...rows], 0, 'At the top.');
  assert.equal(first.text, 'At the top.\n\nOne.\n\nTwo.\n\nThree.\n');
  assert.equal(bringOver('', [], [{ mine: null, theirs: 0, score: 0 }], 0, 'Only.').text, 'Only.');
  assert.equal(takeOut(text, mine[1]), 'One.\n\nThree.\n');
  assert.equal(takeOut(text, mine[0]), 'Two.\n\nThree.\n');
  assert.equal(takeOut(text, mine[2]), 'One.\n\nTwo.\n');
  assert.equal(rowAt(rows, mine, 0), 0);
  assert.equal(rowAt(rows, mine, 7), 2);
  assert.equal(rowAt(rows, mine, 100), 3);
});

test('the rewrite\'s progress counts chapters with a rewritten scene', () => {
  const copies = [{ path: B + '/Drafts/Rewrite/S-001 Opening.md', sha: 'a' }];
  const scenes = [
    { path: B + '/Scenes/S-001 Opening.md', data: { id: 'S-001', chapter: 1 } },
    { path: B + '/Scenes/S-002 Barn.md', data: { id: 'S-002', chapter: 2 } }
  ];
  assert.deepEqual(rewriteProgress(copies, scenes), { done: 1, total: 2, first: B + '/Scenes/S-001 Opening.md' });
  assert.deepEqual(rewriteProgress([], scenes), { done: 0, total: 2, first: null });
});
