// The book's codex, as Novelcrafter calls it: the cast, places, items and lore, with the names (and nicknames) each one
// goes by. The writing screen underlines those names in the text; the Matrix and a character's Appears in list count
// them scene by scene.
import { castFor } from './boards.ts';
import { linkName, nameList } from './links.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

export interface CodexEntry {
  name: string;
  type: string;
  /** The note to open: the series note, or the book's own when the series has none. */
  note: NoteRecord;
  /** The words that name it in the text: the name, its aliases and a character's first name. */
  terms: string[];
  /** A CSS colour: the note's own `color`, or one made from the name. */
  color: string;
}

/** A hue for a name, the same every time. */
export function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/** A term is worth underlining when it is a real word: three letters or more, not only digits. */
function usable(t: string): boolean {
  return t.length >= 3 && !/^\d+$/.test(t);
}

/** Words that start names but are not first names ("The Warden", "King Slime"). */
const NOT_FIRST = ['The', 'A', 'An', 'Old', 'Young', 'Little', 'Big', 'Mr', 'Mrs', 'Ms', 'Dr', 'Sir', 'Lady', 'Lord', 'King', 'Queen', 'Prince', 'Princess',
  'Saint', 'St', 'Captain', 'General', 'Master', 'Mother', 'Father', 'Brother', 'Sister', 'Aunt', 'Uncle', 'Doctor', 'Professor', 'Demon', 'Witch'];

function termsOf(name: string, data: Record<string, unknown>, firstName: boolean): string[] {
  const out = [name].concat(nameList(data.aliases));
  if (firstName) {
    const first = name.split(/\s+/)[0].replace(/\.$/, '');
    if (first !== name && NOT_FIRST.indexOf(first) < 0) out.push(first);
  }
  return out.map((t) => t.trim()).filter(usable).filter((t, i, a) => a.indexOf(t) === i);
}

const NOTES = (index: VaultIndex, paths: string[] | undefined) => (paths || []).map((p) => index.notes[p]).filter(Boolean);

/** Every codex entry of a book: its series' characters (with the book's deltas), places, items and lore. */
export function codexFor(index: VaultIndex, book: BookEntry): CodexEntry[] {
  const out: CodexEntry[] = [];
  castFor(index, book).forEach((c) => {
    if (!c.name) return;
    const color = typeof c.note.data.color === 'string' && c.note.data.color.trim() ? c.note.data.color.trim() : '';
    out.push({ name: c.name, type: 'character', note: c.series || c.note, terms: termsOf(c.name, c.note.data, true), color: color || 'hsl(' + nameHue(c.name) + ' 60% 45%)' });
  });
  const series = index.series.find((s) => s.folder === book.seriesFolder);
  const base = NOTES(index, series && series.codex);
  const deltas = NOTES(index, book.codex);
  base.concat(deltas.filter((d) => !base.some((b) => String(b.data.name || '') === (linkName(d.data.extends) || String(d.data.name || ''))))).forEach((n) => {
    const name = String(n.data.name || '').trim();
    if (!name) return;
    out.push({ name, type: n.type, note: n, terms: termsOf(name, n.data, false), color: 'hsl(' + nameHue(name) + ' 45% 42%)' });
  });
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** One pattern for every term, longest first, matched as whole words with the case as written. */
export interface Matcher { re: RegExp | null; byTerm: Map<string, number>; entries: CodexEntry[] }

export function matcher(entries: CodexEntry[]): Matcher {
  const byTerm = new Map<string, number>();
  entries.forEach((e, i) => e.terms.forEach((t) => { if (!byTerm.has(t)) byTerm.set(t, i); }));
  const terms = [...byTerm.keys()].sort((a, b) => b.length - a.length);
  // Letters and digits on either side mean the term is part of a longer word.
  const re = terms.length ? new RegExp('(?<![\\p{L}\\p{N}])(?:' + terms.map(esc).join('|') + ')(?![\\p{L}\\p{N}])', 'gu') : null;
  return { re, byTerm, entries };
}

export interface Mention { from: number; to: number; entry: number }

/** Where codex names fall in a piece of text. */
export function mentions(text: string, m: Matcher): Mention[] {
  if (!m.re) return [];
  const out: Mention[] = [];
  m.re.lastIndex = 0;
  let r: RegExpExecArray | null;
  while ((r = m.re.exec(text))) {
    const i = m.byTerm.get(r[0]);
    if (i != null) out.push({ from: r.index, to: r.index + r[0].length, entry: i });
  }
  return out;
}

/** How often each entry is named in a text, most named first. */
export function namedIn(text: string, m: Matcher): { entry: CodexEntry; count: number }[] {
  const counts = new Map<number, number>();
  mentions(text, m).forEach((x) => counts.set(x.entry, (counts.get(x.entry) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || m.entries[a[0]].name.localeCompare(m.entries[b[0]].name))
    .map(([i, count]) => ({ entry: m.entries[i], count }));
}

/** How a scene involves an entry: point of view, in the cast or the place on its card, and how often the text names it. */
export interface Presence { pov: boolean; card: boolean; named: number }

export function presence(scene: NoteRecord, e: CodexEntry, m: Matcher): Presence {
  const d = scene.data;
  const pov = e.type === 'character' && linkName(d.pov) === e.name;
  const card = nameList(d.cast).indexOf(e.name) >= 0 || linkName(d.place) === e.name || nameList(d.lore).indexOf(e.name) >= 0;
  const idx = m.entries.indexOf(e);
  const named = idx < 0 ? 0 : mentions(scene.body, m).filter((x) => x.entry === idx).length;
  return { pov, card, named };
}

export function present(p: Presence): boolean {
  return p.pov || p.card || p.named > 0;
}

/** Every scene of the book an entry appears in, with the first line that names it. */
export function appearances(scenes: NoteRecord[], e: CodexEntry, m: Matcher): { scene: NoteRecord; presence: Presence; line: string }[] {
  const idx = m.entries.indexOf(e);
  return scenes.map((s) => {
    const p = presence(s, e, m);
    let line = '';
    if (p.named && idx >= 0) {
      const first = mentions(s.body, m).find((x) => x.entry === idx);
      if (first) line = lineAround(s.body, first.from, first.to);
    }
    return { scene: s, presence: p, line };
  }).filter((x) => present(x.presence));
}

/** The sentence (or up to 160 characters) around a place in the text, on one line. */
export function lineAround(text: string, from: number, to: number): string {
  let a = from, b = to;
  while (a > 0 && from - a < 120 && !/[.!?\n]/.test(text[a - 1])) a--;
  while (b < text.length && b - to < 120 && !/[.!?\n]/.test(text[b])) b++;
  if (b < text.length && /[.!?]/.test(text[b])) b++;
  return text.slice(a, b).replace(/\s+/g, ' ').trim();
}
