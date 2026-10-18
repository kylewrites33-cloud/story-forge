// The writing box with styles: an editable page whose characters are exactly the scene's Markdown, with *italics* and
// **bold** shown as styled text (their stars kept, faint). Every edit is read back as plain text, so the file never
// gains anything the writer did not type. New lines, pasting, bold and italic shortcuts and undo are handled here, so
// the browser never adds its own formatting.
import { useEffect, useRef } from 'preact/hooks';
import { styledHtml, unstyle, type StyleOptions } from '../lib/styled.ts';

/** The plain text of the page: text nodes as they are, a line break element as "\n" (except the last one, which only
 * keeps an empty last line visible), and a block the browser added as a new line. */
export function readText(root: Node, dropLastBreak = true): string {
  let out = '';
  const walk = (n: Node, top: boolean) => {
    n.childNodes.forEach((c, i) => {
      if (c.nodeType === 3) out += (c as Text).data;
      else if (c.nodeName === 'BR') { if (!(dropLastBreak && top && i === n.childNodes.length - 1)) out += '\n'; }
      else {
        const block = c.nodeName === 'DIV' || c.nodeName === 'P';
        if (block && out && !out.endsWith('\n')) out += '\n';
        walk(c, false);
      }
    });
  };
  walk(root, true);
  return out;
}

/** How many characters of text come before (node, offset), counted the way readText counts. */
function offsetOf(root: Node, node: Node, offset: number): number {
  const r = document.createRange();
  r.setStart(root, 0);
  r.setEnd(node, offset);
  const frag = r.cloneContents();
  const wrap = document.createElement('div');
  wrap.appendChild(frag);
  return readText(wrap, false).length;
}

export function selectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !root.contains(sel.anchorNode)) return null;
  const r = sel.getRangeAt(0);
  const max = readText(root).length;
  const a = Math.min(max, offsetOf(root, r.startContainer, r.startOffset));
  const b = Math.min(max, offsetOf(root, r.endContainer, r.endOffset));
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** Put the cursor (or a selection) at these text offsets. */
export function setSelection(root: HTMLElement, start: number, end = start) {
  const find = (want: number): [Node, number] => {
    let left = want;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let last: Text | null = null;
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      if (left <= n.data.length) return [n, left];
      left -= n.data.length;
      last = n;
    }
    return last ? [last, last.data.length] : [root, 0];
  };
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
export function showSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const n = sel.getRangeAt(0).startContainer;
  const el = (n.nodeType === 3 ? n.parentElement : n) as HTMLElement | null;
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
}

export function StyledEditor({ value, onChange, onCaret, label, commands, options, onName }: {
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
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The last selection in the page. A button press can move focus away first, so bold and italic fall back to it.
  const lastSel = useRef<{ start: number; end: number } | null>(null);
  const shown = useRef<string | null>(null);
  const html = useRef('');
  const composing = useRef(false);
  const undo = useRef<Step[]>([]);
  const redo = useRef<Step[]>([]);

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

  const commit = (text: string, caret: number) => {
    paint(text, caret);
    onChange(text);
    onCaret(caret);
  };

  /** Replace the selection with `insert`, the way typing would. */
  const replace = (insert: string, wrap?: string) => {
    const el = ref.current;
    if (!el) return;
    const text = shown.current ?? '';
    const sel = selectionOffsets(el) || lastSel.current || { start: text.length, end: text.length };
    remember(text, sel.start);
    undo.current[undo.current.length - 1].at = 0;
    if (wrap) {
      const inner = text.slice(sel.start, sel.end);
      const next = text.slice(0, sel.start) + wrap + inner + wrap + text.slice(sel.end);
      commit(next, inner ? sel.end + wrap.length * 2 : sel.start + wrap.length);
      if (inner) setSelection(el, sel.start + wrap.length, sel.end + wrap.length);
      lastSel.current = inner ? { start: sel.start + wrap.length, end: sel.end + wrap.length } : { start: sel.start + wrap.length, end: sel.start + wrap.length };
      return;
    }
    commit(text.slice(0, sel.start) + insert + text.slice(sel.end), sel.start + insert.length);
    lastSel.current = { start: sel.start + insert.length, end: sel.start + insert.length };
  };

  const step = (from: { current: Step[] }, to: { current: Step[] }) => {
    const s = from.current.pop();
    if (!s) return;
    to.current.push({ text: shown.current ?? '', caret: (ref.current && selectionOffsets(ref.current)?.start) || 0, at: 0 });
    commit(s.text, Math.min(s.caret, s.text.length));
  };

  const onBeforeInput = (e: InputEvent) => {
    const t = e.inputType;
    if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); replace('\n'); }
    else if (t === 'formatBold') { e.preventDefault(); replace('', '**'); }
    else if (t === 'formatItalic') { e.preventDefault(); replace('', '*'); }
    else if (t.startsWith('format')) e.preventDefault();
    else if (t === 'historyUndo') { e.preventDefault(); step(undo, redo); }
    else if (t === 'historyRedo') { e.preventDefault(); step(redo, undo); }
    else if (t === 'insertFromPaste' || t === 'insertFromDrop') {
      e.preventDefault();
      const data = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
      if (data) replace(data.replace(/\r\n?/g, '\n'));
    } else if (!composing.current && ref.current) {
      const s = selectionOffsets(ref.current);
      remember(shown.current ?? '', s ? s.start : 0);
    }
  };

  // Typing, deleting, autocorrect: let the browser do it, then read the text back and restyle what changed.
  const onInput = () => {
    const el = ref.current;
    if (!el || composing.current) return;
    const text = readText(el);
    const s = selectionOffsets(el);
    const caret = s ? s.start : text.length;
    lastSel.current = s;
    const h = styledHtml(text, opts.current) + '<br>';
    shown.current = text;
    if (el.innerHTML !== h) { el.innerHTML = h; setSelection(el, caret); }
    html.current = h;
    onChange(text);
    onCaret(caret);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const mod = (e.ctrlKey || e.metaKey) && !e.altKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) step(redo, undo); else step(undo, redo); }
    else if (mod && k === 'y') { e.preventDefault(); step(redo, undo); }
    else if (mod && !e.shiftKey && k === 'b') { e.preventDefault(); replace('', '**'); }
    else if (mod && !e.shiftKey && k === 'i') { e.preventDefault(); replace('', '*'); }
  };

  const onPaste = (e: ClipboardEvent) => {
    // Some browsers skip beforeinput for paste; this catches them.
    if (e.defaultPrevented) return;
    e.preventDefault();
    const data = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    if (data) replace(data.replace(/\r\n?/g, '\n'));
  };

  const mark = () => {
    const el = ref.current;
    const s = el && selectionOffsets(el);
    if (s) { lastSel.current = s; onCaret(s.start); }
  };

  if (commands) {
    const focus = () => { const el = ref.current; if (el && document.activeElement !== el) { el.focus(); if (lastSel.current) setSelection(el, lastSel.current.start, lastSel.current.end); } };
    commands.current = {
      bold: () => { focus(); replace('', '**'); },
      italic: () => { focus(); replace('', '*'); },
      undo: () => { focus(); step(undo, redo); },
      redo: () => { focus(); step(redo, undo); },
      highlight: () => { focus(); replace('', '=='); },
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
        el.focus();
        setSelection(el, a, b);
        lastSel.current = { start: a, end: b };
        onCaret(a);
        showSelection();
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
