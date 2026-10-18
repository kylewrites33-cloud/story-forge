// Character Arcs (Plan): one card per character with an arc type or arc points, each a small chart from the Lie (0) to the
// Truth (10) across the book's scenes. Drag a point to change it, press an empty scene column to add one, press a point to
// remove it or nudge it. Changes are card edits through the write queue: arc_points, and arc_draft taken off.
import { useState } from 'preact/hooks';
import type { Decision } from '../lib/ideas.ts';
import { arcEdit, arcIssue, bookArcs, removePoint, setPoint, type Arc, type ArcPoint } from '../lib/arcs.ts';
import { scenePositions, storyScenes } from '../lib/tension.ts';
import type { BookEntry, VaultIndex } from '../lib/types.ts';
import type { Choice } from '../lib/write-queue.ts';
import { href } from './route.ts';
import { EmptyBox } from './screens.tsx';
import { SceneChart, type ChartPoint } from './SceneChart.tsx';

type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;

const TYPE_WORD: Record<string, string> = { positive: 'Positive arc', flat: 'Flat arc', negative: 'Negative arc (a fall)', '': 'No arc type yet' };

export function ArcsBoard({ index, book, onDecide, waiting }: { index: VaultIndex; book: BookEntry; onDecide?: OnDecide; waiting?: Record<string, Choice> }) {
  const arcs = bookArcs(index, book);
  const scenes = storyScenes(index, book);
  const spans = scenePositions(scenes);
  const columns = scenes.map((s, i) => ({ key: String(s.data.id || ''), x: spans[i].mid, title: String(s.data.headline || s.data.title || ''), label: String(parseInt(String(s.data.id || '').replace(/\D/g, ''), 10) || '') }));
  return (
    <section class="wr-page">
      <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · Character Arcs</p>
      <h1>Character Arcs</h1>
      <p class="meta">Each character's journey scene by scene, from living their Lie (0) to living the Truth (10). A positive arc should end higher than it began,
        a fall lower, and a flat arc should hold steady while the character changes others.
        {onDecide ? ' Drag a point up or down, or press an empty scene column to add one. Press a point to remove it.' : ''}</p>
      {!arcs.length
        ? <EmptyBox title="No arcs yet"><p>Give a character an arc type (positive, flat or negative) or arc points on their note, or ask the team to fill the cards.</p></EmptyBox>
        : <div class="arc-cards">{arcs.map((a) => <ArcCard key={a.name} arc={a} columns={columns} onDecide={onDecide} saving={Boolean(waiting && (waiting[a.holder.path] || (a.draftNote && waiting[a.draftNote.path])))} />)}</div>}
    </section>
  );
}

function ArcCard({ arc, columns, onDecide, saving }: { arc: Arc; columns: { key: string; x: number; title: string; label: string }[]; onDecide?: OnDecide; saving: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const ids = columns.map((c) => c.key);
  const issue = arcIssue(arc);
  const save = (points: ArcPoint[]) => { if (onDecide) arcEdit(arc, points).forEach((e) => onDecide(e.path, 'edit', '', e.fields)); };
  const xOf = (id: string) => { const c = columns.find((x) => x.key === id); return c ? c.x : 100; };
  const titleOf = (id: string) => { const c = columns.find((x) => x.key === id); return c ? c.title : ''; };
  const chart: ChartPoint[] = arc.points.map((p) => ({
    key: p.id, x: xOf(p.id), y: p.value, guess: arc.draft, cls: 'arc', label: String(parseInt(p.id.replace(/\D/g, ''), 10)),
    title: p.id + (titleOf(p.id) ? ' ' + titleOf(p.id) : '') + ': ' + p.value
  }));
  const first = arc.points[0], last = arc.points[arc.points.length - 1];
  const sel = arc.points.find((p) => p.id === picked) || null;
  const style = arc.color ? { '--arc': arc.color } : undefined;
  return (
    <article class={'arc-card' + (arc.draft ? ' draft' : '')} style={style}>
      <header class="arc-head">
        <h2><a href={href.note(arc.note.path)}>{arc.name}</a></h2>
        <span class="meta">{TYPE_WORD[arc.type]}{arc.points.length >= 2 ? ' · ' + first.value + ' → ' + last.value : ''}</span>
      </header>
      {issue && <p class="wr-warning">{issue}</p>}
      {arc.draft && (
        <p class="meta arc-draft">The team's guess.{onDecide ? ' Drag a point to make it yours, or ' : ''}
          {onDecide && <button type="button" class="link" onClick={() => save(arc.points)}>confirm it as it is</button>}{onDecide ? '.' : ''}</p>
      )}
      <p class="arc-end truth"><span>10</span> Truth{arc.truth ? ': ' + arc.truth : ''}</p>
      <SceneChart label={arc.name + '\'s arc'} points={chart} min={0} max={10} ticks={[0, 5, 10]} height={170} minStep={26} selected={picked}
        columns={columns} onSet={onDecide ? (k, v) => save(setPoint(arc.points, k, v, ids)) : undefined}
        onAdd={onDecide ? (k, v) => { save(setPoint(arc.points, k, v, ids)); setPicked(k); } : undefined}
        onPick={(k) => setPicked(picked === k ? null : k)} />
      <p class="arc-end lie"><span>0</span> Lie{arc.lie ? ': ' + arc.lie : ''}</p>
      {!arc.points.length && <p class="meta">No points yet.{onDecide ? ' Press the chart above a scene to add the first.' : ''}</p>}
      {sel && (
        <div class="wr-panel-row wrap">
          <span><span class="card-id">{sel.id}</span> {titleOf(sel.id)}</span>
          <button type="button" disabled={!onDecide || sel.value <= 0} onClick={() => save(setPoint(arc.points, sel.id, sel.value - 1, ids))} aria-label="Lower">−</button>
          <span class="wr-value">{sel.value}</span>
          <button type="button" disabled={!onDecide || sel.value >= 10} onClick={() => save(setPoint(arc.points, sel.id, sel.value + 1, ids))} aria-label="Higher">+</button>
          <button type="button" disabled={!onDecide} onClick={() => { save(removePoint(arc.points, sel.id)); setPicked(null); }}>Remove this point</button>
        </div>
      )}
      {saving && <p class="meta">Saving…</p>}
    </article>
  );
}
