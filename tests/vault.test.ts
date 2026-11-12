// The one saving system (src/vault): actions wait in the outbox, show at once, and go up as one save each.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { blobSha, fromBase64, GitHubSource, toBase64 } from '../src/lib/github.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { DEFAULTS } from '../src/lib/settings.ts';
import { buildIndex, makeNote } from '../src/lib/vault-index.ts';
import type { Choice } from '../src/vault/choice.ts';
import { editRecord, editText, foldSaved, overlayActions } from '../src/vault/apply.ts';
import { choiceAction, createAction, marksAction, type Edit } from '../src/vault/ops.ts';
import { add, choicesOf, landedOf, loadLanded, loadOutbox, saveLanded, saveOutbox, settle, waitingCount, waitingOf } from '../src/vault/outbox.ts';
import { pushAction, pushAll } from '../src/vault/push.ts';
import { parseChanges } from '../src/lib/changes.ts';
import { taskNotes } from '../src/lib/tasks.ts';
import { bookTodos } from '../src/lib/todos.ts';
import { sync } from '../src/lib/sync.ts';
import { DEMO, demoSchemaText, FsSource, MemSource } from './helpers.ts';

const AT = '2026-11-11T15:00:00.000Z';
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const S6 = BOOK + '/Scenes/S-006 Thaw Market.md';
const S7 = BOOK + '/Scenes/S-007 Ledger.md';
const scene = (id: string, title: string, ch: number, chTitle: string, order: number) =>
  '---\ntype: scene\nid: ' + id + '\ntitle: ' + title + '\nstatus: drafted\nchapter: ' + ch + (chTitle ? '\nchapter_title: ' + chTitle : '') + '\norder: ' + order + '\nwords: 5\n---\n\nThe market smelled of wet rope.\n';
const IDEA = '---\ntype: idea\nid: I-008\ntitle: Chapter groupings\nkind: structure\nstatus: inbox\ncreated: 2026-10-17\n---\n\nBody.\n';
const move = (path: string, order: number, chapter: number, chapterTitle = ''): Choice => ({ path, decision: 'move', reason: '', at: AT, move: { order, chapter, chapterTitle } });
const edit = (path: string, fields: Record<string, string>): Choice => ({ path, decision: 'edit', reason: '', at: AT, fields });
const decide = (path: string, decision: Choice['decision'], reason = ''): Choice => ({ path, decision, reason, at: AT });

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const store = () => new MemStorage() as unknown as Storage;

// ---- what an edit does: the screen's form and the saved form agree ----

test('an edit does the same to a note on screen as it does to the note\'s saved text, for every demo note', async () => {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  const notes = files.filter((f) => f.path.endsWith('.md') && !f.path.startsWith('.'));
  const edits = (path: string): Edit[] => [
    decide(path, 'keep', 'Fits the book.'), decide(path, 'later'), decide(path, 'drop', 'Too mean: he is "kind".'), decide(path, 'inbox'),
    move(path, 2.5, 4, 'A new name'), move(path, 9, 2), edit(path, { headline: 'She counts the nets: two short.', title: 'Nets' }), edit(path, { status: 'done' })
  ].map((choice) => ({ type: 'choice' as const, choice }));
  let checked = 0;
  for (const f of notes) {
    const text = await src.read(f.path);
    const note = makeNote(f.path, f.sha, text);
    if (note.error || !note.type) continue;
    for (const e of edits(f.path)) {
      const onScreen = editRecord(note, e).data;
      const saved = makeNote(f.path, 'x', editText(text, e)).data;
      Object.keys({ ...onScreen, ...saved }).forEach((k) => {
        const a = onScreen[k], b = saved[k];
        const what = e.type === 'choice' ? e.choice.decision : e.type;
        if (a == null || a === '') { assert.ok(b == null || b === '', f.path + ' ' + what + ': ' + k + ' should be empty, saved as ' + JSON.stringify(b)); return; }
        assert.equal(String(b), String(a), f.path + ' ' + what + ': ' + k);
      });
      checked++;
    }
    // The body is never touched by a choice.
    assert.equal(makeNote(f.path, 'x', editText(text, edits(f.path)[0])).body, note.body);
  }
  assert.ok(checked > 100, 'checked ' + checked);
});

test('waiting actions show on every screen at once', async () => {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  const index = await buildIndex({ schema: parseSchema(demoSchemaText()), files, read: (p, sha) => src.read(p, sha) });
  const book = index.books.find((b) => b.folder === BOOK)!;
  const s6 = book.scenes.find((p) => p.includes('S-006'))!;
  const s7 = book.scenes.find((p) => p.includes('S-007'))!;
  const choices = [move(s6, 1.5, 1, 'Frost'), decide(s7, 'keep', 'Yes.'), edit(s6, { headline: 'Rope and thaw.' })];
  const shown = overlayActions(index, [choiceAction([choices[0]]), choiceAction([choices[1], choices[2]])]);
  assert.deepEqual([shown.notes[s6].data.order, shown.notes[s6].data.chapter, shown.notes[s6].data.chapter_title, shown.notes[s6].data.headline], [1.5, 1, 'Frost', 'Rope and thaw.']);
  assert.equal(shown.notes[s7].data.status, 'keep');
  assert.equal(shown.notes[s7].data.decision_note, 'Yes.');
  assert.deepEqual(shown.books.find((b) => b.folder === BOOK)!.scenes.slice(0, 3).map((p) => shown.notes[p].data.id), ['S-001', 'S-006', 'S-002']);
  assert.equal(index.notes[s6].data.chapter, 3, 'the saved copy itself is untouched');
  assert.equal(overlayActions(index, []), index);
});

// ---- the outbox ----

test('a newer choice replaces a waiting one in its place; edits join; an action left empty goes', () => {
  let box = add([], choiceAction([decide('a.md', 'later')]));
  box = add(box, choiceAction([decide('a.md', 'keep')]));
  assert.deepEqual(choicesOf(box).map((c) => c.decision), ['keep']);
  box = add(box, choiceAction([edit('a.md', { turn: 'T' })]));
  box = add(box, choiceAction([move('a.md', 2, 1)]));
  box = add(box, choiceAction([edit('a.md', { hook: 'H' })]));
  assert.deepEqual(choicesOf(box).map((c) => c.decision), ['keep', 'move', 'edit']);
  assert.deepEqual(choicesOf(box)[2].fields, { turn: 'T', hook: 'H' });
  assert.deepEqual(choicesOf(box), [decide('a.md', 'keep'), move('a.md', 2, 1), edit('a.md', { turn: 'T', hook: 'H' })]);
});

test('an action of several notes loses only the part a newer action replaces', () => {
  const rename = choiceAction([edit('s1.md', { chapter_title: 'Frost' }), edit('s2.md', { chapter_title: 'Frost' })]);
  let box = add([], rename);
  box = add(box, choiceAction([edit('s2.md', { chapter_title: 'Thaw' })]));
  assert.equal(box.length, 2);
  assert.equal(box[0].id, rename.id);
  assert.deepEqual(box[0].ops.map((o) => o.path), ['s1.md']);
  assert.deepEqual(choicesOf(box).map((c) => [c.path, c.fields!.chapter_title]), [['s1.md', 'Frost'], ['s2.md', 'Thaw']]);
});

test('the outbox is kept on the device, and choices from the old queue move into it once', () => {
  const s = store();
  s.setItem('story-forge.queue.k', JSON.stringify([decide('a.md', 'keep', 'Mine.'), move('b.md', 3, 2)]));
  const first = loadOutbox('k', s);
  assert.deepEqual(choicesOf(first), [decide('a.md', 'keep', 'Mine.'), move('b.md', 3, 2)]);
  assert.equal(s.getItem('story-forge.queue.k'), null, 'the old queue is emptied');
  const again = loadOutbox('k', s);
  assert.deepEqual(again, first, 'and nothing is added twice');
  saveOutbox('k', [], s);
  assert.deepEqual(loadOutbox('k', s), []);
  assert.deepEqual(loadOutbox('other', s), []);
  s.setItem('story-forge.outbox.k', '{not json');
  assert.deepEqual(loadOutbox('k', s), []);
});

test('after a push, saved actions leave, failed ones keep their sentence, and ones added meanwhile stay', () => {
  const a = choiceAction([decide('a.md', 'keep')]), b = choiceAction([decide('b.md', 'keep')]), c = choiceAction([decide('c.md', 'keep')]);
  const left = settle([a, b, c], [a.id], { [b.id]: 'GitHub answered 500.' });
  assert.deepEqual(left.map((x) => x.id), [b.id, c.id]);
  assert.equal(left[0].error, 'GitHub answered 500.');
  assert.equal(choicesOf(left)[0].error, 'GitHub answered 500.');
  assert.equal(left[1].error, undefined);
});

// ---- sending it up ----

test('one action is one save, however many notes it touches', async () => {
  const src = new MemSource();
  src.files.set(S6, scene('S-006', 'Thaw Market', 3, 'Ledger', 6));
  src.files.set(S7, scene('S-007', 'Ledger', 3, '', 7));
  // The card that named chapter 3 moves to chapter 1; the next card in chapter 3 takes the name on.
  const { saved } = await pushAction(src, choiceAction([move(S6, 1.5, 1, 'Frost'), move(S7, 7, 3, 'Ledger')]));
  assert.equal(src.commits.length, 1);
  assert.deepEqual(src.commits[0].paths, [S6, S7]);
  assert.match(src.commits[0].message, /^scenes: move S-006 Thaw Market\n\nSaved together with:\n- scenes: move S-007 Ledger\n/);
  assert.ok(!/Agent:/.test(src.commits[0].message), 'the save is Kyle\'s');
  assert.match(src.files.get(S6)!, /^chapter: 1$/m);
  assert.match(src.files.get(S7)!, /^chapter_title: Ledger$/m);
  assert.deepEqual(saved.map((n) => [n.path, n.sha]), [[S6, src.sha(src.files.get(S6)!)], [S7, src.sha(src.files.get(S7)!)]]);
  assert.equal(saved[0].data.chapter_title, 'Frost');
});

test('if the vault changed while the save was being made, the change is made again on the newer note', async () => {
  const src = new MemSource();
  src.files.set('Ideas/I-008.md', IDEA);
  src.race = () => src.files.set('Ideas/I-008.md', IDEA.replace('Body.', 'Body.\n\nThe team added a line.'));
  const { saved: [note] } = await pushAction(src, choiceAction([decide('Ideas/I-008.md', 'keep', 'Matches my breaks.')]));
  assert.equal(src.builds, 2, 'planned twice');
  assert.equal(src.commits.length, 1);
  assert.match(src.files.get('Ideas/I-008.md')!, /^status: keep$/m);
  assert.ok(src.files.get('Ideas/I-008.md')!.endsWith('The team added a line.\n'), 'the team\'s line is kept');
  assert.equal(note.data.status, 'keep');
  assert.ok(note.body.includes('The team added a line.'));
});

test('two changes to one note in one action build on each other; a change that changes nothing saves nothing', async () => {
  const src = new MemSource();
  src.files.set(S6, scene('S-006', 'Thaw Market', 3, 'Ledger', 6));
  await pushAction(src, choiceAction([move(S6, 2, 2), edit(S6, { headline: 'Rope.' })]));
  assert.equal(src.commits.length, 1);
  assert.match(src.files.get(S6)!, /^chapter: 2$/m);
  assert.match(src.files.get(S6)!, /^headline: Rope\.$/m);
  const { saved: [same] } = await pushAction(src, choiceAction([edit(S6, { headline: 'Rope.' })]));
  assert.equal(src.commits.length, 1, 'nothing new to save');
  assert.equal(same.sha, src.sha(src.files.get(S6)!));
  assert.equal(same.data.headline, 'Rope.');
});

test('offline stops the outbox and keeps everything; a missing note lets its change go; other failures keep theirs', async () => {
  const src = new MemSource();
  src.files.set('a.md', IDEA);
  src.files.set('c.md', IDEA);
  const a = choiceAction([decide('a.md', 'keep')]), gone = choiceAction([decide('gone.md', 'keep')]), c = choiceAction([decide('c.md', 'drop')]);
  src.offline = true;
  const off = await pushAll(src, [a, gone, c]);
  assert.deepEqual([off.done, off.failed, off.saved.length], [[], {}, 0]);
  assert.match(off.error!, /Cannot reach GitHub/);
  assert.equal(settle([a, gone, c], off.done, off.failed).length, 3);
  src.offline = false;
  const on = await pushAll(src, [a, gone, c]);
  assert.deepEqual(on.done, [a.id, gone.id, c.id]);
  assert.equal(on.error, null);
  assert.deepEqual(on.saved.map((n) => [n.path, n.data.status]), [['a.md', 'keep'], ['c.md', 'discard']]);
  // A failure that is not the connection: that action waits with its sentence, the others still go.
  const broken = new MemSource();
  broken.files.set('a.md', IDEA);
  broken.files.set('c.md', IDEA);
  const real = broken.commit.bind(broken);
  broken.commit = (build) => real((head) => build({ ...head, read: async (p) => {
    if (p === 'a.md') throw Object.assign(new Error('GitHub answered 500 while saving a.md. Try again in a minute.'), { status: 500 });
    return head.read(p);
  } }));
  const res = await pushAll(broken, [a, c]);
  assert.deepEqual(res.done, [c.id]);
  assert.match(res.failed[a.id], /500/);
  assert.match(broken.files.get('c.md')!, /^status: discard$/m);
  assert.match(broken.files.get('a.md')!, /^status: inbox$/m);
});

test('actions that waited together go up as one save, forty at most; one alone is its own save', async () => {
  const src = new MemSource();
  const acts = Array.from({ length: 45 }, (_, i) => {
    src.files.set('Ideas/I-' + i + '.md', IDEA.replace('I-008', 'I-' + String(i).padStart(3, '0')));
    return choiceAction([decide('Ideas/I-' + i + '.md', i % 2 ? 'keep' : 'drop')]);
  });
  // The same idea twice in the backlog: the later action builds on the earlier one inside the one save.
  acts.push(choiceAction([edit('Ideas/I-0.md', { title: 'A better name' })]));
  const res = await pushAll(src, acts);
  assert.equal(res.error, null);
  assert.deepEqual(res.done, acts.map((a) => a.id));
  assert.deepEqual(src.commits.map((c) => c.paths.length), [40, 6]);
  assert.match(src.commits[0].message, /^ideas: drop I-000 Chapter groupings\n\nSaved together with:\n- ideas: keep I-001 Chapter groupings\n/);
  assert.match(src.files.get('Ideas/I-0.md')!, /^status: discard$/m);
  assert.match(src.files.get('Ideas/I-0.md')!, /^title: A better name$/m);
  assert.equal(res.saved.filter((n) => n.path === 'Ideas/I-0.md').pop()!.data.title, 'A better name');
  await pushAll(src, [choiceAction([decide('Ideas/I-7.md', 'later')])]);
  assert.deepEqual(src.commits[2].paths, ['Ideas/I-7.md']);
});

test('when GitHub says slow down, everything waits and nothing is marked as failed', async () => {
  const gh = fakeGitHub({ 'vault/a.md': IDEA, 'vault/b.md': IDEA });
  let slow = true;
  const src = new GitHubSource(settings, async (url, init) => (slow && init && init.method === 'POST'
    ? new Response('{"message":"You have exceeded a secondary rate limit."}', { status: 403, headers: { 'retry-after': '60' } }) : gh.fetch(url, init)));
  const acts = [choiceAction([decide('a.md', 'keep')]), choiceAction([decide('b.md', 'drop')])];
  const res = await pushAll(src, acts);
  assert.match(res.error!, /asked the app to slow down/);
  assert.deepEqual([res.done, res.failed], [[], {}]);
  assert.equal(gh.state.head, 'c0');
  slow = false;
  const ok = await pushAll(src, acts);
  assert.deepEqual(ok.done, acts.map((a) => a.id));
  assert.equal(gh.commits.get(gh.state.head)!.parent, 'c0', 'one save for both');
  // A token that may not write is a real failure, said plainly, and each action keeps it.
  const denied = new GitHubSource(settings, async (url, init) => (init && init.method === 'POST' ? new Response('{}', { status: 403 }) : gh.fetch(url, init)));
  const no = await pushAll(denied, [choiceAction([decide('a.md', 'later')])]);
  assert.match(Object.values(no.failed)[0], /not allowed to change/);
});

// ---- new notes ----

const TASK = (id: string, title: string) => '---\ntype: task\nid: ' + id + '\ntitle: ' + title + '\nowner: Kyle\nstatus: open\ncreated: 2026-11-01\n---\n\nBody.\n';
const NOW = new Date('2026-11-11T15:00:00');
const newTask = (title: string) => ({ t: { title, owner: 'Kyle', due: '', body: '' }, at: NOW.toISOString() });

test('a new to-do shows at once, in the list where its kind goes, before it is saved', async () => {
  const src = new FsSource(DEMO);
  const schema = parseSchema(demoSchemaText());
  const snap = await sync(src, null);
  const files = Object.keys(snap.index.notes).map((path) => ({ path, sha: '' }));
  const a = createAction('task', newTask('Email the cover artist: brief'), files, NOW);
  const b = createAction('todo', { book: BOOK, t: { title: 'Check the lantern', chapter: 2, scene: '' }, at: NOW.toISOString() }, files, NOW);
  assert.equal(a.ops[0].path, 'Tasks/T-003 Email the cover artist brief.md');
  assert.equal(b.ops[0].path, BOOK + '/Tasks/T-004 Check the lantern.md');
  let box = add(add([], a), b);
  // Ticked done before it has gone up: an ordinary edit, on the note as shown.
  box = add(box, choiceAction([edit(a.ops[0].path, { status: 'done' })]));
  const shown = overlayActions(snap.index, box, schema);
  assert.deepEqual(taskNotes(shown).filter((n) => !n.path.startsWith('Series/')).map((n) => [n.data.id, n.data.status]).slice(-1), [['T-003', 'done']]);
  assert.equal(shown.notes[a.ops[0].path].data.title, 'Email the cover artist: brief', 'the note keeps every word');
  const book = shown.books.find((x) => x.folder === BOOK)!;
  assert.deepEqual(bookTodos(shown, book).map((n) => n.data.id).sort(), ['T-001', 'T-002', 'T-003', 'T-004']);
  // What a sync learned from the vault's other files is still there, and the saved copy is untouched.
  const was = snap.index.books.find((x) => x.folder === BOOK)!;
  assert.deepEqual([book.cover, book.archive, book.drafts, book.rewrite, book.scenes], [was.cover, was.archive, was.drafts, was.rewrite, was.scenes]);
  assert.equal(shown.team, snap.index.team);
  assert.equal(snap.index.notes[a.ops[0].path], undefined);
  assert.equal(waitingCount(box), 3);
  assert.deepEqual(Object.keys(waitingOf(box)).sort(), [a.ops[0].path, b.ops[0].path].sort());
  // A second new to-do made while the first still waits takes the next number, not the same one.
  const more = createAction('task', newTask('Another'), files.concat(box.flatMap((x) => x.ops.filter((o) => o.kind === 'create').map((o) => ({ path: o.path, sha: '' })))), NOW);
  assert.equal(more.ops[0].path, 'Tasks/T-004 Another.md');
  assert.throws(() => createAction('task', newTask('  '), files, NOW), /Give the to-do a title first/);
});

test('a new to-do is saved with the ID it was shown with, and what waited for it goes up in the same save', async () => {
  const src = new MemSource();
  src.files.set('Tasks/T-001 First.md', TASK('T-001', 'First'));
  const a = createAction('task', newTask('Second: with a colon'), (await src.tree()).files, NOW);
  const res = await pushAll(src, [a, choiceAction([edit(a.ops[0].path, { status: 'doing' })])]);
  assert.equal(res.error, null);
  assert.deepEqual(res.renames, {});
  assert.equal(src.commits.length, 1);
  assert.deepEqual(src.commits[0].paths, ['Tasks/T-002 Second with a colon.md']);
  assert.match(src.commits[0].message, /^tasks: add T-002 Second with a colon\n\nSaved together with:\n- tasks: doing T-002 Second: with a colon\n\nAdded on the To-do list in the Sparrow app\.$/);
  const text = src.files.get('Tasks/T-002 Second with a colon.md')!;
  assert.match(text, /^id: T-002$/m);
  assert.match(text, /^status: doing$/m);
  assert.match(text, /^created: 2026-11-11$/m);
  assert.deepEqual(res.saved.map((n) => [n.path, n.sha, n.data.status]), [['Tasks/T-002 Second with a colon.md', src.sha(text), 'doing']]);
});

test('a new to-do whose save landed but whose answer was lost is not added twice', async () => {
  const src = new MemSource();
  src.files.set('Tasks/T-001 First.md', TASK('T-001', 'First'));
  const a = createAction('task', newTask('Only once'), (await src.tree()).files, NOW);
  const tick = choiceAction([edit(a.ops[0].path, { status: 'doing' })]);
  // The first try lands in the vault; the device never hears, so both actions still wait and go up again.
  assert.equal((await pushAll(src, [a, tick])).error, null);
  const after = new Map(src.files);
  const again = await pushAll(src, [a, tick]);
  assert.equal(again.error, null);
  assert.deepEqual(again.done, [a.id, tick.id]);
  assert.deepEqual(again.renames, {});
  assert.deepEqual([...src.files], [...after], 'nothing new in the vault');
  assert.deepEqual(again.saved.map((n) => [n.path, n.data.status]).slice(-1), [['Tasks/T-002 Only once.md', 'doing']]);
  // Alone too, and a different to-do with the same number is still a different note.
  assert.deepEqual((await pushAll(src, [a])).renames, {});
  assert.equal(src.files.size, 2);
  const other = createAction('task', newTask('Another one'), [{ path: 'Tasks/T-001 First.md', sha: '' }], NOW);
  assert.equal(other.ops[0].path, 'Tasks/T-002 Another one.md');
  assert.deepEqual((await pushAll(src, [other])).renames, { 'Tasks/T-002 Another one.md': 'Tasks/T-003 Another one.md' });
  assert.equal(src.files.size, 3);
});

test('if another note took the ID while the to-do waited, it takes the next one and what waits for it follows', async () => {
  const src = new MemSource();
  src.files.set('Tasks/T-001 First.md', TASK('T-001', 'First'));
  const a = createAction('task', newTask('Mine'), (await src.tree()).files, NOW);
  const b = createAction('task', newTask('Mine too'), (await src.tree()).files.concat({ path: a.ops[0].path, sha: '' }), NOW);
  assert.deepEqual([a.ops[0].path, b.ops[0].path], ['Tasks/T-002 Mine.md', 'Tasks/T-003 Mine too.md']);
  const tick = choiceAction([edit(a.ops[0].path, { status: 'done' })]);
  // While Kyle was offline the team filed its own T-002, in a folder under Tasks.
  src.files.set('Tasks/Team/T-002 Theirs.md', TASK('T-002', 'Theirs'));
  // Each on its own, as when they are added one after the other online.
  const first = await pushAll(src, [a]);
  assert.deepEqual(first.renames, { 'Tasks/T-002 Mine.md': 'Tasks/T-003 Mine.md' });
  assert.match(src.files.get('Tasks/T-003 Mine.md')!, /^id: T-003$/m);
  const left = settle([a, b, tick], first.done, first.failed, first.renames);
  assert.deepEqual(left.map((x) => x.ops[0].path), ['Tasks/T-003 Mine too.md', 'Tasks/T-003 Mine.md']);
  assert.equal((left[1].ops[0] as { edit: { choice: Choice } }).edit.choice.path, 'Tasks/T-003 Mine.md');
  const second = await pushAll(src, left);
  assert.deepEqual(second.renames, { 'Tasks/T-003 Mine too.md': 'Tasks/T-004 Mine too.md' });
  assert.deepEqual([...src.files.keys()].sort(), ['Tasks/T-001 First.md', 'Tasks/T-003 Mine.md', 'Tasks/T-004 Mine too.md', 'Tasks/Team/T-002 Theirs.md']);
  assert.match(src.files.get('Tasks/T-003 Mine.md')!, /^status: done$/m);
  // All three together, as after time offline: the same notes come out of one save.
  const again = new MemSource();
  again.files.set('Tasks/T-001 First.md', TASK('T-001', 'First'));
  again.files.set('Tasks/Team/T-002 Theirs.md', TASK('T-002', 'Theirs'));
  const all = await pushAll(again, [a, b, tick]);
  assert.equal(again.commits.length, 1);
  assert.deepEqual([...again.files], [...src.files].sort((x, y) => [...again.files.keys()].indexOf(x[0]) - [...again.files.keys()].indexOf(y[0])));
  assert.deepEqual(all.renames, { 'Tasks/T-002 Mine.md': 'Tasks/T-003 Mine.md', 'Tasks/T-003 Mine too.md': 'Tasks/T-004 Mine too.md' });
});

test('a saved new note is put into the saved copy where its kind goes, so it does not blink away before the next sync', async () => {
  const fs2 = new FsSource(DEMO);
  const schema = parseSchema(demoSchemaText());
  const snap = await sync(fs2, null);
  const src = new MemSource();
  for (const f of (await fs2.tree()).files) if (f.path.startsWith('Tasks/')) src.files.set(f.path, await fs2.read(f.path));
  const a = createAction('task', newTask('Order proof copies'), Object.keys(snap.index.notes).map((path) => ({ path, sha: '' })), NOW);
  const res = await pushAll(src, [a]);
  const folded = foldSaved(snap.index, res.saved, schema);
  assert.ok(taskNotes(folded).some((n) => n.data.title === 'Order proof copies' && n.sha === src.sha(src.files.get(n.path)!)));
  assert.equal(taskNotes(folded).length, taskNotes(snap.index).length + 1);
  // A note that was already there is only replaced.
  const again = foldSaved(folded, res.saved, schema);
  assert.equal(taskNotes(again).length, taskNotes(folded).length);
  assert.equal(foldSaved(folded, [], schema), folded);
});

test('the outbox keeps a new note across closing the app, and drops one it cannot read', () => {
  const s = store();
  const a = createAction('task', newTask('Kept'), [], NOW);
  saveOutbox('k', [a], s);
  assert.deepEqual(loadOutbox('k', s), [a]);
  s.setItem('story-forge.outbox.k', JSON.stringify([a, { id: 'x', at: 'y', ops: [{ kind: 'create', make: 'no-such-maker', payload: {}, id: 'Z-1', path: 'z.md', text: '' }] }]));
  assert.deepEqual(loadOutbox('k', s), [a]);
});

test('what went up stays on the device until the saved copy holds it, and shows again on an older copy', async () => {
  const fs2 = new FsSource(DEMO);
  const schema = parseSchema(demoSchemaText());
  const snap = await sync(fs2, null);
  const idea = Object.keys(snap.index.notes).find((p) => snap.index.notes[p].type === 'idea' && snap.index.notes[p].data.status === 'inbox')!;
  const src = new MemSource();
  for (const f of (await fs2.tree()).files) if (f.path.startsWith('Tasks/') || f.path === idea) src.files.set(f.path, await fs2.read(f.path));
  const keep = choiceAction([decide(idea, 'keep')]);
  const todo = createAction('task', newTask('Order proof copies'), Object.keys(snap.index.notes).map((path) => ({ path, sha: '' })), NOW);
  const failed = choiceAction([decide('gone.md', 'keep')]);
  const res = await pushAll(src, [keep, todo]);
  const s = store();
  saveLanded('k', landedOf([keep, todo, failed], res.done, res.renames), s);
  assert.deepEqual(loadLanded('k', s).map((a) => a.id), [keep.id, todo.id]);
  assert.deepEqual(loadOutbox('k', s), [], 'it is not waiting to go up again');
  // The app closed before the saved copy was written: the older copy with the list over it shows what the newer one would.
  const older = overlayActions(snap.index, loadLanded('k', s), schema);
  const newer = foldSaved(snap.index, res.saved, schema);
  assert.equal(older.notes[idea].data.status, 'keep');
  assert.deepEqual(older.notes[idea].data, newer.notes[idea].data);
  assert.deepEqual(taskNotes(older).map((n) => n.data.title), taskNotes(newer).map((n) => n.data.title));
  // Over a copy that already holds it, it changes nothing Kyle can see.
  const twice = overlayActions(newer, loadLanded('k', s), schema);
  assert.deepEqual(twice.notes[idea].data, newer.notes[idea].data);
  assert.equal(taskNotes(twice).length, taskNotes(newer).length);
  // A new note saved under another ID than it was shown with is left to the next sync.
  assert.deepEqual(landedOf([todo], [todo.id], { [todo.ops[0].path]: 'Tasks/T-999 Other.md' }), []);
  saveLanded('k', [], s);
  assert.deepEqual(loadLanded('k', s), []);
});

// ---- GitHub: one commit through git's own objects ----

// ---- the Edit room: Kyle's answers on the team's changes ----

const CH1 = BOOK + '/Changes/Chapter 1 changes.md';

test('answers on a chapter\'s changes show at once, join the ones that wait, and say the same on screen as in the saved text', async () => {
  const src = new FsSource(DEMO);
  const snap = await sync(src, null);
  const text = await src.read(CH1);
  const note = snap.index.notes[CH1];
  assert.deepEqual(parseChanges(note.body).changes.map((c) => c.status).slice(0, 3), ['open', 'open', 'open']);
  let box = add([], marksAction(CH1, { 'C-01': 'kept' }));
  box = add(box, marksAction(CH1, { 'C-02': 'no', 'C-01': 'other' }));
  // One op carries every answer for the note, the newer answer to a change winning.
  assert.equal(waitingCount(box), 1);
  const op = box[0].ops[0];
  assert.deepEqual(op.kind === 'edit' && op.edit.type === 'marks' ? op.edit.marks : null, { 'C-01': 'other', 'C-02': 'no' });
  const shown = overlayActions(snap.index, box).notes[CH1];
  assert.deepEqual(parseChanges(shown.body).changes.map((c) => c.status).slice(0, 3), ['other', 'no', 'open']);
  assert.equal(shown.sha, note.sha);
  assert.equal(snap.index.notes[CH1].body, note.body, 'the saved copy is untouched');
  assert.ok(waitingOf(box)[CH1]);
  // The two forms agree.
  const e: Edit = { type: 'marks', marks: { 'C-01': 'other', 'C-02': 'no' } };
  assert.equal(makeNote(CH1, 'x', editText(text, e)).body, editRecord(note, e).body);
  assert.equal(editText(text, e).split('\n').filter((l, i) => l !== text.split('\n')[i]).length, 2, 'only the two Kyle lines change');
});

test('answers and the to-dos they tick off go up as one save, on top of what the team wrote meanwhile', async () => {
  const src = new MemSource();
  const changes = '---\ntype: chapter-changes\nchapter: 1\n---\nIntro.\n\n## C-01 · small\nScene: S-001\nWhy: To-do T-002: the ferry time.\nKyle: open\n\nWas:\n> noon\n\nNow:\n> dawn\n\n## C-02 · line\nScene: S-001\nWhy: Sense.\nKyle: open\n\nWas:\n> a\n\nNow:\n> b\n';
  src.files.set('B/Changes/Chapter 1 changes.md', changes);
  src.files.set('B/Tasks/T-002 Ferry.md', TASK('T-002', 'Ferry'));
  const act = marksAction('B/Changes/Chapter 1 changes.md', { 'C-01': 'kept' }, [edit('B/Tasks/T-002 Ferry.md', { status: 'done', done_note: 'Edit room: C-01 kept.' })]);
  // The team adds a change to the note between the app's read and its save.
  src.race = () => { src.files.set('B/Changes/Chapter 1 changes.md', src.files.get('B/Changes/Chapter 1 changes.md')! + '\n## C-03 · small\nScene: S-001\nWhy: Typo.\nKyle: open\n\nWas:\n> teh\n\nNow:\n> the\n'); };
  const res = await pushAll(src, [act]);
  assert.equal(res.error, null);
  assert.deepEqual(res.done, [act.id]);
  const saved = src.files.get('B/Changes/Chapter 1 changes.md')!;
  assert.deepEqual(parseChanges(saved).changes.map((c) => [c.id, c.status]), [['C-01', 'kept'], ['C-02', 'open'], ['C-03', 'open']]);
  assert.match(src.files.get('B/Tasks/T-002 Ferry.md')!, /^status: done$/m);
  assert.match(src.files.get('B/Tasks/T-002 Ferry.md')!, /^done_note: "?Edit room: C-01 kept\."?$/m);
  assert.equal(src.commits.length, 1, 'one save for the answer and its to-do');
  assert.deepEqual(src.commits[0].paths.sort(), ['B/Changes/Chapter 1 changes.md', 'B/Tasks/T-002 Ferry.md']);
  assert.match(src.commits[0].message, /^changes: Kyle kept C-01 in Chapter 1 changes\n\nSaved together with:\n- tasks: /);
  assert.deepEqual(res.saved.map((n) => n.path).sort(), ['B/Changes/Chapter 1 changes.md', 'B/Tasks/T-002 Ferry.md']);
  // Sent again (the answer was lost on the way back): nothing changes.
  const n = src.writes.length;
  assert.equal((await pushAll(src, [act])).error, null);
  assert.equal(src.writes.length, n);
  // A later answer that carries the saved one with it names only what is new.
  assert.equal((await pushAll(src, [marksAction('B/Changes/Chapter 1 changes.md', { 'C-01': 'kept', 'C-02': 'no' })])).error, null);
  assert.match(src.writes[src.writes.length - 1].message, /^changes: Kyle said no to C-02 in Chapter 1 changes\n/);
});

test('answers left in the Edit room\'s old list move into the outbox once, under any newer answer already waiting', () => {
  const s = store();
  s.setItem('story-forge.change-choices.k', JSON.stringify({ [CH1]: { 'C-01': 'kept', 'C-02': 'no' }, 'B/Changes/Chapter 2 changes.md': { 'C-05': 'mine' }, 'B/empty.md': {} }));
  saveOutbox('k', [marksAction(CH1, { 'C-02': 'kept' })], s);
  const box = loadOutbox('k', s);
  const marks = (path: string) => box.flatMap((a) => a.ops).filter((op) => op.path === path).map((op) => (op.kind === 'edit' && op.edit.type === 'marks' ? op.edit.marks : null));
  assert.deepEqual(marks(CH1), [{ 'C-01': 'kept', 'C-02': 'kept' }]);
  assert.deepEqual(marks('B/Changes/Chapter 2 changes.md'), [{ 'C-05': 'mine' }]);
  assert.equal(waitingCount(box), 2);
  assert.equal(s.getItem('story-forge.change-choices.k'), null, 'the old list is let go');
  assert.deepEqual(loadOutbox('k', s), box, 'and it moves only once');
  // An op the app cannot read is dropped, the rest stays.
  s.setItem('story-forge.outbox.k', JSON.stringify([{ id: 'a', at: AT, ops: [{ kind: 'edit', path: CH1, edit: { type: 'marks' } }] }, ...box]));
  assert.deepEqual(loadOutbox('k', s).map((a) => a.id), box.map((a) => a.id));
});

test('a blob sha worked out in the app is the one git gives', async () => {
  assert.equal(await blobSha(''), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  assert.equal(await blobSha('hello\n'), 'ce013625030ba8dba906f756967f9e9ca394464a');
  const text = '---\ntitle: Café “Ash Bell”\n---\n\nThe bell rang twice — then nothing.\r\n';
  const bytes = Buffer.from(text, 'utf8');
  assert.equal(await blobSha(text), crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes])).digest('hex'));
});

/** A pretend GitHub with a branch, commits and trees, enough for the git data calls the app makes. */
function fakeGitHub(start: Record<string, string>) {
  const trees = new Map<string, Map<string, string>>([['t0', new Map(Object.entries(start))]]);
  const commits = new Map<string, { tree: string; parent: string | null; message: string }>([['c0', { tree: 't0', parent: null, message: 'start' }]]);
  const state = { head: 'c0', calls: [] as string[], beforePatch: null as (() => void) | null };
  /** Files that are not text, sent ahead of the save that names them. */
  const sent = new Map<string, string>();
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const sha1 = (t: string) => { const b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
  const commitTo = (files: Record<string, string | null>, message: string) => {
    const tree = new Map(trees.get(commits.get(state.head)!.tree)!);
    Object.entries(files).forEach(([p, t]) => (t == null ? tree.delete(p) : tree.set(p, t)));
    const id = String(commits.size);
    trees.set('t' + id, tree);
    commits.set('c' + id, { tree: 't' + id, parent: state.head, message });
    state.head = 'c' + id;
  };
  const fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname.replace('/repos/kylewrites33-cloud/author-business', ''));
    const method = (init && init.method) || 'GET';
    const body = init && init.body ? JSON.parse(String(init.body)) : null;
    state.calls.push(method + ' ' + path);
    assert.equal((init!.headers as Record<string, string>).Authorization, 'Bearer test-token');
    if (method === 'GET' && path === '/git/ref/heads/main') return json({ object: { sha: state.head } });
    if (method === 'GET' && path.startsWith('/git/commits/')) return json({ tree: { sha: commits.get(path.slice(13))!.tree } });
    if (method === 'GET' && path.startsWith('/git/trees/')) {
      assert.equal(u.searchParams.get('recursive'), '1');
      return json({ truncated: false, tree: [...trees.get(path.slice(11))!].map(([p, t]) => ({ path: p, type: 'blob', sha: sha1(t) })) });
    }
    if (method === 'GET' && path.startsWith('/contents/')) {
      const c = commits.get(u.searchParams.get('ref')!);
      const text = c && trees.get(c.tree)!.get(path.slice(10));
      return text == null ? json({}, 404) : json({ sha: sha1(text), encoding: 'base64', content: toBase64(text) });
    }
    if (method === 'POST' && path === '/git/blobs') {
      assert.equal(body.encoding, 'base64');
      const id = 'b' + (sent.size + 1);
      sent.set(id, body.content);
      return json({ sha: id }, 201);
    }
    if (method === 'POST' && path === '/git/trees') {
      const tree = new Map(trees.get(body.base_tree)!);
      for (const e of body.tree) {
        if (e.sha === null) { if (!tree.has(e.path)) return json({}, 422); tree.delete(e.path); }
        else if (e.sha) { if (!sent.has(e.sha)) return json({}, 422); tree.set(e.path, 'bytes ' + sent.get(e.sha)); }
        else tree.set(e.path, e.content);
      }
      const id = 't' + (trees.size + 100);
      trees.set(id, tree);
      return json({ sha: id }, 201);
    }
    if (method === 'POST' && path === '/git/commits') {
      const id = 'c' + (commits.size + 100);
      commits.set(id, { tree: body.tree, parent: body.parents[0], message: body.message });
      return json({ sha: id }, 201);
    }
    if (method === 'PATCH' && path === '/git/refs/heads/main') {
      assert.equal(body.force, false, 'the branch is never forced');
      if (state.beforePatch) { const f = state.beforePatch; state.beforePatch = null; f(); }
      if (commits.get(body.sha)!.parent !== state.head) return json({ message: 'Update is not a fast forward' }, 422);
      state.head = body.sha;
      return json({ object: { sha: body.sha } });
    }
    return json({}, 404);
  };
  const files = () => Object.fromEntries(trees.get(commits.get(state.head)!.tree)!);
  return { fetch, state, commits, files, commitTo };
}

const settings = { ...DEFAULTS, token: 'test-token', root: 'vault' };

test('GitHub: several files written and removed as one commit, read first at the branch\'s own commit', async () => {
  const gh = fakeGitHub({ 'vault/a.md': 'A\n', 'vault/b.md': 'B\n', 'vault/old.md': 'old\n', 'README.md': 'outside the vault\n' });
  const src = new GitHubSource(settings, gh.fetch);
  const res = await src.commit(async ({ read, files }) => {
    assert.deepEqual((await files()).map((f) => f.path).sort(), ['a.md', 'b.md', 'old.md'], 'the vault\'s files, without what sits outside its folder');
    const a = await read('a.md');
    assert.deepEqual(a, { text: 'A\n', sha: await blobSha('A\n') });
    assert.equal(await read('nothing.md'), null);
    return { message: 'app: one save', writes: [{ path: 'a.md', text: a!.text + 'more\n' }, { path: 'new/c.md', text: 'C é\n' }], removes: ['old.md'] };
  });
  assert.deepEqual(gh.files(), { 'vault/a.md': 'A\nmore\n', 'vault/b.md': 'B\n', 'vault/new/c.md': 'C é\n', 'README.md': 'outside the vault\n' });
  assert.equal(gh.commits.get(gh.state.head)!.message, 'app: one save');
  assert.equal(gh.commits.get(gh.state.head)!.parent, 'c0');
  assert.deepEqual(res, { commit: gh.state.head, shas: { 'a.md': await blobSha('A\nmore\n'), 'new/c.md': await blobSha('C é\n') } });
  assert.deepEqual(gh.state.calls.map((c) => c.split(' ')[0] + ' ' + c.split(' ')[1].split('/').slice(0, 3).join('/')),
    ['GET /git/ref', 'GET /git/commits', 'GET /git/trees', 'GET /contents/vault', 'GET /contents/vault', 'POST /git/trees', 'POST /git/commits', 'PATCH /git/refs']);
  // Nothing to change on the version this device last saved: it asks once where the branch is now (the team may have
  // saved since, 2026-11-12), and sends nothing.
  const before = gh.state.calls.length;
  assert.equal(await src.commit(async () => null), null);
  assert.equal(await src.commit(async () => ({ message: 'x', writes: [] })), null);
  assert.deepEqual(gh.state.calls.slice(before).map((c) => c.split(' ')[0] + ' ' + c.split(' ')[1].split('/').slice(0, 3).join('/')), ['GET /git/ref', 'GET /git/ref'], 'only where the branch is');
  assert.equal(gh.state.calls.filter((c) => /^(POST|PATCH)/.test(c)).length, 3, 'nothing more is sent than the first save');
});

test('GitHub: a save that finds nothing to change on the device\'s last version looks again at the branch as it is now', async () => {
  // Kyle, 2026-11-12: a choice on a card the Writer had just made was lost, because the save read the note as this
  // device last saved it, where that card was not yet.
  const gh = fakeGitHub({ 'vault/a.md': 'A\n' });
  const src = new GitHubSource(settings, gh.fetch);
  await src.commit(async ({ read }) => ({ message: 'app: first', writes: [{ path: 'a.md', text: (await read('a.md'))!.text + 'mine\n' }] }));
  // The team saves from elsewhere.
  gh.commitTo({ 'vault/a.md': gh.files()['vault/a.md'] + 'C-10\n' }, 'jobs: the Writer');
  const res = await src.commit(async ({ read }) => {
    const a = (await read('a.md'))!.text;
    return a.includes('C-10') ? { message: 'app: on C-10', writes: [{ path: 'a.md', text: a.replace('C-10', 'C-10 kept') }] } : null;
  });
  assert.ok(res, 'the save happened');
  assert.equal(gh.files()['vault/a.md'], 'A\nmine\nC-10 kept\n');
});

test('GitHub: a picture goes up in the same save as the notes, and only once when the save has to be made again', async () => {
  const gh = fakeGitHub({ 'vault/a.md': 'A\n', 'vault/Cover.jpg': 'the old picture' });
  const src = new GitHubSource(settings, gh.fetch);
  gh.state.beforePatch = () => gh.commitTo({ 'vault/t.md': 'theirs\n' }, 'agents: a change');
  let builds = 0;
  const res = await src.commit(async () => { builds++; return { message: 'books: cover', writes: [{ path: 'a.md', text: 'A2\n' }], blobs: [{ path: 'Cover.jpg', base64: 'c21hbGw=' }, { path: 'Cover/Original.png', base64: 'ZnVsbA==' }] }; });
  assert.equal(builds, 2, 'the team saved in between, so the save was planned again');
  assert.deepEqual(gh.files(), { 'vault/a.md': 'A2\n', 'vault/Cover.jpg': 'bytes c21hbGw=', 'vault/Cover/Original.png': 'bytes ZnVsbA==', 'vault/t.md': 'theirs\n' });
  assert.equal(gh.state.calls.filter((c) => c === 'POST /git/blobs').length, 2, 'each picture was sent once, not once a try');
  assert.equal(gh.commits.get(gh.state.head)!.message, 'books: cover');
  assert.deepEqual(res!.shas, { 'Cover.jpg': 'b1', 'Cover/Original.png': 'b2', 'a.md': await blobSha('A2\n') });
  // A save of pictures alone is still a save.
  const only = await src.commit(async () => ({ message: 'backups: x', writes: [], blobs: [{ path: 'Backups/x.docx', base64: 'UEsDBA==' }] }));
  assert.equal(gh.files()['vault/Backups/x.docx'], 'bytes UEsDBA==');
  assert.equal(only!.shas['Backups/x.docx'], 'b3');
});

test('GitHub: the next save starts from the app\'s own last save without asking where the branch is', async () => {
  const gh = fakeGitHub({ 'vault/a.md': 'A\n' });
  const src = new GitHubSource(settings, gh.fetch);
  await src.commit(async () => ({ message: 'one', writes: [{ path: 'a.md', text: 'A1\n' }] }));
  gh.state.calls.length = 0;
  await src.commit(async ({ read }) => ({ message: 'two', writes: [{ path: 'a.md', text: (await read('a.md'))!.text + 'A2\n' }] }));
  assert.deepEqual(gh.state.calls, ['GET /contents/vault/a.md', 'POST /git/trees', 'POST /git/commits', 'PATCH /git/refs/heads/main']);
  assert.equal(gh.files()['vault/a.md'], 'A1\nA2\n');
  // The team saves in between: the remembered place is stale, GitHub refuses, and the save is made again on their version.
  gh.commitTo({ 'vault/a.md': 'TEAM\n', 'vault/t.md': 'theirs\n' }, 'agents: a change');
  let builds = 0;
  await src.commit(async ({ read }) => { builds++; return { message: 'three', writes: [{ path: 'a.md', text: (await read('a.md'))!.text + 'A3\n' }] }; });
  assert.equal(builds, 2);
  assert.deepEqual(gh.files(), { 'vault/a.md': 'TEAM\nA3\n', 'vault/t.md': 'theirs\n' });
});

test('GitHub: a save that loses the race is made again on the newer branch, and a real failure is a plain sentence', async () => {
  const gh = fakeGitHub({ 'vault/Ideas/I-008.md': IDEA });
  const src = new GitHubSource(settings, gh.fetch);
  gh.state.beforePatch = () => gh.commitTo({ 'vault/Ideas/I-008.md': IDEA.replace('Body.', 'Body.\n\nThe team added a line.') }, 'agents: a line');
  const { saved: [note] } = await pushAction(src, choiceAction([decide('Ideas/I-008.md', 'keep', 'Matches my breaks.')]));
  const text = gh.files()['vault/Ideas/I-008.md'];
  assert.match(text, /^status: keep$/m);
  assert.ok(text.endsWith('The team added a line.\n'));
  assert.equal(note.sha, await blobSha(text));
  assert.equal(fromBase64(toBase64(text)), text);
  const down = new GitHubSource(settings, async () => { throw new TypeError('Failed to fetch'); });
  const res = await pushAll(down, [choiceAction([decide('Ideas/I-008.md', 'drop')])]);
  assert.match(res.error!, /Cannot reach GitHub/);
  assert.deepEqual(res.done, []);
  assert.deepEqual(res.failed, {}, 'offline is not a failure of the action');
});
