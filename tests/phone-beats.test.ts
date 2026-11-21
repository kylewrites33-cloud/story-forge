// Write mode's choices on a chapter's beats (2026-11-21; Kyle: "can you make a writing mode, too? ... i can open each
// beat and write in it, rewrite beat titles, and add, delete, or move beats arond"). src/lib/phone-beats.ts puts each
// choice in; the chapter it leaves must be byte for byte the one Beats mode leaves for the same presses
// (src/ui/BeatsPage.tsx's apply(), written out below with the same src/lib/beats.ts functions).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addBeatAfter, addBeatAtEnd, beatDefs, beatsBody, deleteBeat, deletedBeatPath, deletedBeatText, introOf, layoutChapter, moveBeat, nameLoose,
  parseBeats, sceneBody, type BeatView, type SceneShape
} from '../src/lib/beats.ts';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { newNoteText, readChoices, withAliases, aliasesIn, resultSaid, type PhoneChoice } from '../src/lib/phone-choices.ts';
import { aliasMap, beatStep, layOut, moveTarget, type ChapterText } from '../src/lib/phone-beats.ts';
import { openDraft } from '../src/lib/drafts.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { sync } from '../src/lib/sync.ts';
import { sendChoices } from '../src/pocket/send.ts';
import { foldSaved } from '../src/vault/apply.ts';
import { filesAction, type Action } from '../src/vault/ops.ts';
import { applyPhoneNotes, reportLine } from '../src/vault/phone.ts';
import { pushAction, pushAll } from '../src/vault/push.ts';
import { saveDraft } from '../src/vault/words.ts';
import { DEMO, demoKinds, demoSchemaText, FsSource, MemSource } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const S1 = BOOK + '/Scenes/S-001 The Crack.md';
const S2 = BOOK + '/Scenes/S-002 The Ferry.md';
const BEATS = BOOK + '/Chapter Beats/Chapter 1 beats.md';
const NOW = new Date('2026-11-21T15:00:00Z');

async function chapter(): Promise<ChapterText> {
  const disk = new FsSource(DEMO);
  const body = async (p: string) => Frontmatter.parse(await disk.read(p)).body as string;
  return {
    chapter: 1, beatsPath: BEATS, beatsBody: await body(BEATS),
    scenes: [{ path: S1, id: 'S-001', body: await body(S1) }, { path: S2, id: 'S-002', body: await body(S2) }]
  };
}

// ---- Beats mode, as BeatsPage.tsx does it: one list of beats, apply() after each press ----
class BeatsMode {
  scenes: Record<string, string>;
  beatsText: string | null;
  shapes: SceneShape[];
  intro: string;
  beats: BeatView[];
  archived: { path: string; text: string }[] = [];
  constructor(ch: ChapterText) {
    this.scenes = Object.fromEntries(ch.scenes.map((s) => [s.path, s.body]));
    this.beatsText = ch.beatsBody;
    const laid = layoutChapter(ch.scenes, parseBeats(ch.beatsBody || ''));
    this.shapes = laid.scenes;
    this.beats = laid.beats;
    this.intro = introOf(ch.beatsBody || '');
  }
  apply(beats: BeatView[], touched: string[]) {
    touched.forEach((p) => { const sh = this.shapes.find((s) => s.path === p)!; this.scenes[p] = sceneBody(sh, beats); });
    const defs = beatDefs(beats);
    if (defs.length || this.beatsText != null) this.beatsText = (this.intro ? '\n' + this.intro + '\n' : '') + beatsBody(defs);
    this.beats = beats;
  }
  key(i: number) { return this.beats[i].key; }
  write(i: number, prose: string) { const b = this.beats[i]; this.apply(this.beats.map((x) => (x.key === b.key ? { ...x, prose, lost: false } : x)), [b.path]); }
  rename(i: number, title: string) {
    const b = this.beats[i];
    let beats = this.beats.map((x) => (x.key === b.key ? { ...x, title } : x));
    if (b.loose && title) beats = nameLoose(beats, b.key, title).map((x) => (x.key === b.key ? { ...x, title } : x));
    this.apply(beats, []);
  }
  addAfter(i: number) { this.apply(addBeatAfter(this.beats, this.key(i), ''), []); }
  addAtEnd(last: { path: string; id: string }) { this.apply(addBeatAtEnd(this.beats, last), []); }
  remove(i: number) {
    const b = this.beats[i];
    if (b.prose.trim()) this.archived.push({ path: deletedBeatPath(BOOK, 1, i + 1, b.title, NOW), text: deletedBeatText(b, 1, i + 1, NOW) });
    this.apply(deleteBeat(this.beats, b.key), [b.path]);
  }
  move(i: number, before: number | null) { const r = moveBeat(this.beats, this.key(i), before == null ? null : this.key(before)); if (r.touched.length) this.apply(r.beats, r.touched); }
}

// ---- The phone: it shows the chapter with its own choices in and records each press ----
class Phone {
  ch: ChapterText;
  alias = new Map<string, string>();
  choices: PhoneChoice[] = [];
  seq = 0;
  constructor(ch: ChapterText) { this.ch = ch; }
  get beats() { return layOut(this.ch).beats; }
  rec(p: Partial<PhoneChoice> & { kind: PhoneChoice['kind'] }) {
    const c: PhoneChoice = { n: this.choices.length + 1, version: 0, card: '', chapter: 1, chapterId: 'CH-001', scene: '', words: '', was: '', now: '', made: NOW.toISOString(), result: '', ...p };
    const s = beatStep(this.ch, c, this.alias, BOOK, NOW);
    assert.match(s.result, /^applied/, 'the phone shows ' + c.kind + ' as it will be: ' + s.result);
    s.aliases.forEach(([a, b]) => this.alias.set(a, b));
    this.ch = s.ch;
    this.choices.push(c);
    return c;
  }
  write(i: number, prose: string) { const b = this.beats[i]; return this.rec({ kind: 'beat-write', beat: b.key, beatName: 'beat ' + (i + 1), was: b.prose, now: prose }); }
  rename(i: number, title: string) { const b = this.beats[i]; return this.rec({ kind: 'beat-rename', beat: b.key, was: b.title, now: title }); }
  add(after: number | null, title = '') { const id = 'new-' + (++this.seq); this.rec({ kind: 'beat-add', beat: id, place: after == null ? 'end' : 'after ' + this.beats[after].key, now: title }); return id; }
  remove(i: number) { const b = this.beats[i]; return this.rec({ kind: 'beat-delete', beat: b.key, was: b.prose }); }
  move(i: number, dir: 'up' | 'down') { const bs = this.beats; const t = moveTarget(bs, bs[i].key, dir); assert.notEqual(t, undefined); return this.rec({ kind: 'beat-move', beat: bs[i].key, place: t == null ? 'end' : 'before ' + t }); }
}

/** The iPad: every choice in order, from the vault as it is. */
function putIn(ch: ChapterText, choices: PhoneChoice[], alias = new Map<string, string>()) {
  const results: string[] = [];
  const archived: { path: string; text: string }[] = [];
  const copies: { path: string; body: string }[] = [];
  let cur = ch;
  choices.forEach((c) => {
    const s = beatStep(cur, c, alias, BOOK, NOW);
    s.aliases.forEach(([a, b]) => alias.set(a, b));
    if (s.archive) archived.push(s.archive);
    if (s.copy) copies.push(s.copy);
    results.push(withAliases(s.result, s.aliases));
    cur = s.ch;
  });
  return { ch: cur, results, archived, copies };
}

const same = (a: ChapterText, m: BeatsMode) => {
  a.scenes.forEach((s) => assert.equal(s.body, m.scenes[s.path], s.id + ' is what Beats mode leaves'));
  assert.equal(a.beatsBody, m.beatsText, 'the beats note is what Beats mode leaves');
};

test('every beat press from the phone leaves the chapter byte for byte as Beats mode does', async () => {
  const ch = await chapter();
  const mode = new BeatsMode(ch);
  const phone = new Phone(ch);
  // The same presses, in the same order, on both.
  assert.equal(phone.beats.length, 4);
  assert.equal(mode.beats.length, 4);
  phone.write(0, 'Mara climbed the tower at 5:40 with a tin lantern. The bell hung crooked on its beam.\n\nThe frost had got into the ladder.');
  mode.write(0, 'Mara climbed the tower at 5:40 with a tin lantern. The bell hung crooked on its beam.\n\nThe frost had got into the ladder.');
  phone.rename(1, 'The long crack');
  mode.rename(1, 'The long crack');
  // Add after beat 2, name it, write in it: the new beat is found again by its phone ID.
  const id = phone.add(1);
  mode.addAfter(1);
  phone.rec({ kind: 'beat-rename', beat: id, was: '', now: 'Tobin wakes' });
  mode.rename(2, 'Tobin wakes');
  phone.rec({ kind: 'beat-write', beat: id, was: '', now: 'Tobin came up the ladder in his socks.' });
  mode.write(2, 'Tobin came up the ladder in his socks.');
  // The scene's opening words in S-002 get a name.
  phone.rename(4, 'Card notes');
  mode.rename(4, 'Card notes');
  // Move: beat 3 up, the last beat down is not possible, beat 1 down.
  phone.move(2, 'up');
  mode.move(2, 1);
  phone.move(0, 'down');
  mode.move(0, 2);
  // Add at the end with a name, then delete beat 2 with its words (they go to the Archive first).
  phone.add(null, 'Guards');
  mode.addAtEnd({ path: S2, id: 'S-002' });
  mode.rename(mode.beats.length - 1, 'Guards');
  phone.remove(1);
  mode.remove(1);
  same(phone.ch, mode);

  // The iPad, from the vault as the phone read it, with the choices as the note carries them.
  const text = newNoteText('Phone choices 2026-11-21 1500', NOW.toISOString(), phone.choices);
  const back = readChoices(text.slice(text.indexOf('\n---\n') + 5));
  assert.equal(back.length, phone.choices.length);
  back.forEach((c, i) => {
    assert.equal(c.kind, phone.choices[i].kind);
    assert.equal(c.beat, phone.choices[i].beat);
    assert.equal(c.place || '', phone.choices[i].place || '');
    assert.equal(c.was, phone.choices[i].was);
    assert.equal(c.now, phone.choices[i].now);
  });
  const r = putIn(ch, back);
  r.results.forEach((x) => assert.match(x, /^applied/));
  same(r.ch, mode);
  assert.deepEqual(r.archived.map((a) => [a.path, a.text]), mode.archived.map((a) => [a.path, a.text]));
  assert.match(r.archived[0].text, /deleted with its words in the Sparrow app/);

  // Twice: nothing changes the second time, and each is "already so" or found gone.
  const again = putIn(r.ch, back, aliasMap(r.results));
  same(again.ch, mode);
});

test('a beat written on the phone meets changes made on the iPad: merged, or kept as a copy when the same lines clash', async () => {
  const ch = await chapter();
  const phone = new Phone(ch);
  const b = phone.beats[1];
  phone.write(1, b.prose.replace('"Tobin," she said.', '"Tobin," she said, louder.'));
  // The iPad changed another line of the same beat: both come in.
  const ipad = new BeatsMode(ch);
  ipad.write(1, b.prose.replace('It was cold enough to sting.', 'It was cold enough to burn.'));
  const vault: ChapterText = { ...ch, scenes: ch.scenes.map((s) => ({ ...s, body: ipad.scenes[s.path] })), beatsBody: ipad.beatsText };
  const m = putIn(vault, phone.choices);
  assert.match(m.results[0], /^applied/);
  assert.match(m.ch.scenes[0].body, /cold enough to burn/);
  assert.match(m.ch.scenes[0].body, /she said, louder/);
  assert.equal(m.copies.length, 0);

  // The iPad changed the same line: the iPad's words stay, the phone's go into a copy, and the result says so.
  const ipad2 = new BeatsMode(ch);
  ipad2.write(1, b.prose.replace('"Tobin," she said.', '"Tobin," she whispered.'));
  const vault2: ChapterText = { ...ch, scenes: ch.scenes.map((s) => ({ ...s, body: ipad2.scenes[s.path] })), beatsBody: ipad2.beatsText };
  const c = putIn(vault2, phone.choices);
  assert.match(c.results[0], /^kept as a copy\. .*Copies, named “from your phone”/);
  assert.equal(c.ch.scenes[0].body, vault2.scenes[0].body, 'the iPad\'s words stay');
  assert.equal(c.ch.beatsBody, vault2.beatsBody);
  assert.equal(c.copies.length, 1);
  assert.match(c.copies[0].body, /she said, louder/);
});

test('choices that no longer fit are skipped with a plain reason', async () => {
  const ch = await chapter();
  const phone = new Phone(ch);
  const b = phone.beats[1];
  phone.rename(1, 'Phone name');
  const del = new Phone(ch);
  del.remove(0);
  // On the iPad, beat 2 was renamed and beat 1's words changed.
  const ipad = new BeatsMode(ch);
  ipad.rename(1, 'iPad name');
  ipad.write(0, ipad.beats[0].prose + '\n\nOne more line.');
  const vault: ChapterText = { ...ch, scenes: ch.scenes.map((s) => ({ ...s, body: ipad.scenes[s.path] })), beatsBody: ipad.beatsText };
  const r = putIn(vault, phone.choices);
  assert.match(r.results[0], /^skipped\. /);
  assert.equal(r.ch.beatsBody, vault.beatsBody);
  const d = putIn(vault, del.choices);
  assert.match(d.results[0], /^skipped\. Beat 1's words changed after your phone showed them/);
  assert.equal(d.archived.length, 0);
  void b;
});

test('a choice made on the phone before an earlier one was put in still finds its beat', async () => {
  const ch = await chapter();
  const phone = new Phone(ch);
  const id = phone.add(0, 'New beat');
  phone.rec({ kind: 'beat-write', beat: id, was: '', now: 'First words of the new beat.' });
  // The iPad puts these two in and writes the IDs that changed after the results.
  const first = putIn(ch, phone.choices);
  assert.ok(first.results.some((r) => aliasesIn(r).length), 'the new beat\'s saved ID is written down');
  assert.equal(resultSaid(first.results[0]), 'applied');
  // Meanwhile the phone, still on the old copy, wrote more in the new beat and renamed beat 1.
  phone.choices = [];
  phone.rec({ kind: 'beat-write', beat: id, was: 'First words of the new beat.', now: 'First words of the new beat. And more.' });
  phone.rename(0, 'Dawn');
  const second = putIn(first.ch, phone.choices, aliasMap(first.results));
  second.results.forEach((r) => assert.match(r, /^applied/));
  assert.match(second.ch.scenes[0].body, /First words of the new beat\. And more\./);
  assert.match(second.ch.beatsBody || '', /## Dawn\n/);
});

test('a chapter with no beats note gets one, as Beats mode makes it', async () => {
  const ch = await chapter();
  const bare: ChapterText = { ...ch, beatsBody: null, beatsPath: BOOK + '/Chapter Beats/Chapter 9 beats.md' };
  const phone = new Phone(bare);
  assert.equal(phone.beats.length, 2, 'each scene\'s words are one beat with no name yet');
  phone.rename(0, 'Opening');
  const mode = new BeatsMode(bare);
  mode.rename(0, 'Opening');
  const r = putIn(bare, phone.choices);
  same(r.ch, mode);
  assert.match(r.ch.beatsBody || '', /^\n## Opening\n\nStarts: S-001 · Mara climbed/);
});

// ---- The whole way round: the phone's note in the vault, Sparrow on the iPad putting it in ----

demoKinds();
const schema = parseSchema(demoSchemaText());
async function memVault(): Promise<MemSource> {
  const disk = new FsSource(DEMO);
  const src = new MemSource();
  for (const f of (await disk.tree()).files) if (f.path.endsWith('.md') || f.path.endsWith('.json')) src.files.set(f.path, await disk.read(f.path));
  return src;
}
async function ipadPutsIn(src: MemSource) {
  let idx = (await sync(src, null)).index;
  const rep = await applyPhoneNotes({
    source: src, sourceKey: 'mem-beats', schema, book: idx.books.find((b) => b.folder === BOOK)!,
    index: () => idx, waiting: () => [],
    send: async (actions: Action[]) => { const r = await pushAll(src, actions); assert.equal(r.error, null); },
    fold: async (saved) => { idx = foldSaved(idx, saved, schema); },
    now: () => NOW
  });
  return rep;
}
/** Beats mode's saves for the same presses: the Archive copy first, then each scene, then the beats note. */
async function beatsModeSaves(src: MemSource, mode: BeatsMode) {
  const idx = (await sync(src, null)).index;
  for (const a of mode.archived) await pushAction(src, filesAction([{ path: a.path, taken: 'next', text: a.text, message: 'beats: archive' }], [], NOW));
  for (const p of [S1, S2, BEATS]) {
    const n = idx.notes[p];
    const body = p === BEATS ? mode.beatsText! : mode.scenes[p];
    if (body === n.body) continue;
    await saveDraft(src, { ...openDraft(n, undefined, NOW), body }, NOW);
  }
}
const vaultFiles = (src: MemSource) => new Map([...src.files].filter(([p]) => !p.includes('/Phone/')));

test('Sparrow on the iPad saves the phone\'s beat choices as Beats mode saves the same presses, and twice saves nothing', async () => {
  const ch = await chapter();
  const phone = new Phone(ch);
  const mode = new BeatsMode(ch);
  phone.write(1, phone.beats[1].prose + '\n\nShe counted the rungs going down.');
  mode.write(1, mode.beats[1].prose + '\n\nShe counted the rungs going down.');
  const id = phone.add(0);
  mode.addAfter(0);
  phone.rec({ kind: 'beat-write', beat: id, was: '', now: 'The wind came through the louvres.' });
  mode.write(1, 'The wind came through the louvres.');
  phone.rename(1, 'Wind');
  mode.rename(1, 'Wind');
  phone.move(3, 'up');
  mode.move(3, 2);
  phone.remove(0);
  mode.remove(0);

  const src = await memVault();
  await sendChoices(src, BOOK, 'Ash Bell', '', phone.choices.map((c) => ({ ...c, n: 0 })), NOW);
  const rep = await ipadPutsIn(src);
  assert.ok(rep);
  assert.equal(reportLine(rep!.results), phone.choices.length + ' choices from your phone applied.');
  const ref = await memVault();
  await beatsModeSaves(ref, mode);
  const got = vaultFiles(src), want = vaultFiles(ref);
  assert.deepEqual([...got.keys()].sort(), [...want.keys()].sort(), 'the same files, the Archive copy of the deleted beat among them');
  for (const [p, t] of want) assert.equal(got.get(p), t, p + ' is byte for byte what Beats mode saves');
  assert.ok([...got.keys()].some((p) => p.startsWith(BOOK + '/Archive/Deleted beats/Chapter 1 beat 1 Dawn climb')));

  // Applying twice saves nothing.
  const before = new Map(src.files);
  const again = await ipadPutsIn(src);
  assert.equal(again, null);
  assert.deepEqual(src.files, before);
});

test('a clash on the iPad keeps its words, saves the phone\'s as a copy of the scene and says so', async () => {
  const ch = await chapter();
  const phone = new Phone(ch);
  const b = phone.beats[1];
  phone.write(1, b.prose.replace('"Tobin," she said.', '"Tobin," she said, louder.'));
  const src = await memVault();
  await sendChoices(src, BOOK, 'Ash Bell', '', phone.choices.map((c) => ({ ...c, n: 0 })), NOW);
  // Meanwhile on the iPad, the same line.
  const idx = (await sync(src, null)).index;
  const s1 = idx.notes[S1];
  await saveDraft(src, { ...openDraft(s1, undefined, NOW), body: s1.body.replace('"Tobin," she said.', '"Tobin," she whispered.') }, NOW);
  const mine = src.files.get(S1);
  const rep = await ipadPutsIn(src);
  assert.ok(rep);
  assert.equal(src.files.get(S1), mine, 'the iPad\'s words stay');
  assert.match(reportLine(rep!.results), /0 choices from your phone applied\. 1 kept as a copy\./);
  assert.match(rep!.notice || '', /Your phone wrote in S-001 on the same lines as this iPad\. These words are kept; your phone's are in the scene's Copies, named “from your phone”\./);
  const copy = [...src.files.keys()].find((p) => p.includes('/Snapshots/') && p.includes('S-001'));
  assert.ok(copy, 'a copy of the scene');
  assert.match(src.files.get(copy!)!, /she said, louder/);
  assert.match(src.files.get(copy!)!, /from your phone/);
});
