// How long each stage takes, and when the book will be out (Kyle, 2026-11-06: "I want us to automate this a little bit and
// for you to estimate the publishing date yourself ... number one, track how long it takes me to go through these steps.
// Number two, to be able to anticipate and guess how long it's going to take to finish each step. And number three, for me
// to systematically speed up how long it takes for me to finish these steps").
// Each of the six stages has a start and an end day on the book's note (`market_start`, `market_end` and so on). The app
// fills them in as the book moves on; Kyle can change any of them. The estimate: the stage the book is in finishes at the
// pace he has kept in it so far (or, early on, as long as it took in his other books), and every stage after it takes as
// long as it took in his other books. A stage no book has been through yet gets a first guess, and the page says so.
import type { SixStage, StageKey } from './bookstages.ts';

export const STAGE_KEYS: StageKey[] = ['market', 'planning', 'outlining', 'writing', 'editing', 'publishing'];

/** A first guess in days for a stage no book has dates for yet. Replaced by Kyle's own times once a book has them. */
export const FIRST_GUESS: Record<StageKey, number> = { market: 14, planning: 14, outlining: 14, writing: 45, editing: 30, publishing: 7 };

const DAY = 86400000;
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** A YYYY-MM-DD from a note's property (the parser may hand back a Date), or null. */
export function dayOf(v: unknown): string | null {
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v == null ? '' : v).trim();
  return isDay(s) ? s : null;
}

/** Whole days from one YYYY-MM-DD to another. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / DAY);
}

/** The day `n` days after a YYYY-MM-DD. */
export function addDays(a: string, n: number): string {
  return new Date(Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) + Math.round(n) * DAY).toISOString().slice(0, 10);
}

/** Today on this device's calendar as YYYY-MM-DD. */
export function localDay(now: Date): string {
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
}

/** `paused`: days inside the stage when the book sat waiting (`<stage>_paused`, Kyle 2026-11-06: Book 1 waited seven
 * weeks between draft 2 and the proofread while he wrote Book 2). They are taken off the days the stage took. */
export interface StageDates { start: string | null; end: string | null; paused: number }
export type BookDates = Record<StageKey, StageDates>;

/** The six stages' start and end days from a book note's properties. */
export function stageDates(data: Record<string, unknown> | null | undefined): BookDates {
  const out = {} as BookDates;
  STAGE_KEYS.forEach((k) => {
    const p = Number(data && data[k + '_paused']);
    out[k] = { start: dayOf(data && data[k + '_start']), end: dayOf(data && data[k + '_end']), paused: Number.isFinite(p) && p > 0 ? Math.round(p) : 0 };
  });
  return out;
}

/** Days a finished stage took, less its pauses (at least 1: a stage started and ended the same day still took a day), or null. */
export function took(d: StageDates): number | null {
  return d.start && d.end && d.end >= d.start ? Math.max(1, daysBetween(d.start, d.end) - d.paused) : null;
}

export interface Typical { days: number; books: number }

/** The days a finished stage added to the book's road: from the later of its own start and the end of the stage before
 * it, to its end, less its pauses. Stages can overlap (Book 1's cover work ran during editing, its outlining with its
 * planning), and only the days after the stage before was done push the publish day back. */
export function added(b: BookDates, k: StageKey): number | null {
  const d = b[k];
  if (!took(d)) return null;
  const i = STAGE_KEYS.indexOf(k);
  const prev = i > 0 ? b[STAGE_KEYS[i - 1]].end : null;
  const from = prev && prev > (d.start as string) ? prev : (d.start as string);
  const paused = from === d.start ? d.paused : 0;
  return Math.max(1, daysBetween(from, d.end as string) - paused);
}

/** How long each stage added on average across the other books that have both dates for it. */
export function typicalDays(others: BookDates[]): Partial<Record<StageKey, Typical>> {
  const out: Partial<Record<StageKey, Typical>> = {};
  STAGE_KEYS.forEach((k) => {
    const list = others.map((b) => added(b, k)).filter((n): n is number => n != null);
    if (list.length) out[k] = { days: Math.round(list.reduce((a, b) => a + b, 0) / list.length), books: list.length };
  });
  return out;
}

export type Basis = 'done' | 'pace' | 'past' | 'guess' | 'behind';

export interface StageTime {
  key: StageKey;
  name: string;
  start: string | null;
  end: string | null;
  /** Days it sat waiting, already taken off `days`. */
  paused: number;
  /** Days it took, or has taken so far for the stage the book is in. */
  days: number | null;
  /** Days still to go for this stage (0 once it is done or the book has moved past it). */
  left: number;
  /** The day it should finish, for the stage the book is in and those after it. */
  due: string | null;
  basis: Basis;
  /** The average for this stage in Kyle's other books, if any. */
  typical: Typical | null;
  current: boolean;
}

export interface Estimate {
  /** The estimated publish day, or null for a published book. */
  date: string | null;
  stages: StageTime[];
  /** Some stage after today rests on a first guess, not on Kyle's own times. */
  guessed: boolean;
}

/** The days left in the stage the book is in: his pace so far once a tenth is done and three days have gone by, else
 * the other books' average less the days already spent (at least one day), else the first guess. */
function leftInCurrent(percent: number, elapsed: number | null, typical: Typical | null, key: StageKey): { left: number; basis: Basis } {
  if (percent >= 100) return { left: 0, basis: 'pace' };
  if (elapsed != null && elapsed >= 3 && percent >= 10) return { left: Math.max(1, Math.round((elapsed * (100 - percent)) / percent)), basis: 'pace' };
  if (typical) return { left: Math.max(1, typical.days - (elapsed || 0)), basis: 'past' };
  return { left: Math.max(1, FIRST_GUESS[key] - (elapsed || 0)), basis: 'guess' };
}

/** Every stage's dates and days, and the publish day they add up to. */
/** The editing pass under way (Kyle's drafts: draft 1 to 2 is the developmental and line edit, 2 to 3 the proofreads,
 * 3 to 4 the final pass), with how far it has got and the day it began (`editing_pass_start`). */
export interface EditPass {
  /** The draft the pass makes: 2, 3 or 4. */
  to: number;
  /** 0 to 100, of this pass only. */
  percent: number;
  start: string | null;
  /** Days the rest of editing took in Kyle's other books after this pass's draft was done, or null if none has it. */
  after: number | null;
}

/** Days from `draft<to>_end` to `editing_end` in each other book, less the days it sat waiting, averaged; null if none. */
export function afterDraft(others: Record<string, unknown>[], to: number): number | null {
  const list: number[] = [];
  others.forEach((d) => {
    const from = dayOf(d['draft' + to + '_end']), end = dayOf(d.editing_end);
    if (!from || !end || end < from) return;
    const paused = Number(d.editing_paused) || 0;
    list.push(Math.max(1, daysBetween(from, end) - paused));
  });
  return list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null;
}

/** A first guess in days for each editing pass still to come after the current one, until a book has the dates. */
export const PASS_GUESS = 7;

/** Days left in editing while a pass is under way: this pass at the pace Kyle has kept since it began (counting the day
 * it began), then the rest of editing as it went in his other books. Measuring from the pass's own start keeps the
 * days spent on other editing work (a card pass, the Writer's rewrite) out of the pace (Kyle, 2026-11-07: "Why is it
 * estimating Quest Decline 2's publish date as so far away?"). */
function leftInPass(pass: EditPass, today: string): { left: number; guessed: boolean } {
  const days = pass.start ? Math.max(1, daysBetween(pass.start, today) + 1) : 1;
  const p = Math.max(0, Math.min(100, pass.percent));
  const here = p >= 100 ? 0 : p > 0 ? Math.max(1, Math.round((days * (100 - p)) / p)) : PASS_GUESS;
  const later = pass.after != null ? pass.after : Math.max(0, 4 - pass.to) * PASS_GUESS;
  return { left: here + later, guessed: pass.after == null && pass.to < 4 };
}

export function estimate(six: SixStage[], dates: BookDates, others: BookDates[], today: string, pass: EditPass | null = null): Estimate {
  const typical = typicalDays(others);
  const at = six.findIndex((s) => s.current);
  let cursor = today;
  let guessed = false;
  const stages = six.map((s, i): StageTime => {
    const d = dates[s.key];
    const t = typical[s.key] || null;
    const base = { key: s.key, name: s.name, start: d.start, end: d.end, paused: d.paused, typical: t, current: s.current };
    if (at < 0 || i < at || d.end) {
      // Done, or behind the book: what it took, nothing left.
      return { ...base, days: took(d), left: 0, due: null, basis: at >= 0 && i < at && !d.end ? 'behind' : 'done' };
    }
    if (i === at) {
      const elapsed = d.start ? Math.max(0, daysBetween(d.start, today) - d.paused) : null;
      if (s.key === 'editing' && pass && pass.start) {
        const r = leftInPass(pass, today);
        if (r.guessed) guessed = true;
        cursor = addDays(cursor, r.left);
        return { ...base, days: elapsed, left: r.left, due: cursor, basis: 'pace' as Basis };
      }
      const r = leftInCurrent(s.percent, elapsed, t, s.key);
      if (r.basis === 'guess') guessed = true;
      cursor = addDays(cursor, r.left);
      return { ...base, days: elapsed, left: r.left, due: cursor, basis: r.basis };
    }
    const left = t ? t.days : FIRST_GUESS[s.key];
    if (!t) guessed = true;
    cursor = addDays(cursor, left);
    return { ...base, days: null, left, due: cursor, basis: t ? 'past' : 'guess' };
  });
  return { date: at < 0 ? null : cursor, stages, guessed };
}

/** The dates to write so the book's record keeps up by itself: the stage it is in gets today as its start if it has
 * none, every earlier stage that was started but not ended ends today, and a published book's publishing ends today.
 * Stages done outside the app with no start are left blank: nobody knows when they were. */
export function datesToRecord(six: SixStage[], dates: BookDates, published: boolean, today: string): Record<string, string> {
  const out: Record<string, string> = {};
  const at = six.findIndex((s) => s.current);
  const upTo = published ? six.length : at;
  six.forEach((s, i) => {
    const d = dates[s.key];
    if (i < upTo && d.start && !d.end) out[s.key + '_end'] = today < d.start ? d.start : today;
    if (i === at && !d.start) out[s.key + '_start'] = today;
  });
  if (published && !dates.publishing.end) out.publishing_end = today;
  return out;
}

/** "Nov 6" or "Nov 6, 2025" when it is not this year. */
export function shortDay(d: string, now: Date): string {
  const date = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return date.toLocaleDateString('en-US', date.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
