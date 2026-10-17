// The Story Juice boards: which notes each one shows, in which groups, in which order.
// Groups and their order come from the schema (the board's groupBy property and that property's enum), so a new
// value in the schema shows up as a new group without an app change.
import { idNumber, linkName, toNumber } from './links.ts';
import { enumValues, propDef } from './schema.ts';
import type { BookEntry, NoteRecord, Schema, VaultIndex } from './types.ts';

/** The boards the app has screens for, beyond the Chapter Grid and the Ideas board. */
export const STORY_BOARDS = ['story-juice', 'beat-sheet', 'characters', 'conflict-matrix'] as const;
export type StoryBoard = (typeof STORY_BOARDS)[number];

/** Idea kinds that belong to the Story Juice chain, in the chain's order. Other kinds stay on the Ideas board only. */
export const STORY_JUICE_KINDS = ['premise', 'big-issue', 'opinion', 'character', 'theme'];

/** Beat frameworks, Kyle's own method first. */
const FRAMEWORK_ORDER = ['story-juice', 'save-the-cat', 'serial-chapter-model', 'three-act'];

export interface Group {
  key: string;
  notes: NoteRecord[];
}

const NONE = '';

/** Sort by order, then ID number, then path. */
export function byOrder(a: NoteRecord, b: NoteRecord): number {
  const num = (v: unknown) => toNumber(v) ?? Infinity;
  const ao = num(a.data.order), bo = num(b.data.order);
  if (ao !== bo) return ao - bo;
  return (idNumber(a.data.id) || 0) - (idNumber(b.data.id) || 0) || a.path.localeCompare(b.path);
}

/** Split notes by a property, groups in the given order, unknown values after, notes with no value last. */
export function groupNotes(notes: NoteRecord[], by: string, order: string[]): Group[] {
  const map = new Map<string, NoteRecord[]>();
  notes.forEach((n) => {
    const v = n.data[by];
    const key = v == null || v === '' ? NONE : linkName(v);
    map.set(key, (map.get(key) || []).concat(n));
  });
  const keys = [...map.keys()].sort((a, b) => {
    if (a === NONE || b === NONE) return a === NONE ? 1 : -1;
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia < 0 || ib < 0) return ia < 0 && ib < 0 ? a.localeCompare(b) : ia < 0 ? 1 : -1;
    return ia - ib;
  });
  return keys.map((key) => ({ key, notes: map.get(key)!.slice().sort(byOrder) }));
}

/** A group's heading: "big-issue" -> "Big issue"; no value -> the given fallback. */
const LABELS: Record<string, string> = {
  'big-issue': 'Big issue', opinion: 'Opinions', character: 'Characters', 'story-juice': 'Story Juice', 'save-the-cat': 'Save the Cat',
  'serial-chapter-model': 'Serial Chapter Model', 'three-act': 'Three acts', 'extra-personal': 'Extra-personal'
};

export function groupLabel(key: string, fallback = 'Not set'): string {
  if (!key) return fallback;
  if (LABELS[key]) return LABELS[key];
  const s = key.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function notesOf(index: VaultIndex, paths: string[] | undefined): NoteRecord[] {
  return (paths || []).map((p) => index.notes[p]).filter(Boolean);
}

/** The group order a board uses: its groupBy property's enum, with fixed orders where the chain needs them. */
export function groupOrder(schema: Schema, type: string, by: string): string[] {
  if (type === 'idea' && by === 'kind') return STORY_JUICE_KINDS;
  if (type === 'beat' && by === 'framework') return FRAMEWORK_ORDER;
  return enumValues(schema, propDef(schema, type, by));
}

/** The notes a board shows for a book. */
export function boardNotes(index: VaultIndex, book: BookEntry, board: StoryBoard): NoteRecord[] {
  if (board === 'story-juice') return notesOf(index, book.ideas).filter((n) => STORY_JUICE_KINDS.indexOf(String(n.data.kind || '')) >= 0);
  if (board === 'beat-sheet') return notesOf(index, book.beats);
  if (board === 'conflict-matrix') return notesOf(index, book.conflicts);
  return castFor(index, book).map((c) => c.note);
}

export interface CastMember {
  name: string;
  /** The series note, with the book delta's properties laid over it where the book has one. */
  note: NoteRecord;
  series: NoteRecord | null;
  delta: NoteRecord | null;
}

/** The series cast as this book has it: each series character, with this book's delta over it. A delta whose
 * series note is missing still shows, on its own. */
export function castFor(index: VaultIndex, book: BookEntry): CastMember[] {
  const series = index.series.find((s) => s.folder === book.seriesFolder);
  const base = notesOf(index, series && series.characters).filter((n) => n.type === 'character');
  const deltas = notesOf(index, book.characters).filter((n) => n.type === 'character');
  const nameOf = (n: NoteRecord) => String(n.data.name || '').trim();
  const out: CastMember[] = base.map((n) => ({ name: nameOf(n), note: n, series: n, delta: null }));
  deltas.forEach((d) => {
    const target = linkName(d.data.extends) || nameOf(d);
    const m = out.find((c) => c.name === target);
    if (!m) { out.push({ name: target, note: d, series: null, delta: d }); return; }
    m.delta = d;
    m.note = { ...m.series!, data: { ...m.series!.data, ...withoutEmpty(d.data), type: 'character', name: m.name, status: m.series!.data.status } };
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function withoutEmpty(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.keys(data).forEach((k) => {
    const v = data[k];
    if (k !== 'extends' && v != null && v !== '' && !(Array.isArray(v) && !v.length)) out[k] = v;
  });
  return out;
}

/** Story Juice ideas that name a character in their title, such as "Core Drive — Grey Merrifield". */
export function ideasAbout(index: VaultIndex, book: BookEntry, name: string): NoteRecord[] {
  if (!name) return [];
  const first = name.split(/\s+/)[0].toLowerCase();
  return notesOf(index, book.ideas).filter((n) => {
    if (n.data.kind !== 'character') return false;
    const t = String(n.data.title || '').toLowerCase();
    return t.indexOf(name.toLowerCase()) >= 0 || (first.length > 3 && new RegExp('\\b' + first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(t));
  });
}
