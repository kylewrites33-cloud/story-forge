// New notes Kyle can add from the app, by name. An action in the outbox cannot hold code (it is kept as text on the
// device), so a create names its maker and carries what Kyle typed; the maker turns that into a note, given the files
// the vault has. It runs twice: when Kyle adds the note, so it shows at once with the ID it will most likely get, and
// again at the save, on the files the vault has at that moment, so two devices can never give one ID to two notes.
import { planTask, type NewTask } from '../lib/tasks.ts';
import { planTodo, type NewTodo } from '../lib/todos.ts';
import type { FileEntry, Made } from '../lib/types.ts';

/** What Kyle typed for each kind of new note, with the time he added it. */
export interface Payloads {
  /** A to-do in the vault's Tasks folder (the To-do list). */
  task: { t: NewTask; at: string };
  /** A to-do in a book's Tasks folder (beside the page). */
  todo: { book: string; t: NewTodo; at: string };
}
export type MakerName = keyof Payloads;

type Maker<K extends MakerName> = (files: FileEntry[], payload: Payloads[K], keep: string) => Made;

const MAKERS: { [K in MakerName]: Maker<K> } = {
  task: (files, p, keep) => planTask(files, p.t, new Date(p.at), keep),
  todo: (files, p, keep) => planTodo(files, p.book, p.t, new Date(p.at), keep)
};

export function isMaker(name: unknown): name is MakerName {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(MAKERS, name);
}

/** The note a create stands for, given the vault's files. `keep` is the ID it was shown with; it stays unless taken.
 * Throws a plain sentence when what Kyle typed cannot make a note (no title). */
export function make<K extends MakerName>(name: K, files: FileEntry[], payload: Payloads[K], keep = ''): Made {
  return (MAKERS[name] as Maker<K>)(files, payload, keep);
}
