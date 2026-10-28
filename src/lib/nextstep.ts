// The guided next step (Writers Room's /start, Kyle 2026-10-18): from a book's stage and what its notes say, the one next
// thing to do. Most steps are a job for the team (kind `next-step`, its ## Ask naming the step, and the team stops at a
// gate for Kyle's yes); some are Kyle's own (decide what is waiting on a board), and when a stage's work is done the step
// is to move the book to the next stage. The Overview shows it as one big button with a sentence of why.
import { chapterGroups } from './board.ts';
import { CHANGES_TYPE, isStoryCall, openCount } from './changes.ts';
import { piles } from './ideas.ts';
import { jobNotes, type NewJob } from './jobs.ts';
import { at, bookStage, bookStages, storyScenes } from './overview.ts';
import type { BookEntry, NoteRecord, Schema, VaultIndex } from './types.ts';

const str = (v: unknown) => (v == null ? '' : String(v).trim());

export interface NextStep {
  /** job: write a next-step job; link: go to a page (Kyle's own step); stage: move the book to `stage`. */
  action: 'job' | 'link' | 'stage';
  /** What the button says. */
  label: string;
  /** One sentence of why, in Kyle's words. */
  why: string;
  /** For a job: a short name for the step ("draft S-012"), the job's target; one step is never asked for twice at once. */
  target: string;
  /** For a job: the steps the team follows (the start of the ## Ask). */
  steps: string;
  /** For a link: where it goes. */
  href: string;
  /** For a stage step: the stage to move to. */
  stage: string;
  /** A job for this step is already waiting or being worked on: the button shows it instead of asking again. */
  busy: NoteRecord | null;
}

const GATE = 'Stop at a gate: file what you made as inbox proposals (never change canon or a kept note on your own), put a short summary for Kyle in the Result, and wait for his yes before starting the step after this one.';

/** A scene card with nothing on it yet: no summary, turn, goal or headline. */
export function emptyCard(n: NoteRecord): boolean {
  return ['headline', 'summary', 'turn', 'goal'].every((k) => !str(n.data[k]));
}

/** This book's next-step jobs. */
function stepJobs(index: VaultIndex, book: BookEntry): NoteRecord[] {
  return jobNotes(index).filter((j) => str(j.data.kind) === 'next-step' && str(j.data.book) === book.folder);
}

const isWaiting = (j: NoteRecord) => ['requested', 'running'].indexOf(str(j.data.status || 'requested')) >= 0;

/** The one next step for a book. */
export function nextStep(schema: Schema, index: VaultIndex, book: BookEntry): NextStep {
  const stage = bookStage(index, book);
  const stages = bookStages(schema);
  const later = stages[stages.indexOf(stage) + 1] || '';
  const jobs = stepJobs(index, book);
  const done = (target: string) => jobs.some((j) => str(j.data.target) === target && str(j.data.status) === 'done');
  const busyFor = (target: string) => jobs.find((j) => str(j.data.target) === target && isWaiting(j)) || null;
  const job = (target: string, label: string, why: string, steps: string): NextStep =>
    ({ action: 'job', label, why, target, steps, href: '', stage: '', busy: busyFor(target) });
  const link = (label: string, why: string, href: string): NextStep => ({ action: 'link', label, why, target: '', steps: '', href, stage: '', busy: null });
  const move = (why: string): NextStep => later
    ? { action: 'stage', label: 'Move the book to ' + later, why, target: '', steps: '', href: '', stage: later, busy: null }
    : link('Open the book', why, at.board('details', book.folder));

  const notesOf = (paths?: string[]) => (paths || []).map((p) => index.notes[p]).filter(Boolean);
  const ideas = notesOf(book.ideas);
  const pile = piles(ideas);
  const toDecide = (kinds: string[]) => pile.decide.filter((n) => kinds.indexOf(str(n.data.kind)) >= 0);
  const kept = (kinds: string[]) => pile.kept.filter((n) => kinds.indexOf(str(n.data.kind)) >= 0);
  const scenes = storyScenes(index, book);
  const groups = chapterGroups(schema, scenes).filter((g) => g.num != null);
  const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);

  // A drafted book already in the Edit room (story calls or changes filed for it) is edited there, whatever its older
  // `stage` says, so the step points to the Edit room instead of moving the book to revise (Kyle, 2026-10-28).
  const changeNotes = Object.values(index.notes).filter((n) => n.type === CHANGES_TYPE && n.path.startsWith(book.folder + '/'));
  const calls = ideas.filter(isStoryCall);
  const allDrafted = scenes.length > 0 && !scenes.some((n) => str(n.data.status || 'planned') === 'planned');
  if ((changeNotes.length || calls.length) && allDrafted && ['draft', 'revise', 'polish'].indexOf(stage) >= 0) {
    const openCalls = pile.decide.filter(isStoryCall).length;
    const openChanges = changeNotes.reduce((sum, n) => sum + openCount(n), 0);
    if (openCalls) return link('Answer the story calls', plural(openCalls, 'story call is', 'story calls are') + ' waiting for you in the Edit room'
      + (openChanges ? ', then ' + plural(openChanges, 'change', 'changes') + ' on the pages.' : '.'), at.board('story-calls', book.folder));
    if (openChanges) return link('Go through the changes', plural(openChanges, 'change is', 'changes are') + ' waiting for your yes or no in the Edit room.', at.board('changes', book.folder));
    return link('Open the Edit room', 'The book is in editing, and nothing in the Edit room is waiting on you right now.', at.board('changes', book.folder));
  }

  switch (stage) {
    case 'spark':
    case 'premise': {
      const waiting = toDecide(['premise', 'big-issue']);
      if (waiting.length) return link('Decide the premises', plural(waiting.length, 'premise idea is', 'premise ideas are') + ' waiting for you; the team builds on the one you keep.', at.ideas(book.folder));
      if (!kept(['premise']).length) {
        return job('premises', 'Pitch premises', 'The book has no premise you kept yet, and everything else grows from it.',
          'Run a brainstorm for this book\'s premise and Big Issue following `.claude/skills/room/SKILL.md` (the Contrarian included), using the Story Juice method (`.claude/skills/story-juice/SKILL.md`). File the best three to five as inbox ideas of kind premise or big-issue.');
      }
      return move('You kept a premise, so the ' + stage + ' stage is done.');
    }
    case 'market': {
      const series = index.series.find((s) => s.folder === book.seriesFolder);
      const thesis = notesOf(series && series.market).filter((n) => n.type === 'market-thesis');
      if (!thesis.length) {
        return job('market', 'Research the market', 'There is no market case for this series yet, so nobody knows what readers of the niche expect.',
          'Write the market case for this series following `.claude/skills/market-method/SKILL.md` as the Market Analyst: the niche drilldown, at least five comps, keyword sets and title candidates, each as an inbox note in the series\' Market folder. Every number names its source or says unverified.');
      }
      if (thesis.some((n) => str(n.data.status || 'inbox') === 'inbox')) return link('Decide the market case', 'The team\'s market case is waiting for your keep or drop.', at.board('market', book.folder));
      return move('The market case is decided.');
    }
    case 'bible': {
      const waiting = toDecide(['opinion', 'character', 'theme', 'world', 'big-issue']);
      if (waiting.length) return link('Decide the bible ideas', plural(waiting.length, 'idea for the story bible is', 'ideas for the story bible are') + ' waiting for you first.', at.ideas(book.folder));
      if (!done('develop')) {
        return job('develop', 'Build the story bible', 'The ideas you kept are not canon notes yet: characters, places, threads and themes.',
          'Turn the ideas Kyle kept for this book into canon notes following `.claude/skills/develop/SKILL.md` as the Story Specialist (characters, places, lore, items, threads, themes, promises), and update Book.md. Where a kept idea leaves a gap, file the question as an inbox idea instead of guessing.');
      }
      return move('The story bible is built from what you kept.');
    }
    case 'outline': {
      if (!scenes.length) {
        return job('outline', 'Outline the book', 'The book has no scene cards yet.',
          'Build the outline following `.claude/skills/outline/SKILL.md`: beats, then planned scene cards in the book\'s Scenes folder (status planned), with promises, layered with the character arcs and the genre\'s obligations, and the Contrarian\'s prediction test.');
      }
      const empty = scenes.filter((n) => str(n.data.status || 'planned') === 'planned' && emptyCard(n));
      if (empty.length) {
        return job('cards', 'Fill the empty scene cards', plural(empty.length, 'planned scene has', 'planned scenes have') + ' an empty card: no turn, goal or summary.',
          'Fill the cards of the planned scenes that have no turn, goal or summary (' + empty.map((n) => str(n.data.id)).filter(Boolean).join(', ') + ') following `.claude/skills/outline/SKILL.md`: goal, turn, hook and a one-line summary on each card. Never touch a scene\'s prose or a card Kyle filled in.');
      }
      if (!done('outline-notes')) {
        return job('outline-notes', 'Get notes on the outline', 'Every card is filled. A cold read now is cheaper than a rewrite after drafting.',
          'Give the outline a cold editorial read following `.claude/skills/notes/SKILL.md` as the Developmental Editor: the rubric score and prioritised notes, filed as inbox ideas of kind note.');
      }
      return move('The outline has its cards and its notes.');
    }
    case 'draft': {
      const planned = scenes.find((n) => str(n.data.status || 'planned') === 'planned');
      if (planned) {
        const id = str(planned.data.id);
        const name = [id, str(planned.data.title)].filter(Boolean).join(' ');
        return job('draft ' + (id || planned.path), 'Draft ' + name, 'It is the first scene in the book that still has no words.',
          'Draft ' + name + ' (`' + planned.path + '`) following `.claude/skills/draft/SKILL.md`: build the packet, have the Writer draft it in Kyle\'s voice, lint and fix, snapshot the untouched draft, and have the Continuity Keeper record progressions. Only this one scene.');
      }
      return move('Every scene has a draft.');
    }
    case 'revise': {
      const rough = groups.filter((g) => g.scenes.some((n) => ['planned', 'drafted'].indexOf(str(n.data.status || 'planned')) >= 0));
      const noted = (ch: number) => done('notes Chapter ' + ch) || jobNotes(index).some((j) => str(j.data.kind) === 'notes' && str(j.data.book) === book.folder
        && str(j.data.target) === 'Chapter ' + ch && str(j.data.status) === 'done');
      const next = rough.find((g) => !noted(g.num as number));
      if (next) {
        return job('notes Chapter ' + next.num, 'Notes on chapter ' + next.num, 'Chapter ' + next.num + ' is the first chapter still in its draft, with no notes yet.',
          'Give chapter ' + next.num + ' of this book a cold editorial read following `.claude/skills/notes/SKILL.md` as the Developmental Editor, and file the notes as inbox ideas of kind note with the chapter as their target.');
      }
      if (rough.length) {
        const g = rough[0];
        return job('revise Chapter ' + g.num, 'Revise chapter ' + g.num, 'Chapter ' + g.num + ' has its notes; now the ones you kept go into the pages.',
          'Revise chapter ' + g.num + ' of this book from the notes Kyle kept, following `.claude/skills/revise/SKILL.md`: top rung first, a snapshot before every change, lint and continuity after. Leave notes Kyle has not kept alone.');
      }
      return move('Every chapter is revised.');
    }
    case 'polish': {
      const g = groups.find((x) => x.scenes.some((n) => str(n.data.status) !== 'final') && !done('polish Chapter ' + x.num));
      if (g) {
        return job('polish Chapter ' + g.num, 'Line edit chapter ' + g.num, 'Chapter ' + g.num + ' is the first chapter not marked final.',
          'Line edit chapter ' + g.num + ' of this book following `.claude/skills/lint/SKILL.md` as the Line Editor: `sf lint` and `sf tics`, the fixes proposed beside the page, a snapshot first. Kyle marks scenes final himself.');
      }
      return move('Every chapter has had its line edit.');
    }
    case 'publish': {
      if (!done('package')) {
        return job('package', 'Package the book', 'The book needs its store page before it goes out: blurb, keywords, categories and the AI disclosure.',
          'Prepare this book for publishing following `.claude/skills/package/SKILL.md` as the Market Analyst: positioning, store copy, keywords and categories or tags, the launch plan and the AI disclosure draft, each as an inbox note.');
      }
      return move('The book\'s package is ready.');
    }
    case 'done': {
      if (!done('previously')) {
        return job('previously', 'Write the Previously note', 'The next book starts from a Previously note of this one.',
          'Draft the Previously note for this book with `System/Tools/sf previously` as the Continuity Keeper, then check it against Story So Far and file it as a proposal.');
      }
      return link('Start the next book', 'This book is finished and its Previously note is written.', '#/series/' + encodeURIComponent(book.seriesFolder));
    }
    default:
      return link('Set the book\'s stage', 'The book\'s stage (' + (stage || 'none') + ') is not one the app knows, so it cannot tell what comes next.', at.board('details', book.folder));
  }
}

/** The job a next step writes: kind next-step, its ## Ask naming the step, the steps, and the gate. */
export function nextStepJob(index: VaultIndex, book: BookEntry, step: NextStep, words = ''): NewJob {
  const stage = bookStage(index, book);
  const ask = 'Next step for ' + book.title + ' (stage: ' + stage + '): ' + step.label + '.\n\n' + step.steps + '\n\n' + GATE
    + (words.trim() ? '\n\nKyle\'s words: ' + words.trim() : '');
  return { title: 'Next step: ' + step.label, kind: 'next-step', target: step.target, book: book.folder, ask };
}

