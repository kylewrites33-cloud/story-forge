// A book's Overview (Writers Room's book page, Kyle 2026-10-18): words against the book's target, how many scenes are
// drafted, revised and final, what is waiting on Kyle, and the Release runway (chapters posted, chapters ready, and weeks
// of buffer at the book's posting pace). Everything comes from notes the index already has.
import { piles } from './ideas.ts';
import { jobNotes } from './jobs.ts';
import { idNumber, toNumber } from './links.ts';
import { bookTodos, isOpen } from './todos.ts';
import { bookNotesToTeam } from './notes.ts';
import type { BookEntry, NoteRecord, Schema, VaultIndex } from './types.ts';

const str = (v: unknown) => (v == null ? '' : String(v).trim());

// Addresses in the app, as route.ts writes them (kept here so the logic needs no screen code).
export const at = {
  board: (key: string, folder: string) => '#/board/' + key + '/' + encodeURIComponent(folder),
  ideas: (folder: string) => '#/ideas/' + encodeURIComponent(folder),
  write: (path: string) => '#/write/' + encodeURIComponent(path),
  note: (path: string) => '#/note/' + encodeURIComponent(path),
  jobs: () => '#/jobs'
};

/** The book's own note (Book.md), with any waiting choice already applied. */
export function bookNote(index: VaultIndex, book: BookEntry): NoteRecord | null {
  return index.notes[book.path] || null;
}

/** The book's stage as the note says now (a stage Kyle just pressed shows before the next sync). */
export function bookStage(index: VaultIndex, book: BookEntry): string {
  const n = bookNote(index, book);
  return str(n && n.data.stage) || book.stage || 'spark';
}

/** The stages a book goes through, in order: the schema's book_stage list. */
export function bookStages(schema: Schema): string[] {
  const list = schema.statuses.book_stage;
  return list && list.length ? list.slice() : ['spark', 'premise', 'bible', 'outline', 'draft', 'revise', 'polish', 'done'];
}

/** The book's story scenes in reading order (test drives left out). */
export function storyScenes(index: VaultIndex, book: BookEntry): NoteRecord[] {
  return book.scenes.map((p) => index.notes[p]).filter((n) => Boolean(n) && n.data.kind !== 'test');
}

export interface BookNumbers {
  words: number;
  /** The book's target_words, or null when it has none. */
  target: number | null;
  /** Words as a share of the target, 0 to 100 (100 once past it). */
  percent: number;
  scenes: number;
  /** Scenes per status, in the schema's order (planned, drafted, revised, final). */
  counts: { status: string; count: number }[];
}

export function bookNumbers(schema: Schema, index: VaultIndex, book: BookEntry): BookNumbers {
  const scenes = storyScenes(index, book);
  const words = scenes.reduce((n, s) => n + (toNumber(s.data.words) || 0), 0);
  const note = bookNote(index, book);
  const t = note ? toNumber(note.data.target_words) : null;
  const target = t && t > 0 ? t : null;
  const order = (schema.statuses.scene || ['planned', 'drafted', 'revised', 'final']).slice();
  const counts: Record<string, number> = {};
  scenes.forEach((s) => { const st = str(s.data.status) || 'planned'; counts[st] = (counts[st] || 0) + 1; });
  Object.keys(counts).forEach((k) => { if (order.indexOf(k) < 0) order.push(k); });
  return {
    words, target, percent: target ? Math.min(100, Math.round((words / target) * 100)) : 0,
    scenes: scenes.length, counts: order.map((status) => ({ status, count: counts[status] || 0 }))
  };
}

/** How many questions for Kyle a scene's notes hold: the bullets of its "> [!question]" callouts (one if it has words but no bullets). */
export function openQuestions(body: string): number {
  let n = 0;
  const lines = String(body || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/^>\s*\[!question\]/i.test(lines[i])) continue;
    let bullets = 0, words = false;
    for (let j = i + 1; j < lines.length && /^>/.test(lines[j]); j++) {
      if (/^>\s*[-*+]\s+\S/.test(lines[j])) bullets++;
      else if (/\S/.test(lines[j].replace(/^>\s*/, ''))) words = true;
    }
    n += bullets || (words ? 1 : 0);
  }
  return n;
}

export interface WaitItem {
  key: string;
  count: number;
  /** "3 ideas to decide", in Kyle's words. */
  label: string;
  href: string;
}

const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);

/** The book's finished jobs (done or failed, chat left out), newest first. */
export function finishedJobs(index: VaultIndex, book: BookEntry): NoteRecord[] {
  return jobNotes(index)
    .filter((j) => str(j.data.book) === book.folder && str(j.data.kind) !== 'chat' && ['done', 'failed'].indexOf(str(j.data.status)) >= 0)
    .sort((a, b) => str(b.data.finished || b.data.created).localeCompare(str(a.data.finished || a.data.created)) || (idNumber(b.data.id) || 0) - (idNumber(a.data.id) || 0));
}

/** What is waiting on Kyle in this book: proposals to decide, open to-dos, open Notes to the Team, questions in the
 * scene notes, and finished jobs he has not marked seen on this device. Only rows with something in them. */
export function waitingOnKyle(index: VaultIndex, book: BookEntry, seenJobs: string[] = []): WaitItem[] {
  const notesOf = (paths?: string[]) => (paths || []).map((p) => index.notes[p]).filter(Boolean);
  const out: WaitItem[] = [];
  const ideas = piles(notesOf(book.ideas)).decide.length;
  if (ideas) out.push({ key: 'ideas', count: ideas, label: plural(ideas, 'idea to decide', 'ideas to decide'), href: at.ideas(book.folder) });
  const beats = piles(notesOf(book.beats)).decide.length;
  if (beats) out.push({ key: 'beats', count: beats, label: plural(beats, 'beat to decide', 'beats to decide'), href: at.board('beat-sheet', book.folder) });
  const conflicts = piles(notesOf(book.conflicts)).decide.length;
  if (conflicts) out.push({ key: 'conflicts', count: conflicts, label: plural(conflicts, 'conflict to decide', 'conflicts to decide'), href: at.board('conflict-matrix', book.folder) });
  const todos = bookTodos(index, book).filter(isOpen).length;
  if (todos) out.push({ key: 'todos', count: todos, label: plural(todos, 'open chapter to-do', 'open chapter to-dos'), href: at.board('edit-queue', book.folder) });
  const notes = bookNotesToTeam(index, book).filter((n) => str(n.data.status || 'open') !== 'done').length;
  if (notes) out.push({ key: 'notes', count: notes, label: plural(notes, 'open Note to the Team', 'open Notes to the Team'), href: at.board('notes', book.folder) });
  // Questions live in each scene's notes (Scene Notes/S-012 ...md); the link opens the first scene that has one.
  const pre = book.folder + '/';
  let questions = 0, first = '';
  storyScenes(index, book).forEach((s) => {
    const id = str(s.data.id);
    const sn = Object.values(index.notes).find((n) => n.type === 'scene-notes' && n.path.startsWith(pre) && str(n.data.scene) === id);
    const q = sn ? openQuestions(sn.body) : 0;
    if (q && !first) first = s.path;
    questions += q;
  });
  if (questions) out.push({ key: 'questions', count: questions, label: plural(questions, 'open question for you', 'open questions for you'), href: at.write(first) });
  const unseen = finishedJobs(index, book).filter((j) => seenJobs.indexOf(j.path) < 0).length;
  if (unseen) out.push({ key: 'jobs', count: unseen, label: plural(unseen, 'finished job you have not seen', 'finished jobs you have not seen'), href: at.jobs() });
  return out;
}

export interface Runway {
  /** Chapters with a posted scene (`published` set). */
  posted: number;
  /** Chapters not posted yet whose scenes are all final. */
  ready: number;
  /** Chapters per week, from the book's `cadence`; null when it has none. */
  cadence: number | null;
  /** Weeks of buffer: chapters ready over the cadence; null without a cadence. */
  weeks: number | null;
  /** True under two weeks of buffer (shown red). */
  low: boolean;
  /** The newest posting date, or ''. */
  lastPosted: string;
  /** The first chapter ready to post next ("Chapter 4"), or ''. */
  nextReady: string;
}

/** The Release runway. A chapter (scenes without one count one by one) is posted once any of its scenes has a
 * `published` date, and ready once every scene in it is final and none is posted. `cadence` is chapters per week. */
export function runway(index: VaultIndex, book: BookEntry): Runway {
  const units = new Map<string, NoteRecord[]>();
  storyScenes(index, book).forEach((s) => {
    const ch = toNumber(s.data.chapter);
    const key = ch == null ? 'scene:' + s.path : 'Chapter ' + ch;
    if (!units.has(key)) units.set(key, []);
    units.get(key)!.push(s);
  });
  let posted = 0, ready = 0, lastPosted = '', nextReady = '';
  units.forEach((scenes, key) => {
    const dates = scenes.map((s) => str(s.data.published)).filter(Boolean);
    if (dates.length) {
      posted++;
      dates.forEach((d) => { if (d > lastPosted) lastPosted = d; });
    } else if (scenes.every((s) => str(s.data.status) === 'final')) {
      ready++;
      if (!nextReady) nextReady = key.startsWith('scene:') ? str(scenes[0].data.id) || 'a scene' : key;
    }
  });
  const note = bookNote(index, book);
  const c = note ? toNumber(note.data.cadence) : null;
  const cadence = c && c > 0 ? c : null;
  const weeks = cadence ? Math.round((ready / cadence) * 10) / 10 : null;
  return { posted, ready, cadence, weeks, low: weeks != null && weeks < 2, lastPosted, nextReady };
}

// Finished jobs Kyle has looked at, per device and per vault, so the Overview only counts new ones.
const SEEN = 'story-forge.seen-jobs.';

export function loadSeenJobs(sourceKey: string, storage: Storage | null = globalThis.localStorage ?? null): string[] {
  try {
    const v = JSON.parse((storage && storage.getItem(SEEN + sourceKey)) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

/** Mark jobs seen; keeps the newest 500 so the list never grows without end. */
export function markJobsSeen(sourceKey: string, paths: string[], storage: Storage | null = globalThis.localStorage ?? null): string[] {
  const list = loadSeenJobs(sourceKey, storage).filter((p) => paths.indexOf(p) < 0).concat(paths).slice(-500);
  try { if (storage) storage.setItem(SEEN + sourceKey, JSON.stringify(list)); } catch { /* this visit only */ }
  return list;
}

/** Every card waiting on Kyle's choice in a book, for "Decide one at a time" (design review, 2026-10-22): ideas (with
 * the workflow's results), then beats, then conflicts, each in ID order. */
export function decideQueue(index: VaultIndex, book: BookEntry): NoteRecord[] {
  const notesOf = (paths?: string[]) => (paths || []).map((p) => index.notes[p]).filter(Boolean);
  return piles(notesOf(book.ideas)).decide.concat(piles(notesOf(book.beats)).decide, piles(notesOf(book.conflicts)).decide);
}
