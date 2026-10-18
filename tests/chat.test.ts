import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { chatJob, conversation, conversations, firstWords, isSceneThread, isThread, nextChatThread } from '../src/lib/chat.ts';
import { createJob, jobText } from '../src/lib/jobs.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { PHASE } from '../src/lib/sync.ts';
import { buildIndex } from '../src/lib/vault-index.ts';
import type { NoteRecord, VaultIndex } from '../src/lib/types.ts';
import { DEMO, demoSchemaText, FsSource, hasVault, MemSource, VAULT } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';

async function demoIndex(): Promise<VaultIndex> {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  return buildIndex({ schema: parseSchema(demoSchemaText()), files, read: (p, sha) => src.read(p, sha), phase: PHASE });
}

const chat = (id: string, thread: string, status: string, ask: string, reply = '', extra: Record<string, unknown> = {}): NoteRecord => ({
  path: 'Jobs/' + id + ' x.md', sha: id, type: 'job',
  data: { type: 'job', id, title: 'x', kind: 'chat', thread, book: BOOK, status, created: '2026-10-18', ...extra },
  body: '## Ask\n' + ask + '\n' + (reply ? '\n## Result\n' + reply + '\n' : ''), error: null
});

function withJobs(base: VaultIndex, notes: NoteRecord[]): VaultIndex {
  const all = { ...base.notes };
  notes.forEach((n) => { all[n.path] = n; });
  return { ...base, notes: all, jobs: (base.jobs || []).concat(notes.map((n) => n.path)) };
}

test('the demo vault has a scene conversation and a general one, newest activity first', async () => {
  const index = await demoIndex();
  const list = conversations(index);
  assert.deepEqual(list.map((c) => c.thread), ['chat-001', 'S-002']);
  const [general, scene] = list;
  assert.equal(general.title, 'Is the opening of Ash Bell too slow?');
  assert.deepEqual(general.messages.map((m) => m.id), ['J-004', 'J-005']);
  assert.equal(general.messages[1].ask, 'Where would that line go?');
  assert.match(general.messages[1].reply, /^Right after "The bell hung crooked/);
  assert.equal(general.messages[0].cost, 'about $0.31');
  assert.equal(general.pending, false);
  assert.equal(scene.title, 'S-002 The Ferry');
  assert.equal(scene.scene!.data.id, 'S-002');
  assert.equal(scene.book, BOOK);
  assert.equal(scene.messages[0].state, 'done');
  // Other kinds of job are not conversations.
  assert.equal(list.some((c) => c.messages.some((m) => m.id === 'J-001' || m.id === 'J-002')), false);
  assert.equal(nextChatThread(index), 'chat-002');
});

test('messages keep ID order, show waiting, working and failed, and a new one may follow an unanswered one', async () => {
  const base = await demoIndex();
  const index = withJobs(base, [
    chat('J-012', 'S-004', 'requested', 'And the second question?'),
    chat('J-010', 'S-004', 'done', 'Is the ice scene too long?', 'A little. Cut the second paragraph.', { finished: '2026-10-18T09:30', cost_usd: 0.002 }),
    chat('J-011', 'S-004', 'running', 'Which paragraph?'),
    chat('J-013', 'chat-007', 'failed', 'Why did this stop?', '', { result: 'The run hit its spend cap.', created: '2026-10-17' })
  ]);
  const c = conversation(index, 'S-004');
  assert.deepEqual(c.messages.map((m) => m.id + ':' + m.state), ['J-010:done', 'J-011:working', 'J-012:waiting']);
  assert.equal(c.messages[0].cost, 'less than a cent');
  assert.equal(c.messages[1].reply, '');
  assert.equal(c.pending, true);
  assert.equal(c.title, 'S-004 Ice on the Ford');
  const failed = conversation(index, 'chat-007');
  assert.equal(failed.messages[0].state, 'failed');
  assert.equal(failed.messages[0].result, 'The run hit its spend cap.');
  assert.equal(failed.pending, false);
  // Newest day first, then the newest message: S-004 (J-012) and chat-001 (J-005) today, then chat-007 (J-013) and S-002 (J-003) yesterday.
  assert.deepEqual(conversations(index).map((x) => x.thread), ['S-004', 'chat-001', 'chat-007', 'S-002']);
  // A question sent today goes above a conversation whose reply came this morning.
  const later = withJobs(index, [chat('J-020', 'chat-008', 'requested', 'New question')]);
  assert.equal(conversations(later)[0].thread, 'chat-008');
  assert.equal(nextChatThread(index), 'chat-008');
  // A scene with nothing said yet is an empty conversation, titled by the scene.
  const empty = conversation(index, 'S-006', BOOK);
  assert.deepEqual(empty.messages, []);
  assert.equal(empty.title, 'S-006 Thaw Market');
  assert.equal(empty.book, BOOK);
  assert.equal(empty.pending, false);
});

test('titles, thread names and the first words of a message', () => {
  assert.equal(isSceneThread('S-012'), true);
  assert.equal(isSceneThread('chat-001'), false);
  assert.equal(isThread('chat-001'), true);
  assert.equal(isThread('new'), false);
  assert.equal(isThread('../x'), false);
  assert.equal(firstWords('  Is the   *ferryman* too nice?  '), 'Is the ferryman too nice?');
  assert.equal(firstWords('Should Mara find out about the rope in chapter two, or wait until the ledger?'), 'Should Mara find out about the rope in chapter…');
  assert.equal(firstWords(''), '');
  assert.equal(firstWords('**Tobin cut it.**\n\n- The tolls\n2. The marks'), 'Tobin cut it. The tolls The marks');
});

test('a message becomes a chat job with its thread, and goes in as Kyle\'s commit', async () => {
  const j = chatJob('S-002', '  Who cut the rope?  ', BOOK);
  assert.deepEqual(j, { title: 'Who cut the rope?', kind: 'chat', target: 'S-002', book: BOOK, ask: 'Who cut the rope?', thread: 'S-002' });
  assert.equal(chatJob('chat-003', 'Hello', BOOK).target, '');
  const p = Frontmatter.parse(jobText('J-009', chatJob('chat-003', 'Is the ferryman too nice?', BOOK), new Date('2026-10-18T10:00:00')));
  assert.equal(p.error, null);
  assert.deepEqual(p.data, { type: 'job', id: 'J-009', title: 'Is the ferryman too nice?', kind: 'chat', book: BOOK, thread: 'chat-003', status: 'requested', requested_by: 'Kyle', created: '2026-10-18' });
  assert.equal(p.body, '## Ask\nIs the ferryman too nice?\n');
  const src = new MemSource();
  const made = await createJob(src, chatJob('chat-001', 'Is the ferryman too nice?', BOOK), new Date('2026-10-18T10:00:00'));
  // createJob makes the title safe for a file name.
  assert.equal(made.path, 'Jobs/J-001 Is the ferryman too nice.md');
  assert.equal(made.data.thread, 'chat-001');
  assert.doesNotMatch(src.writes[0].message, /Agent:/);
});

test('a chat message added in the app passes sf validate', { skip: !hasVault && 'the vault is not beside this repository' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-chat-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Jobs', 'J-006 Is the ferryman too nice.md'),
    jobText('J-006', chatJob('S-002', 'Is the ferryman too nice?', BOOK), new Date('2026-10-18T12:00:00')));
  fs.writeFileSync(path.join(dir, 'Jobs', 'J-007 Hello.md'), jobText('J-007', chatJob('chat-002', 'Hello', BOOK), new Date('2026-10-18T12:00:00')));
  const out = execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'validate'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /no errors, no warnings/);
});

test('a scene ID in two books makes two conversations, one per book', async () => {
  const base = await demoIndex();
  const other = 'Series/Ember Road/Books/2 Second Bell';
  const index = withJobs(base, [
    chat('J-901', 'S-012', 'done', 'About book one.', 'Reply one.'),
    chat('J-902', 'S-012', 'requested', 'About book two.', '', { book: other })
  ]);
  const both = conversations(index).filter((c) => c.thread === 'S-012');
  assert.equal(both.length, 2);
  assert.deepEqual(conversation(index, 'S-012', BOOK).messages.map((m) => m.id), ['J-901']);
  assert.deepEqual(conversation(index, 'S-012', other).messages.map((m) => m.id), ['J-902']);
  assert.equal(conversation(index, 'S-012', other).pending, true);
  assert.equal(conversation(index, 'S-012', BOOK).pending, false);
});
