// Kyle's choices from his phone (2026-11-21). Kyle: "im a little worried about messing up the main app with this pocket
// app ... let the phone record my choices, and the ipad apply it when i next open it", then "no send button necessary if
// its automatic". Sparrow Pocket records each choice on the phone and writes them, a few at a time, to one note of the
// vault's `phone-choices` type in the book's `Phone/` folder. Sparrow on the iPad or desktop puts them in through its own
// buttons (src/vault/phone.ts) and writes each one's result on the note.
//
// This file is the note's one format, shared by both ends: writing it, reading it, and the line edits each end makes.
// It is plain text work, tested with Node (tests/phone-choices.test.ts). It saves nothing.
import { Frontmatter } from './frontmatter.js';

export const PHONE_TYPE = 'phone-choices';
export const PHONE_FOLDER = 'Phone';
/** Another device leaves a note it sees being put in alone for this long, then takes over (an iPad closed halfway). */
export const CLAIM_MS = 10 * 60 * 1000;

export type PhoneKind = 'use' | 'reject' | 'tweak' | 'tell' | 'rewrite' | BeatKind;
/** Write mode's choices on a chapter's beats (2026-11-21; Kyle: "can you make a writing mode, too? ... i can open each
 * beat and write in it, rewrite beat titles, and add, delete, or move beats arond"). src/lib/phone-beats.ts lays the
 * chapter out by its beats and puts each one in, the same way on both ends. */
export type BeatKind = 'beat-write' | 'beat-rename' | 'beat-add' | 'beat-delete' | 'beat-move';
export const BEAT_KINDS: readonly BeatKind[] = ['beat-write', 'beat-rename', 'beat-add', 'beat-delete', 'beat-move'];
export const isBeatKind = (k: string): k is BeatKind => (BEAT_KINDS as readonly string[]).indexOf(k) >= 0;
export type PhoneStatus = 'sent' | 'applying' | 'applied';

/** One choice as the note holds it. */
export interface PhoneChoice {
  /** Its number in the note, in the order Kyle made them (0 while it is still only on the phone). */
  n: number;
  kind: PhoneKind;
  /** use and tweak: which version (1 or 2); 0 for a card with one version. */
  version: number;
  /** The card (C-03); '' for a rewrite. */
  card: string;
  chapter: number;
  /** The chapter's own ID (CH-001), or ''. */
  chapterId: string;
  /** rewrite: the scene's ID. */
  scene: string;
  /** use: the version's words as the phone showed them; tweak: his words; tell: his reply. */
  words: string;
  /** rewrite: the paragraph exactly as it stood, and his paragraph ('' cuts it). A beat: write, its words before and
   * after; rename, its name before and after; add, its name (now); delete, its words as they stood (was). */
  was: string;
  now: string;
  /** A beat choice: the beat, by its ID in phone-beats.ts ("S-001-3fa9c2", or "new-..." for a beat added on the phone). */
  beat?: string;
  /** A beat choice: how the phone showed the beat, for the notes and the notice ("beat 3, Reed's theory"). */
  beatName?: string;
  /** add: "after <ID>" or "end"; move: "before <ID>" or "end". */
  place?: string;
  /** When he made it (UTC). */
  made: string;
  /** What the iPad did with it: '' while it waits, "applied", or "skipped. <why>". */
  result: string;
}

/** What the heading says he chose. */
export function labelOf(c: PhoneChoice): string {
  if (c.kind === 'use') return c.version === 0 ? 'Accept' : 'Use version ' + c.version;
  if (c.kind === 'reject') return 'Reject';
  if (c.kind === 'tweak') return c.version === 0 ? 'Tweak' : 'Tweak version ' + c.version;
  if (c.kind === 'tell') return 'Tell the Writer';
  if (c.kind === 'beat-write') return 'Write in a beat';
  if (c.kind === 'beat-rename') return 'Rename a beat';
  if (c.kind === 'beat-add') return 'Add a beat';
  if (c.kind === 'beat-delete') return 'Delete a beat';
  if (c.kind === 'beat-move') return 'Move a beat';
  return 'Rewrite a paragraph';
}

function kindOf(label: string): { kind: PhoneKind; version: number } | null {
  const l = label.trim();
  if (l === 'Accept') return { kind: 'use', version: 0 };
  let m = /^Use version ([12])$/.exec(l);
  if (m) return { kind: 'use', version: Number(m[1]) };
  if (l === 'Reject') return { kind: 'reject', version: 0 };
  if (l === 'Tweak') return { kind: 'tweak', version: 0 };
  m = /^Tweak version ([12])$/.exec(l);
  if (m) return { kind: 'tweak', version: Number(m[1]) };
  if (l === 'Tell the Writer') return { kind: 'tell', version: 0 };
  if (l === 'Rewrite a paragraph') return { kind: 'rewrite', version: 0 };
  const beat = (['beat-write', 'beat-rename', 'beat-add', 'beat-delete', 'beat-move'] as BeatKind[]).find((k) => labelOf({ kind: k, version: 0 } as PhoneChoice) === l);
  if (beat) return { kind: beat, version: 0 };
  return null;
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Words as `> ` lines, as the changes note quotes them; an empty line is a lone `>`. */
export function quoteBlock(text: string): string[] {
  return text === '' ? [] : text.split('\n').map((l) => (l === '' ? '>' : '> ' + l));
}

function unquote(lines: string[]): string {
  return lines.map((l) => (l === '>' ? '' : l.startsWith('> ') ? l.slice(2) : l.slice(1))).join('\n');
}

/** One choice's section of the note. */
export function choiceSection(c: PhoneChoice): string {
  const out = ['## ' + c.n + ' · ' + labelOf(c)];
  if (c.card) out.push('Card: ' + c.card);
  out.push('Chapter: ' + c.chapter);
  if (c.chapterId) out.push('Chapter ID: ' + c.chapterId);
  if (c.scene) out.push('Scene: ' + c.scene);
  if (c.beat) out.push('Beat: ' + c.beat + (c.beatName ? ' (' + oneLine(c.beatName) + ')' : ''));
  if (c.place) out.push('Where: ' + c.place);
  out.push('Made: ' + c.made);
  if (c.result) out.push('Result: ' + c.result);
  if (c.kind === 'beat-write' || c.kind === 'beat-rename') {
    out.push('', 'Was:', ...quoteBlock(c.was), '', 'Now:', ...quoteBlock(c.now));
  } else if (c.kind === 'beat-add') {
    out.push('', 'Now:', ...quoteBlock(c.now));
  } else if (c.kind === 'beat-delete') {
    out.push('', 'Was:', ...quoteBlock(c.was));
  } else if (c.kind === 'beat-move') {
    // Nothing more: the beat and where it went say it all.
  } else if (c.kind === 'rewrite') {
    out.push('', 'Was:', ...quoteBlock(c.was), '', 'Now:', ...quoteBlock(c.now));
  } else if (c.kind !== 'reject') {
    out.push('', 'Words:', ...quoteBlock(c.words));
  }
  return out.join('\n');
}

const INTRO = 'Choices Kyle made on his phone in Sparrow Pocket. Sparrow on the iPad puts them in through its own buttons, in this order, when the book is opened, and writes what happened under each one.';

/** A whole new note. */
export function newNoteText(title: string, created: string, choices: PhoneChoice[]): string {
  return ['---', 'type: ' + PHONE_TYPE, 'title: ' + title, 'status: sent', 'created: ' + created.slice(0, 10), '---', INTRO, '',
    choices.map(choiceSection).join('\n\n'), ''].join('\n');
}

/** The note's title and file name for a note started at `at`: "Phone choices 2026-11-21 1403" (UTC). */
export function noteTitle(at: Date): string {
  const i = at.toISOString();
  return 'Phone choices ' + i.slice(0, 10) + ' ' + i.slice(11, 13) + i.slice(14, 16);
}

export function notePath(bookFolder: string, title: string): string {
  return bookFolder + '/' + PHONE_FOLDER + '/' + title + '.md';
}

/** Phone notes in the order they were started: by name, the minute first, a note of the same minute ("(2)") after. */
export function byStart(a: string, b: string): number {
  const x = a.replace(/\.md$/, ''), y = b.replace(/\.md$/, '');
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The book folder a phone note belongs to. */
export function bookOfNote(path: string): string {
  const i = path.lastIndexOf('/' + PHONE_FOLDER + '/');
  return i < 0 ? '' : path.slice(0, i);
}

export interface PhoneNote {
  /** The note's type line (phone-choices for a phone note). */
  type: string;
  status: PhoneStatus;
  claimed: string;
  choices: PhoneChoice[];
}

const STATUSES: PhoneStatus[] = ['sent', 'applying', 'applied'];

/** Read a note's status and its choices. A section the app cannot read is left out (and left alone on the note). */
export function readNote(text: string): PhoneNote {
  const p = Frontmatter.parse(text);
  const data = (p.data || {}) as Record<string, unknown>;
  const st = String(data.status == null ? '' : data.status).trim() as PhoneStatus;
  return { type: String(data.type == null ? '' : data.type).trim(), status: STATUSES.indexOf(st) >= 0 ? st : 'sent', claimed: data.claimed == null ? '' : String(data.claimed), choices: readChoices(p.body || '') };
}

export function readChoices(body: string): PhoneChoice[] {
  const out: PhoneChoice[] = [];
  let cur: PhoneChoice | null = null;
  let into: 'words' | 'was' | 'now' | null = null;
  let quote: string[] = [];
  const endQuote = () => { if (cur && into) cur[into] = unquote(quote); into = null; quote = []; };
  const end = () => { endQuote(); if (cur) out.push(cur); cur = null; };
  body.split(/\r?\n/).forEach((line) => {
    const h = /^## (\d+) · (.+)$/.exec(line);
    if (h) {
      end();
      const k = kindOf(h[2]);
      cur = k ? { n: Number(h[1]), kind: k.kind, version: k.version, card: '', chapter: 0, chapterId: '', scene: '', words: '', was: '', now: '', made: '', result: '' } : null;
      return;
    }
    if (/^## /.test(line)) { end(); return; }
    if (!cur) return;
    if (into && line.startsWith('>')) { quote.push(line); return; }
    endQuote();
    const m = /^(Card|Chapter|Chapter ID|Scene|Beat|Where|Made|Result): ?(.*)$/.exec(line);
    if (m) {
      const v = m[2].trim();
      if (m[1] === 'Card') cur.card = v;
      else if (m[1] === 'Chapter') cur.chapter = Number(v) || 0;
      else if (m[1] === 'Chapter ID') cur.chapterId = v;
      else if (m[1] === 'Scene') cur.scene = v;
      else if (m[1] === 'Beat') { const b = /^(\S+)(?:\s+\((.*)\))?$/.exec(v); cur.beat = b ? b[1] : v; cur.beatName = b && b[2] ? b[2] : ''; }
      else if (m[1] === 'Where') cur.place = v;
      else if (m[1] === 'Made') cur.made = v;
      else cur.result = v;
      return;
    }
    if (line === 'Words:') into = 'words';
    else if (line === 'Was:') into = 'was';
    else if (line === 'Now:') into = 'now';
  });
  end();
  return out;
}

// ---- Line edits: each end changes only the lines it means to ----

/** Set (or, with '', take out) properties in the note's properties block. */
export function setProps(text: string, props: Record<string, string>): string {
  const lines = text.split('\n');
  if (lines[0] !== '---') return text;
  let close = lines.indexOf('---', 1);
  if (close < 0) return text;
  Object.keys(props).forEach((k) => {
    const i = lines.slice(1, close).findIndex((l) => l.startsWith(k + ':')) + 1;
    const v = props[k];
    if (i > 0) {
      if (v === '') { lines.splice(i, 1); close--; } else lines[i] = k + ': ' + v;
    } else if (v !== '') { lines.splice(close, 0, k + ': ' + v); close++; }
  });
  return lines.join('\n');
}

/** Where choice `n`'s section starts and ends in the note's lines (end is the next heading or the end). */
function sectionAt(lines: string[], n: number): { at: number; end: number } | null {
  const at = lines.findIndex((l) => new RegExp('^## ' + n + ' · ').test(l));
  if (at < 0) return null;
  let end = lines.findIndex((l, i) => i > at && /^## /.test(l));
  if (end < 0) end = lines.length;
  return { at, end };
}

/** Write a choice's result on the note, under its Made line. */
export function setResult(text: string, n: number, result: string): string {
  const lines = text.split('\n');
  const s = sectionAt(lines, n);
  if (!s) return text;
  const has = lines.slice(s.at, s.end).findIndex((l) => /^Result:/.test(l));
  if (has >= 0) { lines[s.at + has] = 'Result: ' + result; return lines.join('\n'); }
  const made = lines.slice(s.at, s.end).findIndex((l) => /^Made:/.test(l));
  lines.splice(made >= 0 ? s.at + made + 1 : s.at + 1, 0, 'Result: ' + result);
  return lines.join('\n');
}

/** Add choices at the end of the note. */
export function appendChoices(text: string, choices: PhoneChoice[]): string {
  if (!choices.length) return text;
  return text.replace(/\s*$/, '') + '\n\n' + choices.map(choiceSection).join('\n\n') + '\n';
}

/** Take one choice off the note (the phone's Undo, only while no device has started putting the note in). */
export function removeChoice(text: string, n: number): string {
  const lines = text.split('\n');
  const s = sectionAt(lines, n);
  if (!s) return text;
  lines.splice(s.at, s.end - s.at);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
}

// ---- A paragraph rewritten by hand ----

/** The page text with one paragraph's words replaced by `words`. Empty words take the paragraph out with the blank
 * line after it (or before it, at the end), so no double gap is left. Throws a plain sentence when the paragraph is not
 * where it was (the scene changed while Kyle typed). Sparrow Pocket shows it; the iPad puts it in. */
export function replaceParagraph(text: string, p: { at: number; end: number; text: string }, words: string): string {
  if (text.slice(p.at, p.end) !== p.text) throw new Error('This paragraph changed while you were typing. Your words are still in the box: copy them, go back and open the paragraph again.');
  const put = cleanParagraph(words);
  if (put.trim()) return text.slice(0, p.at) + put + text.slice(p.end);
  const after = /^\n[ \t]*\n+/.exec(text.slice(p.end));
  if (after) return text.slice(0, p.at) + text.slice(p.end + after[0].length);
  const before = /\n[ \t]*\n+$/.exec(text.slice(0, p.at));
  return before ? text.slice(0, p.at - before[0].length) + text.slice(p.end) : text.slice(0, p.at) + text.slice(p.end);
}

/** A paragraph as it goes in: line ends made plain, no blank lines before it, no space after it. */
export function cleanParagraph(words: string): string {
  return words.replace(/\r\n?/g, '\n').replace(/^(?:[ \t]*\n)+/, '').trimEnd();
}

/** A rewrite put into the page text where its paragraph stands, once: null when the paragraph is not there exactly
 * once (the scene changed since the phone saw it). */
export function rewriteInto(text: string, was: string, now: string): string | null {
  const at = text.indexOf(was);
  if (!was || at < 0 || text.indexOf(was, at + 1) >= 0) return null;
  return replaceParagraph(text, { at, end: at + was.length, text: was }, now);
}

// ---- Beats found again after a choice changed them ----
// A beat is known by an ID made from its scene, name and first words (src/lib/phone-beats.ts), so a choice that renames
// a beat, moves it or changes its first words gives it a new ID. The iPad writes each change of ID after the result
// ("applied · beats now S-001-3fa9c2 → S-001-77b0e1"), and both ends follow them, so a later choice made on the phone
// still finds its beat.

const NOW = ' · beats now ';

/** A result with the beats whose IDs it changed. */
export function withAliases(result: string, pairs: [string, string][]): string {
  return pairs.length ? result + NOW + pairs.map((p) => p[0] + ' → ' + p[1]).join(', ') : result;
}

/** The ID changes written after a result. */
export function aliasesIn(result: string): [string, string][] {
  const i = result.indexOf(NOW);
  if (i < 0) return [];
  return result.slice(i + NOW.length).split(',').map((x) => x.trim().split(/\s*→\s*/)).filter((p) => p.length === 2 && p[0] && p[1]) as [string, string][];
}

/** A result as Kyle reads it: without the ID changes. */
export const resultSaid = (result: string): string => {
  const i = result.indexOf(NOW);
  return i < 0 ? result : result.slice(0, i);
};
