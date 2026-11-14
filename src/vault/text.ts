// Small changes to one note's text, kept as what Kyle meant so they can wait on the device and be made again on a
// newer version of the note: a tick on the Chapter titles page, a chapter marked through in the Rewrite tab, a
// recipe's words. Like every edit there are two forms that must agree (a test holds them to it): to the note as the
// screens hold it, and to the note's text as the vault has it, changing only the lines the change touches.
import { addReply } from '../lib/changes.ts';
import { withBody } from '../lib/drafts.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { merge3 } from '../lib/live.ts';
import { addToDay, addTypedToDay, addTypingToDay, type PomodoroRecord } from '../lib/pomodoro.ts';
import { editRecipeText } from '../lib/recipes.ts';
import { rewriteDone, withRewriteDone } from '../lib/rewrite.ts';
import { addOwn, NONE, setPick } from '../lib/titles.ts';
import { addWorkflowNote } from '../lib/workflow.ts';
import { takenRecord, withTaken } from '../team/asks.ts';
import type { NoteRecord } from '../lib/types.ts';
import { makeNote } from '../lib/vault-index.ts';

export type TextChange =
  /** The Chapter titles page: a title option ticked or unticked for a chapter (`title` can be "None of these"). */
  | { what: 'title-pick'; chapter: number; title: string; on: boolean }
  /** The Chapter titles page: a title Kyle wrote himself for a chapter. */
  | { what: 'title-own'; chapter: number; title: string }
  /** The Rewrite tab: Kyle is through with a chapter, or opened it again (the book note's `rewrite_done`). */
  | { what: 'through'; chapter: number; done: boolean }
  /** An ask to the team (a job note): these answers are used (a brace answer put into the page, options picked or put
   * away), so no device uses them again. Names add to the ones the note has. */
  | { what: 'taken'; names: string[] }
  /** A recipe's "use for" line and its instruction. */
  | { what: 'recipe'; use_for: string; body: string }
  /** One more dated line under "Kyle's notes" at the end of the workflow (`day` is the day he wrote it, his time). */
  | { what: 'workflow-note'; note: string; day: string }
  /** The Writing Log: a finished (or stopped) Pomodoro added to its day's note. `at` is when it was logged. */
  | { what: 'log-pomodoro'; record: PomodoroRecord; at: string }
  /** The Writing Log: more words typed on a day. */
  | { what: 'log-typed'; date: string; words: number; at: string }
  /** The Writing Log: more minutes of typing on a day, in tenths. */
  | { what: 'log-typing'; date: string; minutes: number; at: string }
  /** A note's words as Kyle wrote them in a box of their own, its properties kept: the front and back matter (Book
   * details) and the book's Braindump (the writing page's Notes). `was` is the words as he opened them: what changed
   * somewhere else since comes in line by line, and where both changed the same lines his are kept. `start` is the
   * properties the note starts with when the vault does not have it yet; `name` is the book's title, for the history. */
  | { what: 'words'; of: 'matter' | 'braindump'; was: string; body: string; start: string; name: string }
  /** The Edit room: Kyle's reply to the Writer on one change card of a chapter's changes note, a `Reply:` line under
   * the card (2026-11-12). The ask that has the Writer make a new card from it goes in the same save. */
  | { what: 'change-reply'; id: string; words: string }
  /** Book details, Book look (2026-11-14): a series' look for its Kindle files, one property line per choice. `start` is
   * the note's text when the vault does not have it yet; `name` is the series, for the history. */
  | { what: 'look'; values: Record<string, string>; start: string; name: string };

/** Does this change start its note when the vault does not have it yet? The Writing Log's do (the first Pomodoro or
 * the first words of a day make that day's note), and so do the first words of a book's front and back matter or its
 * Braindump. Every other change is to a note that is already there. */
export function startsNote(c: TextChange): c is Extract<TextChange, { what: 'log-pomodoro' | 'log-typed' | 'log-typing' | 'words' | 'look' }> {
  return c.what === 'log-pomodoro' || c.what === 'log-typed' || c.what === 'log-typing' || c.what === 'words' || c.what === 'look';
}

/** The properties a book's Braindump starts with. */
export const BRAINDUMP_START = '---\ntype: braindump\n---\n';

/** Words without the blank lines before them or the space after them, so two versions compare as Kyle sees them. */
const plain = (b: string): string => b.replace(/^(\r?\n)+/, '').replace(/\s+$/, '');

/** A note's text with Kyle's words in it (the `words` change). */
function withWords(text: string, c: Extract<TextChange, { what: 'words' }>): string {
  // The Braindump keeps a blank line under its properties; the front and back matter start right under them.
  const lay = (b: string) => (c.of === 'braindump' ? '\n' : '') + plain(b) + '\n';
  if (!text) return c.start + lay(c.body);
  const s = Frontmatter.split(text);
  return withBody(text, lay(merge3(plain(c.was), plain(c.body), plain(s.hasFm ? s.body : text)).text));
}

export function validChange(c: unknown): c is TextChange {
  const x = c as TextChange;
  if (!x || typeof x !== 'object') return false;
  if (x.what === 'title-pick') return Number.isInteger(x.chapter) && typeof x.title === 'string' && typeof x.on === 'boolean';
  if (x.what === 'title-own') return Number.isInteger(x.chapter) && typeof x.title === 'string';
  if (x.what === 'through') return Number.isInteger(x.chapter) && typeof x.done === 'boolean';
  if (x.what === 'taken') return Array.isArray(x.names) && x.names.length > 0 && x.names.every((n) => typeof n === 'string');
  if (x.what === 'workflow-note') return typeof x.note === 'string' && typeof x.day === 'string';
  if (x.what === 'log-pomodoro') {
    const r = x.record;
    return Boolean(r && typeof r.date === 'string' && typeof r.time === 'string' && typeof r.minutes === 'number' && typeof r.words === 'number' && Array.isArray(r.scenes)) && typeof x.at === 'string';
  }
  if (x.what === 'log-typed') return typeof x.date === 'string' && typeof x.words === 'number' && x.words > 0 && typeof x.at === 'string';
  if (x.what === 'log-typing') return typeof x.date === 'string' && typeof x.minutes === 'number' && x.minutes > 0 && typeof x.at === 'string';
  if (x.what === 'change-reply') return typeof x.id === 'string' && /^C-\d+$/i.test(x.id) && typeof x.words === 'string' && x.words.trim().length > 0;
  if (x.what === 'look') return Boolean(x.values) && typeof x.values === 'object' && Object.values(x.values).every((v) => typeof v === 'string') && typeof x.start === 'string' && typeof x.name === 'string';
  if (x.what === 'words') return (x.of === 'matter' || x.of === 'braindump') && typeof x.was === 'string' && typeof x.body === 'string' && typeof x.start === 'string' && typeof x.name === 'string';
  return x.what === 'recipe' && typeof x.use_for === 'string' && typeof x.body === 'string';
}

/** The note's text with the change made. Every line the change does not touch stays as it was. */
export function changeText(text: string, c: TextChange): string {
  if (c.what === 'title-pick') return setPick(text, c.chapter, c.title, c.on);
  if (c.what === 'title-own') return addOwn(text, c.chapter, c.title);
  if (c.what === 'through') return withRewriteDone(text, c.chapter, c.done);
  if (c.what === 'taken') return withTaken(text, c.names);
  if (c.what === 'workflow-note') return addWorkflowNote(text, c.note, c.day);
  if (c.what === 'log-pomodoro') return addToDay(text, c.record, new Date(c.at));
  if (c.what === 'log-typed') return addTypedToDay(text, c.date, c.words, new Date(c.at));
  if (c.what === 'log-typing') return addTypingToDay(text, c.date, c.minutes, new Date(c.at));
  if (c.what === 'words') return withWords(text, c);
  if (c.what === 'look') return Object.keys(c.values).reduce((t, k) => Frontmatter.setScalar(t, k, c.values[k]) as string, text || c.start);
  if (c.what === 'change-reply') return addReply(text, c.id, c.words);
  return editRecipeText(text, c.use_for, c.body);
}

/** The note as the screens should show it once the change is in. */
export function changeRecord(note: NoteRecord, c: TextChange): NoteRecord {
  if (c.what === 'title-pick') return { ...note, body: setPick(note.body, c.chapter, c.title, c.on) };
  if (c.what === 'title-own') return { ...note, body: addOwn(note.body, c.chapter, c.title) };
  if (c.what === 'change-reply') return { ...note, body: addReply(note.body, c.id, c.words) };
  // The workflow is held as text, not as a note (apply.ts changes that text); this form is here for completeness.
  if (c.what === 'workflow-note') return { ...note, body: addWorkflowNote(note.body, c.note, c.day) };
  // A day of the Writing Log, and a note whose words Kyle wrote in a box, are made again from their properties and
  // words, exactly as their text is.
  if (startsNote(c)) return makeNote(note.path, note.sha, changeText(Frontmatter.join(note.data, note.body), c));
  if (c.what === 'taken') return takenRecord(note, c.names);
  if (c.what === 'through') {
    const now = rewriteDone(note);
    const next = (c.done ? now.concat(now.indexOf(c.chapter) < 0 ? [c.chapter] : []) : now.filter((n) => n !== c.chapter)).sort((a, b) => a - b);
    const data = { ...note.data };
    if (next.length) data.rewrite_done = next; else delete data.rewrite_done;
    return { ...note, data };
  }
  const data = { ...note.data };
  const u = c.use_for.trim().replace(/\s+/g, ' ');
  if (u) data.use_for = u; else delete data.use_for;
  return { ...note, data, body: c.body.trim() === note.body.trim() ? note.body : '\n' + c.body.trim() + '\n' };
}

/** The line the change leaves in the vault's history. No Agent trailer: it is Kyle's. */
export function changeMessage(text: string, c: TextChange, path: string): string {
  if (c.what === 'title-pick') return 'titles: Kyle ' + (c.on ? 'picked ' : 'unticked ') + (c.title === NONE ? 'None of these' : '"' + c.title + '"') + ' for chapter ' + c.chapter + '\n\nChosen in the Sparrow app.';
  if (c.what === 'title-own') return 'titles: Kyle wrote "' + c.title + '" for chapter ' + c.chapter + '\n\nChosen in the Sparrow app.';
  if (c.what === 'through') return 'rewrite: chapter ' + c.chapter + (c.done ? ' through' : ' opened again') + ' in the Rewrite tab';
  if (c.what === 'taken') return 'jobs: ' + path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '').split(' ')[0] + ' answer used\n\nKept by the Sparrow app, so no device uses it twice.';
  if (c.what === 'workflow-note') return 'workflow: Kyle\'s note';
  if (c.what === 'log-pomodoro') return 'log: ' + (c.record.stopped ? 'stopped Pomodoro' : 'Pomodoro') + ' at ' + c.record.time + ' on ' + c.record.date + ', ' + c.record.words + ' words\n\nKept by the Sparrow app\'s timer.';
  if (c.what === 'log-typed') return 'log: ' + c.words + (c.words === 1 ? ' word' : ' words') + ' typed on ' + c.date + '\n\nKept by the Sparrow app.';
  if (c.what === 'log-typing') return 'log: ' + c.minutes + (c.minutes === 1 ? ' minute' : ' minutes') + ' typing on ' + c.date + '\n\nKept by the Sparrow app.';
  if (c.what === 'change-reply') return 'changes: Kyle replied on ' + c.id.toUpperCase() + ' in ' + path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '') + '\n\nWritten in the Sparrow app.';
  if (c.what === 'look') return 'book look: ' + c.name + '\n\nChosen in the Sparrow app.';
  if (c.what === 'words') {
    if (c.of === 'braindump') return 'braindump: notes from the writing screen\n\nWritten in the Sparrow app.';
    return 'book matter: ' + (text ? '' : 'start for ') + c.name;
  }
  const m = /^title:[ \t]*(.*)$/m.exec(text);
  const name = (m ? m[1].trim().replace(/^["']|["']$/g, '') : '') || path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
  return 'recipes: edit ' + name + '\n\nEdited in the Sparrow app.';
}
