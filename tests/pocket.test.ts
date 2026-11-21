// Sparrow Pocket (2026-11-20): what the phone page works out from the vault (src/lib/pocket.ts), the address the square
// code carries (src/lib/settings.ts), and the Edit room's own actions that put the phone's choices in on the iPad (since
// 2026-11-21 the phone only records them; tests/phone-choices.test.ts holds the rest): the same answers, the same
// to-dos ticked, the same scene words through the writing page's save, the same reply and ask.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyChange, parseChanges, revertChange, todoEdits, tweakStatus, type Change } from '../src/lib/changes.ts';
import { openDraft } from '../src/lib/drafts.ts';
import { bookChapters, cardBooks, cardChapters, chapterKey, deck, pageText, paragraphs, readPlace, replaceParagraph, sceneFor, withPageText } from '../src/lib/pocket.ts';
import { DEFAULTS, fromPhoneLink, phoneLink } from '../src/lib/settings.ts';
import { sync } from '../src/lib/sync.ts';
import { bookTodos } from '../src/lib/todos.ts';
import type { VaultIndex } from '../src/lib/types.ts';
import { replyAction } from '../src/team/reply.ts';
import { overlayActions } from '../src/vault/apply.ts';
import { add } from '../src/vault/outbox.ts';
import { marksAction } from '../src/vault/ops.ts';
import { pushAll } from '../src/vault/push.ts';
import { saveDraft } from '../src/vault/words.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { DEMO, demoKinds, demoSchemaText, FsSource, MemSource } from './helpers.ts';

demoKinds();
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const CH1 = BOOK + '/Changes/Chapter 1 changes.md';
const S1 = BOOK + '/Scenes/S-001 The Crack.md';
const NOW = new Date('2026-11-20T15:00:00Z');

async function vault(): Promise<MemSource> {
  const disk = new FsSource(DEMO);
  const src = new MemSource();
  for (const f of (await disk.tree()).files) if (f.path.endsWith('.md') || f.path.endsWith('.json')) src.files.set(f.path, await disk.read(f.path));
  return src;
}
const indexOf = async (src: MemSource): Promise<VaultIndex> => (await sync(src, null)).index;

test('the chapters with cards, their counts, and the cards in page order', async () => {
  const index = await indexOf(await vault());
  assert.deepEqual(cardBooks(index).map((b) => b.folder), [BOOK, 'Series/Willow Lane/Books/1 Cinder Gate']);
  const book = index.books.find((b) => b.folder === BOOK)!;
  const all = bookChapters(index, book);
  assert.deepEqual(all.map((c) => [c.chapter, c.id, c.title, c.scenes.length, c.open]), [[1, 'CH-001', 'Frost', 2, 4], [2, 'CH-002', 'Thaw', 2, 0], [3, 'CH-003', 'Ledger', 2, 0], [4, 'CH-004', '', 1, 0]]);
  const ch = cardChapters(index, book);
  assert.equal(ch.length, 1);
  assert.equal(chapterKey(ch[0]), 'CH-001');
  assert.equal(chapterKey({ chapter: 7, id: '' }), 'n7');
  const d = deck(ch[0], (n) => n.body);
  // The Edit room's order: where each card's words stand on the page, not the note's order.
  assert.deepEqual(d.map((x) => x.change.id), ['C-01', 'C-03', 'C-02', 'C-04']);
  assert.ok(d.every((x) => x.scene && x.scene.path === S1));
  // A card whose words Kyle changed comes last, with no place.
  const changed = deck(ch[0], (n) => n.body.replace('a tin lantern', 'a lantern'));
  assert.deepEqual(changed.map((x) => [x.change.id, x.scene ? 'here' : 'gone']), [['C-03', 'here'], ['C-02', 'here'], ['C-04', 'here'], ['C-01', 'gone']]);
  assert.equal(sceneFor(ch[0], d[0].change, (n) => n.body)!.path, S1);
});

test('paragraphs with their cards, and one paragraph rewritten', async () => {
  const index = await indexOf(await vault());
  const book = index.books.find((b) => b.folder === BOOK)!;
  const ch = cardChapters(index, book)[0];
  const text = pageText(index.notes[S1].body);
  const ps = paragraphs(text, deck(ch, (n) => n.body));
  assert.deepEqual(ps.map((p) => p.cards.map((c) => c.id)), [['C-01'], ['C-03'], ['C-02'], ['C-04']]);
  ps.forEach((p) => assert.equal(text.slice(p.at, p.end), p.text));
  // A System screen's lines, its lone ">" included, are one paragraph.
  const sys = 'Before.\n\n> **Status**\n>\n> Level 2\n\nAfter.\n';
  assert.deepEqual(paragraphs(sys).map((p) => p.text), ['Before.', '> **Status**\n>\n> Level 2', 'After.']);
  // Only that paragraph changes; the blank lines around it stay as they were.
  const two = ps[1];
  assert.equal(replaceParagraph(text, two, '  She pressed a thumb to it.\n\n'), text.replace(two.text, '  She pressed a thumb to it.'));
  assert.equal(replaceParagraph('A.\n\nB.\n\nC.\n', { at: 4, end: 6, text: 'B.' }, ''), 'A.\n\nC.\n', 'an emptied paragraph goes with its gap');
  assert.equal(replaceParagraph('A.\n\nB.', { at: 4, end: 6, text: 'B.' }, ' '), 'A.', 'the last paragraph takes the gap before it');
  assert.throws(() => replaceParagraph(text, { ...two, at: two.at + 1 }, 'x'), /changed while you were typing/);
  assert.equal(withPageText('\n\nOld.', 'New.'), '\n\nNew.');
});

test('the square code\'s address carries the key after #, and the vault only when it is not the usual one', () => {
  const page = 'https://kylewrites33-cloud.github.io/story-forge/pocket/';
  const key = 'github_pat_FAKE_' + 'x'.repeat(70);
  const link = phoneLink({ ...DEFAULTS, token: key }, page + '#/old');
  assert.equal(link, page + '#key=' + key);
  assert.deepEqual(fromPhoneLink(new URL(link).hash), { ...DEFAULTS, token: key });
  const other = phoneLink({ owner: 'me', repo: 'vault', branch: 'draft', root: 'v', token: 'k+/=&' }, page);
  assert.match(other, /#key=k%2B%2F%3D%26&owner=me&repo=vault&branch=draft&root=v$/);
  assert.deepEqual(fromPhoneLink(other.slice(other.indexOf('#'))), { owner: 'me', repo: 'vault', branch: 'draft', root: 'v', token: 'k+/=&' });
  assert.equal(fromPhoneLink('#/c/CH-001/C-03'), null, 'Pocket\'s own addresses are not a key');
  assert.equal(fromPhoneLink('#key='), null);
  assert.equal(readPlace({ book: 'B', chapter: 'CH-001', card: 'C-03' })!.card, 'C-03');
  assert.equal(readPlace({ book: 'B' }), null);
});

test('Edit, then accept records what the Edit room records', () => {
  const c: Change = { id: 'C-03', kind: 'new', scene: 'S-001', why: '', status: 'open', was: 'a', now: 'b', other: 'c' };
  assert.equal(tweakStatus(c, 'b'), 'kept');
  assert.equal(tweakStatus(c, 'c'), 'other');
  assert.equal(tweakStatus(c, 'b!'), 'mine');
  assert.equal(tweakStatus({ ...c, other: null }, 'c'), 'mine');
});

test('a to-do ticks off when its last card goes in, and opens again on Undo', () => {
  const todo = (status: string, note = '') => ({ path: 'B/Tasks/T-002 Ferry.md', sha: '', type: 'task', data: { id: 'T-002', status, done_note: note }, body: '', error: null });
  const cards = parseChanges('## C-01 · line\nScene: S-001\nWhy: To-do T-002: the ferry.\nKyle: kept\n\nWas:\n> a\n\nNow:\n> b\n').changes;
  assert.deepEqual(todoEdits(cards, ['C-01'], [todo('open')]), [{ path: 'B/Tasks/T-002 Ferry.md', fields: { status: 'done', done_note: 'Edit room: C-01 kept.' } }]);
  const back = cards.map((c) => ({ ...c, status: 'open' as const }));
  assert.deepEqual(todoEdits(back, ['C-01'], [todo('done', 'Edit room: C-01 kept.')]), [{ path: 'B/Tasks/T-002 Ferry.md', fields: { status: 'open', done_note: '' } }]);
  assert.deepEqual(todoEdits(back, ['C-01'], [todo('done', 'Done by hand.')]), [], 'a to-do Kyle closed himself stays closed');
});

test('Use version 2 leaves the vault as the Edit room leaves it: the scene\'s words, then the answer', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const scene = index.notes[S1];
  const c = parseChanges(index.notes[CH1].body).changes.find((x) => x.id === 'C-03')!;
  // The scene through the writing page's own save, with the version's words where the card's old words are.
  const d = openDraft(scene, undefined, NOW);
  const r = applyChange(pageText(d.body), c, 'other')!;
  await saveDraft(src, { ...d, body: withPageText(d.body, r.text) }, NOW);
  // The answer on the card, through the outbox, as one save.
  const res = await pushAll(src, [marksAction(CH1, { 'C-03': 'other' }, todoEdits(parseChanges(index.notes[CH1].body).changes.map((x) => (x.id === 'C-03' ? { ...x, status: 'other' as const } : x)), ['C-03'], bookTodos(index, index.books[0])).map((t) => ({ path: t.path, decision: 'edit' as const, reason: '', at: NOW.toISOString(), fields: t.fields })), NOW)]);
  assert.equal(res.error, null);
  const was = (await vault()).files;
  const sceneText = src.files.get(S1)!;
  assert.equal(sceneText, was.get(S1)!.replace(c.was, c.other!).replace(/\nwords: 61\n/, '\nwords: 73\n'));
  assert.equal(src.files.get(CH1), was.get(CH1)!.replace('## C-03 · new\nScene: S-001\nWhy: Chapter problem: Mara never reacts to the crack before calling Tobin, so the call reads as a plot step.\nKyle: open', '## C-03 · new\nScene: S-001\nWhy: Chapter problem: Mara never reacts to the crack before calling Tobin, so the call reads as a plot step.\nKyle: other'));
  assert.deepEqual(src.commits.map((x) => x.paths), [[S1], [CH1]]);
  // Undo puts the old words back (and the answer opens again the same way).
  assert.equal(revertChange(pageText(sceneText.slice(sceneText.indexOf('\n---\n') + 5)), c, 'other'), pageText(was.get(S1)!.slice(was.get(S1)!.indexOf('\n---\n') + 5)));
});

test('Tell the Writer is the Edit room\'s reply: the Reply line and one ask a chapter, as one save', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const schema = parseSchema(demoSchemaText());
  const first = replyAction(index, [], schema, CH1, 'C-03', 'Version 2, but  she should still\nsay it.', BOOK, 1, NOW);
  assert.deepEqual(first.ops.map((o) => o.kind + ' ' + o.path.replace(/^Jobs\/J-\d+ /, 'Jobs/')), ['edit ' + CH1, 'create Jobs/New card from your reply on Chapter 1.md']);
  const job = first.ops[1];
  assert.ok(job.kind === 'create' && /kind: reply\n/.test(job.text) && /target: Chapter 1\n/.test(job.text) && job.text.includes('C-03: "Version 2, but she should still say it."'));
  // A second reply while the chapter's ask still waits for the team adds no second ask.
  const box = add([], first);
  const second = replyAction(index, box, schema, CH1, 'C-01', 'Brass, yes.', BOOK, 1, NOW);
  assert.deepEqual(second.ops.map((o) => o.kind), ['edit']);
  const shown = overlayActions(index, add(box, second), schema);
  const cards = parseChanges(shown.notes[CH1].body).changes;
  assert.deepEqual(cards.find((x) => x.id === 'C-03')!.replies, ['Version 2, but she should still say it.']);
  assert.deepEqual(cards.find((x) => x.id === 'C-01')!.replies, ['Brass, yes.']);
  assert.throws(() => replyAction(index, [], schema, CH1, 'C-03', '  ', BOOK, 1, NOW), /Write your reply first/);
  const res = await pushAll(src, [first]);
  assert.equal(res.error, null);
  assert.equal(src.commits.length, 1, 'the Reply line and the ask are one save');
  assert.match(src.files.get(CH1)!, /Kyle: open\nReply: Version 2, but she should still say it\.\n\nWas:\n> She ran a thumb/);
});
