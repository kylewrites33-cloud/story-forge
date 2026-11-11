import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { fromBase64, GitHubSource, toBase64 } from '../src/lib/github.ts';
import { applyToText, changeFor, commitMessage, piles, stamp } from '../src/lib/ideas.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { DEFAULTS } from '../src/lib/settings.ts';
import { PHASE, sync } from '../src/lib/sync.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import { overlayActions } from '../src/vault/apply.ts';
import { choiceAction } from '../src/vault/ops.ts';
import { add, choicesOf, settle } from '../src/vault/outbox.ts';
import { pushAction, pushAll } from '../src/vault/push.ts';
import { DEMO, FsSource, hasVault, MemSource, VAULT } from './helpers.ts';

const IDEA = [
  '---',
  'type: idea',
  'id: I-008',
  'title: Chapter groupings',
  'kind: structure',
  'status: inbox',
  'source: Plot Specialist',
  'pitch: "Restore Kyle\'s 36 chapters: every break is his."',
  'created: 2026-10-17',
  '---',
  '',
  '## The idea',
  '',
  'Body stays byte for byte.\r',
  ''
].join('\n');

const NOW = new Date('2026-10-17T15:40:00Z');

test('keep sets status, decided and the reason, and leaves every other line as it was', () => {
  const out = applyToText(IDEA, changeFor(Frontmatter.parse(IDEA).data, 'keep', NOW, '  Matches my  breaks. '));
  const data = Frontmatter.parse(out).data;
  assert.equal(data.status, 'keep');
  assert.match(String(data.decided), /^2026-10-17T\d\d:40[+-]\d\d:\d\d$/);
  assert.equal(data.decision_note, 'Matches my breaks.');
  assert.ok(out.includes('pitch: "Restore Kyle\'s 36 chapters: every break is his."\n'), 'untouched lines keep their quoting');
  assert.ok(out.endsWith('## The idea\n\nBody stays byte for byte.\r\n'));
  assert.equal(out.split('\n').length, IDEA.split('\n').length + 2);
});

test('drop sets discard; later keeps inbox and adds the later tag once; back to inbox clears both', () => {
  const dropped = applyToText(IDEA, changeFor(Frontmatter.parse(IDEA).data, 'drop', NOW));
  assert.equal(Frontmatter.parse(dropped).data.status, 'discard');
  assert.equal(Frontmatter.parse(dropped).data.decision_note, undefined, 'no reason, no line');

  const later = applyToText(IDEA, changeFor(Frontmatter.parse(IDEA).data, 'later', NOW));
  const ld = Frontmatter.parse(later).data;
  assert.equal(ld.status, 'inbox');
  assert.deepEqual(ld.tags, ['later']);
  assert.equal(ld.decided, undefined);
  const again = applyToText(later, changeFor(ld, 'later', NOW));
  assert.equal(again, later, 'a second later changes nothing');

  const kept = applyToText(later, changeFor(ld, 'keep', NOW));
  assert.equal(Frontmatter.parse(kept).data.tags, undefined, 'keeping takes the later tag off');

  const back = applyToText(kept, changeFor(Frontmatter.parse(kept).data, 'inbox', NOW));
  const bd = Frontmatter.parse(back).data;
  assert.equal(bd.status, 'inbox');
  assert.equal(bd.decided, undefined);
});

test('other tags survive the later tag coming and going', () => {
  const tagged = IDEA.replace('created:', 'tags:\n  - cozy\ncreated:');
  const later = applyToText(tagged, changeFor(Frontmatter.parse(tagged).data, 'later', NOW));
  assert.deepEqual(Frontmatter.parse(later).data.tags, ['cozy', 'later']);
  const kept = applyToText(later, changeFor(Frontmatter.parse(later).data, 'keep', NOW));
  assert.deepEqual(Frontmatter.parse(kept).data.tags, ['cozy']);
});

test('refuses a note whose properties cannot be read', () => {
  const bad = '---\ntype: idea\nstatus: [inbox\n---\n';
  assert.throws(() => applyToText(bad, changeFor({}, 'keep', NOW)), /cannot be read/);
});

test('a decision commit has no Agent trailer, so it counts as Kyle\'s', () => {
  const msg = commitMessage({ id: 'I-008', title: 'Chapter groupings' }, 'drop');
  assert.match(msg, /^ideas: drop I-008 Chapter groupings\n/);
  assert.doesNotMatch(msg, /Agent:/);
});

test('stamp gives minutes and an offset', () => {
  assert.match(stamp(NOW), /^\d{4}-\d\d-\d\dT\d\d:\d\d[+-]\d\d:\d\d$/);
});

test('piles sort by ID and put later ideas apart', () => {
  const n = (id: string, extra: string) => makeNote(id + '.md', id, '---\ntype: idea\nid: ' + id + '\n' + extra + '\n---\n');
  const p = piles([n('I-010', 'status: inbox'), n('I-002', 'status: inbox'), n('I-003', 'status: inbox\ntags: [later]'), n('I-004', 'status: keep'), n('I-005', 'status: discard'), n('I-006', 'status: regenerate'), n('I-007', 'status: done')]);
  assert.deepEqual(p.decide.map((x) => x.data.id), ['I-002', 'I-010']);
  assert.deepEqual(p.later.map((x) => x.data.id), ['I-003']);
  assert.equal(p.kept.length, 1);
  assert.equal(p.dropped.length, 1);
  assert.deepEqual(p.rewrite.map((x) => x.data.id), ['I-006']);
  assert.deepEqual(p.other.map((x) => x.data.id), ['I-007']);
});

test('Rewrite sends a proposal back to the team with what to change', () => {
  const text = '---\ntype: idea\nid: I-009\ntitle: A\nstatus: inbox\ntags:\n  - later\n---\nBody\n';
  const out = applyToText(text, changeFor({ status: 'inbox', tags: ['later'] }, 'regenerate', new Date('2026-10-17T23:00:00Z'), 'Make the stakes personal'));
  assert.match(out, /^status: regenerate$/m);
  assert.doesNotMatch(out, /later/);
  assert.match(out, /^decision_note: Make the stakes personal$/m);
  assert.match(out, /^decided: 2026-10-17T/m);
  assert.match(commitMessage({ type: 'idea', id: 'I-009', title: 'A' }, 'regenerate'), /^ideas: rewrite I-009 A/);
});

function copyDemo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-ideas-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  return dir;
}

const DEMO_IDEA = 'Series/Ember Road/Books/1 Ash Bell/Ideas/I-002 Open on the Ferry.md';

test('the index lists each book\'s ideas', async () => {
  const snap = await sync(new FsSource(DEMO), null);
  const book = snap.index.books[0];
  assert.ok(book.ideas && book.ideas.indexOf(DEMO_IDEA) >= 0);
  const p = piles(book.ideas!.map((x) => snap.index.notes[x]));
  assert.ok(p.decide.length >= 2 && p.later.length >= 1 && p.dropped.length >= 1);
});

const demoText = (p: string) => fs.readFileSync(path.join(DEMO, p), 'utf8');

test('a saved choice is made on the note as the vault has it, and made again if the note changed meanwhile', async () => {
  const src = new MemSource();
  src.files.set(DEMO_IDEA, demoText(DEMO_IDEA));
  src.race = () => { src.files.set(DEMO_IDEA, src.files.get(DEMO_IDEA)! + '\nKyle added a line in Obsidian.\n'); };
  const res = await pushAction(src, choiceAction([{ path: DEMO_IDEA, decision: 'drop', reason: 'Keep the dock.', at: NOW.toISOString() }]));
  assert.equal(res.saved[0].data.status, 'discard');
  assert.equal(res.saved[0].data.decision_note, 'Keep the dock.');
  assert.ok(src.files.get(DEMO_IDEA)!.endsWith('Kyle added a line in Obsidian.\n'), 'Kyle\'s edit is kept');
  assert.equal(src.commits.length, 1);
  assert.equal(src.builds, 2, 'planned again on the newer note');
});

test('a push keeps choices it could not send, and they show meanwhile', async () => {
  const src = new MemSource();
  src.files.set(DEMO_IDEA, demoText(DEMO_IDEA));
  let box = add([], choiceAction([{ path: DEMO_IDEA, decision: 'later', reason: '', at: NOW.toISOString() }]));
  box = add(box, choiceAction([{ path: DEMO_IDEA, decision: 'keep', reason: '', at: NOW.toISOString() }]));
  assert.equal(choicesOf(box).length, 1, 'the newer choice replaces the older');
  src.offline = true;
  const res = await pushAll(src, box);
  assert.deepEqual([res.saved.length, res.done, res.failed], [0, [], {}]);
  assert.match(res.error!, /Cannot reach GitHub/);
  const left = settle(box, res.done, res.failed, res.renames);
  assert.equal(left.length, 1);
  const snap = await sync(new FsSource(DEMO), null);
  assert.equal(overlayActions(snap.index, left).notes[DEMO_IDEA].data.status, 'keep');
  src.offline = false;
  const ok = await pushAll(src, left);
  assert.equal(settle(left, ok.done, ok.failed, ok.renames).length, 0);
  assert.equal(ok.saved[0].data.status, 'keep');
});

test('choices written into the demo vault still pass sf validate', { skip: !hasVault && 'author-business is not checked out beside this repository' }, async () => {
  const dir = copyDemo();
  const other = 'Series/Ember Road/Books/1 Ash Bell/Ideas/I-001 Tobin Lies.md';
  const src = new MemSource();
  [DEMO_IDEA, other].forEach((p) => src.files.set(p, demoText(p)));
  await pushAll(src, [
    choiceAction([{ path: DEMO_IDEA, decision: 'later', reason: 'After the outline: it, "settles" it.', at: NOW.toISOString() }]),
    choiceAction([{ path: other, decision: 'drop', reason: 'Too mean: Tobin is kind.', at: NOW.toISOString() }])
  ]);
  [DEMO_IDEA, other].forEach((p) => fs.writeFileSync(path.join(dir, p), src.files.get(p)!));
  assert.notEqual(src.files.get(other), demoText(other));
  const out = execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'validate'], {
    cwd: dir, env: { ...process.env, SF_VAULT: dir }, encoding: 'utf8'
  });
  assert.match(out, /no errors/, out);
});

test('GitHub write sends the file as UTF-8 base64 with the sha and branch, and reports a conflict', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  let status = 200;
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (init && init.method === 'PUT') {
      return status === 200 ? Response.json({ content: { sha: 'new-sha' } }) : new Response('{}', { status });
    }
    return Response.json({ sha: 'old-sha', encoding: 'base64', content: toBase64('---\ntitle: Café\n---\n').replace(/(.{8})/g, '$1\n') });
  };
  const src = new GitHubSource({ ...DEFAULTS, token: 't', root: 'vault' }, fn);
  const fresh = await src.readFresh('Series/A B/I-001 Café.md');
  assert.deepEqual(fresh, { text: '---\ntitle: Café\n---\n', sha: 'old-sha' });
  assert.equal(calls[0].url, 'https://api.github.com/repos/kylewrites33-cloud/author-business/contents/vault/Series/A%20B/I-001%20Caf%C3%A9.md?ref=main');
  assert.equal(await src.write('Series/A B/I-001 Café.md', 'é', 'old-sha', 'ideas: keep'), 'new-sha');
  const body = JSON.parse(String(calls[1].init!.body));
  assert.deepEqual(body, { message: 'ideas: keep', content: toBase64('é'), sha: 'old-sha', branch: 'main' });
  assert.equal(fromBase64(body.content), 'é');
  status = 409;
  await assert.rejects(src.write('x.md', 'y', 'old-sha', 'm'), (e: Error & { conflict?: boolean }) => e.conflict === true);
  status = 403;
  await assert.rejects(src.write('x.md', 'y', 'old-sha', 'm'), /not allowed to change/);
});

test('the schema has an Ideas board the app indexes', () => {
  const schema = parseSchema(fs.readFileSync(path.join(DEMO, 'System', 'schema.json'), 'utf8'));
  assert.deepEqual(schema.boards.ideas.types, ['idea']);
  assert.ok((schema.boards.ideas.phase ?? 1) <= PHASE);
});

test('an edit changes only the lines Kyle changed, one line each, and two unsaved edits join', async () => {
  const { editChange } = await import('../src/lib/ideas.ts');
  const text = '---\ntype: scene\nid: S-001\ntitle: A\nstatus: planned\norder: 1\nturn: Old turn\nhook: "Old: hook"\n---\nBody\n';
  const out = applyToText(text, editChange({ turn: 'New\nturn  here', hook: '', status: 'drafted' }));
  assert.equal(out, '---\ntype: scene\nid: S-001\ntitle: A\nstatus: drafted\norder: 1\nturn: New turn here\n---\nBody\n');
  let box = add([], choiceAction([{ path: 'a.md', decision: 'edit', reason: '', at: 'x', fields: { turn: 'T' } }]));
  box = add(box, choiceAction([{ path: 'a.md', decision: 'accept', reason: '', at: 'y' }]));
  box = add(box, choiceAction([{ path: 'a.md', decision: 'edit', reason: '', at: 'z', fields: { hook: 'H' } }]));
  const q = choicesOf(box);
  assert.equal(q.length, 2);
  assert.deepEqual(q.find((c) => c.decision === 'edit')!.fields, { turn: 'T', hook: 'H' });
  assert.match(commitMessage({ type: 'scene', id: 'S-001', title: 'A' }, 'edit'), /^scenes: edit S-001 A\n\nEdited on the Chapter Grid/);
});
