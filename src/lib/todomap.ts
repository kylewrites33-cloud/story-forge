// The To-do map (Kyle, 2026-11-01: "a to-do visualizer ... so i can see all the things i need or want to do in various
// contexts related to writing ... and publishing, etc"). Every task note sorted into one lane per part of Kyle's work,
// with what is being done now, what is late, and needs before wants. A task's lane is its `context` property; a book's
// to-do with none is Writing, and a studio to-do with none is guessed from its title until Kyle moves it.
import { idNumber, toNumber } from './links.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

export interface Context { key: string; label: string; hint: string }

/** The lanes, in the order the map shows them. Keys match the task schema's `context` values. */
export const CONTEXTS: Context[] = [
  { key: 'writing', label: 'Writing', hint: 'The books: fixes to the pages and story questions' },
  { key: 'publishing', label: 'Publishing', hint: 'KDP, Vellum, covers and editions' },
  { key: 'marketing', label: 'Marketing', hint: 'Market research, blurbs, keywords and launch' },
  { key: 'sparrow', label: 'Sparrow app', hint: 'Changes to this app' },
  { key: 'team', label: 'AI team', hint: 'The agents, their briefs and the workflow' },
  { key: 'admin', label: 'Setup and upkeep', hint: 'Computers, keys, accounts and housekeeping' }
];

const KEYS = CONTEXTS.map((c) => c.key);

/** A lane for a title with no `context`: the first rule that matches, else Setup and upkeep. */
const GUESSES: [string, RegExp][] = [
  ['admin', /\bvalidat|\bmac mini\b|\bapi key|\bkeys?\b|\bpassword|\bslack\b|\bbackup|\baccount/i],
  ['publishing', /\bkdp\b|\bvellum\b|\bcover|\bpublish|\bpaperback|\bhardcover|\bedition|\bisbn\b|\bcopyright|\bkenp\b|\ball-star|\bauthor name/i],
  ['marketing', /\bmarket|\brocket\b|\bkeyword|\bblurb|\bcomps?\b|\bcategor|\btropes?\b|\bnewsletter|\bads?\b|\blaunch|\bpre-?orders?|\breaders?\b|\blane\b/i],
  ['sparrow', /\bsparrow\b|\bstory forge\b|\bapp\b|\bbutton|\bscreen\b|\bpage\b|\bsettings\b|\bpomodoro|\bcrow\b/i],
  ['team', /\bteam\b|\bagents?\b|\bwriter\b|\bcontrarian|\bspecialist|\beditor\b|\bbeta reader|\bworkflow|\broster|\bbrief|\bclaude project|\bskill/i],
  ['writing', /\bchapter|\bscene|\bdraft|\bbook \d|\bbeats?\b|\boutline|\bcharacter|\bplot\b/i]
];

export function guessContext(title: string): string {
  const hit = GUESSES.find(([, re]) => re.test(title));
  return hit ? hit[0] : 'admin';
}

/** The book a task note belongs to, or null for a studio to-do. */
export function taskOwnerBook(index: VaultIndex, n: NoteRecord): BookEntry | null {
  return index.books.find((b) => n.path.startsWith(b.folder + '/')) || null;
}

/** The lane a task sits in: its `context`, Writing for a book's to-do, or a guess from the title. */
export function taskContext(index: VaultIndex, n: NoteRecord): string {
  const c = String(n.data.context || '').trim().toLowerCase();
  if (KEYS.indexOf(c) >= 0) return c;
  if (taskOwnerBook(index, n)) return 'writing';
  return guessContext(String(n.data.title || n.path));
}

/** Whether the lane came from the note itself (false: a guess Kyle may want to fix with Move). */
export function contextIsSet(n: NoteRecord): boolean {
  return KEYS.indexOf(String(n.data.context || '').trim().toLowerCase()) >= 0;
}

export function taskPriority(n: NoteRecord): 'need' | 'want' {
  return String(n.data.priority || '').trim().toLowerCase() === 'want' ? 'want' : 'need';
}

export function taskStatus(n: NoteRecord): string {
  const s = String(n.data.status || 'open');
  return ['open', 'doing', 'done', 'dropped'].indexOf(s) >= 0 ? s : 'open';
}

/** Whose to-do it is: Kyle's own, or the team's (Claude, Coordinator, an agent). */
export function isKyles(n: NoteRecord): boolean {
  const o = String(n.data.owner || 'Kyle').trim();
  return o === '' || o === 'Kyle';
}

function ymd(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function isLate(n: NoteRecord, now: Date): boolean {
  const s = n.data.due == null ? '' : String(n.data.due).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && s < ymd(now) && ['open', 'doing'].indexOf(taskStatus(n)) >= 0;
}

/** Open to-dos in the order the map lists them: being done now, then late, then needs before wants, soonest due, ID. */
export function mapOrder(notes: NoteRecord[], now: Date): NoteRecord[] {
  const due = (n: NoteRecord) => (n.data.due ? String(n.data.due).slice(0, 10) : '9999');
  return notes.slice().sort((a, b) =>
    Number(taskStatus(b) === 'doing') - Number(taskStatus(a) === 'doing')
    || Number(isLate(b, now)) - Number(isLate(a, now))
    || Number(taskPriority(a) === 'want') - Number(taskPriority(b) === 'want')
    || due(a).localeCompare(due(b))
    || (toNumber(a.data.chapter) ?? 9999) - (toNumber(b.data.chapter) ?? 9999)
    || (idNumber(a.data.id) || 0) - (idNumber(b.data.id) || 0)
    || a.path.localeCompare(b.path));
}

export interface MapFilter { who: '' | 'kyle' | 'team'; priority: '' | 'need' | 'want' }

export function passes(n: NoteRecord, f: MapFilter): boolean {
  if (f.who === 'kyle' && !isKyles(n)) return false;
  if (f.who === 'team' && isKyles(n)) return false;
  if (f.priority && taskPriority(n) !== f.priority) return false;
  return true;
}

/** One book's part of the Writing lane. `out` is true once the book is published (stage done): its old fixes fold away. */
export interface BookPart { book: BookEntry | null; title: string; out: boolean; open: NoteRecord[] }

export interface Lane {
  context: Context;
  /** Open and doing to-dos that pass the filter, in map order (a published book's leftovers left out). */
  open: NoteRecord[];
  doing: number;
  late: number;
  wants: number;
  /** Finished to-dos in this lane (all of them, whatever the filter). */
  done: number;
  /** For Writing: the open to-dos by book, the studio's own writing to-dos last. */
  books: BookPart[];
}

function bookIsOut(index: VaultIndex, book: BookEntry): boolean {
  const n = index.notes[book.folder + '/Book.md'];
  return Boolean(n) && String(n.data.stage || '') === 'done';
}

/** The whole map: one lane per context, each with its counts. Lanes stay in CONTEXTS order, empty ones included. */
export function todoMap(index: VaultIndex, notes: NoteRecord[], filter: MapFilter, now: Date): Lane[] {
  return CONTEXTS.map((context) => {
    const mine = notes.filter((n) => taskContext(index, n) === context.key);
    const all = mapOrder(mine.filter((n) => ['open', 'doing'].indexOf(taskStatus(n)) >= 0 && passes(n, filter)), now);
    const books: BookPart[] = [];
    // A published book's leftover fixes are kept apart: they do not count as open work.
    const outBooks = index.books.filter((b) => bookIsOut(index, b));
    const open = all.filter((n) => !outBooks.some((b) => n.path.startsWith(b.folder + '/')));
    if (context.key === 'writing') {
      index.books.forEach((b) => {
        const list = all.filter((n) => n.path.startsWith(b.folder + '/'));
        if (list.length) books.push({ book: b, title: b.title, out: bookIsOut(index, b), open: list });
      });
      // Published books go below the books still being written.
      books.sort((a, b) => Number(a.out) - Number(b.out));
      const loose = open.filter((n) => !taskOwnerBook(index, n));
      if (loose.length) books.push({ book: null, title: 'Other writing', out: false, open: loose });
    }
    return {
      context, open, books,
      doing: open.filter((n) => taskStatus(n) === 'doing').length,
      late: open.filter((n) => isLate(n, now)).length,
      wants: open.filter((n) => taskPriority(n) === 'want').length,
      done: mine.filter((n) => taskStatus(n) === 'done').length
    };
  });
}

/** The few to-dos to look at first, across every lane: being done now, then late, then due within a week. */
export function upNext(lanes: Lane[], now: Date, max = 5): NoteRecord[] {
  const week = ymd(new Date(now.getTime() + 7 * 86400000));
  const all = lanes.flatMap((l) => l.open);
  const soon = all.filter((n) => taskStatus(n) === 'doing' || isLate(n, now)
    || (n.data.due != null && String(n.data.due).slice(0, 10) <= week && /^\d{4}/.test(String(n.data.due))));
  return mapOrder(soon, now).slice(0, max);
}
