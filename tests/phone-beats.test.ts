// Write mode's choices on a chapter's beats (2026-11-21; Kyle: "can you make a writing mode, too? ... i can open each
// beat and write in it, rewrite beat titles, and add, delete, or move beats arond"). Since 2026-11-22 a beat's words are
// Kyle's planning notes and never go into a scene (Kyle: "when I write on beat mode, the text doesn't go into the word
// processor"). src/lib/phone-beats.ts puts each choice in; the chapter it leaves must be byte for byte the one Beats mode
// leaves for the same presses (src/ui/BeatsPage.tsx's apply(), written out below with the same src/lib/beats.ts
// functions), and the scenes must not change at all.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addPlanBeat, beatsBody, deletePlanBeat, deletedBeatPath, deletedBeatText, introOf, movePlanBeat, parseBeats, planBeats, planDefs, type PlanBeat
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
  beatsText: string | null;
  intro: string;
  beats: PlanBeat[];
  last: string;
  archived: { path: string; text: string }[] = [];
  constructor(ch: ChapterText) {
    this.beatsText = ch.beatsBody;
    this.last = ch.scenes[ch.scenes.length - 1].id;
    this.beats = planBeats(parseBeats(ch.beatsBody || '').map((d) => ({ ...d, scene: d.scene || this.last })));
    this.intro = introOf(ch.beatsBody || '');
  }
  apply(beats: PlanBeat[]) {
    if (beats.length || this.beatsText != null) this.beatsText = (this.intro ? '\n' + this.intro + '\n' : '') + beatsBody(planDefs(beats));
    this.beats = beats;
  }
  key(i: number) { return this.beats[i].key; }
  write(i: number, notes: string) { const b = this.beats[i]; this.apply(this.beats.map((x) => (x.key === b.key ? { ...x, notes } : x))); }
  rename(i: number, title: string) { const b = this.beats[i]; this.apply(this.beats.map((x) => (x.key === b.key ? { ...x, title } : x))); }
  addAfter(i: number) { this.apply(addPlanBeat(this.beats, this.key(i), '', this.last)); }
  addAtEnd() { this.apply(addPlanBeat(this.beats, null, '', this.last)); }
  remove(i: number) {
    const b = this.beats[i];
    if (b.notes || b.summary.trim()) this.archived.push({ path: deletedBeatPath(BOOK, 1, i + 1, b.title, NOW), text: deletedBeatText(b, 1, i + 1, NOW) });
    this.apply(deletePlanBeat(this.beats, b.key));
  }
  move(i: number, before: number | null) { const next = movePlanBeat(this.beats, this.key(i), before == null ? null : this.key(before)); if (next !== this.beats) this.apply(next); }
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
  write(i: number, notes: string) { const b = this.beats[i]; return this.rec({ kind: 'beat-write', beat: b.key, beatName: 'beat ' + (i + 1), was: b.notes, now: notes }); }
  rename(i: number, title: string) { const b = this.beats[i]; return this.rec({ kind: 'beat-rename', beat: b.key, was: b.title, now: title }); }
  add(after: number | null, title = '') { const id = 'new-' + (++this.seq); this.rec({ kind: 'beat-add', beat: id, place: after == null ? 'end' : 'after ' + this.beats[after].key, now: title }); return id; }
  remove(i: number) { const b = this.beats[i]; return this.rec({ kind: 'beat-delete', beat: b.key, was: b.notes }); }
  move(i: number, dir: 'up' | 'down') { const bs = this.beats; const t = moveTarget(bs, bs[i].key, dir); assert.notEqual(t, undefined); return this.rec({ kind: 'beat-move', beat: bs[i].key, place: t == null ? 'end' : 'before ' + t }); }
}

/** The iPad: every choice in order, from the vault as it is. */
function putIn(ch: ChapterText, choices: PhoneChoice[], alias = new Map<string, string>()) {
  const results: string[] = [];
  const archived: { path: string; text: string }[] = [];
  let cur = ch;
  choices.forEach((c) => {
    const s = beatStep(cur, c, alias, BOOK, NOW);
    s.aliases.forEach(([a, b]) => alias.set(a, b));
    if (s.archive) archived.push(s.archive);
    assert.equal(s.copy, null);
    assert.deepEqual(s.touched, []);
    results.push(withAliases(s.result, s.aliases));
    cur = s.ch;
  });
  return { ch: cur, results, archived };
}

const same = (a: ChapterText, m: BeatsMode, ch: ChapterText) => {
  a.scenes.forEach((s, i) => assert.equal(s.body, ch.scenes[i].body, s.id + ' is never changed by a beat'));
  assert.equal(a.beatsBody, m.beatsText, 'the beats note is what Beats mode leaves');
};

test('every beat press from the phone leaves the chapter byte for byte as Beats mode does, and no scene changes', async () => {
  const ch = await chapter();
  const mode = new BeatsMode(ch);
  const phone = new Phone(ch);
  assert.equal(phone.beats.length, 3);
  assert.equal(mode.beats.length, 3);
  phone.write(0, 'Open on the lantern, not the bell.\n\nShe should be late.');
  mode.write(0, 'Open on the lantern, not the bell.\n\nShe should be late.');
  phone.rename(1, 'The long crack');
  mode.rename(1, 'The long crack');
  // Add after beat 2, name it, write in it: the new beat is found again by its phone ID.
  const id = phone.add(1);
  mode.addAfter(1);
  phone.rec({ kind: 'beat-rename', beat: id, was: '', now: 'Tobin wakes' });
  mode.rename(2, 'Tobin wakes');
  phone.rec({ kind: 'beat-write', beat: id, was: '', now: 'Socks on the ladder?' });
  mode.write(2, 'Socks on the ladder?');
  phone.move(2, 'up');
  mode.move(2, 1);
  phone.move(0, 'down');
  mode.move(0, 2);
  phone.add(null, 'Guards');
  mode.addAtEnd();
  mode.rename(mode.beats.length - 1, 'Guards');
  phone.remove(1);
  mode.remove(1);
  same(phone.ch, mode, ch);

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
  same(r.ch, mode, ch);
  assert.deepEqual(r.archived.map((a) => [a.path, a.text]), mode.archived.map((a) => [a.path, a.text]));
  assert.match(r.archived[0].text, /deleted with its notes in the Sparrow app/);
  assert.match(r.archived[0].text, /### Notes\nOpen on the lantern, not the bell\.\n\nShe should be late\./);

  // Twice: nothing changes the second time, and each is "already so" or found gone.
  const again = putIn(r.ch, back, aliasMap(r.results));
  same(again.ch, mode, ch);
});

test('notes written on the phone meet notes changed on the iPad: merged, or both kept when the same lines clash', async () => {
  const ch = await chapter();
  const start = new BeatsMode(ch);
  start.write(1, 'Line one.\nLine two.\nLine three.');
  const base: ChapterText = { ...ch, beatsBody: start.beatsText };
  const phone = new Phone(base);
  phone.write(1, 'Line one, from the phone.\nLine two.\nLine three.');
  // The iPad changed another line of the same beat: both come in.
  const ipad = new BeatsMode(base);
  ipad.write(1, 'Line one.\nLine two.\nLine three, from the iPad.');
  const m = putIn({ ...base, beatsBody: ipad.beatsText }, phone.choices);
  assert.equal(m.results[0], 'applied');
  assert.match(m.ch.beatsBody || '', /Line one, from the phone\.\nLine two\.\nLine three, from the iPad\./);

  // The iPad changed the same line: the iPad's notes stay, the phone's go under them, and the result says so.
  const ipad2 = new BeatsMode(base);
  ipad2.write(1, 'Line one, from the iPad.\nLine two.\nLine three.');
  const c = putIn({ ...base, beatsBody: ipad2.beatsText }, phone.choices);
  assert.match(c.results[0], /^applied, both kept\. .*From your phone:/);
  assert.match(c.ch.beatsBody || '', /Line one, from the iPad\.\nLine two\.\nLine three\.\n\nFrom your phone:\nLine one, from the phone\./);
});

test('choices that no longer fit are skipped with a plain reason', async () => {
  const ch = await chapter();
  const phone = new Phone(ch);
  phone.rename(1, 'Phone name');
  const del = new Phone(ch);
  del.remove(0);
  // On the iPad, beat 2 was renamed and beat 1 got notes.
  const ipad = new BeatsMode(ch);
  ipad.rename(1, 'iPad name');
  ipad.write(0, 'One more thought.');
  const vault: ChapterText = { ...ch, beatsBody: ipad.beatsText };
  const r = putIn(vault, phone.choices);
  assert.match(r.results[0], /^skipped\. /);
  assert.equal(r.ch.beatsBody, vault.beatsBody);
  const d = putIn(vault, del.choices);
  assert.match(d.results[0], /^skipped\. Beat 1's notes changed after your phone showed them/);
  assert.equal(d.archived.length, 0);
});

test('a choice made on the phone before an earlier one was put in still finds its beat', async () => {
  const ch = await chapter();
  const phone = new Phone(ch);
  const id = phone.add(0, 'New beat');
  phone.rec({ kind: 'beat-write', beat: id, was: '', now: 'First thoughts.' });
  const first = putIn(ch, phone.choices);
  assert.ok(first.results.some((r) => aliasesIn(r).length), 'the new beat\'s saved ID is written down');
  assert.equal(resultSaid(first.results[0]), 'applied');
  // Meanwhile the phone, still on the old copy, wrote more in the new beat and renamed beat 1.
  phone.choices = [];
  phone.rec({ kind: 'beat-write', beat: id, was: 'First thoughts.', now: 'First thoughts. And more.' });
  phone.rename(0, 'Dawn');
  const second = putIn(first.ch, phone.choices, aliasMap(first.results));
  second.results.forEach((r) => assert.match(r, /^applied/));
  assert.match(second.ch.beatsBody || '', /First thoughts\. And more\./);
  assert.match(second.ch.beatsBody || '', /## Dawn\n/);
});

test('a chapter with no beats note gets one, as Beats mode makes it', async () => {
  const ch = await chapter();
  const bare: ChapterText = { ...ch, beatsBody: null, beatsPath: BOOK + '/Chapter Beats/Chapter 9 beats.md' };
  const phone = new Phone(bare);
  assert.equal(phone.beats.length, 0, 'no beats until one is added');
  phone.add(null, 'Opening');
  const mode = new BeatsMode(bare);
  mode.addAtEnd();
  mode.rename(0, 'Opening');
  const r = putIn(bare, phone.choices);
  same(r.ch, mode, bare);
  assert.equal(r.ch.beatsBody, '\n## Opening\n\nStarts: S-002\n');
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
/** Beats mode's saves for the same presses: the Archive copy first, then the beats note. */
async function beatsModeSaves(src: MemSource, mode: BeatsMode) {
  const idx = (await sync(src, null)).index;
  for (const a of mode.archived) await pushAction(src, filesAction([{ path: a.path, taken: 'next', text: a.text, message: 'beats: archive' }], [], NOW));
  const n = idx.notes[BEATS];
  if (mode.beatsText !== n.body) await saveDraft(src, { ...openDraft(n, undefined, NOW), body: mode.beatsText! }, NOW);
}
const vaultFiles = (src: MemSource) => new Map([...src.files].filter(([p]) => !p.includes('/Phone/')));

test('Sparrow on the iPad saves the phone\'s beat choices as Beats mode saves the same presses, and twice saves nothing', async () => {
  const ch = await chapter();
  const phone = new Phone(ch);
  const mode = new BeatsMode(ch);
  phone.write(1, 'She counts the rungs going down?');
  mode.write(1, 'She counts the rungs going down?');
  const id = phone.add(0);
  mode.addAfter(0);
  phone.rec({ kind: 'beat-write', beat: id, was: '', now: 'Wind through the louvres.' });
  mode.write(1, 'Wind through the louvres.');
  phone.rename(1, 'Wind');
  mode.rename(1, 'Wind');
  phone.move(3, 'up');
  mode.move(3, 2);
  phone.remove(0);
  mode.remove(0);

  const src = await memVault();
  const scenesBefore = [src.files.get(S1), src.files.get(S2)];
  await sendChoices(src, BOOK, 'Ash Bell', '', phone.choices.map((c) => ({ ...c, n: 0 })), NOW);
  const rep = await ipadPutsIn(src);
  assert.ok(rep);
  assert.equal(reportLine(rep!.results), phone.choices.length + ' choices from your phone applied.');
  assert.deepEqual([src.files.get(S1), src.files.get(S2)], scenesBefore, 'the scenes are never changed');
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
