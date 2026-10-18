// A line chart of one value per scene across the book, for Tension and Pacing, the mood line and Character Arcs.
// Points are dragged up or down with a finger or the mouse (pointer events); a press without a drag picks a point (or,
// where the chart allows it, an empty scene column). The chart is drawn in CSS pixels and scrolls sideways inside its own
// box when the book has more scenes than fit, so the page never scrolls sideways. Colours come from classes in styles.css.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface ChartPoint {
  key: string;
  /** Where the scene sits in the book, 0 to 100. */
  x: number;
  /** The value, or null when the scene has none yet (drawn as a ring on the floor of the chart). */
  y: number | null;
  /** The team's guess: drawn dashed and muted. */
  guess?: boolean;
  /** Extra class for the dot, such as an outcome colour. */
  cls?: string;
  /** A short label under the column, such as the scene number. */
  label: string;
  title: string;
}

export interface ChartProps {
  points: ChartPoint[];
  min: number;
  max: number;
  height?: number;
  /** Values to label on the left. */
  ticks: number[];
  /** A reference curve under the line, given a position 0 to 100. */
  reference?: (x: number) => number;
  /** A second line drawn under the points, such as the smoothed mood. */
  under?: { x: number; y: number }[];
  /** Thin lines where chapters start. */
  marks?: { x: number; label: string }[];
  selected?: string | null;
  /** Each column at least this wide, in pixels. */
  minStep?: number;
  /** A point dragged to a new value. */
  onSet?: (key: string, value: number) => void;
  /** A point pressed without a drag. */
  onPick?: (key: string) => void;
  /** An empty column pressed (only points with y null or charts that allow adding take this): the scene's key and the value pressed. */
  onAdd?: (key: string, value: number) => void;
  /** Columns that can take a new point, when onAdd is given: every scene of the book, by key and position. */
  columns?: { key: string; x: number; label?: string }[];
  label: string;
  children?: ComponentChildren;
}

/** The width of an element, kept up to date as it changes. */
export function useWidth<T extends HTMLElement>(): [{ current: T | null }, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const PAD = { l: 30, r: 14, t: 14, b: 26 };

export function SceneChart(p: ChartProps) {
  const [box, boxW] = useWidth<HTMLDivElement>();
  const H = p.height || 260;
  const n = Math.max(p.points.length, (p.columns || []).length, 1);
  const W = Math.max(boxW || 320, PAD.l + PAD.r + n * (p.minStep || 30));
  const xOf = (x: number) => PAD.l + (x / 100) * (W - PAD.l - PAD.r);
  const yOf = (v: number) => PAD.t + ((p.max - v) / (p.max - p.min)) * (H - PAD.t - PAD.b);
  const valueAt = (py: number) => Math.round(Math.min(p.max, Math.max(p.min, p.max - ((py - PAD.t) / (H - PAD.t - PAD.b)) * (p.max - p.min))));
  const [drag, setDrag] = useState<{ key: string; pointer: number; y0: number; moved: boolean; value: number; start: number | null } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const local = (e: PointerEvent) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const reach = Math.max(22, (W - PAD.l - PAD.r) / n / 2);
  const nearest = (x: number, y: number) => {
    let best: ChartPoint | null = null, d = Infinity;
    p.points.forEach((pt) => {
      const dx = Math.abs(xOf(pt.x) - x);
      if (dx > reach) return;
      // Within the column, a point near the finger wins; a scene with no value is picked anywhere in its column.
      const dy = pt.y == null ? 0 : Math.abs(yOf(pt.y) - y);
      if (pt.y != null && dy > 44 && p.onAdd) return;
      if (dx + dy / 4 < d) { d = dx + dy / 4; best = pt; }
    });
    return best as ChartPoint | null;
  };

  const down = (e: PointerEvent) => {
    if (!p.onSet && !p.onPick && !p.onAdd) return;
    const at = local(e);
    const pt = nearest(at.x, at.y);
    if (!pt) {
      if (!p.onAdd || !p.columns) return;
      const col = p.columns.reduce((b, c) => (Math.abs(xOf(c.x) - at.x) < Math.abs(xOf(b.x) - at.x) ? c : b), p.columns[0]);
      if (col && Math.abs(xOf(col.x) - at.x) <= reach) p.onAdd(col.key, valueAt(at.y));
      return;
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ key: pt.key, pointer: e.pointerId, y0: at.y, moved: false, value: pt.y ?? valueAt(at.y), start: pt.y });
  };
  const move = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointer !== e.pointerId || !p.onSet) return;
    const at = local(e);
    const moved = d.moved || Math.abs(at.y - d.y0) > 6;
    if (moved) setDrag({ ...d, moved, value: valueAt(at.y) });
  };
  const up = (e: PointerEvent) => {
    const d = dragRef.current;
    setDrag(null);
    if (!d || d.pointer !== e.pointerId) return;
    if (d.moved && p.onSet) { if (d.value !== d.start) p.onSet(d.key, d.value); }
    else if (p.onPick) p.onPick(d.key);
  };

  const shown = p.points.map((pt) => (drag && drag.moved && drag.key === pt.key ? { ...pt, y: drag.value, guess: false } : pt));
  const lines: { a: ChartPoint; b: ChartPoint }[] = [];
  let prev: ChartPoint | null = null;
  shown.forEach((pt) => { if (pt.y == null) return; if (prev) lines.push({ a: prev, b: pt }); prev = pt; });
  const ref = p.reference
    ? Array.from({ length: 51 }, (_, i) => i * 2).map((x, i) => (i ? 'L' : 'M') + xOf(x).toFixed(1) + ' ' + yOf(p.reference!(x)).toFixed(1)).join(' ')
    : '';
  const under = p.under && p.under.length > 1 ? p.under.map((u, i) => (i ? 'L' : 'M') + xOf(u.x).toFixed(1) + ' ' + yOf(u.y).toFixed(1)).join(' ') : '';
  const floor = H - PAD.b;
  const labelEvery = Math.max(1, Math.ceil(24 / ((W - PAD.l - PAD.r) / n)));

  return (
    <div class="scene-chart" ref={box}>
      <svg width={W} height={H} viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label={p.label}
        class={(p.onSet || p.onPick || p.onAdd ? 'can-press' : '') + (drag && drag.moved ? ' dragging' : '')}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}>
        {p.ticks.map((t) => (
          <g key={'t' + t}>
            <line class="chart-grid" x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} />
            <text class="chart-tick" x={PAD.l - 6} y={yOf(t) + 4} text-anchor="end">{t}</text>
          </g>
        ))}
        {(p.marks || []).map((m) => (
          <g key={'m' + m.x}>
            <line class="chart-mark" x1={xOf(m.x)} x2={xOf(m.x)} y1={PAD.t - 4} y2={floor} />
            <text class="chart-mark-label" x={xOf(m.x) + 3} y={PAD.t + 6}>{m.label}</text>
          </g>
        ))}
        {(p.columns || []).map((c, i) => (
          <g key={'c' + c.key}>
            <line class="chart-colline" x1={xOf(c.x)} x2={xOf(c.x)} y1={PAD.t} y2={floor} />
            {i % labelEvery === 0 && c.label && <text class={'chart-col' + (p.selected === c.key ? ' sel' : '')} x={xOf(c.x)} y={H - 8} text-anchor="middle">{c.label}</text>}
          </g>
        ))}
        {ref && <path class="chart-ref" d={ref} />}
        {under && <path class="chart-under" d={under} />}
        {lines.map(({ a, b }) => (
          <line key={a.key + b.key} class={'chart-line' + (a.guess || b.guess ? ' guess' : '')} x1={xOf(a.x)} y1={yOf(a.y as number)} x2={xOf(b.x)} y2={yOf(b.y as number)} />
        ))}
        {shown.map((pt, i) => {
          const cx = xOf(pt.x), sel = p.selected === pt.key;
          return (
            <g key={pt.key}>
              {!p.columns && (i % labelEvery === 0 || sel) && <text class={'chart-col' + (sel ? ' sel' : '')} x={cx} y={H - 8} text-anchor="middle">{pt.label}</text>}
              {pt.y == null
                ? <circle class={'chart-empty' + (sel ? ' sel' : '')} cx={cx} cy={floor - 6} r={5}><title>{pt.title + ': no value yet'}</title></circle>
                : <circle class={'chart-pt ' + (pt.cls || '') + (pt.guess ? ' guess' : '') + (sel ? ' sel' : '')} cx={cx} cy={yOf(pt.y)} r={sel ? 9 : 7}><title>{pt.title}</title></circle>}
            </g>
          );
        })}
      </svg>
      {p.children}
    </div>
  );
}
