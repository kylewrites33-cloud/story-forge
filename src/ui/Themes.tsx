// The Themes heatmap: the book's themes and motifs down the side, its chapters across. The stronger a cell, the more
// often the theme's keywords appear in that chapter's prose; a small diamond marks a chapter where a scene card links
// the theme. Press a cell to see the lines that matched.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { sceneHeader } from '../lib/format.ts';
import { heatLevel, keywordPattern, themeGrid, type ThemeRow } from '../lib/themes.ts';
import type { BookEntry, VaultIndex } from '../lib/types.ts';
import { href } from './route.ts';
import { EmptyBox } from './screens.tsx';
import { SeeingHead } from './SeeingParts.tsx';

/** A line with the theme's keywords marked. */
function Marked({ line, re }: { line: string; re: RegExp | null }) {
  if (!re) return <>{line}</>;
  const out: (string | JSX.Element)[] = [];
  let last = 0;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    out.push(line.slice(last, m.index), <mark key={m.index}>{m[0]}</mark>);
    last = m.index + m[0].length;
  }
  out.push(line.slice(last));
  return <>{out}</>;
}

export function ThemesBoard({ index, book }: { index: VaultIndex; book: BookEntry }) {
  const { chapters, rows, max } = themeGrid(index, book);
  const [picked, setPicked] = useState<{ theme: string; col: number } | null>(null);
  const row = picked ? rows.find((r) => r.name === picked.theme) : null;
  const cell = row && picked ? row.cells[picked.col] : null;
  const col = picked ? chapters[picked.col] : null;

  return (
    <section class="seeing">
      <SeeingHead book={book} title="Themes" heading="Themes">
        Where each theme and motif shows up. The darker a square, the more often the theme's keywords appear in that chapter's
        words; a diamond means a scene card in the chapter links the theme. Press a square to see the lines.
      </SeeingHead>
      {!rows.length ? (
        <EmptyBox title="No themes yet"><p>This book has no theme notes. They live in the book's Themes folder, each with keywords to look for in the prose.</p></EmptyBox>
      ) : !chapters.length ? (
        <EmptyBox title="No scenes yet"><p>This book has no scenes yet.</p></EmptyBox>
      ) : (
        <>
          <div class="sg-wrap">
            <table class="sg themes">
              <thead>
                <tr class="sg-scenes">
                  <th class="sg-side" scope="col">Theme</th>
                  {chapters.map((c) => <th key={c.key} scope="col" class="th-ch" title={c.title}>{c.num == null ? 'No ch.' : 'Ch ' + c.num}{c.title && <span class="sg-sub">{c.title}</span>}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <th scope="row" class="sg-side">
                      <a href={href.note(r.note.path)}>
                        <span class="sg-name">{r.name}</span>
                        <span class="sg-sub">{[r.kind, r.keywords.length ? r.keywords.join(', ') : 'no keywords: looks for its name'].filter(Boolean).join(' · ')}</span>
                      </a>
                    </th>
                    {r.cells.map((c, i) => {
                      const level = heatLevel(c.count, max);
                      const on = picked && picked.theme === r.name && picked.col === i;
                      const what = r.name + ' in ' + (chapters[i].num == null ? 'scenes with no chapter' : 'chapter ' + chapters[i].num) + ': ' +
                        (c.count === 1 ? '1 match' : c.count + ' matches') + (c.cards.length ? ', linked on ' + c.cards.length + (c.cards.length === 1 ? ' card' : ' cards') : '');
                      return (
                        <td key={i}>
                          <button type="button" class={'heat l' + level + (c.cards.length ? ' linked' : '')} aria-pressed={Boolean(on)} aria-label={what} title={what}
                            onClick={() => setPicked(on ? null : { theme: r.name, col: i })}>
                            <span class="heat-fill" />
                            <span class="heat-n">{c.count || ''}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class="sg-key" aria-hidden="true">
            <span><i class="heat-key l1" /> A little</span><span><i class="heat-key l4" /> A lot</span><span><i class="heat-key linked" /> Linked on a card</span>
          </div>
          {row && cell && col && <CellLines row={row} cell={cell} chapter={col.num == null ? 'scenes with no chapter' : 'chapter ' + col.num + (col.title ? ', ' + col.title : '')} onClose={() => setPicked(null)} />}
        </>
      )}
    </section>
  );
}

function CellLines({ row, cell, chapter, onClose }: { row: ThemeRow; cell: ThemeRow['cells'][number]; chapter: string; onClose: () => void }) {
  const re = keywordPattern(row.keywords.length ? row.keywords : [row.name]);
  return (
    <div class="theme-lines" role="region" aria-label={row.name + ' in ' + chapter}>
      <div class="theme-lines-head">
        <h2 class="seeing-h2">{row.name} in {chapter}</h2>
        <button type="button" class="soft" onClick={onClose}>Close</button>
      </div>
      {cell.hits.length ? (
        <ul class="seeing-list">
          {cell.hits.map((h, i) => (
            <li key={i}>
              <a href={href.write(h.scene.path)} class="card-id">{String(h.scene.data.id || '')}</a>{' '}
              <Marked line={h.line} re={re} />{h.count > 1 ? <span class="meta"> ({h.count} times)</span> : null}
            </li>
          ))}
        </ul>
      ) : <p class="meta">None of its keywords appear in this chapter's words.</p>}
      {cell.cards.length > 0 && (
        <p class="meta">Linked on {cell.cards.length === 1 ? 'the card of ' : 'the cards of '}
          {cell.cards.map((s, i) => <span key={s.path}>{i ? ', ' : ''}<a href={href.write(s.path)}>{String(s.data.id || '')} {sceneHeader(s.data)}</a></span>)}.
        </p>
      )}
    </div>
  );
}
