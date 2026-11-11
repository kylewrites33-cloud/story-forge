import { useState } from 'preact/hooks';
import type { Decision } from '../lib/ideas.ts';
import { basename } from '../lib/links.ts';
import { render } from '../lib/markdown.ts';
import { decideQueue } from '../lib/overview.ts';
import { dueLabel, taskNotes } from '../lib/tasks.ts';
import { todoPlace } from '../lib/todos.ts';
import {
  CONTEXTS, contextIsSet, isKyles, taskContext, taskOwnerBook, taskPriority, taskStatus, todoMap, upNext,
  type BookPart, type Lane, type MapFilter
} from '../lib/todomap.ts';
import type { NoteRecord, VaultIndex } from '../lib/types.ts';
import type { Choice } from '../vault/choice.ts';
import { href } from '../app/route.ts';

type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;

const FILTER_KEY = 'story-forge.todo-map-filter';

function loadFilter(): MapFilter {
  try {
    const f = JSON.parse(localStorage.getItem(FILTER_KEY) || '{}');
    return { who: ['kyle', 'team'].indexOf(f.who) >= 0 ? f.who : '', priority: ['need', 'want'].indexOf(f.priority) >= 0 ? f.priority : '' };
  } catch {
    return { who: '', priority: '' };
  }
}

function saveFilter(f: MapFilter): void {
  try { localStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* this visit only */ }
}

/** One to-do on the map: a Done circle, the title with its marks, and, opened, its details and the other moves. */
function MapItem({ index, note, waiting, onDecide, showLane }: { index: VaultIndex; note: NoteRecord; waiting?: Choice; onDecide?: OnDecide; showLane?: boolean }) {
  const [open, setOpen] = useState(false);
  const d = note.data;
  const status = taskStatus(note);
  const want = taskPriority(note) === 'want';
  const due = dueLabel(d.due, new Date());
  const lane = taskContext(index, note);
  const book = taskOwnerBook(index, note);
  const place = todoPlace(note);
  const scenePath = book && d.scene ? book.scenes.find((p) => index.notes[p] && String(index.notes[p].data.id || '') === String(d.scene)) : undefined;
  const edit = (fields: Record<string, string>) => onDecide && onDecide(note.path, 'edit', '', fields);
  const laneLabel = (CONTEXTS.find((c) => c.key === lane) || CONTEXTS[0]).label;
  return (
    <li class={'map-item' + (status === 'doing' ? ' doing' : '') + (want ? ' want' : '')}>
      <div class="map-row">
        {onDecide && !note.error && (
          <button type="button" class="map-check" aria-label={'Done: ' + String(d.title || '')} title="Done" onClick={() => edit({ status: 'done' })}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        )}
        <button type="button" class="map-main" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span class="map-title">{String(d.title || basename(note.path))}</span>
          <span class="map-marks">
            {status === 'doing' && <span class="mark mark-doing">Doing</span>}
            {due && <span class={'mark' + (due.late ? ' mark-late' : '')}>{due.text}</span>}
            {want && <span class="mark mark-want">Want</span>}
            {place && <span class="mark">{place}</span>}
            {!isKyles(note) && <span class="mark">For {String(d.owner)}</span>}
            {showLane && <span class="mark">{laneLabel}</span>}
            {waiting && <span class={'mark' + (waiting.error ? ' mark-late' : '')}>{waiting.error ? 'Not saved' : 'Saving'}</span>}
          </span>
        </button>
      </div>
      {open && (
        <div class="map-more">
          {note.body.trim() && <div class="prose" dangerouslySetInnerHTML={{ __html: render(note.body) }} />}
          {waiting && waiting.error && <p class="error">{waiting.error}</p>}
          {onDecide && !note.error && (
            <div class="buttons">
              {status === 'doing'
                ? <button type="button" onClick={() => edit({ status: 'open' })}>Not started</button>
                : <button type="button" onClick={() => edit({ status: 'doing' })}>Start</button>}
              <button type="button" onClick={() => edit({ priority: want ? '' : 'want' })}>{want ? 'Make it a need' : 'Make it a want'}</button>
              <button type="button" onClick={() => edit({ status: 'dropped' })}>Drop</button>
            </div>
          )}
          {onDecide && !note.error && (
            <label class="map-move">Belongs in
              <select value={lane} onChange={(e) => edit({ context: (e.currentTarget as HTMLSelectElement).value })}>
                {CONTEXTS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              {!contextIsSet(note) && !book && <span class="hint">A guess from its title. Pick the right place to keep it there.</span>}
            </label>
          )}
          <p class="map-links">
            {scenePath && <a href={href.write(scenePath)}>Open the page</a>}
            <a href={href.note(note.path)}>Open the whole note</a>
            <span class="meta">{String(d.id || '')}{book ? ' · ' + book.title : ''}</span>
          </p>
        </div>
      )}
    </li>
  );
}

/** A list that shows its first few and a button for the rest. */
function ShortList({ notes, first, render: one }: { notes: NoteRecord[]; first: number; render: (n: NoteRecord) => preact.JSX.Element }) {
  const [all, setAll] = useState(false);
  const shown = all ? notes : notes.slice(0, first);
  return (
    <>
      <ul class="map-list">{shown.map(one)}</ul>
      {notes.length > first && (
        <button type="button" class="link" onClick={() => setAll(!all)}>{all ? 'Show fewer' : 'Show all ' + notes.length}</button>
      )}
    </>
  );
}

function BookBlock({ index, part, item, onDecide }: { index: VaultIndex; part: BookPart; item: (n: NoteRecord) => preact.JSX.Element; onDecide?: OnDecide }) {
  const calls = part.book ? decideQueue(index, part.book).length : 0;
  if (part.out) {
    const n = part.open.length;
    return (
      <details class="map-book map-out">
        <summary><span class="map-book-title">{part.title}</span> <span class="meta">is out · {n} old {n === 1 ? 'fix' : 'fixes'} left</span></summary>
        <p class="hint">Left over from drafting. They no longer count as open work.</p>
        {onDecide && (
          <button type="button" onClick={() => {
            if (window.confirm('Mark all ' + n + ' as done? You can reopen any of them from the List.')) {
              part.open.forEach((x) => onDecide(x.path, 'edit', '', { status: 'done' }));
            }
          }}>Mark all {n} done</button>
        )}
        <ShortList notes={part.open} first={4} render={item} />
      </details>
    );
  }
  return (
    <div class="map-book">
      <h3><span class="map-book-title">{part.title}</span> <span class="meta">{part.open.length}</span></h3>
      {calls > 0 && part.book && (
        <a class="map-calls" href={href.board('decide', part.book.folder)}>{calls === 1 ? '1 story call' : calls + ' story calls'} waiting on you</a>
      )}
      <ShortList notes={part.open} first={5} render={item} />
    </div>
  );
}

function LaneCard({ index, lane, waiting, onDecide }: { index: VaultIndex; lane: Lane; waiting: Record<string, Choice>; onDecide?: OnDecide }) {
  const item = (n: NoteRecord) => <MapItem key={n.path} index={index} note={n} waiting={waiting[n.path]} onDecide={onDecide} />;
  const writing = lane.context.key === 'writing';
  return (
    <section class="lane" id={'lane-' + lane.context.key}>
      <h2>{lane.context.label} <span class="meta">{lane.open.length}</span></h2>
      <p class="hint">{lane.context.hint}</p>
      {writing && lane.books.length
        ? lane.books.map((p) => <BookBlock key={p.title} index={index} part={p} item={item} onDecide={onDecide} />)
        : lane.open.length ? <ShortList notes={lane.open} first={6} render={item} /> : <p class="empty">Nothing here.</p>}
    </section>
  );
}

/** The summary tile for a lane: how much is open, being done and late, and a bar of what is done. */
function Tile({ lane, on, onPick }: { lane: Lane; on: boolean; onPick: () => void }) {
  const total = lane.done + lane.open.length;
  const pct = total ? Math.round((lane.done / total) * 100) : 0;
  const bits = [lane.doing ? lane.doing + ' doing' : '', lane.late ? lane.late + ' late' : '', lane.wants ? lane.wants + (lane.wants === 1 ? ' want' : ' wants') : ''].filter(Boolean);
  return (
    <button type="button" class={'tile' + (on ? ' on' : '') + (lane.late ? ' has-late' : '')} aria-pressed={on} onClick={onPick}>
      <span class="tile-label">{lane.context.label}</span>
      <span class="tile-count">{lane.open.length}</span>
      <span class="tile-bits">{bits.length ? bits.join(' · ') : lane.open.length ? 'to do' : 'clear'}</span>
      <span class="tile-bar" aria-hidden="true"><span style={{ width: pct + '%' }} /></span>
      <span class="tile-done">{lane.done} done</span>
    </button>
  );
}

/** The To-do map: every to-do in the vault, one lane per part of Kyle's work. */
export function TodoMap({ index, waiting, onDecide }: { index: VaultIndex; waiting: Record<string, Choice>; onDecide?: OnDecide }) {
  const [filter, setFilterState] = useState<MapFilter>(loadFilter);
  const [focus, setFocus] = useState('');
  const setFilter = (f: MapFilter) => { setFilterState(f); saveFilter(f); };
  const now = new Date();
  const lanes = todoMap(index, taskNotes(index), filter, now);
  const next = upNext(lanes, now);
  const open = lanes.reduce((s, l) => s + l.open.length, 0);
  const late = lanes.reduce((s, l) => s + l.late, 0);
  const shown = focus ? lanes.filter((l) => l.context.key === focus) : lanes;
  return (
    <div class="todo-map">
      <p class="meta">
        {open === 1 ? '1 thing' : open + ' things'} to do{late ? ', ' + late + ' late' : ''}. Press the tick when one is finished; press a to-do to start it, move it or make it a want.
      </p>
      <div class="map-filters">
      <div class="tabs" role="tablist" aria-label="Needs or wants">
        {([['', 'Needs and wants'], ['need', 'Needs'], ['want', 'Wants']] as const).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={filter.priority === k} onClick={() => setFilter({ ...filter, priority: k })}>{t}</button>
        ))}
      </div>
      <div class="tabs" role="tablist" aria-label="Whose">
        {([['', 'Everyone'], ['kyle', 'Yours'], ['team', 'The team\'s']] as const).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={filter.who === k} onClick={() => setFilter({ ...filter, who: k })}>{t}</button>
        ))}
      </div>
      </div>
      <div class="tiles">
        {lanes.map((l) => <Tile key={l.context.key} lane={l} on={focus === l.context.key} onPick={() => setFocus(focus === l.context.key ? '' : l.context.key)} />)}
      </div>
      {next.length > 0 && !focus && (
        <section class="lane up-next">
          <h2>Up next <span class="meta">{next.length}</span></h2>
          <p class="hint">Being done now, late, or due within a week.</p>
          <ul class="map-list">{next.map((n) => <MapItem key={n.path} index={index} note={n} waiting={waiting[n.path]} onDecide={onDecide} showLane />)}</ul>
        </section>
      )}
      {focus && <button type="button" class="link" onClick={() => setFocus('')}>Show every place</button>}
      <div class="lanes">
        {shown.map((l) => <LaneCard key={l.context.key} index={index} lane={l} waiting={waiting} onDecide={onDecide} />)}
      </div>
    </div>
  );
}

