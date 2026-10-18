// Tension and Pacing (Review): each scene's tension in reading order over a reference curve, coloured by how the scene
// turns out, with the three warnings; a second tab draws the mood line and the story shape it is closest to. Drag a point
// to change a scene's tension or mood; press one to set its outcome and open the scene. Writes go through the write queue
// as card edits (front matter only) and take the field off the scene's card_draft.
import { useState } from 'preact/hooks';
import { chapterGroups } from '../lib/board.ts';
import type { Decision } from '../lib/ideas.ts';
import {
  confirmFields, OUTCOME_LABEL, OUTCOMES, REFERENCE_NAME, referenceAt, scenePoints, SHAPE_SOURCE, SHAPES, smooth, storyScenes, storyShape,
  tensionIssues, type Outcome, type ScenePoint
} from '../lib/tension.ts';
import type { BookEntry, Schema, VaultIndex } from '../lib/types.ts';
import type { Choice } from '../lib/write-queue.ts';
import { href } from './route.ts';
import { EmptyBox } from './screens.tsx';
import { SceneChart, type ChartPoint } from './SceneChart.tsx';

type Tab = 'tension' | 'mood';
type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;

function loadTab(): Tab {
  try { return localStorage.getItem('story-forge.tension-tab') === 'mood' ? 'mood' : 'tension'; } catch { return 'tension'; }
}

const num = (id: string) => String(parseInt(id.replace(/\D/g, ''), 10) || id);

export function TensionBoard({ schema, index, book, onDecide, waiting }: {
  schema: Schema; index: VaultIndex; book: BookEntry; onDecide?: OnDecide; waiting?: Record<string, Choice>;
}) {
  const [tab, setTabState] = useState<Tab>(loadTab);
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem('story-forge.tension-tab', t); } catch { /* this visit only */ } };
  const [picked, setPicked] = useState<string | null>(null);
  const scenes = storyScenes(index, book);
  const points = scenePoints(scenes);
  const byPath = new Map(scenes.map((s) => [s.path, s]));
  const marks = chapterGroups(schema, scenes).filter((g) => g.num != null && g.scenes.length).map((g) => {
    const i = scenes.indexOf(g.scenes[0]);
    return { x: points[i].span.start, label: 'Ch ' + g.num };
  });
  const set = (path: string, values: Record<string, string>) => {
    const s = byPath.get(path);
    if (s && onDecide) onDecide(path, 'edit', '', confirmFields(s.data, values));
  };
  const sel = points.find((p) => p.path === picked) || null;

  if (!scenes.length) {
    return (
      <section>
        <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · Tension and Pacing</p>
        <h1>Tension and Pacing</h1>
        <EmptyBox title="Nothing to show yet"><p>This book has no scenes yet.</p></EmptyBox>
      </section>
    );
  }
  return (
    <section class="wr-page">
      <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · Tension and Pacing</p>
      <h1>Tension and Pacing</h1>
      <div class="seg small" role="group" aria-label="Show">
        <button type="button" aria-pressed={tab === 'tension'} onClick={() => setTab('tension')}>Tension</button>
        <button type="button" aria-pressed={tab === 'mood'} onClick={() => setTab('mood')}>Mood and shape</button>
      </div>
      {tab === 'tension'
        ? <TensionTab points={points} marks={marks} picked={picked} setPicked={setPicked} onSet={onDecide ? set : undefined} />
        : <MoodTab points={points} marks={marks} picked={picked} setPicked={setPicked} onSet={onDecide ? set : undefined} />}
      {sel && <ScenePanel point={sel} tab={tab} onSet={onDecide ? set : undefined} saving={Boolean(waiting && waiting[sel.path])} onClose={() => setPicked(null)} />}
    </section>
  );
}

type TabProps = {
  points: ScenePoint[]; marks: { x: number; label: string }[]; picked: string | null; setPicked: (p: string | null) => void;
  onSet?: (path: string, values: Record<string, string>) => void;
};

function TensionTab({ points, marks, picked, setPicked, onSet }: TabProps) {
  const issues = tensionIssues(points);
  const filled = points.filter((p) => p.tension != null).length;
  const guesses = points.filter((p) => p.tension != null && p.guess.tension).length;
  const chart: ChartPoint[] = points.map((p) => ({
    key: p.path, x: p.span.mid, y: p.tension, guess: p.guess.tension,
    cls: 'out-' + (p.outcome || 'none') + (p.guess.outcome ? ' out-guess' : ''), label: num(p.id),
    title: p.id + ' ' + p.title + (p.tension != null ? ': tension ' + p.tension : '') + (p.outcome ? ', ' + OUTCOME_LABEL[p.outcome].toLowerCase() : '') + (p.guess.tension ? ' (the team\'s guess)' : '')
  }));
  return (
    <>
      <p class="meta">Each scene's tension, 1 to 10, in reading order. The soft wide line is a reference: {REFERENCE_NAME}. It is a rough guide, not a rule.
        {onSet ? ' Drag a point up or down to change a scene. Press one to set how it turns out, or to open it.' : ''}</p>
      {issues.length > 0 && (
        <ul class="wr-warnings" aria-label="Warnings">
          {issues.map((i) => <li key={i.kind + i.scenes[0]}>{i.text}</li>)}
        </ul>
      )}
      <SceneChart label="Tension by scene" points={chart} min={1} max={10} ticks={[1, 4, 7, 10]} reference={referenceAt} marks={marks}
        selected={picked} onSet={onSet ? (k, v) => onSet(k, { tension: String(v) }) : undefined} onPick={setPicked} />
      <p class="chart-key" aria-label="What the colours mean">
        {OUTCOMES.map((o) => <span key={o}><i class={'out-' + o} />{OUTCOME_LABEL[o]}</span>)}
        <span><i class="out-none" />No outcome</span>
        <span><i class="key-guess" />The team's guess</span>
        <span><i class="key-ref" />Reference</span>
      </p>
      <p class="meta">{filled} of {points.length} scenes have a tension{guesses ? '; ' + guesses + (guesses === 1 ? ' is' : ' are') + ' the team\'s guess until you change or confirm it' : ''}.
        {filled < points.length ? ' Scenes with none sit on the floor of the chart; drag one up to give it a value.' : ''}</p>
    </>
  );
}

function MoodTab({ points, marks, picked, setPicked, onSet }: TabProps) {
  const withM = points.filter((p) => p.mood != null);
  const smoothed = smooth(withM.map((p) => p.mood as number)).map((y, i) => ({ x: withM[i].span.mid, y }));
  const shape = storyShape(points);
  const chart: ChartPoint[] = points.map((p) => ({
    key: p.path, x: p.span.mid, y: p.mood, guess: p.guess.mood, cls: 'mood', label: num(p.id),
    title: p.id + ' ' + p.title + (p.mood != null ? ': mood ' + p.mood : '') + (p.guess.mood ? ' (the team\'s guess)' : '')
  }));
  const best = shape[0];
  return (
    <>
      <p class="meta">How each scene feels, from -5 (dark) to 5 (bright). The soft line smooths it over three scenes; that line is what is compared with the six shapes.
        {onSet ? ' Drag a point to change a scene\'s mood.' : ''}</p>
      <SceneChart label="Mood by scene" points={chart} min={-5} max={5} ticks={[-5, 0, 5]} under={smoothed} marks={marks}
        selected={picked} onSet={onSet ? (k, v) => onSet(k, { mood: String(v) }) : undefined} onPick={setPicked} />
      <h2>Story shape</h2>
      {best
        ? <p>Closest to <strong>{best.name}</strong> ({best.says}), a match of {Math.round(best.score * 100)}%.{shape[1] && shape[1].score > 0.5 ? ' Next: ' + shape[1].name + ' (' + Math.round(shape[1].score * 100) + '%).' : ''}</p>
        : <p class="meta">Give at least four scenes a mood, with some rise and fall, to see the book's shape.</p>}
      <ul class="shape-list">
        {SHAPES.map((s) => {
          const m = shape.find((x) => x.key === s.key);
          const d = Array.from({ length: 21 }, (_, i) => (i ? 'L' : 'M') + (i * 3) + ' ' + (13 - s.at(i / 20) * 10).toFixed(1)).join(' ');
          return (
            <li key={s.key} class={best && best.key === s.key ? 'best' : ''}>
              <svg width="60" height="26" viewBox="0 0 60 26" aria-hidden="true"><path d={d} /></svg>
              <span><strong>{s.name}</strong> <span class="meta">{s.says}</span></span>
              <span class="shape-score">{m ? Math.round(m.score * 100) + '%' : '–'}</span>
            </li>
          );
        })}
      </ul>
      <p class="meta">The six shapes: {SHAPE_SOURCE}. The match is a simple correlation of the smoothed mood line with each shape.</p>
    </>
  );
}

function ScenePanel({ point, tab, onSet, saving, onClose }: {
  point: ScenePoint; tab: Tab; onSet?: (path: string, values: Record<string, string>) => void; saving: boolean; onClose: () => void;
}) {
  const key = tab === 'mood' ? 'mood' : 'tension';
  const value = tab === 'mood' ? point.mood : point.tension;
  const [lo, hi] = tab === 'mood' ? [-5, 5] : [1, 10];
  const guesses = (['tension', 'outcome', 'mood'] as const).filter((k) => point.guess[k] && point[k] != null);
  const step = (d: number) => onSet && onSet(point.path, { [key]: String(Math.min(hi, Math.max(lo, (value ?? (tab === 'mood' ? 0 : 5)) + d))) });
  return (
    <div class="wr-panel" role="region" aria-label={'Scene ' + point.id}>
      <div class="wr-panel-head">
        <span><span class="card-id">{point.id}</span> <strong>{point.title}</strong></span>
        <button type="button" class="icon-button" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div class="wr-panel-row">
        <span class="panel-key">{tab === 'mood' ? 'Mood' : 'Tension'}</span>
        <button type="button" disabled={!onSet || (value != null && value <= lo)} onClick={() => step(-1)} aria-label="Lower">−</button>
        <span class="wr-value">{value ?? '–'}{point.guess[key] && value != null ? ' (the team\'s guess)' : ''}</span>
        <button type="button" disabled={!onSet || (value != null && value >= hi)} onClick={() => step(1)} aria-label="Higher">+</button>
      </div>
      {tab === 'tension' && (
        <div class="wr-panel-row wrap">
          <span class="panel-key">Turns out</span>
          {OUTCOMES.map((o: Outcome) => (
            <button key={o} type="button" class={'out-button out-' + o} aria-pressed={point.outcome === o} disabled={!onSet}
              onClick={() => onSet && onSet(point.path, { outcome: o })}><i />{OUTCOME_LABEL[o]}</button>
          ))}
        </div>
      )}
      {guesses.length > 0 && onSet && (
        <p class="wr-panel-row wrap">
          <span class="meta">The team guessed {guesses.join(', ')}.</span>
          <button type="button" class="soft" onClick={() => onSet(point.path, Object.fromEntries(guesses.map((k) => [k, String(point[k])])))}>Confirm the team's values</button>
        </p>
      )}
      <p class="wr-panel-row wrap">
        <a class="button" href={href.write(point.path)}>Open the scene</a>
        {saving && <span class="meta">Saving…</span>}
      </p>
    </div>
  );
}
