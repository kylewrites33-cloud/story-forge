import { useState } from 'preact/hooks';
import { timeAgo } from '../lib/format.ts';
import type { Decision } from '../lib/ideas.ts';
import { askBody, costLabel, jobGroups, jobLabel, jobNotes, jobStatusLabel, resultBody } from '../lib/jobs.ts';
import { basename } from '../lib/links.ts';
import { render } from '../lib/markdown.ts';
import type { NoteRecord, VaultIndex } from '../lib/types.ts';
import type { Choice } from '../lib/write-queue.ts';
import { Icon } from './Icon.tsx';
import { href } from './route.ts';

type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;

/** "2026-10-17T09:09" or "2026-10-17" from the vault, as "17 Oct, 09:09" or "17 Oct". */
function when(v: unknown): string {
  const s = v == null ? '' : String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
  if (!m) return s;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[4] ? Number(m[4]) : 12, m[5] ? Number(m[5]) : 0);
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return m[4] ? day + ', ' + m[4] + ':' + m[5] : day;
}

/** The short name of the book a job is for, from its book folder. */
function bookName(index: VaultIndex, folder: unknown): string {
  const f = folder == null ? '' : String(folder).replace(/\/+$/, '');
  if (!f) return '';
  const b = index.books.find((x) => x.folder === f);
  return b ? b.title : basename(f);
}

function JobCard({ index, note, waiting, onDecide }: { index: VaultIndex; note: NoteRecord; waiting?: Choice; onDecide?: OnDecide }) {
  const [open, setOpen] = useState(false);
  const d = note.data;
  const status = String(d.status || 'requested');
  const result = resultBody(note.body);
  const ask = askBody(note.body);
  const cost = costLabel(d.cost_usd);
  const book = bookName(index, d.book);
  const time = status === 'done' || status === 'failed' ? when(d.finished || d.created) : status === 'running' ? when(d.started || d.created) : when(d.created);
  const timeLine = status === 'done' ? 'Finished ' + time : status === 'failed' ? 'Stopped ' + time : status === 'running' ? 'Started ' + time : 'Asked ' + time;
  const run = typeof d.run_url === 'string' && /^https:\/\//.test(d.run_url) ? d.run_url : '';
  const canCancel = onDecide && status === 'requested' && !note.error;
  return (
    <li class={'idea job job-' + status.replace(/[^a-z]/gi, '')}>
      <span class="card-top">
        <span class="card-id">{String(d.id || '')}{book ? ' · ' + book : ''}</span>
        <span class="pills">
          {waiting && <span class={'pill' + (waiting.error ? ' pill-error' : '')}>{waiting.error ? 'Not saved' : 'Saving'}</span>}
          <span class={'pill pill-plain job-badge job-badge-' + status.replace(/[^a-z]/gi, '')}>
            {status === 'running' && <span class="job-dot" aria-hidden="true" />}
            {jobStatusLabel(status)}
          </span>
        </span>
      </span>
      <span class="card-title">{String(d.title || basename(note.path))}</span>
      <p class="job-line">{jobLabel(d.kind)}{d.target ? ' · ' + String(d.target) : ''}{d.agent ? ' · ' + String(d.agent) : ''}</p>
      <p class="job-line">{timeLine}{cost ? ' · ' + cost : ''}</p>
      {d.result && <p class="job-result">{String(d.result)}</p>}
      {waiting && waiting.error && <p class="error">{waiting.error}</p>}
      {note.error && <p class="error">Frontmatter problem: {note.error}</p>}
      <button type="button" class="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : result ? 'Read the result' : 'Read more'}</button>
      {open && (
        <div class="idea-more">
          {ask && <><p class="meta">What Kyle asked</p><div class="prose" dangerouslySetInnerHTML={{ __html: render(ask) }} /></>}
          {result && <><p class="meta">What the team said</p><div class="prose" dangerouslySetInnerHTML={{ __html: render(result) }} /></>}
          <p class="card-links">
            {run && <a href={run} target="_blank" rel="noopener"><Icon name="out" size={16} /> See the run on GitHub</a>}
            <a href={href.note(note.path)}>Open the whole note</a>
          </p>
        </div>
      )}
      {canCancel && (
        <div class="buttons">
          <button type="button" onClick={() => onDecide(note.path, 'edit', '', { status: 'cancelled' })}>Cancel</button>
        </div>
      )}
    </li>
  );
}

/** Every job Kyle asked the team for, by status. GitHub runs them and writes the results back into the notes. */
export function JobsScreen({ index, waiting, onDecide, syncing }: { index: VaultIndex; waiting: Record<string, Choice>; onDecide?: OnDecide; syncing?: boolean }) {
  const all = jobNotes(index);
  const groups = jobGroups(all);
  const busy = all.filter((n) => ['requested', 'running'].indexOf(String(n.data.status || 'requested')) >= 0).length;
  return (
    <section>
      <h1>Jobs</h1>
      <p class="meta">
        {busy === 0 ? 'Nothing is waiting on the team.' : busy === 1 ? '1 job is with the team.' : busy + ' jobs are with the team.'}
        {' '}Ask for one from a scene's Team tab or a card's ••• menu. GitHub picks it up within a few minutes; this list refreshes itself every minute while it is open{syncing ? ' (refreshing now)' : ''}.
      </p>
      {!all.length && <p class="empty">No jobs yet. They live in the vault's Jobs folder.</p>}
      {groups.map((g) => {
        if (!g.notes.length) return null;
        const list = <ul class="cards ideas">{g.notes.map((n) => <JobCard key={n.path} index={index} note={n} waiting={waiting[n.path]} onDecide={onDecide} />)}</ul>;
        const head = <>{g.label} <span class="meta">{g.notes.length}</span></>;
        // Cancelled jobs stay folded away until asked for.
        return g.key === 'cancelled'
          ? <details class="group" key={g.key}><summary><h2>{head}</h2></summary>{list}</details>
          : <section class="group" key={g.key}><h2>{head}</h2>{list}</section>;
      })}
    </section>
  );
}
