import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  bodyWords, flushDrafts, isUnsaved, withoutProperty, listSnapshots, loadDrafts, openDraft, pendingCount, putDraft, saveDraft, saveSnapshot,
  sceneWords, snapshotFolder, splitLead, withBody, type Draft
} from '../src/lib/drafts.ts';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { GitHubSource } from '../src/lib/github.ts';
import { renderProse } from '../scripts/sync-parser.js';
import { makeNote } from '../src/lib/vault-index.ts';
import { hasVault, MemSource, ROOT, VAULT } from './helpers.ts';

const SCENE = 'Series/Ember Road/Books/1 Ash Bell/Scenes/S-002 The Ferry.md';
const TEXT = [
  '---',
  'type: scene',
  'id: S-002',
  'title: The Ferry',
  'status: drafted',
  'order: 2',
  'cast:',
  '  - "[[Mara Quill]]"',
  'words: 3',
  '---',
  '',
  'Mara cut rope.',
  '',
  '> [!plan] Team notes',
  '> Not counted.',
  ''
].join('\n');

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const store = () => new MemStorage() as unknown as Storage;

function draftOf(src: MemSource, body: string): Draft {
  const n = makeNote(SCENE, src.sha(TEXT), TEXT);
  return { ...openDraft(n, undefined, new Date()), body };
}

test('words are counted as sf counts them: callouts left out, nothing while planned', () => {
  const n = makeNote(SCENE, 'x', TEXT);
  assert.equal(bodyWords(n.body), 3);
  assert.equal(sceneWords('planned', n.body), 0);
  assert.equal(sceneWords('drafted', n.body), 3);
});

test('a new body keeps every property line byte for byte and updates only the lines asked for', () => {
  const out = withBody(TEXT, '\nNew words here now.\n', { words: 4 });
  const before = TEXT.split('\n---\n')[0].replace('words: 3', 'words: 4');
  assert.equal(out, before + '\n---\n\nNew words here now.\n');
  assert.throws(() => withBody('---\na: [\n---\nx', 'y'), /cannot be read/);
});

test('the editor hides and restores the blank line after the properties', () => {
  assert.deepEqual(splitLead('\nMara.'), { lead: '\n', text: 'Mara.' });
  assert.deepEqual(splitLead('Mara.'), { lead: '', text: 'Mara.' });
});

test('a draft carries on where Kyle left it, unless it holds nothing unsaved and the scene has changed', () => {
  const n = makeNote(SCENE, 'a', TEXT);
  const d = openDraft(n, undefined, new Date());
  const typed = { ...d, body: d.body + 'More.' };
  assert.equal(openDraft({ ...n, sha: 'b' }, typed, new Date()), typed);
  const clean = openDraft({ ...n, sha: 'b' }, d, new Date());
  assert.equal(clean.baseSha, 'b');
});

test('saving writes the body and word count as one commit with no Agent trailer', async () => {
  const src = new MemSource();
  src.files.set(SCENE, TEXT);
  const r = await saveDraft(src, draftOf(src, '\nMara cut the rope at 6:14.\n'), new Date());
  assert.equal(r.clash, null);
  const saved = src.files.get(SCENE)!;
  assert.match(saved, /^words: 7$/m);
  assert.match(saved, /cast:\n {2}- "\[\[Mara Quill\]\]"/);
  assert.equal(src.writes.length, 1);
  assert.equal(src.writes[0].message, 'scenes: edit S-002 The Ferry\n\nWritten in the Story Forge app.');
  assert.doesNotMatch(src.writes[0].message, /Agent:/);
  assert.equal(r.note.body, '\nMara cut the rope at 6:14.\n');
});

test('after a split or join the save clears the scene\'s headline so the team writes a new one', async () => {
  const src = new MemSource();
  src.files.set(SCENE, TEXT.replace('title: The Ferry\n', 'title: The Ferry\nheadline: Mara cuts the rope.\n'));
  const d = { ...draftOf(src, '\nMara cut rope.\n'), freshHeadline: true };
  assert.equal(isUnsaved(d), true);
  await saveDraft(src, d, new Date());
  const saved = src.files.get(SCENE)!;
  assert.doesNotMatch(saved, /headline/);
  assert.match(saved, /^title: The Ferry\nstatus: drafted$/m);
  assert.equal(withoutProperty(saved, 'headline'), saved);
});

test('when the scene changed elsewhere, Kyle\'s version wins and the other one is kept as a snapshot', async () => {
  const src = new MemSource();
  src.files.set(SCENE, TEXT);
  const d = draftOf(src, '\nKyle wrote this.\n');
  src.files.set(SCENE, TEXT.replace('Mara cut rope.', 'The Writer revised this.'));
  const r = await saveDraft(src, d, new Date(2026, 9, 17, 21, 40));
  const snap = 'Series/Ember Road/Books/1 Ash Bell/Snapshots/S-002 v1 (changed elsewhere).md';
  assert.equal(r.clash, snap);
  const kept = Frontmatter.parse(src.files.get(snap)!);
  assert.equal(kept.data.type, 'snapshot');
  assert.equal(kept.data.of, SCENE);
  assert.equal(kept.data.version, 1);
  assert.equal(kept.data.taken, '2026-10-17T21:40');
  assert.match(kept.body, /The Writer revised this\./);
  assert.match(src.files.get(SCENE)!, /Kyle wrote this\./);
  assert.deepEqual(src.writes.map((w) => w.path), [snap, SCENE]);
});

test('snapshots number on from the ones already in the book\'s Snapshots folder', async () => {
  const src = new MemSource();
  src.files.set(SCENE, TEXT);
  const dir = snapshotFolder(SCENE);
  assert.equal(dir, 'Series/Ember Road/Books/1 Ash Bell/Snapshots');
  src.files.set(dir + '/S-002 v1 (agent).md', '---\ntype: snapshot\n---\nold');
  src.files.set(dir + '/S-020 v4 (agent).md', 'other scene');
  const n = makeNote(SCENE, 'x', TEXT);
  const dest = await saveSnapshot(src, n, n.body, 'before / the: cut', new Date());
  assert.equal(dest, dir + '/S-002 v2 (before the cut).md');
  const list = await listSnapshots(src, n);
  assert.deepEqual(list.map((s) => [s.version, s.label]), [[2, 'before the cut'], [1, 'agent']]);
});

test('drafts finished offline wait on the device and save when the connection is back', async () => {
  const src = new MemSource();
  src.files.set(SCENE, TEXT);
  const st = store();
  putDraft('mem', SCENE, { ...draftOf(src, '\nWritten on the train.\n'), pending: true }, st);
  assert.equal(pendingCount('mem', st), 1);
  src.offline = true;
  assert.deepEqual(await flushDrafts(src, 'mem', new Date(), st), { saved: [], error: null });
  assert.equal(pendingCount('mem', st), 1);
  src.offline = false;
  const r = await flushDrafts(src, 'mem', new Date(), st);
  assert.equal(r.saved.length, 1);
  assert.equal(pendingCount('mem', st), 0);
  assert.deepEqual(loadDrafts('mem', st), {});
  assert.match(src.files.get(SCENE)!, /Written on the train\./);
});

test('GitHub adds a new file without a sha, and a name already taken is a conflict', async () => {
  const calls: { body: Record<string, unknown> }[] = [];
  let status = 201;
  const src = new GitHubSource({ owner: 'o', repo: 'r', branch: 'main', root: '', token: 't' }, async (_url, init) => {
    calls.push({ body: JSON.parse(String(init && init.body)) });
    return status === 201 ? Response.json({ content: { sha: 'new' } }, { status }) : new Response('', { status });
  });
  assert.equal(await src.write('Snapshots/S-001 v1 (copy).md', 'x', '', 'snapshot'), 'new');
  assert.equal('sha' in calls[0].body, false);
  status = 422;
  await assert.rejects(src.write('Snapshots/S-001 v1 (copy).md', 'x', '', 'snapshot'), (e: Error & { conflict?: boolean }) => e.conflict === true);
});

test('the prose copy matches the sf tool in the vault', { skip: !hasVault && 'author-business is not checked out beside this repository' }, () => {
  const sf = fs.readFileSync(path.join(VAULT, 'System', 'Tools', 'sf.js'), 'utf8');
  const copy = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'prose.js'), 'utf8');
  assert.equal(copy, renderProse(sf), 'src/lib/prose.js differs from sf.js. Run npm run sync-parser.');
});
