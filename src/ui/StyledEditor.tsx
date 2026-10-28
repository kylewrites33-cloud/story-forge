// The writing box with styles: an editable page that looks like a word processor's. *Italics*, **bold** and ==marks==
// show styled with no stars or equals signs on the page; each styled span keeps its mark in `data-m`, and readText puts
// the marks back, so every edit is read back as the scene's Markdown and the file never gains anything the writer did
// not type. New lines, pasting, copying, bold and italic and undo are handled here, so the browser never adds its own
// formatting.
import { useEffect, useRef } from 'preact/hooks';
import { bodyWords } from '../lib/drafts.ts';
import { wordsNotTyped } from '../lib/pomodoro.ts';
import { insertText, piecesToMarkdown, styledHtml, stylesAt, toggleStyle, unstyle, type StyleKind, type StyleOptions } from '../lib/styled.ts';

// Stand-ins for the start and end of the selection while the page is read back; private-use characters no prose holds.
const START = '\uE000', END = '\uE001';
// The invisible character inside a "pending" span: bold or italic pressed with no word under the cursor waits there for
// the next letters typed. It is never part of the text.
const WAIT = '\u200B';
const EDGE = /^[\s\uE000\uE001]*/, TAIL = /[\s\uE000\uE001]*$/;

interface Point { node: Node; offset: number; mark: string }
interface Look { i: boolean; b: boolean; h: boolean }

/** The mark an element on the page stands for: our own spans carry it in data-m; <i>, <b> or an inline style the browser
 * added while deleting (to keep a look) count too, unless the words already have that look. */
function markOf(el: HTMLElement, look: Look): string {
  if (el.dataset && el.dataset.m != null) return el.dataset.m;
  const tag = el.nodeName;
  const st = el.style || ({} as CSSStyleDeclaration);
  const italic = !look.i && (tag === 'I' || tag === 'EM' || st.fontStyle === 'italic');
  const bold = !look.b && (tag === 'B' || tag === 'STRONG' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600);
  const hl = !look.h && tag === 'MARK';
  return (hl ? '==' : '') + (italic && bold ? '***' : bold ? '**' : italic ? '*' : '');
}

const lookOf = (m: string, look: Look): Look => ({
  i: look.i || m.includes('*') && m.replace(/=/g, '').length !== 2,
  b: look.b || m.replace(/=/g, '').length >= 2,
  h: look.h || m.startsWith('==')
});

/** Marks around the words of one span, each line on its own; spaces at the edges go outside the marks (a run cannot
 * start or end with a space), and a span left with no words loses its marks. */
function wrap(inner: string, m: string): string {
  if (!m) return inner;
  const open = m, close = m.startsWith('==') && m.length > 2 ? m.slice(2) + '==' : m;
  return inner.split('\n').map((line) => {
    const lead = EDGE.exec(line)![0];
    const rest = line.slice(lead.length);
    const trail = TAIL.exec(rest)![0];
    const core = rest.slice(0, rest.length - trail.length);
    if (!core) return line;
    const lo = /\s/.test(lead) ? lead : '', li = lo ? '' : lead;
    const to = /\s/.test(trail) ? trail : '', ti = to ? '' : trail;
    return lo + open + li + core + ti + close + to;
  }).join('\n');
}

/** The Markdown of the page (or of a piece of it): text as it is, marks put back around styled spans, a line break
 * element as "\n" (except the last one, which only keeps an empty last line visible), and a block the browser added as
 * a new line. `points` are stand-in characters to put at places in the page (the selection). With `marks` false, the
 * words alone (for copying out). */
export function readText(root: Node, points: Point[] = [], marks = true): string {
  // The points by node, so a page with a stand-in at every piece of text (locator) is read in one pass.
  const byNode = new Map<Node, Point[]>();
  points.forEach((p) => { const list = byNode.get(p.node); if (list) list.push(p); else byNode.set(p.node, [p]); });
  const at = (n: Node, i: number) => { const list = byNode.get(n); return list ? list.filter((p) => p.offset === i).map((p) => p.mark).join('') : ''; };
  const walk = (n: Node, top: boolean, look: Look, waiting: boolean): string => {
    let out = '';
    n.childNodes.forEach((c, i) => {
      out += at(n, i);
      if (c.nodeType === 3) {
        let d = (c as Text).data;
        (byNode.get(c) || []).slice().sort((a, b) => b.offset - a.offset).forEach((p) => { d = d.slice(0, p.offset) + p.mark + d.slice(p.offset); });
        out += waiting ? d.split(WAIT).join('') : d;
      } else if (c.nodeName === 'BR') {
        if (!(top && i === n.childNodes.length - 1)) out += '\n';
      } else if (c.nodeType === 1) {
        const el = c as HTMLElement;
        if ((c.nodeName === 'DIV' || c.nodeName === 'P') && out && !out.endsWith('\n')) out += '\n';
        const m = markOf(el, look);
        const inner = walk(c, false, lookOf(m, look), waiting || Boolean(el.dataset && el.dataset.pending));
        out += marks ? wrap(inner, m) : inner;
      }
    });
    return out + at(n, n.childNodes.length);
  };
  return walk(root, true, { i: false, b: false, h: false }, false);
}

/** The page's Markdown and where the selection is in it, or null for the selection when it is not in the page. */
function readWithSelection(root: HTMLElement): { text: string; sel: { start: number; end: number } | null } {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !root.contains(sel.anchorNode)) return { text: readText(root), sel: null };
  const r = sel.getRangeAt(0);
  const raw = readText(root, [{ node: r.startContainer, offset: r.startOffset, mark: START }, { node: r.endContainer, offset: r.endOffset, mark: END }]);
  const a = raw.indexOf(START), b = raw.indexOf(END);
  const text = raw.replace(START, '').replace(END, '');
  if (a < 0 || b < 0) return { text, sel: null };
  const s = a - (b < a ? 1 : 0), e = b - (a < b ? 1 : 0);
  return { text, sel: { start: Math.min(s, e), end: Math.max(s, e) } };
}

export function selectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  return readWithSelection(root).sel;
}

/** Put the cursor (or a selection) at these places in the Markdown. A place inside a mark goes to the nearest words; a
 * place just after an opening mark goes inside the styled words, so typing there takes their style. */
export function setSelection(root: HTMLElement, start: number, end = start) {
  const find = locator(root);
  const sel = window.getSelection();
  if (!sel) return;
  const [sn, so] = find(start);
  const [en, eo] = find(end);
  const r = document.createRange();
  r.setStart(sn, so);
  r.setEnd(en, eo);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** Ranges on the page for these places in the Markdown, for highlights drawn over the words (Check, Listen) that never
 * change the text or the page's HTML. */
export function rangesIn(root: HTMLElement, spans: { start: number; end: number }[]): Range[] {
  if (!spans.length) return [];
  const find = locator(root);
  return spans.map((s) => {
    const r = document.createRange();
    const [sn, so] = find(s.start);
    const [en, eo] = find(Math.max(s.start, s.end));
    r.setStart(sn, so);
    r.setEnd(en, eo);
    return r;
  });
}

/** A place in the Markdown as a place on the page (a text node and an offset in it). */
function locator(root: HTMLElement): (want: number) => [Node, number] {
  // Where each piece of text starts in the Markdown: read the page once with a stand-in at the start of every piece, so
  // the places always agree with readText.
  const texts: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
  const raw = readText(root, texts.map((t) => ({ node: t, offset: 0, mark: START })));
  const starts: number[] = [];
  for (let i = 0, seen = 0; i < raw.length; i++) if (raw[i] === START) { starts.push(i - seen); seen++; }
  return (want: number): [Node, number] => {
    for (let j = 0; j < texts.length; j++) {
      if (want < starts[j]) return [texts[j], 0];
      if (want <= starts[j] + texts[j].data.length) return [texts[j], want - starts[j]];
    }
    const last = texts[texts.length - 1];
    return last ? [last, last.data.length] : [root, 0];
  };
}

/** What the page shows, for telling whether the browser's own edit already looks right: the words, with each letter's
 * look written before it whenever it differs from the letter before's. Spaces look the same styled or not. Written per
 * piece of text rather than per letter, which kept typing slow in a long chapter on the iPad (audit, 2026-10-23). */
function lookString(root: Node): string {
  let out = '';
  let last: string | null = null;
  const walk = (n: Node, cls: string, top: boolean) => {
    n.childNodes.forEach((c, i) => {
      if (c.nodeType === 3) {
        const d = (c as Text).data.split(WAIT).join('').replace(/\s/g, (s) => (s === '\n' ? '\n' : ' '));
        const at = d.search(/\S/);
        if (at < 0) out += d;
        else if (cls === last) out += d;
        else { out += d.slice(0, at) + '\u0001' + cls + '\u0002' + d.slice(at); last = cls; }
      } else if (c.nodeName === 'BR') { if (!(top && i === n.childNodes.length - 1)) out += '\n'; }
      else if (c.nodeType === 1) {
        const el = c as HTMLElement;
        walk(c, cls + (el.getAttribute('class') || '') + (el.getAttribute('style') || '') + '|', false);
      }
    });
  };
  walk(root, '', true);
  return out;
}

/** The words of a piece of HTML (a paste) with their italics, bold and highlighting, as Markdown. */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const pieces: { text: string; i: boolean; b: boolean; h: boolean }[] = [];
  let pre = false;
  const text = () => pieces.map((p) => p.text).join('');
  const block = () => {
    const t = text();
    if (!t) return;
    const nl = /\n*$/.exec(t)![0].length;
    if (nl < 2) pieces.push({ text: '\n'.repeat(2 - nl), i: false, b: false, h: false });
  };
  const walk = (n: Node, look: Look, keep: boolean) => {
    n.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        let d = (c as Text).data;
        if (!keep) d = d.replace(/[ \t\r\n]+/g, ' ');
        else pre = true;
        if (d) pieces.push({ text: d.replace(/\r\n?/g, '\n'), ...look });
        return;
      }
      if (c.nodeType !== 1) return;
      const el = c as HTMLElement;
      const tag = el.nodeName;
      if (/^(STYLE|SCRIPT|META|TITLE|HEAD|LINK)$/.test(tag)) return;
      if (tag === 'BR') { pieces.push({ text: '\n', i: false, b: false, h: false }); return; }
      const st = el.style;
      const next = { ...look };
      if (tag === 'I' || tag === 'EM' || tag === 'CITE') next.i = true;
      if (tag === 'B' || tag === 'STRONG') next.b = true;
      if (tag === 'MARK') next.h = true;
      if (st && st.fontStyle === 'italic') next.i = true;
      else if (st && st.fontStyle === 'normal') next.i = false;
      if (st && (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600)) next.b = true;
      else if (st && (st.fontWeight === 'normal' || (st.fontWeight && Number(st.fontWeight) < 600))) next.b = false;
      const isBlock = /^(P|DIV|LI|H[1-6]|BLOCKQUOTE|TR|PRE|UL|OL|TABLE)$/.test(tag);
      if (isBlock) block();
      walk(c, next, keep || tag === 'PRE' || Boolean(st && /^pre/.test(st.whiteSpace)));
      if (isBlock) block();
    });
  };
  walk(doc.body, { i: false, b: false, h: false }, false);
  let md = piecesToMarkdown(pieces);
  if (!pre) md = md.replace(/[ \t]*\n[ \t]*/g, '\n');
  return md.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}

/** A piece of the page (a copy) as simple HTML, styles as <em>, <strong> and <mark>, keeping its spaces and lines. */
function htmlOf(root: Node): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const walk = (n: Node, look: Look): string => {
    let out = '';
    n.childNodes.forEach((c) => {
      if (c.nodeType === 3) out += esc((c as Text).data.split(WAIT).join(''));
      else if (c.nodeName === 'BR') out += '<br>';
      else if (c.nodeType === 1) {
        const m = markOf(c as HTMLElement, look);
        const next = lookOf(m, look);
        let inner = walk(c, next);
        if (next.i && !look.i) inner = '<em>' + inner + '</em>';
        if (next.b && !look.b) inner = '<strong>' + inner + '</strong>';
        if (next.h && !look.h) inner = '<mark>' + inner + '</mark>';
        out += inner;
      }
    });
    return out;
  };
  return '<span style="white-space: pre-wrap">' + walk(root, { i: false, b: false, h: false }) + '</span>';
}

/** What a paste or a drop brings: its italics and bold when it has any (from a word processor, a web page or this page),
 * otherwise its plain text. */
function pasted(dt: DataTransfer | null): string {
  if (!dt) return '';
  const plain = (dt.getData('text/plain') || '').replace(/\r\n?/g, '\n');
  const html = dt.getData('text/html');
  if (html && /<(em|i|b|strong|mark|cite)\b|font-style:\s*italic|font-weight:\s*(bold|[6-9]00)/i.test(html)) {
    try {
      const md = htmlToMarkdown(html);
      if (md.trim()) return md;
    } catch { /* fall back to the plain text */ }
  }
  return plain;
}

interface Step { text: string; caret: number; at: number }

/** What the tool row above the page can ask the writing box to do. */
export interface EditorCommands {
  bold: () => void; italic: () => void; undo: () => void; redo: () => void;
  /** Normal: take bold, italic and highlighter marks off the selection. */
  plain: () => void;
  highlight: () => void;
  /** Select these characters and bring them into view (Find, a mark in the list). */
  select: (start: number, end: number) => void;
  /** Replace these characters, as one step to undo. */
  replaceRange: (start: number, end: number, text: string) => void;
  /** Replace the whole text, as one step to undo (Replace all). */
  setAll: (text: string) => void;
  /** Where the selection (or the cursor) is, in characters of the text, or null before Kyle has been in the page. */
  selection: () => { start: number; end: number } | null;
  /** Words that came from somewhere else (the team, another device): the new text, and how Kyle's cursor moves with it.
   * The cursor stays in his sentence and the page keeps focus; it is one step to undo. */
  apply: (text: string, map: (n: number) => number) => void;
}

/** Scroll the selection into the middle of the screen. */
/** The nearest box around `el` that scrolls (the writing page), or the document's. */
function scroller(el: Element | null): HTMLElement {
  let e = el ? el.parentElement : null;
  while (e && !(e.scrollHeight > e.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(e).overflowY))) e = e.parentElement;
  return e || (document.scrollingElement as HTMLElement) || document.documentElement;
}

/** Scroll the page so the selection sits about a third of the way down. It measures the selection itself: a plain line
 * has the whole editor as its parent, and centring that sent the page far off (Kyle, 2026-10-28). */
export function showSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  let r = range.getBoundingClientRect();
  if (!r.height && !r.width) {
    const n = range.startContainer;
    const el = (n.nodeType === 3 ? n.parentElement : n) as HTMLElement | null;
    if (!el) return;
    r = el.getBoundingClientRect();
  }
  const n = range.startContainer;
  const box = scroller(n.nodeType === 3 ? n.parentElement : (n as Element));
  const b = box === document.scrollingElement ? { top: 0, height: window.innerHeight } : box.getBoundingClientRect();
  if (r.top >= b.top + 40 && r.bottom <= b.top + b.height - 40) return;
  box.scrollTop += r.top - b.top - b.height / 3;
}

/** Run a command without the page jumping: focus, repainting the text and the iPad's own scrolling to the caret can each
 * move the page (Kyle, 2026-10-28: "right after I tap the italicize button, the word processing screen jumps away"). */
function keepPlace(el: HTMLElement | null, fn: () => void) {
  if (!el) { fn(); return; }
  const box = scroller(el);
  const top = box.scrollTop;
  fn();
  box.scrollTop = top;
  requestAnimationFrame(() => { box.scrollTop = top; });
}

export function StyledEditor({ value, onChange, onCaret, label, commands, options, onName, onLook }: {
  /** The text to start with. Later changes to it are ignored; give the editor a new key to load other text. */
  value: string;
  onChange: (text: string) => void;
  /** Where the cursor is, in characters from the start, for Split here. */
  onCaret: (offset: number) => void;
  label: string;
  /** Filled in with the tool row's commands. */
  commands?: { current: EditorCommands | null };
  /** Names to underline and words to find. A change repaints the page and keeps the cursor. */
  options?: StyleOptions;
  /** A codex name in the text was pressed: its index in options.names.entries. */
  onName?: (entry: number) => void;
  /** Whether what is typed at the cursor will be italic, bold or highlighted, for the tool row's buttons. */
  onLook?: (look: Look) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The last selection in the page. A button press can move focus away first, so bold and italic fall back to it.
  const lastSel = useRef<{ start: number; end: number } | null>(null);
  const shown = useRef<string | null>(null);
  const html = useRef('');
  const composing = useRef(false);
  const undo = useRef<Step[]>([]);
  const redo = useRef<Step[]>([]);
  const looked = useRef('');

  const opts = useRef<StyleOptions>(options || {});
  opts.current = options || {};
  const paint = (text: string, caret: number | null) => {
    const el = ref.current;
    if (!el) return;
    const h = styledHtml(text, opts.current) + '<br>';
    if (el.innerHTML !== h) el.innerHTML = h;
    html.current = h;
    shown.current = text;
    if (caret != null) setSelection(el, caret);
  };

  // Drawn once. Typing never comes back through `value` (a render can arrive after newer keystrokes); a change from
  // outside (a copy restored, a split or a join) remounts the editor with a new key instead.
  useEffect(() => { paint(value, null); }, []);
  // New names or a new search: repaint, keeping the selection where it was.
  const names = options && options.names, find = options && options.find, added = options && options.added, asking = options && options.asking;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const el = ref.current;
    if (!el || shown.current == null) return;
    const s = document.activeElement === el ? selectionOffsets(el) : null;
    paint(shown.current, null);
    if (s) setSelection(el, s.start, s.end);
  }, [names, find, added, asking]);

  const remember = (text: string, caret: number) => {
    const now = Date.now();
    const top = undo.current[undo.current.length - 1];
    // Typing within a second or two counts as one step to undo.
    if (top && now - top.at < 1500) top.at = now;
    else undo.current.push({ text: shown.current ?? text, caret, at: now });
    if (undo.current.length > 200) undo.current.shift();
    redo.current = [];
  };

  /** Tell the tool row the look at the cursor: the text's own, or a style waiting for the next letters. */
  const tellLook = () => {
    const el = ref.current;
    if (!el || !onLook) return;
    const s = document.activeElement === el ? selectionOffsets(el) : lastSel.current;
    const look = s ? stylesAt(shown.current ?? '', s.start) : { i: false, b: false, h: false };
    const wait = el.querySelector('[data-pending]') as HTMLElement | null;
    if (wait && wait.dataset.off) look[wait.dataset.off as StyleKind] = false;
    else if (wait) Object.assign(look, lookOf(wait.dataset.m || '', look));
    const key = JSON.stringify(look);
    if (key !== looked.current) { looked.current = key; onLook(look); }
  };

  /** Take away a style that was waiting for the next letters, leaving the cursor where it was. */
  const dropWaiting = () => {
    const el = ref.current;
    const wait = el && el.querySelector('[data-pending]');
    if (!el || !wait) return false;
    const s = document.activeElement === el ? selectionOffsets(el) : null;
    // The text has not changed; drawing it again puts back any styled words the waiting span split.
    if (shown.current != null) paint(shown.current, null);
    if (s) setSelection(el, s.start, s.end);
    return true;
  };

  /** Bold, Italic or Highlight: style the selection or the word under the cursor, or take the style off; with the cursor
   * between words, the next letters typed take the style (or leave it). */
  const toggle = (kind: StyleKind) => {
    const el = ref.current;
    if (!el) return;
    const text = shown.current ?? '';
    const sel = selectionOffsets(el) || lastSel.current || { start: text.length, end: text.length };
    if (dropWaiting()) { tellLook(); return; }
    const r = toggleStyle(text, sel.start, sel.end, kind);
    if (r) {
      if (r.text !== text) {
        remember(text, sel.start);
        undo.current[undo.current.length - 1].at = 0;
        commit(r.text, r.end);
      }
      setSelection(el, r.start, r.end);
      lastSel.current = { start: r.start, end: r.end };
      tellLook();
      return;
    }
    // No word under the cursor: a small invisible styled span waits there for the next letters.
    setSelection(el, sel.start);
    const range = window.getSelection()!.getRangeAt(0);
    const on = !stylesAt(text, sel.start)[kind];
    const wait = document.createElement('span');
    wait.dataset.pending = '1';
    wait.textContent = WAIT;
    if (on) {
      wait.className = kind === 'h' ? 'md-hl' : 'md-' + kind;
      wait.dataset.m = kind === 'h' ? '==' : kind === 'b' ? '**' : '*';
      range.insertNode(wait);
    } else {
      // Leaving the style: the span goes just outside the styled words the cursor is at the edge of, keeping any other
      // style they had (bold and italic, leaving italic, stays bold).
      let node: Node | null = range.startContainer;
      let host: HTMLElement | null = null;
      while (node && node !== el) {
        if (node.nodeType === 1 && (node as HTMLElement).dataset.m != null && lookOf((node as HTMLElement).dataset.m!, { i: false, b: false, h: false })[kind]) { host = node as HTMLElement; break; }
        node = node.parentNode;
      }
      if (!host) return;
      const m = host.dataset.m!;
      const keep = m === '***' ? (kind === 'i' ? '**' : '*') : '';
      if (keep) { wait.dataset.m = keep; wait.className = keep === '**' ? 'md-b' : 'md-i'; }
      else wait.dataset.m = '';
      wait.dataset.off = kind;
      // Split the styled words at the cursor and put the span between the halves (an empty half reads as nothing).
      const rest = document.createRange();
      rest.setStart(range.startContainer, range.startOffset);
      rest.setEndAfter(host);
      const tail = rest.extractContents();
      host.parentNode!.insertBefore(wait, host.nextSibling);
      host.parentNode!.insertBefore(tail, wait.nextSibling);
    }
    const r2 = document.createRange();
    r2.setStart(wait.firstChild!, 1);
    r2.collapse(true);
    const ws = window.getSelection()!;
    ws.removeAllRanges();
    ws.addRange(r2);
    tellLook();
  };

  const commit = (text: string, caret: number) => {
    paint(text, caret);
    onChange(text);
    onCaret(caret);
  };

  /** Replace the selection with `insert`, the way typing would. */
  const replace = (insert: string) => {
    const el = ref.current;
    if (!el) return;
    const text = shown.current ?? '';
    const sel = selectionOffsets(el) || lastSel.current || { start: text.length, end: text.length };
    remember(text, sel.start);
    undo.current[undo.current.length - 1].at = 0;
    const r = insertText(text, sel.start, sel.end, insert);
    commit(r.text, r.caret);
    lastSel.current = { start: r.caret, end: r.caret };
  };

  const step = (from: { current: Step[] }, to: { current: Step[] }) => {
    const s = from.current.pop();
    if (!s) return;
    // Words brought back by undo or redo were counted when they first went on the page, so they are not typed again.
    wordsNotTyped(bodyWords(s.text) - bodyWords(shown.current ?? ''));
    to.current.push({ text: shown.current ?? '', caret: (ref.current && selectionOffsets(ref.current)?.start) || 0, at: 0 });
    commit(s.text, Math.min(s.caret, s.text.length));
  };

  const onBeforeInput = (e: InputEvent) => {
    const t = e.inputType;
    if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); replace('\n'); }
    else if (t === 'formatBold') { e.preventDefault(); toggle('b'); }
    else if (t === 'formatItalic') { e.preventDefault(); toggle('i'); }
    else if (t.startsWith('format')) e.preventDefault();
    else if (t === 'historyUndo') { e.preventDefault(); step(undo, redo); }
    else if (t === 'historyRedo') { e.preventDefault(); step(redo, undo); }
    else if (t === 'insertFromPaste' || t === 'insertFromDrop') {
      e.preventDefault();
      const data = pasted(e.dataTransfer);
      if (data) replace(data);
    } else if (!composing.current && ref.current) {
      const s = selectionOffsets(ref.current);
      remember(shown.current ?? '', s ? s.start : 0);
    }
  };

  // Typing, deleting, autocorrect: let the browser do it, then read the text back and restyle what changed.
  const onInput = () => {
    const el = ref.current;
    if (!el || composing.current) return;
    const { text, sel: s } = readWithSelection(el);
    const caret = s ? s.start : text.length;
    lastSel.current = s;
    const h = styledHtml(text, opts.current) + '<br>';
    shown.current = text;
    // Typing at the very end replaces the page's last line break, which only keeps an empty last line visible: that page
    // looks the same as `h`, so it is left as it is without the slower check below (audit, 2026-10-23).
    const now = el.innerHTML;
    if (now !== h && now + '<br>' !== h) {
      // Repaint only when the page would look different: a space typed at the end of italic words stays inside them
      // on the page (so the next word is italic too), while the text keeps the space outside the stars.
      const want = document.createElement('div');
      want.innerHTML = h;
      if (lookString(el) !== lookString(want) || el.querySelector('[data-pending]')) { el.innerHTML = h; setSelection(el, caret); }
    }
    html.current = h;
    onChange(text);
    onCaret(caret);
    tellLook();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const mod = (e.ctrlKey || e.metaKey) && !e.altKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) step(redo, undo); else step(undo, redo); }
    else if (mod && k === 'y') { e.preventDefault(); step(redo, undo); }
    else if (mod && !e.shiftKey && k === 'b') { e.preventDefault(); toggle('b'); }
    else if (mod && !e.shiftKey && k === 'i') { e.preventDefault(); toggle('i'); }
    // Moving or deleting drops a style that was waiting for letters; the key then does its usual job.
    else if (/^(Arrow|Backspace|Delete|Home|End|Page|Enter|Tab)/.test(e.key)) dropWaiting();
  };

  const onPaste = (e: ClipboardEvent) => {
    // Some browsers skip beforeinput for paste; this catches them.
    if (e.defaultPrevented) return;
    e.preventDefault();
    const data = pasted(e.clipboardData);
    if (data) replace(data);
  };

  /** Copy: the words with their italics and bold for other apps (and this page), the words alone as plain text. */
  const copy = (e: ClipboardEvent, cut: boolean) => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount || !e.clipboardData) return;
    const r = sel.getRangeAt(0);
    if (r.collapsed || !el.contains(r.commonAncestorContainer)) return;
    let piece: Node = r.cloneContents();
    // The styled spans the whole selection sits inside are not in the copy; wrap it in them so it keeps its look.
    for (let n: Node | null = r.commonAncestorContainer; n && n !== el; n = n.parentNode) {
      if (n.nodeType !== 1) continue;
      const shell = n.cloneNode(false);
      shell.appendChild(piece);
      piece = shell;
    }
    const box = document.createElement('div');
    box.appendChild(piece);
    e.preventDefault();
    e.clipboardData.setData('text/plain', readText(box, [], false));
    e.clipboardData.setData('text/html', htmlOf(box));
    if (cut) replace('');
  };

  const mark = () => {
    const el = ref.current;
    if (!el) return;
    const wait = el.querySelector('[data-pending]');
    const sel = window.getSelection();
    if (wait && !(sel && sel.anchorNode && wait.contains(sel.anchorNode))) dropWaiting();
    const s = selectionOffsets(el);
    if (s) { lastSel.current = s; onCaret(s.start); }
    tellLook();
  };

  if (commands) {
    const focus = () => { const el = ref.current; if (el && document.activeElement !== el) { el.focus({ preventScroll: true }); if (lastSel.current) setSelection(el, lastSel.current.start, lastSel.current.end); } };
    commands.current = {
      bold: () => keepPlace(ref.current, () => { focus(); toggle('b'); }),
      italic: () => keepPlace(ref.current, () => { focus(); toggle('i'); }),
      undo: () => { focus(); step(undo, redo); },
      redo: () => { focus(); step(redo, undo); },
      highlight: () => keepPlace(ref.current, () => { focus(); toggle('h'); }),
      plain: () => {
        focus();
        const el = ref.current;
        if (!el) return;
        const text = shown.current ?? '';
        const sel = selectionOffsets(el) || lastSel.current || { start: 0, end: 0 };
        const r = unstyle(text, sel.start, sel.end);
        if (r.text === text) return;
        remember(text, sel.start);
        undo.current[undo.current.length - 1].at = 0;
        commit(r.text, r.end);
        setSelection(el, r.start, r.end);
        lastSel.current = { start: r.start, end: r.end };
      },
      selection: () => { const el = ref.current; return (el && document.activeElement === el && selectionOffsets(el)) || lastSel.current; },
      select: (a, b) => {
        const el = ref.current;
        if (!el) return;
        el.focus({ preventScroll: true });
        if (shown.current != null && el.innerHTML !== html.current) paint(shown.current, null);
        setSelection(el, a, b);
        lastSel.current = { start: a, end: b };
        onCaret(a);
        showSelection();
        // The iPad's keyboard slides up after the focus and can push the spot out of sight; show it again once it has.
        setTimeout(showSelection, 400);
      },
      replaceRange: (a, b, t) => {
        const el = ref.current;
        if (!el) return;
        const text = shown.current ?? '';
        remember(text, a);
        undo.current[undo.current.length - 1].at = 0;
        commit(text.slice(0, a) + t + text.slice(b), a + t.length);
        lastSel.current = { start: a + t.length, end: a + t.length };
      },
      apply: (t, map) => {
        const el = ref.current;
        const text = shown.current ?? '';
        if (!el || t === text) return;
        const inside = document.activeElement === el;
        const s = (inside && selectionOffsets(el)) || lastSel.current;
        remember(text, s ? s.start : 0);
        undo.current[undo.current.length - 1].at = 0;
        paint(t, null);
        if (s) {
          const a = map(s.start), b = map(s.end);
          lastSel.current = { start: a, end: b };
          if (inside) setSelection(el, a, b);
        }
        onChange(t);
      },
      setAll: (t) => {
        const text = shown.current ?? '';
        if (t === text) return;
        remember(text, 0);
        undo.current[undo.current.length - 1].at = 0;
        commit(t, 0);
      }
    };
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const before = (e: Event) => onBeforeInput(e as InputEvent);
    el.addEventListener('beforeinput', before);
    return () => el.removeEventListener('beforeinput', before);
  });

  return (
    <div
      ref={ref}
      class="writer-text styled"
      contentEditable
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      spellcheck
      autocapitalize="sentences"
      onInput={onInput}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onCopy={(e) => copy(e, false)}
      onCut={(e) => copy(e, true)}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={() => { composing.current = false; onInput(); }}
      onKeyUp={mark}
      onMouseUp={mark}
      onTouchEnd={mark}
      onBlur={mark}
      onClick={(e) => {
        const hit = onName && (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('[data-ref]') as HTMLElement | null;
        if (hit && onName) onName(Number(hit.dataset.ref));
      }}
    />
  );
}
