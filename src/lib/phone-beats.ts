// A chapter by its beats, for Sparrow Pocket's Write mode and for Sparrow putting its choices in (2026-11-21; Kyle:
// "can you make a writing mode, too? so theres writing and editing? maybe we can use the beat mode. and i can open each
// beat and write in it, rewrite beat titles, and add, delete, or move beats arond").
//
// Since 2026-11-22 a beat's words are Kyle's planning notes, never the scene's prose (Kyle: "the text inside each beat
// is room for my planning thoughts. So when I write on beat mode, the text doesn't go into the word processor"), so
// every choice here changes the chapter's beats note only.
//
// Shared by both ends and by neither alone (the wall, tests/pocket-wall.test.ts): the phone shows the chapter with its
// own choices in, and the iPad puts the same choices in, each with this one step, so the two can never disagree. The
// step makes exactly the edits Beats mode makes for the same presses (src/ui/BeatsPage.tsx, with src/lib/beats.ts). It
// saves nothing; the iPad saves what it returns through its own saves (src/vault/phone.ts).
//
// A beat is known by an ID made from its scene, its name and its Starts words, numbered when two are the same. The
// page's own keys change every time a page opens, so they cannot be sent between devices.
import {
  addPlanBeat, beatsBody, deletePlanBeat, deletedBeatPath, deletedBeatText, introOf, movePlanBeat, parseBeats, planDefs, tidyNotes,
  type PlanBeat
} from './beats.ts';
import { merge3 } from './live.ts';
import { Prose, wordCount } from './prose.js';
import { aliasesIn, type PhoneChoice } from './phone-choices.ts';

/** A scene of the chapter, as both ends read it. */
export interface ChapterScene { path: string; id: string; body: string }

/** One chapter's words: its scenes in reading order and its beats note's body (null while it has none). */
export interface ChapterText {
  chapter: number;
  scenes: ChapterScene[];
  beatsPath: string;
  beatsBody: string | null;
}

export interface Laid {
  /** Each beat's `key` is its ID. */
  beats: PlanBeat[];
  intro: string;
}

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('00000' + h.toString(16)).slice(-6);
}

/** Each beat's ID, in order. (The empty part was a scene's opening words when beats held prose; IDs stay the same.) */
export function beatIds(beats: { scene: string; title: string; words: string }[]): string[] {
  const seen: Record<string, number> = {};
  return beats.map((b) => {
    const sig = [b.scene, '', b.title, b.words].join('\u0001');
    const k = (seen[sig] = (seen[sig] || 0) + 1);
    return (b.scene || 'beat') + '-' + fnv(sig + '\u0001' + k);
  });
}

/** The chapter's scene a beat with no scene of its own sits in: its last. */
const lastScene = (ch: ChapterText) => (ch.scenes.length ? ch.scenes[ch.scenes.length - 1].id.toUpperCase() : '');

/** The chapter's beats, as Beats mode shows them, each keyed by its ID. */
export function layOut(ch: ChapterText): Laid {
  const body = ch.beatsBody || '';
  const last = lastScene(ch);
  const defs = parseBeats(body).map((d) => ({ ...d, scene: d.scene || last }));
  const ids = beatIds(defs);
  return { beats: defs.map((d, i) => ({ ...d, key: ids[i] })), intro: introOf(body) };
}

/** A beat's notes counted as the writing page counts words. */
export const beatWords = (notes: string): number => wordCount(Prose.proseText(notes));

/** The chapter once its beats are `beats`: the beats note written again, as Beats mode does. */
export function chapterWith(ch: ChapterText, laid: Laid, beats: PlanBeat[]): ChapterText {
  return { ...ch, beatsBody: (laid.intro ? '\n' + laid.intro + '\n' : '') + beatsBody(planDefs(beats)) };
}

/** How beat IDs moved between two versions of a chapter that hold the same beats in the same order (a beat renamed,
 * or one added on the phone). Nothing when they do not line up. */
export function idChanges(was: { key: string; scene: string }[], now: Laid): [string, string][] {
  if (was.length !== now.beats.length) return [];
  if (was.some((b, i) => b.scene !== now.beats[i].scene)) return [];
  return was.map((b, i): [string, string] => [b.key, now.beats[i].key]).filter((p) => p[0] !== p[1]);
}

/** ID changes the iPad wrote on phone notes, oldest first, as one lookup: the newest change of an ID wins. */
export function aliasMap(results: string[]): Map<string, string> {
  const m = new Map<string, string>();
  results.forEach((r) => aliasesIn(r).forEach(([a, b]) => m.set(a, b)));
  return m;
}

/** A beat by its ID, following the ID changes when it has moved on. */
export function findBeat<B extends { key: string }>(beats: B[], id: string, alias: Map<string, string>): B | null {
  let x: string | undefined = id;
  for (let i = 0; x && i < 30; i++) {
    const hit = beats.find((b) => b.key === x);
    if (hit) return hit;
    x = alias.get(x);
  }
  return null;
}

export interface Step {
  /** "applied", "applied (it was already so)", "applied, both kept. <why>" or "skipped. <why>". */
  result: string;
  ch: ChapterText;
  /** Scenes whose words changed: none, since beats hold notes only (kept for the callers). */
  touched: string[];
  beatsChanged: boolean;
  /** A deleted beat's notes, for the book's Archive (saved before the beat goes, as Beats mode does). */
  archive: { path: string; text: string; message: string } | null;
  /** Not used since beats hold notes only: a clash keeps both sets of notes in the beat. */
  copy: { path: string; scene: string; body: string } | null;
  /** IDs this step changed. */
  aliases: [string, string][];
}

function beatLabel(c: PhoneChoice): string {
  const n = (c.beatName || '').trim();
  return n ? '“' + n + '”' : 'the beat';
}

/** The line that keeps the phone's notes under this device's when both changed the same lines. */
export const FROM_PHONE = 'From your phone:';

/** Put one of Write mode's choices into a chapter, the way Beats mode makes the same press. Pure. */
export function beatStep(ch: ChapterText, c: PhoneChoice, alias: Map<string, string>, bookFolder: string, now: Date): Step {
  const laid = layOut(ch);
  const beats = laid.beats;
  const none: Step = { result: '', ch, touched: [], beatsChanged: false, archive: null, copy: null, aliases: [] };
  const skip = (why: string): Step => ({ ...none, result: 'skipped. ' + why });
  const same = (): Step => ({ ...none, result: 'applied (it was already so)' });
  const gone = () => skip('In chapter ' + ch.chapter + ', ' + beatLabel(c) + ' is not as your phone saw it any more.');
  const done = (next: PlanBeat[], extra: Partial<Step> = {}): Step => {
    const out = chapterWith(ch, laid, next);
    return { ...none, result: 'applied', ch: out, beatsChanged: out.beatsBody !== ch.beatsBody, aliases: idChanges(next, layOut(out)), ...extra };
  };

  if (c.kind === 'beat-add') {
    if (findBeat(beats, c.beat || '', alias)) return same();
    const place = c.place || 'end';
    let next: PlanBeat[];
    if (place === 'end') {
      if (!ch.scenes.length) return skip('Chapter ' + ch.chapter + ' has no scenes to put a beat in.');
      next = addPlanBeat(beats, null, c.now, lastScene(ch));
    } else {
      const after = findBeat(beats, place.replace(/^after\s+/, ''), alias);
      if (!after) return skip('The beat it was added after is not in chapter ' + ch.chapter + ' any more.');
      next = addPlanBeat(beats, after.key, c.now, after.scene);
    }
    const made = next.find((b) => !beats.some((x) => x.key === b.key));
    if (!made) return skip('Chapter ' + ch.chapter + ' has no scenes to put a beat in.');
    // The new beat keeps the phone's ID until it is saved; its saved ID follows it in the result.
    next = next.map((b) => (b === made ? { ...b, key: c.beat || b.key } : b));
    return done(next);
  }

  const b = findBeat(beats, c.beat || '', alias);
  if (!b) return gone();
  const i = beats.indexOf(b);

  if (c.kind === 'beat-write') {
    const cur = b.notes, was = tidyNotes(c.was), mine = tidyNotes(c.now);
    if (cur === mine) return same();
    let notes = mine;
    let said = '';
    if (cur !== was) {
      // Changed here too since the phone read it: merged line by line, as words written offline are.
      const m = merge3(was, mine, cur);
      if (m.clash) {
        // Both changed the same lines: this device's notes stay, and the phone's go under them, so nothing is lost.
        notes = cur + '\n\n' + FROM_PHONE + '\n' + mine;
        said = ', both kept. Beat ' + (i + 1) + '\'s notes were changed on the same lines here too, so your phone\'s are under them, after “' + FROM_PHONE + '”';
      } else notes = m.text;
    }
    const out = done(beats.map((x) => (x === b ? { ...x, notes: tidyNotes(notes) } : x)));
    return said ? { ...out, result: 'applied' + said } : out;
  }

  if (c.kind === 'beat-rename') {
    if (b.title === c.now) return same();
    if (b.title !== c.was) return skip('Beat ' + (i + 1) + ' was renamed here (“' + (b.title || 'no name') + '”), so your phone\'s name for it was not used.');
    return done(beats.map((x) => (x === b ? { ...x, title: c.now } : x)));
  }

  if (c.kind === 'beat-delete') {
    if (b.notes !== tidyNotes(c.was)) return skip('Beat ' + (i + 1) + '\'s notes changed after your phone showed them, so it was not deleted.');
    let archive: Step['archive'] = null;
    if (b.notes || b.summary.trim()) {
      archive = {
        path: deletedBeatPath(bookFolder, ch.chapter, i + 1, b.title, now),
        text: deletedBeatText(b, ch.chapter, i + 1, now),
        message: 'beats: archive chapter ' + ch.chapter + ' beat ' + (i + 1) + '\n\nDeleted with its notes in Sparrow Pocket; the beat as it stood is kept here.'
      };
    }
    return done(deletePlanBeat(beats, b.key), { archive });
  }

  if (c.kind === 'beat-move') {
    const place = c.place || 'end';
    let before: string | null = null;
    if (place !== 'end') {
      const t = findBeat(beats, place.replace(/^before\s+/, ''), alias);
      if (!t) return skip('The beat it was moved next to is not in chapter ' + ch.chapter + ' any more.');
      before = t.key;
    }
    const next = movePlanBeat(beats, b.key, before);
    if (next === beats) return same();
    return done(next);
  }
  return skip('Sparrow cannot read this choice.');
}

/** The ID changes a change to a chapter's words made (a card or a paragraph rewritten). Beats no longer depend on the
 * prose, so none; kept for the callers. */
export function idChangesBetween(was: ChapterText, now: ChapterText): [string, string][] {
  return was.beatsBody === now.beatsBody ? [] : idChanges(layOut(was).beats, layOut(now));
}

/** Where a move up or down lands, as Beats mode's drag would drop it: before the beat above, or after the one below. */
export function moveTarget(beats: { key: string }[], key: string, dir: 'up' | 'down'): string | null | undefined {
  const i = beats.findIndex((b) => b.key === key);
  if (i < 0) return undefined;
  if (dir === 'up') return i > 0 ? beats[i - 1].key : undefined;
  if (i >= beats.length - 1) return undefined;
  return i + 2 < beats.length ? beats[i + 2].key : null;
}
