// A chapter by its beats, for Sparrow Pocket's Write mode and for Sparrow putting its choices in (2026-11-21; Kyle:
// "can you make a writing mode, too? so theres writing and editing? maybe we can use the beat mode. and i can open each
// beat and write in it, rewrite beat titles, and add, delete, or move beats arond").
//
// Shared by both ends and by neither alone (the wall, tests/pocket-wall.test.ts): the phone shows the chapter with its
// own choices in, and the iPad puts the same choices in, each with this one step, so the two can never disagree. The
// step makes exactly the edits Beats mode makes for the same presses (src/ui/BeatsPage.tsx, with src/lib/beats.ts):
// the scenes it touches put back together from their beats, and the beats note written again. It saves nothing; the
// iPad saves what it returns through its own saves (src/vault/phone.ts).
//
// A beat is known by an ID made from its scene, its name and its first words, numbered when two are the same. The
// layout's own keys change every time a page opens, so they cannot be sent between devices.
import {
  addBeatAfter, addBeatAtEnd, anchorOf, beatDefs, beatsBody, deleteBeat, deletedBeatPath, deletedBeatText, introOf, layoutChapter, moveBeat,
  nameLoose, parseBeats, sceneBody, type BeatView, type ChapterScene, type SceneShape
} from './beats.ts';
import { merge3 } from './live.ts';
import { Prose, wordCount } from './prose.js';
import { aliasesIn, type PhoneChoice } from './phone-choices.ts';

/** One chapter's words: its scenes in reading order and its beats note's body (null while it has none). */
export interface ChapterText {
  chapter: number;
  scenes: ChapterScene[];
  beatsPath: string;
  beatsBody: string | null;
}

export interface Laid {
  /** Each beat's `key` is its ID. */
  beats: BeatView[];
  shapes: SceneShape[];
  intro: string;
}

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('00000' + h.toString(16)).slice(-6);
}

/** The words a beat would be found by once saved: what Beats mode writes on its Starts line. */
const wordsOf = (b: BeatView) => (b.prose.trim() ? anchorOf(b.prose) : b.lost ? b.words : '');

/** Each beat's ID, in order. */
export function beatIds(beats: BeatView[]): string[] {
  const seen: Record<string, number> = {};
  return beats.map((b) => {
    const sig = [b.scene, b.loose ? 'opening' : '', b.title, wordsOf(b)].join('\u0001');
    const k = (seen[sig] = (seen[sig] || 0) + 1);
    return (b.scene || 'beat') + '-' + fnv(sig + '\u0001' + k);
  });
}

/** The chapter laid out by its beats, as Beats mode lays it out, each beat keyed by its ID. */
export function layOut(ch: ChapterText): Laid {
  const body = ch.beatsBody || '';
  const laid = layoutChapter(ch.scenes, parseBeats(body));
  const ids = beatIds(laid.beats);
  return { beats: laid.beats.map((b, i) => ({ ...b, key: ids[i] })), shapes: laid.scenes, intro: introOf(body) };
}

/** A beat's words counted as the writing page counts them. */
export const beatWords = (prose: string): number => wordCount(Prose.proseText(prose));

/** The chapter's words once its beats are `beats`: the scenes in `touched` put back together, and the beats note written
 * again, as Beats mode's apply() does. */
export function chapterWith(ch: ChapterText, laid: Laid, beats: BeatView[], touched: string[]): ChapterText {
  const scenes = ch.scenes.map((s) => {
    const shape = laid.shapes.find((x) => x.path === s.path);
    if (!shape || touched.indexOf(s.path) < 0) return s;
    return { ...s, body: sceneBody(shape, beats) };
  });
  const defs = beatDefs(beats);
  let beatsText = ch.beatsBody;
  if (defs.length || ch.beatsBody != null) beatsText = (laid.intro ? '\n' + laid.intro + '\n' : '') + beatsBody(defs);
  return { ...ch, scenes, beatsBody: beatsText };
}

/** How beat IDs moved between two versions of a chapter that hold the same beats in the same order (a beat renamed,
 * its first words changed, a beat added on the phone that now has words). Nothing when they do not line up. */
export function idChanges(was: { key: string; path: string }[], now: Laid): [string, string][] {
  if (was.length !== now.beats.length) return [];
  if (was.some((b, i) => b.path !== now.beats[i].path)) return [];
  return was.map((b, i): [string, string] => [b.key, now.beats[i].key]).filter((p) => p[0] !== p[1]);
}

/** ID changes the iPad wrote on phone notes, oldest first, as one lookup: the newest change of an ID wins. */
export function aliasMap(results: string[]): Map<string, string> {
  const m = new Map<string, string>();
  results.forEach((r) => aliasesIn(r).forEach(([a, b]) => m.set(a, b)));
  return m;
}

/** A beat by its ID, following the ID changes when it has moved on. */
export function findBeat(beats: BeatView[], id: string, alias: Map<string, string>): BeatView | null {
  let x: string | undefined = id;
  for (let i = 0; x && i < 30; i++) {
    const hit = beats.find((b) => b.key === x);
    if (hit) return hit;
    x = alias.get(x);
  }
  return null;
}

export interface Step {
  /** "applied", "applied (it was already so)", "kept as a copy. <why>" or "skipped. <why>". */
  result: string;
  ch: ChapterText;
  /** The scenes whose words changed. */
  touched: string[];
  beatsChanged: boolean;
  /** A deleted beat's words, for the book's Archive (saved before the beat goes, as Beats mode does). */
  archive: { path: string; text: string; message: string } | null;
  /** The phone's words when they clashed with this device's: a copy of the scene with them in. */
  copy: { path: string; scene: string; body: string } | null;
  /** IDs this step changed. */
  aliases: [string, string][];
}

function beatLabel(c: PhoneChoice): string {
  const n = (c.beatName || '').trim();
  return n ? '“' + n + '”' : 'the beat';
}

/** Put one of Write mode's choices into a chapter, the way Beats mode makes the same press. Pure. */
export function beatStep(ch: ChapterText, c: PhoneChoice, alias: Map<string, string>, bookFolder: string, now: Date): Step {
  const laid = layOut(ch);
  const beats = laid.beats;
  const none: Step = { result: '', ch, touched: [], beatsChanged: false, archive: null, copy: null, aliases: [] };
  const skip = (why: string): Step => ({ ...none, result: 'skipped. ' + why });
  const same = (): Step => ({ ...none, result: 'applied (it was already so)' });
  const gone = () => skip('In chapter ' + ch.chapter + ', ' + beatLabel(c) + ' is not as your phone saw it any more.');
  const done = (next: BeatView[], touched: string[], extra: Partial<Step> = {}): Step => {
    const out = chapterWith(ch, laid, next, touched);
    const changed = out.scenes.filter((s, i) => s.body !== ch.scenes[i].body).map((s) => s.path);
    const again = layOut(out);
    return {
      ...none, result: 'applied', ch: out, touched: changed, beatsChanged: out.beatsBody !== ch.beatsBody,
      aliases: idChanges(next, again), ...extra
    };
  };

  if (c.kind === 'beat-add') {
    if (findBeat(beats, c.beat || '', alias)) return same();
    const place = c.place || 'end';
    let next: BeatView[];
    if (place === 'end') {
      const last = ch.scenes[ch.scenes.length - 1];
      next = addBeatAtEnd(beats, last ? { path: last.path, id: last.id } : null);
      if (next.length && c.now) next = next.map((b) => (beats.some((x) => x.key === b.key) ? b : { ...b, title: c.now }));
    } else {
      const after = findBeat(beats, place.replace(/^after\s+/, ''), alias);
      if (!after) return skip('The beat it was added after is not in chapter ' + ch.chapter + ' any more.');
      next = addBeatAfter(beats, after.key, c.now);
    }
    const made = next.find((b) => !beats.some((x) => x.key === b.key));
    if (!made) return skip('Chapter ' + ch.chapter + ' has no scenes to put a beat in.');
    // The new beat keeps the phone's ID until it is saved; its saved ID follows it in the result.
    next = next.map((b) => (b === made ? { ...b, key: c.beat || b.key } : b));
    return done(next, []);
  }

  const b = findBeat(beats, c.beat || '', alias);
  if (!b) return gone();
  const i = beats.indexOf(b);

  if (c.kind === 'beat-write') {
    const cur = b.prose;
    if (cur === c.now || (cur.trim() === c.now.trim() && cur.trim() !== c.was.trim())) return same();
    let words = c.now;
    if (cur !== c.was && cur.trim() !== c.was.trim()) {
      // Changed here too since the phone read it: merged line by line, as words written offline are.
      const m = merge3(c.was, c.now, cur);
      if (m.clash) {
        // Both changed the same lines: this device's words stay, the phone's go into a copy of the scene.
        const theirs = beats.map((x) => (x === b ? { ...x, prose: c.now, lost: false } : x));
        const shape = laid.shapes.find((s) => s.path === b.path);
        return {
          ...none,
          result: 'kept as a copy. Beat ' + (i + 1) + ' was changed on the same lines here too, so these words stay; your phone\'s are in ' + b.scene + '\'s Copies, named “from your phone”.',
          copy: shape ? { path: b.path, scene: b.scene, body: sceneBody(shape, theirs) } : null
        };
      }
      words = m.text;
    }
    const next = beats.map((x) => (x === b ? { ...x, prose: words, lost: false } : x));
    return done(next, [b.path]);
  }

  if (c.kind === 'beat-rename') {
    if (b.title === c.now) return same();
    if (b.title !== c.was) return skip('Beat ' + (i + 1) + ' was renamed here (“' + (b.title || 'no name') + '”), so your phone\'s name for it was not used.');
    let next = beats.map((x) => (x === b ? { ...x, title: c.now } : x));
    if (b.loose && c.now) next = nameLoose(next, b.key, c.now).map((x) => (x.key === b.key ? { ...x, title: c.now } : x));
    return done(next, []);
  }

  if (c.kind === 'beat-delete') {
    if (b.prose.trim() !== c.was.trim()) return skip('Beat ' + (i + 1) + '\'s words changed after your phone showed them, so it was not deleted.');
    const next = deleteBeat(beats, b.key);
    let archive: Step['archive'] = null;
    if (b.prose.trim()) {
      archive = {
        path: deletedBeatPath(bookFolder, ch.chapter, i + 1, b.title, now),
        text: deletedBeatText(b, ch.chapter, i + 1, now),
        message: 'beats: archive chapter ' + ch.chapter + ' beat ' + (i + 1) + '\n\nDeleted with its words in the Sparrow app; the words as they stood are kept here.'
      };
    }
    return done(next, [b.path], { archive });
  }

  if (c.kind === 'beat-move') {
    const place = c.place || 'end';
    let before: string | null = null;
    if (place !== 'end') {
      const t = findBeat(beats, place.replace(/^before\s+/, ''), alias);
      if (!t) return skip('The beat it was moved next to is not in chapter ' + ch.chapter + ' any more.');
      before = t.key;
    }
    const r = moveBeat(beats, b.key, before);
    if (!r.touched.length) return same();
    return done(r.beats, r.touched);
  }
  return skip('Sparrow cannot read this choice.');
}

/** The ID changes a change to a chapter's words made (a card or a paragraph rewritten), so later beat choices still
 * find their beats. */
export function idChangesBetween(was: ChapterText, now: ChapterText): [string, string][] {
  return idChanges(layOut(was).beats, layOut(now));
}

/** Where a move up or down lands, as Beats mode's drag would drop it: before the beat above, or after the one below. */
export function moveTarget(beats: BeatView[], key: string, dir: 'up' | 'down'): string | null | undefined {
  const i = beats.findIndex((b) => b.key === key);
  if (i < 0) return undefined;
  if (dir === 'up') return i > 0 ? beats[i - 1].key : undefined;
  if (i >= beats.length - 1) return undefined;
  return i + 2 < beats.length ? beats[i + 2].key : null;
}
