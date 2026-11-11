// The one saving system (2026-11-11, step 1 of the code structure redesign): what a save is made of.
// Everything Kyle does that changes the vault is an Action: a list of small changes that go up together as one save,
// or not at all. Actions wait in the outbox (outbox.ts), show on every screen at once (apply.ts) and go up when the
// connection allows (push.ts).
import type { ChangeStatus } from '../lib/changes.ts';
import type { Choice } from '../lib/write-queue.ts';
import type { DeviceFile, FileEntry } from '../lib/types.ts';
import { make, type MakerName, type Payloads } from './makers.ts';
import type { TextChange } from './text.ts';

/** A change to a note that is already in the vault, kept as what Kyle meant and not as new text, so it can be made
 * again on a newer version of the note if the team or another device changed it meanwhile. */
export type Edit =
  /** A choice on a board: keep, later, drop, a card moved on the Chapter Grid, or properties Kyle edited. */
  | { type: 'choice'; choice: Choice }
  /** Kyle's answers to the team's changes in a chapter's changes note (the Edit room): each change's ID with keep, no
   * and the rest. Only those changes' `Kyle:` lines change. */
  | { type: 'marks'; marks: Record<string, ChangeStatus> }
  /** A small change to one note's text (text.ts): a tick on the Chapter titles page, a chapter marked through in the
   * Rewrite tab, a recipe's words. */
  | { type: 'text'; change: TextChange };

/** A change to a book's chapter numbers. */
export type ChapterChange =
  /** Room for a new chapter after chapter `after`: every later chapter moves up one. */
  | { type: 'room'; after: number }
  /** Chapter `from` becomes chapter `to`; the chapters in between close up by one. */
  | { type: 'move'; from: number; to: number }
  /** Chapter `gone` has left the book; the chapters after it close up by one. */
  | { type: 'close'; gone: number };

/** One change to the vault: to one file, or (chapters) to every note that carries a chapter number. */
export type Op =
  | { kind: 'edit'; path: string; edit: Edit }
  /** A book's chapters renumbered (src/vault/chapters.ts). `path` is the book note's. This op never waits in the
   * outbox: everything else that waits is addressed by file names that carry chapter numbers, so it is sent at once,
   * after what waits, or not at all (until chapters have IDs of their own, step 5 of the redesign). */
  | { kind: 'chapters'; path: string; book: string; change: ChapterChange; why: string }
  /** Scenes deleted from a book (planDelete in src/vault/chapters.ts): each goes to the book's Archive, and a chapter
   * left with no scene goes with its notes and the chapters after it close up. `path` is the book note's, `scenes` the
   * scenes' paths, `at` when Kyle did it. Like `chapters` it never waits in the outbox: it can change chapter numbers. */
  | { kind: 'delete'; path: string; book: string; scenes: string[]; at: string }
  /** A note's new title, with its file renamed to match (a scene's "S-012 Title.md", a recipe's "Title.md"). `path` is
   * the note as it is named now. It shows at once under the old file name; the save moves the file, and what waits for
   * the note, the words kept on the device and the open page follow it to the new name. */
  | { kind: 'retitle'; path: string; title: string; what: 'scene' | 'recipe' }
  /** A file from the device, saved as it is: a cover picture, a Rocket export, a manuscript, a Word backup. `text` for
   * a text file, `base64` for any other. When a file of that name is already there: `next` takes the next free name
   * ("name (2).csv"), `replace` puts this one in its place, `refuse` stops the save with a plain sentence. Like
   * `chapters` it never waits in the outbox: a picture is too big for the small store the outbox lives in. */
  | ({ kind: 'file' } & DeviceFile)
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

/** A change to a book's chapter numbers, with new notes that go in with it (the scene of a new chapter), as one action. */
export function chaptersAction(book: string, change: ChapterChange, why: string, also: Op[] = [], now: Date = new Date()): Action {
  return { id: newId(now), at: now.toISOString(), ops: [{ kind: 'chapters' as const, path: book + '/Book.md', book, change, why } as Op].concat(also) };
}

/** Scenes deleted from a book, as one action. */
export function deleteAction(book: string, scenes: string[], now: Date = new Date()): Action {
  return { id: newId(now), at: now.toISOString(), ops: [{ kind: 'delete', path: book + '/Book.md', book, scenes, at: now.toISOString() }] };
}

/** Files from the device, with new notes that go in with them (the ask to the team that goes with a manuscript), as
 * one action: one save. */
export function filesAction(files: DeviceFile[], also: Op[] = [], now: Date = new Date()): Action {
  return { id: newId(now), at: now.toISOString(), ops: files.map((f): Op => ({ kind: 'file', ...f })).concat(also) };
}

/** Small changes to notes' text (text.ts), saved together as one action. */
export function textAction(changes: { path: string; change: TextChange }[], also: Op[] = [], now: Date = new Date()): Action {
  return { id: newId(now), at: now.toISOString(), ops: changes.map((c): Op => ({ kind: 'edit', path: c.path, edit: { type: 'text', change: c.change } })).concat(also) };
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

/** A new note as one action, or several of one kind added together (workflow results) as one action: one save. Each
 * takes its ID after the ones before it. Throws a plain sentence when what Kyle typed cannot make a note. */
export function createAction<K extends MakerName>(name: K, payload: Payloads[K] | Payloads[K][], files: FileEntry[], now: Date = new Date()): Action {
  const known = files.slice();
  const ops = (Array.isArray(payload) ? payload : [payload]).map((p): Op => {
    const made = make(name, known, p);
    known.push({ path: made.path, sha: '' });
    return { kind: 'create', make: name, payload: p, id: made.id, path: made.path, text: made.text };
  });
  return { id: newId(now), at: now.toISOString(), ops };
}

