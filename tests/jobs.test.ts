import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { applyToText, commitMessage, editChange } from '../src/lib/ideas.ts';
import { askBody, costLabel, createJob, defaultJobTitle, jobGroups, jobLabel, jobNotes, jobText, nextJobId, openJobFor, resultBody } from '../src/lib/jobs.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { PHASE } from '../src/lib/sync.ts';
import { buildIndex, makeNote } from '../src/lib/vault-index.ts';
import type { NoteRecord } from '../src/lib/types.ts';
import { DEMO, demoSchemaText, FsSource, hasVault, MemSource, VAULT } from './helpers.ts';

const job = (id: string, status: string, created: string, extra: Record<string, unknown> = {}): NoteRecord =>
  ({ path: 'Jobs/' + id + '.md', sha: id, type: 'job', data: { type: 'job', id, status, created, kind: 'check', target: 'S-001', ...extra }, body: '', error: null });

test('the demo vault has jobs and the index lists them', async () => {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  const index = await buildIndex({ schema: parseSchema(demoSchemaText()), files, read: (p, sha) => src.read(p, sha), phase: PHASE });
  const notes = jobNotes(index);
  assert.deepEqual(notes.map((n) => n.data.id), ['J-001', 'J-002', 'J-003', 'J-004', 'J-005']);
  assert.equal(nextJobId(files), 'J-006');
  assert.equal(nextJobId(files.filter((f) => !f.path.startsWith('Jobs/'))), 'J-001');
  const groups = jobGroups(notes);
  assert.deepEqual(groups.map((g) => g.key + ':' + g.notes.map((n) => n.data.id).join(',')), ['running:', 'requested:J-002', 'done:J-005,J-004,J-003,J-001', 'failed:', 'cancelled:']);
  assert.match(resultBody(notes[0].body), /^Three phrases in S-001/);
  assert.equal(askBody(notes[1].body), 'Keep it under 1,800 words and end on the bell.');
});

test('jobs group by status, newest first inside a group', () => {
  const notes = [
    job('J-001', 'done', '2026-10-15'),
    job('J-002', 'requested', '2026-10-16'),
    job('J-003', 'running', '2026-10-16'),
    job('J-004', 'requested', '2026-10-17'),
    job('J-005', 'failed', '2026-10-17'),
    job('J-006', 'cancelled', '2026-10-17'),
    job('J-007', 'done', '2026-10-17'),
    job('J-008', 'requested', '2026-10-17'),
    job('J-009', 'mystery', '2026-10-18')
  ];
  const groups = jobGroups(notes);
  assert.deepEqual(groups.map((g) => g.key), ['running', 'requested', 'done', 'failed', 'cancelled']);
  assert.deepEqual(groups.map((g) => g.notes.map((n) => n.data.id).join(',')), ['J-003', 'J-009,J-008,J-004,J-002', 'J-007,J-001', 'J-005', 'J-006']);
  // A job of the same kind and target that is still waiting or working stops a duplicate.
  assert.equal(openJobFor(notes, 'check', 'S-001')!.data.id, 'J-002');
  assert.equal(openJobFor(notes, 'draft', 'S-001'), null);
  assert.equal(openJobFor(notes, 'check', 'S-002'), null);
});

test('a job note reads back through the vault parser with the properties the runner expects', () => {
  const now = new Date('2026-10-18T14:05:00');
  const text = jobText('J-001', { title: "Draft S-045 Grey at the barn: Ines's turn", kind: 'draft', target: 'S-045', book: 'Series/Quest Declined/Books/2 Quest Declined 2', ask: '' }, now);
  assert.match(text, /^---\ntype: job\nid: J-001\n/);
  const p = Frontmatter.parse(text);
  assert.equal(p.error, null);
  assert.deepEqual(p.data, {
    type: 'job', id: 'J-001', title: "Draft S-045 Grey at the barn: Ines's turn", kind: 'draft', target: 'S-045',
    book: 'Series/Quest Declined/Books/2 Quest Declined 2', status: 'requested', requested_by: 'Kyle', created: '2026-10-18'
  });
  assert.equal(p.body, '## Ask\nKyle asked for this from the Story Forge app.\n');
  assert.equal(askBody(p.body), 'Kyle asked for this from the Story Forge app.');
  assert.equal(resultBody(p.body), '');
  // Learn and custom jobs have no target, and Kyle's words go under ## Ask.
  const custom = Frontmatter.parse(jobText('J-002', { title: 'Ask the team', kind: 'custom', target: '', book: 'Series/Ember Road/Books/1 Ash Bell', ask: '  Is the ferryman too nice?  ' }, now));
  assert.equal('target' in (custom.data as object), false);
  assert.equal(custom.body, '## Ask\nIs the ferryman too nice?\n');
});

test("Kyle's words for kinds, statuses, titles and cost", () => {
  assert.equal(jobLabel('draft'), 'Draft this scene');
  assert.equal(jobLabel('notes'), 'Notes on this chapter');
  assert.equal(jobLabel('check'), 'Deeper check for AI-sounding phrases (the team)');
  assert.equal(jobLabel('learn'), 'Learn from my edits');
  assert.equal(jobLabel('custom'), 'Ask the team');
  assert.equal(jobLabel(undefined), 'Ask the team');
  assert.equal(defaultJobTitle('draft', 'S-045', 'Grey at the barn'), 'Draft S-045 Grey at the barn');
  assert.equal(defaultJobTitle('notes', 'Chapter 30'), 'Notes on Chapter 30');
  assert.equal(defaultJobTitle('check', 'S-045', 'Grey at the barn'), 'Check S-045 Grey at the barn for AI-sounding phrases');
  assert.equal(defaultJobTitle('learn', ''), "Learn from Kyle's edits");
  assert.equal(costLabel(0.42), 'about $0.42');
  assert.equal(costLabel('1.5'), 'about $1.50');
  assert.equal(costLabel(0.001), 'less than a cent');
  assert.equal(costLabel(undefined), '');
});

test('createJob writes Jobs/J-NNN as a commit without an Agent trailer, and retries on a clash', async () => {
  const src = new MemSource();
  src.files.set('Jobs/J-004 Older.md', '---\ntype: job\nid: J-004\ntitle: Older\nkind: learn\nstatus: done\n---\n## Ask\nx\n');
  const made = await createJob(src, { title: 'Check S-002 for AI-sounding phrases', kind: 'check', target: 'S-002', book: 'Series/Ember Road/Books/1 Ash Bell', ask: '' }, new Date('2026-10-18T10:00:00'));
  assert.equal(made.path, 'Jobs/J-005 Check S-002 for AI-sounding phrases.md');
  assert.equal(made.data.status, 'requested');
  assert.equal(src.writes[0].message, 'jobs: add J-005 Check S-002 for AI-sounding phrases\n\nAsked for in the Story Forge app.');
  assert.doesNotMatch(src.writes[0].message, /Agent:/);
  await assert.rejects(createJob(src, { title: '   ', kind: 'custom', target: '', book: '', ask: '' }, new Date()), /Give the job a title first\./);
});

test('Cancel changes one status line and says so in the commit', () => {
  const text = '---\ntype: job\nid: J-007\ntitle: Notes on Chapter 3\nkind: notes\nstatus: requested\n---\n## Ask\nx\n';
  assert.equal(applyToText(text, editChange({ status: 'cancelled' })), text.replace('status: requested', 'status: cancelled'));
  assert.match(commitMessage({ type: 'job', id: 'J-007', title: 'Notes on Chapter 3' }, 'edit', { status: 'cancelled' }), /^jobs: cancelled J-007 Notes on Chapter 3\n\nEdited on the Jobs screen/);
  const n = makeNote('Jobs/J-007 Notes on Chapter 3.md', 'x', applyToText(text, editChange({ status: 'cancelled' })));
  assert.equal(n.data.status, 'cancelled');
});

test('a job added in the app passes sf validate', { skip: !hasVault && 'the vault is not beside this repository' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-job-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Jobs', 'J-006 Notes on Chapter 1.md'),
    jobText('J-006', { title: 'Notes on Chapter 1', kind: 'notes', target: 'Chapter 1', book: 'Series/Ember Road/Books/1 Ash Bell', ask: 'Is the opening too slow?' }, new Date('2026-10-18T12:00:00')));
  const out = execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'validate'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /no errors, no warnings/);
});
