// The Cast web: who is tied to whom, one character at a time. Pick a character from the row of names (the ones on stage in
// no scene yet are tucked under their own heading); they sit in the middle with everyone tied to them in two columns,
// tensest at the top. A line is as wide as the tie is tense when the notes say. Press a name in a column to move to them,
// press the middle circle to open the character. Their ties are listed in words under the picture, and every tie in the
// book is one press further down.
import { useState } from 'preact/hooks';
import { castWeb, defaultFocus, hubFor, lineWidth } from '../lib/castweb.ts';
import type { CastWeb, WebEdge } from '../lib/castweb.ts';
import type { BookEntry, VaultIndex } from '../lib/types.ts';
import { href } from './route.ts';
import { EmptyBox } from './screens.tsx';
import { SeeingHead } from './SeeingParts.tsx';

const tenseWord = (t: number | null) => (t == null ? 'not said' : t >= 8 ? 'hostile' : t >= 5 ? 'tense' : t >= 3 ? 'uneasy' : 'calm');
const scenesWord = (n: number) => (n === 1 ? '1 scene' : n + ' scenes');
const initials = (s: string) => s.replace(/^the\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const short = (s: string) => (s.length > 20 ? s.slice(0, 19) + '…' : s);

function storedFocus(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

export function CastWebBoard({ index, book }: { index: VaultIndex; book: BookEntry }) {
  const web = castWeb(index, book);
  const { nodes, edges } = web;
  const key = 'sf-castweb-focus:' + book.folder;
  const [name, setName] = useState(() => storedFocus(key));
  const found = nodes.findIndex((n) => n.name === name);
  const focus = found >= 0 ? found : defaultFocus(web);
  const pick = (i: number) => {
    setName(nodes[i].name);
    try { localStorage.setItem(key, nodes[i].name); } catch { /* this visit only */ }
  };
  const ties = (i: number) => edges.filter((e) => e.a === i || e.b === i).length;
  const order = nodes.map((_, i) => i).sort((x, y) => nodes[y].scenes - nodes[x].scenes || nodes[x].name.localeCompare(nodes[y].name));
  const onStage = order.filter((i) => nodes[i].scenes > 0);
  const offStage = order.filter((i) => nodes[i].scenes === 0);
  const chip = (i: number) => (
    <button key={nodes[i].name} type="button" aria-pressed={i === focus} onClick={() => pick(i)}>
      <span class="cw-dot" style={{ background: nodes[i].color }} />{nodes[i].name}
      {ties(i) > 0 && <span class="cw-ties">{ties(i)}</span>}
    </button>
  );
  return (
    <section class="seeing">
      <SeeingHead book={book} title="Cast web" heading="Cast web">
        Pick a character to see who they are tied to. The ties come from each character note's relationships, tensest at the
        top{web.anyTension ? ', and a wider line is a more tense tie' : ''}. The number on a name is how many ties they have. Press a name in
        the picture to move to them, or the middle circle to open the character.
      </SeeingHead>
      {!nodes.length ? (
        <EmptyBox title="No characters yet"><p>This series has no character notes yet.</p></EmptyBox>
      ) : (
        <>
          <div class="seg small wrap cw-pick" role="group" aria-label="Pick a character">{onStage.map(chip)}</div>
          {offStage.length > 0 && (
            <details class="cw-off" open={offStage.indexOf(focus) >= 0}>
              <summary>Not on stage in any scene yet ({offStage.length})</summary>
              <div class="seg small wrap cw-pick" role="group" aria-label="Characters not on stage yet">{offStage.map(chip)}</div>
            </details>
          )}
          <Hub web={web} focus={focus} onPick={pick} />
          <h2 class="seeing-h2">{nodes[focus].name}'s ties ({ties(focus)})</h2>
          <TieList web={web} list={edges.filter((e) => e.a === focus || e.b === focus)} focus={focus} onPick={pick} />
          {edges.length > 0 && (
            <details class="cw-all">
              <summary>Every tie in the book ({edges.length})</summary>
              <TieList web={web} list={edges} focus={-1} onPick={pick} />
            </details>
          )}
          {web.unknown.length > 0 && (
            <p class="meta">Named in relationships but with no character note: {web.unknown.map((u) => u.name + ' (from ' + u.from + ')').join(', ')}.</p>
          )}
        </>
      )}
    </section>
  );
}

function Hub({ web, focus, onPick }: { web: CastWeb; focus: number; onPick: (i: number) => void }) {
  const hub = hubFor(web, focus);
  const me = web.nodes[focus];
  return (
    <div class="cw-wrap">
      <p class="cw-who">
        <strong>{me.name}</strong><span class="meta"> · on stage in {scenesWord(me.scenes)} · tied to {hub.spokes.length}</span>
        <a class="cw-open" href={href.note(me.note.path)}>Open {me.name}</a>
      </p>
      <svg class="cw" viewBox={'0 0 ' + hub.width + ' ' + hub.height} style={{ maxWidth: hub.width + 'px' }} role="img" aria-label={'Who ' + me.name + ' is tied to'}>
        {hub.spokes.map((s) => (
          <line key={'l' + s.node} class={'cw-line' + (s.edge.tension != null && s.edge.tension >= 8 ? ' hot' : '')}
            x1={hub.x} y1={hub.y} x2={s.x} y2={s.y} stroke-width={lineWidth(s.edge.tension)} />
        ))}
        {hub.spokes.map((s) => {
          const n = web.nodes[s.node];
          const left = s.side === 'left';
          const tx = left ? s.x - s.r - 10 : s.x + s.r + 10;
          return (
            <g key={s.node} class="cw-node" role="button" tabIndex={0} aria-label={'Show ' + n.name + "'s ties"}
              onClick={() => onPick(s.node)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(s.node); } }}>
              <title>{n.name + ' and ' + me.name + ': ' + tenseWord(s.edge.tension) + (s.edge.texts.length ? '. ' + s.edge.texts.join(' ') : '')}</title>
              <rect class="cw-hit" x={left ? tx - 150 : s.x - s.r - 4} y={s.y - 24} width={150 + s.r * 2 + 14} height={48} />
              <circle class="cw-circle" cx={s.x} cy={s.y} r={s.r} style={{ fill: n.color }} />
              <text class="cw-name" x={tx} y={s.y - 2} text-anchor={left ? 'end' : 'start'}>{short(n.name)}</text>
              <text class={'cw-count' + (s.edge.tension != null && s.edge.tension >= 8 ? ' hot' : '')} x={tx} y={s.y + 15} text-anchor={left ? 'end' : 'start'}>
                {(s.edge.tension != null ? tenseWord(s.edge.tension) + ' · ' : '') + scenesWord(n.scenes)}
              </text>
            </g>
          );
        })}
        <a href={href.note(me.note.path)} class="cw-node cw-me" aria-label={'Open ' + me.name}>
          <title>{'Open ' + me.name}</title>
          <circle class="cw-circle" cx={hub.x} cy={hub.y} r={hub.r} style={{ fill: me.color }} />
          <text class="cw-initials" x={hub.x} y={hub.y + 7} text-anchor="middle">{initials(me.name)}</text>
        </a>
        {!hub.spokes.length && (
          <text class="cw-count" x={hub.x} y={hub.y + hub.r + 30} text-anchor="middle">No ties in {me.name}'s note yet.</text>
        )}
      </svg>
    </div>
  );
}

function TieList({ web, list, focus, onPick }: { web: CastWeb; list: WebEdge[]; focus: number; onPick: (i: number) => void }) {
  if (!list.length) return <p class="meta">{focus >= 0 ? web.nodes[focus].name + "'s note lists no relationships, and no one else's names them." : 'No character note lists relationships yet.'}</p>;
  const who = (i: number) => <button type="button" class="linklike" onClick={() => { onPick(i); document.querySelector('.cw-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{web.nodes[i].name}</button>;
  return (
    <ul class="seeing-list">
      {list.slice().sort((x, y) => (y.tension ?? -1) - (x.tension ?? -1)).map((e, i) => (
        <li key={i}>
          <strong>{focus >= 0 ? who(e.a === focus ? e.b : e.a) : <>{who(e.a)} and {who(e.b)}</>}</strong>
          <span class="meta">: {tenseWord(e.tension)}{e.tension != null ? ' (' + e.tension + ' of 10)' : ''}</span>
          {e.texts.length > 0 && <span class="cw-said"> {e.texts.join(' ')}</span>}
        </li>
      ))}
    </ul>
  );
}
