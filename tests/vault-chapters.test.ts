// The one saving system, chapters: a new scene by its maker, and a book's chapters renumbered as one save.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moveMap, roomMap } from '../src/lib/chapters.ts';
import { loadDrafts, moveDrafts, putDraft, type Draft } from '../src/lib/drafts.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { sync } from '../src/lib/sync.ts';
import { compareScenes } from '../src/lib/vault-index.ts';
import type { NoteRecord, VaultIndex } from '../src/lib/types.ts';
import { toNumber } from '../src/lib/links.ts';
import { foldSaved, overlayActions } from '../src/vault/apply.ts';
import { chaptersAction, createAction, deleteAction, restoreAction, type Action } from '../src/vault/ops.ts';
import { add, loadOutbox, saveOutbox } from '../src/vault/outbox.ts';
import { pushAction, pushAll } from '../src/vault/push.ts';
import { DEMO, demoSchemaText, FsSource, hasVault, leaves, MemSource, VAULT } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const AT = '2026-11-11T16:00:00.000Z';
const schema = parseSchema(demoSchemaText());

/** The demo vault in memory, with a few more notes named after their chapter, so renames meet each other. */
async function vault(): Promise<MemSource> {
  const fs2 = new FsSource(DEMO);
  const src = new MemSource();
  for (const f of (await fs2.tree()).files) if (f.path.endsWith('.md') || f.path.endsWith('.json')) src.files.set(f.path, await fs2.read(f.path));
  const named = (dir: string, ch: number, what: string, type: string, body: string) =>
    src.files.set(BOOK + '/' + dir + '/Chapter ' + ch + ' ' + what + '.md', '---\ntype: ' + type + '\ntitle: Chapter ' + ch + ' ' + what + '\nchapter: ' + ch + '\n---\n\n' + body + '\n');
  named('Chapter Beats', 2, 'beats', 'chapter-beats', '## Open\nBeats of two.');
  named('Chapter Beats', 3, 'beats', 'chapter-beats', '## Open\nBeats of three.');
  named('Chapter Plans', 3, 'plan', 'chapter-plan', 'Plan of three.');
  named('Changes', 2, 'changes', 'chapter-changes', 'Changes of two.');
  named('Changes', 4, 'changes', 'chapter-changes', 'Changes of four.');
  const book = src.files.get(BOOK + '/Book.md')!;
  src.files.set(BOOK + '/Book.md', book.replace(/^---\n/, '---\nrewrite_done: [1, 3]\n'));
  src.writes = [];
  return src;
}
const indexOf = async (src: MemSource): Promise<VaultIndex> => (await sync(src, null)).index;
const scenesOf = (index: VaultIndex): NoteRecord[] => index.books.find((b) => b.folder === BOOK)!.scenes.map((p) => index.notes[p]);
const chapterOf = (src: MemSource, file: string) => Number(/^chapter: (\d+)$/m.exec(src.files.get(BOOK + '/' + file)!)![1]);
const sceneTitled = (index: VaultIndex, title: string) => scenesOf(index).find((n) => n.data.title === title);
const newScene = (title: string, chapter: number, order: number) => ({ s: { bookFolder: BOOK, title, chapter, chapterTitle: '', order, status: 'drafted', body: '' }, at: AT });
const known = (index: VaultIndex) => Object.keys(index.notes).map((path) => ({ path, sha: '' }));

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const store = () => new MemStorage() as unknown as Storage;

// ---- a new scene ----

test('a new scene shows at once in its book, in reading order, before it is saved, and waits across closing the app', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const last = scenesOf(index)[scenesOf(index).length - 1];
  const a = createAction('scene', newScene('Chapter 5', 5, Number(last.data.order) + 1), known(index), new Date(AT));
  assert.match(a.ops[0].path, /\/Scenes\/S-009 Chapter 5\.md$/);
  const shown = overlayActions(index, [a], schema);
  const scenes = scenesOf(shown);
  assert.equal(scenes.length, scenesOf(index).length + 1);
  assert.equal(scenes[scenes.length - 1].path, a.ops[0].path);
  assert.equal(scenes[scenes.length - 1].data.chapter, 5);
  assert.equal(scenes[scenes.length - 1].body.trim(), '');
  const s = store();
  saveOutbox('k', add([], a), s);
  assert.deepEqual(loadOutbox('k', s), [a]);
  // Saved: the same ID and file, Kyle's save (no Agent line), and the saved copy holds it where it stood.
  const res = await pushAll(src, [a]);
  assert.deepEqual(res.done, [a.id]);
  assert.match(src.commits[0].message, /^scenes: add S-009 Chapter 5\n\nAdded in the Sparrow app\.$/);
  assert.match(src.files.get(a.ops[0].path)!, /^type: scene\nid: S-009\ntitle: Chapter 5\nstatus: drafted\nkind: story\nchapter: 5\nchapter_id: CH-005\norder: \d+\ncreated: 2026-11-11\n/m);
  assert.deepEqual(scenesOf(foldSaved(index, res.saved, schema, res.removed)).map((n) => n.path), scenes.map((n) => n.path));
});

test('a scene without a title is not added', async () => {
  const index = await indexOf(await vault());
  assert.throws(() => createAction('scene', newScene('  ', 5, 9), known(index), new Date(AT)), /Give the scene a title first\./);
});

test('if the scene\'s number was taken while it waited, it takes the next one, and what Kyle wrote in it follows', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const a = createAction('scene', newScene('The Ferry Back', 4, 7.5), known(index), new Date(AT));
  const shownPath = a.ops[0].path;
  // Another device adds S-009 first.
  src.files.set(BOOK + '/Scenes/S-009 Elsewhere.md', '---\ntype: scene\nid: S-009\ntitle: Elsewhere\nstatus: drafted\nchapter: 4\norder: 8\n---\n\nWords.\n');
  const res = await pushAll(src, [a]);
  const saved = BOOK + '/Scenes/S-010 The Ferry Back.md';
  assert.deepEqual(res.renames, { [shownPath]: saved });
  assert.match(src.files.get(saved)!, /^id: S-010$/m);
  assert.ok(!src.files.has(shownPath));
  // The words kept on the device under the name it was shown with move to the name it was saved with.
  const s = store();
  const d: Draft = { path: shownPath, baseSha: '', baseBody: '', body: 'Typed offline.', target: null, startWords: 0, updatedAt: AT, pending: true };
  putDraft('k', shownPath, d, s);
  moveDrafts('k', res.renames, s);
  assert.deepEqual(Object.keys(loadDrafts('k', s)), [saved]);
  assert.equal(loadDrafts('k', s)[saved].body, 'Typed offline.');
  assert.equal(loadDrafts('k', s)[saved].path, saved);
  // A page still open on the old name cannot put them back under it as it closes.
  putDraft('k', shownPath, d, s);
  assert.deepEqual(Object.keys(loadDrafts('k', s)), [saved]);
});

test('scenes from an outline are one save, each with the number after the one before', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const a = createAction('scene', [newScene('One more', 5, 9), newScene('And another', 6, 10)].map((p) => ({ ...p, why: 'Added from an outline in the Sparrow app.' })), known(index), new Date(AT));
  assert.deepEqual(a.ops.map((op) => op.path.slice(BOOK.length)), ['/Scenes/S-009 One more.md', '/Scenes/S-010 And another.md']);
  await pushAction(src, a);
  assert.equal(src.commits.length, 1);
  assert.match(src.commits[0].message, /^scenes: add S-009 One more\n\nSaved together with:\n- scenes: add S-010 And another\n\nAdded from an outline in the Sparrow app\.$/);
});

// ---- chapters renumbered ----

for (const change of [
  { type: 'room' as const, after: 1 }, { type: 'room' as const, after: 0 }, { type: 'room' as const, after: 3 },
  { type: 'move' as const, from: 3, to: 1 }, { type: 'move' as const, from: 1, to: 3 }, { type: 'move' as const, from: 2, to: 4 },
  { type: 'move' as const, from: 4, to: 2 }, { type: 'move' as const, from: 1, to: 2 }
]) {
  test('one save leaves the vault exactly as the note-by-note way did: ' + JSON.stringify(change), async () => {
    const b = await vault();
    const res = await pushAction(b, chaptersAction(BOOK, change, 'Why.'));
    leaves('chapters-' + (change.type === 'room' ? 'room-after-' + change.after : 'move-' + change.from + '-to-' + change.to), (await vault()).files, b.files);
    assert.equal(b.commits.length, 1, 'one save');
    assert.ok(!/Agent:/.test(b.commits[0].message));
    // The saved copy on the device, with what the save answered put in, is what a fresh read of the vault gives.
    const before = await indexOf(await vault());
    const folded = foldSaved(before, res.saved, schema, res.removed);
    const fresh = await indexOf(b);
    assert.deepEqual(Object.keys(folded.notes).sort(), Object.keys(fresh.notes).sort());
    Object.keys(fresh.notes).forEach((p) => assert.deepEqual(folded.notes[p], fresh.notes[p], p));
    assert.deepEqual(scenesOf(folded).map((n) => n.path), scenesOf(fresh).map((n) => n.path));
  });
}

test('moving a chapter: its scenes, beats, plan, change list, rewrite tick and title options all follow, in one save', async () => {
  const src = await vault();
  const before = await indexOf(src);
  const third = scenesOf(before).filter((n) => n.data.chapter === 3).map((n) => n.path);
  await pushAction(src, chaptersAction(BOOK, { type: 'move', from: 3, to: 1 }, 'Chapter 3 moved to chapter 1 in the Sparrow app.'));
  const after = await indexOf(src);
  assert.deepEqual(scenesOf(after).slice(0, third.length).map((n) => n.path), third, 'chapter 3\'s scenes now open the book');
  const inOrder = scenesOf(after).map((n) => n.data.chapter).filter((c) => typeof c === 'number') as number[];
  assert.deepEqual(inOrder, inOrder.slice().sort((x, y) => x - y), 'reading order follows the numbers');
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 1 beats.md')!, /Beats of three\./);
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 1 beats.md')!, /^title: Chapter 1 beats$/m);
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 3 beats.md')!, /Beats of two\./);
  assert.match(src.files.get(BOOK + '/Chapter Plans/Chapter 1 plan.md')!, /Plan of three\./);
  assert.ok(!src.files.has(BOOK + '/Chapter Plans/Chapter 3 plan.md'));
  assert.match(src.files.get(BOOK + '/Changes/Chapter 3 changes.md')!, /Changes of two\./);
  assert.match(src.files.get(BOOK + '/Changes/Chapter 4 changes.md')!, /Changes of four\./);
  assert.match(src.files.get(BOOK + '/Book.md')!, /^rewrite_done: \[1, 2\]$/m);
  assert.ok(![...src.files.keys()].some((p) => /moving/.test(p)), 'no passing names');
  assert.equal(src.commits.length, 1);
  assert.match(src.commits[0].message, /^chapters: chapter 3 is now chapter 1\n\nChapter 3 moved to chapter 1 in the Sparrow app\. \d+ notes followed, in one save\.$/);
});

test('a new chapter in the middle: the later chapters move up and its scene is added, all in one save', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const scene = createAction('scene', newScene('The Thaw', 2, 2.5), known(index), new Date(AT)).ops[0];
  const res = await pushAction(src, chaptersAction(BOOK, { type: 'room', after: 1 }, 'A new chapter 2 was added in the Sparrow app.', [scene]));
  assert.equal(src.commits.length, 1);
  assert.match(src.commits[0].message, /^chapters: room for a new chapter 2\n\nSaved together with:\n- scenes: add S-009 The Thaw\n/);
  const after = await indexOf(src);
  assert.deepEqual(scenesOf(after).map((n) => n.data.chapter).filter((c) => typeof c === 'number'), [1, 1, 2, 3, 3, 4, 4, 5]);
  assert.equal(sceneTitled(after, 'The Thaw')!.data.chapter, 2);
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 3 beats.md')!, /Beats of two\./);
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 4 beats.md')!, /Beats of three\./);
  assert.match(src.files.get(BOOK + '/Changes/Chapter 5 changes.md')!, /Changes of four\./);
  assert.match(src.files.get(BOOK + '/Book.md')!, /^rewrite_done: \[1, 4\]$/m);
  assert.deepEqual(scenesOf(foldSaved(index, res.saved, schema, res.removed)).map((n) => n.path), scenesOf(after).map((n) => n.path));
});

test('only the notes that changed since the device last read the vault, and the ones that move, are read again', async () => {
  const src = await vault();
  const index = await indexOf(src);
  // The team adds a to-do in chapter 4 that the device has not seen.
  src.files.set(BOOK + '/Tasks/T-099 New from the team.md', '---\ntype: task\nid: T-099\ntitle: New from the team\nstatus: open\nchapter: 4\n---\n');
  const reads: string[] = [];
  const commit = src.commit.bind(src);
  src.commit = (build) => commit((head) => build({ read: (p) => { reads.push(p); return head.read(p); }, files: head.files }));
  await pushAction(src, chaptersAction(BOOK, { type: 'move', from: 4, to: 3 }, 'Why.'), { known: index.notes });
  assert.equal(chapterOf(src, 'Tasks/T-099 New from the team.md'), 3, 'a note the device never saw follows too');
  const all = [...src.files.keys()].filter((p) => p.startsWith(BOOK + '/Scenes/')).length;
  const scenesRead = reads.filter((p) => p.startsWith(BOOK + '/Scenes/')).length;
  assert.ok(scenesRead < all, scenesRead + ' of ' + all + ' scenes read');
  assert.ok(!reads.some((p) => /S-001/.test(p)), 'chapter 1 is not read: it does not move and has not changed');
  // Without the device's copy, the same save reads every candidate and lands the same.
  const b = await vault();
  b.files.set(BOOK + '/Tasks/T-099 New from the team.md', '---\ntype: task\nid: T-099\ntitle: New from the team\nstatus: open\nchapter: 4\n---\n');
  await pushAction(b, chaptersAction(BOOK, { type: 'move', from: 4, to: 3 }, 'Why.'));
  assert.deepEqual([...b.files].sort(), [...src.files].sort());
});

test('a change that cannot be made saves nothing and says why', async () => {
  const src = await vault();
  const start = new Map(src.files);
  await assert.rejects(pushAction(src, chaptersAction(BOOK, { type: 'move', from: 9, to: 1 }, 'Why.')), /Chapter 9 is not in the book as the vault has it now\. Press Sync/);
  await assert.rejects(pushAction(src, chaptersAction(BOOK, { type: 'move', from: 1, to: 7 }, 'Why.')), /Choose a chapter number from 1 to 4\./);
  // A file with chapter 4's new name that is not a chapter note the move knows of.
  src.files.set(BOOK + '/Chapter Plans/Chapter 4 plan.md', 'Loose words with no properties.\n');
  start.set(BOOK + '/Chapter Plans/Chapter 4 plan.md', 'Loose words with no properties.\n');
  await assert.rejects(pushAction(src, chaptersAction(BOOK, { type: 'room', after: 1 }, 'Why.')), /already has a note called Chapter 4 plan .* nothing was changed/);
  assert.deepEqual([...src.files].sort(), [...start].sort());
  assert.equal(src.commits.length, 0);
});

test('if the vault moved while the save was being made, the chapters are worked out again on the newer notes', async () => {
  const src = await vault();
  src.race = () => { src.files.set(BOOK + '/Tasks/T-098 Raced.md', '---\ntype: task\nid: T-098\ntitle: Raced\nstatus: open\nchapter: 2\n---\n'); };
  await pushAction(src, chaptersAction(BOOK, { type: 'room', after: 1 }, 'Why.'));
  assert.equal(chapterOf(src, 'Tasks/T-098 Raced.md'), 3);
  assert.equal(src.builds, 2);
  assert.equal(src.commits.length, 1);
});

test('what waited for a note goes up before the chapters change, and an answer after it lands on the renamed note', async () => {
  const src = await vault();
  const two = BOOK + '/Changes/Chapter 2 changes.md', three = BOOK + '/Changes/Chapter 3 changes.md';
  const edit = (path: string, headline: string): Action => ({ id: 'e' + headline, at: AT, ops: [{ kind: 'edit', path, edit: { type: 'choice', choice: { path, decision: 'edit', reason: '', at: AT, fields: { headline } } } }] });
  // In one save, in order: an edit to chapter 2's list, room for a new chapter 2, an edit to what is now chapter 3's list.
  const res = await pushAll(src, [edit(two, 'Before.'), chaptersAction(BOOK, { type: 'room', after: 1 }, 'Why.'), edit(three, 'After.')]);
  assert.equal(res.error, null);
  assert.equal(src.commits.length, 1);
  const text = src.files.get(three)!;
  assert.match(text, /Changes of two\./);
  assert.match(text, /^headline: After\.$/m, 'the later edit met the renamed note, with the earlier edit under it');
  assert.ok(!src.files.has(two));
  assert.ok(res.removed.indexOf(two) >= 0 && res.removed.every((p) => !src.files.has(p)), 'the old file names are gone');
});

test('scenes stay in reading order by their numbers after every move', async () => {
  for (const [from, to] of [[1, 4], [4, 1], [2, 3], [3, 2]]) {
    const src = await vault();
    await pushAction(src, chaptersAction(BOOK, { type: 'move', from, to }, 'Why.'));
    const scenes = Object.values((await indexOf(src)).notes).filter((n) => n.type === 'scene' && n.path.startsWith(BOOK + '/')).sort(compareScenes);
    const chapters = scenes.map((n) => n.data.chapter).filter((c) => typeof c === 'number') as number[];
    assert.deepEqual(chapters, chapters.slice().sort((a, b) => a - b), from + ' to ' + to);
  }
});

// ---- scenes deleted ----

const scenePath = (index: VaultIndex, id: string) => scenesOf(index).find((n) => n.data.id === id)!.path;
const NOW = new Date(2026, 10, 11, 12, 0, 0);

for (const ids of [['S-002'], ['S-007'], ['S-008'], ['S-003', 'S-004'], ['S-001', 'S-002'], ['S-005', 'S-006', 'S-008'], ['S-003', 'S-004', 'S-006']]) {
  test('scenes deleted in one save leave the vault exactly as the note-by-note way did: ' + ids.join(', '), async () => {
    const b = await vault();
    const before = await indexOf(b);
    const paths = ids.map((id) => scenePath(before, id));
    const res = await pushAction(b, deleteAction(BOOK, paths, NOW), { known: before.notes });
    leaves('delete-' + ids.join('-'), (await vault()).files, b.files);
    assert.equal(b.commits.length, 1, 'one save');
    assert.ok(!/Agent:/.test(b.commits[0].message));
    paths.forEach((p) => assert.ok(!b.files.has(p) && res.removed.indexOf(p) >= 0));
    // The saved copy on the device, with what the save answered put in, is what a fresh read of the vault gives:
    // the notes, the reading order and the scene archive, where Restore finds what was deleted.
    const folded = foldSaved(before, res.saved, schema, res.removed);
    const fresh = await indexOf(b);
    assert.deepEqual(Object.keys(folded.notes).sort(), Object.keys(fresh.notes).sort());
    Object.keys(fresh.notes).forEach((p) => assert.deepEqual(folded.notes[p], fresh.notes[p], p));
    assert.deepEqual(scenesOf(folded).map((n) => n.path), scenesOf(fresh).map((n) => n.path));
    const bookOf = (i: VaultIndex) => i.books.find((x) => x.folder === BOOK)!;
    // (The vault in memory lists files in the order they were added; GitHub lists them by name, as the saved copy keeps them.)
    const byPath = (l: { path: string }[] = []) => l.slice().sort((x, y) => (x.path < y.path ? -1 : 1));
    assert.deepEqual(bookOf(folded).archive, byPath(bookOf(fresh).archive));
    assert.equal(bookOf(fresh).archive!.length, bookOf(before).archive!.length + ids.length);
  });
}

test('deleting a scene: it goes to the Archive as it was, with the day and why, and Restore brings it back', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const path = scenePath(index, 'S-002');
  const was = src.files.get(path)!;
  const res = await pushAction(src, deleteAction(BOOK, [path], NOW));
  const kept = BOOK + '/Archive/S-002 The Ferry.md';
  assert.ok(src.files.get(kept)!.indexOf('> [!note] Archived\n> Deleted in the Sparrow app on 2026-11-11.\n') > 0);
  assert.match(src.commits[0].message, /^delete: S-002 The Ferry\n\nDeleted in the Sparrow app on 2026-11-11\. The scene as it was is in the book's Archive\.\n\nOne save\.$/);
  // Its chapter still has a scene, so no chapter number changes.
  assert.equal(src.commits[0].paths.length, 2);
  const folded = foldSaved(index, res.saved, schema, res.removed);
  assert.ok(folded.books.find((b) => b.folder === BOOK)!.archive!.some((f) => f.path === kept), 'Restore finds it in the Archive list');
  await pushAction(src, restoreAction(BOOK, kept));
  assert.equal(src.files.get(path), was);
  assert.ok(!src.files.has(kept));
});

test('deleting a chapter\'s only scenes: its notes go to the Archive with them, the chapters after it close up, the lists follow', async () => {
  const src = await vault();
  const index = await indexOf(src);
  await pushAction(src, deleteAction(BOOK, [scenePath(index, 'S-003'), scenePath(index, 'S-004')], NOW));
  const dir = BOOK + '/Archive/Deleted chapter 2 2026-11-11/';
  assert.match(src.files.get(dir + 'Chapter 2 beats.md')!, /Its chapter 2 was deleted in the Sparrow app on 2026-11-11\.\n[^]*Beats of two\./);
  assert.match(src.files.get(dir + 'Chapter 2 changes.md')!, /Changes of two\./);
  assert.match(src.files.get(BOOK + '/Chapter Beats/Chapter 2 beats.md')!, /Beats of three\./);
  assert.match(src.files.get(BOOK + '/Chapter Plans/Chapter 2 plan.md')!, /Plan of three\./);
  assert.match(src.files.get(BOOK + '/Changes/Chapter 3 changes.md')!, /Changes of four\./);
  assert.ok(!src.files.has(BOOK + '/Changes/Chapter 4 changes.md'));
  assert.match(src.files.get(BOOK + '/Book.md')!, /^rewrite_done: \[1, 2\]$/m);
  const after = await indexOf(src);
  assert.deepEqual(scenesOf(after).map((n) => n.data.chapter).filter((c) => typeof c === 'number'), [1, 1, 2, 2, 3]);
  assert.equal(src.commits.length, 1);
  assert.match(src.commits[0].message, /^delete: S-003 The Warden and 1 more\n\nDeleted in the Sparrow app on 2026-11-11\. The scenes as they were are in the book's Archive\.\n\nChapter 2 had no scene left, so it is gone: its \d+ other notes are in Archive\/Deleted chapter 2 2026-11-11\/, and the chapters after it close up by one \(\d+ notes followed\)\.\n\nOne save\.$/);
});

test('an older archived copy with the same name is never written over', async () => {
  const src = await vault();
  const index = await indexOf(src);
  src.files.set(BOOK + '/Archive/S-002 The Ferry.md', 'An older copy.\n');
  await pushAction(src, deleteAction(BOOK, [scenePath(index, 'S-002')], NOW));
  assert.equal(src.files.get(BOOK + '/Archive/S-002 The Ferry.md'), 'An older copy.\n');
  assert.match(src.files.get(BOOK + '/Archive/S-002 The Ferry (2).md')!, /Deleted in the Sparrow app on 2026-11-11\./);
});

test('a scene that is no longer in the book: nothing is saved and the app says so; one that still is goes alone', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const start = new Map(src.files);
  await assert.rejects(pushAction(src, deleteAction(BOOK, [BOOK + '/Scenes/S-050 Gone.md'], NOW)), /That scene is not in the book as the vault has it now\. Press Sync and look at the chapter list\./);
  assert.deepEqual([...src.files].sort(), [...start].sort());
  assert.equal(src.commits.length, 0);
  const res = await pushAction(src, deleteAction(BOOK, [BOOK + '/Scenes/S-050 Gone.md', scenePath(index, 'S-002')], NOW));
  assert.deepEqual(res.removed, [scenePath(index, 'S-002')]);
});

test('if the vault moved while the delete was being made, it is worked out again: a scene the team just added keeps its chapter', async () => {
  const src = await vault();
  const index = await indexOf(src);
  // Chapter 4 has one scene on the device. While the save is made, another device adds a second scene to chapter 4.
  src.race = () => { src.files.set(BOOK + '/Scenes/S-020 Raced.md', '---\ntype: scene\nid: S-020\ntitle: Raced\nstatus: drafted\nchapter: 4\norder: 99\n---\n\nWords.\n'); };
  await pushAction(src, deleteAction(BOOK, [scenePath(index, 'S-008')], NOW), { known: index.notes });
  assert.equal(src.builds, 2);
  assert.equal(src.commits.length, 1);
  assert.ok(src.files.has(BOOK + '/Changes/Chapter 4 changes.md'), 'chapter 4 still has a scene, so its notes stay');
  assert.ok(![...src.files.keys()].some((p) => /Deleted chapter/.test(p)));
});

// ---- on a copy of the real book, when the vault is checked out beside this repository ----

test('Quest Declined 2: a chapter moved, one added in the middle and one deleted are one save each, and the book stays in order', { skip: !hasVault }, async () => {
  const QD2 = 'Series/Quest Declined/Books/2 Quest Declined 2';
  const disk = new FsSource(VAULT);
  const all = (await disk.tree()).files.filter((f) => !f.path.startsWith('.git/') && (f.path.startsWith(QD2 + '/') || f.path.startsWith('System/')) && /\.(md|json)$/.test(f.path));
  const texts = new Map<string, string>();
  for (const f of all) texts.set(f.path, await disk.read(f.path));
  const copy = () => { const m = new MemSource(); texts.forEach((t, p) => m.files.set(p, t)); return m; };
  const realSchema = parseSchema(texts.get('System/schema.json')!);
  const bookOf = (i: VaultIndex) => i.books.find((x) => x.folder === QD2)!;
  /** Each scene's chapter, in reading order. */
  const chapters = (i: VaultIndex) => bookOf(i).scenes.map((p) => toNumber(i.notes[p].data.chapter)).filter((c): c is number => c != null);
  const words = (i: VaultIndex) => bookOf(i).scenes.map((p) => i.notes[p].body);
  const watch = (b: MemSource) => {
    const reads: string[] = [];
    const commit = b.commit.bind(b);
    b.commit = (build) => commit((head) => build({ read: (p) => { reads.push(p); return head.read(p); }, files: head.files }));
    return reads;
  };
  /** The saved copy with the save's answer folded in is what a fresh read gives. */
  const sameAsFresh = async (b: MemSource, index: VaultIndex, res: Awaited<ReturnType<typeof pushAction>>) => {
    const folded = foldSaved(index, res.saved, realSchema, res.removed);
    const fresh = (await sync(b, null)).index;
    assert.deepEqual(Object.keys(folded.notes).sort(), Object.keys(fresh.notes).sort());
    Object.keys(fresh.notes).forEach((p) => assert.deepEqual(folded.notes[p], fresh.notes[p], p));
    assert.deepEqual(bookOf(folded).scenes, bookOf(fresh).scenes);
    return { folded, fresh };
  };
  for (const change of [{ type: 'move' as const, from: 30, to: 12 }, { type: 'move' as const, from: 3, to: 4 }, { type: 'room' as const, after: 10 }]) {
    const b = copy();
    const index = (await sync(b, null)).index;
    const reads = watch(b);
    const res = await pushAction(b, chaptersAction(QD2, change, 'Why.'), { known: index.notes });
    assert.equal(b.commits.length, 1, JSON.stringify(change));
    const { fresh } = await sameAsFresh(b, index, res);
    const now = chapters(fresh);
    assert.deepEqual(now, now.slice().sort((x, y) => x - y), 'reading order follows the numbers');
    // Every scene is at the number the change gives its chapter, with its words as they were.
    const map = change.type === 'room' ? roomMap(change.after) : moveMap(change.from, change.to);
    for (const p of bookOf(index).scenes) {
      const c = toNumber(index.notes[p].data.chapter);
      assert.equal(toNumber(fresh.notes[p].data.chapter), c == null ? null : map(c), p);
      assert.equal(fresh.notes[p].body, index.notes[p].body, p);
    }
    assert.equal(bookOf(fresh).scenes.length, bookOf(index).scenes.length);
    console.log('  ' + JSON.stringify(change) + ': 1 save of ' + b.commits[0].paths.length + ' files, ' + reads.length + ' notes read');
  }
  // A chapter deleted (one scene a chapter in this book): its notes to the Archive and the chapters after it closed up.
  for (const ch of [12, 37]) {
    const b = copy();
    const index = (await sync(b, null)).index;
    const paths = bookOf(index).scenes.filter((p) => toNumber(index.notes[p].data.chapter) === ch);
    if (!paths.length) continue;
    const reads = watch(b);
    const res = await pushAction(b, deleteAction(QD2, paths, NOW), { known: index.notes });
    assert.equal(b.commits.length, 1, 'delete chapter ' + ch);
    const { folded, fresh } = await sameAsFresh(b, index, res);
    assert.deepEqual(bookOf(folded).archive, (bookOf(fresh).archive || []).slice().sort((x, y) => (x.path < y.path ? -1 : 1)));
    const left = bookOf(index).scenes.filter((p) => paths.indexOf(p) < 0);
    assert.deepEqual(chapters(fresh), left.map((p) => toNumber(index.notes[p].data.chapter)!).map((c) => (c > ch ? c - 1 : c)), 'the chapters after it closed up by one');
    assert.deepEqual(words(fresh), left.map((p) => index.notes[p].body), 'no other word changed');
    paths.forEach((p) => assert.ok(b.files.has(QD2 + '/Archive/' + p.slice(p.lastIndexOf('/') + 1)), 'the deleted scene is in the Archive'));
    console.log('  delete chapter ' + ch + ': 1 save of ' + b.commits[0].paths.length + ' files, ' + reads.length + ' notes read');
  }
});
