// Where each book is, for the Books page (Kyle, 2026-11-05: "wouldnt continue where you left off for QD2 recognize the
// phase im in, and then take me to the draft 2 editing mode at my most recent chapter? ... Maybe that area should
// recognize what mode we're in, and give a progress % based on how much of the current stage has been completed?").
// One answer per book: the stage it is in, how much of that stage is done, and the scene to open to carry on.
import { workingNumber } from './bookdrafts.ts';
import { CHANGES_TYPE, chapterChanges, parseChanges } from './changes.ts';
import type { Recent } from './home.ts';
import { toNumber } from './links.ts';
import { chaptersDone, storyScenes } from './overview.ts';
import { rewriteDone, rewriteFor, rewriteProgress } from './rewrite.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

export type BookPhase = 'planning' | 'writing' | 'rewrite' | 'changes' | 'publishing' | 'published';

export interface BookStatus {
  phase: BookPhase;
  /** The stage in plain words: "Draft 1 to 2: the rewrite". */
  stage: string;
  /** How much of that stage is done, 0 to 100; null when there is nothing to count. */
  percent: number | null;
  /** What the percent counts: "2 of 37 chapters through". */
  detail: string;
  /** Still being worked on: shown under Continue where you left off. */
  active: boolean;
  /** The scene to open to carry on, or null for the book's own page. */
  go: string | null;
  /** The words on the button. */
  goLabel: string;
  /** When Kyle last opened a scene of this book on this device. */
  at: string | null;
}

/** The workflow stage a book without prose is in, worked out by the caller from the workflow (Flow's currentStage). */
export interface PlanningStage { name: string; done: number; total: number }

const pct = (done: number, total: number) => (total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null);
const chapterOf = (n: NoteRecord | undefined) => (n ? toNumber(n.data.chapter) : null);

/** Where the book is and where to pick up. `recent` is the device's list of scenes Kyle opened, newest first. */
export function bookStatus(index: VaultIndex, book: BookEntry, recent: Recent[], planning: PlanningStage | null = null, activeFolder = ''): BookStatus {
  const note = index.notes[book.path];
  const stageName = String((note && note.data.stage) || book.stage || '');
  const scenes = storyScenes(index, book);
  const last = recent.find((r) => scenes.some((s) => s.path === r.path)) || null;
  const lastNote = last ? index.notes[last.path] : undefined;
  const at = last ? last.at : null;

  if (/^(done|published|live)$/i.test(stageName)) {
    return { phase: 'published', stage: 'Published', percent: 100, detail: '', active: false, go: null, goLabel: 'Open the book', at };
  }

  const working = workingNumber(book.drafts || []);

  // Draft 1 to 2: Kyle's pass through the Writer's rewrite, chapter by chapter ("Done with this chapter").
  const through = rewriteDone(note ? { data: note.data as Record<string, unknown> } : null);
  const rw = rewriteProgress(book.rewrite || [], scenes, through);
  if (rw.done > 0 && rw.through < rw.total) {
    const lastCh = chapterOf(lastNote);
    // The last chapter he opened, unless he already called it through and has moved on: then the next one.
    const here = lastNote && lastCh != null && through.indexOf(lastCh) < 0 && rewriteFor(book.rewrite || [], lastNote) ? lastNote.path : null;
    return {
      phase: 'rewrite', stage: 'Draft ' + Math.max(1, working - 1) + ' to ' + Math.max(2, working) + ': the rewrite',
      percent: pct(rw.through, rw.total), detail: rw.through + ' of ' + rw.total + ' chapters through',
      active: true, go: here || rw.next || rw.first, goLabel: 'Keep editing', at
    };
  }

  // Later drafts: the team's changes waiting on the page for Accept or Reject.
  const first = (ch: number) => { const s = scenes.find((x) => chapterOf(x) === ch); return s ? s.path : null; };
  const waiting = chapterChanges(index.notes, book.folder, first).filter((c) => c.open > 0);
  if (waiting.length) {
    let all = 0, open = 0;
    Object.values(index.notes).forEach((n) => {
      if (n.type !== CHANGES_TYPE || !n.path.startsWith(book.folder + '/')) return;
      const list = parseChanges(n.body).changes;
      all += list.length;
      open += list.filter((c) => c.status === 'open').length;
    });
    const lastCh = chapterOf(lastNote);
    const here = lastNote && waiting.some((c) => c.chapter === lastCh) ? lastNote.path : null;
    return {
      phase: 'changes', stage: 'Draft ' + working + ' to ' + (working + 1) + ': changes',
      percent: pct(all - open, all), detail: open + (open === 1 ? ' change' : ' changes') + ' waiting in ' + waiting.length + (waiting.length === 1 ? ' chapter' : ' chapters'),
      active: true, go: here || waiting[0].path, goLabel: 'Keep editing', at
    };
  }

  if (/^publish$/i.test(stageName)) {
    return { phase: 'publishing', stage: 'Getting it published', percent: null, detail: '', active: true, go: null, goLabel: 'Open the book', at };
  }

  // Writing: progress counts only chapters Kyle marked done (Kyle, 2026-10-22).
  const prose = scenes.filter((s) => /\w/.test(s.body));
  if (prose.length) {
    const done = chaptersDone(scenes);
    const target = note ? toNumber(note.data.target_words) : null;
    const percent = target ? pct(done.words, target) : pct(done.done, done.chapters);
    return {
      phase: 'writing', stage: working === 1 ? 'Draft 1: writing' : 'Draft ' + working,
      percent, detail: done.done + ' of ' + done.chapters + (done.chapters === 1 ? ' chapter' : ' chapters') + ' done',
      active: !!last || book.folder === activeFolder, go: lastNote ? lastNote.path : prose[prose.length - 1].path, goLabel: 'Keep writing', at
    };
  }

  return {
    phase: 'planning', stage: planning ? 'Planning: ' + planning.name : 'Planning',
    percent: planning ? pct(planning.done, planning.total) : null,
    detail: planning && planning.total ? planning.done + ' of ' + planning.total + ' steps kept' : '',
    active: !!last || book.folder === activeFolder, go: null, goLabel: 'Open the plan', at
  };
}

/** The books to offer under Continue where you left off: one card per book still being worked on, the one opened last first. */
export function continueBooks(statuses: { book: BookEntry; status: BookStatus }[], max = 3): { book: BookEntry; status: BookStatus }[] {
  return statuses.filter((s) => s.status.active)
    .sort((a, b) => (b.status.at || '').localeCompare(a.status.at || ''))
    .slice(0, max);
}
