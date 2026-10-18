// The beat ruler across the top of the Chapter Grid: where each Save the Cat beat should fall by percent of the book's
// words, and where the scenes tagged with each of the book's save-the-cat beat notes land (early, on time or late).
// It folds to one line, remembered on this device, so it never crowds the iPad.
import { useState } from 'preact/hooks';
import { beatRuler, placeLabel, RULER_SOURCE, SAVE_THE_CAT, VERDICT_LABEL } from '../lib/beatruler.ts';
import type { BookEntry, VaultIndex } from '../lib/types.ts';
import { href } from './route.ts';

const KEY = 'story-forge.beat-ruler';

export function BeatRuler({ index, book }: { index: VaultIndex; book: BookEntry }) {
  const [open, setOpenState] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const setOpen = (v: boolean) => { setOpenState(v); try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* this visit only */ } };
  if (!book.scenes.length) return null;
  const beats = beatRuler(index, book);
  const off = beats.filter((b) => b.verdict === 'early' || b.verdict === 'late');
  return (
    <details class="beat-ruler" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span class="beat-ruler-title">Beat ruler</span>
        <span class="meta">{beats.length ? beats.length + ' Save the Cat ' + (beats.length === 1 ? 'beat' : 'beats') + (off.length ? ' · ' + off.length + ' off the mark' : ' · all on time') : 'No Save the Cat beat notes yet'}</span>
      </summary>
      <div class="ruler" role="img" aria-label="Where the Save the Cat beats fall in the book">
        <div class="ruler-track">
          {[0, 25, 50, 75, 100].map((p) => <span key={p} class="ruler-tick" style={{ left: p + '%' }}>{p}%</span>)}
          {SAVE_THE_CAT.filter((d) => d.from !== d.to && d.to - d.from > 2).map((d) => (
            <span key={d.id} class="ruler-span" style={{ left: d.from + '%', width: (d.to - d.from) + '%' }} title={d.name + ', ' + placeLabel(d)} />
          ))}
          {beats.map((b) => b.at && (
            <span key={b.note.path} class={'ruler-at ' + b.verdict} style={{ left: b.at.from + '%', width: Math.max(1, b.at.to - b.at.from) + '%' }} title={b.def.name + ': ' + b.scenes.join(', ') + ', ' + VERDICT_LABEL[b.verdict]} />
          ))}
          {SAVE_THE_CAT.filter((d) => d.from === d.to || d.to - d.from <= 2).map((d, i) => (
            <span key={d.id} class={'ruler-beat' + (i % 2 ? ' low' : '') + (d.to <= 3 ? ' first' : d.from >= 97 ? ' last' : '')} style={{ left: ((d.from + d.to) / 2) + '%' }} title={d.name + ', ' + placeLabel(d)}>{d.short}</span>
          ))}
        </div>
      </div>
      {beats.length > 0 && (
        <ul class="ruler-list">
          {beats.map((b) => (
            <li key={b.note.path}>
              <a href={href.note(b.note.path)}>{b.def.name}</a>
              <span class="meta"> should fall at {placeLabel(b.def)}</span>
              {b.at ? <span class="meta"> · {b.scenes.join(', ')} at {Math.round(b.at.from)}–{Math.round(b.at.to)}%</span> : null}
              <span class={'ruler-verdict ' + b.verdict}>{VERDICT_LABEL[b.verdict]}</span>
            </li>
          ))}
        </ul>
      )}
      <p class="meta ruler-source">By percent of the book's words (planned scenes count as an average scene). Sources: {RULER_SOURCE}. A scene within 3 points of its beat's place is on time.</p>
    </details>
  );
}
