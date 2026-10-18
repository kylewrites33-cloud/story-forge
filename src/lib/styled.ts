// The writing screen's styled view of a scene's Markdown: *italics* and **bold** shown slanted and heavy, with their stars
// kept (faint) so every character of the file stays on screen and in place. Nothing here changes the text; the HTML holds
// exactly the same characters, so the cursor's position in the HTML is its position in the file.

import { mentions, type Matcher } from './codex.ts';

/** What else the page marks, beyond emphasis: codex names (underlined in their colour) and the words Find is looking for. */
export interface StyleOptions {
  names?: Matcher | null;
  find?: string;
  /** Show [brackets] (asks for the team) as marked words; those in `asking` (by their words) as being worked on. */
  asks?: boolean;
  asking?: Set<string>;
  /** Lines the team or another place added, shown with a dot beside them. */
  added?: Set<string>;
}

// [words] that are not [[links]], [!callouts], [^footnotes] or [text](links): the same rule as brackets.ts.
const ASK = /\[(?![[!^])([^[\]\n]{0,400})\](?![([:\]])/g;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Run { from: number; to: number; open: number; close: number; cls: 'b' | 'i' | 'bi' }

/** Emphasis runs on one line, CommonMark-like enough for prose. Stars come in runs (*, **, ***). A run opens when a
 * non-space follows it (a single star glued to a letter or digit before it, as in 2*3, does not), and closes at the next
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
    if (o.n === 1 && o.at > 0 && /[A-Za-z0-9]/.test(line[o.at - 1])) continue;
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
      if (m.index > 0 && s[m.index - 1] === '[') continue;
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

/** One line as HTML: highlighter marks and emphasis runs styled, their marks faint, inner runs (italics inside bold) styled too. */
function lineHtml(line: string, o: StyleOptions = {}): string {
  const hs = marks(line);
  if (hs.length) {
    let html = '', at = 0;
    hs.forEach((h) => {
      html += starHtml(line.slice(at, h.from), o) + '<span class="md-hl"><span class="md-mark">==</span>' + starHtml(line.slice(h.from + 2, h.to - 2), o) + '<span class="md-mark">==</span></span>';
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
    html += '<span class="md-' + r.cls + '"><span class="md-mark">' + '*'.repeat(r.open) + '</span>' + starHtml(inner, o) +
      '<span class="md-mark">' + '*'.repeat(r.close) + '</span></span>';
    at = r.to;
  });
  return html + leaf(line.slice(at), o);
}

/** Every emphasis run and highlighter mark on a line, nested ones too, as absolute positions with their mark lengths. */
function allRuns(line: string, base = 0): { from: number; to: number; mark: number }[] {
  const out: { from: number; to: number; mark: number }[] = [];
  marks(line).forEach((h) => {
    out.push({ from: base + h.from, to: base + h.to, mark: 2 });
  });
  const walk = (s: string, b: number) => {
    runs(s).forEach((r) => {
      out.push({ from: b + r.from, to: b + r.to, mark: r.open });
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
  return text.split('\n').map((line) => {
    const html = /^\s*>/.test(line) ? '<span class="md-quote">' + lineHtml(line, o) + '</span>' : lineHtml(line, o);
    return o.added && line.trim() && o.added.has(line) ? '<span class="md-added">' + html + '</span>' : html;
  }).join('\n');
}

/** The text an HTML string from styledHtml holds, for tests: tags removed, entities read back. */
export function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
