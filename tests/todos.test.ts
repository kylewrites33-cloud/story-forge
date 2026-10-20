import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jobAsk, defaultJobTitle, jobLabel } from '../src/lib/jobs.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { PHASE } from '../src/lib/sync.ts';
import { bookTodos, chapterTodos, createTodo, isBookTodo, isOpen, nextBookTaskId, todoPlace, todoText } from '../src/lib/todos.ts';
import { buildIndex } from '../src/lib/vault-index.ts';
import { DEMO, demoSchemaText, FsSource, hasVault, MemSource, VAULT } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';

test('the demo book has to-dos, apart from the studio ones', async () => {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  const index = await buildIndex({ schema: parseSchema(demoSchemaText()), files, read: (p, sha) => src.read(p, sha), phase: PHASE });
  const book = index.books.find((b) => b.folder === BOOK);
  assert.ok(book);
  const todos = bookTodos(index, book);
  assert.deepEqual(todos.map((n) => n.data.id), ['T-001', 'T-002', 'T-003']);
  assert.deepEqual(chapterTodos(todos, 1).filter(isOpen).map((n) => n.data.id), ['T-001', 'T-002']);
  assert.deepEqual(chapterTodos(todos, 2).map((n) => n.data.id), ['T-003']);
  assert.equal(todoPlace(todos[1]), 'Chapter 1 · S-002');
  assert.ok(isBookTodo(index, todos[0]));
  assert.ok(!isBookTodo(index, index.notes['Tasks/T-001 Choose the bell\'s sound.md']));
  assert.equal(nextBookTaskId(files, BOOK), 'T-004');
  assert.equal(nextBookTaskId(files, 'Series/Ember Road/Books/2 Other'), 'T-001');
});

test('a to-do added beside the page goes into the book\'s Tasks folder', async () => {
  const src = new MemSource();
  src.files.set(BOOK + '/Tasks/T-004 Old.md', '---\ntype: task\nid: T-004\ntitle: Old\nstatus: open\n---\n');
  const n = await createTodo(src, BOOK, { title: 'Mara: tin or brass lantern?', chapter: 1, scene: 'S-001' }, new Date('2026-10-18T09:00:00'));
  assert.equal(n.path, BOOK + '/Tasks/T-005 Mara tin or brass lantern.md');
  assert.equal(n.data.id, 'T-005');
  assert.equal(n.data.chapter, 1);
  assert.equal(n.data.scene, 'S-001');
  assert.equal(n.data.owner, 'Kyle');
  assert.equal(n.data.generated, undefined);
  assert.match(src.writes[0].message, /^tasks: add T-005/);
  assert.doesNotMatch(src.writes[0].message, /Agent:/);
  assert.equal(n.data.title, 'Mara: tin or brass lantern?');
});

test('a long to-do keeps every word; only its file name is shortened', async () => {
  const src = new MemSource();
  const long = 'find a way to communicate one more tension point of reed and poppys relationship here. make it a time for reed\nto clarify hes not intersted in poppy. first signal that grey may have feelings for her?';
  const n = await createTodo(src, BOOK, { title: long, chapter: 1, scene: '' }, new Date('2026-10-20T09:00:00'));
  assert.equal(n.data.title, long.replace('\n', ' '));
  const name = n.path.slice(n.path.lastIndexOf('/') + 1);
  assert.ok(name.length <= 'T-001 '.length + 90 + '.md'.length);
  assert.match(name, /^T-001 find a way/);
});

test('the team\'s to-do jobs carry their steps', () => {
  assert.equal(jobLabel('chapter-check'), 'Check this chapter for to-dos');
  assert.equal(defaultJobTitle('todo-review', 'Chapter 3'), 'Tick off fixed to-dos in Chapter 3');
  assert.match(jobAsk('chapter-check', 'Chapter 3', ''), /chapter-todos\/SKILL\.md.*continuity.*plot.*character.*Never change the scenes/s);
  assert.match(jobAsk('todo-review', 'Chapter 3', 'only the lantern one'), /done_note.*Kyle's words: only the lantern one$/s);
});

test('a to-do added in the app passes sf validate', { skip: !hasVault && 'the vault is not beside this repository' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-todo-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  fs.writeFileSync(path.join(dir, BOOK, 'Tasks', 'T-004 Fix the bell rope.md'),
    todoText('T-004', { title: 'Fix the bell rope', chapter: 4, scene: 'S-008' }, new Date('2026-10-18T12:00:00')));
  const out = execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'validate'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /no errors, no warnings/);
});
