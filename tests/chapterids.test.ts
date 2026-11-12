// Chapters have their own ID (redesign step 5): reading a chapter note's chapter from its ID, and the IDs a save writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { planChapterIds, resolveChapters, withChapterId, type IdNote } from '../src/lib/chapterids.ts';
import { sync } from '../src/lib/sync.ts';
import type { NoteRecord, VaultIndex } from '../src/lib/types.ts';
import { chaptersAction, choiceAction, createAction } from '../src/vault/ops.ts';
import { pushAction, pushAll } from '../src/vault/push.ts';
import { DEMO, FsSource, hasVault, MemSource, VAULT } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const AT = '2026-11-12T21:00:00.000Z';
const N = (path: string, type: string, chapter: number | null, id = '', touched = false): IdNote => ({ path, type, chapter, id, touched });
const rec = (path: string, type: string, data: Record<string, unknown>): NoteRecord => ({ path: BOOK + '/' + path, sha: 'x', type, data: { type, ...data }, body: '', error: null });

async function vault(): Promise<MemSource> {
  const disk = new FsSource(DEMO);
  const src = new MemSource();
  for (const f of (await disk.tree()).files) if (f.path.endsWith('.md') || f.path.endsWith('.json')) src.files.set(f.path, await disk.read(f.path));
  src.writes = [];
  return src;
}
const indexOf = async (src: MemSource): Promise<VaultIndex> => (await sync(src, null)).index;
const line = (src: MemSource, file: string, key: string): string => (new RegExp('^' + key + ': (.*)$', 'm').exec(src.files.get(BOOK + '/' + file) || '') || ['', ''])[1];
const files = (index: VaultIndex) => Object.keys(index.notes).map((p) => ({ path: p, sha: '' }));

test('a chapter note is read by its ID: the number written on it is only a label', () => {
  const notes = [
    rec('Scenes/S-001 A.md', 'scene', { chapter: 2, chapter_id: 'CH-001' }),
    rec('Scenes/S-002 B.md', 'scene', { chapter: 1, chapter_id: 'CH-002' }),
    rec('Changes/Chapter 1 changes.md', 'chapter-changes', { chapter: 1, chapter_id: 'CH-001' }),
    rec('Tasks/T-001 x.md', 'task', { chapter: 1, chapter_id: 'CH-002' }),
    rec('Tasks/T-002 y.md', 'task', { chapter: 1 }),
    rec('Tasks/T-003 z.md', 'task', { chapter: 7, chapter_id: 'CH-009' })
  ];
  const out = resolveChapters(notes);
  assert.deepEqual(out.map((n) => n.data.chapter), [2, 1, 2, 1, 1, 7]);
  // Only the one that read wrong is a new object; the stored note is not changed.
  assert.equal(notes[2].data.chapter, 1);
  assert.ok(out[3] === notes[3] && out[4] === notes[4] && out[5] === notes[5]);
  // Nothing to do: the same list back. A map of notes works the same way.
  const right = notes.slice(0, 2);
  assert.equal(resolveChapters(right), right);
  const byPath = Object.fromEntries(notes.map((n) => [n.path, n]));
  assert.equal(resolveChapters(byPath)[notes[2].path].data.chapter, 2);
});

test('a book with no chapter IDs is left alone', () => {
  assert.equal(planChapterIds([N('a', 'scene', 1, '', true), N('b', 'scene', 2)], [N('t', 'task', 1, '', true)]).size, 0);
});

test('a new scene takes its chapter\'s ID; a new chapter gets the next number no chapter has had', () => {
  const book = [N('a', 'scene', 1, 'CH-001'), N('b', 'scene', 2, 'CH-004')];
  assert.deepEqual([...planChapterIds(book.concat(N('new', 'scene', 2, '', true)), [])], [['new', 'CH-004']]);
  assert.deepEqual([...planChapterIds(book.concat(N('new', 'scene', 3, '', true)), [N('t', 'task', 3, '', true)])], [['new', 'CH-005'], ['t', 'CH-005']]);
  // A number only a note outside the scenes has had is not handed out again.
  assert.deepEqual([...planChapterIds(book.concat(N('new', 'scene', 3, '', true)), [], ['CH-009'])], [['new', 'CH-010']]);
});

test('a scene moved into another chapter takes that chapter\'s ID, even when it is the bigger half', () => {
  const p = planChapterIds([N('a', 'scene', 1, 'CH-001'), N('b', 'scene', 2, 'CH-002'), N('m1', 'scene', 2, 'CH-001', true), N('m2', 'scene', 2, 'CH-001', true)], []);
  assert.deepEqual([...p], [['m1', 'CH-002'], ['m2', 'CH-002']]);
});

test('chapters that only change their numbers keep their IDs, and notes with an ID keep theirs', () => {
  const scenes = [N('a', 'scene', 2, 'CH-001', true), N('b', 'scene', 1, 'CH-002', true)];
  assert.equal(planChapterIds(scenes, [N('c', 'chapter-changes', 2, 'CH-001', true), N('old', 'task', 1, 'CH-001', true)]).size, 0);
});

test('the ID line goes under the chapter line and no other line changes', () => {
  const text = '---\ntype: scene\nid: S-001\nchapter: 7\nchapter_title: "A: b"\n---\nBody with chapter: 9 in it.\n';
  const out = withChapterId(text, 'CH-007');
  assert.equal(out, text.replace('chapter: 7\n', 'chapter: 7\nchapter_id: CH-007\n'));
  assert.equal(withChapterId(out, 'CH-012'), out.replace('CH-007', 'CH-012'));
  assert.equal(withChapterId('No properties.\n', 'CH-001'), 'No properties.\n');
});

test('moving a chapter: every note keeps its chapter ID and follows by it', async () => {
  const src = await vault();
  const index = await indexOf(src);
  assert.equal(line(src, 'Changes/Chapter 1 changes.md', 'chapter_id'), 'CH-001');
  await pushAction(src, chaptersAction(BOOK, { type: 'move', from: 1, to: 3 }, 'Why.'), { known: index.notes });
  assert.equal(line(src, 'Changes/Chapter 3 changes.md', 'chapter_id'), 'CH-001');
  assert.equal(line(src, 'Scenes/S-001 The Crack.md', 'chapter'), '3');
  assert.equal(line(src, 'Scenes/S-001 The Crack.md', 'chapter_id'), 'CH-001');
  assert.equal(line(src, 'Scenes/S-005 The Ledger.md', 'chapter'), '2');
  assert.equal(line(src, 'Scenes/S-005 The Ledger.md', 'chapter_id'), 'CH-003');
});

test('a note written with an old chapter number still shows with its chapter', async () => {
  const src = await vault();
  // The team wrote chapter 1's changes while chapter 1 was being moved to chapter 3: the label is stale, the ID is right.
  await pushAction(src, chaptersAction(BOOK, { type: 'move', from: 1, to: 3 }, 'Why.'), { known: (await indexOf(src)).notes });
  const p = BOOK + '/Changes/Chapter 3 changes.md';
  src.files.set(p, src.files.get(p)!.replace(/^chapter: 3$/m, 'chapter: 1'));
  const index = await indexOf(src);
  assert.equal(index.notes[p].data.chapter, 3);
});

test('a new scene, a new to-do and two new chapters made offline each get the right chapter ID', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const scene = (title: string, chapter: number, order: number) => ({ s: { bookFolder: BOOK, title, chapter, chapterTitle: '', order, status: 'drafted', body: '' }, at: AT });
  const known = files(index);
  const a = createAction('scene', scene('Into two', 2, 4.5), known, new Date(AT));
  const b = createAction('todo', { book: BOOK, t: { title: 'Fix the rope', chapter: 3, scene: '' }, at: AT }, known, new Date(AT));
  const c = createAction('scene', scene('Chapter 5', 5, 20), known.concat({ path: a.ops[0].path, sha: '' }), new Date(AT));
  const d = createAction('scene', scene('Chapter 6', 6, 21), known.concat({ path: a.ops[0].path, sha: '' }, { path: c.ops[0].path, sha: '' }), new Date(AT));
  // One at a time, as the outbox sends them when a group will not go together.
  for (const x of [a, b, c, d]) {
    const res = await pushAll(src, [x], { known: (await indexOf(src)).notes });
    assert.deepEqual(res.done, [x.id]);
  }
  const text = (op: { path: string }) => src.files.get(op.path)!;
  assert.match(text(a.ops[0]), /^chapter: 2\nchapter_id: CH-002$/m);
  assert.match(text(b.ops[0]), /^chapter: 3\nchapter_id: CH-003$/m);
  assert.match(text(c.ops[0]), /^chapter: 5\nchapter_id: CH-005$/m);
  assert.match(text(d.ops[0]), /^chapter: 6\nchapter_id: CH-006$/m);
});

test('two new chapters in one push get two IDs', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const scene = (title: string, chapter: number, order: number) => ({ s: { bookFolder: BOOK, title, chapter, chapterTitle: '', order, status: 'drafted', body: '' }, at: AT });
  const a = createAction('scene', scene('Chapter 5', 5, 20), files(index), new Date(AT));
  const b = createAction('scene', scene('Chapter 6', 6, 21), files(index).concat({ path: a.ops[0].path, sha: '' }), new Date('2026-11-12T21:00:01.000Z'));
  const res = await pushAll(src, [a, b], { known: index.notes });
  assert.equal(res.done.length, 2);
  assert.match(src.files.get(a.ops[0].path)!, /^chapter_id: CH-005$/m);
  assert.match(src.files.get(b.ops[0].path)!, /^chapter_id: CH-006$/m);
});

test('typing in a scene never asks about chapter IDs', async () => {
  const src = await vault();
  const p = BOOK + '/Scenes/S-005 The Ledger.md';
  const was = src.files.get(p)!;
  // The scene's ID is taken off behind the app's back; a save that does not touch the chapter leaves that alone.
  src.files.set(p, was.replace('chapter_id: CH-003\n', ''));
  await pushAction(src, choiceAction([{ path: p, decision: 'edit', reason: '', at: AT, fields: { headline: 'A new headline' } }]));
  assert.ok(!/chapter_id/.test(src.files.get(p)!));
});

test('the demo vault has its chapter IDs, by the vault\'s own tool', { skip: !hasVault && 'the vault is not beside this repository' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-chids-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  const out = execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'chapter-ids.mjs'), path.join(dir, BOOK), '--check'], { encoding: 'utf8' });
  assert.match(out, /every note has its chapter ID/);
});
