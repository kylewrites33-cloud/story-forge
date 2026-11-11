import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookText, manuscriptPath, manuscriptProblem, nextBookNumber } from '../src/lib/books.ts';
import { archivedWhy, unarchivedText } from '../src/lib/scenes.ts';
import { longestGap } from '../src/lib/codex.ts';
import { saveEntry } from '../src/lib/github.ts';
import { jobAsk } from '../src/lib/jobs.ts';
import { restoreAction } from '../src/vault/ops.ts';
import { pushAction } from '../src/vault/push.ts';
import { MemSource } from './helpers.ts';

test('books and manuscripts', () => {
  assert.equal(nextBookNumber([1, 2, null]), 3);
  assert.match(bookText('A', 'S', 1, new Date()), /series: "\[\[S\]\]"/);
  assert.match(bookText('A', 'S', 1, new Date()), /\ntarget_words: 60000\n/, 'a new book starts at 60,000 words');
  assert.equal(manuscriptProblem('a.pdf', 1) !== null, true);
  assert.equal(manuscriptProblem('a.docx', 1), null);
  assert.equal(manuscriptPath('B', 'Draft: one.docx', ['B/Research/Draft one.docx']), 'B/Research/Draft one (2).docx');
});

test('rename a scene moves the file and changes only the title line', async () => {
  const m = new MemSource();
  const p = 'Series/S/Books/1 B/Scenes/S-001 Old.md';
  m.files.set(p, '---\ntype: scene\nid: S-001\ntitle: Old\nstatus: drafted\n---\n\nWords here.\n');
  const res = await pushAction(m, { id: 'r', at: '2026-11-11T16:00:00.000Z', ops: [{ kind: 'retitle', path: p, title: 'Grey says no', what: 'scene' }] });
  const to = 'Series/S/Books/1 B/Scenes/S-001 Grey says no.md';
  assert.deepEqual(res.renames, { [p]: to });
  assert.ok(!m.files.has(p));
  assert.equal(m.files.get(to), '---\ntype: scene\nid: S-001\ntitle: Grey says no\nstatus: drafted\n---\n\nWords here.\n');
  assert.equal(m.commits.length, 1);
});

test('restore from the archive', async () => {
  const m = new MemSource();
  const a = 'Series/S/Books/1 B/Archive/S-009 X.md';
  const text = '---\ntype: scene\nid: S-009\n---\n\n> [!note] Archived\n> Joined onto the end of S-008 in the app.\n\nThe words.\n';
  m.files.set(a, text);
  assert.equal(archivedWhy(text), 'Joined onto the end of S-008 in the app.');
  assert.equal(unarchivedText(text), '---\ntype: scene\nid: S-009\n---\n\nThe words.\n');
  await pushAction(m, restoreAction('Series/S/Books/1 B', a));
  assert.equal(m.files.get('Series/S/Books/1 B/Scenes/S-009 X.md'), unarchivedText(text));
  assert.ok(!m.files.has(a));
  assert.equal(m.commits.length, 1);
});

test('longest absence and saves', () => {
  assert.deepEqual(longestGap([1, 2, 3, 4, 5, 6], [true, false, false, false, true, false]), { from: 2, to: 4, length: 3 });
  assert.equal(longestGap([1, 2], [false, false]), null);
  assert.deepEqual(saveEntry('abc', 'scenes: edit S-001\n\nbody\nAgent: Writer\nCo-Authored-By: x', 'd'), { commit: 'abc', date: 'd', message: 'scenes: edit S-001', agent: 'Writer' });
  assert.match(jobAsk('rewrite', 'I-004', 'shorter'), /regenerate[\s\S]*shorter/);
});
