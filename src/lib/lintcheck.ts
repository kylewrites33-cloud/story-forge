// Check (AI phrases) in the writing screen: the vault tool's linter (lint.js, copied from sf.js) run on this device, free
// and offline, with nothing sent anywhere. sf lint reads a scene's prose with the Markdown marks taken out
// (Prose.proseLines); the page holds the marks, so every flag is mapped back to where its words are on the page, for
// the highlight and the jump. Nothing here changes the text.
import { Lint, type LintIssue, type LintOptions, type LintStats } from './lint.js';
import { Prose } from './prose.js';
import { nameList, toNumber } from './links.ts';

/** A flag with where its words are on the page (`from`, `to`) and which paragraph and line of the page it is in. */
export interface CheckIssue extends LintIssue { from: number; to: number; para: number; line: number }

export interface CheckResult {
  /** Every flag, in page order. The score counts all of them, as sf does. */
  issues: CheckIssue[];
  /** The flags at or above the book's `lint_min_score` (Config), the ones sf lint prints. */
  shown: CheckIssue[];
  stats: LintStats;
}

/** What sf lint takes from the book: the Style Guide's banned phrases, rules turned off and em dash limit, and the
 * vault Config's em dash limit and lowest severity to show (lintOptions and cmdLint in sf.js). */
export interface CheckOptions { lint: LintOptions; minSev: number }

export function checkOptions(styleGuide: Record<string, unknown> | null, config: Record<string, unknown> | null): CheckOptions {
  const cfg = config || {};
  let emdashMax = toNumber(cfg.em_dash_limit_per_1000) ?? 4;
  const lint: LintOptions = { extraPhrases: [], disable: [], emdashMax };
  if (styleGuide) {
    lint.extraPhrases = nameList(styleGuide.banned);
    lint.disable = nameList(styleGuide.lint_disable);
    if (styleGuide.emdash_max != null) emdashMax = toNumber(styleGuide.emdash_max) ?? emdashMax;
    lint.emdashMax = emdashMax;
  }
  return { lint, minSev: toNumber(cfg.lint_min_score) ?? 1 };
}

/** The text sf lint reads (marks out, same lines) and, for each of its characters, where that character is on the page.
 * Taking the marks out only ever drops characters, so each line of the reading text is matched to its page line in order.
 * `map` has one more entry than the reading text: the page's length. */
export function readingMap(text: string): { masked: string; map: number[] } {
  const masked = Prose.proseLines(text);
  const pageLines = text.replace(/\r\n?/g, '\n').split('\n');
  const readLines = masked.split('\n');
  const map: number[] = [];
  let base = 0;
  readLines.forEach((rl, li) => {
    const pl = pageLines[li] ?? '';
    let j = 0;
    for (let k = 0; k < rl.length; k++) {
      while (j < pl.length && pl[j] !== rl[k]) j++;
      // Never expected (the reading text only drops characters); keep the place on its line if it happens.
      map.push(base + Math.min(j, pl.length));
      if (j < pl.length) j++;
    }
    if (li < readLines.length - 1) map.push(base + pl.length);
    base += pl.length + 1;
  });
  map.push(text.length);
  return { masked, map };
}

/** Run the checker on the page's Markdown and map each flag onto the page. */
export function checkText(text: string, opts: CheckOptions = { lint: {}, minSev: 1 }): CheckResult {
  const { masked, map } = readingMap(text);
  const r = Lint.run(masked, opts.lint);
  const paras = Prose.paragraphs(text);
  const paraOf = (at: number) => { const i = paras.findIndex((p) => at < p.end); return i < 0 ? paras.length : i + 1; };
  const issues: CheckIssue[] = r.issues.map((it) => {
    const from = map[Math.min(it.start, map.length - 1)];
    const to = it.end > it.start ? map[Math.min(it.end - 1, map.length - 1)] + 1 : from;
    return { ...it, from, to: Math.max(from, Math.min(to, text.length)), para: paraOf(from), line: text.slice(0, from).split('\n').length };
  });
  return { issues, shown: issues.filter((i) => i.sev >= opts.minSev), stats: r.stats };
}

/** sf lint's grade for a score: under 2 Clean, under 5 Light, under 10 Noticeable, 10 or more Heavy. */
export function gradeFor(score: number): LintStats['tellGrade'] {
  return score < 2 ? 'Clean' : score < 5 ? 'Light' : score < 10 ? 'Noticeable' : 'Heavy';
}

/** One score for several scenes (Whole chapter), weighted by words as sf lint's "Overall" line is, and the rhythm
 * numbers from all their sentences together. */
export function combine(results: CheckResult[]): { words: number; score: number; grade: LintStats['tellGrade']; sentences: number; mean: number; sd: number; cv: number; longest: number } {
  const words = results.reduce((n, r) => n + r.stats.words, 0);
  const weighted = results.reduce((n, r) => n + r.stats.tellIndex * r.stats.words / 1000, 0);
  const score = words ? +(weighted * 1000 / words).toFixed(1) : 0;
  const lens = results.flatMap((r) => r.stats.sentenceLengths);
  const mean = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const sd = lens.length > 1 ? Math.sqrt(lens.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (lens.length - 1)) : 0;
  return { words, score, grade: gradeFor(score), sentences: lens.length, mean: +mean.toFixed(1), sd: +sd.toFixed(1), cv: mean ? +(sd / mean).toFixed(2) : 0, longest: lens.length ? Math.max(...lens) : 0 };
}

/** A severity in Kyle's words. */
export function sevWord(sev: number): string {
  return sev >= 3 ? 'Strong tell' : sev === 2 ? 'Likely tell' : 'Worth a look';
}

// Whether flags are drawn on the page (on unless Kyle turned it off on this device).
const SHOW = 'story-forge.check-show';
export function loadShowFlags(): boolean {
  try { return localStorage.getItem(SHOW) !== 'off'; } catch { return true; }
}
export function saveShowFlags(on: boolean) {
  try { if (on) localStorage.removeItem(SHOW); else localStorage.setItem(SHOW, 'off'); } catch { /* lasts until reload */ }
}
