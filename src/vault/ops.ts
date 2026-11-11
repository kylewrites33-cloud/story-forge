// The one saving system (2026-11-11, step 1 of the code structure redesign): what a save is made of.
// Everything Kyle does that changes the vault is an Action: a list of small changes that go up together as one save,
// or not at all. Actions wait in the outbox (outbox.ts), show on every screen at once (apply.ts) and go up when the
// connection allows (push.ts).
import type { ChangeStatus } from '../lib/changes.ts';
import type { Choice } from '../lib/write-queue.ts';
import type { FileEntry } from '../lib/types.ts';
import { make, type MakerName, type Payloads } from './makers.ts';

/** A change to a note that is already in the vault, kept as what Kyle meant and not as new text, so it can be made
 * again on a newer version of the note if the team or another device changed it meanwhile. */
export type Edit =
  /** A choice on a board: keep, later, drop, a card moved on the Chapter Grid, or properties Kyle edited. */
  | { type: 'choice'; choice: Choice }
  /** Kyle's answers to the team's changes in a chapter's changes note (the Edit room): each change's ID with keep, no
   * and the rest. Only those changes' `Kyle:` lines change. */
  | { type: 'marks'; marks: Record<string, ChangeStatus> };

/** One change to one file. */
export type Op =
  | { kind: 'edit'; path: string; edit: Edit }
  /** A new note. `make` names its maker (makers.ts) and `payload` is what Kyle typed. `id`, `path` and `text` are the
   * note as it shows until it is saved; the save works it out again on the vault's files then, and the ID changes only
   * if another note took it meanwhile. */
  | { kind: 'create'; make: MakerName; payload: Payloads[MakerName]; id: string; path: string; text: string };

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

/** Answers on a chapter's changes, with the to-dos they tick off or open again, as one action: one save. */
export function marksAction(path: string, marks: Record<string, ChangeStatus>, also: Choice[] = [], now: Date = new Date()): Action {
  return {
    id: newId(now),
    at: now.toISOString(),
    ops: [{ kind: 'edit' as const, path, edit: { type: 'marks' as const, marks } } as Op]
      .concat(also.map((choice) => ({ kind: 'edit' as const, path: choice.path, edit: { type: 'choice' as const, choice } })))
  };
}

/** A new note as one action. Throws a plain sentence when what Kyle typed cannot make a note. */
export function createAction<K extends MakerName>(name: K, payload: Payloads[K], files: FileEntry[], now: Date = new Date()): Action {
  const made = make(name, files, payload);
  return { id: newId(now), at: now.toISOString(), ops: [{ kind: 'create', make: name, payload, id: made.id, path: made.path, text: made.text }] };
}

