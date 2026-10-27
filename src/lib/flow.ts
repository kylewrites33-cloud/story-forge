// Workflow mode (Kyle, 2026-10-21): the book run step by step through workflow 1.1, beside Writing mode. What each step
// makes is stored as idea notes in the book's Ideas folder with `step` (the step's number, or the name of a step of
// Kyle's own), `origin` (team, brought-in, kyle) and, once judged, `panel_score` and `panel_note`. Kyle keeps, puts
// off or drops them like any idea, so the same notes show in Writing mode, on the boards and in the codex.
// A step and the "Judge…" step after it are one task here: the team makes, the panel scores, Kyle decides.
import { Frontmatter } from './frontmatter.js';
import { idNumber, linkName } from './links.ts';
import { pileOf, stamp } from './ideas.ts';
import { safeTitle } from './scenes.ts';
import { makeNote } from './vault-index.ts';
import type { Workflow, WorkflowStep } from './workflow.ts';
import type { BookEntry, FileEntry, NoteRecord, VaultIndex, VaultSource } from './types.ts';

export type Mode = 'workflow' | 'writing';

export interface FlowTask {
  /** "18" for a step alone, "18-19" for a step and the judging step after it. */
  key: string;
  /** Index of the stage in the workflow. */
  stage: number;
  make: WorkflowStep;
  judge: WorkflowStep | null;
}

export interface FlowStage {
  index: number;
  title: string;
  tasks: FlowTask[];
}

/** A step that judges or checks what came before rather than making something. */
function judging(s: WorkflowStep): boolean {
  return /^(judge|check|cold read|proofread)\b/i.test(s.step.trim());
}

/** The workflow's stages with their steps paired into tasks: a "Judge…" step joins the making step just before it. */
export function flowStages(w: Workflow | null): FlowStage[] {
  if (!w) return [];
  return w.stages.map((st, index) => {
    const tasks: FlowTask[] = [];
    st.steps.forEach((s) => {
      if (!s.number) return;
      const last = tasks[tasks.length - 1];
      if (/^judge\b/i.test(s.step.trim()) && last && !last.judge && !judging(last.make) && last.make.number === s.number - 1) {
        last.judge = s;
        last.key = last.make.number + '-' + s.number;
        return;
      }
      tasks.push({ key: String(s.number), stage: index, make: s, judge: null });
    });
    return { index, title: st.title, tasks };
  });
}

export function allTasks(stages: FlowStage[]): FlowTask[] {
  return ([] as FlowTask[]).concat(...stages.map((s) => s.tasks));
}

export function taskByKey(stages: FlowStage[], key: string): FlowTask | null {
  return allTasks(stages).find((t) => t.key === key || String(t.make.number) === key || (t.judge && String(t.judge.number) === key)) || null;
}

/** The step numbers a task's results may carry. */
export function taskSteps(t: FlowTask): string[] {
  return t.judge ? [String(t.make.number), String(t.judge.number)] : [String(t.make.number)];
}

/** "Step 18" or "Steps 18 and 19". */
export function taskLabel(t: FlowTask): string {
  return t.judge ? 'Steps ' + t.make.number + ' and ' + t.judge.number : 'Step ' + t.make.number;
}

/** The step's words as plain text (no Markdown marks), for titles and buttons. */
export function plainStep(s: WorkflowStep): string {
  return s.step.replace(/`([^`]*)`/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
}

/** Every idea of the book that is a workflow result (it has a `step`). */
export function flowResults(index: VaultIndex, book: BookEntry): NoteRecord[] {
  return (book.ideas || []).map((p) => index.notes[p]).filter((n) => n && str(n.data.step) !== '')
    .sort((a, b) => (idNumber(a.data.id) || 0) - (idNumber(b.data.id) || 0) || a.path.localeCompare(b.path));
}

export function resultsOf(results: NoteRecord[], t: FlowTask): NoteRecord[] {
  const steps = taskSteps(t);
  return results.filter((n) => steps.indexOf(str(n.data.step)) >= 0);
}

/** Results whose step is not a workflow step number: Kyle's own steps. */
export function ownResults(results: NoteRecord[], stages: FlowStage[]): NoteRecord[] {
  const known = new Set<string>();
  allTasks(stages).forEach((t) => taskSteps(t).forEach((s) => known.add(s)));
  return results.filter((n) => !known.has(str(n.data.step)));
}

export type TaskState = 'none' | 'working' | 'judge' | 'check' | 'kept';

export const STATE_LABEL: Record<TaskState, string> = {
  none: 'Not started', working: 'The team is on it', judge: 'Waiting on you', check: 'Check', kept: 'Kept'
};

export interface TaskStatus {
  state: TaskState;
  kept: NoteRecord[];
  /** Waiting for Kyle: inbox results not put off. */
  decide: NoteRecord[];
  later: NoteRecord[];
  dropped: NoteRecord[];
  /** The open job on this task, if any. */
  job: NoteRecord | null;
  /** For Check: the earlier task whose kept results changed after these were kept. */
  changedBy: FlowTask | null;
}

function time(v: unknown): number {
  const t = Date.parse(str(v));
  return isFinite(t) ? t : 0;
}

/** When Kyle last settled a task's kept results: the latest keep or "Still fine". */
function settled(kept: NoteRecord[]): number {
  return kept.reduce((m, n) => Math.max(m, time(n.data.decided), time(n.data.checked)), 0);
}

/** The job target for a task: "Step 18". */
export function jobTarget(t: FlowTask): string {
  return 'Step ' + t.make.number;
}

export function openFlowJob(jobs: NoteRecord[], book: string, t: FlowTask): NoteRecord | null {
  return jobs.find((j) => str(j.data.kind) === 'workflow-step' && str(j.data.target) === jobTarget(t) && str(j.data.book) === book
    && ['requested', 'running'].indexOf(str(j.data.status) || 'requested') >= 0) || null;
}

/** Where each task stands. Check: a task earlier in the same stage or the stage before kept something new after this
 * task's results were kept, so they may need another look; "Still fine" (the `checked` time) clears it. */
export function taskStatuses(stages: FlowStage[], results: NoteRecord[], jobs: NoteRecord[], book: string): Record<string, TaskStatus> {
  const out: Record<string, TaskStatus> = {};
  const tasks = allTasks(stages);
  tasks.forEach((t) => {
    const mine = resultsOf(results, t);
    const by = (p: string) => mine.filter((n) => pileOf(n.data) === p);
    out[t.key] = { state: 'none', kept: by('kept'), decide: by('decide'), later: by('later'), dropped: by('dropped'), job: openFlowJob(jobs, book, t), changedBy: null };
  });
  tasks.forEach((t, i) => {
    const s = out[t.key];
    if (s.kept.length) {
      const since = settled(s.kept);
      for (let k = i - 1; k >= 0; k--) {
        const e = tasks[k];
        if (e.stage < t.stage - 1) break;
        if (out[e.key].kept.some((n) => time(n.data.decided) > since)) { s.changedBy = e; break; }
      }
    }
    s.state = s.job ? 'working' : s.decide.length ? 'judge' : s.changedBy ? 'check' : s.kept.length ? 'kept' : 'none';
  });
  return out;
}

/** How far a stage has come: tasks with something kept, out of all its tasks. */
export function stageProgress(stage: FlowStage, statuses: Record<string, TaskStatus>): { done: number; total: number; waiting: number } {
  let done = 0, waiting = 0;
  stage.tasks.forEach((t) => {
    const s = statuses[t.key];
    if (!s) return;
    if (s.kept.length) done++;
    if (s.state === 'judge' || s.state === 'check') waiting++;
  });
  return { done, total: stage.tasks.length, waiting };
}

/** What the book itself shows, beyond the workflow's results: prose in its scenes, chapters Kyle marked done, published. */
export interface BookSigns {
  prose: boolean;
  edited: boolean;
  published: boolean;
}

/** The book's signs, from its scenes (test drives left out) and its stage. */
export function bookSigns(index: VaultIndex, book: BookEntry): BookSigns {
  const scenes = book.scenes.map((p) => index.notes[p]).filter((n) => n && n.data.kind !== 'test');
  return {
    prose: scenes.some((n) => /\w/.test(n.body)),
    edited: scenes.some((n) => /^(revised|final)$/.test(str(n.data.status))),
    published: /publish|done|live/i.test(book.stage || '')
  };
}

/** Which stage the book is at, for "Where the book is" (Kyle, 2026-10-27: "if I've clearly just jumped into writing, then
 * I think the writing step should be highlighted"). The furthest stage with work in it wins, skipped stages before it
 * or not: a stage has work when a step has a result or a job, Writing when a scene has prose, Editing when Kyle marked a
 * chapter done. When that stage is fully kept, the one after it. Nothing started: the first stage. Returns an index into
 * the stages, `stages.length` for Publish, or -1 once the book is published. */
export function currentStage(stages: FlowStage[], statuses: Record<string, TaskStatus>, signs: BookSigns): number {
  if (signs.published) return -1;
  const started = (st: FlowStage) =>
    st.tasks.some((t) => { const s = statuses[t.key]; return !!s && (s.kept.length > 0 || s.decide.length > 0 || s.later.length > 0 || !!s.job); }) ||
    (signs.prose && /\bwrit/i.test(st.title)) || (signs.edited && /\bedit/i.test(st.title));
  const done = (st: FlowStage) => { const p = stageProgress(st, statuses); return p.total > 0 && p.done >= p.total; };
  let last = -1;
  stages.forEach((st, i) => { if (started(st)) last = i; });
  const from = last >= 0 && !done(stages[last]) ? last : last + 1;
  for (let i = Math.max(0, from); i < stages.length; i++) if (i === last || !done(stages[i])) return i;
  return stages.length;
}

/** The first task not kept yet, in order: where to pick up. */
export function nextTask(stages: FlowStage[], statuses: Record<string, TaskStatus>): FlowTask | null {
  return allTasks(stages).find((t) => statuses[t.key] && !statuses[t.key].kept.length) || null;
}

// ---- Which mode, per book, on this device ----

const MODE_KEY = 'story-forge.mode';

/** A book with no prose yet starts in Workflow mode; one with prose in Writing mode (Kyle, 2026-10-21). */
export function defaultMode(index: VaultIndex, book: BookEntry): Mode {
  const prose = book.scenes.some((p) => { const n = index.notes[p]; return n && n.data.kind !== 'test' && /\w/.test(n.body); });
  return prose ? 'writing' : 'workflow';
}

export function loadMode(sourceKey: string, index: VaultIndex, book: BookEntry): Mode {
  try {
    const all = JSON.parse(localStorage.getItem(MODE_KEY) || '{}') as Record<string, string>;
    const m = all[sourceKey + '|' + book.folder];
    if (m === 'workflow' || m === 'writing') return m;
  } catch { /* no storage: the default */ }
  return defaultMode(index, book);
}

export function saveMode(sourceKey: string, folder: string, mode: Mode): void {
  try {
    const all = JSON.parse(localStorage.getItem(MODE_KEY) || '{}') as Record<string, string>;
    all[sourceKey + '|' + folder] = mode;
    localStorage.setItem(MODE_KEY, JSON.stringify(all));
  } catch { /* the choice lasts this visit only */ }
}

// ---- New results ----

export type Origin = 'team' | 'brought-in' | 'kyle';

export const ORIGIN_LABEL: Record<string, string> = { team: 'The team', 'brought-in': 'Brought in', kyle: 'Yours' };

/** The idea kind a step's results get, from what the step makes. */
export function kindForStep(step: string): string {
  const n = parseInt(step, 10);
  if (!isFinite(n)) return 'other';
  if (n === 10) return 'premise';
  if (n === 11) return 'opinion';
  if (n === 13 || n === 14) return 'scene';
  if (n >= 12 && n <= 24) return 'character';
  if (n === 25) return 'plot';
  if (n >= 26 && n <= 31) return 'structure';
  if (n >= 32) return 'note';
  return 'other';
}

/** Pasted results, one per paragraph (a blank line between). A list with one item per line counts as one per line. */
export function splitResults(text: string): string[] {
  const t = text.replace(/\r\n?/g, '\n').trim();
  if (!t) return [];
  const paras = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 1) {
    const lines = paras[0].split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines.every((l) => /^([-*•]|\d+[.)])\s+/.test(l))) return lines.map(stripBullet);
    return [stripBullet(paras[0])];
  }
  return paras.map(stripBullet);
}

function stripBullet(s: string): string {
  return s.replace(/^([-*•]|\d+[.)])\s+/, '').trim();
}

/** A short title from a result's words: its first line, or its first sentence, up to about 60 characters. */
export function resultTitle(text: string): string {
  const first = text.trim().split('\n')[0].replace(/[*_`#>]/g, '').trim();
  const sentence = (/^(.+?[.!?])(\s|$)/.exec(first) || [first, first])[1].replace(/[.!?]+$/, '');
  const t = safeTitle(sentence.replace(/\s+/g, ' '));
  if (t.length <= 60) return t;
  return t.slice(0, 59).replace(/\s+\S*$/, '').replace(/[\s,.;:!?-]+$/, '');
}

export interface NewResult {
  step: string;
  origin: Origin;
  text: string;
  /** A character's name or "Chapter N", or ''. */
  target: string;
  /** keep when Kyle wrote it and pressed Keep; inbox otherwise. */
  status: 'keep' | 'inbox';
}

/** The next free idea ID in the book, counting every I-NNN file under its folder (Archive too), as sf next-id does. */
export function nextIdeaNumber(files: FileEntry[], bookFolder: string): number {
  let max = 0;
  files.forEach((f) => {
    if (!f.path.startsWith(bookFolder + '/')) return;
    const m = /^I-(\d+)\b/.exec(f.path.slice(f.path.lastIndexOf('/') + 1));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return max + 1;
}

/** A target as the note writes it: a character's name as a link, a chapter as "Chapter N". */
export function targetValue(target: string, names: string[]): string {
  const t = target.trim();
  if (!t) return '';
  const ch = /^(?:ch(?:apter)?\.?\s*)?(\d+)$/i.exec(t);
  if (ch) return 'Chapter ' + parseInt(ch[1], 10);
  const name = names.find((n) => n.toLowerCase() === t.toLowerCase());
  return name ? '[[' + name + ']]' : t;
}

export function resultText(id: string, r: NewResult, now: Date): string {
  const words = r.text.trim();
  const data: Record<string, unknown> = {
    type: 'idea', id, title: resultTitle(words) || 'Result', kind: kindForStep(r.step), status: r.status,
    source: r.origin === 'kyle' ? 'Kyle' : r.origin === 'brought-in' ? 'Kyle (brought in)' : 'Story Specialist',
    pitch: words.replace(/\s+/g, ' ').slice(0, 300), step: r.step, origin: r.origin
  };
  if (r.target) data.target = r.target;
  if (r.status === 'keep') data.decided = stamp(now);
  data.created = stamp(now).slice(0, 10);
  return Frontmatter.join(data, '\n## The idea\n\n' + words + '\n');
}

/** Write results as idea notes in the book's Ideas folder, one commit each, as Kyle's (no Agent trailer). */
export async function createResults(source: VaultSource, bookFolder: string, list: NewResult[], now: Date): Promise<NoteRecord[]> {
  if (!source.write) throw new Error('This vault cannot be changed from the app.');
  const made: NoteRecord[] = [];
  let next = 0;
  for (const r of list) {
    for (let attempt = 0; ; attempt++) {
      if (!next || attempt) next = nextIdeaNumber((await source.tree()).files, bookFolder);
      const id = 'I-' + String(next).padStart(3, '0');
      const text = resultText(id, r, now);
      const title = safeTitle(String(Frontmatter.parse(text).data.title || 'Result'));
      const path = bookFolder + '/Ideas/' + id + ' ' + title + '.md';
      try {
        const how = r.origin === 'kyle' ? 'written in' : 'brought into';
        const sha = await source.write(path, text, '', 'ideas: add ' + id + ' ' + title + '\n\nA result for workflow step ' + r.step + ', ' + how + ' the Sparrow app.');
        made.push(makeNote(path, sha, text));
        next++;
        break;
      } catch (e) {
        if ((e as { conflict?: boolean }).conflict && attempt < 3) continue;
        throw e;
      }
    }
  }
  return made;
}

// ---- Asking the team ----

export type FlowAsk = 'make' | 'judge' | 'change';

/** The ## Ask of a workflow-step job. The runner reads it with System/Workflow.md. */
export function flowJobAsk(t: FlowTask, ask: FlowAsk, words: string): string {
  const his = words.trim() ? '\n\nKyle\'s words: ' + words.trim() : '';
  const row = 'step ' + t.make.number + ' of `System/Workflow.md` ("' + plainStep(t.make) + '")';
  const store = 'File every result as an inbox idea in this book\'s Ideas folder with `step: "' + t.make.number + '"`, `origin: team`, `source` the agent who made it, a `target` when it is about one character or chapter, and a one-line `pitch`; a list step makes one note per item.';
  const inputs = ' Read what Kyle kept at earlier steps (ideas with a `step` and `status: keep`) as the step\'s inputs.';
  if (ask === 'judge') {
    const how = t.judge ? 'step ' + t.judge.number + ' ("' + plainStep(t.judge) + '") as its row says' : 'a judging panel';
    return 'Kyle pressed Ask the team to judge in Workflow mode. Judge the inbox results of ' + row + ' with ' + how + ', following `.claude/skills/judge-panel/SKILL.md`. '
      + 'On each inbox result write only `panel_score` (1 to 5) and `panel_note` (one line). Never set keep, later or discard: Kyle decides. Put the strongest two or three in the Result.' + his;
  }
  if (ask === 'change') {
    return 'Kyle pressed Change in Workflow mode for ' + row + '. Make new results that answer his words, as the step\'s row says. ' + store
      + ' Link each new one with `related` to the result it replaces when there is one. Never change a kept note.' + inputs + his;
  }
  return 'Kyle pressed Ask the team in Workflow mode. Run ' + row + ' exactly as its row says (Who, Minds, Needs, and the skills it names), at most four agents. ' + store
    + (t.judge ? ' Then judge them as step ' + t.judge.number + ' says, writing only `panel_score` and `panel_note` on each.' : '') + inputs
    + ' Never change kept notes, canon or prose. Put the counts and the strongest two or three in the Result.' + his;
}

export function flowJobTitle(t: FlowTask, ask: FlowAsk): string {
  const what = plainStep(t.make).replace(/[,;:].*$/, '');
  const short = what.length > 50 ? what.slice(0, 49).replace(/\s+\S*$/, '') : what;
  return (ask === 'judge' ? 'Judge step ' : ask === 'change' ? 'Change step ' : 'Step ') + t.make.number + ' ' + short;
}

// ---- Results in Writing mode ----

/** Kept results about a chapter, a scene or anyone named, newest kept first. */
export function keptFor(results: NoteRecord[], where: { chapter: number | null; sceneId: string; names: string[] }): NoteRecord[] {
  const names = where.names.map((n) => n.toLowerCase());
  return results.filter((n) => {
    if (pileOf(n.data) !== 'kept') return false;
    const t = str(n.data.target);
    if (!t) return false;
    const ch = /^chapter\s+(\d+)$/i.exec(t);
    if (ch) return where.chapter != null && parseInt(ch[1], 10) === where.chapter;
    if (where.sceneId && t === where.sceneId) return true;
    const name = (linkName(t) || t).toLowerCase();
    return names.indexOf(name) >= 0;
  }).sort((a, b) => time(b.data.decided) - time(a.data.decided));
}

/** Kept results about one character (by name or alias). */
export function keptAbout(results: NoteRecord[], names: string[]): NoteRecord[] {
  return keptFor(results, { chapter: null, sceneId: '', names });
}

/** "Step 18 · The team" for a result's tag line. */
export function resultTag(n: NoteRecord): string {
  const step = str(n.data.step);
  const o = ORIGIN_LABEL[str(n.data.origin)] || '';
  return [/^\d+$/.test(step) ? 'Step ' + step : step, o].filter(Boolean).join(' · ');
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}
