// The Matrix, as Novelcrafter calls it: who is in which scene. Scenes run down the page in reading order, the cast
// (or places, or items and lore) across, with a mark wherever they appear: point of view, on the scene's card, or only
// named in the text. Under it, each one's first and last scene and their longest absence.
import { useMemo, useState } from 'preact/hooks';
import { sceneHeader } from '../lib/format.ts';
import { chapterGroups } from '../lib/board.ts';
import { codexFor, longestGap, matcher, presence, present, type CodexEntry, type Presence } from '../lib/codex.ts';
import { toNumber } from '../lib/links.ts';
import { plannedNotNamed } from '../lib/codexnow.ts';
import type { BookEntry, NoteRecord, Schema, VaultIndex } from '../lib/types.ts';
import { href } from './route.ts';
import { EmptyBox } from './screens.tsx';

type Show = 'character' | 'place' | 'other';
const SHOW: [Show, string][] = [['character', 'Characters'], ['place', 'Places'], ['other', 'Items and lore']];

function loadShow(): Show {
  try { const v = localStorage.getItem('story-forge.matrix-show'); return v === 'place' || v === 'other' ? v : 'character'; } catch { return 'character'; }
}

export function MatrixBoard({ schema, index, book }: { schema: Schema; index: VaultIndex; book: BookEntry }) {
  const [show, setShow] = useState<Show>(loadShow);
  const scenes = book.scenes.map((p) => index.notes[p]).filter((n): n is NoteRecord => Boolean(n) && n.data.kind !== 'test');
  const codex = codexFor(index, book);
  const m = useMemo(() => matcher(codex), [index, book.folder]);
  const cols = codex.filter((e) => (show === 'other' ? e.type === 'item' || e.type === 'lore' : e.type === show));
  const grid: Presence[][] = scenes.map((s) => cols.map((e) => presence(s, e, m)));
  const counts = cols.map((_, j) => grid.filter((r) => present(r[j])).length);
  const order = cols.map((_, j) => j).sort((a, b) => counts[b] - counts[a] || cols[a].name.localeCompare(cols[b].name));
  const groups = chapterGroups(schema, scenes);
  const chapters = scenes.map((s) => toNumber(s.data.chapter));
  // Red squares: a character on a scene's card (point of view or cast) whom its prose never names.
  const red: boolean[][] = scenes.map((s, i) => cols.map((e, j) => plannedNotNamed(s, e.type, grid[i][j])));
  const redCount = red.reduce((n, r) => n + r.filter(Boolean).length, 0);
  const gaps = order.map((j) => ({ e: cols[j], gap: longestGap(chapters, grid.map((r) => present(r[j]))) })).filter((x) => x.gap && x.gap.length >= 3)
    .sort((a, b) => b.gap!.length - a.gap!.length);

  return (
    <section>
      <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · Matrix</p>
      <h1>Who is in which scene</h1>
      <p class="meta">Every scene of {book.title} down the side, and who appears in it across the top. A full dot means point of view or on the scene's card; a light dot means only named in the text. A red square means on the card of a written scene but never named in its prose. Press a scene to write it, or a name to open its note.</p>
      <div class="seg small" role="group" aria-label="Show">
        {SHOW.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={show === k} onClick={() => { setShow(k); try { localStorage.setItem('story-forge.matrix-show', k); } catch { /* lasts until reload */ } }}>{l}</button>
        ))}
      </div>
      {!scenes.length || !cols.length ? (
        <EmptyBox title="Nothing to show yet"><p>{!scenes.length ? 'This book has no scenes yet.' : 'This series has no ' + (show === 'character' ? 'characters' : show === 'place' ? 'places' : 'items or lore') + ' yet.'}</p></EmptyBox>
      ) : (
        <>
          {redCount > 0 && <p class="meta matrix-red-line"><span class="red-key" aria-hidden="true" />{redCount === 1 ? '1 square is' : redCount + ' squares are'} red: planned on the card, never named in the prose.</p>}
          {gaps.length > 0 && (
            <p class="meta matrix-gaps">Longest absences: {gaps.slice(0, 5).map((g) => g.e.name + ' (chapters ' + g.gap!.from + (g.gap!.to !== g.gap!.from ? '–' + g.gap!.to : '') + ')').join(', ')}.</p>
          )}
          <div class="matrix-wrap">
            <table class="matrix">
              <thead>
                <tr>
                  <th class="corner" scope="col">Scene</th>
                  {order.map((j) => (
                    <th key={cols[j].name} scope="col" class="who"><a href={href.note(cols[j].note.path)} title={cols[j].name + ': in ' + counts[j] + ' scenes'}>
                      <span class="name-dot" style={{ background: cols[j].color }} /><span class="who-name">{cols[j].name}</span>
                    </a></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => [
                  <tr key={'h' + g.key} class="matrix-chapter"><th colSpan={order.length + 1} scope="rowgroup">{g.num != null ? 'Chapter ' + g.num + (g.title ? ': ' + g.title : '') : 'No chapter yet'}</th></tr>,
                  ...g.scenes.map((s) => {
                    const i = scenes.indexOf(s);
                    return (
                      <tr key={s.path}>
                        <th scope="row" class="scene-cell"><a href={href.write(s.path)}><span class="card-id">{String(s.data.id || '')}</span> {sceneHeader(s.data)}</a></th>
                        {order.map((j) => <Cell key={j} p={grid[i][j]} e={cols[j]} red={red[i][j]} />)}
                      </tr>
                    );
                  })
                ])}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Cell({ p, e, red }: { p: Presence; e: CodexEntry; red?: boolean }) {
  if (!present(p)) return <td />;
  const what = [p.pov ? 'point of view' : '', p.card ? 'on the card' : '', p.named ? 'named ' + (p.named === 1 ? 'once' : p.named + ' times') : '', red ? 'never named in the prose' : ''].filter(Boolean).join(', ');
  return (
    <td title={e.name + ': ' + what} class={red ? 'missing' : undefined}>
      <span class={'dot-mark' + (p.pov || p.card ? ' full' : '') + (p.pov ? ' pov' : '')} style={{ '--name': e.color }} />
      <span class="visually-hidden">{what}</span>
    </td>
  );
}
