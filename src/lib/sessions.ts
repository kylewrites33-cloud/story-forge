// Sessions: the record of each substantial thread (the book's `Sessions/` folder). The Sessions screen lists them newest
// first and reads one speaker by speaker, the way Writers Room showed a brainstorm: each `## Round` heading is a part,
// each `> [!voice] Name` callout (or `**Name:** words` line) is one turn, then Kyle's decisions and the reflection. Each
// agent keeps one colour (a CSS variable) wherever it speaks. The ideas a session filed come from its `ideas` list and
// from ideas whose `session` links back to it.
import { basename, idNumber, linkName } from './links.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

const str = (v: unknown) => (v == null ? '' : String(v).trim());

/** A book's session notes, newest first (by date, then file name). */
export function bookSessions(index: VaultIndex, book: BookEntry): NoteRecord[] {
  const pre = book.folder + '/Sessions/';
  return Object.values(index.notes).filter((n) => n.type === 'session' && n.path.startsWith(pre))
    .sort((a, b) => str(b.data.date).localeCompare(str(a.data.date)) || b.path.localeCompare(a.path));
}

/** One turn: a speaker's words, or narration when `speaker` is ''. Text is Markdown. */
export interface Turn { speaker: string; text: string }

export type PartKind = 'talk' | 'decisions' | 'reflection' | 'other';

export interface SessionPart {
  /** The `##` heading, or '' for anything before the first one. */
  heading: string;
  kind: PartKind;
  turns: Turn[];
}

const VOICE = /^>\s*\[!voice\][-+]?\s*(.*)$/i;
const BOLD_NAME = /^(?:[-*]\s+)?\*\*([A-Z][\w'&. -]{0,38}?)(?::\*\*|\*\*:)\s*(.*)$/;

function partKind(heading: string, turns: Turn[]): PartKind {
  if (/decision|still kyle/i.test(heading)) return 'decisions';
  if (/reflection/i.test(heading)) return 'reflection';
  return turns.some((t) => t.speaker) ? 'talk' : 'other';
}

/** A session's body as parts and turns. Lines that belong to no speaker stay as narration, so nothing is lost. */
export function parseSession(body: string): SessionPart[] {
  const parts: SessionPart[] = [];
  let heading = '';
  let turns: Turn[] = [];
  let cur: Turn | null = null;
  let quote = false;
  const close = () => {
    if (cur) { cur.text = cur.text.replace(/\s+$/, ''); if (cur.text || cur.speaker) turns.push(cur); }
    cur = null;
    quote = false;
  };
  const endPart = () => {
    close();
    if (heading || turns.length) parts.push({ heading, kind: partKind(heading, turns), turns });
    turns = [];
  };
  String(body || '').split(/\r?\n/).forEach((line) => {
    const h = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (h && !/^###/.test(line)) { endPart(); heading = h[1]; return; }
    const v = VOICE.exec(line);
    if (v) {
      close();
      const [name, ...rest] = v[1].split(/:\s+/);
      cur = { speaker: name.trim() || 'Someone', text: rest.join(': ') };
      quote = true;
      return;
    }
    if (quote) {
      if (/^>/.test(line)) { cur!.text += (cur!.text ? '\n' : '') + line.replace(/^>\s?/, ''); return; }
      close();
    }
    const b = BOLD_NAME.exec(line);
    if (b) {
      close();
      cur = { speaker: b[1].trim(), text: b[2] };
      return;
    }
    if (cur && cur.speaker && !line.trim()) { close(); return; }
    if (!cur) { if (!line.trim()) return; cur = { speaker: '', text: '' }; }
    cur.text += (cur.text ? '\n' : '') + line;
  });
  endPart();
  return parts;
}

/** Everyone who speaks in a session, in the order they first speak. */
export function speakers(parts: SessionPart[]): string[] {
  const out: string[] = [];
  parts.forEach((p) => p.turns.forEach((t) => { if (t.speaker && out.indexOf(t.speaker) < 0) out.push(t.speaker); }));
  return out;
}

/** The roster in CLAUDE.md order, so each agent keeps the same colour in every session. */
const ROSTER = ['Story Specialist', 'Plot Specialist', 'Character Specialist', 'Genre Specialist', 'Writer', 'Developmental Editor',
  'Line Editor', 'Beta Reader', 'Continuity Keeper', 'Market Analyst', 'Contrarian', 'Coordinator'];
export const VOICE_COLOURS = 12;

/** The CSS colour for a speaker: Kyle in the accent colour, each agent in one of the --voice-N colours (styles.css). */
export function voiceColour(name: string): string {
  const n = name.trim().toLowerCase();
  if (n === 'kyle' || n === 'showrunner' || n === 'kyle (showrunner)') return 'var(--accent)';
  let i = ROSTER.findIndex((r) => r.toLowerCase() === n);
  if (i < 0) { let h = 0; for (let k = 0; k < n.length; k++) h = (h * 31 + n.charCodeAt(k)) >>> 0; i = h; }
  return 'var(--voice-' + ((i % VOICE_COLOURS) + 1) + ')';
}

/** The ideas a session filed: the IDs in its `ideas` list ("I-081", "Book 2 I-041", "[[I-081 Title]]"), found in this
 * book or the named book of the same series, and the book's ideas whose `session` links to it. In ID order. */
export function sessionIdeas(index: VaultIndex, book: BookEntry, session: NoteRecord): NoteRecord[] {
  const out: NoteRecord[] = [];
  const add = (n: NoteRecord | undefined) => { if (n && out.indexOf(n) < 0) out.push(n); };
  const ideasOf = (b: BookEntry) => (b.ideas || []).map((p) => index.notes[p]).filter(Boolean);
  const list = Array.isArray(session.data.ideas) ? session.data.ideas : session.data.ideas == null ? [] : [session.data.ideas];
  list.forEach((v) => {
    const s = linkName(v) || str(v);
    const m = /(?:Book\s+(\d+)\s+)?(I-\d{3,})/i.exec(s);
    if (!m) return;
    const other = m[1] ? index.books.find((b) => b.seriesFolder === book.seriesFolder && b.number === parseInt(m[1], 10)) : book;
    if (other) add(ideasOf(other).find((n) => str(n.data.id).toUpperCase() === m[2].toUpperCase()));
  });
  const names = [basename(session.path), str(session.data.title)].filter(Boolean);
  ideasOf(book).forEach((n) => { if (names.indexOf(linkName(n.data.session)) >= 0) add(n); });
  return out.sort((a, b) => (a.path.startsWith(book.folder + '/') ? 0 : 1) - (b.path.startsWith(book.folder + '/') ? 0 : 1) || (idNumber(a.data.id) || 0) - (idNumber(b.data.id) || 0));
}

/** "17 Oct, 10:13" for a session's date ("2026-10-17T10:13"), or the date as written. */
export function sessionWhen(v: unknown): string {
  const s = str(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
  if (!m) return s;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return parseInt(m[3], 10) + ' ' + months[parseInt(m[2], 10) - 1] + ' ' + m[1] + (m[4] ? ', ' + m[4] + ':' + m[5] : '');
}
