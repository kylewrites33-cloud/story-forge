// Kyle's choices on the boards: ideas, beats and conflicts in piles (keep, later, drop), scene cards accepted or sent back,
// and what each choice does to a note's text. Edits touch only the lines they change, the way sf's setScalar does,
// so Kyle's own formatting survives.
import { Frontmatter } from './frontmatter.js';
import { idNumber } from './links.ts';
import type { NoteRecord } from './types.ts';

/** What Kyle can do to a proposal. "inbox" puts a decided or later one back in the pile to decide.
 * "accept" and "rework" are for scene cards: accept sets the accepted time, rework clears it. */
export type Decision = 'keep' | 'later' | 'drop' | 'inbox' | 'regenerate' | 'accept' | 'rework' | 'move' | 'edit';

/** Where a scene card was dragged to on the Chapter Grid: its new order, chapter and that chapter's title. */
export interface Move {
  order: number;
  /** null when it goes to "No chapter yet". */
  chapter: number | null;
  /** The chapter's title, '' when it has none. */
  chapterTitle: string;
}

/** The tag that marks an inbox idea Kyle wants to come back to. Its status stays inbox. */
export const LATER_TAG = 'later';

export type Pile = 'decide' | 'later' | 'rewrite' | 'kept' | 'dropped' | 'other';

export const PILES: { key: Pile; label: string }[] = [
  { key: 'decide', label: 'To decide' },
  { key: 'later', label: 'Later' },
  { key: 'rewrite', label: 'To rewrite' },
  { key: 'kept', label: 'Kept' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'other', label: 'Other' }
];

function tags(data: Record<string, unknown>): string[] {
  const t = data.tags;
  if (Array.isArray(t)) return t.map(String);
  return typeof t === 'string' && t ? [t] : [];
}

export function pileOf(data: Record<string, unknown>): Pile {
  const status = String(data.status || 'inbox');
  if (status === 'inbox') return tags(data).indexOf(LATER_TAG) >= 0 ? 'later' : 'decide';
  if (status === 'keep') return 'kept';
  if (status === 'regenerate') return 'rewrite';
  if (status === 'discard') return 'dropped';
  return 'other';
}

/** Ideas in ID order, split into piles. */
export function piles(notes: NoteRecord[]): Record<Pile, NoteRecord[]> {
  const out: Record<Pile, NoteRecord[]> = { decide: [], later: [], rewrite: [], kept: [], dropped: [], other: [] };
  notes
    .slice()
    .sort((a, b) => (idNumber(a.data.id) || 0) - (idNumber(b.data.id) || 0) || a.path.localeCompare(b.path))
    .forEach((n) => out[pileOf(n.data)].push(n));
  return out;
}

/** A local date and time with its offset, to the minute, as sf's datetime rule accepts: 2026-10-17T11:40-04:00. */
export function stamp(d: Date): string {
  const p = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) +
    (off >= 0 ? '+' : '-') + p(Math.trunc(off / 60)) + ':' + p(off % 60);
}

export interface Change {
  /** The status to set; null leaves it (scene cards keep their status). */
  status: string | null;
  /** Tags after the change; null leaves the tags line alone. */
  tags: string[] | null;
  /** A datetime to set, '' to remove the line, null to leave it. */
  decided: string | null;
  /** A reason to set; null leaves any reason there already. */
  note: string | null;
  /** For scene cards: a datetime to set, '' to remove the line, null to leave it. */
  accepted?: string | null;
  /** For a moved scene card: the new order; chapter and chapter_title to set, or '' to remove the line. */
  order?: number;
  chapter?: number | '';
  chapterTitle?: string;
  /** Kyle's own edits to a card: property values to set, '' to remove the line. */
  fields?: Record<string, string>;
}

/** One line per value: a card edit never writes a line break into a property. */
export function cleanField(v: string): string {
  return v.replace(/\s+/g, ' ').trim();
}

/** What an edit sets: only the properties Kyle changed. */
export function editChange(fields: Record<string, string>): Change {
  const out: Record<string, string> = {};
  Object.keys(fields).forEach((k) => { out[k] = cleanField(fields[k]); });
  return { status: null, tags: null, decided: null, note: null, fields: out };
}

/** What a move sets. Only order, chapter and chapter_title change; the card's status stays. */
export function moveChange(m: Move): Change {
  return { status: null, tags: null, decided: null, note: null, order: m.order, chapter: m.chapter == null ? '' : m.chapter, chapterTitle: m.chapterTitle };
}

/** What a decision sets, given the note's current properties. */
export function changeFor(data: Record<string, unknown>, decision: Decision, now: Date, reason = ''): Change {
  const had = tags(data);
  const without = had.filter((t) => t !== LATER_TAG);
  const note = reason.trim() ? reason.trim().replace(/\s+/g, ' ') : null;
  if (decision === 'move' || decision === 'edit') return { status: null, tags: null, decided: null, note: null };
  if (decision === 'accept') return { status: null, tags: null, decided: null, note, accepted: stamp(now) };
  if (decision === 'rework') return { status: null, tags: null, decided: null, note, accepted: data.accepted == null ? null : '' };
  if (decision === 'later') {
    return { status: 'inbox', tags: had.indexOf(LATER_TAG) >= 0 ? null : had.concat(LATER_TAG), decided: null, note };
  }
  const tagsAfter = without.length === had.length ? null : without;
  if (decision === 'inbox') return { status: 'inbox', tags: tagsAfter, decided: data.decided == null ? null : '', note };
  const status = decision === 'keep' ? 'keep' : decision === 'regenerate' ? 'regenerate' : 'discard';
  return { status, tags: tagsAfter, decided: stamp(now), note };
}

/** The properties after a change, for showing a choice before GitHub has it. */
export function applyToData(data: Record<string, unknown>, c: Change): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  if (c.status) out.status = c.status;
  if (c.accepted === '') delete out.accepted;
  else if (c.accepted) out.accepted = c.accepted;
  if (c.tags) { if (c.tags.length) out.tags = c.tags; else delete out.tags; }
  if (c.decided === '') delete out.decided;
  else if (c.decided) out.decided = c.decided;
  if (c.note) out.decision_note = c.note;
  if (c.order != null) out.order = c.order;
  if (c.chapter === '') { delete out.chapter; delete out.chapter_title; }
  else if (c.chapter != null) {
    out.chapter = c.chapter;
    if (c.chapterTitle) out.chapter_title = c.chapterTitle; else delete out.chapter_title;
  }
  if (c.fields) Object.keys(c.fields).forEach((k) => { if (c.fields![k] === '') delete out[k]; else out[k] = c.fields![k]; });
  return out;
}

const keyRe = (key: string) => new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[ \\t]*:');

/** Replace a property's lines (its own line and any indented or list lines under it), add them, or remove them (null). */
function setLines(text: string, key: string, replacement: string[] | null): string {
  const s = Frontmatter.split(text);
  if (!s.hasFm) throw new Error('This note has no properties, so the app cannot change it. Fix it in Obsidian.');
  const eol = s.yaml && s.yaml.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const lines = s.yaml ? s.yaml.split(/\r?\n/) : [];
  const re = keyRe(key);
  let at = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && (/^[ \t]+\S/.test(lines[j]) || /^-([ \t]|$)/.test(lines[j]))) j++;
    lines.splice(i, j - i);
    at = i;
    break;
  }
  if (replacement) lines.splice(at < 0 ? lines.length : at, 0, ...replacement);
  return s.open + lines.join(eol) + s.close + s.body;
}

/** The note's text after a change. Refuses frontmatter it cannot read, so a typo never costs a note its properties. */
export function applyToText(text: string, c: Change): string {
  const p = Frontmatter.parse(text);
  if (p.error) throw new Error('This note\'s properties cannot be read (' + p.error + '). Fix it in Obsidian, then try again.');
  let out = c.status ? Frontmatter.setScalar(text, 'status', c.status) : text;
  if (c.accepted === '') out = setLines(out, 'accepted', null);
  else if (c.accepted) out = Frontmatter.setScalar(out, 'accepted', c.accepted);
  if (c.tags) out = setLines(out, 'tags', c.tags.length ? ['tags:'].concat(c.tags.map((t) => '  - ' + Frontmatter.emitScalar(t))) : null);
  if (c.decided === '') out = setLines(out, 'decided', null);
  else if (c.decided) out = Frontmatter.setScalar(out, 'decided', c.decided);
  if (c.note) out = Frontmatter.setScalar(out, 'decision_note', c.note);
  if (c.order != null) out = Frontmatter.setScalar(out, 'order', c.order);
  if (c.chapter === '') out = setLines(setLines(out, 'chapter', null), 'chapter_title', null);
  else if (c.chapter != null) {
    out = Frontmatter.setScalar(out, 'chapter', c.chapter);
    if (c.chapterTitle) out = Frontmatter.setScalar(out, 'chapter_title', c.chapterTitle);
    else if (/^chapter_title[ \t]*:/m.test(Frontmatter.split(out).yaml || '')) out = setLines(out, 'chapter_title', null);
  }
  if (c.fields) {
    Object.keys(c.fields).forEach((k) => {
      const v = c.fields![k];
      out = v === '' ? setLines(out, k, null) : Frontmatter.setScalar(out, k, v);
    });
  }
  return out;
}

/** Commit prefix, what a note is called, and the board it is decided on, by note type. */
const KINDS: Record<string, { prefix: string; noun: string; board: string }> = {
  idea: { prefix: 'ideas', noun: 'an idea', board: 'Ideas board' },
  beat: { prefix: 'beats', noun: 'a beat', board: 'Beat Sheet' },
  conflict: { prefix: 'conflicts', noun: 'a conflict', board: 'Conflict Matrix' },
  scene: { prefix: 'scenes', noun: 'a scene card', board: 'Chapter Grid' },
  'market-thesis': { prefix: 'market', noun: 'a market case', board: 'Market board' },
  comp: { prefix: 'market', noun: 'a comp', board: 'Market board' },
  'keyword-set': { prefix: 'market', noun: 'a keyword set', board: 'Market board' },
  'title-candidate': { prefix: 'market', noun: 'a title', board: 'Market board' }
};

const VERBS: Record<Decision, string> = { keep: 'keep', later: 'later', drop: 'drop', inbox: 'back to inbox', regenerate: 'rewrite', edit: 'edit', accept: 'accept card', rework: 'card needs work', move: 'move' };

/** The commit message for a decision. It has no Agent trailer: the choice is Kyle's. */
export function commitMessage(data: Record<string, unknown>, decision: Decision): string {
  const k = KINDS[String(data.type || 'idea')] || KINDS.idea;
  const name = [data.id, data.title].filter(Boolean).join(' ');
  return k.prefix + ': ' + VERBS[decision] + ' ' + (name || k.noun) + '\n\n' + (decision === 'edit' ? 'Edited' : 'Chosen') + ' on the ' + k.board + ' in the Story Forge app.';
}
