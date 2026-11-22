// A chapter's beats: the moves of a chapter, each a short title and a one-line summary, kept in the book's
// `Chapter Beats/` folder as one `chapter-beats` note per chapter. The scenes keep only the story. Each beat says which
// scene it sits in and the first words of the paragraph it starts at, so the writing screen's Beats tab can jump to it.
//
// Beats are for planning (Kyle, 2026-11-22: "the text inside each beat is room for my planning thoughts. So when I
// write on beat mode, the text doesn't go into the word processor. It's just brainstorming for me as I prewrite the
// chapter"). What Kyle writes inside a beat is kept under the beat, after a `### Notes` line, and never in a scene.
//
// The note reads plainly in Obsidian:
//
//   ## Reed's theory
//   Reed says the first minute is a promise. Grey asks why he's in a tuxedo.
//
//   Starts: S-052 · Reed had a theory about videos.
//
//   ### Notes
//   Maybe the tuxedo is borrowed from Mace. Open on the dinner table, not the field.
//
// A beat with a scene and no words has no prose yet (planned). A beat with no Starts line goes in the chapter's last scene.
import { Frontmatter } from './frontmatter.js';
import { splitLead } from './lead.ts';
import type { NoteRecord } from './types.ts';

export const BEATS_FOLDER = 'Chapter Beats';
export const BEATS_TYPE = 'chapter-beats';

export interface BeatDef {
  title: string;
  summary: string;
  /** The scene ID the beat sits in, or '' for the chapter's last scene. */
  scene: string;
  /** The first words of the paragraph the beat starts at, or '' when it has no prose yet. */
  words: string;
  /** Kyle's planning notes for the beat, as he wrote them (lines and blank lines kept). */
  notes: string;
}

const STARTS = /^Starts:\s*(S-\d{3,})?\s*(?:·\s*(.*?))?\s*$/i;
const NOTES = /^###\s+Notes\s*$/i;

/** A notes line that would read as a heading is kept with a backslash in front, and read back without it. */
const escNote = (line: string) => (/^\\*#/.test(line) ? '\\' + line : line);
const unescNote = (line: string) => (/^\\+#/.test(line) ? line.slice(1) : line);
/** Notes as they are kept: no blank lines at either end, no spaces at line ends. */
export const tidyNotes = (s: string) => String(s || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');

/** A beat Kyle has not named is saved as "Untitled beat" and reads back with no title. */
const UNTITLED = 'Untitled beat';
const unnamed = (t: string) => (t === UNTITLED ? '' : t);

/** The beats in a beats note's body, in order. Text before the first `## ` heading is left out. */
export function parseBeats(body: string): BeatDef[] {
  const out: BeatDef[] = [];
  let cur: (BeatDef & { lines: string[]; note: string[] | null }) | null = null;
  const close = () => {
    if (!cur) return;
    out.push({ title: cur.title, summary: cur.lines.join(' ').replace(/\s+/g, ' ').trim(), scene: cur.scene, words: cur.words, notes: tidyNotes((cur.note || []).join('\n')) });
    cur = null;
  };
  body.split(/\r?\n/).forEach((line) => {
    const h = /^##\s+(.*)$/.exec(line);
    if (h && !/^###/.test(line)) { close(); cur = { title: unnamed(h[1].trim()), summary: '', scene: '', words: '', notes: '', lines: [], note: null }; return; }
    if (!cur) return;
    if (cur.note) { cur.note.push(unescNote(line)); return; }
    if (NOTES.test(line.trim())) { cur.note = []; return; }
    const s = STARTS.exec(line.trim());
    if (s) { cur.scene = (s[1] || '').toUpperCase(); cur.words = s[2] || ''; return; }
    if (line.trim()) cur.lines.push(line.trim());
  });
  close();
  return out;
}

const oneLine = (s: string) => String(s || '').replace(/\s+/g, ' ').trim();

/** A beats note's body from its beats. */
export function beatsBody(beats: BeatDef[]): string {
  const parts = beats.map((b) => {
    const L = ['## ' + (oneLine(b.title) || UNTITLED)];
    if (oneLine(b.summary)) L.push(oneLine(b.summary));
    if (b.scene) L.push('', 'Starts: ' + b.scene + (b.words ? ' · ' + oneLine(b.words) : ''));
    const notes = tidyNotes(b.notes);
    if (notes) L.push('', '### Notes', notes.split('\n').map(escNote).join('\n'));
    return L.join('\n');
  });
  return '\n' + parts.join('\n\n') + (parts.length ? '\n' : '');
}

/** The whole note for a chapter that has none yet. */
export function newBeatsText(chapter: number, beats: BeatDef[]): string {
  return Frontmatter.join({ type: BEATS_TYPE, title: beatsTitle(chapter), chapter }, beatsBody(beats).replace(/^\n/, ''));
}

/** Text above the first beat in a beats note, kept as it is when the beats are written again. */
export function introOf(body: string): string {
  const m = /(^|\n)## /.exec(body);
  return (m ? body.slice(0, m.index) : body).trim();
}

export const beatsTitle = (chapter: number) => 'Chapter ' + chapter + ' beats';
export const beatsPath = (bookFolder: string, chapter: number) => bookFolder + '/' + BEATS_FOLDER + '/' + beatsTitle(chapter) + '.md';

/** The book's beats note for a chapter, if it has one. */
export function beatsNoteFor(notes: Record<string, NoteRecord>, bookFolder: string, chapter: number | null): NoteRecord | null {
  if (chapter == null) return null;
  return Object.values(notes).find((n) => n.type === BEATS_TYPE && n.path.startsWith(bookFolder + '/') && Number(n.data.chapter) === chapter) || null;
}

// ---- Paragraphs, for finding where a beat starts in a scene ----

export interface Block { start: number; end: number }

/** The paragraphs of a text: runs of lines with something on them, split by blank lines. */
export function blocks(text: string): Block[] {
  const out: Block[] = [];
  const re = /[^\n]*\S[^\n]*(?:\n[^\n]*\S[^\n]*)*/g;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push({ start: m.index, end: m.index + m[0].length });
  return out;
}

/** Plain words of a paragraph: no Markdown marks, quotes made straight, one space between words. */
function plain(s: string): string {
  return s.replace(/^\s*>\s?/gm, '').replace(/[*_=`#]/g, '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}
const norm = (s: string) => plain(s).toLowerCase().replace(/”/g, '"');

function startsWith(para: string, words: string): boolean {
  const w = norm(words);
  return Boolean(w) && norm(para).startsWith(w);
}

/** Where a beat starts in a scene's text: the paragraph its first words open, or -1 when they are not there. */
export function beatStart(text: string, words: string): number {
  const w = norm(words);
  if (!w) return -1;
  const b = blocks(text).find((k) => norm(text.slice(k.start, k.end)).startsWith(w));
  return b ? b.start : -1;
}

/** The words a beat is found by: the first ten words of its first paragraph. */
export function anchorOf(prose: string): string {
  const b = blocks(prose)[0];
  if (!b) return '';
  return plain(prose.slice(b.start, b.end)).split(' ').slice(0, 10).join(' ').replace(/"/g, '”');
}


// ---- Laying a chapter out under its beats, with their prose (Sparrow Pocket's Write mode) ----
// Kyle, 2026-11-22: "for pocket let's have the beats in write mode have a 3rd section--one for writing too". On the
// phone each beat has its notes and its prose; the prose lives in the scenes, found by each beat's first words.

export interface ChapterScene { path: string; id: string; body: string }

export interface BeatView {
  /** Stable while the page is open. */
  key: string;
  title: string;
  summary: string;
  /** The scene's path and ID. */
  path: string;
  scene: string;
  /** The beat's prose, exactly as it stands in the scene. */
  prose: string;
  /** Prose at the start of a scene that comes before its first beat: shown without a heading, never saved as a beat. */
  loose: boolean;
  /** The beat's first words are no longer in its scene, so it shows no prose (its words sit in the beat above). */
  lost: boolean;
  /** The words it was found by, kept for a lost beat until Kyle gives it prose again. */
  words: string;
  /** Kyle's planning notes for the beat. */
  notes: string;
}

export interface SceneShape { path: string; id: string; lead: string; tail: string }


/** Lay a chapter's scenes out under its beats. Every paragraph lands in exactly one beat, in reading order. */
export function layoutChapter(scenes: ChapterScene[], defs: BeatDef[]): { beats: BeatView[]; scenes: SceneShape[] } {
  const ids = scenes.map((s) => s.id.toUpperCase());
  const last = ids[ids.length - 1] || '';
  const home = (d: BeatDef) => (d.scene && ids.indexOf(d.scene.toUpperCase()) >= 0 ? d.scene.toUpperCase() : last);
  const beats: BeatView[] = [];
  const shapes: SceneShape[] = [];
  scenes.forEach((s) => {
    const { lead, text } = splitLead(s.body);
    const bl = blocks(text);
    const tail = bl.length ? text.slice(bl[bl.length - 1].end) : text;
    shapes.push({ path: s.path, id: s.id, lead, tail });
    const mine = defs.filter((d) => home(d) === s.id.toUpperCase());
    let pos = 0;
    const found = mine.map((d) => {
      if (!d.words) return { d, at: -1, lost: false };
      for (let i = pos; i < bl.length; i++) {
        if (startsWith(text.slice(bl[i].start, bl[i].end), d.words)) { pos = i + 1; return { d, at: i, lost: false }; }
      }
      return { d, at: -1, lost: true };
    });
    const starts = found.filter((f) => f.at >= 0).map((f) => f.at);
    const slice = (from: number) => {
      const to = starts.find((x) => x > from);
      const end = to == null ? bl.length : to;
      return end > from ? text.slice(bl[from].start, bl[end - 1].end) : '';
    };
    const first = starts.length ? starts[0] : bl.length;
    if (first > 0) {
      beats.push({ key: nextKey(), title: '', summary: '', path: s.path, scene: s.id, prose: text.slice(bl[0].start, bl[first - 1].end), loose: true, lost: false, words: '', notes: '' });
    }
    found.forEach((f) => {
      beats.push({ key: nextKey(), title: f.d.title, summary: f.d.summary, path: s.path, scene: s.id, prose: f.at >= 0 ? slice(f.at) : '', loose: false, lost: f.lost, words: f.d.words, notes: f.d.notes || '' });
    });
  });
  return { beats, scenes: shapes };
}

/** A scene's body put back together from its beats, in order. */
export function sceneBody(shape: SceneShape, beats: BeatView[]): string {
  const parts = beats.filter((b) => b.path === shape.path).map((b) => b.prose.replace(/^\s+|\s+$/g, '')).filter(Boolean);
  const text = parts.join('\n\n');
  const tail = parts.length ? (shape.tail || '\n') : '';
  return (shape.lead || (text ? '\n' : '')) + text + tail;
}

/** The beats to save in the chapter's note: every beat with a heading, found again by its first words. */
export function beatDefs(beats: BeatView[]): BeatDef[] {
  return beats.filter((b) => !b.loose).map((b) => ({
    title: b.title, summary: b.summary, scene: b.scene,
    words: b.prose.trim() ? anchorOf(b.prose) : b.lost ? b.words : '', notes: b.notes
  }));
}

/** Take a beat's heading off: its prose joins the beat above in the same scene, or stays as the scene's opening words. */
export function removeBeat(beats: BeatView[], key: string): BeatView[] {
  const i = beats.findIndex((b) => b.key === key);
  if (i < 0) return beats;
  const b = beats[i];
  const out = beats.slice();
  if (!b.prose.trim()) { out.splice(i, 1); return out; }
  const above = out[i - 1];
  if (above && above.path === b.path) {
    out[i - 1] = { ...above, prose: [above.prose.trim(), b.prose.trim()].filter(Boolean).join('\n\n') };
    out.splice(i, 1);
  } else {
    out[i] = { ...b, title: '', summary: '', loose: true, lost: false };
  }
  return out;
}

/** A new, empty beat right after this one, in the same scene. */
export function addBeatAfter(beats: BeatView[], key: string, title: string): BeatView[] {
  const i = beats.findIndex((b) => b.key === key);
  const at = beats[i];
  if (!at) return beats;
  const out = beats.slice();
  out.splice(i + 1, 0, { key: nextKey(), title, summary: '', path: at.path, scene: at.scene, prose: '', loose: false, lost: false, words: '', notes: '' });
  return out;
}

/** Give a scene's opening words (the part before its first beat) a heading of their own. */
export function nameLoose(beats: BeatView[], key: string, title: string): BeatView[] {
  return beats.map((b) => (b.key === key ? { ...b, title, loose: false } : b));
}

/** Move a beat (and its prose) to just before another beat, or to the chapter's end when `before` is null.
 * Every part of a scene is a beat (Kyle, 2026-10-19), so a scene's opening words move too: once moved, or once
 * something lands in front of them, they become a beat of their own (no name yet) so the app can find them again.
 * The beat joins the scene of the beat it lands next to (keeping its own scene at a scene break, else the one above).
 * Returns the beats and the scenes whose words change. */
export function moveBeat(beats: BeatView[], key: string, before: string | null): { beats: BeatView[]; touched: string[] } {
  const b = beats.find((x) => x.key === key);
  if (!b || before === key) return { beats, touched: [] };
  const rest = beats.filter((x) => x.key !== key);
  const at = before == null ? rest.length : rest.findIndex((x) => x.key === before);
  if (at < 0) return { beats, touched: [] };
  const above = rest[at - 1];
  const below = rest[at];
  const home = [above, below].find((x) => x && x.path === b.path) || above || below;
  if (!home) return { beats, touched: [] };
  const out = rest.slice();
  out.splice(at, 0, { ...b, path: home.path, scene: home.scene, loose: false });
  if (out.map((x) => x.key).join() === beats.map((x) => x.key).join() && home.path === b.path) return { beats, touched: [] };
  // Only the first part of a scene may go without a saved heading.
  const fixed = out.map((x, i) => (x.loose && i > 0 && out[i - 1].path === x.path ? { ...x, loose: false } : x));
  return { beats: fixed, touched: b.path === home.path ? [b.path] : [b.path, home.path] };
}

/** A new, empty beat at the chapter's end: after its last beat, or as the first beat of its last scene when it has none. */
export function addBeatAtEnd(beats: BeatView[], last: { path: string; id: string } | null): BeatView[] {
  if (beats.length) return addBeatAfter(beats, beats[beats.length - 1].key, '');
  if (!last) return beats;
  return [{ key: nextKey(), title: '', summary: '', path: last.path, scene: last.id, prose: '', loose: false, lost: false, words: '', notes: '' }];
}

/** Take a beat out with its words and notes. They are saved to the Archive first (`deletedBeatText`). */
export function deleteBeat(beats: BeatView[], key: string): BeatView[] {
  return beats.filter((b) => b.key !== key);
}


// ---- Beats mode: the chapter's beats as a planning list (Kyle, 2026-11-22) ----
// Each beat is its name, summary and notes. Adding, moving and deleting beats changes the beats note only; the scenes
// are never touched.

export interface PlanBeat extends BeatDef {
  /** Stable while the page is open (Sparrow Pocket uses a beat's ID instead). */
  key: string;
}

let seq = 0;
const nextKey = () => 'b' + (++seq);

/** The beats of a note's body, ready to edit. */
export const planBeats = (defs: BeatDef[]): PlanBeat[] => defs.map((d) => ({ ...d, key: nextKey() }));

/** The beats to save in the chapter's note. */
export const planDefs = (beats: PlanBeat[]): BeatDef[] => beats.map(({ title, summary, scene, words, notes }) => ({ title, summary, scene, words, notes }));

/** A new, empty beat right after this one, in its scene; or at the end (after the last beat, in `scene` when there is none). */
export function addPlanBeat(beats: PlanBeat[], after: string | null, title: string, scene: string): PlanBeat[] {
  const i = after == null ? beats.length - 1 : beats.findIndex((b) => b.key === after);
  if (after != null && i < 0) return beats;
  const at = beats[i];
  const out = beats.slice();
  out.splice(i + 1, 0, { key: nextKey(), title, summary: '', scene: at ? at.scene : scene, words: '', notes: '' });
  return out;
}

/** Move a beat to just before another beat, or to the end when `before` is null. It joins the scene of the beat it
 * lands next to (keeping its own at a scene break, else the one above). */
export function movePlanBeat(beats: PlanBeat[], key: string, before: string | null): PlanBeat[] {
  const b = beats.find((x) => x.key === key);
  if (!b || before === key) return beats;
  const rest = beats.filter((x) => x.key !== key);
  const at = before == null ? rest.length : rest.findIndex((x) => x.key === before);
  if (at < 0) return beats;
  const near = [rest[at - 1], rest[at]];
  const home = near.find((x) => x && x.scene === b.scene) || near[0] || near[1];
  const scene = home ? home.scene : b.scene;
  const out = rest.slice();
  out.splice(at, 0, scene === b.scene ? b : { ...b, scene, words: '' });
  return out.map((x) => x.key).join() === beats.map((x) => x.key).join() ? beats : out;
}

/** Take a beat out. Its notes are saved to the Archive first (`deletedBeatText`). */
export function deletePlanBeat(beats: PlanBeat[], key: string): PlanBeat[] {
  return beats.filter((b) => b.key !== key);
}

/** Where a deleted beat is kept: the book's Archive, one note per beat, named by chapter, beat and time. */
export function deletedBeatPath(bookFolder: string, chapter: number, n: number, title: string, now: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  const stamp = now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate()) + ' ' + p(now.getHours()) + p(now.getMinutes()) + p(now.getSeconds());
  const name = oneLine(title).replace(/[\\/:*?"<>|#^[\]]/g, '').slice(0, 60).trim();
  return bookFolder + '/Archive/Deleted beats/Chapter ' + chapter + ' beat ' + n + (name ? ' ' + name : '') + ' ' + stamp + '.md';
}

/** The archived copy of a deleted beat: a line saying why, its heading and summary, its notes, and its prose when it
 * had any (Sparrow Pocket's beats carry both), as they stood. */
export function deletedBeatText(b: BeatDef & { prose?: string }, chapter: number, n: number, now: Date): string {
  const prose = (b.prose || '').replace(/^\s+|\s+$/g, '');
  const L = ['> [!note] Archived', '> Beat ' + n + ' of chapter ' + chapter + (b.scene ? ' (in ' + b.scene + ')' : '') + ', deleted in the Sparrow app on ' + now.toISOString().slice(0, 10) + '.', ''];
  L.push('## ' + (oneLine(b.title) || UNTITLED));
  if (oneLine(b.summary)) L.push(oneLine(b.summary));
  L.push('', '### Notes', tidyNotes(b.notes) || '(No notes.)', '');
  if (prose) L.push('### Its prose', prose, '');
  return L.join('\n');
}
