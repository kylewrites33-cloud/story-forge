// The writing box (code structure redesign, step 3; Kyle's yes to the trial 2026-11-11, and on 2026-11-12, after typing in
// it, "Yes, move the writing page over"): CodeMirror 6 set up for prose. The page IS the scene's Markdown, shown as a
// word processor shows it: the stars of *italics* and **bold** and the equals signs of ==marks== are hidden, System
// screen lines ("> ") are indented, {asks}, codex names and Find's words are marked. Nothing is read back off the
// screen: a key changes only the line it is on, only the lines near the screen are drawn, and words from outside go in
// as small edits, so the page, the cursor and Undo stay put. What a key does beside a hidden mark is in
// `src/lib/prosedit.ts`; how a line is styled follows `src/lib/styled.ts` (the read-only pages still draw from it).
import { history, historyKeymap, insertNewline, isolateHistory, redo, standardKeymap, undo } from '@codemirror/commands';
import { Annotation, EditorState, StateEffect, StateField, Transaction, type Range, type TransactionSpec } from '@codemirror/state';
import { Decoration, EditorView, keymap, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { ASK_RE } from '../lib/brackets.ts';
import { mentions } from '../lib/codex.ts';
import { clip, edit, restAt, type Look } from '../lib/prosedit.ts';
import { allRuns, findAll, insertText, marks, runs, stylesAt, toggleStyle, unstyle, type StyleKind, type StyleOptions } from '../lib/styled.ts';
import { pasted } from './clipboard.ts';

const hide = Decoration.replace({});
const cls = (name: string) => Decoration.mark({ class: name });
type Out = Range<Decoration>[];

// ---- what the page marks: the same rules as lineHtml, starHtml and leaf in src/lib/styled.ts ----

/** Plain words between marks: {asks}, Find's words and codex names. */
function leaf(s: string, from: number, o: StyleOptions, out: Out): void {
  if (!s || (!o.names && !o.find && !o.asks)) return;
  const spans: { from: number; to: number; deco: Decoration }[] = [];
  if (o.asks) {
    const re = new RegExp(ASK_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (!m[0].length) { re.lastIndex++; continue; }
      if (m.index > 0 && s[m.index - 1] === '{') continue;
      const busy = o.asking && o.asking.has(m[0].trim().toLowerCase());
      spans.push({ from: m.index, to: m.index + m[0].length, deco: cls('md-ask' + (busy ? ' asking' : '')) });
    }
  }
  if (o.find) findAll(s, o.find).forEach((i) => { if (!spans.some((x) => x.from < i + o.find!.length && x.to > i)) spans.push({ from: i, to: i + o.find!.length, deco: cls('md-find') }); });
  if (o.names) {
    mentions(s, o.names).forEach((m) => {
      if (spans.some((x) => x.from < m.to && x.to > m.from)) return;
      const e = o.names!.entries[m.entry];
      spans.push({ from: m.from, to: m.to, deco: Decoration.mark({ class: 'md-name', attributes: { 'data-ref': String(m.entry), style: '--name:' + e.color.replace(/[^#a-zA-Z0-9%(),. ]/g, '') } }) });
    });
  }
  spans.forEach((x) => { if (x.to > x.from) out.push(x.deco.range(from + x.from, from + x.to)); });
}

/** Emphasis in a stretch of a line, runs inside runs too. */
function stars(text: string, from: number, o: StyleOptions, out: Out): void {
  const rs = runs(text);
  let at = 0;
  for (const r of rs) {
    leaf(text.slice(at, r.from), from + at, o, out);
    out.push(hide.range(from + r.from, from + r.from + r.open));
    if (r.to - r.close > r.from + r.open) out.push(cls('md-' + r.cls).range(from + r.from + r.open, from + r.to - r.close));
    out.push(hide.range(from + r.to - r.close, from + r.to));
    stars(text.slice(r.from + r.open, r.to - r.close), from + r.from + r.open, o, out);
    at = r.to;
  }
  leaf(text.slice(at), from + at, o, out);
}

/** One line's decorations: `text` starts at `from` in the document. */
function lineMarks(text: string, from: number, o: StyleOptions, out: Out): void {
  let at = 0;
  for (const h of marks(text)) {
    stars(text.slice(at, h.from), from + at, o, out);
    out.push(hide.range(from + h.from, from + h.from + 2), cls('md-hl').range(from + h.from + 2, from + h.to - 2), hide.range(from + h.to - 2, from + h.to));
    stars(text.slice(h.from + 2, h.to - 2), from + h.from + 2, o, out);
    at = h.to;
  }
  stars(text.slice(at), from + at, o, out);
}

const setOpts = StateEffect.define<StyleOptions>();
const optsField = StateField.define<StyleOptions>({
  create: () => ({}),
  update: (v, tr) => { for (const e of tr.effects) if (e.is(setOpts)) v = e.value; return v; }
});

function decorate(view: EditorView): DecorationSet {
  const out: Out = [];
  const doc = view.state.doc;
  const o = view.state.field(optsField);
  // Every line the page has drawn: the screen with a margin around it, and the line the cursor is in wherever it is
  // (the page keeps that one drawn when it is scrolled out of sight).
  const spans: [number, number][] = [[view.viewport.from, view.viewport.to]];
  for (const r of view.state.selection.ranges) spans.push([doc.lineAt(r.from).from, doc.lineAt(r.to).to]);
  const seen = new Set<number>();
  for (const [from, to] of spans) {
    for (let pos = from; pos <= to;) {
      const line = doc.lineAt(pos);
      pos = line.to + 1;
      if (seen.has(line.from)) continue;
      seen.add(line.from);
      // A System screen line (format C1): "> " starts it, shown faint, the line indented; an all-bold line is its title.
      const q = /^(\s*>\s?)(.*)$/.exec(line.text);
      let name = q ? 'cm-quote' + (/^\*\*[^*].*\*\*$/.test(q[2].trim()) ? ' md-qt' : /^\[!/.test(q[2]) ? ' md-callout' : '') : '';
      // A line the team or another place added: a dot beside it.
      if (o.added && line.text.trim() && o.added.has(line.text)) name += ' md-added';
      if (name) out.push(Decoration.line({ class: name.trim() }).range(line.from));
      if (q) {
        if (q[1].length) out.push(cls('md-qm').range(line.from, line.from + q[1].length));
        lineMarks(q[2], line.from + q[1].length, o, out);
      } else lineMarks(line.text, line.from, o, out);
    }
  }
  return Decoration.set(out, true);
}

const styling = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = decorate(view); }
  update(u: ViewUpdate) {
    if (u.docChanged || u.viewportChanged || u.selectionSet || u.startState.field(optsField) !== u.state.field(optsField)) this.decorations = decorate(u.view);
  }
}, {
  decorations: (v) => v.decorations,
  // The cursor steps over hidden marks as one.
  provide: (plugin) => EditorView.atomicRanges.of((view) => {
    const p = view.plugin(plugin);
    return p ? p.decorations.update({ filter: (_f, _t, d) => d === hide }) : Decoration.none;
  })
});

// ---- lights: words lit on the page without touching them (the Rewrite column, Check, Listen) ----

const setLight = StateEffect.define<{ name: string; spans: { start: number; end: number }[] }>();
const lightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (v, tr) => {
    v = v.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setLight)) continue;
      const len = tr.newDoc.length;
      const add = e.value.spans.map((s) => ({ a: Math.max(0, Math.min(s.start, len)), b: Math.max(0, Math.min(s.end, len)) })).filter((s) => s.b > s.a)
        .map((s) => Decoration.mark({ class: 'lit-' + e.value.name, lit: e.value.name }).range(s.a, s.b));
      v = v.update({ filter: (_f, _t, d) => d.spec.lit !== e.value.name, add, sort: true });
    }
    return v;
  },
  provide: (f) => EditorView.decorations.from(f)
});

// ---- Kyle's hand: keys beside hidden marks ----

const setPend = StateEffect.define<Look | null>();
/** A look waiting for the next letters: Bold or Italic pressed between words, or a space typed at the end of styled words. */
const pendField = StateField.define<Look | null>({
  create: () => null,
  update: (v, tr) => {
    for (const e of tr.effects) if (e.is(setPend)) return e.value;
    return tr.docChanged || tr.selection ? null : v;
  }
});
/** Changes this file works out itself, which the rules below leave as they are. */
const own = Annotation.define<boolean>();

/** The smallest change that turns `was` (at `base` in the document) into `now`. */
function diff(base: number, was: string, now: string): { from: number; to: number; insert: string } {
  let a = 0;
  while (a < was.length && a < now.length && was[a] === now[a]) a++;
  let b = 0;
  while (b < was.length - a && b < now.length - a && was[was.length - 1 - b] === now[now.length - 1 - b]) b++;
  return { from: base + a, to: base + was.length - b, insert: now.slice(a, now.length - b) };
}

const hand = EditorState.transactionFilter.of((tr): TransactionSpec | readonly TransactionSpec[] => {
  if (tr.annotation(own)) return tr;
  const ev = tr.annotation(Transaction.userEvent) || '';
  if (!tr.docChanged) {
    // The cursor moved: it rests inside styled words, never on the far side of a hidden mark.
    if (!tr.selection || !ev.startsWith('select')) return tr;
    const sel = tr.newSelection.main;
    if (!sel.empty) return tr;
    const doc = tr.newDoc;
    const rest = (p: number) => { const l = doc.lineAt(p); return /[*=]/.test(l.text) ? l.from + restAt(l.text, p - l.from) : p; };
    let p = rest(sel.head);
    const was = tr.startState.selection.main;
    if (p !== sel.head && was.empty && p === was.head) {
      // An arrow key that only crossed a hidden mark would seem to do nothing: carry on to the next letter that way.
      const dir = sel.head < was.head ? -1 : 1;
      for (let q = sel.head + dir; q >= 0 && q <= doc.length; q += dir) { p = rest(q); if (p !== was.head) break; }
    }
    if (p === sel.head) return tr;
    return [tr, { selection: { anchor: p }, sequential: true }];
  }
  const typing = ev === 'input' || ev.startsWith('input.type');
  const deleting = ev.startsWith('delete') && ev !== 'delete.cut';
  // Words being put together by the keyboard (a composition) are left to it.
  if ((!typing && !deleting) || ev.startsWith('input.type.compose')) return tr;
  let n = 0, a = 0, b = 0, ins = '';
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, text) => { n++; a = fromA; b = toA; ins = text.toString(); });
  if (n !== 1) return tr;
  const doc = tr.startState.doc;
  const la = doc.lineAt(a), lb = doc.lineAt(b);
  const old = doc.sliceString(la.from, lb.to);
  const pend = tr.startState.field(pendField);
  if (!pend && !/[*=]/.test(old)) return tr;
  const r = edit(old, a - la.from, b - la.from, ins, !ev.startsWith('delete.forward'), pend);
  const naive = old.slice(0, a - la.from) + ins + old.slice(b - la.from);
  if (r.text === naive && la.from + r.caret === tr.newSelection.main.head && !r.pend) return tr;
  return {
    changes: r.text === old ? undefined : diff(la.from, old, r.text), selection: { anchor: la.from + r.caret },
    effects: r.pend ? setPend.of(r.pend) : undefined, annotations: Transaction.userEvent.of(ev), scrollIntoView: true
  };
});

// ---- the page's own look (font, size, line height and colours are the app's CSS variables) ----

const look = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'inherit', fontSize: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  // The page scrolls, not the box: nothing of a line is cut at the box's edge, so a { } note can float out into the
  // page's margin (the box's own scroller would clip it, or slide the text sideways to show it).
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: 'inherit', overflow: 'visible' },
  '.cm-content': { padding: '0', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0' },
  '.cm-quote': { paddingLeft: '1.4em' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'var(--accent-soft)' }
});

// ---- the page it sits in ----

/** The nearest box around `el` that scrolls (the writing page), or the document's. */
export function scroller(el: Element | null): HTMLElement {
  let e = el ? el.parentElement : null;
  while (e && !(e.scrollHeight > e.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(e).overflowY))) e = e.parentElement;
  return e || (document.scrollingElement as HTMLElement) || document.documentElement;
}

/** The top and bottom, on the screen, of the part of a scrolling page where its words can be seen: the page's own box,
 * less the bars that stay at its top or foot while it scrolls. */
export function inSight(box: HTMLElement): [number, number] {
  if (box === document.scrollingElement || box === document.documentElement) return [0, window.innerHeight];
  const bb = box.getBoundingClientRect();
  let from = bb.top, to = bb.bottom;
  for (const c of Array.from(box.children)) {
    if (getComputedStyle(c).position !== 'sticky') continue;
    const q = c.getBoundingClientRect();
    if (q.height < 1 || q.height > bb.height / 2) continue;
    if (q.top <= bb.top + 16) from = Math.max(from, q.bottom);
    else if (q.bottom >= bb.bottom - 16) to = Math.min(to, q.top);
  }
  return [from, to];
}

/** Keep the page at `y` for the next half second against scrolling Kyle did not do (the iPad scrolls to a cursor that
 * was just placed, some time after it is placed). His own finger, wheel or keys end the hold at once. */
export function holdPlace(box: HTMLElement, y: number) {
  let on = true;
  const EVENTS = ['touchstart', 'wheel', 'pointerdown', 'keydown'];
  const off = () => EVENTS.forEach((e) => box.removeEventListener(e, stop));
  const stop = () => { on = false; off(); };
  EVENTS.forEach((e) => box.addEventListener(e, stop, { passive: true }));
  const back = () => { if (on && box.scrollTop !== y) box.scrollTop = y; };
  back(); requestAnimationFrame(back); setTimeout(back, 120); setTimeout(back, 300);
  setTimeout(() => { back(); stop(); }, 500);
}

/** What the tool row above the page, the side column and the panels can ask the writing box to do. Places are counted
 * in characters of the scene's Markdown. */
export interface EditorCommands {
  bold: () => void; italic: () => void; undo: () => void; redo: () => void;
  /** Normal: take bold, italic and highlighter marks off the selection. */
  plain: () => void;
  highlight: () => void;
  /** Select these characters and bring them into view (Find, a mark in the list). */
  select: (start: number, end: number) => void;
  /** Words just put on the page from the side column (a Bring over): the cursor goes after them and the page keeps its
   * place. Only when the words are out of sight does the page move, to bring their first line level with `level` on
   * the screen (the top of the box they came from). */
  land: (start: number, end: number, level?: number) => void;
  /** Light these characters without taking the cursor or the focus (the Rewrite column, while Kyle types in it); with
   * `top`, scroll the page so they sit level with that spot on the screen. The light stays until hide or the next show. */
  show: (start: number, end: number, top?: number) => void;
  hide: () => void;
  /** Light these stretches under a name of their own (Check's flags, the sentence Listen is reading); none takes it away.
   * The light follows the words as Kyle types and is never in the text. Its look is `.lit-<name>` in styles.css. */
  light: (name: string, spans: { start: number; end: number }[]) => void;
  /** Bring these characters into view, when they are not, without taking the cursor or opening the keyboard. */
  reveal: (start: number, end: number) => void;
  /** The page's words as the editor holds them this moment. */
  text: () => string;
  /** Where on screen character `at` sits (a zero-width box), or null when the page is not drawn. */
  rectAt: (at: number) => DOMRect | null;
  /** Replace these characters, as one step to undo. */
  replaceRange: (start: number, end: number, text: string) => void;
  /** Replace the whole text, as one step to undo (Replace all). */
  setAll: (text: string) => void;
  /** Where the selection (or the cursor) is, in characters of the text, or null before Kyle has been in the page. */
  selection: () => { start: number; end: number } | null;
  /** Words that came from somewhere else (the team, another device): the new text, and how Kyle's cursor moves with it.
   * The cursor stays in his sentence, the page stays where it is and keeps focus; it is one step to undo. */
  apply: (text: string, map: (n: number) => number) => void;
}

export interface ProseEvents {
  /** After each change to the words. */
  onChange?: (text: string) => void;
  /** Where the cursor is, in characters from the start. */
  onCaret?: (at: number) => void;
  /** Whether what is typed at the cursor will be italic, bold or highlighted, for the tool row's buttons. */
  onLook?: (look: Look) => void;
  /** A codex name in the text was pressed: its index in options.names.entries. */
  onName?: (entry: number) => void;
  /** Kyle changed the words by hand (keys, dictation, a delete): keeps the clock of minutes typing running. */
  onHand?: () => void;
  /** Undo or Redo changed the words: what they were and what they are, so words brought back are not counted as typed. */
  onStep?: (was: string, now: string) => void;
}

export interface ProseBox {
  view: EditorView;
  commands: EditorCommands;
  /** Names to underline, words to find, asks and added lines to mark. The page is restyled; the cursor stays. */
  setOptions: (o: StyleOptions) => void;
  destroy: () => void;
}

export function proseBox(parent: HTMLElement, text: string, label: string, options: StyleOptions, events: ProseEvents = {}): ProseBox {
  // Null until Kyle has been in the page: a tool pressed before that has no place of his to work at.
  let been = false;
  let looked = '';
  const tellLook = (state: EditorState) => {
    if (!events.onLook) return;
    const head = state.selection.main.head, line = state.doc.lineAt(head);
    const l = state.field(pendField) || stylesAt(line.text, head - line.from);
    const key = (l.i ? 'i' : '') + (l.b ? 'b' : '') + (l.h ? 'h' : '');
    if (key !== looked) { looked = key; events.onLook({ i: l.i, b: l.b, h: l.h }); }
  };
  /** The whole lines the selection touches, and where it is in them. */
  const lines = (state: EditorState, from: number, to: number) => {
    const la = state.doc.lineAt(from), lb = state.doc.lineAt(to);
    return { base: la.from, old: state.doc.sliceString(la.from, lb.to), a: from - la.from, b: to - la.from };
  };

  const handlers = EditorView.domEventHandlers({
    focus: () => { been = true; return false; },
    click: (e) => {
      const t = e.target as HTMLElement | null;
      const hit = events.onName && t && t.closest ? t.closest('[data-ref]') as HTMLElement | null : null;
      if (hit && events.onName) events.onName(Number(hit.dataset.ref));
      return false;
    },
    // Copy: the words with their italics and bold for other apps (and this page), the words alone as plain text.
    copy: (e, v) => {
      const s = v.state.selection.main;
      if (s.empty || !e.clipboardData) return false;
      const c = clip(v.state.doc.toString(), s.from, s.to);
      e.clipboardData.setData('text/plain', c.plain);
      e.clipboardData.setData('text/html', c.html);
      e.preventDefault();
      return true;
    },
    cut: (e, v) => {
      const s = v.state.selection.main;
      if (s.empty || !e.clipboardData) return false;
      const c = clip(v.state.doc.toString(), s.from, s.to);
      e.clipboardData.setData('text/plain', c.plain);
      e.clipboardData.setData('text/html', c.html);
      e.preventDefault();
      const l = lines(v.state, s.from, s.to);
      const r = edit(l.old, l.a, l.b, '', true, null);
      v.dispatch({ changes: diff(l.base, l.old, r.text), selection: { anchor: l.base + r.caret }, annotations: [own.of(true), Transaction.userEvent.of('delete.cut'), isolateHistory.of('full')], scrollIntoView: true });
      return true;
    },
    // Paste: its italics and bold when it has any (from a word processor, a web page or this page), else its plain text.
    paste: (e, v) => {
      const data = pasted(e.clipboardData);
      e.preventDefault();
      if (!data) return true;
      const s = v.state.selection.main;
      const l = lines(v.state, s.from, s.to);
      const r = insertText(l.old, l.a, l.b, data);
      v.dispatch({ changes: diff(l.base, l.old, r.text), selection: { anchor: l.base + r.caret }, annotations: [own.of(true), Transaction.userEvent.of('input.paste'), isolateHistory.of('full')], scrollIntoView: true });
      return true;
    }
  });

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [
        history(),
        keymap.of([
          { key: 'Mod-b', run: () => { toggle('b'); return true; } },
          { key: 'Mod-i', run: () => { toggle('i'); return true; } },
          // A new line is a new line: nothing is copied down from the line above.
          { key: 'Enter', run: insertNewline },
          ...historyKeymap, ...standardKeymap
        ]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'sentences', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label }),
        optsField.init(() => options), lightField, pendField, hand, styling, look, handlers,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            for (const tr of u.transactions) {
              if (!tr.docChanged) continue;
              const ev = tr.annotation(Transaction.userEvent) || '';
              if ((ev === 'undo' || ev === 'redo') && events.onStep) events.onStep(tr.startState.doc.toString(), tr.newDoc.toString());
              else if ((ev === 'input' || ev.startsWith('input.type') || (ev.startsWith('delete') && ev !== 'delete.cut')) && events.onHand) events.onHand();
            }
            if (events.onChange) events.onChange(u.state.doc.toString());
          }
          // The typing line stays clear of what covers the page's edges (the bar above the iPad's keyboard, the Find bar):
          // the page says how much in its scroll padding, which the box's own scrolling to the cursor does not read.
          if (u.transactions.some((tr) => tr.scrollIntoView)) {
            u.view.requestMeasure({
              read: (v) => {
                const c = v.coordsAtPos(v.state.selection.main.head);
                const box = scroller(v.dom);
                const [from, to] = inSight(box);
                const st = getComputedStyle(box);
                const top = from + (parseFloat(st.scrollPaddingTop) || 0), foot = to - (parseFloat(st.scrollPaddingBottom) || 0);
                return { box, by: !c || foot - top < 80 ? 0 : c.bottom > foot ? c.bottom - foot : c.top < top ? c.top - top : 0 };
              },
              write: (m) => { if (m.by) m.box.scrollTop += m.by; }
            });
          }
          if (u.selectionSet) been = true;
          if ((u.docChanged || u.selectionSet) && events.onCaret) events.onCaret(u.state.selection.main.from);
          if (u.docChanged || u.selectionSet || u.startState.field(pendField) !== u.state.field(pendField)) tellLook(u.state);
        })
      ]
    })
  });
  // A press in the empty space under the last line puts the cursor at the end, as it did when the whole box was the page.
  const onBlank = (e: MouseEvent) => {
    if (e.target !== parent) return;
    e.preventDefault();
    view.focus();
    view.dispatch({ selection: { anchor: view.state.doc.length }, userEvent: 'select.pointer' });
  };
  parent.addEventListener('mousedown', onBlank);

  /** Where a place sits on the screen: measured when its line is drawn, worked out from the page's heights when not. */
  const rect = (at: number): DOMRect => {
    at = Math.max(0, Math.min(at, view.state.doc.length));
    const c = at >= view.viewport.from && at <= view.viewport.to ? view.coordsAtPos(at) : null;
    if (c) return new DOMRect(c.left, c.top, 0, c.bottom - c.top);
    const blk = view.lineBlockAt(at);
    return new DOMRect(view.contentDOM.getBoundingClientRect().left, view.documentTop + blk.top, 0, blk.height);
  };
  const frame = (box: HTMLElement) => (box === document.scrollingElement ? { top: 0, height: window.innerHeight } : box.getBoundingClientRect());
  /** Move the page so `at` sits at `want` on the screen; again once its lines are drawn, when the first go was worked
   * out from heights the page had only guessed. */
  const bring = (at: number, want: number) => {
    const box = scroller(view.dom);
    const go = () => { const d = rect(at).top - want; if (Math.abs(d) > 1) box.scrollTop += d; };
    go();
    requestAnimationFrame(() => { if (view.dom.isConnected) go(); });
  };
  /** Bring a stretch into sight, a third of the way down, when it is not already. */
  const sight = (a: number, b: number) => {
    const box = scroller(view.dom);
    const [from, to] = inSight(box);
    const ra = rect(a), rb = rect(b);
    if (ra.top >= from + 8 && rb.bottom <= to - 8) return;
    bring(a, from + (to - from) / 3);
  };
  const focus = () => { if (!view.hasFocus) view.focus(); been = true; };
  /** Run something without the page jumping: focus and the iPad's own scrolling to the cursor can each move it. */
  const keepPlace = (fn: () => void) => {
    const box = scroller(view.dom);
    const top = box.scrollTop;
    fn();
    box.scrollTop = top;
    requestAnimationFrame(() => { box.scrollTop = top; });
  };

  /** A selection of all the words inside a pair of hidden marks takes the marks in too, as it looks to on the page: a
   * second style then goes around the first (==**words**==), which is how the page reads them. */
  const whole = (l: { base: number; old: string; a: number; b: number }) => {
    if (l.a === l.b) return l;
    let { a, b } = l;
    let ls = 0;
    const rs = l.old.split('\n').flatMap((line) => { const r = allRuns(line, ls); ls += line.length + 1; return r; });
    for (let moved = true, n = 0; moved && n < 6; n++) {
      moved = false;
      for (const r of rs) if (a === r.from + r.mark && b === r.to - r.mark) { a = r.from; b = r.to; moved = true; }
    }
    return { ...l, a, b };
  };

  /** Bold, Italic or Highlight: style the selection or the word under the cursor, or take the style off; with the cursor
   * between words, the next letters typed take the style (or leave it). */
  function toggle(kind: StyleKind) {
    const state = view.state, sel = state.selection.main;
    const l = whole(lines(state, sel.from, sel.to));
    const r = toggleStyle(l.old, l.a, l.b, kind);
    if (!r) {
      const at = stylesAt(l.old, l.a);
      const now = state.field(pendField) || at;
      const next = { ...now, [kind]: !now[kind] };
      view.dispatch({ effects: setPend.of(next.i === at.i && next.b === at.b && next.h === at.h ? null : next) });
      return;
    }
    if (r.text === l.old) { view.dispatch({ selection: { anchor: l.base + r.start, head: l.base + r.end }, annotations: own.of(true) }); return; }
    view.dispatch({ changes: diff(l.base, l.old, r.text), selection: { anchor: l.base + r.start, head: l.base + r.end }, annotations: [own.of(true), Transaction.userEvent.of('input.style'), isolateHistory.of('full')] });
  }

  const commands: EditorCommands = {
    bold: () => keepPlace(() => { focus(); toggle('b'); }),
    italic: () => keepPlace(() => { focus(); toggle('i'); }),
    highlight: () => keepPlace(() => { focus(); toggle('h'); }),
    undo: () => { focus(); undo(view); },
    redo: () => { focus(); redo(view); },
    plain: () => {
      focus();
      const sel = view.state.selection.main;
      const l = lines(view.state, sel.from, sel.to);
      const r = unstyle(l.old, l.a, l.b);
      if (r.text === l.old) return;
      view.dispatch({ changes: diff(l.base, l.old, r.text), selection: { anchor: l.base + r.start, head: l.base + r.end }, annotations: [own.of(true), Transaction.userEvent.of('input.style'), isolateHistory.of('full')] });
    },
    selection: () => { const s = view.state.selection.main; return been ? { start: s.from, end: s.to } : null; },
    select: (a, b) => {
      const len = view.state.doc.length;
      focus();
      view.dispatch({ selection: { anchor: Math.min(a, len), head: Math.min(b, len) }, annotations: own.of(true) });
      sight(a, b);
      // The iPad's keyboard slides up after the focus and can push the spot out of sight; show it again once it has.
      setTimeout(() => { if (view.dom.isConnected) sight(a, b); }, 400);
    },
    land: (a, b, level) => {
      // Kyle, 2026-11-10: after a Bring over the page stays put, with the new paragraph in sight.
      const box = scroller(view.dom);
      let y = box.scrollTop;
      focus();
      view.dispatch({ selection: { anchor: Math.min(b, view.state.doc.length) }, annotations: own.of(true) });
      if (box.scrollTop !== y) box.scrollTop = y;
      const first = rect(Math.min(a + 1, b)), last = rect(b);
      const bb = frame(box);
      // Out of sight: every line of the words is above the bar over the top of the page, or below the keyboard's bar at
      // its foot. With any line in sight the page does not move.
      if (last.bottom < bb.top + 90 || first.top > bb.top + bb.height - 100) {
        const want = level != null ? Math.min(Math.max(level, bb.top + 90), bb.top + bb.height - 220) : bb.top + bb.height / 3;
        box.scrollTop += first.top - want;
        y = box.scrollTop;
      }
      holdPlace(box, y);
    },
    show: (a, b, top) => {
      view.dispatch({ effects: setLight.of({ name: 'shown', spans: [{ start: a, end: b }] }) });
      const box = scroller(view.dom);
      const bb = frame(box);
      const ra = rect(a), rb = rect(b);
      const h = Math.max(ra.height, rb.bottom - ra.top);
      // Level with the box Kyle pressed in the side column (Kyle, 2026-11-10: "the paragraph on the left has not come
      // up"), kept clear of the page's top and bottom edges; else, only when out of sight, a third of the way down.
      if (top != null) bring(a, Math.min(Math.max(top, bb.top + 40), bb.top + bb.height - Math.min(h, bb.height / 2) - 40));
      else if (ra.top < bb.top + 40 || rb.bottom > bb.top + bb.height - 40) bring(a, bb.top + bb.height / 3);
    },
    hide: () => view.dispatch({ effects: setLight.of({ name: 'shown', spans: [] }) }),
    light: (name, spans) => view.dispatch({ effects: setLight.of({ name, spans }) }),
    reveal: (a, b) => sight(a, b),
    text: () => view.state.doc.toString(),
    rectAt: (at) => (view.dom.isConnected ? rect(at) : null),
    replaceRange: (a, b, t) => {
      view.dispatch({ changes: { from: a, to: b, insert: t }, selection: { anchor: a + t.length }, annotations: [own.of(true), Transaction.userEvent.of('input.replace'), isolateHistory.of('full')] });
    },
    setAll: (t) => {
      const was = view.state.doc.toString();
      if (t === was) return;
      view.dispatch({ changes: diff(0, was, t), selection: { anchor: 0 }, annotations: [own.of(true), Transaction.userEvent.of('input.replace'), isolateHistory.of('full')] });
    },
    apply: (t, map) => {
      const was = view.state.doc.toString();
      if (t === was) return;
      const s = view.state.selection.main;
      const box = scroller(view.dom);
      const [from, to] = inSight(box);
      // What stays still on the screen: Kyle's cursor when he can see it, else the first line in sight.
      const head = rect(s.head);
      const seen = been && head.top >= from && head.bottom <= to;
      const hold = seen ? s.head : view.lineBlockAtHeight(Math.max(0, from - view.documentTop)).from;
      const y0 = rect(hold).top;
      const change = diff(0, was, t);
      const tr = view.state.update({
        changes: change, selection: been ? { anchor: Math.min(map(s.anchor), t.length), head: Math.min(map(s.head), t.length) } : undefined,
        annotations: [own.of(true), Transaction.userEvent.of('input.outside'), isolateHistory.of('full')]
      });
      view.dispatch(tr);
      const y1 = rect(seen ? view.state.selection.main.head : tr.changes.mapPos(hold, 1)).top;
      if (Math.abs(y1 - y0) > 0.5) box.scrollTop += y1 - y0;
    }
  };
  tellLook(view.state);
  return {
    view, commands,
    setOptions: (o) => view.dispatch({ effects: setOpts.of(o) }),
    destroy: () => { parent.removeEventListener('mousedown', onBlank); view.destroy(); }
  };
}
