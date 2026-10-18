// The Timeline: the book's scenes in reading order against the story day each happens on (the scene's `day`), so a
// flashback (the day goes back) and a time jump (a long gap) stand out. Scenes with no day are listed as missing.
import { toNumber } from './links.ts';
import { sceneId, storyScenes } from './seeing.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

export interface TimePoint { scene: NoteRecord; at: number; day: number }

export interface TimeEvent {
  kind: 'flashback' | 'jump';
  /** The scene where the day goes back or leaps ahead, and the dated scene before it. */
  point: TimePoint;
  prev: TimePoint;
  /** Days between them: negative for a flashback. */
  days: number;
  text: string;
}

export interface Timeline {
  scenes: NoteRecord[];
  points: TimePoint[];
  missing: NoteRecord[];
  events: TimeEvent[];
  /** The smallest and largest day, for the chart's scale. */
  min: number;
  max: number;
}

/** The usual step forward between dated scenes: the median of the steps that move on. */
function usualStep(points: TimePoint[]): number {
  const steps = points.slice(1).map((p, i) => p.day - points[i].day).filter((d) => d > 0).sort((a, b) => a - b);
  return steps.length ? steps[Math.floor(steps.length / 2)] : 1;
}

/** A time jump: more than a day ahead, and a week or more, or three times the usual step. */
export function isJump(days: number, usual: number): boolean {
  return days > 1 && (days >= 7 || days >= 3 * Math.max(1, usual));
}

const dayWord = (n: number) => (n === 1 ? '1 day' : (Number.isInteger(n) ? n : n.toFixed(1)) + ' days');
const dayLabel = (d: number) => 'day ' + (Number.isInteger(d) ? d : d.toFixed(1));

export function timeline(index: VaultIndex, book: BookEntry): Timeline {
  const scenes = storyScenes(index, book);
  const points: TimePoint[] = [];
  const missing: NoteRecord[] = [];
  scenes.forEach((s, at) => {
    const day = toNumber(s.data.day);
    if (day == null) missing.push(s);
    else points.push({ scene: s, at, day });
  });
  const usual = usualStep(points);
  const events: TimeEvent[] = [];
  for (let i = 1; i < points.length; i++) {
    const p = points[i], prev = points[i - 1], days = p.day - prev.day;
    const name = sceneId(p.scene) || String(p.scene.data.title || '');
    if (days < 0) events.push({ kind: 'flashback', point: p, prev, days, text: name + ' goes back ' + dayWord(-days) + ', to ' + dayLabel(p.day) + ', after ' + (sceneId(prev.scene) || 'the scene before') + ' on ' + dayLabel(prev.day) + '.' });
    else if (isJump(days, usual)) events.push({ kind: 'jump', point: p, prev, days, text: name + ' jumps ' + dayWord(days) + ' ahead, from ' + dayLabel(prev.day) + ' to ' + dayLabel(p.day) + '.' });
  }
  const days = points.map((p) => p.day);
  return { scenes, points, missing, events, min: days.length ? Math.min(...days) : 1, max: days.length ? Math.max(...days) : 1 };
}
