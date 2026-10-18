import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyToText, commitMessage, editChange } from '../src/lib/ideas.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { PHASE } from '../src/lib/sync.ts';
import { dueLabel, nextTaskId, taskGroups, taskNotes, taskText } from '../src/lib/tasks.ts';
import { buildIndex } from '../src/lib/vault-index.ts';
import { DEMO, demoSchemaText, FsSource } from './helpers.ts';

const VAULT = path.resolve(DEMO, '..', '..', 'author-business');
const hasVault = fs.existsSync(path.join(VAULT, 'System', 'Tools', 'sf.js'));

test('the to-do list holds the vault tasks, open first, done folded after', async () => {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  const index = await buildIndex({ schema: parseSchema(demoSchemaText()), files, read: (p, sha) => src.read(p, sha), phase: PHASE });
  // The studio's own list; the demo book's to-dos (its own Tasks folder) are counted in todos.test.ts.
  const notes = taskNotes(index).filter((n) => n.path.startsWith('Tasks/'));
  assert.deepEqual(notes.map((n) => n.data.id), ['T-001', 'T-002']);
  assert.equal(taskNotes(index).length, 5);
  const groups = taskGroups(notes);
  assert.deepEqual(groups.map((g) => g.key + ':' + g.notes.map((n) => n.data.id).join(',')), ['doing:', 'open:T-001', 'done:T-002', 'dropped:']);
  assert.equal(nextTaskId(files), 'T-003');
});

test('due dates read plainly', () => {
  const now = new Date('2026-10-20T10:00:00');
  assert.deepEqual(dueLabel('2026-10-27', now), { text: 'Due 27 Oct', late: false });
  assert.deepEqual(dueLabel('2026-10-20', now), { text: 'Due today', late: false });
  assert.deepEqual(dueLabel('2026-10-18', now), { text: 'Overdue since 18 Oct', late: true });
  assert.equal(dueLabel('', now), null);
});

test('Done changes one line and says so in the commit', () => {
  const text = '---\ntype: task\nid: T-005\ntitle: Decide\nowner: Kyle\nstatus: open\n---\nBody\n';
  assert.equal(applyToText(text, editChange({ status: 'done' })), text.replace('status: open', 'status: done'));
  assert.match(commitMessage({ type: 'task', id: 'T-005', title: 'Decide' }, 'edit', { status: 'done' }), /^tasks: done T-005 Decide\n\nEdited on the To-do list/);
});

test('a to-do added in the app passes sf validate', { skip: !hasVault && 'the vault is not beside this repository' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-task-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Tasks', 'T-003 Pick a cover artist.md'),
    taskText('T-003', { title: 'Pick a cover artist', owner: 'Kyle', due: '2026-11-01', body: '' }, new Date('2026-10-17T12:00:00')));
  const out = execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'validate'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /no errors, no warnings/);
});
