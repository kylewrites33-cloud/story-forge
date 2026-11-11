// The one saving system, the small saves: ticks on the Chapter titles page, a chapter marked through in the Rewrite
// tab, a recipe changed, a note's new title with its file renamed, a new series and a new book.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBook, createSeries } from '../src/lib/books.ts';
import { makeBackupFolder } from '../src/lib/docx.ts';
import { loadDrafts, moveDrafts, putDraft, type Draft } from '../src/lib/drafts.ts';
import { saveRecipe } from '../src/lib/recipes.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { renameScene } from '../src/lib/scenes.ts';
import { sync } from '../src/lib/sync.ts';
import { NONE, parseTitles, pickedTitle } from '../src/lib/titles.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import type { VaultIndex } from '../src/lib/types.ts';
import { editRecord, editText, foldSaved, overlayActions } from '../src/vault/apply.ts';
import { createAction, textAction, type Action } from '../src/vault/ops.ts';
import { add, loadOutbox, saveOutbox, settle } from '../src/vault/outbox.ts';
import { pushAction, pushAll } from '../src/vault/push.ts';
import type { TextChange } from '../src/vault/text.ts';
import { DEMO, demoSchemaText, FsSource, MemSource } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const TITLES = BOOK + '/Chapter Titles.md';
const BOOKNOTE = BOOK + '/Book.md';
const RECIPE = 'Recipes/Ledger Entry.md';
const SCENE = BOOK + '/Scenes/S-002 The Ferry.md';
const AT = '2026-11-11T17:00:00.000Z';
const schema = parseSchema(demoSchemaText());

async function vault(): Promise<MemSource> {
  const fs2 = new FsSource(DEMO);
  const src = new MemSource();
  for (const f of (await fs2.tree()).files) if (f.path.endsWith('.md') || f.path.endsWith('.json')) src.files.set(f.path, await fs2.read(f.path));
  return src;
}
const indexOf = async (src: MemSource): Promise<VaultIndex> => (await sync(src, null)).index;
const known = (index: VaultIndex) => Object.keys(index.notes).map((path) => ({ path, sha: '' }));
const retitle = (path: string, title: string, what: 'scene' | 'recipe' = 'scene', id = 'r1'): Action => ({ id, at: AT, ops: [{ kind: 'retitle', path, title, what }] });
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const store = () => new MemStorage() as unknown as Storage;
/** The saved copy with a save's answer put in is what a fresh read of the vault gives. */
async function sameAsFresh(src: MemSource, before: VaultIndex, res: { saved: Parameters<typeof foldSaved>[1]; removed: string[] }) {
  const folded = foldSaved(before, res.saved, schema, res.removed);
  const fresh = await indexOf(src);
  assert.deepEqual(Object.keys(folded.notes).sort(), Object.keys(fresh.notes).sort());
  Object.keys(fresh.notes).forEach((p) => assert.deepEqual(folded.notes[p], fresh.notes[p], p));
  assert.deepEqual(folded.books.map((b) => b.folder).sort(), fresh.books.map((b) => b.folder).sort());
  assert.deepEqual(folded.series.map((s) => s.folder).sort(), fresh.series.map((s) => s.folder).sort());
}

// ---- small changes to a note's text ----

const CHANGES: [string, TextChange][] = [
  [TITLES, { what: 'title-pick', chapter: 1, title: 'Ash and Wax', on: true }],
  [TITLES, { what: 'title-pick', chapter: 2, title: NONE, on: true }],
  [TITLES, { what: 'title-own', chapter: 2, title: 'Low Water' }],
  [BOOKNOTE, { what: 'through', chapter: 2, done: true }],
  [BOOKNOTE, { what: 'through', chapter: 2, done: false }],
  [RECIPE, { what: 'recipe', use_for: 'a ledger page', body: 'Three lines at most.\n\nTobin signs.' }],
  [RECIPE, { what: 'recipe', use_for: '', body: 'Show a ledger page as a short block: the date, the name, the toll in pennies, and the initials of whoever wrote it. Tobin\'s hand slopes left. Never more than four lines.' }]
];

test('a small change shows on screen exactly as the saved text will read it', async () => {
  const src = await vault();
  for (const [path, change] of CHANGES) {
    // On the note as the demo vault has it, and on a book note that already has chapters marked.
    const starts = [src.files.get(path)!].concat(path === BOOKNOTE ? [src.files.get(path)!.replace(/^---\n/, '---\nrewrite_done: [1, 2]\n')] : []);
    for (const start of starts) {
      const shown = editRecord(makeNote(path, 'x', start), { type: 'text', change });
      const saved = makeNote(path, 'x', editText(start, { type: 'text', change }));
      assert.deepEqual(shown.data, saved.data, JSON.stringify(change));
      assert.equal(shown.body, saved.body, JSON.stringify(change));
    }
  }
});

test('a tick on the Chapter titles page shows at once, waits across closing the app, and is one save that changes only its line', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const was = src.files.get(TITLES)!;
  const a = textAction([{ path: TITLES, change: { what: 'title-pick', chapter: 1, title: 'Ash and Wax', on: true } }], [], new Date(AT));
  const shown = overlayActions(index, [a], schema);
  assert.equal(pickedTitle(parseTitles(shown.notes[TITLES].body).find((c) => c.chapter === 1)!), 'Ash and Wax');
  assert.equal(pickedTitle(parseTitles(index.notes[TITLES].body).find((c) => c.chapter === 1)!), '');
  const s = store();
  saveOutbox('k', add([], a), s);
  assert.deepEqual(loadOutbox('k', s), [a]);
  // A second tick for another chapter waits beside the first; neither replaces the other.
  const b = textAction([{ path: TITLES, change: { what: 'title-own', chapter: 2, title: 'Low Water' } }], [], new Date(AT));
  const list = add(add([], a), b);
  assert.equal(list.length, 2);
  // The team adds a round meanwhile: Kyle's ticks land on the newer note.
  src.files.set(TITLES, was + '\n## Chapter 9\nWas: Nine\n\n- [ ] A New One\n- [ ] None of these\n');
  const res = await pushAll(src, list);
  assert.equal(res.error, null);
  assert.equal(src.commits.length, 1, 'both went up as one save');
  assert.match(src.commits[0].message, /^titles: Kyle picked "Ash and Wax" for chapter 1\n\nSaved together with:\n- titles: Kyle wrote "Low Water" for chapter 2\n\nChosen in the Sparrow app\.$/);
  const now = src.files.get(TITLES)!;
  assert.match(now, /^- \[x\] Ash and Wax$/m);
  assert.match(now, /## Chapter 9/);
  assert.equal(pickedTitle(parseTitles(now).find((c) => c.chapter === 2)!), 'Low Water');
  const changed = now.split('\n').filter((l) => was.split('\n').indexOf(l) < 0);
  assert.deepEqual(changed.filter((l) => !/Chapter 9|Nine|A New One/.test(l)).length <= 3, true, changed.join(' | '));
  await sameAsFresh(src, index, res);
});

test('a chapter marked through in the Rewrite tab works with no connection and lands on the book note as it is then', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const a = textAction([{ path: BOOKNOTE, change: { what: 'through', chapter: 3, done: true } }], [], new Date(AT));
  assert.deepEqual(overlayActions(index, [a], schema).notes[BOOKNOTE].data.rewrite_done, [3]);
  src.offline = true;
  const off = await pushAll(src, [a]);
  assert.deepEqual(off.done, []);
  src.offline = false;
  // Another device marked chapter 1 meanwhile.
  src.files.set(BOOKNOTE, src.files.get(BOOKNOTE)!.replace(/^---\n/, '---\nrewrite_done: [1]\n'));
  const res = await pushAll(src, [a]);
  assert.deepEqual(res.done, [a.id]);
  assert.match(src.files.get(BOOKNOTE)!, /^rewrite_done: \[1, 3\]$/m);
  assert.match(src.commits[0].message, /^rewrite: chapter 3 through in the Rewrite tab$/);
});

test('a recipe changed and renamed is one save, and leaves the vault as the old two-step way did', async () => {
  const a = await vault(), b = await vault();
  const index = await indexOf(b);
  const r = { title: 'Ferry Ledger', use_for: 'a ledger page', body: 'Three lines at most.' };
  await saveRecipe(a, index.notes[RECIPE], r);
  const action = textAction([{ path: RECIPE, change: { what: 'recipe', use_for: r.use_for, body: r.body } }], [{ kind: 'retitle', path: RECIPE, title: r.title, what: 'recipe' }], new Date(AT));
  // On screen at once: the new name and words, under the old file name until the save.
  const shown = overlayActions(index, [action], schema).notes[RECIPE];
  assert.equal(shown.data.title, 'Ferry Ledger');
  assert.equal(shown.body.trim(), 'Three lines at most.');
  const res = await pushAction(b, action);
  assert.deepEqual([...b.files].sort(), [...a.files].sort());
  assert.equal(b.commits.length, 1);
  assert.ok(a.writes.length > 1);
  assert.deepEqual(res.renames, { [RECIPE]: 'Recipes/Ferry Ledger.md' });
  assert.deepEqual(res.removed, [RECIPE]);
  await sameAsFresh(b, index, res);
  // Words only: one file, the old way's text.
  const c = await vault(), d = await vault();
  await saveRecipe(c, index.notes[RECIPE], { ...r, title: 'Ledger Entry' });
  await pushAction(d, textAction([{ path: RECIPE, change: { what: 'recipe', use_for: r.use_for, body: r.body } }]));
  assert.deepEqual([...d.files].sort(), [...c.files].sort());
  assert.match(d.commits[0].message, /^recipes: edit Ledger Entry\n\nEdited in the Sparrow app\.$/);
});

// ---- a scene's new title ----

test('a scene\'s new title: one save renames the file, only the title line changes, and the vault is as the old way left it', async () => {
  const a = await vault(), b = await vault();
  const index = await indexOf(b);
  await renameScene(a, index.notes[SCENE], 'The Night Ferry');
  const action = retitle(SCENE, 'The Night Ferry');
  assert.equal(overlayActions(index, [action], schema).notes[SCENE].data.title, 'The Night Ferry');
  const res = await pushAction(b, action);
  const dest = BOOK + '/Scenes/S-002 The Night Ferry.md';
  assert.deepEqual([...b.files].sort(), [...a.files].sort());
  assert.equal(b.commits.length, 1);
  assert.equal(a.writes.length, 2);
  assert.match(b.commits[0].message, /^scenes: rename S-002 to The Night Ferry\n\nRenamed in the Sparrow app: The Ferry -> The Night Ferry\.$/);
  assert.deepEqual(res.renames, { [SCENE]: dest });
  await sameAsFresh(b, index, res);
});

test('what waits for a scene, and the words kept on the device, follow it to its new file name', async () => {
  const src = await vault();
  const dest = BOOK + '/Scenes/S-002 The Night Ferry.md';
  const edit: Action = { id: 'e1', at: AT, ops: [{ kind: 'edit', path: SCENE, edit: { type: 'choice', choice: { path: SCENE, decision: 'edit', reason: '', at: AT, fields: { headline: 'Mara pays the toll.' } } } }] };
  // In one push: the title, then an edit made while it waited.
  const res = await pushAll(src, [retitle(SCENE, 'The Night Ferry'), edit]);
  assert.equal(res.error, null);
  assert.equal(src.commits.length, 1);
  assert.match(src.files.get(dest)!, /^headline: Mara pays the toll\.$/m);
  assert.ok(!src.files.has(SCENE));
  // An edit added after the push started is repointed, and so is the draft.
  const later: Action = { ...edit, id: 'e2' };
  assert.equal(settle([later], res.done, res.failed, res.renames)[0].ops[0].path, dest);
  const s = store();
  const d: Draft = { path: SCENE, baseSha: 'x', baseBody: 'a', body: 'b', target: null, startWords: 0, updatedAt: AT, pending: true };
  putDraft('k', SCENE, d, s);
  moveDrafts('k', res.renames, s);
  assert.deepEqual(Object.keys(loadDrafts('k', s)), [dest]);
  // Two titles in a row while offline: the second finds the note under the first's name.
  const two = await vault();
  const r2 = await pushAll(two, [retitle(SCENE, 'One', 'scene', 'a'), retitle(SCENE, 'Two', 'scene', 'b')]);
  assert.equal(r2.error, null);
  assert.ok(two.files.has(BOOK + '/Scenes/S-002 Two.md') && !two.files.has(BOOK + '/Scenes/S-002 One.md') && !two.files.has(SCENE));
  assert.deepEqual(r2.renames, { [SCENE]: BOOK + '/Scenes/S-002 Two.md' });
});

test('a title another scene file already has is refused with a plain sentence and nothing is saved; a scene that is gone is skipped', async () => {
  const src = await vault();
  src.files.set(BOOK + '/Scenes/S-002 Taken.md', 'Loose words.\n');
  const start = new Map(src.files);
  const res = await pushAll(src, [retitle(SCENE, 'Taken')]);
  assert.match(res.failed.r1, /A scene called Taken is already there\. Choose another title\./);
  assert.deepEqual([...src.files].sort(), [...start].sort());
  const gone = await pushAll(src, [retitle(BOOK + '/Scenes/S-099 Nowhere.md', 'Somewhere')]);
  assert.deepEqual(gone.done, ['r1']);
  assert.equal(src.commits.length, 0);
});

// ---- a new series, a new book ----

test('a new series and a new book show at once, work with no connection, and are one save each with their backup folder', async () => {
  const a = await vault(), b = await vault();
  const index = await indexOf(b);
  const now = new Date(AT);
  await createSeries(a, 'Salt Road', 'cozy fantasy', now);
  await makeBackupFolder(a, 'Salt Road');
  await createBook(a, 'Series/Salt Road', 'Salt Road', 'The Tide Clerk', 1, now);
  await makeBackupFolder(a, 'Salt Road', 'The Tide Clerk');
  const series = createAction('series', { name: 'Salt Road', genre: 'cozy fantasy', at: AT }, known(index), now);
  assert.equal(series.ops[0].path, 'Series/Salt Road/Series.md');
  const withSeries = overlayActions(index, [series], schema);
  assert.ok(withSeries.series.some((s) => s.folder === 'Series/Salt Road'), 'the series shows before it is saved');
  const book = createAction('book', { seriesFolder: 'Series/Salt Road', seriesName: 'Salt Road', title: 'The Tide Clerk', number: 1, at: AT }, known(withSeries), now);
  const shown = overlayActions(index, [series, book], schema);
  assert.ok(shown.books.some((x) => x.folder === 'Series/Salt Road/Books/1 The Tide Clerk'), 'the book shows before it is saved');
  b.offline = true;
  assert.deepEqual((await pushAll(b, [series, book])).done, []);
  b.offline = false;
  const res = await pushAll(b, [series, book]);
  assert.equal(res.error, null);
  assert.deepEqual([...b.files].sort(), [...a.files].sort());
  assert.equal(b.commits.length, 1);
  assert.equal(a.writes.length, 4);
  await sameAsFresh(b, index, res);
  // A name the vault already has is refused when Kyle types it.
  assert.throws(() => createAction('series', { name: 'Ember Road', genre: '', at: AT }, known(index), now), /A series called Ember Road is already in the vault\. Choose another name\./);
  assert.throws(() => createAction('book', { seriesFolder: 'Series/Ember Road', seriesName: 'Ember Road', title: 'Ash Bell', number: 1, at: AT }, known(index), now), /A book called 1 Ash Bell is already in the vault/);
  assert.throws(() => createAction('series', { name: '  ', genre: '', at: AT }, known(index), now), /Give the series a name first\./);
  // Saved by an earlier try whose answer was lost: not added twice, not an error.
  const again = await pushAll(b, [series]);
  assert.deepEqual(again.done, [series.id]);
  assert.equal(b.commits.length, 1);
});
