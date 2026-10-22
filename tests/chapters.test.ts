import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chapterShifts, makeRoom, shiftedText } from '../src/lib/chapters.ts';
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
