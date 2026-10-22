// A book's Overview (Writers Room's book page, Kyle 2026-10-18): the stage strip, the one next step as a big button, words
// against the target and scenes by status, what is waiting on Kyle, warnings from every check, and the Release runway.
// The stage strip also sits at the top of the Chapter Grid.
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
import { BookPath } from './Flow.tsx';
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

export function OverviewPage({ schema, index, book, sourceKey, onJob, onDecide, keep }: {
  schema: Schema; index: VaultIndex; book: BookEntry; sourceKey: string; onJob?: OnJob; onDecide?: OnDecide;
  /** The scene to keep writing, shown as the big button at the top of Home. */
  keep?: { to: string; title: string; where: string } | null;
}) {
  const [seen, setSeen] = useState(() => loadSeenJobs(sourceKey));
  const nums = bookNumbers(schema, index, book);
  const waiting = waitingOnKyle(index, book, seen);
  const warnings = bookWarnings(index, book.folder);
  const run = runway(index, book);
  const note = bookNote(index, book);
  const save = note && onDecide && !note.error ? (key: string) => (v: string) => onDecide(note.path, 'edit', '', { [key]: v }) : null;
  const jobs = finishedJobs(index, book).filter((j) => seen.indexOf(j.path) < 0);
  return (
    <section class="overview">
      <p class="crumb"><a href={href.series(book.seriesFolder)}>{book.seriesName}</a> · Home</p>
      <h1>{book.title}</h1>
      {keep && (
        <a class="hero-card" href={keep.to}>
          <span class="hero-text">
            <small>Keep writing</small>
            <b>{keep.title}</b>
            <span>{keep.where}</span>
          </span>
          <span class="hero-go"><Icon name="pen" size={20} /> Open</span>
        </a>
      )}
      <BookPath index={index} book={book} />
      <NextStepCard schema={schema} index={index} book={book} onJob={onJob} onDecide={onDecide} />
      <div class="ov-grid">
        <section class="ov-panel" aria-labelledby="ov-words">
          <h2 id="ov-words"><Icon name="pen" size={20} /> Words</h2>
          <p class="ov-big">{nums.words.toLocaleString('en-US')}<span class="meta">{nums.target ? ' of ' + nums.target.toLocaleString('en-US') + ' words' : ' words'}</span></p>
          {nums.target != null && (
            <div class="ov-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={nums.percent} aria-label="Words against the target">
              <span style={{ width: nums.percent + '%' }} />
            </div>
          )}
          <NumberSetting label="Target" value={nums.target} unit="words" onSave={save ? save('target_words') : undefined} />
          <ul class="ov-status">
            {nums.counts.map((c) => (
              <li key={c.status} class={'st-' + c.status.replace(/[^a-z-]/gi, '')}><span class="ov-count">{c.count}</span> {c.status}</li>
            ))}
          </ul>
          <p class="meta">{nums.scenes === 1 ? '1 scene' : nums.scenes + ' scenes'}. <a href={href.book(book.folder)}>Open the Chapter Grid</a></p>
        </section>

        <section class="ov-panel" aria-labelledby="ov-wait">
          <h2 id="ov-wait"><Icon name="todo" size={20} /> Waiting on you</h2>
          {waiting.some((w) => w.key === 'ideas' || w.key === 'beats' || w.key === 'conflicts') && (
            <a class="button primary decide-go" href={href.board('decide', book.folder)}>Decide one at a time</a>
          )}
          {!waiting.length ? <p class="ov-clear"><Icon name="check" size={20} /> Nothing is waiting on you.</p> : (
            <ul class="ov-list">
              {waiting.map((w) => (
                <li key={w.key}>
                  <a href={w.href}><span class="ov-count">{w.count}</span><span>{w.label.replace(/^\d+ /, '')}</span><Icon name="right" size={18} /></a>
                  {w.key === 'jobs' && (
                    <button type="button" class="link" onClick={() => setSeen(markJobsSeen(sourceKey, jobs.map((j) => j.path)))}>Mark {jobs.length === 1 ? 'it' : 'them'} as seen</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

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

        <section class="ov-panel" aria-labelledby="ov-warn">
          <h2 id="ov-warn"><Icon name="eye" size={20} /> Warnings</h2>
          {!warnings.length ? <p class="ov-clear"><Icon name="check" size={20} /> No warnings. Every check is happy with this book.</p> : (
            <ul class="ov-list ov-warnings">
              {warnings.map((w, i) => <li key={i}><a href={w.href}><span>{w.text}</span><Icon name="right" size={18} /></a></li>)}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
