// Character Arcs, from Writers Room's Story Dashboard: each character's journey from their Lie (0) to the Truth (10),
// scene by scene. The points live on the character note as `arc_points` ("S-012: 4"); `arc_draft: true` marks points the
// team guessed and Kyle has not changed. A book delta's points win over the series note's, since scene IDs belong to a book.
import { castFor } from './boards.ts';
import { storyScenes } from './tension.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';
import type { Warning, WarningCheck } from './warnings.ts';

export type ArcType = 'positive' | 'flat' | 'negative' | '';

export interface ArcPoint { id: string; value: number }

/** "S-012: 4" lines (or a comma list of them) as points in the order given; anything else is skipped. */
export function parseArcPoints(v: unknown): ArcPoint[] {
  const list = Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',') : [];
  const out: ArcPoint[] = [];
  list.forEach((line) => {
    const m = String(line).match(/\b(S-\d{3})\s*:\s*(-?\d+(?:\.\d+)?)/i);
    if (!m) return;
    const id = m[1].toUpperCase();
    const value = Math.min(10, Math.max(0, Math.round(parseFloat(m[2]))));
    const at = out.findIndex((p) => p.id === id);
    if (at >= 0) out[at] = { id, value }; else out.push({ id, value });
  });
  return out;
}

/** Points in the book's reading order (points for scenes the book does not have keep their place at the end). */
export function sortPoints(points: ArcPoint[], sceneIds: string[]): ArcPoint[] {
  const at = (id: string) => { const i = sceneIds.indexOf(id); return i < 0 ? Infinity : i; };
  return points.slice().sort((a, b) => at(a.id) - at(b.id));
}

/** Set one scene's value (adding the point if it is new), in reading order. */
export function setPoint(points: ArcPoint[], id: string, value: number, sceneIds: string[]): ArcPoint[] {
  const v = Math.min(10, Math.max(0, Math.round(value)));
  return sortPoints(points.filter((p) => p.id !== id).concat({ id, value: v }), sceneIds);
}

export function removePoint(points: ArcPoint[], id: string): ArcPoint[] {
  return points.filter((p) => p.id !== id);
}

/** The edit's text for arc_points: the list as one line with commas, the way card edits write lists. */
export function pointsLine(points: ArcPoint[]): string {
  return points.map((p) => p.id + ': ' + p.value).join(', ');
}

export interface Arc {
  name: string;
  type: ArcType;
  lie: string;
  truth: string;
  points: ArcPoint[];
  draft: boolean;
  color: string;
  /** The note that holds the points (and takes the change): the book delta if it has them, else the series note. */
  holder: NoteRecord;
  /** The note whose arc_draft is true, if any, so a change by Kyle clears it. */
  draftNote: NoteRecord | null;
  /** The note to open. */
  note: NoteRecord;
}

const str = (v: unknown) => (v == null ? '' : String(v).trim());

/** Every character of the book with an arc type or arc points. */
export function bookArcs(index: VaultIndex, book: BookEntry): Arc[] {
  const ids = storyScenes(index, book).map((s) => String(s.data.id || ''));
  return castFor(index, book).map((c) => {
    const d = c.note.data;
    const own = c.delta && c.delta.data.arc_points != null ? c.delta : c.series && c.series.data.arc_points != null ? c.series : null;
    const type = str(d.arc_type) as ArcType;
    if (!own && !type) return null;
    const holder = own || c.delta || c.series || c.note;
    const draftNote = [c.delta, c.series].find((n) => n && n.data.arc_draft === true) || null;
    const color = str(d.color);
    return {
      name: c.name, type: (['positive', 'flat', 'negative'].indexOf(type) >= 0 ? type : '') as ArcType,
      lie: str(d.lie), truth: str(d.truth),
      points: sortPoints(parseArcPoints(own ? own.data.arc_points : null), ids),
      draft: Boolean(draftNote), color: color || '', holder, draftNote, note: c.series || c.note
    };
  }).filter((a): a is Arc => Boolean(a));
}

/** The fields to write when Kyle changes an arc: the points, and arc_draft removed from the note that holds the points. */
export function arcEdit(arc: Arc, points: ArcPoint[]): { path: string; fields: Record<string, string> }[] {
  const out: { path: string; fields: Record<string, string> }[] = [{ path: arc.holder.path, fields: { arc_points: pointsLine(points) } }];
  if (arc.draftNote) {
    if (arc.draftNote.path === arc.holder.path) out[0].fields.arc_draft = '';
    else out.push({ path: arc.draftNote.path, fields: { arc_draft: '' } });
  }
  return out;
}

/** How far a flat arc may move before it is no longer flat. */
export const FLAT_RANGE = 3;

/** Does the arc run the way its type says? A positive arc should end higher than it began, a negative (fall) arc lower,
 * and a flat arc should stay within a few points. */
export function arcIssue(arc: Arc): string {
  const pts = arc.points;
  if (pts.length < 2) return '';
  const first = pts[0].value, last = pts[pts.length - 1].value;
  if (arc.type === 'positive' && last < first) return arc.name + '\'s arc is positive but ends lower (' + last + ') than it began (' + first + ').';
  if (arc.type === 'negative' && last > first) return arc.name + '\'s arc is a fall but ends higher (' + last + ') than it began (' + first + ').';
  if (arc.type === 'flat') {
    const vals = pts.map((p) => p.value);
    const range = Math.max(...vals) - Math.min(...vals);
    if (range > FLAT_RANGE) return arc.name + '\'s arc is flat but moves ' + range + ' points (' + Math.min(...vals) + ' to ' + Math.max(...vals) + ').';
  }
  return '';
}

/** The Overview's warnings from Character Arcs. */
export const arcWarnings: WarningCheck = (index, bookFolder) => {
  const book = index.books.find((b) => b.folder === bookFolder);
  if (!book) return [];
  const to = '#/board/arcs/' + encodeURIComponent(book.folder);
  return bookArcs(index, book).map(arcIssue).filter(Boolean).map((text): Warning => ({ text, href: to, check: 'arcs' }));
};
