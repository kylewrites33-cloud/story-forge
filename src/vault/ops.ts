// The one saving system (2026-11-11, step 1 of the code structure redesign): what a save is made of.
// Everything Kyle does that changes the vault is an Action: a list of small changes that go up together as one save,
// or not at all. Actions wait in the outbox (outbox.ts), show on every screen at once (apply.ts) and go up when the
// connection allows (push.ts).
import type { Choice } from '../lib/write-queue.ts';

/** A change to a note that is already in the vault, kept as what Kyle meant and not as new text, so it can be made
 * again on a newer version of the note if the team or another device changed it meanwhile. */
export type Edit =
  /** A choice on a board: keep, later, drop, a card moved on the Chapter Grid, or properties Kyle edited. */
  | { type: 'choice'; choice: Choice };

/** One change to one file. */
export type Op =
  | { kind: 'edit'; path: string; edit: Edit };

export interface Action {
  /** Unique on this device. */
  id: string;
  /** When Kyle did it, as an ISO time. */
  at: string;
  ops: Op[];
  /** The last plain-sentence failure, if saving it failed for a reason other than being offline. */
  error?: string;
}

let n = 0;
/** An id no other waiting action on this device has. */
export function newId(now: Date = new Date()): string {
  n = (n + 1) % 1679616;
  return now.getTime().toString(36) + '-' + n.toString(36) + Math.floor(Math.random() * 1679616).toString(36);
}

/** Choices that belong together (a card moved and the card that takes over its chapter's name) as one action: one save. */
export function choiceAction(choices: Choice[], now: Date = new Date()): Action {
  return {
    id: newId(now),
    at: choices.length ? choices[0].at : now.toISOString(),
    ops: choices.map((choice) => ({ kind: 'edit' as const, path: choice.path, edit: { type: 'choice' as const, choice } }))
  };
}
