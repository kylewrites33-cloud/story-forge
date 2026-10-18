// The Cast web: who is tied to whom. Each circle is a character, as big as the number of scenes they are on stage in;
// each line is a relationship from the character notes, as wide as it is tense when the notes say. Press a circle to
// open the character. The same ties are listed in words under the picture.
import { castWeb, lineWidth } from '../lib/castweb.ts';
import type { BookEntry, VaultIndex } from '../lib/types.ts';
import { href } from './route.ts';
import { EmptyBox } from './screens.tsx';
import { SeeingHead } from './SeeingParts.tsx';

const tenseWord = (t: number | null) => (t == null ? 'the notes do not say how tense' : t >= 8 ? 'hostile' : t >= 5 ? 'tense' : t >= 3 ? 'uneasy' : 'calm');

export function CastWebBoard({ index, book }: { index: VaultIndex; book: BookEntry }) {
  const web = castWeb(index, book);
  const { nodes, edges } = web;
  return (
    <section class="seeing">
      <SeeingHead book={book} title="Cast web" heading="Cast web">
        The cast and how they are tied together. A bigger circle is on stage in more scenes (point of view, in the cast, or named in
        the words). Lines come from each character note's relationships; {web.anyTension ? 'a wider line is a more tense relationship, as the notes describe it.' : 'the notes do not say how tense any of them are, so every line is the same width.'} Press a circle to open the character.
      </SeeingHead>
      {!nodes.length ? (
        <EmptyBox title="No characters yet"><p>This series has no character notes yet.</p></EmptyBox>
      ) : (
        <>
          <div class="cw-wrap">
            <svg class="cw" viewBox={'0 0 ' + web.width + ' ' + web.height} role="img" aria-label={'How the cast of ' + book.title + ' is tied together'}>
              {edges.map((e, i) => {
                const a = nodes[e.a], b = nodes[e.b];
                return (
                  <line key={i} class={'cw-line' + (e.tension != null && e.tension >= 8 ? ' hot' : '')} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke-width={lineWidth(e.tension)}>
                    <title>{a.name + ' and ' + b.name + ': ' + tenseWord(e.tension) + (e.texts.length ? '. ' + e.texts.join(' ') : '')}</title>
                  </line>
                );
              })}
              {nodes.map((n) => (
                <a key={n.name} href={href.note(n.note.path)} class="cw-node" aria-label={n.name + ', on stage in ' + n.scenes + (n.scenes === 1 ? ' scene' : ' scenes')}>
                  <title>{n.name + ': on stage in ' + n.scenes + (n.scenes === 1 ? ' scene' : ' scenes')}</title>
                  <circle class="cw-hit" cx={n.x} cy={n.y} r={Math.max(n.r, 24)} />
                  <circle class="cw-circle" cx={n.x} cy={n.y} r={n.r} style={{ fill: n.color }} />
                  <text class="cw-name" x={n.x} y={n.y + n.r + 18} text-anchor="middle">{n.name}</text>
                  <text class="cw-count" x={n.x} y={n.y + n.r + 34} text-anchor="middle">{n.scenes === 1 ? '1 scene' : n.scenes + ' scenes'}</text>
                </a>
              ))}
            </svg>
          </div>
          <h2 class="seeing-h2">Ties ({edges.length})</h2>
          {edges.length ? (
            <ul class="seeing-list">
              {edges.slice().sort((x, y) => (y.tension ?? -1) - (x.tension ?? -1)).map((e, i) => (
                <li key={i}>
                  <strong>{nodes[e.a].name} and {nodes[e.b].name}</strong>
                  <span class="meta">: {tenseWord(e.tension)}{e.tension != null ? ' (' + e.tension + ' of 10)' : ''}</span>
                  {e.texts.length > 0 && <span class="cw-said"> {e.texts.join(' ')}</span>}
                </li>
              ))}
            </ul>
          ) : <p class="meta">No character note lists relationships yet.</p>}
          {web.unknown.length > 0 && (
            <p class="meta">Named in relationships but with no character note: {web.unknown.map((u) => u.name + ' (from ' + u.from + ')').join(', ')}.</p>
          )}
        </>
      )}
    </section>
  );
}
