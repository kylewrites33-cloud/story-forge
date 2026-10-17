// The Ideas board: a book's idea notes in piles, and what a keep, later or drop does to a note's text.
// Edits touch only the lines they change, the way sf's setScalar does, so Kyle's own formatting survives.
import { Frontmatter } from './frontmatter.js';
import { idNumber } from './links.ts';
import type { NoteRecord } from './types.ts';

/** What Kyle can do to an idea. "inbox" puts a decided or later idea back in the pile to decide. */
export type Decision = 'keep' | 'later' | 'drop' | 'inbox';

/** The tag that marks an inbox idea Kyle wants to come back to. Its status stays inbox. */
export const LATER_TAG = 'later';

export type Pile = 'decide' | 'later' | 'kept' | 'dropped' | 'other';

export const PILES: { key: Pile; label: string }[] = [
  { key: 'decide', label: 'To decide' },
  { key: 'later', label: 'Later' },
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
  if (status === 'discard') return 'dropped';
  return 'other';
}

/** Ideas in ID order, split into piles. */
export function piles(notes: NoteRecord[]): Record<Pile, NoteRecord[]> {
  const out: Record<Pile, NoteRecord[]> = { decide: [], later: [], kept: [], dropped: [], other: [] };
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
  status: string;
  /** Tags after the change; null leaves the tags line alone. */
  tags: string[] | null;
  /** A datetime to set, '' to remove the line, null to leave it. */
  decided: string | null;
  /** A reason to set; null leaves any reason there already. */
  note: string | null;
}

/** What a decision sets, given the note's current properties. */
export function changeFor(data: Record<string, unknown>, decision: Decision, now: Date, reason = ''): Change {
  const had = tags(data);
  const without = had.filter((t) => t !== LATER_TAG);
  const note = reason.trim() ? reason.trim().replace(/\s+/g, ' ') : null;
  if (decision === 'later') {
    return { status: 'inbox', tags: had.indexOf(LATER_TAG) >= 0 ? null : had.concat(LATER_TAG), decided: null, note };
  }
  const tagsAfter = without.length === had.length ? null : without;
  if (decision === 'inbox') return { status: 'inbox', tags: tagsAfter, decided: data.decided == null ? null : '', note };
  return { status: decision === 'keep' ? 'keep' : 'discard', tags: tagsAfter, decided: stamp(now), note };
}

/** The properties after a change, for showing a choice before GitHub has it. */
export function applyToData(data: Record<string, unknown>, c: Change): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data, status: c.status };
  if (c.tags) { if (c.tags.length) out.tags = c.tags; else delete out.tags; }
  if (c.decided === '') delete out.decided;
  else if (c.decided) out.decided = c.decided;
  if (c.note) out.decision_note = c.note;
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
  let out = Frontmatter.setScalar(text, 'status', c.status);
  if (c.tags) out = setLines(out, 'tags', c.tags.length ? ['tags:'].concat(c.tags.map((t) => '  - ' + Frontmatter.emitScalar(t))) : null);
  if (c.decided === '') out = setLines(out, 'decided', null);
  else if (c.decided) out = Frontmatter.setScalar(out, 'decided', c.decided);
  if (c.note) out = Frontmatter.setScalar(out, 'decision_note', c.note);
  return out;
}

/** The commit message for a decision. It has no Agent trailer: the choice is Kyle's. */
export function commitMessage(data: Record<string, unknown>, decision: Decision): string {
  const what = decision === 'drop' ? 'drop' : decision === 'inbox' ? 'back to inbox' : decision;
  const name = [data.id, data.title].filter(Boolean).join(' ');
  return 'ideas: ' + what + ' ' + (name || 'an idea') + '\n\nChosen on the Ideas board in the Story Forge app.';
}
