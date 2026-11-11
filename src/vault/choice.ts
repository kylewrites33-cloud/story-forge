// A choice on a board (keep, later, drop, Rewrite, an edit to a card, a card dragged on the Chapter Grid) and what it
// changes on a note. Choices wait in the outbox as the `choice` edit of an action (ops.ts) and go up through push.ts.
import { changeFor, editChange, moveChange, type Change, type Decision, type Move } from '../lib/ideas.ts';

export interface Choice {
  path: string;
  decision: Decision;
  reason: string;
  /** When Kyle chose, as an ISO time; it becomes the idea's decided time. */
  at: string;
  /** The last plain-sentence failure, if saving it failed for a reason other than being offline. */
  error?: string;
  /** For a scene card dragged on the Chapter Grid: where it went. */
  move?: Move;
  /** For a card Kyle edited: the properties he changed. */
  fields?: Record<string, string>;
}

/** What a waiting choice does to a note with these properties. */
export function changeOf(data: Record<string, unknown>, c: Choice): Change {
  if (c.decision === 'move' && c.move) return moveChange(c.move);
  if (c.decision === 'edit') return editChange(c.fields || {});
  return changeFor(data, c.decision, new Date(c.at), c.reason);
}

/** Moves, edits and decisions (accept, keep) each have their own slot on a note; a newer choice replaces an older one in its slot. */
function slot(c: Choice): string {
  return c.decision === 'move' || c.decision === 'edit' ? c.decision : 'decide';
}

export function sameSlot(a: Choice, b: Choice): boolean {
  return a.path === b.path && slot(a) === slot(b);
}
