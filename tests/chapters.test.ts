import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyShifts, chapterCloseUp, chapterMove, chapterNotes, chapterShifts, chapterTitleEdits, closeMap, makeRoom, moveMap, renumberLists, roomMap, shiftedText } from '../src/lib/chapters.ts';
import { rewriteDone } from '../src/lib/rewrite.ts';
import { parseTitles, renumberTitles } from '../src/lib/titles.ts';
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

// The Edit room's lists follow a chapter that is added, moved or deleted (2026-11-11).
const changes = (ch: number, was = ch) => '---\ntype: chapter-changes\ntitle: Chapter ' + ch + ' changes\nchapter: ' + ch + '\nstep: "41"\n---\n\n## C-01 · small\nWritten for the old chapter ' + was + '.\n';
const TITLES = '---\ntype: chapter-titles\ntitle: Chapter Titles\n---\n\nRound 1.\n\n## Chapter 1\nWas: Frost\n- [x] Ash\n- [ ] None of these\n\n## Chapter 2\nWas: Ledger\n- [ ] Ink\n- [x] None of these\n\n## Chapter 3\nWas:\n- [ ] Bell\n- [ ] None of these\n';
const editFiles: Record<string, string> = {
  ...files,
  [BOOK + '/Book.md']: '---\ntype: book\ntitle: Ash Bell\nrewrite_done: [1, 2]\nstage: editing\n---\n\nNotes.\n',
  [BOOK + '/Chapter Titles.md']: TITLES,
  [BOOK + '/Changes/Chapter 1 changes.md']: changes(1),
  [BOOK + '/Changes/Chapter 2 changes.md']: changes(2),
  [BOOK + '/Changes/Chapter 3 changes.md']: changes(3)
};
const editNotes = () => Object.fromEntries(Object.entries(editFiles).map(([p, t]) => [p, makeNote(p, 'x', t)]));
const editSource = () => { const src = new MemSource(); Object.entries(editFiles).forEach(([p, t]) => src.files.set(p, t)); return src; };

test('moving a chapter takes its change list, its rewrite tick and its title options with it', async () => {
  const src = editSource(), all = editNotes();
  const scenes = Object.values(all).filter((n) => n.type === 'scene' && n.path.startsWith(BOOK + '/'));
  await applyShifts(src, chapterMove(all, BOOK, scenes, 3, 1), 'Moved.');
  const gone = await renumberLists(src, all, BOOK, moveMap(3, 1), 'Moved.');
  assert.equal(gone, '');
  // Chapter 3's change list is now chapter 1's, name, title and number; the others moved down one.
  assert.equal(src.files.get(BOOK + '/Changes/Chapter 1 changes.md'), changes(1, 3));
  assert.equal(src.files.get(BOOK + '/Changes/Chapter 2 changes.md'), changes(2, 1));
  assert.equal(src.files.get(BOOK + '/Changes/Chapter 3 changes.md'), changes(3, 2));
  assert.deepEqual([...src.files.keys()].filter((p) => p.includes('/Changes/')).map((p) => p.slice(BOOK.length + 9)).sort(), ['Chapter 1 changes.md', 'Chapter 2 changes.md', 'Chapter 3 changes.md']);
  // Kyle was through chapters 1 and 2; they are chapters 2 and 3 now.
  const book = src.files.get(BOOK + '/Book.md') as string;
  assert.equal(book, editFiles[BOOK + '/Book.md'].replace('rewrite_done: [1, 2]', 'rewrite_done: [2, 3]'));
  // The title sections carry their new numbers, in order, with Kyle's ticks and the lines above them as they were.
  const titles = src.files.get(BOOK + '/Chapter Titles.md') as string;
  assert.ok(titles.startsWith('---\ntype: chapter-titles\ntitle: Chapter Titles\n---\n\nRound 1.\n\n## Chapter 1\nWas:\n- [ ] Bell'));
  assert.deepEqual(parseTitles(titles).map((c) => [c.chapter, c.was, c.none]), [[1, '', false], [2, 'Frost', false], [3, 'Ledger', true]]);
});

test('a new chapter in the middle moves the later lists up, and nothing is saved when nothing changes', async () => {
  const src = editSource(), all = editNotes();
  await makeRoom(src, chapterShifts(all, BOOK, 1), 2);
  await renumberLists(src, all, BOOK, roomMap(1), 'Added.');
  assert.deepEqual(rewriteDone({ data: { rewrite_done: /rewrite_done: \[(.*)\]/.exec(src.files.get(BOOK + '/Book.md') as string)![1].split(',') } }), [1, 3]);
  assert.deepEqual(parseTitles(src.files.get(BOOK + '/Chapter Titles.md') as string).map((c) => c.chapter), [1, 3, 4]);
  assert.equal(src.files.get(BOOK + '/Changes/Chapter 4 changes.md'), changes(4, 3));
  assert.ok(!src.files.has(BOOK + '/Changes/Chapter 2 changes.md'));
  const before = src.writes.length;
  await renumberLists(src, all, BOOK, roomMap(9), 'Added at the end.');
  assert.equal(src.writes.length, before);
});

test('a deleted chapter leaves the lists, and its title options are handed back for the Archive', async () => {
  const src = editSource(), all = editNotes();
  assert.ok(chapterNotes(all, BOOK, 2).some((n) => n.type === 'chapter-changes'));
  const gone = await renumberLists(src, all, BOOK, closeMap(2), 'Deleted.');
  assert.equal(gone, '## Chapter 2\nWas: Ledger\n- [ ] Ink\n- [x] None of these');
  assert.ok((src.files.get(BOOK + '/Book.md') as string).includes('rewrite_done: [1]\n'));
  assert.deepEqual(parseTitles(src.files.get(BOOK + '/Chapter Titles.md') as string).map((c) => [c.chapter, c.was]), [[1, 'Frost'], [2, '']]);
  assert.deepEqual(renumberTitles(TITLES, (ch) => ch), { text: TITLES, gone: '' });
});
