// The Writer's rewrite beside Kyle's page (Kyle, 2026-11-04: "i just need a whole rewrite of the book in the chamber on
// the right side at all times to pull from"). The Writer rewrites a chapter as a copy of each scene in the book's
// `Drafts/Rewrite/` folder, the same file name as the scene, and never touches the scene itself. The index and `sf`
// skip the Drafts folder, so the copies never clash with the real scenes. The app lines the rewrite's paragraphs up
// with Kyle's and lets him bring one over at a time; the rewrite file never changes from the app.
import type { FileEntry } from './types.ts';

export const REWRITE_FOLDER = 'Drafts/Rewrite';

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
  const id = String(scene.data.id || '');
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
  /** The index of the rewrite's paragraph, or null when the rewrite leaves Kyle's out. */
  theirs: number | null;
  /** How alike the two are; 1 when they read the same. */
  score: number;
}

/** The least alike two paragraphs can be and still sit side by side. */
export const MATCH = 0.3;

/** Line the rewrite's paragraphs up with Kyle's, in order, so each row shows his paragraph beside the one the Writer
 * made of it; a paragraph the Writer added or cut gets a row of its own. */
export function align(mine: string[], theirs: string[]): Row[] {
  const n = mine.length, m = theirs.length;
  // Best total likeness of the first i of Kyle's against the first j of the rewrite's (Needleman-Wunsch, gaps free).
  const S: Float64Array[] = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const sim: Float64Array[] = Array.from({ length: n }, () => new Float64Array(m));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) sim[i][j] = mine[i].trim() === theirs[j].trim() ? 1 : similarity(mine[i], theirs[j]);
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
  return rows.reverse();
}

/** Kyle's page with one of the rewrite's paragraphs brought over: in place of his paragraph when the row has one, or
 * put in after his paragraph that comes before it in the rows (at the start when there is none). Returns where the
 * new words sit. */
export function bringOver(text: string, mine: Para[], rows: Row[], index: number, theirs: string): { text: string; at: number; end: number } {
  const t = theirs.replace(/\s+$/, '');
  const row = rows[index];
  if (row.mine != null) {
    const p = mine[row.mine];
    return { text: text.slice(0, p.at) + t + text.slice(p.end), at: p.at, end: p.at + t.length };
  }
  let before: Para | null = null;
  for (let k = index - 1; k >= 0 && !before; k--) { const r = rows[k]; if (r.mine != null) before = mine[r.mine]; }
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

/** How far the rewrite has come: the chapters that have a rewritten scene, and the first scene with one. */
export function rewriteProgress(copies: FileEntry[], scenes: { path: string; data: Record<string, unknown> }[]): { done: number; total: number; first: string | null } {
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
  return { done: done.length, total: all.length, first: done.length ? done[0][1].first : null };
}
