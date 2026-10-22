// Tension and Pacing, from Writers Room's Story Dashboard: each scene's `tension` (1 to 10) and `outcome` (yes, yes-but,
// no, no-and) in reading order, laid over a reference curve, with three warnings. The same page draws each scene's `mood`
// (-5 to 5) and says which of the six classic emotional shapes the book is closest to. Values the team filled in and Kyle
// has not confirmed are listed in the scene's `card_draft`; they show as the team's guess until Kyle changes them.
import { toNumber } from './links.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';
import type { Warning, WarningCheck } from './warnings.ts';

export const OUTCOMES = ['yes', 'yes-but', 'no', 'no-and'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Kyle's words for each outcome. */
export const OUTCOME_LABEL: Record<Outcome, string> = { yes: 'Yes', 'yes-but': 'Yes, but', no: 'No', 'no-and': 'No, and' };

/** A book's story scenes in reading order (test drives left out). */
export function storyScenes(index: VaultIndex, book: BookEntry): NoteRecord[] {
  return book.scenes.map((p) => index.notes[p]).filter((n): n is NoteRecord => Boolean(n) && n.data.kind !== 'test');
}

/** Where each scene sits in the book, as percentages of its words: start, end and middle. A scene with no words yet counts
 * as its word target, or else as the average drafted scene (one unit when nothing is drafted), so a planned book still
 * spreads out evenly. */
export interface Span { start: number; end: number; mid: number }

export function scenePositions(scenes: NoteRecord[]): Span[] {
  const words = scenes.map((s) => Math.max(0, toNumber(s.data.words) || 0));
  const drafted = words.filter((w) => w > 0);
  const avg = drafted.length ? drafted.reduce((a, b) => a + b, 0) / drafted.length : 1;
  const weights = scenes.map((s, i) => words[i] || Math.max(0, toNumber(s.data.target_words) || 0) || avg);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let at = 0;
  return weights.map((w) => {
    const start = (at / total) * 100;
    at += w;
    const end = (at / total) * 100;
    return { start, end, mid: (start + end) / 2 };
  });
}

/** The card fields the team filled in and Kyle has not confirmed. */
export function cardDraft(data: Record<string, unknown>): string[] {
  const v = data.card_draft;
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return typeof v === 'string' && v.trim() ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
}

/** The fields an edit writes when Kyle sets some card values: the values, and card_draft without those names
 * (left alone when it does not list them, removed when it ends up empty). */
export function confirmFields(data: Record<string, unknown>, values: Record<string, string>): Record<string, string> {
  const draft = cardDraft(data);
  const left = draft.filter((k) => !(k in values));
  return left.length === draft.length ? { ...values } : { ...values, card_draft: left.join(', ') };
}

export interface ScenePoint {
  path: string;
  id: string;
  title: string;
  span: Span;
  tension: number | null;
  outcome: Outcome | null;
  mood: number | null;
  /** Which of the three are the team's guess (in card_draft). */
  guess: { tension: boolean; outcome: boolean; mood: boolean };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function scenePoints(scenes: NoteRecord[]): ScenePoint[] {
  const spans = scenePositions(scenes);
  return scenes.map((s, i) => {
    const t = toNumber(s.data.tension), m = toNumber(s.data.mood);
    const o = String(s.data.outcome || '') as Outcome;
    const draft = cardDraft(s.data);
    return {
      path: s.path, id: String(s.data.id || ''), title: String(s.data.headline || s.data.title || s.data.id || ''), span: spans[i],
      tension: t == null ? null : clamp(Math.round(t), 1, 10),
      outcome: OUTCOMES.indexOf(o) >= 0 ? o : null,
      mood: m == null ? null : clamp(Math.round(m), -5, 5),
      guess: { tension: draft.indexOf('tension') >= 0, outcome: draft.indexOf('outcome') >= 0, mood: draft.indexOf('mood') >= 0 }
    };
  });
}

/** The reference curve: a classic rising curve of tension through the book, with a dip near 75% (Save the Cat's All Is
 * Lost and Dark Night of the Soul) and the peak near 85 to 90% (the Finale's climax), easing off at the end. A rough guide
 * drawn for Sparrow, not a measured standard. Points are [percent of the book, tension 1 to 10]. */
export const REFERENCE: [number, number][] = [
  [0, 2], [10, 4], [20, 4.5], [35, 5], [50, 6.5], [65, 7.5], [75, 5.5], [80, 7], [88, 9.5], [95, 7], [100, 4]
];
export const REFERENCE_NAME = 'a classic rising curve, with a dip near 75% (All Is Lost) and the peak near 85–90% (the climax)';

export function referenceAt(pct: number): number {
  const p = clamp(pct, 0, 100);
  for (let i = 1; i < REFERENCE.length; i++) {
    const [x1, y1] = REFERENCE[i - 1], [x2, y2] = REFERENCE[i];
    if (p <= x2) return y1 + ((y2 - y1) * (p - x1)) / (x2 - x1 || 1);
  }
  return REFERENCE[REFERENCE.length - 1][1];
}

export interface TensionIssue { kind: 'flat' | 'early-peak' | 'wins'; text: string; scenes: string[] }

/** The three checks: three scenes in a row that do not rise, the peak before 70% of the book, and more than 30% of scenes
 * ending in a clean win. Only scenes with a value take part. */
export function tensionIssues(points: ScenePoint[]): TensionIssue[] {
  const out: TensionIssue[] = [];
  const withT = points.filter((p) => p.tension != null);
  // Runs where each scene is no tenser than the one before it; a run of three or more scenes is flat.
  let run: ScenePoint[] = withT.length ? [withT[0]] : [];
  const close = () => {
    if (run.length >= 3) out.push({ kind: 'flat', scenes: run.map((p) => p.id), text: run.length + ' scenes in a row do not rise (' + run[0].id + ' to ' + run[run.length - 1].id + '). Raise one, or cut one.' });
  };
  for (let i = 1; i < withT.length; i++) {
    if ((withT[i].tension as number) <= (withT[i - 1].tension as number)) run.push(withT[i]);
    else { close(); run = [withT[i]]; }
  }
  close();
  if (withT.length >= 3) {
    const max = Math.max(...withT.map((p) => p.tension as number));
    const peak = withT.filter((p) => p.tension === max).pop() as ScenePoint;
    if (peak.span.mid < 70) out.push({ kind: 'early-peak', scenes: [peak.id], text: 'The peak (' + peak.id + ', tension ' + max + ') comes at ' + Math.round(peak.span.mid) + '% of the book, before 70%. The climax usually sits near 85 to 90%.' });
  }
  const withO = points.filter((p) => p.outcome);
  const wins = withO.filter((p) => p.outcome === 'yes');
  if (withO.length >= 3 && wins.length / withO.length > 0.3) {
    out.push({ kind: 'wins', scenes: wins.map((p) => p.id), text: wins.length + ' of ' + withO.length + ' scenes (' + Math.round((wins.length / withO.length) * 100) + '%) end in a clean win (yes). Over 30% lets the pressure out; try yes-but or no-and.' });
  }
  return out;
}

/** The Overview's warnings from Tension and Pacing. */
export const tensionWarnings: WarningCheck = (index, bookFolder) => {
  const book = index.books.find((b) => b.folder === bookFolder);
  if (!book) return [];
  const to = '#/board/tension/' + encodeURIComponent(book.folder);
  return tensionIssues(scenePoints(storyScenes(index, book))).map((i): Warning => ({ text: i.text, href: to, check: 'tension' }));
};

// ---------------------------------------------------------------- story shape

/** The six emotional shapes of stories (Reagan et al., 2016, "The emotional arcs of stories are dominated by six basic
 * shapes", as cited in the Writers Room code; not re-checked). Each is drawn as a curve over the book, 0 to 1. */
export const SHAPES: { key: string; name: string; says: string; at: (x: number) => number }[] = [
  { key: 'rags-to-riches', name: 'Rags to riches', says: 'steady rise', at: (x) => x },
  { key: 'riches-to-rags', name: 'Riches to rags', says: 'steady fall', at: (x) => -x },
  { key: 'man-in-a-hole', name: 'Man in a hole', says: 'fall, then rise', at: (x) => Math.cos(2 * Math.PI * x) },
  { key: 'icarus', name: 'Icarus', says: 'rise, then fall', at: (x) => -Math.cos(2 * Math.PI * x) },
  { key: 'cinderella', name: 'Cinderella', says: 'rise, fall, rise', at: (x) => -Math.cos(3 * Math.PI * x) },
  { key: 'oedipus', name: 'Oedipus', says: 'fall, rise, fall', at: (x) => Math.cos(3 * Math.PI * x) }
];
export const SHAPE_SOURCE = 'Reagan et al., 2016, as cited in the Writers Room code; not re-checked';

/** A moving average over three neighbours, so one odd scene does not decide the shape. */
export function smooth(values: number[], reach = 1): number[] {
  return values.map((_, i) => {
    const part = values.slice(Math.max(0, i - reach), i + reach + 1);
    return part.reduce((a, b) => a + b, 0) / part.length;
  });
}

function correlation(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export interface ShapeMatch { key: string; name: string; says: string; score: number }

/** How close the smoothed mood line is to each shape (correlation, -1 to 1), closest first. Needs four scenes with a mood
 * and some movement; otherwise the list is empty. */
export function storyShape(points: ScenePoint[]): ShapeMatch[] {
  const withM = points.filter((p) => p.mood != null);
  if (withM.length < 4) return [];
  const ys = smooth(withM.map((p) => p.mood as number));
  if (Math.max(...ys) - Math.min(...ys) < 0.5) return [];
  const xs = withM.map((p) => p.span.mid / 100);
  return SHAPES.map((s) => ({ key: s.key, name: s.name, says: s.says, score: correlation(ys, xs.map(s.at)) }))
    .sort((a, b) => b.score - a.score);
}

