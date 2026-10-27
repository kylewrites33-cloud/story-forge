import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyShifts, chapterCloseUp, chapterMove, chapterNotes, chapterShifts, chapterTitleEdits, makeRoom, shiftedText } from '../src/lib/chapters.ts';
import { archiveNote, archiveScene, archivedWhy } from '../src/lib/scenes.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import { MemSource } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const scene = (id: string, ch: number, title = '') => '---\ntype: scene\nid: ' + id + '\ntitle: T' + id + '\nstatus: drafted\nchapter: ' + ch + (title ? '\nchapter_title: ' + title : '') + '\norder: ' + ch + '\n---\n\nWords of ' + id + '.\n';
const files: Record<string, string> = {
  [BOOK + '/Scenes/S-001 One.md']: scene('S-001', 1, 'Frost'),
  [BOOK + '/Scenes/S-002 Two.md']: scene('S-002', 2, 'Ledger'),
  [BOOK + '/Scenes/S-003 Three.md']: scene('S-003', 3),
  [BOOK + '/Chapter Beats/Chapter 2 beats.md']: '---\ntype: chapter-beats\ntitle: Chapter 2 beats\nchapter: 2\n---\n\n## Open\nGrey wakes.\n',
  [BOOK + '/Chapter Beats/Chapter 3 beats.md']: '---\ntype: chapter-beats\ntitle: Chapter 3 beats\nchapter: 3\n---\n\n## Close\nRue leaves.\n',
  [BOOK + '/Chapter Plans/Chapter 3 plan.md']: '---\ntype: chapter-plan\ntitle: Chapter 3 plan\nchapter: 3\n---\n\nMake it hurt.\n',
  [BOOK + '/Tasks/T-001 Fix the bell.md']: '---\ntype: task\nid: T-001\ntitle: Fix the bell\nstatus: open\nchapter: 2\n---\n',
  'Series/Ember Road/Books/2 Other/Scenes/S-001 Elsewhere.md': scene('S-001', 5)
};
const notes = Object.fromEntries(Object.entries(files).map(([p, t]) => [p, makeNote(p, 'x', t)]));

test('a chapter after 1 moves chapters 2 and 3 up, highest first, with their beats, plan and to-dos', () => {
  const s = chapterShifts(notes, BOOK, 1);
  assert.deepEqual(s.map((x) => [x.from, x.path.slice(BOOK.length + 1), x.newPath.slice(BOOK.length + 1)]), [
    [3, 'Chapter Beats/Chapter 3 beats.md', 'Chapter Beats/Chapter 4 beats.md'],
    [3, 'Chapter Plans/Chapter 3 plan.md', 'Chapter Plans/Chapter 4 plan.md'],
    [3, 'Scenes/S-003 Three.md', 'Scenes/S-003 Three.md'],
    [2, 'Chapter Beats/Chapter 2 beats.md', 'Chapter Beats/Chapter 3 beats.md'],
    [2, 'Scenes/S-002 Two.md', 'Scenes/S-002 Two.md'],
    [2, 'Tasks/T-001 Fix the bell.md', 'Tasks/T-001 Fix the bell.md']
  ]);
  assert.equal(chapterShifts(notes, BOOK, 3).length, 0);
});

test('only the chapter line (and a beats title) changes', () => {
  const [s] = chapterShifts(notes, BOOK, 2).filter((x) => x.type === 'scene');
  assert.equal(shiftedText(files[s.path], s), files[s.path].replace('chapter: 3', 'chapter: 4'));
  const [b] = chapterShifts(notes, BOOK, 2).filter((x) => x.type === 'chapter-beats');
  assert.equal(shiftedText(files[b.path], b), files[b.path].replace('chapter: 3', 'chapter: 4').replace('Chapter 3 beats', 'Chapter 4 beats'));
});

test('making room saves every note and renames the named ones', async () => {
  const src = new MemSource();
  Object.entries(files).forEach(([p, t]) => src.files.set(p, t));
  await makeRoom(src, chapterShifts(notes, BOOK, 1), 2);
  assert.match(src.files.get(BOOK + '/Scenes/S-002 Two.md')!, /^chapter: 3$/m);
  assert.match(src.files.get(BOOK + '/Scenes/S-002 Two.md')!, /^chapter_title: Ledger$/m);
  assert.match(src.files.get(BOOK + '/Scenes/S-003 Three.md')!, /^chapter: 4$/m);
  assert.match(src.files.get(BOOK + '/Scenes/S-001 One.md')!, /^chapter: 1$/m);
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 3 beats.md')!, /Grey wakes/);
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 4 beats.md')!, /Rue leaves/);
  assert.ok(!src.files.has(BOOK + '/Chapter Beats/Chapter 2 beats.md'));
  assert.ok(src.files.has(BOOK + '/Chapter Plans/Chapter 4 plan.md') && !src.files.has(BOOK + '/Chapter Plans/Chapter 3 plan.md'));
  assert.match(src.files.get(BOOK + '/Tasks/T-001 Fix the bell.md')!, /^chapter: 3$/m);
  assert.match(src.files.get('Series/Ember Road/Books/2 Other/Scenes/S-001 Elsewhere.md')!, /^chapter: 5$/m);
  assert.ok(src.writes.every((w) => !/Agent:/.test(w.message)));
});

test('a chapter name goes on its first scene and on any scene that already has one', () => {
  const a = makeNote('a.md', 'x', scene('S-010', 7));
  const b = makeNote('b.md', 'x', scene('S-011', 7, 'Old'));
  const c = makeNote('c.md', 'x', scene('S-012', 7));
  assert.deepEqual(chapterTitleEdits([a, b, c], '  The  Vow '), ['a.md', 'b.md']);
  assert.deepEqual(chapterTitleEdits([a, b, c], 'Old'), ['a.md']);
  assert.deepEqual(chapterTitleEdits([a, b, c], ''), ['b.md']);
});

test('moving chapter 3 up to 1: chapters 1 and 2 close up, beats pass through a moving name, reading order follows', async () => {
  const src = new MemSource();
  Object.entries(files).forEach(([p, t]) => src.files.set(p, t));
  const book = [BOOK + '/Scenes/S-001 One.md', BOOK + '/Scenes/S-002 Two.md', BOOK + '/Scenes/S-003 Three.md'].map((p) => notes[p]);
  const s = chapterMove(notes, BOOK, book, 3, 1);
  assert.equal(s[0].from, 3);
  const beats3 = s.find((x) => x.path.endsWith('Chapter 3 beats.md'))!;
  assert.equal(beats3.via, BOOK + '/Chapter Beats/Chapter 1 beats (moving).md');
  await applyShifts(src, s, 'test');
  const ch = (p: string) => Number(/^chapter: (\d+)$/m.exec(src.files.get(BOOK + '/Scenes/' + p)!)![1]);
  const ord = (p: string) => Number(/^order: ([\d.]+)$/m.exec(src.files.get(BOOK + '/Scenes/' + p)!)![1]);
  assert.deepEqual([ch('S-003 Three.md'), ch('S-001 One.md'), ch('S-002 Two.md')], [1, 2, 3]);
  assert.ok(ord('S-003 Three.md') < ord('S-001 One.md'));
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 1 beats.md')!, /Rue leaves/);
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 3 beats.md')!, /Grey wakes/);
  assert.ok(!src.files.has(BOOK + '/Chapter Beats/Chapter 2 beats.md'));
  assert.ok(![...src.files.keys()].some((p) => /moving/.test(p)));
  assert.match(src.files.get(BOOK + '/Chapter Plans/Chapter 1 plan.md')!, /^chapter: 1$/m);
  assert.match(src.files.get(BOOK + '/Tasks/T-001 Fix the bell.md')!, /^chapter: 3$/m);
});

test('moving chapter 1 down to 2 swaps it with chapter 2 and puts it after it in reading order', async () => {
  const src = new MemSource();
  Object.entries(files).forEach(([p, t]) => src.files.set(p, t));
  const book = [BOOK + '/Scenes/S-001 One.md', BOOK + '/Scenes/S-002 Two.md', BOOK + '/Scenes/S-003 Three.md'].map((p) => notes[p]);
  await applyShifts(src, chapterMove(notes, BOOK, book, 1, 2), 'test');
  const text = (p: string) => src.files.get(BOOK + '/Scenes/' + p)!;
  assert.match(text('S-001 One.md'), /^chapter: 2$/m);
  assert.match(text('S-002 Two.md'), /^chapter: 1$/m);
  const o1 = Number(/^order: ([\d.]+)$/m.exec(text('S-001 One.md'))![1]);
  assert.ok(o1 > 2 && o1 < 3);
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 1 beats.md')!, /Grey wakes/);
});

test('deleting chapter 2: its scene, beats and to-do go to the Archive, chapter 3 closes up to 2 and nothing is lost', async () => {
  const src = new MemSource();
  Object.entries(files).forEach(([p, t]) => src.files.set(p, t));
  const now = new Date(2026, 9, 27, 14, 0);
  const s2 = notes[BOOK + '/Scenes/S-002 Two.md'];
  const to = await archiveScene(src, s2, now);
  assert.equal(to, BOOK + '/Archive/S-002 Two.md');
  assert.ok(!src.files.has(s2.path));
  assert.match(src.files.get(to)!, /Words of S-002/);
  assert.equal(archivedWhy(src.files.get(to)!), 'Deleted in the Sparrow app on 2026-10-27.');
  const extra = chapterNotes(notes, BOOK, 2);
  assert.deepEqual(extra.map((n) => n.path.slice(BOOK.length + 1)).sort(), ['Chapter Beats/Chapter 2 beats.md', 'Tasks/T-001 Fix the bell.md']);
  for (const n of extra) await archiveNote(src, n.path, BOOK + '/Archive/Deleted chapter 2/' + n.path.slice(n.path.lastIndexOf('/') + 1), 'Its chapter was deleted', now);
  await applyShifts(src, chapterCloseUp(notes, BOOK, 2, [s2.path].concat(extra.map((n) => n.path))), 'test');
  assert.match(src.files.get(BOOK + '/Scenes/S-003 Three.md')!, /^chapter: 2$/m);
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 2 beats.md')!, /Rue leaves/);
  assert.ok(!src.files.has(BOOK + '/Chapter Beats/Chapter 3 beats.md'));
  assert.ok(src.files.has(BOOK + '/Chapter Plans/Chapter 2 plan.md'));
  assert.match(src.files.get(BOOK + '/Archive/Deleted chapter 2/Chapter 2 beats.md')!, /Grey wakes/);
  assert.match(src.files.get(BOOK + '/Scenes/S-001 One.md')!, /^chapter: 1$/m);
  assert.match(src.files.get('Series/Ember Road/Books/2 Other/Scenes/S-001 Elsewhere.md')!, /^chapter: 5$/m);
  assert.ok(src.writes.every((w) => !/Agent:/.test(w.message)));
});

test('an older copy in the Archive is never overwritten: the second gets its own name', async () => {
  const src = new MemSource();
  const p = BOOK + '/Scenes/S-002 Two.md';
  src.files.set(p, files[p]);
  src.files.set(BOOK + '/Archive/S-002 Two.md', 'older copy');
  const to = await archiveScene(src, notes[p], new Date(2026, 9, 27));
  assert.equal(to, BOOK + '/Archive/S-002 Two (2).md');
  assert.equal(src.files.get(BOOK + '/Archive/S-002 Two.md'), 'older copy');
});
