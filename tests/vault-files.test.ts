// The one saving system: a note on the workflow (a file the app holds as text, not as a note), and files from the
// device saved as they are: a Rocket export, a cover (two pictures), a manuscript with its ask to the team, a Word backup.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backupFile } from '../src/lib/docx.ts';
import { jobAsk } from '../src/lib/jobs.ts';
import { rocketFile } from '../src/lib/market.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { sync } from '../src/lib/sync.ts';
import { addWorkflowNote, WORKFLOW_PATH } from '../src/lib/workflow.ts';
import type { BookEntry, VaultIndex } from '../src/lib/types.ts';
import { foldSaved, overlayActions } from '../src/vault/apply.ts';
import { createAction, filesAction, textAction, type Action } from '../src/vault/ops.ts';
import { add, loadOutbox, saveOutbox } from '../src/vault/outbox.ts';
import { pushAction, pushAll } from '../src/vault/push.ts';
import { Tree } from '../src/vault/tree.ts';
import { DEMO, demoSchemaText, FsSource, leaves, MemSource } from './helpers.ts';

const SERIES = 'Series/Ember Road';
const BOOK = SERIES + '/Books/1 Ash Bell';
const schema = parseSchema(demoSchemaText());

async function vault(): Promise<MemSource> {
  const fs2 = new FsSource(DEMO);
  const src = new MemSource();
  for (const f of (await fs2.tree()).files) if (f.path.endsWith('.md') || f.path.endsWith('.json')) src.files.set(f.path, await fs2.read(f.path));
  return src;
}
const indexOf = async (src: MemSource): Promise<VaultIndex> => (await sync(src, null)).index;
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const note = (text: string, day = '2026-11-11', id = 'w1'): Action => ({ ...textAction([{ path: WORKFLOW_PATH, change: { what: 'workflow-note', note: text, day } }]), id });

// ---- a note on the workflow ----

test('a note on the workflow shows at once, waits across closing the app, and lands as the old way wrote it', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const was = src.files.get(WORKFLOW_PATH)!;
  assert.ok(index.team && index.team[WORKFLOW_PATH], 'the app holds the workflow as text');
  assert.equal(index.notes[WORKFLOW_PATH], undefined, 'and not as a note');

  // With no connection: it shows, and it is still there when the app opens again.
  const s = new MemStorage() as unknown as Storage;
  saveOutbox('k', add([], note('Step 12 takes two passes, not one.')), s);
  const waiting = loadOutbox('k', s);
  assert.equal(waiting.length, 1);
  const shown = overlayActions(index, waiting, schema);
  assert.equal(shown.team![WORKFLOW_PATH].text, addWorkflowNote(was, 'Step 12 takes two passes, not one.', '2026-11-11'));
  assert.equal(index.team![WORKFLOW_PATH].text, was, 'the saved copy itself is not changed by showing it');

  // The team changed the workflow meanwhile: the note lands on their version, as one save.
  src.files.set(WORKFLOW_PATH, was.replace('# ', '# (v2) '));
  const res = await pushAll(src, waiting);
  assert.deepEqual(res.done, ['w1']);
  assert.equal(src.commits.length, 1);
  assert.deepEqual(src.commits[0].paths, [WORKFLOW_PATH]);
  assert.equal(src.commits[0].message, 'workflow: Kyle\'s note');
  assert.equal(src.files.get(WORKFLOW_PATH), addWorkflowNote(was.replace('# ', '# (v2) '), 'Step 12 takes two passes, not one.', '2026-11-11'));

  // The saved copy takes the save's answer: the same as a fresh read, with no sync.
  const folded = foldSaved(index, res.saved, schema, res.removed, res.texts);
  const fresh = await indexOf(src);
  assert.deepEqual(folded.team![WORKFLOW_PATH], fresh.team![WORKFLOW_PATH]);
  assert.deepEqual(Object.keys(folded.notes).sort(), Object.keys(fresh.notes).sort(), 'the workflow did not turn into a note');
});

test('two notes on the workflow written with no connection both land, in order, as one save', async () => {
  const src = await vault();
  const was = src.files.get(WORKFLOW_PATH)!;
  let list = add([], note('First.', '2026-11-11', 'w1'));
  list = add(list, note('Second.', '2026-11-12', 'w2'));
  assert.equal(list.length, 2, 'the second does not replace the first');
  const res = await pushAll(src, list);
  assert.deepEqual(res.done, ['w1', 'w2']);
  assert.equal(src.commits.length, 1);
  assert.equal(src.files.get(WORKFLOW_PATH), addWorkflowNote(addWorkflowNote(was, 'First.', '2026-11-11'), 'Second.', '2026-11-12'));
});

// ---- files from the device ----

test('a Rocket file is one save, and takes the next free name when its name is taken', async () => {
  const csv = '﻿keyword,searches\ncozy fantasy,1200\n';
  const src = await vault();
  const f = rocketFile(SERIES, 'Cozy: keywords.csv', csv);
  const one = await pushAction(src, filesAction([f]));
  assert.deepEqual(one.renames, {});
  const two = await pushAction(src, filesAction([rocketFile(SERIES, 'Cozy: keywords.csv', csv)]));
  assert.equal(two.renames[f.path], SERIES + '/Market/Rocket Exports/Cozy keywords (2).csv');
  assert.equal(src.commits.length, 2);
  assert.deepEqual(src.commits.map((c) => c.message.split('\n')[0]), ['market: add Rocket file Cozy keywords.csv', 'market: add Rocket file Cozy keywords (2).csv']);
  leaves('rocket-files', (await vault()).files, src.files);
});

test('a cover is one save of two pictures; the small copy replaces the one there and the full-size one never replaces another', async () => {
  const src = await vault();
  const book = { folder: BOOK, title: 'Ash Bell' } as BookEntry;
  const files = (n: string) => [
    { path: BOOK + '/Cover.jpg', taken: 'replace' as const, base64: 'c21hbGw' + n, message: 'books: cover for ' + book.title },
    { path: BOOK + '/Cover/Original cover 2026-11-11 120000.png', taken: 'next' as const, base64: 'ZnVsbA' + n, message: 'books: full-size cover for ' + book.title }
  ];
  await pushAction(src, filesAction(files('1')));
  assert.equal(src.commits.length, 1);
  assert.deepEqual(src.commits[0].paths.sort(), [BOOK + '/Cover.jpg', BOOK + '/Cover/Original cover 2026-11-11 120000.png']);
  assert.equal(src.commits[0].message.split('\n')[0], 'books: cover for Ash Bell');
  // A second cover in the same second (it cannot happen by hand, but nothing may be written over).
  const res = await pushAction(src, filesAction(files('2')));
  assert.equal(src.files.get(BOOK + '/Cover.jpg'), 'c21hbGw2');
  assert.equal(src.files.get(BOOK + '/Cover/Original cover 2026-11-11 120000.png'), 'ZnVsbA1');
  assert.equal(src.files.get(BOOK + '/Cover/Original cover 2026-11-11 120000 (2).png'), 'ZnVsbA2');
  assert.deepEqual(res.saved, [], 'pictures are not notes');
});

test('a manuscript and its ask to the team are one save: both land, or neither does', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const known = Object.keys(index.notes).map((path) => ({ path, sha: '' }));
  const path = BOOK + '/Research/Draft Three.docx';
  const rel = 'Research/Draft Three.docx';
  const ask = createAction('job', { j: { title: 'Bring in Draft Three', kind: 'import', target: rel, book: BOOK, ask: jobAsk('import', rel, '') }, at: '2026-11-11T17:00:00.000Z' }, known);
  const action = filesAction([{ path, taken: 'refuse', base64: 'UEsDBA==', message: 'manuscripts: add Draft Three.docx\n\nAdded in the Sparrow app to bring in as scenes.' }], ask.ops);

  const res = await pushAction(src, action);
  assert.equal(src.commits.length, 1);
  const job = ask.ops[0].path;
  assert.deepEqual(src.commits[0].paths.sort(), [job, path].sort());
  assert.equal(src.commits[0].message.split('\n')[0], 'manuscripts: add Draft Three.docx');
  assert.equal(src.files.get(path), 'UEsDBA==');
  // The ask shows in Jobs from the save's answer, with no sync.
  const folded = foldSaved(index, res.saved, schema, res.removed, res.texts);
  assert.ok(folded.notes[job] && String(folded.notes[job].data.kind) === 'import');
  assert.ok((folded.jobs || []).indexOf(job) >= 0);

  // The same name arrives from elsewhere first: the save stops with a sentence, and no ask is left without its file.
  const other = await vault();
  other.files.set(path, 'someone else');
  await assert.rejects(pushAction(other, action), /A file called Draft Three\.docx reached the vault a moment ago/);
  assert.equal(other.commits.length, 0);
  assert.equal(other.files.get(path), 'someone else');
  assert.equal(other.files.has(job), false);
});

test('a Word backup replaces the same day\'s file, as before', async () => {
  const src = await vault();
  const book = { seriesName: 'Ember Road', title: 'Ash Bell' } as BookEntry;
  const a = backupFile(book, new Uint8Array([80, 75, 3, 4]), 'Ember Road_Ash Bell_2026-11-11.docx');
  assert.equal(a.path, 'Book Backups/Ember Road/Ash Bell/Ember Road_Ash Bell_2026-11-11.docx');
  await pushAction(src, filesAction([a]));
  await pushAction(src, filesAction([backupFile(book, new Uint8Array([80, 75, 5, 6]), 'Ember Road_Ash Bell_2026-11-11.docx')]));
  assert.equal(src.commits.length, 2);
  assert.equal(src.files.get(a.path), Buffer.from([80, 75, 5, 6]).toString('base64'));
});

test('a file from the device goes up again whole when the vault moved while it was saving', async () => {
  const src = await vault();
  src.race = () => { src.files.set('Tasks/T-900 Something else.md', '---\ntype: task\n---\n'); };
  const f = rocketFile(SERIES, 'Lane.csv', 'a,b\n1,2\n');
  await pushAction(src, filesAction([f]));
  assert.equal(src.builds, 2, 'planned again on the newer vault');
  assert.equal(src.commits.length, 1);
  assert.equal(src.files.get(f.path), 'a,b\n1,2\n');
  assert.ok(src.files.has('Tasks/T-900 Something else.md'), 'the other change is kept');
});

test('the save\'s tree lists a file that is not text, and writes it apart from the text files', async () => {
  const t = new Tree({ read: async () => null, files: async () => [{ path: 'a.md', sha: '1' }, { path: 'pic.jpg', sha: '2' }] });
  t.writeBytes('pic.jpg', 'QQ==');
  t.writeBytes('new.png', 'Qg==');
  t.write('b.md', 'words');
  assert.deepEqual((await t.files()).map((f) => f.path + ':' + f.sha).sort(), ['a.md:1', 'b.md:', 'new.png:', 'pic.jpg:']);
  const c = t.changes();
  assert.deepEqual(c.writes, [{ path: 'b.md', text: 'words' }]);
  assert.deepEqual(c.blobs, [{ path: 'pic.jpg', base64: 'QQ==' }, { path: 'new.png', base64: 'Qg==' }]);
  assert.deepEqual(t.saved({}).map((n) => n.path), ['b.md']);
});
