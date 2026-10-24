import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createResults, defaultMode, flowJobAsk, flowResults, flowStages, keptFor, kindForStep, nextIdeaNumber, ownResults, resultText, resultTitle,
  splitResults, stageProgress, taskByKey, taskStatuses, targetValue
} from '../src/lib/flow.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { PHASE } from '../src/lib/sync.ts';
import { buildIndex } from '../src/lib/vault-index.ts';
import { parseWorkflow } from '../src/lib/workflow.ts';
import type { NoteRecord, VaultIndex } from '../src/lib/types.ts';
import { DEMO, demoSchemaText, FsSource, hasVault, MemSource, VAULT } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const WORKFLOW = fs.readFileSync(path.join(DEMO, 'System', 'Workflow.md'), 'utf8');

async function demo(): Promise<VaultIndex> {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  return buildIndex({ schema: parseSchema(demoSchemaText()), files, read: (p, sha) => src.read(p, sha), phase: PHASE });
}

test('a step and the Judge step after it are one task; checks and reads stay their own', () => {
  const stages = flowStages(parseWorkflow(WORKFLOW));
  assert.equal(stages.length, 6);
  const keys = stages.map((s) => s.tasks.map((t) => t.key));
  assert.deepEqual(keys[2], ['13-14']);
  assert.ok(keys[3].indexOf('18-19') >= 0 && keys[3].indexOf('20-21') >= 0);
  assert.deepEqual(keys[4], ['26-27', '28-29', '30-31']);
  assert.deepEqual(keys[5], ['32', '33', '34', '35', '36', '37'], 'judging the novel follows the continuity check, so it stands alone');
  assert.equal(taskByKey(stages, '19')!.key, '18-19');
  assert.equal(taskByKey(stages, '18')!.key, '18-19');
});

test('statuses: waiting on Kyle, kept, and Check when an earlier step was kept later', async () => {
  const index = await demo();
  const book = index.books.find((b) => b.folder === BOOK)!;
  const stages = flowStages(parseWorkflow(WORKFLOW));
  const results = flowResults(index, book);
  assert.deepEqual(results.map((n) => n.data.id), ['I-019', 'I-020', 'I-021', 'I-022', 'I-023', 'I-024', 'I-025']);
  const st = taskStatuses(stages, results, [], BOOK);
  assert.equal(st['16'].state, 'kept');
  assert.equal(st['18-19'].state, 'judge', 'two traits wait on Kyle');
  assert.equal(st['18-19'].decide.length, 2);
  const job: NoteRecord = { path: 'Jobs/J-100 x.md', sha: '', type: 'job', error: null, body: '',
    data: { kind: 'workflow-step', target: 'Step 18', book: BOOK, status: 'running' } };
  assert.equal(taskStatuses(stages, results, [job], BOOK)['18-19'].state, 'working');
  // Once the traits are decided, the Core Drive kept after them asks for a check.
  const decided = results.map((n) => (n.data.step === '18' && n.data.status === 'inbox' ? { ...n, data: { ...n.data, status: 'discard' } } : n));
  const after = taskStatuses(stages, decided, [], BOOK)['18-19'];
  assert.equal(after.state, 'check');
  assert.equal(after.changedBy!.key, '16');
  const fine = decided.map((n) => (n.data.id === 'I-020' ? { ...n, data: { ...n.data, checked: '2026-10-21T09:00-04:00' } } : n));
  assert.equal(taskStatuses(stages, fine, [], BOOK)['18-19'].state, 'kept', 'Still fine clears it');
  const p = stageProgress(stages[3], st);
  assert.equal(p.total, stages[3].tasks.length);
  assert.equal(p.done, 2);
  assert.deepEqual(ownResults(results, stages).map((n) => n.data.id), ['I-024']);
});

test('Writing mode finds what was kept for a chapter and the people on the page', async () => {
  const index = await demo();
  const book = index.books.find((b) => b.folder === BOOK)!;
  const results = flowResults(index, book);
  assert.deepEqual(keptFor(results, { chapter: 1, sceneId: '', names: [] }).map((n) => n.data.id), ['I-023']);
  assert.deepEqual(keptFor(results, { chapter: 2, sceneId: '', names: ['Mara Quill'] }).map((n) => n.data.id), ['I-019', 'I-020'], 'newest kept first; inbox traits stay out');
  assert.deepEqual(keptFor(results, { chapter: null, sceneId: '', names: ['the warden'] }).map((n) => n.data.id), ['I-024']);
  assert.equal(defaultMode(index, book), 'writing', 'a book with prose opens in Writing mode');
  assert.equal(defaultMode(index, { ...book, scenes: [] }), 'workflow', 'a new book starts in Workflow mode');
});

test('pasted results split one per paragraph or one per list line, with short titles', () => {
  assert.deepEqual(splitResults('- Stubborn mender\n- Quiet liar\n- Ledger keeper'), ['Stubborn mender', 'Quiet liar', 'Ledger keeper']);
  assert.deepEqual(splitResults('One idea.\nStill the same one.\n\nA second idea.'), ['One idea.\nStill the same one.', 'A second idea.']);
  assert.deepEqual(splitResults('  '), []);
  assert.equal(resultTitle('Mara lies to the ferryman. The bell hums.'), 'Mara lies to the ferryman');
  assert.ok(resultTitle('a'.repeat(30) + ' ' + 'b'.repeat(40)).length <= 60);
  assert.equal(targetValue('mara quill', ['Mara Quill']), '[[Mara Quill]]');
  assert.equal(targetValue('ch 3', []), 'Chapter 3');
  assert.equal(kindForStep('18'), 'character');
  assert.equal(kindForStep('Voice'), 'other');
});

test('results are saved as idea notes with the next free ID, as Kyle', async () => {
  const src = new MemSource();
  src.files.set(BOOK + '/Ideas/I-004 A.md', 'x');
  src.files.set(BOOK + '/Archive/I-009 B.md', 'x');
  assert.equal(nextIdeaNumber((await src.tree()).files, BOOK), 10);
  const made = await createResults(src, BOOK, [
    { step: '18', origin: 'brought-in', text: 'Stubborn mender', target: '[[Mara Quill]]', status: 'inbox' },
    { step: 'Voice', origin: 'kyle', text: 'Hums hymns when he lies', target: '', status: 'keep' }
  ], new Date('2026-10-21T12:00:00'));
  assert.deepEqual(made.map((n) => n.data.id), ['I-010', 'I-011']);
  assert.equal(made[0].data.step, '18');
  assert.equal(made[0].data.origin, 'brought-in');
  assert.equal(made[0].data.status, 'inbox');
  assert.equal(made[1].data.status, 'keep');
  assert.ok(made[1].data.decided);
  assert.ok(src.writes.every((w) => !/Agent:/.test(w.message)), 'Kyle\'s commits carry no Agent line');
});

test('the team\'s ask names the step, the store and the panel', () => {
  const stages = flowStages(parseWorkflow(WORKFLOW));
  const t = taskByKey(stages, '18')!;
  const make = flowJobAsk(t, 'make', 'Lean cozy');
  assert.match(make, /step 18 of `System\/Workflow\.md`/);
  assert.match(make, /`step: "18"`, `origin: team`/);
  assert.match(make, /panel_score/);
  assert.match(make, /Kyle's words: Lean cozy/);
  assert.match(flowJobAsk(t, 'judge', ''), /Never set keep, later or discard/);
  assert.match(flowJobAsk(t, 'change', 'fewer'), /`related`/);
});

test('results written by the app pass sf validate', { skip: !hasVault && 'the vault is not beside this repository' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-flow-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  const text = resultText('I-030', { step: '20', origin: 'brought-in', text: 'The ferry runs on Tobin\'s debt.', target: '[[Tobin Quill]]', status: 'inbox' }, new Date('2026-10-21T12:00:00'));
  fs.writeFileSync(path.join(dir, BOOK, 'Ideas', 'I-030 The ferry runs on Tobin\'s debt.md'), text);
  const out = execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'validate'], { cwd: dir, env: { ...process.env, SF_VAULT: dir }, encoding: 'utf8' });
  assert.match(out, /no errors/, out);
});
