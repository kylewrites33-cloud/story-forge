// Kyle's choices from his phone (2026-11-21): the phone note's format (src/lib/phone-choices.ts), the phone's one save
// (src/pocket/send.ts), and Sparrow putting the choices in with the Edit room's own actions (src/vault/phone.ts). The
// vault it leaves must be byte for byte the one the Edit room leaves for the same presses.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyChange, parseChanges, todoEdits, tweakStatus, type ChangeStatus } from '../src/lib/changes.ts';
import { openDraft } from '../src/lib/drafts.ts';
import { appendChoices, labelOf, newNoteText, readChoices, readNote, removeChoice, rewriteInto, setProps, setResult, type PhoneChoice } from '../src/lib/phone-choices.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { sync } from '../src/lib/sync.ts';
import { bookTodos } from '../src/lib/todos.ts';
import type { VaultIndex } from '../src/lib/types.ts';
import { sendChoices, withdrawChoice } from '../src/pocket/send.ts';
import { replyAction } from '../src/team/reply.ts';
import { foldSaved, overlayActions } from '../src/vault/apply.ts';
import { marksAction, textAction, type Action } from '../src/vault/ops.ts';
import { applyPhoneNotes, planPhone, reportLine, waitingPhoneNotes } from '../src/vault/phone.ts';
import { pushAction, pushAll } from '../src/vault/push.ts';
import { changeText } from '../src/vault/text.ts';
import { saveDraft } from '../src/vault/words.ts';
import { DEMO, demoKinds, demoSchemaText, FsSource, MemSource } from './helpers.ts';

demoKinds();
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const CH1 = BOOK + '/Changes/Chapter 1 changes.md';
const S1 = BOOK + '/Scenes/S-001 The Crack.md';
const NOW = new Date('2026-11-21T15:00:00Z');
const schema = parseSchema(demoSchemaText());

async function vault(): Promise<MemSource> {
  const disk = new FsSource(DEMO);
  const src = new MemSource();
  for (const f of (await disk.tree()).files) if (f.path.endsWith('.md') || f.path.endsWith('.json')) src.files.set(f.path, await disk.read(f.path));
  return src;
}
const indexOf = async (src: MemSource): Promise<VaultIndex> => (await sync(src, null)).index;

const base = { n: 0, chapter: 1, chapterId: 'CH-001', scene: '', words: '', was: '', now: '', made: '2026-11-21T14:00:00.000Z', result: '' };
const one = (p: Partial<PhoneChoice> & { kind: PhoneChoice['kind'] }): PhoneChoice => ({ version: 0, card: '', ...base, ...p });

/** The six presses of the test, in the order Kyle made them on the phone. */
function presses(index: VaultIndex): PhoneChoice[] {
  const cards = parseChanges(index.notes[CH1].body).changes;
  const c3 = cards.find((c) => c.id === 'C-03')!;
  return [
    one({ kind: 'use', card: 'C-01', words: cards[0].now }),
    // The paragraph as the phone showed it, with C-01's brass lantern already in.
    one({ kind: 'rewrite', scene: 'S-001', was: 'Mara climbed the tower at 5:40 with a brass lantern. The bell hung crooked on its beam.', now: 'Mara climbed the bell tower at twenty to six, brass lantern swinging.' }),
    one({ kind: 'use', card: 'C-03', version: 2, words: c3.other! }),
    one({ kind: 'tweak', card: 'C-02', words: 'She counted the winters the bell had rung through. Forty-one, if the ledger told the truth.' }),
    one({ kind: 'tell', card: 'C-03', words: 'Version 2, but she should touch the ash first.' }),
    one({ kind: 'reject', card: 'C-04' })
  ];
}

test('a phone note reads back what was written, and says what he chose in plain words', () => {
  const choices = [
    one({ n: 1, kind: 'use', card: 'C-03', version: 2, words: 'Line one.\n\n> A System line.' }),
    one({ n: 2, kind: 'rewrite', scene: 'S-001', was: 'Old.', now: '' }),
    one({ n: 3, kind: 'tell', card: 'C-01', words: 'Brass, yes.' }),
    one({ n: 4, kind: 'reject', card: 'C-04' }),
    one({ n: 5, kind: 'tweak', card: 'C-02', version: 0, words: 'Mine.' })
  ];
  const text = newNoteText('Phone choices 2026-11-21 1400', '2026-11-21T14:00:00Z', choices);
  assert.match(text, /^---\ntype: phone-choices\ntitle: Phone choices 2026-11-21 1400\nstatus: sent\ncreated: 2026-11-21\n---\n/);
  assert.match(text, /## 1 · Use version 2\nCard: C-03\nChapter: 1\nChapter ID: CH-001\nMade: 2026-11-21T14:00:00.000Z\n\nWords:\n> Line one\.\n>\n> > A System line\.\n/);
  assert.deepEqual(choices.map(labelOf), ['Use version 2', 'Rewrite a paragraph', 'Tell the Writer', 'Reject', 'Tweak']);
  const back = readNote(text);
  assert.equal(back.status, 'sent');
  assert.deepEqual(back.choices, choices);
  // The iPad's lines: a result under a choice, and the properties.
  let t = setResult(text, 2, 'skipped. The paragraph is not in S-001 exactly as your phone saw it any more.');
  t = setResult(t, 2, 'applied');
  assert.equal(readNote(t).choices[1].result, 'applied');
  assert.equal(t.split('\n').filter((l) => l.startsWith('Result:')).length, 1, 'a second result replaces the first');
  t = setProps(t, { status: 'applying', claimed: '2026-11-21T15:00:00Z' });
  assert.match(t, /status: applying\ncreated: 2026-11-21\nclaimed: 2026-11-21T15:00:00Z\n---/);
  assert.equal(readNote(setProps(t, { claimed: '' })).claimed, '');
  // The phone's lines: more choices at the end, and one taken back.
  const more = appendChoices(text, [one({ n: 6, kind: 'reject', card: 'C-05' })]);
  assert.deepEqual(readChoices(more).map((c) => c.n), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(readChoices(removeChoice(more, 3)).map((c) => c.n), [1, 2, 4, 5, 6]);
});

test('a paragraph rewrite goes in only where its words stand once', () => {
  assert.equal(rewriteInto('A.\n\nB.\n\nC.\n', 'B.', 'Bee.'), 'A.\n\nBee.\n\nC.\n');
  assert.equal(rewriteInto('A.\n\nB.\n\nC.\n', 'B.', ''), 'A.\n\nC.\n', 'an emptied paragraph goes with its gap');
  assert.equal(rewriteInto('A.\n\nB.\n\nB.\n', 'B.', 'x'), null, 'twice: the iPad cannot tell which');
  assert.equal(rewriteInto('A.\n', 'B.', 'x'), null);
});

test('a note is claimed once: another device leaves it for ten minutes, then may take over', () => {
  const text = newNoteText('Phone choices 2026-11-21 1400', '2026-11-21T14:00:00Z', [one({ n: 1, kind: 'reject', card: 'C-04' })]);
  const claimed = changeText(text, { what: 'phone-claim', at: '2026-11-21T15:00:00.000Z' });
  assert.equal(readNote(claimed).status, 'applying');
  assert.equal(readNote(claimed).claimed, '2026-11-21T15:00:00Z');
  assert.equal(changeText(claimed, { what: 'phone-claim', at: '2026-11-21T15:09:00.000Z' }), claimed, 'nine minutes on, it is left alone');
  assert.equal(readNote(changeText(claimed, { what: 'phone-claim', at: '2026-11-21T15:11:00.000Z' })).claimed, '2026-11-21T15:11:00Z');
  const done = changeText(claimed, { what: 'phone-results', results: [{ n: 1, result: 'applied' }], at: '2026-11-21T15:01:00.000Z' });
  assert.equal(readNote(done).status, 'applied');
  assert.match(done, /applied: 2026-11-21T15:01:00Z/);
  assert.doesNotMatch(done, /claimed:/);
  assert.equal(changeText(done, { what: 'phone-claim', at: '2026-11-21T16:00:00.000Z' }), done, 'an applied note is never claimed again');
});

test('the phone adds to its own note while it may, then starts a new one, and Undo takes a choice off only in time', async () => {
  const src = await vault();
  const before = new Map(src.files);
  const first = await sendChoices(src, BOOK, 'Ash Bell', '', [one({ kind: 'reject', card: 'C-04' })], NOW);
  assert.equal(first.path, BOOK + '/Phone/Phone choices 2026-11-21 1500.md');
  assert.deepEqual(first.numbers, [1]);
  // Nothing else in the vault changed: one new file under Phone/.
  const changed = [...src.files.keys()].filter((p) => before.get(p) !== src.files.get(p));
  assert.deepEqual(changed, [first.path]);
  assert.match(src.commits[0].message, /^phone: 1 choice from Kyle's phone for Ash Bell/);
  const second = await sendChoices(src, BOOK, 'Ash Bell', first.path, [one({ kind: 'use', card: 'C-01', words: 'a brass lantern' }), one({ kind: 'reject', card: 'C-02' })], NOW);
  assert.equal(second.path, first.path, 'added to the same note');
  assert.deepEqual(second.numbers, [2, 3]);
  assert.equal(await withdrawChoice(src, first.path, 3), true);
  assert.deepEqual(readChoices(src.files.get(first.path)!).map((c) => c.n), [1, 2]);
  // An iPad has started on it: the phone neither takes back nor adds; it starts a new note.
  src.files.set(first.path, changeText(src.files.get(first.path)!, { what: 'phone-claim', at: NOW.toISOString() }));
  assert.equal(await withdrawChoice(src, first.path, 2), false);
  const third = await sendChoices(src, BOOK, 'Ash Bell', first.path, [one({ kind: 'reject', card: 'C-03' })], NOW);
  assert.equal(third.path, BOOK + '/Phone/Phone choices 2026-11-21 1500 (2).md');
  assert.deepEqual(third.numbers, [1]);
  assert.deepEqual(readChoices(src.files.get(first.path)!).map((c) => c.n), [1, 2], 'the claimed note is left as it was');
});

/** Put a book's phone notes in as the app does, against a MemSource. */
async function putIn(src: MemSource, now = NOW) {
  let idx = await indexOf(src);
  const sent: string[] = [];
  const rep = await applyPhoneNotes({
    source: src, sourceKey: 'mem', schema, book: idx.books.find((b) => b.folder === BOOK)!,
    index: () => idx, waiting: () => [],
    send: async (actions: Action[]) => { const r = await pushAll(src, actions); assert.equal(r.error, null); sent.push(...actions.map((a) => a.ops.map((o) => o.path).join(' + '))); },
    fold: async (saved) => { idx = foldSaved(idx, saved, schema); },
    now: () => now
  });
  return { rep, sent };
}

test('the iPad puts the phone\'s choices in exactly as the Edit room does for the same presses', async () => {
  // The phone: six presses, sent as one note.
  const phone = await vault();
  const list = presses(await indexOf(phone));
  const sent = await sendChoices(phone, BOOK, 'Ash Bell', '', list, NOW);
  const { rep } = await putIn(phone);
  assert.ok(rep);
  assert.deepEqual(rep!.results.map((r) => r.what + ': ' + r.result), [
    'Accept on C-01: applied', 'Rewrite a paragraph in S-001: applied', 'Use version 2 on C-03: applied',
    'Tweak on C-02: applied', 'Tell the Writer on C-03: applied', 'Reject on C-04: applied']);
  assert.equal(reportLine(rep!.results), '6 choices from your phone applied.');
  const note = readNote(phone.files.get(sent.path)!);
  assert.equal(note.status, 'applied');
  assert.ok(note.choices.every((c) => c.result === 'applied'));

  // The Edit room: the same presses on a fresh copy of the vault, through its own actions.
  const room = await vault();
  const index = await indexOf(room);
  const book = index.books.find((b) => b.folder === BOOK)!;
  let page = openDraft(index.notes[S1], undefined, NOW);
  let text = page.body.replace(/^\n+/, '');
  const lead = page.body.slice(0, page.body.length - text.length);
  let cards = parseChanges(index.notes[CH1].body).changes;
  const actions: Action[] = [];
  const mark = (id: string, status: ChangeStatus) => {
    cards = cards.map((x) => (x.id === id ? { ...x, status } : x));
    const shown = actions.length ? foldAll(index, actions) : index;
    const ticks = todoEdits(cards, [id], bookTodos(shown, book));
    actions.push(marksAction(CH1, { [id]: status }, ticks.map((t) => ({ path: t.path, decision: 'edit' as const, reason: '', at: NOW.toISOString(), fields: t.fields })), NOW));
  };
  const card = (id: string) => cards.find((x) => x.id === id)!;
  text = applyChange(text, card('C-01'), 'now')!.text; mark('C-01', 'kept');
  text = rewriteInto(text, list[1].was, list[1].now)!;
  text = applyChange(text, card('C-03'), 'other')!.text; mark('C-03', 'other');
  text = applyChange(text, { ...card('C-02'), now: list[3].words }, 'now')!.text; mark('C-02', tweakStatus(card('C-02'), list[3].words));
  actions.push(replyAction(index, actions, schema, CH1, 'C-03', list[4].words, BOOK, 1, NOW));
  mark('C-04', 'no');
  page = { ...page, body: lead + text };
  await saveDraft(room, page, NOW);
  assert.equal((await pushAll(room, actions)).error, null);

  // Every note the same, byte for byte; the only file the phone way adds is its own note.
  const paths = new Set([...phone.files.keys(), ...room.files.keys()]);
  const differ = [...paths].filter((p) => phone.files.get(p) !== room.files.get(p));
  assert.deepEqual(differ, [sent.path]);
  assert.ok(room.files.get(S1)!.includes('Mara climbed the bell tower at twenty to six, brass lantern swinging.'));

  // Applying again does nothing: the note is applied.
  const commits = phone.commits.length;
  assert.equal((await putIn(phone)).rep, null);
  assert.equal(phone.commits.length, commits);
});

/** The vault with these actions in, as the Edit room's screens see it. */
const foldAll = (index: VaultIndex, actions: Action[]): VaultIndex => overlayActions(index, actions, schema);

test('a choice that no longer fits is skipped, never forced, and each result is written on the note', async () => {
  const src = await vault();
  const list = presses(await indexOf(src));
  const sent = await sendChoices(src, BOOK, 'Ash Bell', '', [list[0], list[5]], NOW);
  // Between the phone and the iPad: C-04 accepted on the iPad, and C-01's words changed by hand.
  const idx = await indexOf(src);
  await pushAction(src, marksAction(CH1, { 'C-04': 'kept' }, [], NOW));
  const scene = idx.notes[S1];
  const d = openDraft(scene, undefined, NOW);
  await saveDraft(src, { ...d, body: d.body.replace('a tin lantern', 'an old tin lantern') }, NOW);
  const { rep } = await putIn(src);
  assert.deepEqual(rep!.results.map((r) => r.result), [
    'skipped. The words C-01 changes are not on the page as it quotes them any more.',
    'skipped. C-04 was already decided here (accepted).']);
  assert.equal(reportLine(rep!.results), '0 choices from your phone applied. 2 skipped.');
  const note = src.files.get(sent.path)!;
  assert.equal(readNote(note).status, 'applied', 'skipped is a result too: the note is done');
  assert.match(note, /Result: skipped\. C-04 was already decided here \(accepted\)\./);
  assert.match(src.files.get(CH1)!, /## C-01 · small\nScene: S-001\nWhy: [^\n]*\nKyle: open/, 'C-01 stays open for Kyle');
});

test('safe when interrupted, when another device is at it, and when the phone adds meanwhile', async () => {
  const src = await vault();
  const list = presses(await indexOf(src));
  const sent = await sendChoices(src, BOOK, 'Ash Bell', '', [list[0], list[5]], NOW);
  // Another device claimed it a minute ago and is still at it: this one leaves it.
  src.files.set(sent.path, changeText(src.files.get(sent.path)!, { what: 'phone-claim', at: new Date(NOW.getTime() - 60000).toISOString() }));
  assert.equal((await putIn(src)).rep, null);
  // That device stopped halfway, after the answers went up but before the results: ten minutes on, this one takes over,
  // finds them already so, and makes nothing twice.
  await pushAction(src, marksAction(CH1, { 'C-04': 'no' }, [], NOW));
  const later = new Date(NOW.getTime() + 11 * 60000);
  const { rep, sent: saved } = await putIn(src, later);
  assert.deepEqual(rep!.results.map((r) => r.result), ['applied', 'applied (it was already so)']);
  assert.equal(saved.length, 1, 'only C-01 went up; C-04 was not answered twice');
  assert.ok(saved[0].startsWith(CH1));
  assert.equal(parseChanges(src.files.get(CH1)!.slice(src.files.get(CH1)!.indexOf('\n---\n') + 5)).changes.find((c) => c.id === 'C-04')!.status, 'no');
  // The phone adds while the iPad is between reading and writing: the new choice waits for the next run.
  const src2 = await vault();
  const s2 = await sendChoices(src2, BOOK, 'Ash Bell', '', [list[5]], NOW);
  const idx2 = await indexOf(src2);
  const plan = planPhone(idx2, [], schema, idx2.books.find((b) => b.folder === BOOK)!, readChoices(idx2.notes[s2.path].body).map((c) => ({ ...c, note: s2.path })), (n) => n.body, NOW);
  await sendChoices(src2, BOOK, 'Ash Bell', s2.path, [one({ kind: 'reject', card: 'C-02' })], NOW);
  await pushAll(src2, plan.actions);
  await pushAction(src2, textAction([{ path: s2.path, change: { what: 'phone-results', results: plan.results.map((r) => ({ n: r.n, result: r.result })), at: NOW.toISOString() } }], [], NOW));
  const after = readNote(src2.files.get(s2.path)!);
  assert.equal(after.status, 'sent', 'one choice still has no result');
  assert.deepEqual(after.choices.map((c) => c.n + ':' + c.result), ['1:applied', '2:']);
  assert.equal(waitingPhoneNotes(await indexOf(src2), BOOK).length, 1);
  const third = await sendChoices(src2, BOOK, 'Ash Bell', s2.path, [one({ kind: 'reject', card: 'C-03' })], NOW);
  assert.notEqual(third.path, s2.path, 'once the iPad has written a result, the phone starts a new note');
  const { rep: rest } = await putIn(src2);
  assert.deepEqual(rest!.results.map((r) => r.what + ': ' + r.result), ['Reject on C-02: applied', 'Reject on C-03: applied']);
});
