// A book's Overview (Writers Room's book page, Kyle 2026-10-18; made simpler 2026-11-06): the publish date, Keep writing,
// where the book is in six stages with a percent each, Progress for the stage it is in, and Waiting on you with the story
// checks' warnings folded in. The Release runway shows only once a chapter is posted or a posting pace is set.
// The stage strip lives on here for other pages; the Overview no longer shows it. The guided next step was removed
// on 2026-11-10 (it left the Overview on 2026-11-06 and nothing else used it).
import { useEffect, useState } from 'preact/hooks';
import type { Decision } from '../lib/ideas.ts';
import type { OnJob } from '../lib/jobs.ts';
import {
  bookNote, bookNumbers, bookStage, bookStages, decideQueue, runway
} from '../lib/overview.ts';
import type { BookEntry, Schema, VaultIndex } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { useFlow } from './Flow.tsx';
import { useBookStatuses } from './Home.tsx';
import type { BookStatus } from '../lib/bookstatus.ts';
import { publishLine, sixStages, type SixStage, type StageKey } from '../lib/bookstages.ts';
import { loadLog, loadTyped, loadTyping, today } from '../lib/pomodoro.ts';
import { href } from './route.ts';
import { afterDraft, datesToRecord, dayOf, daysBetween, estimate, localDay, shortDay, stageDates, type EditPass, type Estimate } from '../lib/stagetimes.ts';

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

/** The team's estimate of the publish day, from how long each stage has taken (lib/stagetimes.ts), above Kyle's own date. */
function EstimatedDate({ est }: { est: Estimate }) {
  if (!est.date) return null;
  return (
    <p class="ov-pubdate ov-estimate">
      <Icon name="upload" size={18} /> <span>Estimated publish date: <b>{publishLine(est.date, new Date())}</b></span>
    </p>
  );
}

/** Stage dates already written this session, so a page drawn again before the next sync does not write them twice. */
const recorded = new Set<string>();

/** The status line (Kyle, 2026-11-06: "Status Editing: Rewrite (Draft 2) - 6/37 chapters compete"): the stage, the pass
 * it is in, and how far, with "6 of 37" written 6/37. */
function statusLine(cur: SixStage | undefined, status: BookStatus): string {
  if (!cur) return 'Published';
  const short = (t: string) => t.replace(/(\d+) of (\d+)/g, '$1/$2').replace(/ through\b/, ' complete').replace(/ \(pass \d of 3\)$/, '');
  const m = /Draft (\d+) to (\d+)/.exec(status.stage);
  if (cur.key === 'editing' && m && (status.phase === 'rewrite' || status.phase === 'changes')) {
    return 'Editing: ' + (status.phase === 'rewrite' ? 'Rewrite' : 'Changes') + ' (Draft ' + m[2] + ') · ' + short(status.detail);
  }
  return cur.name + ': ' + short(cur.detail);
}

/** Where the book is, in Kyle's six stages, each with its percent (lib/bookstages.ts). Each opens the room it lives in. */
function SixStages({ stages, folder, status, est }: { stages: SixStage[]; folder: string; status: BookStatus; est: Estimate }) {
  const due = est.stages.find((t) => t.current)?.due || null;
  const to: Record<StageKey, string> = {
    market: href.board('market', folder), planning: href.flow(folder), outlining: href.board('beat-sheet', folder),
    writing: href.book(folder), editing: href.board('changes', folder), publishing: href.board('details', folder)
  };
  const cur = stages.find((s) => s.current);
  return (
    <section class="book-path six-stages" aria-label="Status">
      <div class="book-path-head">
        <h2>Status</h2>
        <p class="six-status">{statusLine(cur, status)}</p>
      </div>
      <ol class="book-path-row">
        {stages.map((s) => (
          <li key={s.key} class={(s.percent >= 100 ? 'done' : s.current ? 'current' : '') + (s.elsewhere ? ' elsewhere' : '')}>
            <a href={to[s.key]} aria-current={s.current ? 'step' : undefined} title={s.detail}>
              {s.current && due && <span class="six-due">Done by {shortDay(due, new Date())}</span>}
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
  const nums = bookNumbers(schema, index, book);
  const status = useBookStatuses({ key: sourceKey }, index)(book);
  const flow = useFlow(index, book);
  const six = sixStages({ index, book, stages: flow.stages, statuses: flow.statuses, status });
  const run = runway(index, book);
  const note = bookNote(index, book);
  const save = note && onDecide && !note.error ? (key: string) => (v: string) => onDecide(note.path, 'edit', '', { [key]: v }) : null;
  const keep = status.go && keepFor ? keepFor(status.go) : null;
  const week = weekTyping(index, sourceKey, new Date());
  const dates = stageDates(note ? note.data : null);
  const others = index.books.filter((b) => b.path !== book.path).map((b) => stageDates(index.notes[b.path] ? index.notes[b.path].data : null));
  const day = localDay(new Date());
  // The editing pass under way, timed from its own first day (`editing_pass_start`, kept by the app below).
  const passM = /Draft (\d+) to (\d+)/.exec(status.stage);
  const editing = (status.phase === 'rewrite' || status.phase === 'changes') && passM;
  const passSame = note && String(note.data.editing_pass || '') === status.stage;
  const otherData = index.books.filter((b) => b.path !== book.path).map((b) => (index.notes[b.path] ? index.notes[b.path].data : {}) as Record<string, unknown>);
  const pass: EditPass | null = editing && passM ? {
    to: parseInt(passM[2], 10), percent: status.percent || 0,
    start: passSame ? dayOf(note!.data.editing_pass_start) || day : day,
    after: afterDraft(otherData, parseInt(passM[2], 10))
  } : null;
  const est = estimate(six, dates, others, day, pass);
  // Keep the record up by itself: the stage the book is in gets a start day, finished stages an end day.
  const toWrite = datesToRecord(six, dates, status.phase === 'published', day);
  // A new editing pass: note its name and first day, and the day the previous pass's draft was finished.
  if (editing && note && !passSame) {
    toWrite.editing_pass = status.stage;
    toWrite.editing_pass_start = day;
    const was = /Draft (\d+) to (\d+)/.exec(String(note.data.editing_pass || ''));
    if (was && parseInt(was[2], 10) < parseInt(passM![2], 10)) toWrite['draft' + was[2] + '_end'] = day;
  }
  // The estimate goes on the book note too, so the team and the Chief of Staff see it, when it moves by more than three days.
  const saved = note ? dayOf(note.data.publish_estimate) : null;
  if (est.date && (!saved || Math.abs(daysBetween(saved, est.date)) > 3)) toWrite.publish_estimate = est.date;
  const writeKey = book.path + ' ' + Object.keys(toWrite).sort().join(',');
  useEffect(() => {
    if (!note || note.error || !onDecide || !Object.keys(toWrite).length || recorded.has(writeKey)) return;
    recorded.add(writeKey);
    onDecide(note.path, 'edit', '', toWrite);
  }, [writeKey]);
  return (
    <section class="overview">
      <p class="crumb"><a href={href.series(book.seriesFolder)}>{book.seriesName}</a> · Home</p>
      <h1>{book.title}</h1>
      <EstimatedDate est={est} />
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
      <SixStages stages={six} folder={book.folder} status={status} est={est} />
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

        <section class="ov-panel ov-wait-small" aria-labelledby="ov-wait">
          <h2 id="ov-wait"><Icon name="todo" size={20} /> Waiting on you</h2>
          {decideQueue(index, book).length
            ? <a class="button primary decide-go" href={href.board('decide', book.folder)}>Decide one at a time</a>
            : <p class="ov-clear"><Icon name="check" size={20} /> Nothing to decide right now.</p>}
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
