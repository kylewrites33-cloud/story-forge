// The Plot Grid: the book's threads (or its cast) down the side, its scenes across the top in reading order. A square
// is filled where the scene's `threads` list names the thread (for the cast: point of view or in the scene's cast).
// A gap is a run of scenes without the thread between two scenes with it; it is flagged when it runs longer than four
// scenes or 15% of the book's scenes. Pressing a square adds or removes the thread from the scene's `threads`, a change
// to that one property line only. A square the team filled in (`threads` listed in `card_draft`) is the team's guess:
// pressing it first confirms it, which takes "threads" off `card_draft`.
import { castFor } from './boards.ts';
import { nameHue } from './codex.ts';
import { linkName, nameList } from './links.ts';
import { boardHref, bookNotesOf, sceneId, seriesNotesOf, storyScenes, stringList } from './seeing.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';
import type { Warning, WarningCheck } from './warnings.ts';

export interface GridRow {
  name: string;
  /** The names that count as this row in a scene's list: the name and its aliases. */
  terms: string[];
  /** The note to open: the series thread or character, or the book's own. */
  note: NoteRecord;
  color: string;
  /** One per scene, in reading order: the scene has it. */
  seen: boolean[];
  /** One per scene: the mark is the team's guess (its card lists the field in card_draft). */
  draft: boolean[];
  gaps: Gap[];
}

export interface Gap { from: number; to: number; length: number; flagged: boolean }

/** A gap is too long when it runs longer than four scenes or 15% of the book's scenes. */
export function tooLong(length: number, sceneCount: number): boolean {
  return length > 4 || length > sceneCount * 0.15;
}

/** Runs of scenes without the row between its first and last scene, with too-long ones flagged. */
export function gapsOf(seen: boolean[]): Gap[] {
  const out: Gap[] = [];
  const first = seen.indexOf(true), last = seen.lastIndexOf(true);
  if (first < 0) return out;
  let start = -1;
  for (let i = first; i <= last; i++) {
    if (!seen[i] && start < 0) start = i;
    if (seen[i] && start >= 0) { out.push({ from: start, to: i - 1, length: i - start, flagged: tooLong(i - start, seen.length) }); start = -1; }
  }
  return out;
}

const lower = (s: string) => s.trim().toLowerCase();

/** The book's threads: the series' thread notes with this book's deltas over them, then threads only this book has. */
export function bookThreads(index: VaultIndex, book: BookEntry): { name: string; note: NoteRecord; terms: string[]; color: string }[] {
  const series = seriesNotesOf(index, book, 'thread');
  const own = bookNotesOf(index, book, 'thread');
  const nameOf = (n: NoteRecord) => String(n.data.name || '').trim();
  const out = series.filter((n) => nameOf(n)).map((n) => ({ name: nameOf(n), note: n, data: n.data }));
  own.forEach((d) => {
    const target = linkName(d.data.extends) || nameOf(d);
    if (!target) return;
    const m = out.find((t) => t.name === target);
    if (m) m.data = { ...m.data, ...d.data };
    else out.push({ name: target, note: d, data: d.data });
  });
  return out.map((t) => ({
    name: t.name, note: t.note,
    terms: [t.name].concat(nameList(t.data.aliases)).filter((x, i, a) => x && a.indexOf(x) === i),
    color: typeof t.data.color === 'string' && t.data.color.trim() ? t.data.color.trim() : 'hsl(' + nameHue(t.name) + ' 55% 45%)'
  }));
}

/** True when the scene's card says the team filled this field in and Kyle has not confirmed it. */
export function isDraft(data: Record<string, unknown>, field: string): boolean {
  return stringList(data.card_draft).indexOf(field) >= 0;
}

function hasThread(data: Record<string, unknown>, terms: string[]): boolean {
  const want = terms.map(lower);
  return nameList(data.threads).some((n) => want.indexOf(lower(n)) >= 0);
}

export type GridMode = 'threads' | 'cast';

export function plotGrid(index: VaultIndex, book: BookEntry, mode: GridMode): { scenes: NoteRecord[]; rows: GridRow[] } {
  const scenes = storyScenes(index, book);
  const make = (name: string, note: NoteRecord, terms: string[], color: string, test: (s: NoteRecord) => boolean, draftOf: (s: NoteRecord) => boolean): GridRow => {
    const seen = scenes.map(test);
    return { name, note, terms, color, seen, draft: scenes.map((s, i) => seen[i] && draftOf(s)), gaps: gapsOf(seen) };
  };
  if (mode === 'threads') {
    const rows = bookThreads(index, book).map((t) => make(t.name, t.note, t.terms, t.color, (s) => hasThread(s.data, t.terms), (s) => isDraft(s.data, 'threads')));
    return { scenes, rows };
  }
  const rows = castFor(index, book).filter((c) => c.name).map((c) => {
    const terms = [c.name].concat(nameList(c.note.data.aliases));
    const color = typeof c.note.data.color === 'string' && c.note.data.color.trim() ? c.note.data.color.trim() : 'hsl(' + nameHue(c.name) + ' 60% 45%)';
    return make(c.name, c.series || c.note, terms, color,
      (s) => linkName(s.data.pov) === c.name || nameList(s.data.cast).indexOf(c.name) >= 0,
      (s) => (linkName(s.data.pov) === c.name && isDraft(s.data, 'pov')) || (nameList(s.data.cast).indexOf(c.name) >= 0 && isDraft(s.data, 'cast')));
  }).filter((r) => r.seen.some(Boolean));
  return { scenes, rows };
}

/** The list as written in the note, each item as one line of text: a nested list from an unquoted [[link]] becomes "[[link]]" again. */
function rawItems(v: unknown): string[] {
  if (v == null || v === '') return [];
  const list = Array.isArray(v) ? v : [v];
  return list.map((x) => (Array.isArray(x) ? '[[' + linkName(x) + ']]' : String(x ?? '').trim())).filter((x) => x && x !== '[[]]');
}

export interface Toggle {
  action: 'add' | 'remove' | 'confirm';
  /** The card edit to save: list properties as one line with commas ('' removes the line). */
  fields: Record<string, string>;
}

/** What pressing a thread's square on a scene does. A guessed mark is confirmed first; otherwise the thread goes in or out. */
export function threadToggle(data: Record<string, unknown>, thread: { name: string; terms: string[] }): Toggle {
  const items = rawItems(data.threads);
  const want = thread.terms.map(lower);
  const at = items.findIndex((x) => want.indexOf(lower(linkName(x))) >= 0);
  const draft = stringList(data.card_draft);
  const guessed = draft.indexOf('threads') >= 0;
  const restDraft = draft.filter((f) => f !== 'threads').join(', ');
  if (at >= 0 && guessed) return { action: 'confirm', fields: { card_draft: restDraft } };
  const fields: Record<string, string> = {};
  if (at >= 0) fields.threads = items.filter((_, i) => i !== at).join(', ');
  else fields.threads = items.concat('[[' + thread.name + ']]').join(', ');
  if (guessed) fields.card_draft = restDraft;
  return { action: at >= 0 ? 'remove' : 'add', fields };
}

/** Plain words for a gap: "S-004 to S-008" or "S-004". */
export function gapScenes(scenes: NoteRecord[], g: Gap): string {
  const a = sceneId(scenes[g.from]) || 'scene ' + (g.from + 1), b = sceneId(scenes[g.to]) || 'scene ' + (g.to + 1);
  return g.from === g.to ? a : a + ' to ' + b;
}

export const plotGapWarnings: WarningCheck = (index, bookFolder) => {
  const book = index.books.find((b) => b.folder === bookFolder);
  if (!book) return [];
  const { scenes, rows } = plotGrid(index, book, 'threads');
  const out: Warning[] = [];
  rows.forEach((r) => r.gaps.filter((g) => g.flagged).forEach((g) => {
    out.push({ text: 'The thread ' + r.name + ' disappears for ' + g.length + (g.length === 1 ? ' scene' : ' scenes') + ' (' + gapScenes(scenes, g) + ').', href: boardHref('plot-grid', book.folder), check: 'plot-grid' });
  }));
  return out;
};
