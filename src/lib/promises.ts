// The Promises board: each promise note of a book (its Promises folder) as a lane across the book's scenes in reading
// order, marked where the promise is planted, reinforced and paid off. Open promises stay in view; paid, subverted and
// dropped ones fold away. Warnings: an open promise the book never pays, though its last fifth of scenes has gone by,
// and a promise that names a scene the book does not have.
import { idNumber } from './links.ts';
import { boardHref, bookNotesOf, sceneId, storyScenes, stringList } from './seeing.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';
import type { Warning, WarningCheck } from './warnings.ts';

export type PromiseMark = 'planted' | 'reinforced' | 'paid';
export const MARKS: PromiseMark[] = ['planted', 'reinforced', 'paid'];

/** Statuses that settle a promise; the rest (open, or none) keep it in view. */
export const SETTLED = ['paid', 'subverted', 'dropped'];

export interface PromiseLane {
  note: NoteRecord;
  id: string;
  title: string;
  status: string;
  kind: string;
  importance: number | null;
  open: boolean;
  /** One entry per scene of the book, in reading order: the marks the promise puts on it. */
  marks: PromiseMark[][];
  /** Scene names the promise gives that the book has no scene for, with the field each sits in. */
  missing: { field: PromiseMark; ref: string }[];
  /** True when an open promise has no payoff in the book. */
  unpaid: boolean;
}

/** The scene ID a promise field names: "S-012", "[[S-012 The Crack]]" and "S-012 The Crack" all give "S-012". */
export function sceneRef(v: string): string {
  const m = v.match(/S-\d+/);
  return m ? m[0] : v.replace(/^\[\[|\]\]$/g, '').trim();
}

export function bookPromises(index: VaultIndex, book: BookEntry): NoteRecord[] {
  return bookNotesOf(index, book, 'promise').sort((a, b) => (idNumber(a.data.id) || 0) - (idNumber(b.data.id) || 0) || a.path.localeCompare(b.path));
}

/** A promise's lane over these scenes. `known` is every scene ID the book has (test drives too): a field naming one of
 * those that is not on the board is not missing. */
export function promiseLane(note: NoteRecord, scenes: NoteRecord[], known: string[] = scenes.map(sceneId)): PromiseLane {
  const ids = scenes.map(sceneId);
  const marks: PromiseMark[][] = scenes.map(() => []);
  const missing: { field: PromiseMark; ref: string }[] = [];
  MARKS.forEach((field) => {
    stringList(note.data[field]).forEach((raw) => {
      const ref = sceneRef(raw);
      const at = ids.indexOf(ref);
      if (at < 0) { if (known.indexOf(ref) < 0) missing.push({ field, ref }); }
      else if (marks[at].indexOf(field) < 0) marks[at].push(field);
    });
  });
  const status = String(note.data.status || 'open').trim();
  const open = SETTLED.indexOf(status) < 0;
  const imp = typeof note.data.importance === 'number' ? note.data.importance : null;
  return {
    note, id: String(note.data.id || ''), title: String(note.data.title || ''), status, kind: String(note.data.kind || ''),
    importance: imp, open, marks, missing, unpaid: open && !marks.some((m) => m.indexOf('paid') >= 0)
  };
}

/** Every promise of the book as a lane, open ones first, the most important first, then by ID. */
export function promiseLanes(index: VaultIndex, book: BookEntry): { scenes: NoteRecord[]; lanes: PromiseLane[] } {
  const scenes = storyScenes(index, book);
  const known = book.scenes.map((p) => index.notes[p]).filter(Boolean).map(sceneId);
  const lanes = bookPromises(index, book).map((n) => promiseLane(n, scenes, known));
  lanes.sort((a, b) => Number(b.open) - Number(a.open) || (b.importance ?? 0) - (a.importance ?? 0));
  return { scenes, lanes };
}

/** Where the last fifth of the book starts: the index of its first scene. */
export function lastFifthStart(count: number): number {
  return Math.min(Math.max(0, count - 1), Math.floor(count * 0.8));
}

const name = (l: PromiseLane) => [l.id, l.title].filter(Boolean).join(' ');

export function laneWarnings(lanes: PromiseLane[], scenes: NoteRecord[]): string[] {
  const out: string[] = [];
  const from = scenes.length ? scenes[lastFifthStart(scenes.length)] : null;
  lanes.forEach((l) => {
    if (l.unpaid && scenes.length) out.push(name(l) + ' is still open and no scene pays it off, not even in the last fifth of the book' + (from ? ' (from ' + sceneId(from) + ')' : '') + '.');
    if (l.missing.length) {
      const refs = l.missing.map((m) => m.ref + ' (' + m.field + ')');
      out.push(name(l) + ' names ' + (refs.length === 1 ? 'a scene' : 'scenes') + ' this book does not have: ' + refs.join(', ') + '.');
    }
  });
  return out;
}

export const promiseWarnings: WarningCheck = (index, bookFolder) => {
  const book = index.books.find((b) => b.folder === bookFolder);
  if (!book) return [];
  const { scenes, lanes } = promiseLanes(index, book);
  return laneWarnings(lanes, scenes).map((text): Warning => ({ text, href: boardHref('promises', book.folder), check: 'promises' }));
};
