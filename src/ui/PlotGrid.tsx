// The Plot Grid: threads (or the cast) down the side, scenes across the top. A filled square means the scene moves the
// thread; a shaded square is a gap where the thread disappears, red when the gap runs too long. A dashed square is the
// team's guess. Press a square to put the thread in the scene or take it out (only the card's `threads` line changes);
// pressing a guess confirms it.
import { useState } from 'preact/hooks';
import type { Decision } from '../lib/ideas.ts';
import { gapScenes, plotGrid, threadToggle, type GridMode, type GridRow } from '../lib/plotgrid.ts';
import type { BookEntry, NoteRecord, Schema, VaultIndex } from '../lib/types.ts';
import { href } from './route.ts';
import { EmptyBox } from './screens.tsx';
import { SceneHeads, SeeingHead, WarningList } from './SeeingParts.tsx';

const MODE_KEY = 'story-forge.plot-grid-mode';

export function PlotGridBoard({ index, book, onDecide }: {
  schema: Schema; index: VaultIndex; book: BookEntry;
  onDecide?: (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;
}) {
  const [mode, setModeState] = useState<GridMode>(() => { try { return localStorage.getItem(MODE_KEY) === 'cast' ? 'cast' : 'threads'; } catch { return 'threads'; } });
  const setMode = (m: GridMode) => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* this visit only */ } };
  const [said, setSaid] = useState('');
  const { scenes, rows } = plotGrid(index, book, mode);
  const canPress = mode === 'threads' && Boolean(onDecide);
  const flagged = rows.flatMap((r) => r.gaps.filter((g) => g.flagged).map((g) => (mode === 'threads' ? 'The thread ' : '') + r.name + ' disappears for ' + g.length + (g.length === 1 ? ' scene' : ' scenes') + ' (' + gapScenes(scenes, g) + ').'));

  const press = (row: GridRow, s: NoteRecord) => {
    if (!onDecide) return;
    const t = threadToggle(s.data, row);
    onDecide(s.path, 'edit', '', t.fields);
    const id = String(s.data.id || s.data.title || 'the scene');
    setSaid(t.action === 'confirm' ? 'Confirmed the team\'s threads for ' + id + '.' : t.action === 'add' ? row.name + ' added to ' + id + '.' : row.name + ' taken out of ' + id + '.');
  };

  return (
    <section class="seeing">
      <SeeingHead book={book} title="Plot Grid" heading="Plot Grid">
        {mode === 'threads'
          ? 'The book\'s threads down the side and its scenes across the top. A filled square means the scene moves that thread; a shaded square is where the thread disappears, red when it is gone longer than 4 scenes or 15% of the book. A dashed square is the team\'s guess. Press a square to put the thread in that scene or take it out; press a guess to confirm it.'
          : 'The cast down the side and the scenes across the top: a filled square means point of view or in the scene\'s cast. A shaded square is where the character is off stage, red when they are gone longer than 4 scenes or 15% of the book.'}
      </SeeingHead>
      <div class="seg small" role="group" aria-label="Show">
        <button type="button" aria-pressed={mode === 'threads'} onClick={() => setMode('threads')}>Threads</button>
        <button type="button" aria-pressed={mode === 'cast'} onClick={() => setMode('cast')}>Characters</button>
      </div>
      {!scenes.length || !rows.length ? (
        <EmptyBox title="Nothing to show yet">
          <p>{!scenes.length ? 'This book has no scenes yet.' : mode === 'threads' ? 'This series has no thread notes yet. They live in the series\' Threads folder (and the book\'s own).' : 'No scene names a point of view or cast yet.'}</p>
        </EmptyBox>
      ) : (
        <>
          <WarningList list={flagged} />
          <div class="sg-key" aria-hidden="true">
            <span><i class="pg-key in" /> In the scene</span><span><i class="pg-key guess" /> The team's guess</span>
            <span><i class="pg-key gap" /> Gap</span><span><i class="pg-key gap long" /> Gap too long</span>
          </div>
          <div class="sg-wrap">
            <table class="sg plot-grid">
              <SceneHeads scenes={scenes} corner={mode === 'threads' ? 'Thread' : 'Character'} />
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <th scope="row" class="sg-side">
                      <a href={href.note(r.note.path)}>
                        <span class="sg-name"><span class="name-dot" style={{ background: r.color }} />{r.name}</span>
                        <span class="sg-sub">{r.seen.filter(Boolean).length} of {scenes.length} scenes</span>
                      </a>
                    </th>
                    {scenes.map((s, i) => {
                      const gap = r.gaps.find((g) => i >= g.from && i <= g.to);
                      const cls = 'pg-cell' + (r.seen[i] ? ' in' : '') + (r.draft[i] ? ' guess' : '') + (gap ? ' gap' + (gap.flagged ? ' long' : '') : '');
                      const what = r.name + (r.seen[i] ? ' is in ' : ' is not in ') + String(s.data.id || 'this scene') + (r.draft[i] ? ' (the team\'s guess)' : '');
                      return (
                        <td key={s.path}>
                          {canPress
                            ? <button type="button" class={cls} style={{ '--row': r.color }} title={what + '. Press to ' + (r.draft[i] ? 'confirm.' : r.seen[i] ? 'take it out.' : 'put it in.')} aria-label={what} aria-pressed={r.seen[i]} onClick={() => press(r, s)} />
                            : <span class={cls} style={{ '--row': r.color }} title={what}><span class="visually-hidden">{what}</span></span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {said && <p class="meta" role="status">{said}</p>}
        </>
      )}
    </section>
  );
}
