// What a key does to a line of the scene's Markdown, worked out the way a word processor would (code structure redesign,
// step 3). The new writing box (src/write/prose.ts) keeps the Markdown itself as its document, with the stars and equals
// signs hidden, so a key that lands beside a hidden mark must not leave a lone star showing: a letter typed at the end of
// italic words is italic, a space there goes outside the stars, Backspace beside a hidden star deletes the letter before
// it, and words left with nothing inside lose their marks. No DOM here; tested with Node.
import { allRuns, insertText, stylesAt, type StyleKind } from './styled.ts';

export interface Look { i: boolean; b: boolean; h: boolean }
interface Ch { c: string; i: boolean; b: boolean; h: boolean; at: number }

const CARET = '';
const PLAIN: Look = { i: false, b: false, h: false };
const same = (a: Look, b: Look) => a.i === b.i && a.b === b.b && a.h === b.h;
const has = (m: string, k: StyleKind) => (k === 'h' ? m === '==' : k === 'i' ? m === '*' || m === '***' : m === '**' || m === '***');

/** The letters of a stretch of text (whole lines) with the look each has; the marks themselves are left out. */
export function letters(text: string): Ch[] {
  const out: Ch[] = [];
  let ls = 0;
  text.split('\n').forEach((line, n) => {
    if (n > 0) out.push({ c: '\n', ...PLAIN, at: ls - 1 });
    const rs = allRuns(line);
    const mark = new Set<number>();
    rs.forEach((r) => { for (let k = 0; k < r.mark; k++) { mark.add(r.from + k); mark.add(r.to - r.mark + k); } });
    for (let p = 0; p < line.length; p++) {
      if (mark.has(p)) continue;
      const ch: Ch = { c: line[p], i: false, b: false, h: false, at: ls + p };
      rs.forEach((r) => { if (r.from + r.mark <= p && p < r.to - r.mark) (['i', 'b', 'h'] as StyleKind[]).forEach((k) => { if (has(r.m, k)) ch[k] = true; }); });
      out.push(ch);
    }
    ls += line.length + 1;
  });
  return out;
}

/** Marks around a group of letters with one look: spaces at its edges go outside, a group with no words gets none. The
 * cursor's stand-in stays inside unless there is a space on its side of it. */
function wrap(s: string, m: string): string {
  if (!m) return s;
  const edge = (t: string) => { let n = 0; while (n < t.length && (/\s/.test(t[n]) || t[n] === CARET)) n++; return n; };
  const a = edge(s);
  const rev = s.slice(a).split('').reverse().join('');
  const z = edge(rev);
  const lead = s.slice(0, a), core = s.slice(a, s.length - z), trail = s.slice(s.length - z);
  if (!core) return s;
  const lo = /\s/.test(lead) ? lead : '', li = lo ? '' : lead;
  const to = /\s/.test(trail) ? trail : '', ti = to ? '' : trail;
  return lo + m + li + core + ti + m + to;
}

function groups<T>(chs: Ch[], key: (c: Ch) => T): { key: T; chs: Ch[] }[] {
  const out: { key: T; chs: Ch[] }[] = [];
  chs.forEach((c) => { const k = key(c), last = out[out.length - 1]; if (last && last.key === k) last.chs.push(c); else out.push({ key: k, chs: [c] }); });
  return out;
}

const stars = (chs: Ch[]) => groups(chs, (c) => (c.i && c.b ? '***' : c.b ? '**' : c.i ? '*' : '')).map((g) => wrap(g.chs.map((c) => c.c).join(''), g.key)).join('');

/** Letters back to Markdown, line by line: highlighter marks outermost, stars inside them. */
export function markdown(chs: Ch[]): string {
  return groups(chs, (c) => (c.c === '\n' ? 'n' : c.h ? 'h' : '')).map((g) => {
    if (g.key === 'n') return g.chs.map(() => '\n').join('');
    if (g.key === '') return stars(g.chs);
    // The stand-in for the cursor keeps its place: wrap works on the finished inner text.
    return wrap(stars(g.chs), '==');
  }).join('');
}

export interface Edited { text: string; caret: number; pend: Look | null }

/** One change by Kyle's hand to `old` (whole lines of the page): the characters from `a` to `b` replaced by `ins`.
 * `back` says which way a delete was going; `pend` is a look waiting for the next letters (Bold pressed between words,
 * or a space just typed at the end of styled words). Returns the lines as they should now read, where the cursor goes,
 * and the look that waits next. */
export function edit(old: string, a: number, b: number, ins: string, back: boolean, pend: Look | null): Edited {
  const chs = letters(old);
  if (markdown(chs) !== old) return fallback(old, chs, a, b, ins, back);
  const vis = (p: number) => { let n = 0; while (n < chs.length && chs[n].at < p) n++; return n; };
  let va = vis(a), vb = vis(b);
  if (!ins && va === vb) {
    // Only hidden marks were in the way: the delete takes the letter beyond them.
    if (back) { if (va === 0) return { text: old, caret: a, pend: null }; va--; }
    else { if (vb >= chs.length) return { text: old, caret: a, pend: null }; vb++; }
  }
  // Typed over a selection, the words take the look of the first letter they replace; otherwise the look at the cursor.
  const at = stylesAt(old, a);
  const look: Look = pend || (ins && vb > va ? { i: chs[va].i, b: chs[va].b, h: chs[va].h } : at);
  const typed: Ch[] = ins.split('').map((c) => (c === '\n' ? { c, ...PLAIN, at: -1 } : { c, ...look, at: -1 }));
  const before = chs.slice(0, va), after = chs.slice(vb);
  // A look that waited through a space: the space joins the styled words on both sides of it.
  if (pend && typed.length && !/\s/.test(typed[0].c)) {
    for (let k = before.length - 1; k >= 0 && /[^\S\n]/.test(before[k].c); k--) {
      const prev = before[k - 1];
      if (k === 0 || prev.c === '\n') break;
      if (!/\s/.test(prev.c)) { if (same(prev, look)) for (let q = k; q < before.length; q++) Object.assign(before[q], look); break; }
    }
  }
  const prev = typed.length ? typed[typed.length - 1] : before[before.length - 1];
  const next = after[0];
  const caretLook: Look = typed.length && prev.c !== '\n' ? look : prev && prev.c !== '\n' ? prev : next && next.c !== '\n' ? next : PLAIN;
  const out = markdown([...before, ...typed, { c: CARET, i: caretLook.i, b: caretLook.b, h: caretLook.h, at: -1 }, ...after]);
  const caret = out.indexOf(CARET);
  const text = out.slice(0, caret) + out.slice(caret + 1);
  // A space typed at the end of styled words sits outside their marks; the look waits for the next word.
  const last = typed.length ? typed[typed.length - 1] : null;
  const waits = last && /[^\S\n]/.test(last.c) && (look.i || look.b || look.h) && !same(stylesAt(text, caret), look);
  return { text, caret, pend: waits ? look : null };
}

/** Lines whose marks are laid out in a way `markdown` would not write (italics inside bold): the older rules of
 * insertText, which keep marks whole but leave spaces where they fall. */
function fallback(old: string, chs: Ch[], a: number, b: number, ins: string, back: boolean): Edited {
  let r = insertText(old, a, b, ins);
  if (!ins && r.text === old) {
    const vis = (p: number) => { let n = 0; while (n < chs.length && chs[n].at < p) n++; return n; };
    const va = vis(a), vb = vis(b);
    if (back && va > 0) r = insertText(old, chs[va - 1].at, Math.max(b, chs[va - 1].at + 1), '');
    else if (!back && vb < chs.length) r = insertText(old, Math.min(a, chs[vb].at), chs[vb].at + 1, '');
  }
  return { text: r.text, caret: r.caret, pend: null };
}

/** Where the cursor rests beside hidden marks: inside styled words from their first letter to their last, never on the
 * far side of a mark, where it would look the same and type plain. */
export function restAt(line: string, p: number): number {
  const rs = allRuns(line);
  for (let moved = true, n = 0; moved && n < 6; n++) {
    moved = false;
    for (const r of rs) {
      if (p >= r.from && p < r.from + r.mark) { p = r.from + r.mark; moved = true; }
      else if (p > r.to - r.mark && p <= r.to) { p = r.to - r.mark; moved = true; }
    }
  }
  return p;
}

/** The words from `a` to `b` for the clipboard: plain, and as simple HTML with their italics, bold and highlighting. */
export function clip(text: string, a: number, b: number): { plain: string; html: string } {
  const ls = text.lastIndexOf('\n', a - 1) + 1;
  let le = text.indexOf('\n', b);
  if (le < 0) le = text.length;
  const chs = letters(text.slice(ls, le)).filter((c) => c.at + ls >= a && c.at + ls < b);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = groups(chs, (c) => (c.c === '\n' ? 'n' : (c.h ? 'h' : '') + (c.b ? 'b' : '') + (c.i ? 'i' : ''))).map((g) => {
    if (g.key === 'n') return g.chs.map(() => '<br>').join('');
    let s = esc(g.chs.map((c) => c.c).join(''));
    if (g.key.includes('i')) s = '<em>' + s + '</em>';
    if (g.key.includes('b')) s = '<strong>' + s + '</strong>';
    if (g.key.includes('h')) s = '<mark>' + s + '</mark>';
    return s;
  }).join('');
  return { plain: chs.map((c) => c.c).join(''), html: '<span style="white-space: pre-wrap">' + html + '</span>' };
}
