import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardNotes, castFor, groupNotes, groupOrder, ideasAbout } from '../src/lib/boards.ts';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { applyToData, applyToText, changeFor, commitMessage } from '../src/lib/ideas.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { PHASE } from '../src/lib/sync.ts';
import { buildIndex, pathPattern } from '../src/lib/vault-index.ts';
import { DEMO, demoSchemaText, FsSource } from './helpers.ts';

const schema = parseSchema(demoSchemaText());
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const NOW = new Date('2026-10-17T15:40:00Z');

async function phase3() {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  const index = await buildIndex({ schema, files, read: (p, sha) => src.read(p, sha), phase: PHASE });
  return { index, book: index.books.find((b) => b.folder === BOOK)! };
}

test('the app indexes the Story Juice boards', () => {
  assert.equal(PHASE, 3);
});

test('a character pattern covers series notes and book deltas', () => {
  const re = pathPattern(schema.types.character);
  assert.ok(re.test('Series/Ember Road/Characters/Mara Quill.md'));
  assert.ok(re.test(BOOK + '/Characters/Mara Quill.md'));
  assert.ok(!re.test(BOOK + '/Ideas/I-001 Tobin Lies.md'));
});

test('a book lists its beats, conflicts and character deltas; the series lists its cast', async () => {
  const { index, book } = await phase3();
  assert.deepEqual(book.beats!.map((p) => index.notes[p].data.id), ['B-001', 'B-002', 'B-003']);
  assert.deepEqual(book.conflicts!.map((p) => index.notes[p].data.id), ['C-001', 'C-002']);
  assert.deepEqual(book.characters, [BOOK + '/Characters/Mara Quill.md']);
  assert.equal(index.series[0].characters!.length, 3);
  assert.deepEqual(index.warnings, []);
});

test('the cast lays the book delta over the series note', async () => {
  const { index, book } = await phase3();
  const cast = castFor(index, book);
  assert.deepEqual(cast.map((c) => c.name), ['Mara Quill', 'The Warden', 'Tobin Quill']);
  const mara = cast[0];
  assert.equal(mara.note.data.want_this_book, 'To prove Tobin innocent.');
  assert.match(String(mara.note.data.core_drive), /^Keep every bell/);
  assert.equal(mara.note.data.status, 'canon', 'the series status stands');
  assert.equal(mara.note.data.extends, undefined);
  assert.deepEqual(ideasAbout(index, book, 'Mara Quill').map((n) => n.data.id), ['I-005']);
});

test('boards group in the schema order, frameworks with Story Juice first', async () => {
  const { index, book } = await phase3();
  const beats = groupNotes(boardNotes(index, book, 'beat-sheet'), 'framework', groupOrder(schema, 'beat', 'framework'));
  assert.deepEqual(beats.map((g) => g.key), ['story-juice', 'save-the-cat']);
  assert.deepEqual(beats[1].notes.map((n) => n.data.id), ['B-001', 'B-002']);
  const conflicts = groupNotes(boardNotes(index, book, 'conflict-matrix'), 'source', groupOrder(schema, 'conflict', 'source'));
  assert.deepEqual(conflicts.map((g) => g.key), ['personal', 'extra-personal']);
  const juice = boardNotes(index, book, 'story-juice').map((n) => n.data.kind);
  assert.ok(juice.length > 0 && juice.every((k) => ['premise', 'big-issue', 'opinion', 'character', 'theme'].indexOf(String(k)) >= 0));
});

const SCENE = ['---', 'type: scene', 'id: S-008', 'title: The Last Ring', 'order: 8', 'status: planned', '---', 'Card notes only.', ''].join('\n');

test('accept sets the accepted time and leaves the status; needs work removes it and saves the reason', () => {
  const data = Frontmatter.parse(SCENE).data;
  const accepted = applyToText(SCENE, changeFor(data, 'accept', NOW));
  const ad = Frontmatter.parse(accepted).data;
  assert.equal(ad.status, 'planned');
  assert.match(String(ad.accepted), /^2026-10-17T\d\d:40[+-]\d\d:\d\d$/);
  assert.ok(accepted.endsWith('---\nCard notes only.\n'));

  const back = applyToText(accepted, changeFor(ad, 'rework', NOW, 'Saffron should arrive earlier.'));
  const bd = Frontmatter.parse(back).data;
  assert.equal(bd.accepted, undefined);
  assert.equal(bd.decision_note, 'Saffron should arrive earlier.');
  assert.equal(bd.status, 'planned');

  const shown = applyToData(data, changeFor(data, 'accept', NOW));
  assert.ok(shown.accepted && shown.status === 'planned');
});

test('commit messages name the board and carry no Agent trailer', () => {
  assert.equal(commitMessage({ type: 'beat', id: 'B-002', title: 'Catalyst' }, 'keep'), 'beats: keep B-002 Catalyst\n\nChosen on the Beat Sheet in the Story Forge app.');
  assert.match(commitMessage({ type: 'scene', id: 'S-008', title: 'The Last Ring' }, 'accept'), /^scenes: accept card S-008 The Last Ring\n\nChosen on the Chapter Grid/);
  assert.match(commitMessage({ type: 'conflict', id: 'C-001' }, 'drop'), /^conflicts: drop C-001/);
  assert.match(commitMessage({ id: 'I-001', title: 'Tobin Lies' }, 'keep'), /^ideas: keep I-001 Tobin Lies/);
  ['keep', 'accept', 'rework'].forEach((d) => assert.ok(!/Agent:/.test(commitMessage({ type: 'scene' }, d as 'keep'))));
});
