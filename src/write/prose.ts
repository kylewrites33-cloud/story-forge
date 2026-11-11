// The trial writing box (code structure redesign, step 3; Kyle's yes to a trial only, 2026-11-11): CodeMirror 6 set up
// for prose. The page is the scene's Markdown, shown as a word processor shows it: the stars of *italics* and **bold**
// and the equals signs of ==marks== are hidden, System screen lines ("> ") are indented, {asks} are marked. Unlike
// today's box (`src/ui/StyledEditor.tsx`), nothing is read back off the screen: the text is the document, a key changes
// only the line it is on, and words from outside go in as small edits, so the page, the cursor and Undo stay put.
// This file is loaded only when the trial page opens, so the engine is not in the app's first download.
import { history, historyKeymap, redo, standardKeymap, undo } from '@codemirror/commands';
import { EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, keymap, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { ASK_RE } from '../lib/brackets.ts';
import { marks, runs, toggleStyle } from '../lib/styled.ts';

const hide = Decoration.replace({});
const cls = (name: string) => Decoration.mark({ class: name });

/** One line's decorations: `text` starts at `from` in the document. */
function lineMarks(text: string, from: number, out: Range<Decoration>[]): void {
  // ==marks==, with emphasis inside and around them.
  const hl = marks(text);
  let at = 0;
  for (const h of hl) {
    stars(text.slice(at, h.from), from + at, out);
    out.push(hide.range(from + h.from, from + h.from + 2), cls('md-hl').range(from + h.from + 2, from + h.to - 2), hide.range(from + h.to - 2, from + h.to));
    stars(text.slice(h.from + 2, h.to - 2), from + h.from + 2, out);
    at = h.to;
  }
  stars(text.slice(at), from + at, out);
  // {asks} to the team.
  const re = new RegExp(ASK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) { if (!m[0].length) { re.lastIndex++; continue; } out.push(cls('md-ask').range(from + m.index, from + m.index + m[0].length)); }
}

/** Emphasis in a stretch of a line, the same rule as today's box (`runs` in src/lib/styled.ts), runs inside runs too. */
function stars(text: string, from: number, out: Range<Decoration>[]): void {
  for (const r of runs(text)) {
    out.push(hide.range(from + r.from, from + r.from + r.open));
    if (r.to - r.close > r.from + r.open) out.push(cls('md-' + r.cls).range(from + r.from + r.open, from + r.to - r.close));
    out.push(hide.range(from + r.to - r.close, from + r.to));
    stars(text.slice(r.from + r.open, r.to - r.close), from + r.from + r.open, out);
  }
}

function decorate(view: EditorView): DecorationSet {
  const out: Range<Decoration>[] = [];
  const doc = view.state.doc;
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
      if (q) {
        const kind = /^\*\*[^*].*\*\*$/.test(q[2].trim()) ? ' md-qt' : /^\[!/.test(q[2]) ? ' md-callout' : '';
        out.push(Decoration.line({ class: 'cm-quote' + kind }).range(line.from));
        if (q[1].length) out.push(cls('md-qm').range(line.from, line.from + q[1].length));
        lineMarks(q[2], line.from + q[1].length, out);
      } else lineMarks(line.text, line.from, out);
    }
  }
  return Decoration.set(out, true);
}

const styling = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = decorate(view); }
  update(u: ViewUpdate) { if (u.docChanged || u.viewportChanged || u.selectionSet) this.decorations = decorate(u.view); }
}, {
  decorations: (v) => v.decorations,
  // The cursor steps over hidden stars as one.
  provide: (plugin) => EditorView.atomicRanges.of((view) => {
    const p = view.plugin(plugin);
    return p ? p.decorations.update({ filter: (_f, _t, d) => d === hide }) : Decoration.none;
  })
});

// The page takes the writing page's own look (font, size, line height and colours are the app's CSS variables).
const look = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'inherit', fontSize: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: 'inherit' },
  '.cm-content': { padding: '0', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0' },
  '.cm-quote': { paddingLeft: '1.4em' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'var(--accent-soft)' }
});

export interface ProseBox {
  view: EditorView;
  text: () => string;
  /** Bold or Italic pressed, as a word processor does it; false when the cursor is not in a word. */
  style: (kind: 'b' | 'i') => boolean;
  undo: () => void;
  redo: () => void;
  /** Words from outside the typing (the team, another device): put in as one small edit at the end of a paragraph. */
  addOutside: (line: string) => void;
  destroy: () => void;
}

export interface ProseEvents {
  /** After each change to the words. */
  onChange?: (text: string) => void;
  /** How long a key took from the press to the page being drawn again, in milliseconds. */
  onKeyTime?: (ms: number) => void;
}

export function proseBox(parent: HTMLElement, text: string, events: ProseEvents = {}): ProseBox {
  const timing = EditorView.domEventHandlers({
    beforeinput: () => {
      if (!events.onKeyTime) return false;
      const t0 = performance.now();
      requestAnimationFrame(() => events.onKeyTime!(performance.now() - t0));
      return false;
    }
  });
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [
        history(),
        keymap.of([
          { key: 'Mod-b', run: () => { api.style('b'); return true; } },
          { key: 'Mod-i', run: () => { api.style('i'); return true; } },
          ...historyKeymap, ...standardKeymap
        ]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'sentences', 'aria-label': 'The trial writing box' }),
        styling, look, timing,
        EditorView.updateListener.of((u) => { if (u.docChanged && events.onChange) events.onChange(u.state.doc.toString()); })
      ]
    })
  });
  const api: ProseBox = {
    view,
    text: () => view.state.doc.toString(),
    style: (kind) => {
      const sel = view.state.selection.main;
      const was = view.state.doc.toString();
      const r = toggleStyle(was, sel.from, sel.to, kind);
      if (!r) return false;
      // Only the part that changed goes into the page, so everything else stays where it is.
      let a = 0;
      while (a < was.length && a < r.text.length && was[a] === r.text[a]) a++;
      let b = 0;
      while (b < was.length - a && b < r.text.length - a && was[was.length - 1 - b] === r.text[r.text.length - 1 - b]) b++;
      view.dispatch({ changes: { from: a, to: was.length - b, insert: r.text.slice(a, r.text.length - b) }, selection: { anchor: r.start, head: r.end }, userEvent: 'input.style' });
      view.focus();
      return true;
    },
    undo: () => { undo(view); view.focus(); },
    redo: () => { redo(view); view.focus(); },
    addOutside: (line) => {
      // After the paragraph the cursor is in: close to where Kyle is looking, which is where a jump would show.
      const here = view.state.doc.lineAt(view.state.selection.main.head);
      view.dispatch({ changes: { from: here.to, insert: '\n\n' + line }, userEvent: 'outside' });
    },
    destroy: () => view.destroy()
  };
  return api;
}
