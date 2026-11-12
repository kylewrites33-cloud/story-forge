// The Writer's rewrite beside Kyle's page (Kyle, 2026-11-04: "i just need a whole rewrite of the book in the chamber on
// the right side at all times to pull from"). The Writer rewrites a chapter as a copy of each scene in the book's
// `Drafts/Rewrite/` folder, the same file name as the scene, and never touches the scene itself. The index and `sf`
// skip the Drafts folder, so the copies never clash with the real scenes. The app lines the rewrite's paragraphs up
// with Kyle's and lets him bring one over at a time; the rewrite file never changes from the app.
import { Frontmatter } from './frontmatter.js';
import type { FileEntry } from './types.ts';
import { propText } from './props.ts';

export const REWRITE_FOLDER = 'Drafts/Rewrite';

/** The chapters Kyle has been through in the Rewrite tab: the book note's `rewrite_done` list (Kyle, 2026-11-05:
 * "Done with this chapter"). */
export function rewriteDone(book: { data: Record<string, unknown> } | null | undefined): number[] {
  const v = book ? book.data.rewrite_done : null;
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  return list.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0).filter((n, i, a) => a.indexOf(n) === i).sort((a, b) => a - b);
}

/** The book note's text with chapter `chapter` marked through (or not), every other line as it was. */
export function withRewriteDone(text: string, chapter: number, done: boolean): string {
  const parsed = Frontmatter.parse(text);
  if (parsed.error) throw new Error('The book note\'s properties cannot be read (' + parsed.error + '). Ask the team to fix it, then try again.');
  const now = rewriteDone({ data: (parsed.data || {}) as Record<string, unknown> });
  return withRewriteList(text, done ? now.concat(now.indexOf(chapter) < 0 ? [chapter] : []) : now.filter((n) => n !== chapter));
}

/** The book note's text with `chapters` as its `rewrite_done` list (no line when the list is empty), every other line
 * as it was. Also used when chapters are renumbered (src/vault/chapters.ts). */
export function withRewriteList(text: string, chapters: number[]): string {
  const s = Frontmatter.split(text);
  if (!s.hasFm) throw new Error('The book note has no properties, so the app cannot mark the chapter. Ask the team to fix it.');
  const next = chapters.filter((n, i, a) => Number.isInteger(n) && n > 0 && a.indexOf(n) === i).sort((a, b) => a - b);
  const eol = s.yaml && s.yaml.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const lines = s.yaml ? s.yaml.split(/\r?\n/) : [];
  let at = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!/^rewrite_done[ \t]*:/.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && (/^[ \t]+\S/.test(lines[j]) || /^-([ \t]|$)/.test(lines[j]))) j++;
    lines.splice(i, j - i);
    at = i;
    break;
  }
  if (next.length) lines.splice(at < 0 ? lines.length : at, 0, 'rewrite_done: [' + next.join(', ') + ']');
  return s.open + lines.join(eol) + s.close + s.body;
}

const fileName = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/** The rewrite copies in the book's `Drafts/Rewrite/` folder. */
export function rewriteFiles(files: FileEntry[], bookFolder: string): FileEntry[] {
  const dir = bookFolder + '/' + REWRITE_FOLDER + '/';
  return files.filter((f) => f.path.startsWith(dir) && /^[^/]+\.md$/.test(f.path.slice(dir.length)));
}

/** A scene's rewrite: the copy of the same name, or else the one that starts with its ID. */
export function rewriteFor(copies: FileEntry[], scene: { path: string; data: Record<string, unknown> }): FileEntry | null {
  const name = fileName(scene.path);
  const same = copies.find((f) => fileName(f.path) === name);
  if (same) return same;
  const id = propText(scene, 'id');
  return id ? copies.find((f) => fileName(f.path).startsWith(id + ' ') || fileName(f.path) === id + '.md') || null : null;
}

export interface Para {
  /** The paragraph's words, with the * and = marks of the page. */
  text: string;
  /** Where it sits in the whole text, in characters. */
  at: number;
  end: number;
}

/** The paragraphs of a page: runs of lines between blank lines. Blank lines belong to no paragraph. */
export function paragraphs(text: string): Para[] {
  const out: Para[] = [];
  const re = /[^\n]+(?:\n(?!\s*\n)[^\n]*)*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!m[0].trim()) continue;
    // Trailing spaces on the last line stay outside, so a replacement never eats the blank line after.
    const t = m[0].replace(/\s+$/, '');
    out.push({ text: t, at: m.index, end: m.index + t.length });
  }
  return out;
}

const words = (s: string): string[] => (s.toLowerCase().match(/[\p{L}\p{N}'’]+/gu) || []);

/** How alike two paragraphs are, 0 to 1: the share of words they have in common. */
export function similarity(a: string, b: string): number {
  const wa = words(a), wb = words(b);
  if (!wa.length && !wb.length) return 1;
  if (!wa.length || !wb.length) return 0;
  const count = new Map<string, number>();
  wa.forEach((w) => count.set(w, (count.get(w) || 0) + 1));
  let same = 0;
  wb.forEach((w) => { const c = count.get(w) || 0; if (c > 0) { same++; count.set(w, c - 1); } });
  return (2 * same) / (wa.length + wb.length);
}

export interface Row {
  /** The index of Kyle's paragraph, or null when the rewrite adds one here. */
  mine: number | null;
  /** The last of Kyle's paragraphs in this row, when the Writer made one paragraph of several of his (a screen's title
   * line and its words, say); the row then runs from `mine` to `mineEnd`. */
  mineEnd?: number;
  /** The last of the Writer's paragraphs in this row, when the Writer split one of Kyle's into several (three lines of
   * dialogue in one paragraph of his, say); Bring over then puts all of them in place of his. */
  theirsEnd?: number;
  /** The index of the rewrite's paragraph, or null when the rewrite leaves Kyle's out. */
  theirs: number | null;
  /** How alike the two are; 1 when they read the same. */
  score: number;
}

/** A row's score: 1 only when the two read exactly the same, marks and all, so a change of only a stop, a colon, an
 * italic or a screen's > marks still gets its Bring over (the word count alone would call them the same). */
function likeness(a: string, b: string): number {
  return a.trim() === b.trim() ? 1 : Math.min(0.999, similarity(a, b));
}

/** A paragraph's words, counted, for comparing it with many others. */
interface Bag { count: Map<string, number>; size: number; trimmed: string }
function bag(s: string): Bag {
  const count = new Map<string, number>();
  const w = words(s);
  w.forEach((x) => count.set(x, (count.get(x) || 0) + 1));
  return { count, size: w.length, trimmed: s.trim() };
}
/** likeness() from two bags: the same number, without splitting the words again. */
function bagLikeness(a: Bag, b: Bag): number {
  if (a.trimmed === b.trimmed) return 1;
  if (!a.size && !b.size) return 0.999;
  if (!a.size || !b.size) return 0;
  const [small, big] = a.count.size <= b.count.size ? [a.count, b.count] : [b.count, a.count];
  let same = 0;
  small.forEach((c, w) => { const d = big.get(w); if (d) same += Math.min(c, d); });
  return Math.min(0.999, (2 * same) / (a.size + b.size));
}

// Typing in the page beside the Rewrite tab lines the chapter up again at every key (Kyle, 2026-11-11: "Typing in
// Sparrow is suddenly real slow"). Comparing every paragraph of his with every one of the Writer's took a fifth of a
// second a key in a long chapter. A key changes one paragraph, so each paragraph's row of likenesses is kept, by its
// words, for the last few rewrites shown, and only the paragraph being typed in is compared again.
const KEEP = 8;
const seen = new Map<string, { theirs: Bag[]; rows: Map<string, Float64Array> }>();
function likenessRows(mine: string[], theirs: string[]): Float64Array[] {
  const key = theirs.join('\u0000');
  let c = seen.get(key);
  if (c) { seen.delete(key); seen.set(key, c); }
  else {
    c = { theirs: theirs.map(bag), rows: new Map() };
    seen.set(key, c);
    if (seen.size > KEEP) seen.delete(seen.keys().next().value as string);
  }
  const cache = c;
  const out = mine.map((p) => {
    let row = cache.rows.get(p);
    if (!row) {
      const b = bag(p);
      row = new Float64Array(cache.theirs.length);
      for (let j = 0; j < cache.theirs.length; j++) row[j] = bagLikeness(b, cache.theirs[j]);
    }
    return row;
  });
  // Keep only the rows of the paragraphs on the page now, so old versions of the one being typed do not pile up.
  const fresh = new Map<string, Float64Array>();
  mine.forEach((p, i) => fresh.set(p, out[i]));
  cache.rows = fresh;
  return out;
}

/** The least alike two paragraphs can be and still sit side by side. */
export const MATCH = 0.3;

/** Line the rewrite's paragraphs up with Kyle's, in order, so each row shows his paragraph beside the one the Writer
 * made of it; a paragraph the Writer added or cut gets a row of its own. */
export function align(mine: string[], theirs: string[]): Row[] {
  const n = mine.length, m = theirs.length;
  // Best total likeness of the first i of Kyle's against the first j of the rewrite's (Needleman-Wunsch, gaps free).
  const S: Float64Array[] = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const sim: Float64Array[] = likenessRows(mine, theirs);
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const s = sim[i - 1][j - 1];
    const pair = s >= MATCH ? S[i - 1][j - 1] + s : -Infinity;
    S[i][j] = Math.max(pair, S[i - 1][j], S[i][j - 1]);
  }
  const rows: Row[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const s = i > 0 && j > 0 ? sim[i - 1][j - 1] : 0;
    if (i > 0 && j > 0 && s >= MATCH && S[i][j] === S[i - 1][j - 1] + s) { rows.push({ mine: i - 1, theirs: j - 1, score: s }); i--; j--; }
    else if (j > 0 && (i === 0 || S[i][j] === S[i][j - 1])) { rows.push({ mine: null, theirs: j - 1, score: 0 }); j--; }
    else { rows.push({ mine: i - 1, theirs: null, score: 0 }); i--; }
  }
  return joinParts(rows.reverse(), mine, theirs);
}

/** How many of `part`'s words the paragraph `whole` has. */
function share(part: string, whole: string): number {
  const wp = words(part);
  if (!wp.length) return 1;
  const count = new Map<string, number>();
  words(whole).forEach((w) => count.set(w, (count.get(w) || 0) + 1));
  let got = 0;
  wp.forEach((w) => { const c = count.get(w) || 0; if (c > 0) { got++; count.set(w, c - 1); } });
  return got / wp.length;
}

/** Where the Writer joined two or more of Kyle's paragraphs into one (Kyle, 2026-11-06: a screen's plain title line
 * stayed on his page after Bring over), the "left out" paragraph beside the joined one goes into the same row, so
 * Bring over replaces all of them. */
function joinParts(rows: Row[], mine: string[], theirs: string[]): Row[] {
  const out = rows.map((r) => ({ ...r }));
  const joined = (r: Row) => mine.slice(r.mine!, (r.mineEnd ?? r.mine!) + 1).join('\n\n');
  const absorbs = (r: Row, cut: number, before: boolean): boolean => {
    const t = theirs[r.theirs!];
    if (share(mine[cut], t) < 0.6) return false;
    const now = similarity(joined(r), t);
    const both = before ? mine[cut] + '\n\n' + joined(r) : joined(r) + '\n\n' + mine[cut];
    return similarity(both, t) > now + 0.02;
  };
  for (let k = 0; k < out.length; k++) {
    const r = out[k];
    if (r.mine == null || r.theirs == null) continue;
    // Kyle's paragraphs just before it, left out by the Writer.
    while (k > 0 && out[k - 1].theirs == null && out[k - 1].mine === r.mine - 1 && absorbs(r, r.mine - 1, true)) {
      if (r.mineEnd == null) r.mineEnd = r.mine;
      r.mine--; out.splice(k - 1, 1); k--;
    }
    // And just after it.
    while (k + 1 < out.length && out[k + 1].theirs == null && out[k + 1].mine === (r.mineEnd ?? r.mine) + 1 && absorbs(r, out[k + 1].mine!, false)) {
      r.mineEnd = out[k + 1].mine!; out.splice(k + 1, 1);
    }
    if (r.mineEnd != null) r.score = likeness(joined(r), theirs[r.theirs]);
  }
  // The other way round (Kyle, 2026-11-07: "Why is it doing this weird duplication"): where the Writer made several
  // paragraphs of one of Kyle's, the ones it "added" beside the row go into it, so they replace his paragraph together
  // instead of going in beside it.
  const theirsJoined = (r: Row) => theirs.slice(r.theirs!, (r.theirsEnd ?? r.theirs!) + 1).join('\n\n');
  const splits = (r: Row, add: number, before: boolean): boolean => {
    const m = joined(r);
    if (share(theirs[add], m) < 0.6) return false;
    const now = similarity(m, theirsJoined(r));
    const both = before ? theirs[add] + '\n\n' + theirsJoined(r) : theirsJoined(r) + '\n\n' + theirs[add];
    return similarity(m, both) > now + 0.02;
  };
  for (let k = 0; k < out.length; k++) {
    const r = out[k];
    if (r.mine == null || r.theirs == null || r.mineEnd != null) continue;
    let grew = false;
    while (k > 0 && out[k - 1].mine == null && out[k - 1].theirs === r.theirs - 1 && splits(r, r.theirs - 1, true)) {
      if (r.theirsEnd == null) r.theirsEnd = r.theirs;
      r.theirs--; out.splice(k - 1, 1); k--; grew = true;
    }
    while (k + 1 < out.length && out[k + 1].mine == null && out[k + 1].theirs === (r.theirsEnd ?? r.theirs) + 1 && splits(r, out[k + 1].theirs!, false)) {
      r.theirsEnd = out[k + 1].theirs!; out.splice(k + 1, 1); grew = true;
    }
    if (grew) r.score = likeness(joined(r), theirsJoined(r));
  }
  return out;
}

/** The Writer's words for a row: its paragraph, or the run of them it made of one of Kyle's. */
export function theirWords(theirs: string[], row: Row): string {
  return row.theirs == null ? '' : theirs.slice(row.theirs, (row.theirsEnd ?? row.theirs) + 1).join('\n\n');
}

/** The stretch of Kyle's page a row covers: his paragraph, or the run of them the Writer joined. */
export function span(mine: Para[], row: Row): { at: number; end: number; text: string } | null {
  if (row.mine == null) return null;
  const a = mine[row.mine], b = mine[row.mineEnd ?? row.mine];
  return { at: a.at, end: b.end, text: mine.slice(row.mine, (row.mineEnd ?? row.mine) + 1).map((p) => p.text).join('\n\n') };
}

/** Kyle's page with one of the rewrite's paragraphs brought over: in place of his paragraph when the row has one, or
 * put in after his paragraph that comes before it in the rows (at the start when there is none). Returns where the
 * new words sit. */
export function bringOver(text: string, mine: Para[], rows: Row[], index: number, theirs: string): { text: string; at: number; end: number } {
  const t = theirs.replace(/\s+$/, '');
  const row = rows[index];
  if (row.mine != null) {
    const p = span(mine, row)!;
    return { text: text.slice(0, p.at) + t + text.slice(p.end), at: p.at, end: p.at + t.length };
  }
  let before: Para | null = null;
  for (let k = index - 1; k >= 0 && !before; k--) { const r = rows[k]; if (r.mine != null) before = mine[r.mineEnd ?? r.mine]; }
  if (!before) {
    const first = mine[0];
    if (!first) { const body = text.trim() ? t + '\n\n' + text.replace(/^\s+/, '') : t; return { text: body, at: 0, end: t.length }; }
    return { text: text.slice(0, first.at) + t + '\n\n' + text.slice(first.at), at: first.at, end: first.at + t.length };
  }
  const at = before.end + 2;
  return { text: text.slice(0, before.end) + '\n\n' + t + text.slice(before.end), at, end: at + t.length };
}

/** Kyle's page with one of his paragraphs taken out, as the rewrite leaves it out. */
export function takeOut(text: string, p: Para): string {
  const before = text.slice(0, p.at).replace(/\s+$/, '');
  const after = text.slice(p.end).replace(/^\s+/, '');
  if (!before) return after;
  if (!after) return before + '\n';
  return before + '\n\n' + after;
}

/** Which row Kyle's cursor is in, for the column to follow the page. */
export function rowAt(rows: Row[], mine: Para[], caret: number): number {
  let best = -1;
  rows.forEach((r, k) => { if (r.mine != null && mine[r.mine].at <= caret) best = k; });
  return best;
}

/** How far the rewrite has come: the chapters that have a rewritten scene, the first scene with one, and how many
 * chapters Kyle is through (the first chapter not yet through is `next`). */
export function rewriteProgress(copies: FileEntry[], scenes: { path: string; data: Record<string, unknown> }[], through: number[] = []): { done: number; total: number; first: string | null; through: number; next: string | null } {
  const chapters = new Map<number, { any: boolean; first: string }>();
  scenes.forEach((s) => {
    const ch = typeof s.data.chapter === 'number' ? s.data.chapter : null;
    if (ch == null) return;
    const e = chapters.get(ch) || { any: false, first: s.path };
    if (!e.any && rewriteFor(copies, s)) e.any = true;
    chapters.set(ch, e);
  });
  const all = Array.from(chapters.entries()).sort((a, b) => a[0] - b[0]);
  const done = all.filter(([, e]) => e.any);
  const left = done.filter(([ch]) => through.indexOf(ch) < 0);
  return { done: done.length, total: all.length, first: done.length ? done[0][1].first : null, through: done.length - left.length, next: left.length ? left[0][1].first : null };
}

/** Where Kyle left off in draft 2 (Kyle, 2026-11-06: "a subtle little arrow ... underneath the last paragraph ... that
 * we changed"): the scene, the start of that paragraph's words, and which paragraph it was. */
export interface Spot { path: string; head: string; index: number }

const HEAD = 80;

/** The spot for the paragraph of `text` that holds character `at` (or the one just before it, between paragraphs). */
export function spotOf(path: string, text: string, at: number): Spot | null {
  const ps = paragraphs(text);
  if (!ps.length) return null;
  let k = -1;
  ps.forEach((p, i) => { if (p.at <= at) k = i; });
  if (k < 0) k = 0;
  return { path, head: ps[k].text.slice(0, HEAD), index: k };
}

/** That paragraph on the page as it stands: the one that starts with the same words (nearest the old place when
 * several do), else the one that was there, as long as the page has that many. */
export function findSpot(text: string, spot: Spot): Para | null {
  const ps = paragraphs(text);
  if (!ps.length) return null;
  let best = -1;
  ps.forEach((p, i) => { if (p.text.slice(0, HEAD) === spot.head && (best < 0 || Math.abs(i - spot.index) < Math.abs(best - spot.index))) best = i; });
  if (best < 0) best = Math.min(spot.index, ps.length - 1);
  return ps[best];
}
