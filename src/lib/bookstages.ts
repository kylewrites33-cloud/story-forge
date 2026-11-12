// Where the book is, in six stages (Kyle, 2026-11-06: "I think the areas that maybe we would want to track are: the market
// research, the planning, the outlining, which maybe would involve both the outline and the beats, the writing, the
// editing, the publishing ... and maybe tracking a percentage of how far along we are in that step is a good idea").
// Every percent comes from what is in the vault: steps kept in the workflow, chapters with beats or a plan, chapters
// done, chapters through the rewrite, changes decided. Nothing is guessed, and a stage with nothing to count says so.
import type { BookStatus } from './bookstatus.ts';
import type { FlowStage, TaskStatus } from './flow.ts';
import { stageProgress } from './flow.ts';
import { toNumber } from './links.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';
import { storyScenes } from './overview.ts';
import { propText } from './props.ts';

export type StageKey = 'market' | 'planning' | 'outlining' | 'writing' | 'editing' | 'publishing';

export interface SixStage {
  key: StageKey;
  name: string;
  /** 0 to 100. */
  percent: number;
  /** What the percent counts, in plain words: "6 of 37 chapters through". */
  detail: string;
  /** The stage the book is in now. */
  current: boolean;
  /** An earlier stage the book has moved past without finishing it in the app: taken as done off the app, drawn in a
   * lighter colour (Kyle, 2026-11-06: "can we assume that if im in a further stage, that the previous stages are implicity
   * complete"; "im not sure i like saying its skipped. maybe it just happened off-app"). */
  elsewhere: boolean;
}

export const STAGE_NAMES: Record<StageKey, string> = {
  market: 'Market research', planning: 'Planning', outlining: 'Outlining', writing: 'Writing', editing: 'Editing', publishing: 'Publishing'
};
const ORDER: StageKey[] = ['market', 'planning', 'outlining', 'writing', 'editing', 'publishing'];

/** Which of the six a workflow stage belongs to, by its title; null for Writing and Editing, which count the book itself. */
export function sixOf(title: string): StageKey | null {
  if (/market/i.test(title)) return 'market';
  if (/outlin/i.test(title)) return 'outlining';
  if (/publish/i.test(title)) return 'publishing';
  if (/planning|pre-?writing|test drive/i.test(title)) return 'planning';
  return null;
}

const pct = (done: number, total: number) => (total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0);
const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);
const kept = (n: NoteRecord) => propText(n, 'status') === 'keep';

/** Steps kept out of all steps in the workflow stages that belong to one of the six. */
function steps(stages: FlowStage[], statuses: Record<string, TaskStatus>, key: StageKey): { done: number; total: number } {
  let done = 0, total = 0;
  stages.forEach((st) => {
    if (sixOf(st.title) !== key) return;
    const p = stageProgress(st, statuses);
    done += p.done;
    total += p.total;
  });
  return { done, total };
}

const stepLine = (s: { done: number; total: number }) => s.done + ' of ' + plural(s.total, 'step', 'steps') + ' kept';

export interface StageInput {
  index: VaultIndex;
  book: BookEntry;
  stages: FlowStage[];
  statuses: Record<string, TaskStatus>;
  /** The Books page's answer for this book (bookStatus), so both pages tell the same story. */
  status: BookStatus;
}

/** The six stages with their percent, the one the book is in marked current. */
export function sixStages({ index, book, stages, statuses, status }: StageInput): SixStage[] {
  const inBook = (n: NoteRecord) => n.path.startsWith(book.folder + '/');
  const notes = Object.values(index.notes).filter(inBook);
  const scenes = storyScenes(index, book);
  const chapters = new Set<number>();
  scenes.forEach((s) => { const c = toNumber(s.data.chapter); if (c != null) chapters.add(c); });
  const published = status.phase === 'published';
  const prose = scenes.some((s) => /\w/.test(s.body));
  const editingStarted = status.phase === 'rewrite' || status.phase === 'changes' || status.phase === 'publishing' || published || (book.drafts || []).length > 0;

  // Market research: the workflow's market steps, or else the Market board's kinds of note with one kept.
  const mSteps = steps(stages, statuses, 'market');
  const kinds = ['market-thesis', 'comp', 'keyword-set', 'title-candidate'];
  const kindsKept = kinds.filter((k) => notes.some((n) => n.type === k && kept(n))).length;
  const market = published ? { percent: 100, detail: 'Done' }
    : pct(mSteps.done, mSteps.total) >= pct(kindsKept, kinds.length) && mSteps.total
      ? { percent: pct(mSteps.done, mSteps.total), detail: stepLine(mSteps) }
      : { percent: pct(kindsKept, kinds.length), detail: kindsKept + ' of 4 kept: thesis, comps, keywords, title' };

  // Planning: the workflow's premise, test drive and cast steps.
  const pSteps = steps(stages, statuses, 'planning');
  const planning = published ? { percent: 100, detail: 'Done' } : { percent: pct(pSteps.done, pSteps.total), detail: pSteps.total ? stepLine(pSteps) : 'No steps yet' };

  // Outlining: half the outline (the workflow's outline steps, or the beat sheet's beats kept), half the chapters that
  // have beats or a plan.
  const oSteps = steps(stages, statuses, 'outlining');
  const sheet = notes.filter((n) => n.type === 'beat');
  const outlineShare = Math.max(oSteps.total ? oSteps.done / oSteps.total : 0, sheet.length ? sheet.filter(kept).length / sheet.length : 0);
  const planned = new Set<number>();
  notes.forEach((n) => {
    if (n.type !== 'chapter-beats' && n.type !== 'chapter-plan') return;
    const c = toNumber(n.data.chapter);
    if (c != null && /\w/.test(n.body)) planned.add(c);
  });
  const chapterCount = Math.max(chapters.size, planned.size);
  const beatShare = chapterCount ? planned.size / chapterCount : 0;
  const outlineLine = oSteps.total ? 'outline ' + oSteps.done + ' of ' + oSteps.total + ' steps' : sheet.length ? 'beat sheet ' + sheet.filter(kept).length + ' of ' + sheet.length + ' kept' : 'no outline yet';
  const outlining = published ? { percent: 100, detail: 'Done' }
    : { percent: Math.round(((outlineShare + beatShare) / 2) * 100), detail: outlineLine + ' · beats or a plan for ' + planned.size + ' of ' + plural(chapterCount, 'chapter', 'chapters') };

  // Writing: done once a draft is saved or editing has begun; before that, the Books page's count.
  const writing = editingStarted ? { percent: 100, detail: 'Draft 1 written' }
    : status.phase === 'writing' ? { percent: status.percent || 0, detail: status.detail }
      : { percent: 0, detail: prose ? 'Started' : 'Not started' };

  // Editing: three passes, draft 1 to 2, 2 to 3 and 3 to 4 (Kyle's draft stages, 2026-10-29); the pass under way counts
  // as far as it has got.
  let editing: { percent: number; detail: string };
  if (published || status.phase === 'publishing') editing = { percent: 100, detail: 'Done' };
  else if (status.phase === 'rewrite' || status.phase === 'changes') {
    const m = /Draft (\d+) to (\d+)/.exec(status.stage);
    const from = m ? parseInt(m[1], 10) : 1;
    const part = (status.percent || 0) / 100;
    editing = { percent: Math.min(100, Math.round(((Math.max(0, from - 1) + part) / 3) * 100)), detail: status.stage.replace(/^Draft (\d+) to (\d+): /, 'Draft $1 to $2, ') + ' · ' + status.detail + ' (pass ' + Math.min(3, Math.max(1, from)) + ' of 3)' };
  } else if (editingStarted) {
    const saved = (book.drafts || []).reduce((m, d) => Math.max(m, d.number), 0);
    editing = { percent: pct(Math.max(0, saved - 1), 3), detail: 'Draft ' + (saved + 1) + ' started' };
  } else editing = { percent: 0, detail: 'Not started' };

  // Publishing: the workflow's publishing steps; all of it once the book is out.
  const uSteps = steps(stages, statuses, 'publishing');
  const publishing = published ? { percent: 100, detail: 'Published' } : { percent: pct(uSteps.done, uSteps.total), detail: uSteps.total ? stepLine(uSteps) : 'Not started' };

  const all: Record<StageKey, { percent: number; detail: string }> = { market, planning, outlining, writing, editing, publishing };
  // The stage the book is in: from the Books page's answer once there is prose, else the furthest planning stage with work.
  let current: StageKey | null = null;
  if (published) current = null;
  else if (status.phase === 'publishing') current = 'publishing';
  else if (status.phase === 'rewrite' || status.phase === 'changes' || editingStarted) current = 'editing';
  else if (status.phase === 'writing' || prose) current = 'writing';
  else {
    current = 'market';
    (['market', 'planning', 'outlining'] as StageKey[]).forEach((k) => { if (all[k].percent > 0) current = all[k].percent >= 100 ? ORDER[ORDER.indexOf(k) + 1] : k; });
  }
  const at = current ? ORDER.indexOf(current) : -1;
  return ORDER.map((key, i) => {
    const elsewhere = i < at && all[key].percent < 100;
    return { key, name: STAGE_NAMES[key], percent: elsewhere ? 100 : all[key].percent,
      detail: elsewhere ? 'Done outside the app (in the app: ' + all[key].detail + ')' : all[key].detail, current: key === current, elsewhere };
  });
}

// ---- The publish date ----

/** The book's planned publish date (`publish_date`, YYYY-MM-DD), or null. */
export function publishDate(book: { data: Record<string, unknown> } | null | undefined): string | null {
  const v = book ? book.data.publish_date : null;
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** "Sat, Nov 21, 2026 · 15 days away", counted in whole days on this device's calendar. */
export function publishLine(date: string, now: Date): string {
  const [y, m, d] = date.split('-').map((x) => parseInt(x, 10));
  const day = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((day.getTime() - today.getTime()) / 86400000);
  const when = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const left = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days > 1 ? days + ' days away' : days === -1 ? 'yesterday' : -days + ' days ago';
  return when + ' · ' + left;
}
