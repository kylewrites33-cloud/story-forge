// Workflow mode (Kyle, 2026-10-21: "put in the AI mode with all these workflows"): the book run through workflow 1.1.
// Home shows the six stages as a road, what waits on Kyle and what the team is on; a stage lists its steps with where
// each stands; a step has Judge, Kept, Make and Change. Every result is an idea note (see lib/flow.ts), so what is kept
// here shows in Writing mode's Workflow tab, on character pages and on the Ideas board.
import { useMemo, useState } from 'preact/hooks';
import { castFor } from '../lib/boards.ts';
import { stamp, type Decision } from '../lib/ideas.ts';
import { jobNotes, type OnJob } from '../lib/jobs.ts';
import { inline } from '../lib/markdown.ts';
import {
  allTasks, flowJobAsk, flowJobTitle, flowResults, flowStages, jobTarget, keptAbout, loadMode, nextTask, ownResults,
  plainStep, resultTag, saveMode, splitResults, stageProgress, STATE_LABEL, taskByKey, taskLabel, taskStatuses, targetValue,
  type FlowAsk, type FlowStage, type FlowTask, type Mode, type NewResult, type TaskStatus
} from '../lib/flow.ts';
import { parseWorkflow } from '../lib/workflow.ts';
import type { Choice } from '../lib/write-queue.ts';
import type { BookEntry, NoteRecord, VaultIndex } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { useTeam } from './Team.tsx';
import { href } from './route.ts';

type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;
export type OnResults = (book: BookEntry, list: NewResult[]) => Promise<string | null>;

const html = (md: string) => ({ __html: inline(md) });
const STAGE_ICONS = ['market', 'juice', 'people', 'cards', 'outline', 'pen'];
export const stageIcon = (i: number) => STAGE_ICONS[i] || 'list';

export interface FlowData {
  stages: FlowStage[];
  results: NoteRecord[];
  statuses: Record<string, TaskStatus>;
  /** Tasks waiting on Kyle: results to judge, or kept ones to check. */
  waiting: number;
}

/** The workflow for a book: stages and tasks, every result, and where each task stands. */
export function useFlow(index: VaultIndex | null, book: BookEntry | null): FlowData {
  const team = useTeam(index);
  const names = useMemo(() => team.members.map((m) => m.name), [team]);
  const stages = useMemo(() => flowStages(parseWorkflow(team.workflow, names)), [team.workflow, names]);
  return useMemo(() => {
    if (!index || !book) return { stages, results: [], statuses: {}, waiting: 0 };
    const results = flowResults(index, book);
    const statuses = taskStatuses(stages, results, jobNotes(index), book.folder);
    const waiting = Object.keys(statuses).filter((k) => statuses[k].state === 'judge' || statuses[k].state === 'check').length;
    return { stages, results, statuses, waiting };
  }, [index, book, stages]);
}

/** The Workflow | Writing switch. The choice is kept per book on this device. */
export function ModeSwitch({ sourceKey, index, book, waiting, compact }: { sourceKey: string; index: VaultIndex; book: BookEntry; waiting: number; compact?: boolean }) {
  const mode = loadMode(sourceKey, index, book);
  const go = (m: Mode, to: string) => (e: MouseEvent) => { e.preventDefault(); saveMode(sourceKey, book.folder, m); location.hash = to; };
  return (
    <div class={'mode-switch' + (compact ? ' compact' : '')} role="group" aria-label="Mode">
      <a href={href.flow(book.folder)} aria-current={mode === 'workflow' ? 'true' : undefined} onClick={go('workflow', href.flow(book.folder))} title="Workflow mode: the book step by step with the team">
        <Icon name="outline" size={18} /><span class="mode-label">Workflow</span>{waiting > 0 && <span class="count-badge">{waiting}</span>}
      </a>
      <a href={href.board('chapter-grid', book.folder)} aria-current={mode === 'writing' ? 'true' : undefined} onClick={go('writing', href.board('chapter-grid', book.folder))} title="Writing mode: your pages, with the team's help">
        <Icon name="pen" size={18} /><span class="mode-label">Writing</span>
      </a>
    </div>
  );
}

function StateChip({ s }: { s: TaskStatus | undefined }) {
  const state = s ? s.state : 'none';
  const n = s ? (state === 'judge' ? s.decide.length : state === 'kept' ? s.kept.length : 0) : 0;
  return <span class={'flow-chip flow-' + state}>{STATE_LABEL[state]}{n ? ' · ' + n : ''}</span>;
}

/** One result: its title, where it came from, the panel's score and line, and Kyle's buttons. */
function ResultCard({ n, waiting, onDecide, kept }: { n: NoteRecord; waiting?: Record<string, Choice>; onDecide?: OnDecide; kept?: boolean }) {
  const score = typeof n.data.panel_score === 'number' ? n.data.panel_score : parseInt(String(n.data.panel_score || ''), 10);
  const saving = waiting && waiting[n.path];
  const pitch = String(n.data.pitch || '').trim() || n.body.replace(/^#+.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const later = Array.isArray(n.data.tags) && (n.data.tags as unknown[]).map(String).indexOf('later') >= 0;
  return (
    <li class="flow-result">
      <div class="flow-result-head">
        <a class="flow-result-title" href={href.note(n.path)}>{String(n.data.title || n.data.id || 'Result')}</a>
        {isFinite(score) && score > 0 && <span class="flow-score" title={'The panel gave it ' + score + ' of 5'} aria-label={'Panel score ' + score + ' of 5'}>{'●'.repeat(Math.min(score, 5))}<span class="flow-score-off">{'●'.repeat(Math.max(0, 5 - score))}</span></span>}
      </div>
      <p class="meta">{resultTag(n)}{n.data.target ? ' · about ' + String(n.data.target).replace(/^\[\[|\]\]$/g, '') : ''}{later ? ' · Later' : ''}{saving ? ' · Saving…' : ''}</p>
      {pitch && <p class="flow-pitch">{pitch}</p>}
      {n.data.panel_note && <p class="flow-panel-note"><Icon name="eye" size={16} /> {String(n.data.panel_note)}</p>}
      {onDecide && !kept && (
        <div class="buttons">
          <button type="button" class="primary" onClick={() => onDecide(n.path, 'keep', '')}>Keep</button>
          {!later && <button type="button" onClick={() => onDecide(n.path, 'later', '')}>Later</button>}
          <button type="button" onClick={() => onDecide(n.path, 'drop', '')}>Drop</button>
        </div>
      )}
      {onDecide && kept && String(n.data.origin || '') !== 'kyle' && (
        <div class="buttons"><button type="button" class="link" onClick={() => onDecide(n.path, 'inbox', '')}>Not sure now: back to decide</button></div>
      )}
    </li>
  );
}

function Said({ said }: { said: { error: boolean; text: string } | null }) {
  return said ? <p class={said.error ? 'error' : 'flow-said'} role="status">{said.text}</p> : null;
}

// ---- Home ----

function FlowHome({ index, book, flow, sourceKey, onResults, onDecide, waiting }: {
  index: VaultIndex; book: BookEntry; flow: FlowData; sourceKey: string; onResults?: OnResults; onDecide?: OnDecide; waiting: Record<string, Choice>;
}) {
  const { stages, statuses, results } = flow;
  const next = nextTask(stages, statuses);
  const tasks = allTasks(stages);
  const wait = tasks.filter((t) => statuses[t.key] && (statuses[t.key].state === 'judge' || statuses[t.key].state === 'check'));
  const busy = tasks.filter((t) => statuses[t.key] && statuses[t.key].job);
  const own = ownResults(results, stages);
  if (!stages.length) return <p class="empty">The team's workflow (System/Workflow.md) is not in the saved copy yet. Press Sync, then try again.</p>;
  return (
    <section class="flow">
      <p class="crumb"><a href={href.series(book.seriesFolder)}>{book.seriesName}</a> · Workflow</p>
      <h1>{book.title}</h1>
      <ModeSwitch sourceKey={sourceKey} index={index} book={book} waiting={flow.waiting} />
      {next && (
        <a class="flow-next" href={href.flowStep(book.folder, next.key)}>
          <span class="flow-next-kicker">Pick up here · {taskLabel(next)}</span>
          <span class="flow-next-text" dangerouslySetInnerHTML={html(next.make.step)} />
          <span class="meta">{stages[next.stage].title}</span>
          <Icon name="right" size={22} />
        </a>
      )}
      <ol class="flow-road" aria-label="Stages">
        {stages.map((s) => {
          const p = stageProgress(s, statuses);
          return (
            <li key={s.index}>
              <a href={href.flowStage(book.folder, s.index + 1)} class={p.done === p.total && p.total ? 'done' : p.done ? 'started' : ''}>
                <span class="flow-road-num"><Icon name={stageIcon(s.index)} size={20} /></span>
                <span class="flow-road-title">{s.title}</span>
                <span class="flow-bar" aria-hidden="true"><span style={{ width: (p.total ? Math.round((100 * p.done) / p.total) : 0) + '%' }} /></span>
                <span class="meta">{p.done} of {p.total} steps kept{p.waiting ? ' · ' + p.waiting + ' waiting on you' : ''}</span>
              </a>
            </li>
          );
        })}
      </ol>
      <div class="ov-grid">
        <section class="ov-panel" aria-labelledby="flow-wait">
          <h2 id="flow-wait"><Icon name="todo" size={20} /> Waiting on you</h2>
          {!wait.length ? <p class="ov-clear"><Icon name="check" size={20} /> Nothing is waiting on you.</p> : (
            <ul class="ov-list">
              {wait.map((t) => (
                <li key={t.key}><a href={href.flowStep(book.folder, t.key)}><StateChip s={statuses[t.key]} /><span>{taskLabel(t)}: {plainStep(t.make)}</span><Icon name="right" size={18} /></a></li>
              ))}
            </ul>
          )}
        </section>
        <section class="ov-panel" aria-labelledby="flow-busy">
          <h2 id="flow-busy"><Icon name="team" size={20} /> The team is working on</h2>
          {!busy.length ? <p class="meta">Nothing right now. Open a step and press Ask the team.</p> : (
            <ul class="ov-list">
              {busy.map((t) => (
                <li key={t.key}><a href={href.flowStep(book.folder, t.key)}><span class="job-dot" aria-hidden="true" /><span>{taskLabel(t)}: {plainStep(t.make)}</span><Icon name="right" size={18} /></a></li>
              ))}
            </ul>
          )}
        </section>
        <section class="ov-panel" aria-labelledby="flow-own">
          <h2 id="flow-own"><Icon name="pen" size={20} /> Your own steps</h2>
          <p class="meta">Anything you add that the workflow has no step for. It shows in Writing mode like the rest.</p>
          {own.length > 0 && <ul class="flow-results">{own.map((n) => <ResultCard key={n.path} n={n} waiting={waiting} onDecide={onDecide} kept={String(n.data.status) === 'keep'} />)}</ul>}
          {onResults && <AddOwn index={index} book={book} onResults={onResults} askStep />}
        </section>
      </div>
    </section>
  );
}

// ---- A stage ----

function FlowStageView({ index, book, flow, n, sourceKey, onJob }: { index: VaultIndex; book: BookEntry; flow: FlowData; n: number; sourceKey: string; onJob?: OnJob }) {
  const stage = flow.stages[n - 1];
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  if (!stage) return <p class="empty">That stage is not in the workflow. <a href={href.flow(book.folder)}>Back to Workflow</a>.</p>;
  const first = stage.tasks.find((t) => { const s = flow.statuses[t.key]; return s && !s.kept.length && !s.job && !s.decide.length; });
  const ask = async () => {
    if (!onJob || !first) return;
    setSaid(await onJob({ title: flowJobTitle(first, 'make'), kind: 'workflow-step', target: jobTarget(first), book: book.folder, ask: flowJobAsk(first, 'make', '') }));
  };
  return (
    <section class="flow">
      <p class="crumb"><a href={href.flow(book.folder)}>Workflow</a> · Stage {n} of {flow.stages.length}</p>
      <h1>{stage.title}</h1>
      <ModeSwitch sourceKey={sourceKey} index={index} book={book} waiting={flow.waiting} />
      <ol class="flow-steps">
        {stage.tasks.map((t) => (
          <li key={t.key}>
            <a href={href.flowStep(book.folder, t.key)}>
              <span class="flow-step-num">{t.make.number}{t.judge ? '–' + t.judge.number : ''}</span>
              <span class="flow-step-body">
                <span class="flow-step-text" dangerouslySetInnerHTML={html(t.make.step)} />
                {t.judge && <span class="meta">then {plainStep(t.judge).replace(/^\w/, (c) => c.toLowerCase())}</span>}
                <span class="meta flow-who" dangerouslySetInnerHTML={html(t.make.who)} />
              </span>
              <StateChip s={flow.statuses[t.key]} />
              <Icon name="right" size={18} />
            </a>
          </li>
        ))}
      </ol>
      {onJob && first && (
        <div class="flow-hand">
          <button type="button" class="primary" onClick={ask}>Ask the team for {taskLabel(first).toLowerCase()}</button>
          <p class="meta">The team does one step, files what it made for you to judge, and stops.</p>
          <Said said={said} />
        </div>
      )}
      <p class="meta">The full table, with what each step needs and why, is on the <a href={href.workflow(stage.tasks.length ? stage.tasks[0].make.number : 0)}>Workflow page</a>.</p>
    </section>
  );
}

// ---- A step ----

type StepTab = 'judge' | 'kept' | 'make' | 'change';

function FlowStepView({ index, book, flow, stepKey, sourceKey, onJob, onDecide, onResults, waiting }: {
  index: VaultIndex; book: BookEntry; flow: FlowData; stepKey: string; sourceKey: string; onJob?: OnJob; onDecide?: OnDecide; onResults?: OnResults; waiting: Record<string, Choice>;
}) {
  const t = taskByKey(flow.stages, stepKey);
  const s = t ? flow.statuses[t.key] : undefined;
  const [tab, setTab] = useState<StepTab | ''>('');
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const [words, setWords] = useState('');
  if (!t || !s) return <p class="empty">That step is not in the workflow. <a href={href.flow(book.folder)}>Back to Workflow</a>.</p>;
  const shown: StepTab = tab || (s.decide.length || s.later.length ? 'judge' : s.kept.length ? 'kept' : 'make');
  const stage = flow.stages[t.stage];
  const tasks = allTasks(flow.stages);
  const at = tasks.indexOf(t);
  const prev = at > 0 ? tasks[at - 1] : null;
  const next = at + 1 < tasks.length ? tasks[at + 1] : null;
  const ask = async (kind: FlowAsk) => {
    if (!onJob) return;
    setSaid(null);
    const r = await onJob({ title: flowJobTitle(t, kind), kind: 'workflow-step', target: jobTarget(t), book: book.folder, ask: flowJobAsk(t, kind, words) });
    setSaid(r);
    if (!r.error) setWords('');
  };
  const stillFine = () => {
    if (!onDecide) return;
    const now = stamp(new Date());
    s.kept.forEach((n) => onDecide(n.path, 'edit', '', { checked: now }));
  };
  const tabs: [StepTab, string, number | null][] = [['judge', 'Judge', s.decide.length + s.later.length], ['kept', 'Kept', s.kept.length], ['make', 'Make', null], ['change', 'Change', null]];
  return (
    <section class="flow">
      <p class="crumb"><a href={href.flow(book.folder)}>Workflow</a> · <a href={href.flowStage(book.folder, t.stage + 1)}>{stage.title}</a> · {taskLabel(t)}</p>
      <h1 class="flow-step-h" dangerouslySetInnerHTML={html(t.make.step)} />
      <div class="flow-step-meta">
        <StateChip s={s} />
        <span><span class="flow-label">Who</span> <span dangerouslySetInnerHTML={html(t.make.who)} /></span>
        <span><span class="flow-label">Minds</span> <span dangerouslySetInnerHTML={html(t.make.minds)} /></span>
        {t.make.needs && <span><span class="flow-label">Needs</span> <span dangerouslySetInnerHTML={html(t.make.needs)} /></span>}
        {t.judge && <span><span class="flow-label">Judged by</span> <span dangerouslySetInnerHTML={html(t.judge.who)} /></span>}
      </div>
      {s.job && (
        <p class="flow-working"><span class="job-dot" aria-hidden="true" /> The team is on this step ({String(s.job.data.id || 'a job')}). What it makes shows under Judge. <a href={href.jobs()}>See Jobs</a></p>
      )}
      {s.state === 'check' && s.changedBy && (
        <div class="flow-check" role="status">
          <p><strong>Check:</strong> you kept something new at {taskLabel(s.changedBy).toLowerCase()} after these were kept. Do they still fit?</p>
          <div class="buttons">
            {onDecide && <button type="button" class="primary" onClick={stillFine}>Still fine</button>}
            <button type="button" onClick={() => setTab('change')}>Change them</button>
          </div>
        </div>
      )}
      <div class="tabs" role="tablist">
        {tabs.map(([k, l, c]) => (
          <button key={k} type="button" role="tab" aria-selected={shown === k} onClick={() => setTab(k)}>{l}{c != null && <span class="count">{c}</span>}</button>
        ))}
      </div>
      {shown === 'judge' && (
        <div>
          {!s.decide.length && !s.later.length ? <p class="meta">Nothing to judge. Make some results first.</p> : (
            <ul class="flow-results">
              {s.decide.concat(s.later).slice().sort((a, b) => (Number(b.data.panel_score) || 0) - (Number(a.data.panel_score) || 0)).map((n) => (
                <ResultCard key={n.path} n={n} waiting={waiting} onDecide={onDecide} />
              ))}
            </ul>
          )}
          {onJob && s.decide.length > 0 && !s.job && (
            <div class="flow-hand">
              <button type="button" onClick={() => ask('judge')}><Icon name="eye" size={18} /> Ask the team to judge</button>
              <p class="meta">{t.judge ? 'The panel in step ' + t.judge.number + ' scores each one from 1 to 5 with a line on why. You still decide.' : 'A panel scores each one from 1 to 5 with a line on why. You still decide.'}</p>
            </div>
          )}
          {s.dropped.length > 0 && (
            <details class="flow-dropped">
              <summary>Dropped ({s.dropped.length})</summary>
              <ul class="flow-results">
                {s.dropped.map((n) => (
                  <li key={n.path} class="flow-result"><a href={href.note(n.path)}>{String(n.data.title || n.data.id)}</a>
                    {onDecide && <button type="button" class="link" onClick={() => onDecide(n.path, 'inbox', '')}>Bring back</button>}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {shown === 'kept' && (
        !s.kept.length ? <p class="meta">Nothing kept yet. What you keep here is what the next steps build on, and it shows in Writing mode.</p>
          : <ul class="flow-results">{s.kept.map((n) => <ResultCard key={n.path} n={n} waiting={waiting} onDecide={onDecide} kept />)}</ul>
      )}
      {shown === 'make' && (
        <div class="flow-make">
          <section class="ov-panel">
            <h2><Icon name="team" size={20} /> Ask the team</h2>
            <p class="meta">The team runs this step as the workflow says, files each result for you to judge{t.judge ? ', and the panel scores them' : ''}.</p>
            <label class="reason">Anything to add (optional)
              <textarea rows={2} value={words} onInput={(e) => setWords((e.currentTarget as HTMLTextAreaElement).value)} />
            </label>
            <div class="buttons"><button type="button" class="primary" disabled={!onJob || Boolean(s.job)} onClick={() => ask('make')}>{s.job ? 'The team is on it' : 'Ask the team'}</button></div>
            <Said said={said} />
          </section>
          {onResults && <BringIn index={index} book={book} t={t} onResults={onResults} />}
          {onResults && <AddOwn index={index} book={book} onResults={onResults} step={String(t.make.number)} />}
        </div>
      )}
      {shown === 'change' && (
        <section class="ov-panel">
          <h2><Icon name="sync" size={20} /> Change this step's results</h2>
          <p class="meta">Say what should change. The team makes new results for you to judge; what you kept stays until you drop it.</p>
          <label class="reason">What should change
            <textarea rows={3} value={words} onInput={(e) => setWords((e.currentTarget as HTMLTextAreaElement).value)} />
          </label>
          <div class="buttons"><button type="button" class="primary" disabled={!onJob || !words.trim() || Boolean(s.job)} onClick={() => ask('change')}>Ask the team to change them</button></div>
          <Said said={said} />
          <p class="meta">To change one result yourself, open it and edit it, or write your own under Make.</p>
        </section>
      )}
      <nav class="flow-prevnext" aria-label="Steps">
        {prev ? <a class="button" href={href.flowStep(book.folder, prev.key)}><Icon name="left" size={18} /> {taskLabel(prev)}</a> : <span />}
        {next ? <a class="button" href={href.flowStep(book.folder, next.key)}>{taskLabel(next)} <Icon name="right" size={18} /></a> : <span />}
      </nav>
    </section>
  );
}

/** Characters' names and chapters, suggested for "About". */
function AboutField({ index, book, value, onInput, id }: { index: VaultIndex; book: BookEntry; value: string; onInput: (v: string) => void; id: string }) {
  const names = castFor(index, book).map((c) => c.name).filter(Boolean);
  return (
    <label class="reason">About (optional: a character, or a chapter like "Chapter 3")
      <input type="text" list={id} value={value} onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)} />
      <datalist id={id}>{names.map((n) => <option key={n} value={n} />)}</datalist>
    </label>
  );
}

/** Results made somewhere else (another chat, a document): one per paragraph, each an idea to judge. */
function BringIn({ index, book, t, onResults }: { index: VaultIndex; book: BookEntry; t: FlowTask; onResults: OnResults }) {
  const [text, setText] = useState('');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const items = splitResults(text);
  const names = castFor(index, book).map((c) => c.name);
  const go = async () => {
    setBusy(true);
    const e = await onResults(book, items.map((x) => ({ step: String(t.make.number), origin: 'brought-in', text: x, target: targetValue(about, names), status: 'inbox' })));
    setBusy(false);
    setSaid(e ? { error: true, text: e } : { error: false, text: (items.length === 1 ? '1 result' : items.length + ' results') + ' brought in. They are under Judge.' });
    if (!e) setText('');
  };
  return (
    <section class="ov-panel">
      <h2><Icon name="download" size={20} /> Bring in results</h2>
      <p class="meta">Paste results you made elsewhere. One result per paragraph, or a list with one per line. Each goes under Judge.</p>
      <label class="reason">Results
        <textarea rows={5} value={text} onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)} />
      </label>
      <AboutField index={index} book={book} value={about} onInput={setAbout} id={'about-in-' + t.key} />
      <div class="buttons"><button type="button" class="primary" disabled={busy || !items.length} onClick={go}>{busy ? 'Bringing in…' : items.length > 1 ? 'Bring in ' + items.length + ' results' : 'Bring in'}</button></div>
      <Said said={said} />
    </section>
  );
}

/** Kyle's own result, kept at once because he wrote it. With askStep, for a step of his own (by name). */
function AddOwn({ index, book, onResults, step, askStep }: { index: VaultIndex; book: BookEntry; onResults: OnResults; step?: string; askStep?: boolean }) {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const names = castFor(index, book).map((c) => c.name);
  const stepName = askStep ? name.trim() : step || '';
  const go = async () => {
    setBusy(true);
    const e = await onResults(book, [{ step: stepName, origin: 'kyle', text: text.trim(), target: targetValue(about, names), status: 'keep' }]);
    setBusy(false);
    setSaid(e ? { error: true, text: e } : { error: false, text: 'Kept. It shows in Writing mode too.' });
    if (!e) { setText(''); }
  };
  return (
    <section class={askStep ? 'flow-own-add' : 'ov-panel'}>
      {!askStep && <h2><Icon name="pen" size={20} /> Write your own</h2>}
      {askStep && (
        <label class="reason">Your step's name
          <input type="text" value={name} placeholder="Like: Villain's playlist" onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
      )}
      <label class="reason">{askStep ? 'What you decided' : 'Your result'}
        <textarea rows={3} value={text} onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)} />
      </label>
      <AboutField index={index} book={book} value={about} onInput={setAbout} id={'about-own-' + (step || 'own')} />
      <div class="buttons"><button type="button" class="primary" disabled={busy || !text.trim() || !stepName} onClick={go}>{busy ? 'Saving…' : 'Keep this'}</button></div>
      <Said said={said} />
    </section>
  );
}

/** Kept workflow results about one character, for the character's page in the codex, with a way to add a part of Kyle's own. */
export function FromTheWorkflow({ index, book, names, onResults, title }: { index: VaultIndex; book: BookEntry; names: string[]; onResults?: OnResults; title: string }) {
  const results = useMemo(() => flowResults(index, book), [index, book]);
  const kept = keptAbout(results, names);
  const [open, setOpen] = useState(false);
  return (
    <section class="flow-about">
      <h2><Icon name="outline" size={20} /> From the workflow</h2>
      {!kept.length ? <p class="meta">Nothing kept about {title} yet. Results you keep in Workflow mode that are about {title} show here.</p> : (
        <ul class="flow-kept-list">
          {kept.map((n) => (
            <li key={n.path}>
              <span class="flow-tag">{resultTag(n)}</span>
              <a href={href.note(n.path)}>{String(n.data.title || n.data.id)}</a>
              {n.data.pitch && String(n.data.pitch) !== String(n.data.title) && <span class="meta"> {String(n.data.pitch)}</span>}
            </li>
          ))}
        </ul>
      )}
      <p class="meta"><a href={href.flow(book.folder)}>Open Workflow mode</a></p>
      {onResults && (open
        ? <AddPart index={index} book={book} name={names[0] || title} onResults={onResults} onDone={() => setOpen(false)} />
        : <button type="button" onClick={() => setOpen(true)}><Icon name="plus" size={18} /> Add a part of your own</button>)}
    </section>
  );
}

function AddPart({ book, name, onResults, onDone }: { index: VaultIndex; book: BookEntry; name: string; onResults: OnResults; onDone: () => void }) {
  const [part, setPart] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true);
    const e = await onResults(book, [{ step: part.trim(), origin: 'kyle', text: text.trim(), target: '[[' + name + ']]', status: 'keep' }]);
    setBusy(false);
    if (e) setErr(e); else onDone();
  };
  return (
    <div class="flow-own-add">
      <label class="reason">What kind of part (your own step)
        <input type="text" value={part} placeholder="Like: Wound, Secret, Voice" onInput={(e) => setPart((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <label class="reason">What it is
        <textarea rows={3} value={text} onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)} />
      </label>
      {err && <p class="error">{err}</p>}
      <div class="buttons">
        <button type="button" class="primary" disabled={busy || !part.trim() || !text.trim()} onClick={go}>{busy ? 'Saving…' : 'Keep this'}</button>
        <button type="button" onClick={onDone} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}

/** Writing mode's Workflow tab beside the page: what was kept about this chapter, this scene and the people in it. */
export function FlowTab({ results, chapter, sceneId, names, flowHref, link }: {
  results: NoteRecord[]; chapter: number | null; sceneId: string; names: string[]; flowHref: string;
  link: (to: string) => { href: string; onClick: (e: MouseEvent) => void };
}) {
  const here = results.filter((n) => String(n.data.status) === 'keep');
  const forPlace = resultsOfPlace(here, chapter, sceneId);
  const byName = names.map((name) => ({ name, list: keptAbout(here, [name]) })).filter((x) => x.list.length);
  const item = (n: NoteRecord) => (
    <li key={n.path}><span class="flow-tag">{resultTag(n)}</span> <a {...link(href.note(n.path))}>{String(n.data.title || n.data.id)}</a>
      {n.data.pitch && String(n.data.pitch) !== String(n.data.title) && <span class="meta"> {String(n.data.pitch)}</span>}</li>
  );
  return (
    <div class="flow-tab">
      <h3>{chapter != null ? 'Chapter ' + chapter : 'This scene'}</h3>
      {forPlace.length ? <ul class="flow-kept-list">{forPlace.map(item)}</ul> : <p class="meta">Nothing kept for this chapter yet.</p>}
      {byName.map((x) => (
        <div key={x.name}>
          <h3>{x.name}</h3>
          <ul class="flow-kept-list">{x.list.map(item)}</ul>
        </div>
      ))}
      {!byName.length && <p class="meta">Nothing kept yet about the people named on this page.</p>}
      <p><a class="button" {...link(flowHref)}><Icon name="outline" size={18} /> Open Workflow mode</a></p>
    </div>
  );
}

function resultsOfPlace(kept: NoteRecord[], chapter: number | null, sceneId: string): NoteRecord[] {
  return kept.filter((n) => {
    const t = String(n.data.target || '').trim();
    const m = /^chapter\s+(\d+)$/i.exec(t);
    return (m && chapter != null && parseInt(m[1], 10) === chapter) || (sceneId && t === sceneId);
  });
}

/** The screen for a #/flow route. */
export function FlowScreen({ index, book, stage, step, sourceKey, onJob, onDecide, onResults, waiting }: {
  index: VaultIndex; book: BookEntry; stage: number; step: string; sourceKey: string; onJob?: OnJob; onDecide?: OnDecide; onResults?: OnResults; waiting: Record<string, Choice>;
}) {
  const flow = useFlow(index, book);
  if (step) return <FlowStepView key={step} index={index} book={book} flow={flow} stepKey={step} sourceKey={sourceKey} onJob={onJob} onDecide={onDecide} onResults={onResults} waiting={waiting} />;
  if (stage) return <FlowStageView index={index} book={book} flow={flow} n={stage} sourceKey={sourceKey} onJob={onJob} />;
  return <FlowHome index={index} book={book} flow={flow} sourceKey={sourceKey} onResults={onResults} onDecide={onDecide} waiting={waiting} />;
}

