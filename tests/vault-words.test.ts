// The one saving system: the writing page's own saves. A scene's words go up as one save, merged with what changed
// elsewhere; a version that clashed with Kyle's is kept as a copy in that same save; a copy he asks for is one save.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as old from '../src/lib/drafts.ts';
import { flushDrafts, openDraft, putDraft, loadDrafts, type Draft } from '../src/lib/drafts.ts';
import { sync } from '../src/lib/sync.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import type { VaultIndex } from '../src/lib/types.ts';
import { editRecord, editText } from '../src/vault/apply.ts';
import { wordsAction } from '../src/vault/ops.ts';
import { pushAction } from '../src/vault/push.ts';
import { copyOp, saveDraft, saveSnapshot, saveWords } from '../src/vault/words.ts';
import { DEMO, FsSource, MemSource } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const SCENE = BOOK + '/Scenes/S-005 The Ledger.md';
const NOW = new Date('2026-11-11T15:00:00');

async function vault(): Promise<MemSource> {
  const fs2 = new FsSource(DEMO);
  const src = new MemSource();
  for (const f of (await fs2.tree()).files) if (f.path.endsWith('.md') || f.path.endsWith('.json')) src.files.set(f.path, await fs2.read(f.path));
  return src;
}
const indexOf = async (src: MemSource): Promise<VaultIndex> => (await sync(src, null)).index;
/** The same thing done the old way and the new way, each on its own copy of the vault. */
async function both(prepare: (src: MemSource, index: VaultIndex) => Promise<Draft> | Draft, then: (r: old.SaveResult, src: MemSource, way: 'old' | 'new') => void = () => undefined): Promise<{ was: MemSource; now: MemSource }> {
  const was = await vault(), now = await vault();
  const a = await old.saveDraft(was, await prepare(was, await indexOf(was)), NOW);
  then(a, was, 'old');
  const b = await saveDraft(now, await prepare(now, await indexOf(now)), NOW);
  then(b, now, 'new');
  assert.deepEqual([...now.files].sort(), [...was.files].sort(), 'the vault is as the old way left it');
  assert.deepEqual({ ...b.note, sha: '' }, { ...a.note, sha: '' });
  assert.equal(b.merged, a.merged);
  assert.equal(b.clash, a.clash);
  return { was, now };
}
const typed = (index: VaultIndex, path: string, change: (body: string) => string, more: Partial<Draft> = {}): Draft => {
  const d = openDraft(index.notes[path], undefined, NOW);
  return { ...d, body: change(d.body), ...more };
};

test('a scene\'s words: one save that changes the body and the word count and nothing else, as the old way wrote it', async () => {
  const { now } = await both((_s, index) => typed(index, SCENE, (b) => b.replace(/\s+$/, '') + '\n\nThe ferry did not come back.\n'));
  assert.equal(now.commits.length, 1);
  assert.deepEqual(now.commits[0].paths, [SCENE]);
  assert.match(now.commits[0].message, /^scenes: edit S-005 The Ledger\n\nWritten in the Sparrow app\.$/);
  assert.match(now.files.get(SCENE)!, /The ferry did not come back\.\n$/);
});

test('what Kyle set beside the words goes in the same save: status, target, and a headline cleared for the team to write again', async () => {
  await both((src, index) => {
    src.files.set(SCENE, src.files.get(SCENE)!.replace('\nstatus:', '\nheadline: An old line.\nstatus:'));
    return typed(index, SCENE, (b) => b + 'More.\n', { status: 'revised', target: 1800, freshHeadline: true });
  }, (r) => {
    assert.equal(r.note.data.status, 'revised');
    assert.equal(r.note.data.target_words, 1800);
    assert.equal(r.note.data.headline, undefined);
  });
});

test('a scene that changed elsewhere on other lines: both sets of changes are in it, in one save', async () => {
  const { now } = await both((src, index) => {
    const d = typed(index, SCENE, (b) => b.replace(/\s+$/, '') + '\n\nA last line from the desk.\n');
    // The iPad changed the first paragraph meanwhile.
    const text = src.files.get(SCENE)!;
    const first = index.notes[SCENE].body.split('\n').find((l) => l.trim())!;
    src.files.set(SCENE, text.replace(first, first + ' And the iPad added this.'));
    return d;
  }, (r) => { assert.equal(r.merged, true); assert.equal(r.clash, null); });
  assert.equal(now.commits.length, 1);
  assert.match(now.files.get(SCENE)!, /And the iPad added this\./);
  assert.match(now.files.get(SCENE)!, /A last line from the desk\./);
});

test('the same lines changed in two places: Kyle\'s are saved and the other version is kept as a copy, in one save where it took two', async () => {
  const { was, now } = await both((src, index) => {
    const first = index.notes[SCENE].body.split('\n').find((l) => l.trim())!;
    const d = typed(index, SCENE, (b) => b.replace(first, first + ' Mine.'));
    src.files.set(SCENE, src.files.get(SCENE)!.replace(first, first + ' Theirs.'));
    return d;
  }, (r) => { assert.equal(r.clash, BOOK + '/Snapshots/S-005 v1 (changed elsewhere).md'); });
  assert.equal(was.writes.length, 2, 'two saves the old way');
  assert.equal(now.commits.length, 1);
  assert.deepEqual(now.commits[0].paths.slice().sort(), [SCENE, BOOK + '/Snapshots/S-005 v1 (changed elsewhere).md'].sort());
  assert.match(now.files.get(SCENE)!, / Mine\./);
  assert.match(now.files.get(BOOK + '/Snapshots/S-005 v1 (changed elsewhere).md')!, / Theirs\./);
});

test('a chapter\'s first beats start their note; made elsewhere a moment before, both are kept', async () => {
  const path = BOOK + '/Chapter Beats/Chapter 3 beats.md';
  const create = '---\ntype: chapter-beats\ntitle: Chapter 3 beats\nchapter: 3\n---\n';
  const draft = (): Draft => ({ path, baseSha: '', baseBody: '', body: '\n## The ledger\nShe finds it.\n', target: null, startWords: 0, updatedAt: NOW.toISOString(), pending: false, create });
  const { now } = await both((src) => { src.files.delete(path); return draft(); });
  assert.equal(now.files.get(path), create + '\n## The ledger\nShe finds it.\n');
  assert.match(now.commits[0].message, /^beats: add Chapter 3 beats\n/);
  // The team wrote beats for the chapter meanwhile: nothing of theirs or of Kyle's is lost.
  const two = await both((src) => { src.files.set(path, create + '\n## Theirs\nOther beats.\n'); return draft(); });
  const kept = [...two.now.files].filter(([p]) => p === path || p.startsWith(BOOK + '/Snapshots/')).map(([, text]) => text).join('\n');
  assert.match(kept, /## The ledger\nShe finds it\./);
  assert.match(kept, /## Theirs\nOther beats\./);
});

test('a scene that is gone from the vault stops the save with a plain sentence, and nothing is saved', async () => {
  const src = await vault();
  const d = typed(await indexOf(src), SCENE, (b) => b + 'More.\n');
  src.files.delete(SCENE);
  await assert.rejects(saveDraft(src, d, NOW), /S-005 The Ledger is not in the vault any more: .* Your words are still on this device\./);
  assert.equal(src.commits.length, 0);
});

test('the answer lost on the way back: sending the same words again changes nothing', async () => {
  const src = await vault();
  const d = typed(await indexOf(src), SCENE, (b) => b + 'More.\n');
  await saveDraft(src, d, NOW);
  const r = await saveDraft(src, d, NOW);
  assert.equal(src.commits.length, 1);
  assert.equal(r.merged, false);
  assert.equal(r.note.body, d.body);
});

test('the words edit on screen equals its saved text', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const d = typed(index, SCENE, (b) => b + 'More.\n', { status: 'revised', target: 900 });
  const edit = wordsAction(SCENE, d, [], NOW).ops[0];
  assert.ok(edit.kind === 'edit');
  const text = src.files.get(SCENE)!;
  const next = editText(text, edit.edit);
  assert.notEqual(next, text);
  assert.deepEqual(editRecord(makeNote(SCENE, 'x', text), edit.edit), makeNote(SCENE, 'x', next));
});

test('a copy Kyle asks for is one save, numbered after the copies the vault has, as the old way wrote it', async () => {
  const was = await vault(), now = await vault();
  const note = (await indexOf(now)).notes[SCENE];
  for (const label of ['before the big cut', 'Kyle: (try) two']) {
    const a = await old.saveSnapshot(was, note, note.body, label, NOW);
    const b = await saveSnapshot(now, note, note.body, label, NOW);
    assert.equal(b, a);
  }
  assert.deepEqual([...now.files].sort(), [...was.files].sort());
  assert.equal(now.commits.length, 2);
  assert.deepEqual(now.commits.map((c) => c.message.split('\n')[0]), ['snapshot: S-005 v1 (before the big cut)', 'snapshot: S-005 v2 (Kyle try two)']);
  // Another device took the next number while this copy was on its way: it takes the one after.
  const op = copyOp(note, 'Words.\n', 'again', NOW, (await now.tree()).files);
  now.files.set(BOOK + '/Snapshots/S-005 v3 (elsewhere).md', 'x');
  const res = await pushAction(now, { id: 'c', at: NOW.toISOString(), ops: [op] });
  assert.equal(res.renames[op.path], BOOK + '/Snapshots/S-005 v4 (again).md');
});

test('a copy and the words go up in one save when they belong together', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const d = typed(index, SCENE, (b) => b + 'More.\n');
  const r = await saveWords(src, d, NOW, [copyOp(index.notes[SCENE], index.notes[SCENE].body, 'before', NOW)]);
  assert.equal(src.commits.length, 1);
  assert.deepEqual(src.commits[0].paths.slice().sort(), [SCENE, BOOK + '/Snapshots/S-005 v1 (before).md'].sort());
  assert.equal(r.note.body, d.body);
});

test('words finished with no connection go up through the same save when it is back', async () => {
  const m = new Map<string, string>();
  const s = { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } } as unknown as Storage;
  const src = await vault();
  const d = typed(await indexOf(src), SCENE, (b) => b + 'Typed on the train.\n', { pending: true });
  putDraft(src.key, SCENE, d, s);
  const res = await flushDrafts(src, src.key, NOW, s, saveDraft);
  assert.equal(res.error, null);
  assert.equal(res.saved.length, 1);
  assert.equal(src.commits.length, 1);
  assert.deepEqual(loadDrafts(src.key, s), {});
  assert.match(src.files.get(SCENE)!, /Typed on the train\./);
});

// ---- split and join ----

import { archiveForJoin, archivePath, joinedBody, noteJoinForTeam, removeJoined, splitAt, splitOff } from '../src/lib/scenes.ts';
import { splitLead } from '../src/lib/drafts.ts';
import { foldSaved } from '../src/vault/apply.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { joinWords, splitWords } from '../src/vault/words.ts';
import { demoSchemaText } from './helpers.ts';

const schema = parseSchema(demoSchemaText());
const bookOf = (index: VaultIndex) => index.books.find((b) => b.folder === BOOK)!;

test('a split is one save where it took three: the copy, the new scene and this scene, as the old way left them', async () => {
  const plan = (index: VaultIndex) => {
    const scenes = bookOf(index).scenes.map((p) => index.notes[p]);
    const at = scenes.findIndex((n) => n.path === SCENE);
    const note = scenes[at], next = scenes[at + 1] || null;
    const d = typed(index, SCENE, (b) => b.replace(/\s+$/, '') + '\n\nTyped just before the split.\n');
    const { lead, text } = splitLead(d.body);
    const parts = splitAt(text, text.indexOf('\n\n', 20) + 2);
    return { note, next, d, lead, parts };
  };
  const was = await vault();
  const a = plan(await indexOf(was));
  const made = await splitOff(was, a.note, a.next, a.d.body, a.parts.after, 'The Second Half', BOOK, NOW);
  await old.saveDraft(was, { ...a.d, body: a.lead + a.parts.before, freshHeadline: true }, NOW);
  assert.equal(was.writes.length, 3, 'three saves the old way');

  const now = await vault();
  const index = await indexOf(now);
  const b = plan(index);
  const r = await splitWords(now, b.note, b.next, b.d, b.lead + b.parts.before, b.parts.after, 'The Second Half', BOOK, NOW);
  assert.equal(now.commits.length, 1);
  assert.deepEqual(now.commits[0].paths.slice().sort(), [SCENE, made.path, BOOK + '/Snapshots/S-005 v1 (before split).md'].sort());
  assert.match(now.commits[0].message, /^scenes: add S-\d+ The Second Half\n\nSaved together with:\n- snapshot: S-005 v1 \(before split\)\n- scenes: edit S-005 The Ledger\n\nSplit from S-005 The Ledger in the Sparrow app\.$/);
  assert.deepEqual([...now.files].sort(), [...was.files].sort(), 'the vault is as the old way left it');
  assert.equal(r.created.path, made.path);
  assert.equal(r.created.body.trim(), b.parts.after.trim());
  assert.match(now.files.get(BOOK + '/Snapshots/S-005 v1 (before split).md')!, /Typed just before the split\./);
  // No word is in both scenes or in neither.
  assert.equal(splitLead(r.note.body).text.trim() + '\n\n' + r.created.body.trim(), splitLead(b.d.body).text.trim());
  // The chapter list follows from the save's answer.
  const folded = foldSaved(index, [r.note, r.created], schema);
  assert.deepEqual(bookOf(folded).scenes, bookOf(await indexOf(now)).scenes);
});

test('a split that cannot be saved changes nothing', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const d = typed(index, SCENE, (b) => b);
  const before = [...src.files];
  src.files.delete(SCENE);
  const left = [...src.files];
  await assert.rejects(splitWords(src, index.notes[SCENE], null, d, 'First.\n', 'Second.\n', 'Half', BOOK, NOW), /is not in the vault any more/);
  assert.equal(src.commits.length, 0);
  assert.deepEqual([...src.files], left);
  assert.ok(before.length > left.length);
});

test('a join is one save where it took four: both sets of words, the joined scene in the Archive, the team\'s note', async () => {
  const plan = (index: VaultIndex) => {
    const scenes = bookOf(index).scenes.map((p) => index.notes[p]);
    const at = scenes.findIndex((n) => n.path === SCENE);
    return { note: scenes[at], next: scenes[at + 1], d: typed(index, SCENE, (b) => b.replace(/\s+$/, '') + '\n\nTyped just before the join.\n') };
  };
  const was = await vault();
  const a = plan(await indexOf(was));
  const taken = await archiveForJoin(was, a.note, a.next, NOW);
  await old.saveDraft(was, { ...a.d, body: joinedBody(a.d.body, taken.body), freshHeadline: true }, NOW);
  await removeJoined(was, a.next, taken.sha, 'S-005 The Ledger');
  await noteJoinForTeam(was, BOOK, a.next, a.note, [], NOW);
  assert.equal(was.writes.length, 4, 'four saves the old way');

  const now = await vault();
  const index = await indexOf(now);
  const b = plan(index);
  const joined = joinedBody(b.d.body, b.next.body);
  const r = await joinWords(now, b.note, b.next, b.d, joined, b.next.body, [], BOOK, NOW);
  assert.equal(now.commits.length, 1);
  assert.equal(now.commits[0].paths.length, 4);
  assert.match(now.commits[0].message, /^scenes: join S-006 .* into S-005 The Ledger\n\nSaved together with:\n- scenes: edit S-005 The Ledger\n/);
  assert.deepEqual([...now.files].sort(), [...was.files].sort(), 'the vault is as the old way left it');
  assert.equal(r.told, true);
  assert.equal(r.note.body, joined);
  assert.ok(now.files.has(archivePath(b.next.path)) && !now.files.has(b.next.path));
  // The chapter list and the Archive follow from the save's answer.
  const res = await vault();
  const again = await pushAction(res, { id: 'j', at: NOW.toISOString(), ops: [
    { kind: 'join', path: b.next.path, into: SCENE, book: BOOK, body: b.next.body, mentions: [], at: NOW.toISOString() },
    wordsAction(SCENE, { ...b.d, body: joined, freshHeadline: true }, [], NOW).ops[0]
  ] });
  const folded = foldSaved(index, again.saved, schema, again.removed, again.texts);
  const fresh = await indexOf(res);
  assert.deepEqual(bookOf(folded).scenes, bookOf(fresh).scenes);
  assert.ok((bookOf(folded).archive || []).some((f) => f.path === archivePath(b.next.path)));
});

test('a join stops, with nothing saved, when the next scene changed after its words were taken', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const scenes = bookOf(index).scenes.map((p) => index.notes[p]);
  const at = scenes.findIndex((n) => n.path === SCENE);
  const note = scenes[at], next = scenes[at + 1];
  const d = typed(index, SCENE, (b) => b);
  src.files.set(next.path, src.files.get(next.path)! + '\nA line the iPad added a moment ago.\n');
  await assert.rejects(joinWords(src, note, next, d, joinedBody(d.body, next.body), next.body, [], BOOK, NOW), /changed somewhere else a moment ago, so it was not joined\. Press Join again/);
  assert.equal(src.commits.length, 0);
  assert.ok(src.files.has(next.path));
});

test('a joined scene never writes over an older archived copy of the same name', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const scenes = bookOf(index).scenes.map((p) => index.notes[p]);
  const at = scenes.findIndex((n) => n.path === SCENE);
  const note = scenes[at], next = scenes[at + 1];
  src.files.set(archivePath(next.path), 'an older archived copy');
  const d = typed(index, SCENE, (b) => b);
  await joinWords(src, note, next, d, joinedBody(d.body, next.body), next.body, [], BOOK, NOW);
  assert.equal(src.files.get(archivePath(next.path)), 'an older archived copy');
  assert.ok(src.files.has(archivePath(next.path).replace(/\.md$/, ' (2).md')));
});
