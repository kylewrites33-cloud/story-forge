import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSchema } from '../src/lib/schema.ts';
import { PHASE } from '../src/lib/sync.ts';
import { taskNotes, taskText } from '../src/lib/tasks.ts';
import { CONTEXTS, guessContext, mapOrder, taskContext, taskPriority, todoMap, upNext } from '../src/lib/todomap.ts';
import { buildIndex, makeNote } from '../src/lib/vault-index.ts';
import type { NoteRecord } from '../src/lib/types.ts';
import { DEMO, demoSchemaText, FsSource } from './helpers.ts';

const note = (path: string, data: Record<string, unknown>): NoteRecord =>
  makeNote(path, 'x', '---\n' + Object.keys(data).map((k) => k + ': ' + data[k]).join('\n') + '\n---\nBody.\n');

test('every lane matches a context the schema allows', () => {
  const schema = JSON.parse(demoSchemaText());
  assert.deepEqual(CONTEXTS.map((c) => c.key), schema.types.task.properties.context.enum);
  assert.deepEqual(['need', 'want'], schema.types.task.properties.priority.enum);
});

test('a studio to-do with no context is guessed from its title', () => {
  assert.equal(guessContext('Fix validation: Saffron\'s motive'), 'admin');
  assert.equal(guessContext('Check KDP\'s rule on special-edition paperbacks'), 'publishing');
  assert.equal(guessContext('Re-run the five Rocket keyword searches'), 'marketing');
  assert.equal(guessContext('Bold, italic and normal buttons in the writing screen'), 'sparrow');
  assert.equal(guessContext('Bring the Contrarian\'s brief in line'), 'team');
  assert.equal(guessContext('Buy stamps'), 'admin');
});

test('the map puts book to-dos under Writing, keeps a set context, and orders doing, late, needs, wants', async () => {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  const index = await buildIndex({ schema: parseSchema(demoSchemaText()), files, read: (p, sha) => src.read(p, sha), phase: PHASE });
  const book = taskNotes(index).find((n) => !n.path.startsWith('Tasks/'))!;
  assert.equal(taskContext(index, book), 'writing');
  const now = new Date('2026-11-01T10:00:00');
  const a = note('Tasks/T-010 A.md', { type: 'task', id: 'T-010', title: 'Want one', status: 'open', context: 'marketing', priority: 'want' });
  const b = note('Tasks/T-011 B.md', { type: 'task', id: 'T-011', title: 'Need one', status: 'open', context: 'marketing' });
  const c = note('Tasks/T-012 C.md', { type: 'task', id: 'T-012', title: 'Late one', status: 'open', context: 'marketing', due: '2026-10-20' });
  const d = note('Tasks/T-013 D.md', { type: 'task', id: 'T-013', title: 'Doing one', status: 'doing', context: 'marketing', owner: 'Claude' });
  const e = note('Tasks/T-014 E.md', { type: 'task', id: 'T-014', title: 'Finished', status: 'done', context: 'marketing' });
  assert.equal(taskPriority(a), 'want');
  assert.deepEqual(mapOrder([a, b, c, d], now).map((n) => n.data.id), ['T-013', 'T-012', 'T-011', 'T-010']);
  const lanes = todoMap(index, [a, b, c, d, e, book], { who: '', priority: '' }, now);
  const m = lanes.find((l) => l.context.key === 'marketing')!;
  assert.deepEqual([m.open.length, m.doing, m.late, m.wants, m.done], [4, 1, 1, 1, 1]);
  assert.equal(lanes.find((l) => l.context.key === 'writing')!.books.length, 1);
  assert.equal(todoMap(index, [a, b, c, d], { who: 'kyle', priority: 'need' }, now).find((l) => l.context.key === 'marketing')!.open.length, 2);
  assert.deepEqual(upNext(lanes, now).map((n) => n.data.id), ['T-013', 'T-012']);
});

test('a published book\'s to-dos fold away and stop counting', async () => {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  const index = await buildIndex({ schema: parseSchema(demoSchemaText()), files, read: (p, sha) => src.read(p, sha), phase: PHASE });
  const b = index.books[0];
  const bookNote = index.notes[b.folder + '/Book.md'];
  const out = { ...index, notes: { ...index.notes, [bookNote.path]: { ...bookNote, data: { ...bookNote.data, stage: 'done' } } } };
  const w = todoMap(out, taskNotes(out), { who: '', priority: '' }, new Date()).find((l) => l.context.key === 'writing')!;
  assert.equal(w.open.length, 0);
  assert.equal(w.books[0].out, true);
  assert.ok(w.books[0].open.length > 0);
});

test('a to-do added with a place and as a want says so in its note', () => {
  const t = taskText('T-003', { title: 'Try a podcast', owner: 'Kyle', due: '', body: '', context: 'marketing', priority: 'want' }, new Date('2026-11-01T12:00:00'));
  assert.match(t, /\ncontext: marketing\npriority: want\n/);
  assert.doesNotMatch(taskText('T-004', { title: 'X', owner: 'Kyle', due: '', body: '', priority: 'need' }, new Date()), /priority|context/);
});
