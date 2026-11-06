// A book's Overview (Writers Room's book page, Kyle 2026-10-18; made simpler 2026-11-06): the publish date, Keep writing,
// where the book is in six stages with a percent each, Progress for the stage it is in, and Waiting on you with the story
// checks' warnings folded in. The Release runway shows only once a chapter is posted or a posting pace is set.
// The stage strip and the guided next step live on here for other pages; the Overview no longer shows them.
import { useState } from 'preact/hooks';
import type { Decision } from '../lib/ideas.ts';
import type { OnJob } from '../lib/jobs.ts';
import { nextStep, nextStepJob, type NextStep } from '../lib/nextstep.ts';
import {
  bookNote, bookNumbers, bookStage, bookStages, finishedJobs, loadSeenJobs, markJobsSeen, runway, waitingOnKyle
} from '../lib/overview.ts';
import type { BookEntry, Schema, VaultIndex } from '../lib/types.ts';
import { bookWarnings } from '../lib/warnings.ts';
import { Icon } from './Icon.tsx';
import { useFlow } from './Flow.tsx';
import { useBookStatuses } from './Home.tsx';
import { publishDate, publishLine, sixStages, type SixStage, type StageKey } from '../lib/bookstages.ts';
import { loadLog, loadTyped, loadTyping, today } from '../lib/pomodoro.ts';
import { href } from './route.ts';

type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The book's stages in a row, the current one lit. Pressing another asks first, then changes only the book's `stage`. */
export function StageStrip({ schema, index, book, onDecide }: { schema: Schema; index: VaultIndex; book: BookEntry; onDecide?: OnDecide }) {
  const stages = bookStages(schema);
  const current = bookStage(index, book);
  const at = stages.indexOf(current);
  const [asking, setAsking] = useState('');
  const note = bookNote(index, book);
  const can = Boolean(onDecide && note && !note.error);
  return (
    <div class="stage-wrap">
      <ol class="stage-strip" aria-label="Stage of the book">
        {stages.map((s, i) => {
          const cls = 'stage' + (s === current ? ' current' : i < at ? ' past' : '');
          return (
            <li key={s}>
              {can ? (
                <button type="button" class={cls} aria-current={s === current ? 'step' : undefined} aria-pressed={asking === s}
                  onClick={() => setAsking(s === current || asking === s ? '' : s)}>
                  {i < at && <Icon name="check" size={16} />}{cap(s)}
                </button>
              ) : <span class={cls} aria-current={s === current ? 'step' : undefined}>{i < at && <Icon name="check" size={16} />}{cap(s)}</span>}
            </li>
          );
        })}
      </ol>
      {asking && onDecide && note && (
        <div class="stage-confirm" role="group" aria-label="Change the stage">
          <p>Move {book.title} from {current} to <strong>{asking}</strong>? Only the book's stage changes; nothing else is touched.</p>
          <div class="buttons">
            <button type="button" class="primary" onClick={() => { onDecide(note.path, 'edit', '', { stage: asking }); setAsking(''); }}>Move to {asking}</button>
            <button type="button" onClick={() => setAsking('')}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The guided next step: one big button and a sentence of why. A team step writes a next-step job; the team stops at a gate. */
export function NextStepCard({ schema, index, book, onJob, onDecide }: { schema: Schema; index: VaultIndex; book: BookEntry; onJob?: OnJob; onDecide?: OnDecide }) {
  const step: NextStep = nextStep(schema, index, book);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const note = bookNote(index, book);
  const go = async () => {
    if (!onJob) return;
    setBusy(true);
    setSaid(null);
    const r = await onJob(nextStepJob(index, book, step));
    setBusy(false);
    setSaid(r.error ? r : { error: false, text: 'Sent. The team does this one step, then stops and waits for your yes. See Jobs.' });
  };
  let button;
  if (step.busy) {
    button = <a class="button primary next-button" href={href.jobs()}><span class="job-dot" aria-hidden="true" /> The team is on it: {step.label}</a>;
  } else if (step.action === 'link') {
    button = <a class="button primary next-button" href={step.href}>{step.label} <Icon name="right" size={20} /></a>;
  } else if (step.action === 'stage') {
    button = <button type="button" class="primary next-button" disabled={!onDecide || !note} onClick={() => setConfirm(true)}>{step.label} <Icon name="right" size={20} /></button>;
  } else {
    button = <button type="button" class="primary next-button" disabled={!onJob || busy} onClick={go}>{busy ? 'Sending…' : step.label} {!busy && <Icon name="right" size={20} />}</button>;
  }
  return (
    <section class="next-step" aria-label="Next step">
      <p class="next-kicker">Next step</p>
      {button}
      <p class="next-why">{step.busy ? 'Asked for already (' + String(step.busy.data.id || 'a job') + '). The team stops when it is done and waits for your yes.' : step.why}</p>
      {step.action === 'job' && !step.busy && <p class="hint">The team does only this step, files what it makes for you to keep or drop, and stops.{onJob ? '' : ' Asking the team needs your own vault.'}</p>}
      {confirm && note && onDecide && (
        <div class="stage-confirm">
          <p>Move {book.title} to <strong>{step.stage}</strong>? Only the book's stage changes.</p>
          <div class="buttons">
            <button type="button" class="primary" onClick={() => { onDecide(note.path, 'edit', '', { stage: step.stage }); setConfirm(false); }}>Move to {step.stage}</button>
            <button type="button" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}
      {said && <p class={said.error ? 'error' : 'ok'} role="status">{said.text}</p>}
    </section>
  );
}

/** A whole number on the book's note, shown as a line with Change: the word target, the posting pace. */
function NumberSetting({ label, value, unit, onSave }: { label: string; value: number | null; unit: string; onSave?: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(value == null ? '' : String(value));
  if (!open) {
    return (
      <p class="ov-setting">
        {label}: {value == null ? 'not set' : value.toLocaleString('en-US') + ' ' + unit}
        {onSave && <> <button type="button" class="link" onClick={() => { setV(value == null ? '' : String(value)); setOpen(true); }}>{value == null ? 'Set it' : 'Change'}</button></>}
      </p>
    );
  }
  const ok = /^\d+$/.test(v.trim()) && parseInt(v, 10) > 0;
  return (
    <form class="ov-setting-form" onSubmit={(e) => { e.preventDefault(); if (ok && onSave) { onSave(v.trim()); setOpen(false); } }}>
      <label class="reason">{label} ({unit})
        <input type="number" inputMode="numeric" min={1} step={1} value={v} onInput={(e) => setV((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <div class="buttons">
        <button type="submit" class="primary" disabled={!ok}>Save</button>
        <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/** The planned publish date under the book's title (Kyle, 2026-11-06), with Change. Written to the book's `publish_date`. */
function PublishDate({ value, onSave }: { value: string | null; onSave?: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(value || '');
  if (!open) {
    return (
      <p class="ov-pubdate">
        <Icon name="upload" size={18} /> <span>Publish date: <b>{value ? publishLine(value, new Date()) : 'not set'}</b></span>
        {onSave && <button type="button" class="link" onClick={() => { setV(value || ''); setOpen(true); }}>{value ? 'Change' : 'Set it'}</button>}
      </p>
    );
  }
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(v);
  return (
    <form class="ov-setting-form ov-pubdate-form" onSubmit={(e) => { e.preventDefault(); if (ok && onSave) { onSave(v); setOpen(false); } }}>
      <label class="reason">Publish date
        <input type="date" value={v} onInput={(e) => setV((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <div class="buttons">
        <button type="submit" class="primary" disabled={!ok}>Save</button>
        <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/** Where the book is, in Kyle's six stages, each with its percent (lib/bookstages.ts). Each opens the room it lives in. */
function SixStages({ stages, folder }: { stages: SixStage[]; folder: string }) {
  const to: Record<StageKey, string> = {
    market: href.board('market', folder), planning: href.flow(folder), outlining: href.board('beat-sheet', folder),
    writing: href.book(folder), editing: href.board('changes', folder), publishing: href.board('details', folder)
  };
  const cur = stages.find((s) => s.current);
  return (
    <section class="book-path six-stages" aria-label="Where the book is">
      <div class="book-path-head">
        <h2>Where the book is</h2>
        <p class="meta">{cur ? cur.name + ': ' + cur.detail : 'Published.'}</p>
      </div>
      <ol class="book-path-row">
        {stages.map((s) => (
          <li key={s.key} class={(s.percent >= 100 ? 'done' : s.current ? 'current' : '') + (s.elsewhere ? ' elsewhere' : '')}>
            <a href={to[s.key]} aria-current={s.current ? 'step' : undefined} title={s.detail}>
              <span class="book-path-name">{s.name}</span>
              <span class="book-path-bar"><span style={{ width: s.percent + '%' }} /></span>
              <span class="six-pct">{s.percent >= 100 && <Icon name="check" size={14} />} {s.elsewhere ? 'Done' : s.percent + '%'}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Words typed and minutes of typing over the last seven days, from the Writing Log (Kyle's own typing only). */
function weekTyping(index: VaultIndex, sourceKey: string, now: Date): { typed: number; minutes: number } {
  let typed = 0, minutes = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const day = today(index, i === 0 ? loadLog(sourceKey) : [], d, i === 0 ? loadTyped() : undefined, i === 0 ? loadTyping() : undefined);
    typed += day.typed;
    minutes += day.typing;
  }
  return { typed, minutes: Math.round(minutes) };
}

const hours = (m: number) => (m < 60 ? m + ' minutes' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min');

export function OverviewPage({ schema, index, book, sourceKey, onDecide, keepFor }: {
  schema: Schema; index: VaultIndex; book: BookEntry; sourceKey: string; onJob?: OnJob; onDecide?: OnDecide;
  /** The words for the big button: the chapter's name and where in it, for a scene's path. */
  keepFor?: (path: string) => { title: string; where: string } | null;
}) {
  const [seen, setSeen] = useState(() => loadSeenJobs(sourceKey));
  const [showWarnings, setShowWarnings] = useState(false);
  const nums = bookNumbers(schema, index, book);
  const status = useBookStatuses({ key: sourceKey }, index)(book);
  const flow = useFlow(index, book);
  const six = sixStages({ index, book, stages: flow.stages, statuses: flow.statuses, status });
  const waiting = waitingOnKyle(index, book, seen);
  const warnings = bookWarnings(index, book.folder);
  const run = runway(index, book);
  const note = bookNote(index, book);
  const save = note && onDecide && !note.error ? (key: string) => (v: string) => onDecide(note.path, 'edit', '', { [key]: v }) : null;
  const jobs = finishedJobs(index, book).filter((j) => seen.indexOf(j.path) < 0);
  const keep = status.go && keepFor ? keepFor(status.go) : null;
  const week = weekTyping(index, sourceKey, new Date());
  const decide = waiting.some((w) => w.key === 'ideas' || w.key === 'beats' || w.key === 'conflicts');
  return (
    <section class="overview">
      <p class="crumb"><a href={href.series(book.seriesFolder)}>{book.seriesName}</a> · Home</p>
      <h1>{book.title}</h1>
      <PublishDate value={publishDate(note)} onSave={save ? save('publish_date') : undefined} />
      {status.go && keep ? (
        <a class="hero-card" href={href.write(status.go)}>
          <span class="hero-text">
            <small>{status.goLabel}</small>
            <b>{keep.title}</b>
            <span>{keep.where}</span>
          </span>
          <span class="hero-go"><Icon name="pen" size={20} /> Open</span>
        </a>
      ) : status.phase === 'planning' ? (
        <a class="hero-card" href={href.flow(book.folder)}>
          <span class="hero-text"><small>Keep planning</small><b>{status.stage}</b><span>{status.detail || 'The workflow, step by step'}</span></span>
          <span class="hero-go"><Icon name="right" size={20} /> Open</span>
        </a>
      ) : null}
      <SixStages stages={six} folder={book.folder} />
      <div class="ov-grid">
        <section class="ov-panel" aria-labelledby="ov-words">
          <h2 id="ov-words"><Icon name="pen" size={20} /> Progress</h2>
          <p class="ov-stage">{status.stage}{status.percent != null && status.phase !== 'published' ? <span class="ov-stage-pct"> · {status.percent}% done</span> : null}</p>
          {status.percent != null && (
            <div class="ov-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.percent} aria-label={status.stage}>
              <span style={{ width: status.percent + '%' }} />
            </div>
          )}
          {status.detail && <p class="meta ov-stage-detail">{status.detail}</p>}
          <ul class="ov-facts">
            <li><span class="ov-count">{nums.words.toLocaleString('en-US')}</span> words in the book</li>
            <li><span class="ov-count">{nums.chapters}</span> {nums.chapters === 1 ? 'chapter' : 'chapters'}</li>
            <li><span class="ov-count">{week.typed.toLocaleString('en-US')}</span> words you typed in the last 7 days{week.minutes ? ', in ' + hours(week.minutes) + ' of typing' : ''}</li>
          </ul>
          <NumberSetting label="Target" value={nums.target} unit="words" onSave={save ? save('target_words') : undefined} />
          <p class="meta"><a href={href.book(book.folder)}>Open the Chapter Grid</a></p>
        </section>

        <section class="ov-panel" aria-labelledby="ov-wait">
          <h2 id="ov-wait"><Icon name="todo" size={20} /> Waiting on you</h2>
          {decide && <a class="button primary decide-go" href={href.board('decide', book.folder)}>Decide one at a time</a>}
          {!waiting.length && !warnings.length ? <p class="ov-clear"><Icon name="check" size={20} /> Nothing is waiting on you.</p> : (
            <ul class="ov-list">
              {waiting.map((w) => (
                <li key={w.key}>
                  <a href={w.href}><span class="ov-count">{w.count}</span><span>{w.label.replace(/^\d+ /, '')}</span><Icon name="right" size={18} /></a>
                  {w.key === 'jobs' && (
                    <button type="button" class="link" onClick={() => setSeen(markJobsSeen(sourceKey, jobs.map((j) => j.path)))}>Mark {jobs.length === 1 ? 'it' : 'them'} as seen</button>
                  )}
                </li>
              ))}
              {warnings.length > 0 && (
                <li>
                  <button type="button" class="ov-warn-row" aria-expanded={showWarnings} onClick={() => setShowWarnings(!showWarnings)}>
                    <span class="ov-count">{warnings.length}</span><span>{warnings.length === 1 ? 'warning from the story checks' : 'warnings from the story checks'}</span><Icon name={showWarnings ? 'up' : 'down'} size={18} />
                  </button>
                  {showWarnings && (
                    <ul class="ov-list ov-warnings">
                      {warnings.map((w, i) => <li key={i}><a href={w.href}><span>{w.text}</span><Icon name="right" size={18} /></a></li>)}
                    </ul>
                  )}
                </li>
              )}
            </ul>
          )}
        </section>

        {(run.posted > 0 || run.cadence != null) && (
          <section class={'ov-panel ov-runway' + (run.low ? ' low' : '')} aria-labelledby="ov-run">
            <h2 id="ov-run"><Icon name="upload" size={20} /> Release runway</h2>
            <div class="ov-stats">
              <div><span class="ov-big">{run.posted}</span><span class="meta">{run.posted === 1 ? 'chapter posted' : 'chapters posted'}</span></div>
              <div><span class="ov-big">{run.ready}</span><span class="meta">{run.ready === 1 ? 'chapter ready' : 'chapters ready'}</span></div>
              <div class="ov-buffer"><span class="ov-big">{run.weeks == null ? '—' : run.weeks}</span><span class="meta">{run.weeks === 1 ? 'week of buffer' : 'weeks of buffer'}</span></div>
            </div>
            {run.weeks != null && run.low && <p class="ov-warn">Under two weeks of buffer. Finish {run.cadence && run.cadence * 2 - run.ready > 0 ? (run.cadence * 2 - run.ready === 1 ? '1 more chapter' : (run.cadence * 2 - run.ready) + ' more chapters') : 'more chapters'} to get back to two weeks.</p>}
            <NumberSetting label="Posting pace" value={run.cadence} unit={run.cadence === 1 ? 'chapter a week' : 'chapters a week'} onSave={save ? save('cadence') : undefined} />
            <p class="meta">
              {run.lastPosted ? 'Last posted ' + run.lastPosted + '. ' : 'Nothing posted yet. '}
              {run.nextReady ? run.nextReady + ' is next to post. ' : ''}
              A chapter is posted when a scene in it has a published date, and ready when every scene in it is final.
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
