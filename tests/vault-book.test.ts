// The one saving system: words Kyle writes in a box of their own (the front and back matter, the book's Braindump),
// the book's draft saved, a scene brought back from the Archive, and a deleted beat's words on their way there.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { savedDrafts } from '../src/lib/bookdrafts.ts';
import { withBody } from '../src/lib/drafts.ts';
import { matterPath, splitNote, starterMatter } from '../src/lib/epub.ts';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { parseSchema } from '../src/lib/schema.ts';
import { archivedText, archivePath } from '../src/lib/scenes.ts';
import { sync } from '../src/lib/sync.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import type { BookEntry, VaultIndex } from '../src/lib/types.ts';
import { editRecord, editText, foldSaved, overlayActions } from '../src/vault/apply.ts';
import { deleteAction, draftAction, filesAction, restoreAction, textAction, type Action } from '../src/vault/ops.ts';
import { add, loadOutbox, saveOutbox } from '../src/vault/outbox.ts';
import { pushAction, pushAll } from '../src/vault/push.ts';
import { BRAINDUMP_START, type TextChange } from '../src/vault/text.ts';
import { DEMO, demoSchemaText, FsSource, leaves, MemSource } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const DUMP = BOOK + '/Braindump.md';
const MATTER = matterPath({ folder: BOOK } as BookEntry);
const schema = parseSchema(demoSchemaText());

async function vault(): Promise<MemSource> {
  const fs2 = new FsSource(DEMO);
  const src = new MemSource();
  for (const f of (await fs2.tree()).files) if (f.path.endsWith('.md') || f.path.endsWith('.json')) src.files.set(f.path, await fs2.read(f.path));
  return src;
}
const indexOf = async (src: MemSource): Promise<VaultIndex> => (await sync(src, null)).index;
const words = (of: 'matter' | 'braindump', was: string, body: string, start = BRAINDUMP_START): Extract<TextChange, { what: 'words' }> => ({ what: 'words', of, was, body, start, name: 'Ash Bell' });
const act = (path: string, change: TextChange, id: string): Action => ({ ...textAction([{ path, change }]), id });
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

// ---- words in a box of their own ----

test('the words change shows on screen exactly as the saved text will read it', () => {
  const dump = '---\ntype: braindump\ntitle: Notes\n---\n\nFerry runs at dawn.\nAsk about the bell.\n';
  const matter = starterMatter('Kyle Heath', new Date('2026-11-11T12:00:00'));
  const cases: [string, string, TextChange][] = [
    [DUMP, dump, words('braindump', '\nFerry runs at dawn.\nAsk about the bell.\n', 'Ferry runs at dawn.\nAsk about the bell.\nThe ledger is in the well.')],
    [DUMP, '', words('braindump', '', 'A first loose idea.')],
    [MATTER, matter, words('matter', splitNote(matter).body, splitNote(matter).body.replace('## Front: Dedication\n', '## Front: Dedication\nFor the ferrymen.\n'), splitNote(matter).head)],
    [MATTER, '', words('matter', '', splitNote(matter).body, splitNote(matter).head)]
  ];
  cases.forEach(([path, text, change], i) => {
    const edit = { type: 'text' as const, change };
    const next = editText(text, edit);
    assert.notEqual(next, text, 'case ' + i);
    assert.deepEqual(editRecord(makeNote(path, 'x', text), edit), makeNote(path, 'x', next), 'case ' + i);
  });
  // As the old way wrote them: the Braindump with a blank line under its properties, the matter right under them.
  assert.equal(editText(dump, { type: 'text', change: cases[0][2] }), withBody(dump, '\nFerry runs at dawn.\nAsk about the bell.\nThe ledger is in the well.\n'));
  assert.equal(editText('', { type: 'text', change: cases[1][2] }), Frontmatter.join({ type: 'braindump' }, '\nA first loose idea.\n'));
  assert.equal(editText('', { type: 'text', change: cases[3][2] }), matter);
});

test('the first notes of a book start its Braindump: they show at once, wait across closing the app, and are one save', async () => {
  const src = await vault();
  src.files.delete(DUMP);
  const index = await indexOf(src);
  assert.equal(index.notes[DUMP], undefined);
  const book = () => index.books.find((b) => b.folder === BOOK)!;
  assert.ok(!book().braindump);

  const s = new MemStorage() as unknown as Storage;
  saveOutbox('k', add([], act(DUMP, words('braindump', '', 'The bell is cracked.\nRue knows.'), 'n1')), s);
  const waiting = loadOutbox('k', s);
  assert.equal(waiting.length, 1, 'it is still there when the app opens again');
  const shown = overlayActions(index, waiting, schema);
  assert.equal(shown.notes[DUMP].body, '\nThe bell is cracked.\nRue knows.\n');
  assert.equal(shown.books.find((b) => b.folder === BOOK)!.braindump, DUMP, 'the Notes tab finds it');

  const res = await pushAll(src, waiting);
  assert.deepEqual(res.done, ['n1']);
  assert.equal(src.commits.length, 1);
  assert.deepEqual(src.commits[0].paths, [DUMP]);
  assert.equal(src.commits[0].message, 'braindump: notes from the writing screen\n\nWritten in the Sparrow app.');
  assert.equal(src.files.get(DUMP), '---\ntype: braindump\n---\n\nThe bell is cracked.\nRue knows.\n');
  const folded = foldSaved(index, res.saved, schema, res.removed, res.texts);
  assert.deepEqual(folded.notes[DUMP], (await indexOf(src)).notes[DUMP]);
});

test('notes changed on another device meanwhile come in line by line; where both changed a line, Kyle\'s is kept', async () => {
  const src = await vault();
  const head = '---\ntype: braindump\ntitle: Notes\n---\n';
  src.files.set(DUMP, head + '\nOne.\nTwo.\nThree.\n');
  const index = await indexOf(src);
  const was = index.notes[DUMP].body;
  // Kyle adds a line at the end; the iPad changed the first line.
  src.files.set(DUMP, head + '\nOne, from the iPad.\nTwo.\nThree.\n');
  await pushAction(src, act(DUMP, words('braindump', was, 'One.\nTwo.\nThree.\nFour, from the desk.'), 'a'));
  assert.equal(src.files.get(DUMP), head + '\nOne, from the iPad.\nTwo.\nThree.\nFour, from the desk.\n');
  // Both change line two: his stays.
  const base = 'One, from the iPad.\nTwo.\nThree.\nFour, from the desk.';
  src.files.set(DUMP, head + '\n' + base.replace('Two.', 'Two, theirs.') + '\n');
  await pushAction(src, act(DUMP, words('braindump', base, base.replace('Two.', 'Two, mine.')), 'b'));
  assert.match(src.files.get(DUMP)!, /^Two, mine\.$/m);
  assert.doesNotMatch(src.files.get(DUMP)!, /Two, theirs\./);
  assert.match(src.files.get(DUMP)!, /^title: Notes$/m, 'the properties are kept');
});

test('two saves of the notes with no connection both land, in order, as one save', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const was = index.notes[DUMP] ? index.notes[DUMP].body : '';
  let list = add([], act(DUMP, words('braindump', was, 'First thought.'), 'a'));
  list = add(list, act(DUMP, words('braindump', 'First thought.', 'First thought.\nSecond thought.'), 'b'));
  assert.equal(list.length, 2);
  assert.equal(overlayActions(index, list, schema).notes[DUMP].body, '\nFirst thought.\nSecond thought.\n');
  const res = await pushAll(src, list);
  assert.deepEqual(res.done, ['a', 'b']);
  assert.equal(src.commits.length, 1);
  assert.equal(splitNote(src.files.get(DUMP)!).body, '\nFirst thought.\nSecond thought.\n');
});

test('the front and back matter: started with its first save, then only its words change', async () => {
  const src = await vault();
  src.files.delete(MATTER);
  const index = await indexOf(src);
  const starter = starterMatter('Kyle Heath', new Date('2026-11-11T12:00:00'));
  const head = splitNote(starter).head, first = splitNote(starter).body;
  await pushAction(src, act(MATTER, words('matter', '', first, head), 'm1'));
  assert.equal(src.files.get(MATTER), starter, 'as the old way started it');
  assert.equal(src.commits[0].message, 'book matter: start for Ash Bell');
  const fresh = await indexOf(src);
  assert.equal(fresh.notes[MATTER].type, 'book-matter');
  // A page filled in later: the properties stay byte for byte.
  const opened = fresh.notes[MATTER].body.replace(/^\n+/, '');
  const next = opened.replace('## Back: About the Author\n', '## Back: About the Author\nKyle writes by a river.\n');
  const res = await pushAction(src, act(MATTER, words('matter', opened, next, head), 'm2'));
  assert.equal(src.files.get(MATTER), head + next.replace(/\s+$/, '') + '\n');
  assert.equal(src.commits[1].message, 'book matter: Ash Bell');
  assert.deepEqual(foldSaved(fresh, res.saved, schema, res.removed, res.texts).notes[MATTER], (await indexOf(src)).notes[MATTER]);
  assert.equal(index.notes[MATTER], undefined);
});

// ---- the book's draft ----

test('saving the book\'s draft is one save: every scene copied as it is, with the draft\'s note', async () => {
  const at = new Date('2026-11-11T15:00:00.000Z');
  const src = await vault();
  const index = await indexOf(src);
  const scenes = index.books.find((b) => b.folder === BOOK)!.scenes.map((p) => index.notes[p]);
  const copy = (k: number, s: { path: string }) => BOOK + '/Drafts/Draft ' + k + '/' + s.path.slice(s.path.lastIndexOf('/') + 1);
  const first = src.files.get(copy(1, scenes[0]));
  // The demo book has a Draft 1 already, so this is Draft 2.
  const res = await pushAction(src, { ...draftAction(BOOK, '', at), id: 'd1' }, { known: index.notes });
  assert.equal(src.commits.length, 1);
  assert.equal(src.commits[0].paths.length, scenes.length + 1);
  assert.equal(src.commits[0].message, 'drafts: save Draft 2 of 1 Ash Bell (' + scenes.length + ' scenes)\n\nSaved in the Sparrow app; the scene files are now Draft 3.');
  leaves('book-draft', (await vault()).files, src.files);
  scenes.forEach((s) => assert.equal(src.files.get(copy(2, s)), src.files.get(s.path), 'a copy is the scene byte for byte'));
  assert.match(src.files.get(BOOK + '/Drafts/Draft 2.md')!, new RegExp('^scenes: ' + scenes.length + '$', 'm'));
  // The app reads the number from the save's answer; the copies never join the book's notes.
  assert.ok(res.saved.some((x) => x.path === BOOK + '/Drafts/Draft 2.md'));
  const folded = foldSaved(index, res.saved, schema, res.removed, res.texts);
  assert.deepEqual(Object.keys(folded.notes).sort(), Object.keys(index.notes).sort());
  // Saved again: Draft 3, and the earlier drafts are untouched.
  const second = src.files.get(copy(2, scenes[0]));
  await pushAction(src, { ...draftAction(BOOK, '', at), id: 'd2' }, { known: index.notes });
  assert.deepEqual(savedDrafts((await src.tree()).files, BOOK).map((d) => d.number), [1, 2, 3]);
  assert.equal(src.files.get(copy(1, scenes[0])), first);
  assert.equal(src.files.get(copy(2, scenes[0])), second);
});

test('the draft is the book as the vault has it when the save is made, not as the device last saw it', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const scene = index.books.find((b) => b.folder === BOOK)!.scenes[0];
  const newer = src.files.get(scene)! + '\nA line the iPad added.\n';
  src.files.set(scene, newer);
  await pushAction(src, draftAction(BOOK), { known: index.notes });
  assert.equal(src.files.get(BOOK + '/Drafts/Draft 2/' + scene.slice(scene.lastIndexOf('/') + 1)), newer);
});

test('a book with no scenes has no draft to save', async () => {
  const src = await vault();
  await assert.rejects(pushAction(src, draftAction('Series/Ember Road/Books/9 Nothing Yet')), /This book has no scenes yet, so there is no draft to save\./);
  assert.equal(src.commits.length, 0);
});

// ---- back from the Archive ----

test('a scene comes back from the Archive in one save, and the lists follow from the save\'s answer', async () => {
  const src = await vault();
  const index0 = await indexOf(src);
  const scene = index0.books.find((b) => b.folder === BOOK)!.scenes[2];
  await pushAction(src, deleteAction(BOOK, [scene], new Date('2026-11-11T15:00:00.000Z')), { known: index0.notes });
  const index = await indexOf(src);
  const arch = archivePath(scene);
  assert.ok(src.files.has(arch) && !src.files.has(scene));
  const book = index.books.find((b) => b.folder === BOOK)!;
  assert.ok((book.archive || []).some((f) => f.path === arch));

  const archived = new Map(src.files);
  const before = src.commits.length;
  const res = await pushAction(src, restoreAction(BOOK, arch));
  assert.equal(src.commits.length, before + 1);
  assert.deepEqual(src.commits[before].paths.sort(), [arch, scene].sort());
  assert.match(src.commits[before].message, /^scenes: restore /);
  leaves('restore-scene', archived, src.files);
  const folded = foldSaved(index, res.saved, schema, res.removed, res.texts);
  const fresh = await indexOf(src);
  assert.deepEqual(folded.notes[scene], fresh.notes[scene]);
  assert.deepEqual(folded.books.find((b) => b.folder === BOOK)!.scenes, fresh.books.find((b) => b.folder === BOOK)!.scenes);
  assert.ok(!(folded.books.find((b) => b.folder === BOOK)!.archive || []).some((f) => f.path === arch), 'it has left the Archive list');
});

test('a scene whose name is in Scenes again stays in the Archive, and one that is gone says so', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const scene = index.books.find((b) => b.folder === BOOK)!.scenes[2];
  const arch = archivePath(scene);
  src.files.set(arch, archivedText(src.files.get(scene)!, 'Deleted in the Sparrow app on 2026-11-11.'));
  await assert.rejects(pushAction(src, restoreAction(BOOK, arch)), /is already in Scenes, so this one stays in the Archive\./);
  assert.equal(src.commits.length, 0);
  assert.ok(src.files.has(arch));
  await assert.rejects(pushAction(src, restoreAction(BOOK, BOOK + '/Archive/S-777 Nowhere.md')), /S-777 Nowhere is not in the Archive any more\. Press Sync and look again\./);
});

// ---- a deleted beat's words ----

test('a deleted beat\'s words go to the Archive as one file from the device, under a name of its own', async () => {
  const src = await vault();
  const path = BOOK + '/Archive/Deleted beats/Chapter 2 beat 3 The toll 2026-11-11 101500.md';
  const f = { path, taken: 'next' as const, text: '> [!note] Archived\n> Deleted.\n\nWords.\n', message: 'beats: archive chapter 2 beat 3\n\nDeleted with its words in the Sparrow app; the words as they stood are kept here.' };
  await pushAction(src, filesAction([f]));
  await pushAction(src, filesAction([{ ...f, text: 'Other words.\n' }]));
  assert.equal(src.files.get(path), f.text);
  assert.equal(src.files.get(path.replace(/\.md$/, ' (2).md')), 'Other words.\n');
  assert.equal(src.commits[0].message, f.message);
});

// ---- the series' Book look ----

test('the Book look: started with its first save, then only the lines it changes, shown as it will be saved', async () => {
  const LOOK = 'Series/Ember Road/Book Look.md';
  const start = '---\ntype: book-look\ntitle: "Book look"\nsource: Sparrow app\ncreated: 2026-11-14\n---\n';
  const look = (values: Record<string, string>): TextChange => ({ what: 'look', values, start, name: 'Ember Road' });
  const src = await vault();
  src.files.delete(LOOK);
  await pushAction(src, act(LOOK, look({ first_paragraph: 'dropcap', scene_break: 'line' }), 'l1'));
  assert.equal(src.files.get(LOOK), start.replace('\n---\n', '\nfirst_paragraph: dropcap\nscene_break: line\n---\n'));
  assert.equal(src.commits[0].message, 'book look: Ember Road\n\nChosen in the Sparrow app.');
  const res = await pushAction(src, act(LOOK, look({ first_paragraph: 'plain', scene_break: 'line' }), 'l2'));
  assert.match(src.files.get(LOOK)!, /^first_paragraph: plain$/m);
  assert.equal((await indexOf(src)).notes[LOOK].data.scene_break, 'line');
  const fresh = await indexOf(src);
  assert.deepEqual(foldSaved(fresh, res.saved, schema, res.removed, res.texts).notes[LOOK], fresh.notes[LOOK]);
  const text = src.files.get(LOOK)!;
  const edit = { type: 'text' as const, change: look({ heading_align: 'left' }) };
  assert.deepEqual(editRecord(makeNote(LOOK, 'x', text), edit), makeNote(LOOK, 'x', editText(text, edit)));
});
