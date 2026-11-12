// The writing box as the pages use it (code structure redesign, step 3): the scene's words in `prose.ts`, with the same
// handles the older box (`src/ui/StyledEditor.tsx`, removed 2026-11-12) gave the writing page, the chapter page and the
// beats page. The text given at the start is the text; later changes to `value` are ignored (typing never comes back
// through it), and a change from outside (a copy restored, a split or a join) remounts the box with a new key.
import { useEffect, useRef } from 'preact/hooks';
import { bodyWords } from '../lib/drafts.ts';
import { markTyping, wordsNotTyped } from '../lib/pomodoro.ts';
import type { StyleOptions } from '../lib/styled.ts';
import { proseBox, type EditorCommands, type ProseBox } from './prose.ts';

interface Props {
  /** The text to start with. Later changes to it are ignored; give the editor a new key to load other text. */
  value: string;
  onChange: (text: string) => void;
  /** Where the cursor is, in characters from the start, for Split here. */
  onCaret: (offset: number) => void;
  label: string;
  /** Filled in with the tool row's commands. */
  commands?: { current: EditorCommands | null };
  /** Names to underline and words to find. A change restyles the page and keeps the cursor. */
  options?: StyleOptions;
  /** A codex name in the text was pressed: its index in options.names.entries. */
  onName?: (entry: number) => void;
  /** Whether what is typed at the cursor will be italic, bold or highlighted, for the tool row's buttons. */
  onLook?: (look: { i: boolean; b: boolean; h: boolean }) => void;
}

export function ProseEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const box = useRef<ProseBox | null>(null);
  const now = useRef(props);
  now.current = props;
  useEffect(() => {
    if (!host.current) return;
    const b = proseBox(host.current, props.value, props.label, props.options || {}, {
      onChange: (t) => now.current.onChange(t),
      onCaret: (n) => now.current.onCaret(n),
      onLook: (l) => { if (now.current.onLook) now.current.onLook(l); },
      onName: (i) => { if (now.current.onName) now.current.onName(i); },
      // Any change Kyle makes here, keys or dictation, keeps the clock of minutes typing running.
      onHand: () => markTyping(),
      // Words brought back by undo or redo were counted when they first went on the page, so they are not typed again.
      onStep: (was, is) => wordsNotTyped(bodyWords(is) - bodyWords(was))
    });
    box.current = b;
    if (props.commands) props.commands.current = b.commands;
    return () => {
      if (now.current.commands && now.current.commands.current === b.commands) now.current.commands.current = null;
      box.current = null;
      b.destroy();
    };
  }, []);
  const o = props.options;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (box.current) box.current.setOptions(o || {});
  }, [o && o.names, o && o.find, o && o.asks, o && o.added, o && o.asking]);
  return <div ref={host} class="writer-text styled prose" />;
}
