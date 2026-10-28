// The writing screen's styled view of a scene's Markdown: *italics* and **bold** shown slanted and heavy and ==marks==
// highlighted, the way a word processor shows them. The stars and equals signs are not on the page: each styled span
// carries its mark in `data-m`, so the page can always be read back to exactly the Markdown it came from (see
// StyledEditor's readText). Nothing here changes the text.

import { ASK_RE } from './brackets.ts';
import { mentions, type Matcher } from './codex.ts';

/** What else the page marks, beyond emphasis: codex names (underlined in their colour) and the words Find is looking for. */
export interface StyleOptions {
  names?: Matcher | null;
  find?: string;
  /** Show {braces} (asks for the team) as marked words; those in `asking` (by their words) as being worked on. */
  asks?: boolean;
  asking?: Set<string>;
  /** Lines the team or another place added, shown with a dot beside them. */
  added?: Set<string>;
}

// {words}: the same rule as brackets.ts.
const ASK = ASK_RE;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Run { from: number; to: number; open: number; close: number; cls: 'b' | 'i' | 'bi' }

/** Emphasis runs on one line, CommonMark-like enough for prose. Stars come in runs (*, **, ***). A run opens when a
 * non-space follows it (a single star between digits, as in 2*3, does not), and closes at the next
 * run of the same length with a non-space before it. *** is bold and italic; runs never cross a line; runs of other
 * lengths in between are left for the inner text, so *a **b** c* nests. */
export function runs(line: string): Run[] {
  const stars: { at: number; n: number }[] = [];
  const re = /\*+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) stars.push({ at: m.index, n: m[0].length });
  const out: Run[] = [];
  for (let k = 0; k < stars.length; k++) {
    const o = stars[k];
    if (o.n > 3) continue;
    const after = line[o.at + o.n];
    if (after === undefined || /\s/.test(after)) continue;
    // A star between two digits (2*3) is arithmetic; glued to a word (un*believ*able) it is emphasis.
    if (o.n === 1 && o.at > 0 && /[0-9]/.test(line[o.at - 1]) && /[0-9]/.test(after)) continue;
    let c = -1;
    for (let q = k + 1; q < stars.length; q++) {
      if (stars[q].n === o.n && !/\s/.test(line[stars[q].at - 1])) { c = q; break; }
    }
    if (c < 0) continue;
    out.push({ from: o.at, to: stars[c].at + o.n, open: o.n, close: o.n, cls: o.n === 3 ? 'bi' : o.n === 2 ? 'b' : 'i' });
    k = c;
  }
  return out;
}

/** Highlighter marks on one line: ==text== with no space just inside the marks. */
export function marks(line: string): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  const re = /==(?=[^\s=])(.*?[^\s=])==/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push({ from: m.index, to: m.index + m[0].length });
  return out;
}

/** Where a search falls in a text, ignoring case. */
export function findAll(text: string, q: string): number[] {
  const out: number[] = [];
  if (!q) return out;
  const t = text.toLowerCase(), k = q.toLowerCase();
  for (let i = t.indexOf(k); i >= 0; i = t.indexOf(k, i + k.length)) out.push(i);
  return out;
}

/** Plain text with names and Find matches wrapped; every character kept. */
function leaf(s: string, o: StyleOptions): string {
  if (!s || (!o.names && !o.find && !o.asks)) return esc(s);
  const spans: { from: number; to: number; open: string }[] = [];
  if (o.asks) {
    ASK.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ASK.exec(s))) {
      if (m.index > 0 && s[m.index - 1] === '{') continue;
      const busy = o.asking && o.asking.has(m[0].trim().toLowerCase());
      spans.push({ from: m.index, to: m.index + m[0].length, open: '<span class="md-ask' + (busy ? ' asking' : '') + '">' });
    }
  }
  if (o.find) findAll(s, o.find).forEach((i) => { if (!spans.some((x) => x.from < i + o.find!.length && x.to > i)) spans.push({ from: i, to: i + o.find!.length, open: '<span class="md-find">' }); });
  if (o.names) {
    mentions(s, o.names).forEach((m) => {
      if (spans.some((x) => x.from < m.to && x.to > m.from)) return;
      const e = o.names!.entries[m.entry];
      spans.push({ from: m.from, to: m.to, open: '<span class="md-name" data-ref="' + m.entry + '" style="--name:' + e.color.replace(/[^#a-zA-Z0-9%(),. ]/g, '') + '">' });
    });
  }
  if (!spans.length) return esc(s);
  spans.sort((a, b) => a.from - b.from);
  let html = '', at = 0;
  spans.forEach((x) => { html += esc(s.slice(at, x.from)) + x.open + esc(s.slice(x.from, x.to)) + '</span>'; at = x.to; });
  return html + esc(s.slice(at));
}

/** One line as HTML: highlighter marks and emphasis runs styled, their marks held in data-m, inner runs (italics inside bold) styled too. */
function lineHtml(line: string, o: StyleOptions = {}): string {
  const hs = marks(line);
  if (hs.length) {
    let html = '', at = 0;
    hs.forEach((h) => {
      html += starHtml(line.slice(at, h.from), o) + '<span class="md-hl" data-m="==">' + starHtml(line.slice(h.from + 2, h.to - 2), o) + '</span>';
      at = h.to;
    });
    return html + starHtml(line.slice(at), o);
  }
  return starHtml(line, o);
}

function starHtml(line: string, o: StyleOptions): string {
  const rs = runs(line);
  if (!rs.length) return leaf(line, o);
  let html = '';
  let at = 0;
  rs.forEach((r) => {
    html += leaf(line.slice(at, r.from), o);
    const inner = line.slice(r.from + r.open, r.to - r.close);
    html += '<span class="md-' + r.cls + '" data-m="' + '*'.repeat(r.open) + '">' + starHtml(inner, o) + '</span>';
    at = r.to;
  });
  return html + leaf(line.slice(at), o);
}

/** Every emphasis run and highlighter mark on a line, nested ones too, as absolute positions with their mark lengths. */
function allRuns(line: string, base = 0): { from: number; to: number; mark: number; m: string }[] {
  const out: { from: number; to: number; mark: number; m: string }[] = [];
  marks(line).forEach((h) => {
    out.push({ from: base + h.from, to: base + h.to, mark: 2, m: '==' });
  });
  const walk = (s: string, b: number) => {
    runs(s).forEach((r) => {
      out.push({ from: b + r.from, to: b + r.to, mark: r.open, m: '*'.repeat(r.open) });
      walk(s.slice(r.from + r.open, r.to - r.close), b + r.from + r.open);
    });
  };
  // Stars inside a highlight are runs of their own; read the line with the == marks blanked so they never pair across.
  walk(line.replace(/==/g, '  '), base);
  return out;
}

/** Normal: take away the bold, italic and highlighter marks of every run the selection touches (or the cursor sits in).
 * Returns the new text and where the selection is now. */
export function unstyle(text: string, start: number, end: number): { text: string; start: number; end: number } {
  const cut: [number, number][] = [];
  let lineStart = 0;
  text.split('\n').forEach((line) => {
    allRuns(line, lineStart).forEach((r) => {
      const hit = start === end ? r.from <= start && start <= r.to : r.from < end && r.to > start;
      if (hit) { cut.push([r.from, r.from + r.mark]); cut.push([r.to - r.mark, r.to]); }
    });
    lineStart += line.length + 1;
  });
  if (!cut.length) return { text, start, end };
  cut.sort((a, b) => a[0] - b[0]);
  let out = '', at = 0, s = start, e = end;
  cut.forEach(([a, b]) => {
    if (a < at) return;
    out += text.slice(at, a);
    const n = b - a;
    if (a < start) s -= Math.min(n, start - a);
    if (a < end) e -= Math.min(n, end - a);
    at = b;
  });
  return { text: out + text.slice(at), start: Math.max(0, s), end: Math.max(0, e) };
}

/** Every highlighter mark in the text, with the words it marks and where it starts. */
export function markList(text: string): { at: number; text: string }[] {
  const out: { at: number; text: string }[] = [];
  let lineStart = 0;
  text.split('\n').forEach((line) => {
    marks(line).forEach((h) => out.push({ at: lineStart + h.from, text: line.slice(h.from + 2, h.to - 2) }));
    lineStart += line.length + 1;
  });
  return out;
}

/** The whole text as HTML for the editor. Lines that start with ">" (callouts such as Team notes) are muted. */
export function styledHtml(text: string, o: StyleOptions = {}): string {
  // Each line's HTML depends only on the line and the options, so lines are kept per options object: typing one letter
  // works out one line again, not the whole chapter (audit, 2026-10-23).
  let done = made.get(o);
  if (!done || done.size > 5000) { done = new Map(); made.set(o, done); }
  const seen = done;
  return text.split('\n').map((line) => {
    let html = seen.get(line);
    if (html === undefined) {
      // A System screen line (Kyle, 2026-10-28: format C1): "> " starts it, shown faint, the line indented; a line
      // that is all bold is the screen's title, in small caps.
      const q = /^(\s*>\s?)(.*)$/.exec(line);
      html = q ? '<span class="md-quote' + (/^\*\*[^*].*\*\*$/.test(q[2].trim()) ? ' md-qt' : /^\[!/.test(q[2]) ? ' md-callout' : '') + '"><span class="md-qm">' + esc(q[1]) + '</span>' + lineHtml(q[2], o) + '</span>' : lineHtml(line, o);
      if (o.added && line.trim() && o.added.has(line)) html = '<span class="md-added">' + html + '</span>';
      seen.set(line, html);
    }
    return html;
  }).join('\n');
}
const made = new WeakMap<StyleOptions, Map<string, string>>();

/** The Markdown an HTML string from styledHtml holds, for tests: each span's data-m around its words, entities read back. */
export function textOf(html: string): string {
  const open: string[] = [];
  return html.replace(/<[^>]*>/g, (tag) => {
    if (!/^<\/?span\b/.test(tag)) return '';
    if (tag[1] === '/') return open.pop() || '';
    const m = (/ data-m="([^"]*)"/.exec(tag) || ['', ''])[1];
    open.push(m);
    return m;
  }).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export type StyleKind = 'i' | 'b' | 'h';
const MARK: Record<StyleKind, string> = { i: '*', b: '**', h: '==' };
const hasKind = (m: string, k: StyleKind) => (k === 'h' ? m === '==' : k === 'i' ? m === '*' || m === '***' : m === '**' || m === '***');
const WORD = /[\p{L}\p{N}'\u2019]/u;

interface Edit { at: number; del: number; ins: string }

function applyEdits(text: string, edits: Edit[], start: number, end: number) {
  // From the end backwards, so each edit's place is still right; at one place, a removal before an insertion.
  edits.sort((a, b) => b.at - a.at || b.del - a.del);
  const move = (p: number, after: boolean) => {
    edits.forEach((x) => {
      if (p > x.at + x.del || (x.del && p === x.at + x.del)) p += x.ins.length - x.del;
      else if (p > x.at) p = x.at + (after ? x.ins.length : 0);
      else if (p === x.at && after && !x.del) p += x.ins.length;
    });
    return p;
  };
  let out = text;
  edits.forEach((x) => { out = out.slice(0, x.at) + x.ins + out.slice(x.at + x.del); });
  return { text: out, start: move(start, true), end: Math.max(move(start, true), move(end, false)) };
}

/** The edits that give the characters from s to e (one line, positions on that line) the style, or take it away when
 * they all have it already. Whitespace at the edges stays outside the marks. */
function lineEdits(line: string, base: number, s: number, e: number, kind: StyleKind): Edit[] {
  while (s < e && /\s/.test(line[s])) s++;
  while (e > s && /\s/.test(line[e - 1])) e--;
  if (s >= e) return [];
  const rs = allRuns(line).map((r) => ({ ...r, cs: r.from + r.mark, ce: r.to - r.mark }));
  const markAt = new Set<number>();
  rs.forEach((r) => { for (let k = 0; k < r.mark; k++) { markAt.add(r.from + k); markAt.add(r.ce + k); } });
  const mine = rs.filter((r) => hasKind(r.m, kind));
  let full = true;
  for (let p = s; p < e && full; p++) if (!/\s/.test(line[p]) && !markAt.has(p) && !mine.some((r) => r.cs <= p && p < r.ce)) full = false;
  const m = MARK[kind];
  const edits: Edit[] = [];
  const drop = (r: typeof rs[number]) => {
    const keep = r.m === '***' ? (kind === 'i' ? '**' : '*') : '';
    edits.push({ at: base + r.from, del: r.mark, ins: keep }, { at: base + r.ce, del: r.mark, ins: keep });
  };
  if (full) {
    mine.filter((r) => r.cs < e && r.ce > s).forEach((r) => {
      if (r.m === '***' || (s <= r.cs && e >= r.ce)) { drop(r); return; }
      if (s <= r.cs) edits.push({ at: base + r.from, del: r.mark, ins: '' });
      else {
        let c = s;
        while (c > r.cs && /\s/.test(line[c - 1])) c--;
        edits.push({ at: base + c, del: 0, ins: m });
      }
      if (e >= r.ce) edits.push({ at: base + r.ce, del: r.mark, ins: '' });
      else {
        let o = e;
        while (o < r.ce && /\s/.test(line[o])) o++;
        edits.push({ at: base + o, del: 0, ins: m });
      }
    });
    return edits;
  }
  // Add: runs of the same style that the selection touches join it, and lose their own marks.
  let S = s, E = e, grew = true;
  const joined = new Set<typeof rs[number]>();
  while (grew) {
    grew = false;
    mine.forEach((r) => {
      if (!joined.has(r) && r.from < E && r.to > S) { joined.add(r); S = Math.min(S, r.from); E = Math.max(E, r.to); grew = true; }
    });
  }
  joined.forEach(drop);
  edits.push({ at: base + S, del: 0, ins: m }, { at: base + E, del: 0, ins: m });
  return edits;
}

/** Bold, Italic or Highlight pressed, the way a word processor does it: a selection gets the style, or loses it if it is
 * all styled already; a cursor inside a word styles (or unstyles) the word. Returns null when the cursor is not in a
 * word: the next letters typed should take the style instead (the editor handles that). */
export function toggleStyle(text: string, start: number, end: number, kind: StyleKind): { text: string; start: number; end: number } | null {
  const edits: Edit[] = [];
  let ls = 0;
  for (const line of text.split('\n')) {
    const le = ls + line.length;
    if (start === end) {
      if (start >= ls && start <= le) {
        const p = start - ls;
        if (!(p > 0 && p < line.length && WORD.test(line[p - 1]) && WORD.test(line[p]))) return null;
        let a = p, b = p;
        while (a > 0 && WORD.test(line[a - 1])) a--;
        while (b < line.length && WORD.test(line[b])) b++;
        edits.push(...lineEdits(line, ls, a, b, kind));
        break;
      }
    } else if (start < le && end > ls) edits.push(...lineEdits(line, ls, Math.max(0, start - ls), Math.min(line.length, end - ls), kind));
    ls = le + 1;
  }
  if (!edits.length) return start === end ? null : { text, start, end };
  return applyEdits(text, edits, start, end);
}

/** Which styles the letters typed at this place would take (the page puts the cursor inside a run from its first letter to its last). */
export function stylesAt(text: string, at: number): Record<StyleKind, boolean> {
  const out = { i: false, b: false, h: false };
  const ls = text.lastIndexOf('\n', at - 1) + 1;
  let le = text.indexOf('\n', at);
  if (le < 0) le = text.length;
  allRuns(text.slice(ls, le), ls).forEach((r) => {
    if (r.from + r.mark <= at && at <= r.to - r.mark) {
      (['i', 'b', 'h'] as StyleKind[]).forEach((k) => { if (hasKind(r.m, k)) out[k] = true; });
    }
  });
  return out;
}

/** Styled pieces of text (from a paste) as Markdown: each piece's marks around its words, spaces and line breaks outside. */
export function piecesToMarkdown(pieces: { text: string; i?: boolean; b?: boolean; h?: boolean }[]): string {
  const merged: { text: string; i: boolean; b: boolean; h: boolean }[] = [];
  pieces.forEach((p) => {
    const q = { text: p.text, i: !!p.i, b: !!p.b, h: !!p.h };
    const last = merged[merged.length - 1];
    if (last && last.i === q.i && last.b === q.b && last.h === q.h) last.text += q.text;
    else if (q.text) merged.push(q);
  });
  return merged.map((p) => {
    const m = (p.i && p.b ? '***' : p.b ? '**' : p.i ? '*' : '');
    if (!m && !p.h) return p.text;
    return p.text.split('\n').map((line) => {
      const lead = /^\s*/.exec(line)![0], trail = /\s*$/.exec(line.slice(lead.length))![0];
      const core = line.slice(lead.length, line.length - trail.length);
      if (!core) return line;
      const inner = m + core + m;
      return lead + (p.h ? '==' + inner + '==' : inner) + trail;
    }).join('\n');
  }).join('');
}

/** Take characters out of the text the way a word processor would: marks of styled words that go on outside the
 * selection stay, and styled words left with nothing inside lose their marks (unless `typing`: the words typed over
 * them take their style). Returns the text and where the selection was. */
function cut(text: string, start: number, end: number, typing: boolean): { text: string; at: number } {
  if (start >= end) return { text, at: start };
  const keep = new Set<number>();
  const gone = new Set<number>();
  let ls = 0;
  for (const line of text.split('\n')) {
    const le = ls + line.length;
    if (start <= le && end >= ls) {
      allRuns(line, ls).forEach((r) => {
        const cs = r.from + r.mark, ce = r.to - r.mark;
        const inOpen = start <= r.from && r.from < end, inClose = start < r.to && ce >= start && ce < end;
        if (start <= cs && end >= ce && !(inOpen && inClose) && !(typing && !inOpen && !inClose)) {
          // Nothing of its words is left: its marks go too.
          for (let k = 0; k < r.mark; k++) { gone.add(r.from + k); gone.add(ce + k); }
        } else if (inOpen !== inClose) for (let k = 0; k < r.mark; k++) keep.add((inOpen ? r.from : ce) + k);
      });
    }
    ls = le + 1;
  }
  let out = '', at = 0;
  for (let k = 0; k < text.length; k++) {
    if (gone.has(k) || ((k >= start && k < end) && !keep.has(k))) continue;
    out += text[k];
    if (k < start) at++;
  }
  return { text: out, at };
}

/** Type or paste `insert` over the selection. A new line inside styled words closes their marks before it and opens
 * them again after it (a run never crosses a line); at the very edge of styled words the line breaks outside them. */
export function insertText(text: string, start: number, end: number, insert: string): { text: string; caret: number } {
  const c = cut(text, start, end, Boolean(insert));
  text = c.text;
  let p = c.at;
  if (!insert.includes('\n')) return { text: text.slice(0, p) + insert + text.slice(p), caret: p + insert.length };
  const ls = text.lastIndexOf('\n', p - 1) + 1;
  let le = text.indexOf('\n', p);
  if (le < 0) le = text.length;
  const line = text.slice(ls, le);
  const rs = allRuns(line, ls).map((r) => ({ ...r, cs: r.from + r.mark, ce: r.to - r.mark }));
  // At the edge of styled words, break outside them.
  for (let moved = true; moved;) {
    moved = false;
    rs.forEach((r) => {
      if (p === r.cs) { p = r.from; moved = true; }
      else if (p === r.ce) { p = r.to; moved = true; }
    });
  }
  const around = rs.filter((r) => r.cs < p && p < r.ce).sort((a, b) => a.from - b.from || b.to - a.to);
  const openers = around.map((r) => r.m).join('');
  const closers = around.map((r) => r.m).reverse().join('');
  const pieces = insert.split('\n');
  const before = text.slice(0, p), after = text.slice(p);
  const lines = pieces.map((piece, k) => (k === 0 ? before.slice(ls) : '') + piece + (k === pieces.length - 1 ? after.slice(0, le - p) : ''));
  let caret = 0;
  const out = lines.map((l, k) => {
    let s = l;
    if (around.length && s.trim()) {
      if (k > 0) { const lead = /^\s*/.exec(s)![0]; s = lead + openers + s.slice(lead.length); }
      if (k < lines.length - 1) { const trail = /\s*$/.exec(s)![0]; s = s.slice(0, s.length - trail.length) + closers + trail; }
    }
    return s;
  });
  const head = text.slice(0, ls);
  // The cursor goes after the last piece typed: at the start of the last line, past its own opening marks when the line
  // has words of its own.
  const lastPiece = pieces[pieces.length - 1];
  caret = head.length + out.slice(0, -1).join('\n').length + 1;
  if (lastPiece) caret += out[out.length - 1].length - after.slice(0, le - p).length;
  else if (around.length && out[out.length - 1].trim()) caret += /^\s*/.exec(out[out.length - 1])![0].length + openers.length;
  return { text: head + out.join('\n') + text.slice(le), caret };
}
