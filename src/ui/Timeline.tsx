// The Timeline: the scenes in reading order across, the story day up the side. A line that drops is a flashback; a
// steep climb is a time jump. Both are said in words under the chart, and scenes with no day are listed.
import { useEffect, useRef, useState } from 'preact/hooks';
import { sceneHeader } from '../lib/format.ts';
import { timeline } from '../lib/timeline.ts';
import type { BookEntry, VaultIndex } from '../lib/types.ts';
import { href } from './route.ts';
import { EmptyBox } from './screens.tsx';
import { SeeingHead } from './SeeingParts.tsx';

const MIN_COL = 56, MAX_COL = 120, LEFT = 52, RIGHT = 20, TOP = 18, BOTTOM = 44, PLOT = 240;

/** Up to six whole-number days for the side, from min to max. */
export function dayTicks(min: number, max: number): number[] {
  if (max <= min) return [min];
  const step = Math.max(1, Math.ceil((max - min) / 5));
  const out: number[] = [];
  for (let d = Math.floor(min); d <= max; d += step) out.push(d);
  // The last day always shows; a tick just under it would print on top of it.
  if (out[out.length - 1] !== max) { if (max - out[out.length - 1] < step / 2 && out.length > 1) out.pop(); out.push(max); }
  return out;
}

export function TimelineBoard({ index, book }: { index: VaultIndex; book: BookEntry }) {
  const t = timeline(index, book);
  const box = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    setBoxWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [t.points.length > 0]);
  const n = t.scenes.length;
  // Columns widen to fill the box (up to 120 px each); past that the chart scrolls inside it.
  const col = Math.max(MIN_COL, Math.min(MAX_COL, Math.floor((boxWidth - LEFT - RIGHT) / Math.max(1, n))));
  const width = LEFT + n * col + RIGHT, height = TOP + PLOT + BOTTOM;
  const x = (i: number) => LEFT + i * col + col / 2;
  const y = (d: number) => TOP + (t.max === t.min ? PLOT / 2 : ((t.max - d) / (t.max - t.min)) * PLOT);
  const kindAt = (i: number) => t.events.find((e) => e.point === t.points[i]);

  return (
    <section class="seeing">
      <SeeingHead book={book} title="Timeline" heading="Timeline">
        The scenes in reading order across, and the story day each happens on up the side (the card's Day). Where the line drops,
        the story goes back in time; where it climbs steeply, it jumps ahead. Press a point to open the scene.
      </SeeingHead>
      {!n ? (
        <EmptyBox title="No scenes yet"><p>This book has no scenes yet.</p></EmptyBox>
      ) : !t.points.length ? (
        <EmptyBox title="No days yet"><p>No scene card has a Day yet. Give each scene the story day it happens on (day 1 is the first), or ask the team to fill the cards in.</p></EmptyBox>
      ) : (
        <>
          <div class="sg-wrap tl-wrap" ref={box}>
            <svg class="tl" width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label={'Story day by scene for ' + book.title}>
              {dayTicks(t.min, t.max).map((d) => (
                <g key={d}>
                  <line class="tl-grid" x1={LEFT} x2={width - RIGHT} y1={y(d)} y2={y(d)} />
                  <text class="tl-day" x={LEFT - 8} y={y(d) + 4} text-anchor="end">{'Day ' + d}</text>
                </g>
              ))}
              {t.points.slice(1).map((p, i) => {
                const prev = t.points[i], e = kindAt(i + 1);
                return <line key={p.scene.path} class={'tl-seg' + (e ? ' ' + e.kind : '')} x1={x(prev.at)} y1={y(prev.day)} x2={x(p.at)} y2={y(p.day)} />;
              })}
              {t.scenes.map((s, i) => (
                <text key={s.path} class="tl-scene" x={x(i)} y={TOP + PLOT + 28} text-anchor="middle">{String(s.data.id || i + 1).replace(/^S-0*/, '')}</text>
              ))}
              {t.missing.map((s) => {
                const i = t.scenes.indexOf(s);
                return (
                  <a key={s.path} href={href.write(s.path)} aria-label={String(s.data.id || '') + ' has no day'}>
                    <title>{String(s.data.id || '') + ': no day yet'}</title>
                    <circle class="tl-hit" cx={x(i)} cy={TOP + PLOT + 10} r={20} />
                    <circle class="tl-missing" cx={x(i)} cy={TOP + PLOT + 10} r={5} />
                  </a>
                );
              })}
              {t.points.map((p, i) => {
                const e = kindAt(i);
                return (
                  <a key={p.scene.path} href={href.write(p.scene.path)} aria-label={String(p.scene.data.id || '') + ', day ' + p.day}>
                    <title>{String(p.scene.data.id || '') + ' · Day ' + p.day + ': ' + sceneHeader(p.scene.data)}</title>
                    <circle class="tl-hit" cx={x(p.at)} cy={y(p.day)} r={22} />
                    <circle class={'tl-point' + (e ? ' ' + e.kind : '')} cx={x(p.at)} cy={y(p.day)} r={7} />
                  </a>
                );
              })}
            </svg>
          </div>
          <div class="sg-key" aria-hidden="true">
            <span><i class="tl-key" /> Forward in time</span><span><i class="tl-key flashback" /> Flashback</span>
            <span><i class="tl-key jump" /> Time jump</span><span><i class="tl-key missing" /> No day yet</span>
          </div>
          <h2 class="seeing-h2">What stands out</h2>
          {t.events.length ? (
            <ul class="seeing-list">
              {t.events.map((e) => (
                <li key={e.point.scene.path} class={e.kind}>
                  <span class={'seeing-tag ' + e.kind}>{e.kind === 'flashback' ? 'Flashback' : 'Time jump'}</span>{' '}
                  <a href={href.write(e.point.scene.path)}>{e.text}</a>
                </li>
              ))}
            </ul>
          ) : <p class="meta">No flashbacks or time jumps: the story moves forward a little at a time.</p>}
          {t.missing.length > 0 && (
            <>
              <h2 class="seeing-h2">No day yet ({t.missing.length})</h2>
              <ul class="seeing-list">
                {t.missing.map((s) => <li key={s.path}><a href={href.write(s.path)}><span class="card-id">{String(s.data.id || '')}</span> {sceneHeader(s.data)}</a></li>)}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
