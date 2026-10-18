import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { chapterGroups, chapterHeading } from '../src/lib/board.ts';
import { parseSchema } from '../src/lib/schema.ts';
import type { FileEntry } from '../src/lib/types.ts';
import { activeBook, assemble, buildIndex, makeNote, pathPattern, skipped } from '../src/lib/vault-index.ts';
import { DEMO, demoSchemaText, FsSource, hasVault, VAULT } from './helpers.ts';

const schema = parseSchema(demoSchemaText());
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';

async function demoIndex() {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  return { src, files, index: await buildIndex({ schema, files, read: (p, sha) => src.read(p, sha) }) };
}

test('finds the series, the book and its scenes in reading order', async () => {
  const { index } = await demoIndex();
  assert.deepEqual(index.series.map((s) => s.name), ['Ember Road']);
  assert.equal(index.books.length, 1);
  const book = index.books[0];
  assert.equal(book.folder, BOOK);
  assert.equal(book.title, 'Ash Bell');
  assert.equal(book.number, 1);
  assert.equal(book.seriesName, 'Ember Road');
  assert.deepEqual(book.scenes.map((p) => index.notes[p].data.id), ['S-001', 'S-002', 'S-003', 'S-004', 'S-005', 'S-006', 'S-007', 'S-008']);
  assert.equal(activeBook(index)?.folder, BOOK, 'System/Config.md names the active book');
  assert.deepEqual(index.warnings, []);
});

test('reads only the notes the board needs', async () => {
  const { src } = await demoIndex();
  assert.ok(!src.reads.some((p) => /Characters|Ideas|Progressions|Story So Far/.test(p)), src.reads.join(', '));
});

test('fetches only files whose sha changed', async () => {
  const { src, files, index } = await demoIndex();
  src.reads.length = 0;
  const changed = files.map((f) => (f.path.endsWith('S-003 The Warden.md') ? { ...f, sha: 'new' } : f));
  await buildIndex({ schema, files: changed, read: (p, sha) => src.read(p, sha), previous: index });
  assert.deepEqual(src.reads, [BOOK + '/Scenes/S-003 The Warden.md']);
});

test('groups the Chapter Grid by chapter, with unplaced scenes last', async () => {
  const { index } = await demoIndex();
  const scenes = index.books[0].scenes.map((p) => index.notes[p]);
  const groups = chapterGroups(schema, scenes);
  assert.deepEqual(groups.map(chapterHeading), ['Chapter 1: Frost', 'Chapter 2: Thaw', 'Chapter 3: Ledger', 'Chapter 4', 'No chapter yet']);
  assert.deepEqual(groups.map((g) => g.scenes.length), [2, 2, 2, 1, 1]);
  assert.equal(groups[0].words, 61);
});

test('sorts by order, then chapter, then ID, as sf does', () => {
  const note = (id: string, yaml: string) => makeNote(BOOK + '/Scenes/' + id + '.md', id, '---\ntype: scene\nid: ' + id + '\n' + yaml + '---\n');
  const recs = [
    makeNote(BOOK + '/Book.md', 'b', '---\ntype: book\ntitle: Ash Bell\nseries: "[[Ember Road]]"\nnumber: 1\nstage: draft\n---\n'),
    note('S-003', 'order: 1\nchapter: 2\n'),
    note('S-001', 'order: 2\n'),
    note('S-002', 'order: 1\nchapter: 1\n'),
    note('S-004', ''),
    note('S-005', 'order: "0.5"\n')
  ];
  const index = assemble(schema, recs);
  assert.deepEqual(index.books[0].scenes.map((p) => index.notes[p].data.id), ['S-005', 'S-002', 'S-003', 'S-001', 'S-004']);
});

test('skips the folders sf skips', () => {
  assert.equal(skipped(BOOK + '/Scenes/Archive/S-001 Old.md'), true);
  assert.equal(skipped(BOOK + '/Snapshots/S-001 v1.md'), true);
  assert.equal(skipped('Templates/Scene.md'), true);
  assert.equal(skipped('.obsidian/app.json'), true);
  assert.equal(skipped(BOOK + '/Scenes/S-001 The Crack.md'), false);
  const re = pathPattern(schema.types.scene);
  assert.ok(re.test(BOOK + '/Scenes/Act One/S-001 The Crack.md'), 'scenes may sit in subfolders');
  assert.ok(!re.test(BOOK + '/Ideas/I-001.md'));
  assert.ok(pathPattern(schema.types.book).test(BOOK + '/Book.md'));
  assert.ok(pathPattern(schema.types.series).test('Series/Ember Road/Series.md'));
});

test('reports unreadable and misplaced notes as plain sentences', async () => {
  const files: FileEntry[] = [
    { path: 'System/schema.json', sha: '1' },
    { path: BOOK + '/Book.md', sha: '2' },
    { path: BOOK + '/Scenes/S-001 Broken.md', sha: '3' },
    { path: BOOK + '/Scenes/I-009 Stray Idea.md', sha: '4' },
    { path: 'Series/Lost/Books/1 Orphan/Scenes/S-001 Alone.md', sha: '5' }
  ];
  const text: Record<string, string> = {
    [BOOK + '/Book.md']: '---\ntype: book\ntitle: Ash Bell\nnumber: 1\nstage: draft\n---\n',
    [BOOK + '/Scenes/S-001 Broken.md']: '---\ntitle: "unclosed\n---\n',
    [BOOK + '/Scenes/I-009 Stray Idea.md']: '---\ntype: idea\ntitle: Stray\n---\n',
    'Series/Lost/Books/1 Orphan/Scenes/S-001 Alone.md': '---\ntype: scene\nid: S-001\ntitle: Alone\n---\n'
  };
  const index = await buildIndex({ schema, files, read: async (p) => text[p] });
  assert.equal(index.warnings.length, 3, index.warnings.join('\n'));
  assert.match(index.warnings[0], /S-001 Broken.md has frontmatter the app cannot read/);
  assert.match(index.warnings[1], /I-009 Stray Idea.md says it is an idea note, but it sits where scene notes go/);
  assert.match(index.warnings[2], /1 Orphan has notes but no Book.md/);
  assert.equal(index.books[0].scenes.length, 0);
});

test('the demo vault passes sf validate', { skip: !hasVault && 'author-business is not checked out beside this repository' }, () => {
  const out = execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'validate'], {
    cwd: DEMO, env: { ...process.env, SF_VAULT: DEMO }, encoding: 'utf8'
  });
  assert.match(out, /no errors/, out);
});
