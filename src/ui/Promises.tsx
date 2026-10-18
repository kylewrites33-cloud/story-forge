// The Promises board: each promise a lane across the book's scenes, marked where it is planted, reinforced and paid.
// Open promises always show; paid, subverted and dropped ones fold away (remembered on this device). Press a lane to
// open its note.
import { useState } from 'preact/hooks';
import { lastFifthStart, laneWarnings, promiseLanes, type PromiseLane, type PromiseMark } from '../lib/promises.ts';
import type { BookEntry, VaultIndex } from '../lib/types.ts';
import { href } from './route.ts';
import { EmptyBox } from './screens.tsx';
import { SceneHeads, SeeingHead, WarningList } from './SeeingParts.tsx';

const SHOW_KEY = 'story-forge.promises-settled';
const WORD: Record<PromiseMark, string> = { planted: 'Planted', reinforced: 'Reinforced', paid: 'Paid off' };

export function PromisesBoard({ index, book }: { index: VaultIndex; book: BookEntry }) {
  const [showSettled, setShowSettled] = useState(() => { try { return localStorage.getItem(SHOW_KEY) === '1'; } catch { return false; } });
  const { scenes, lanes } = promiseLanes(index, book);
  const settled = lanes.filter((l) => !l.open);
  const shown = lanes.filter((l) => l.open || showSettled);
  const fifth = scenes.length ? lastFifthStart(scenes.length) : 0;
  const toggle = () => { const v = !showSettled; setShowSettled(v); try { localStorage.setItem(SHOW_KEY, v ? '1' : '0'); } catch { /* this visit only */ } };

  return (
    <section class="seeing">
      <SeeingHead book={book} title="Promises" heading="Promises">
        Every promise this book makes to the reader, as a lane across its scenes. A ring is where it is planted, a dot where it is
        reinforced, a filled square where it pays off. The shaded columns are the last fifth of the book. Press a lane to open its note.
      </SeeingHead>
      {!lanes.length ? (
        <EmptyBox title="No promises yet"><p>This book has no promise notes. They appear here when the team files them in the book's Promises folder.</p></EmptyBox>
      ) : !scenes.length ? (
        <EmptyBox title="No scenes yet"><p>Promises are marked across the book's scenes, and this book has none yet.</p></EmptyBox>
      ) : (
        <>
          <WarningList list={laneWarnings(lanes, scenes)} />
          <div class="sg-key" aria-hidden="true">
            <span><i class="pm planted" /> Planted</span><span><i class="pm reinforced" /> Reinforced</span><span><i class="pm paid" /> Paid off</span>
            <span><i class="sg-key-fifth" /> Last fifth</span>
          </div>
          <div class="sg-wrap">
            <table class="sg promises">
              <SceneHeads scenes={scenes} corner="Promise" shade={(i) => i >= fifth} />
              <tbody>
                {shown.map((l) => <Lane key={l.note.path} lane={l} fifth={fifth} />)}
              </tbody>
            </table>
          </div>
          {settled.length > 0 && (
            <button type="button" class="soft sg-fold" aria-expanded={showSettled} onClick={toggle}>
              {showSettled ? 'Hide' : 'Show'} paid and dropped promises ({settled.length})
            </button>
          )}
        </>
      )}
    </section>
  );
}

function Lane({ lane, fifth }: { lane: PromiseLane; fifth: number }) {
  const marked = lane.marks.map((m) => m.length > 0);
  const first = marked.indexOf(true), last = marked.lastIndexOf(true);
  // An open promise's line runs on to the end of the book: it is still owed.
  const end = lane.open ? lane.marks.length - 1 : last;
  const open = () => { location.hash = href.note(lane.note.path); };
  const meta = [lane.kind, lane.importance != null ? 'importance ' + lane.importance : '', lane.open ? '' : lane.status].filter(Boolean).join(' · ');
  return (
    <tr class={'sg-lane' + (lane.open ? '' : ' settled') + (lane.unpaid ? ' unpaid' : '')} onClick={open}>
      <th scope="row" class="sg-side">
        <a href={href.note(lane.note.path)} onClick={(e) => e.stopPropagation()}>
          <span class="sg-name">{lane.id ? <span class="card-id">{lane.id}</span> : null} {lane.title}</span>
          {meta && <span class="sg-sub">{meta}</span>}
        </a>
      </th>
      {lane.marks.map((m, i) => {
        const span = first >= 0 && i >= first && i <= end;
        const what = m.map((x) => WORD[x]).join(', ');
        return (
          <td key={i} class={(i >= fifth ? 'shade ' : '') + (span ? 'span' + (i === first ? ' start' : '') + (i === end ? ' end' : '') + (i > last ? ' owed' : '') : '')} title={what || undefined}>
            {m.length > 0 && <span class={'pm ' + (m.indexOf('paid') >= 0 ? 'paid' : m.indexOf('planted') >= 0 ? 'planted' : 'reinforced')} />}
            {what && <span class="visually-hidden">{what}</span>}
          </td>
        );
      })}
    </tr>
  );
}
