// A whole chapter as one page: every scene of the chapter one after another, each with its own writing box, and a
// thin line with the scene's name between them. Each scene keeps its own draft on the device and saves on its own, the
// same way as the one-scene writing screen (Done, two quiet minutes, putting the iPad down, back online).
import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { trackWords } from '../lib/pomodoro.ts';
import { bodyWords, isUnsaved, loadDrafts, openDraft, putDraft, saveDraft, splitLead, type Draft } from '../lib/drafts.ts';
import { chapterHeading, type ChapterGroup } from '../lib/board.ts';
import type { StyleOptions } from '../lib/styled.ts';
import type { NoteRecord, VaultSource } from '../lib/types.ts';
import { loadLook, lookStyle } from '../lib/page.ts';
import { matcher, type CodexEntry } from '../lib/codex.ts';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';
import { StyledEditor, type EditorCommands } from './StyledEditor.tsx';

const QUIET_SAVE_MS = 2 * 60 * 1000;
const num = (n: number) => n.toLocaleString('en-US');

interface Section {
  note: NoteRecord;
  draft: Draft;
}

export function ChapterPage({ source, group, bookTitle, codex, startAt, backTo, onSaved, timer }: {
  source: VaultSource; group: ChapterGroup; bookTitle: string; codex: CodexEntry[];
  /** The scene the page opened from: it scrolls into view. */
  startAt: string;
  backTo: string;
  onSaved: (n: NoteRecord) => void;
  /** The Pomodoro timer, in the top bar. */
  timer?: ComponentChildren;
}) {
  const canSave = Boolean(source.readFresh && source.write);
  const [sections, setSections] = useState<Section[]>(() => {
    const drafts = loadDrafts(source.key);
    return group.scenes.map((n) => ({ note: n, draft: openDraft(n, drafts[n.path], new Date()) }));
  });
  const ref = useRef(sections);
  ref.current = sections;
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'device'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [focused, setFocused] = useState(startAt);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const commands = useRef<Record<string, { current: EditorCommands | null }>>({});
  const look = loadLook();
  const [opts] = useState<StyleOptions>(() => ({ names: look.names === 'on' && codex.length ? matcher(codex) : null }));

  const setDraft = (path: string, d: Draft) => {
    const next = ref.current.map((s) => (s.note.path === path ? { ...s, draft: d } : s));
    ref.current = next;
    setSections(next);
    putDraft(source.key, path, d);
  };

  /** Save every scene with unsaved words. */
  const saveAll = useCallback(async (closing: boolean): Promise<boolean> => {
    const todo = ref.current.filter((s) => isUnsaved(s.draft));
    if (!todo.length) { if (closing) ref.current.forEach((s) => putDraft(source.key, s.note.path, null)); return true; }
    if (!canSave) { setState('device'); setMessage('The demo vault keeps your writing until the page reloads.'); return true; }
    if (!navigator.onLine) {
      todo.forEach((s) => setDraft(s.note.path, { ...s.draft, pending: true }));
      setState('device');
      return true;
    }
    if (saving.current) return false;
    saving.current = true;
    setState('saving');
    let ok = true;
    const clashes: string[] = [];
    for (const s of todo) {
      const d = s.draft;
      try {
        const r = await saveDraft(source, d, new Date());
        onSaved(r.note);
        if (r.clash) clashes.push(String(s.note.data.id || s.note.path));
        const now = ref.current.find((x) => x.note.path === d.path)!.draft;
        const next: Draft = { ...now, baseSha: r.note.sha, baseBody: d.body, pending: false, error: undefined };
        if (closing && !isUnsaved(next)) putDraft(source.key, d.path, null);
        else setDraft(d.path, next);
      } catch (e) {
        ok = false;
        const err = e as Error & { status?: number };
        setDraft(d.path, { ...ref.current.find((x) => x.note.path === d.path)!.draft, pending: true, error: err.message });
        setMessage(err.status === 0 ? null : err.message);
        setState(err.status === 0 ? 'device' : 'error');
      }
    }
    saving.current = false;
    if (ok) {
      setState('saved');
      setMessage(clashes.length ? clashes.join(', ') + ' had also changed somewhere else. Your version is saved; the other one is kept as a copy.' : null);
    }
    return ok;
  }, [source, canSave, onSaved]);

  const changed = (path: string, text: string) => {
    const s = ref.current.find((x) => x.note.path === path);
    if (!s) return;
    const body = splitLead(s.draft.body).lead + text;
    trackWords(path, String(s.note.data.id || ''), bodyWords(s.draft.body), bodyWords(body));
    setDraft(path, { ...s.draft, body, updatedAt: new Date().toISOString() });
    if (state !== 'error') setState('idle');
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(() => { saveAll(false); }, QUIET_SAVE_MS);
  };

  useEffect(() => {
    const away = () => { if (document.visibilityState === 'hidden') saveAll(false); };
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveAll(false); }
    };
    document.addEventListener('visibilitychange', away);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('visibilitychange', away);
      window.removeEventListener('keydown', key);
      if (quiet.current) clearTimeout(quiet.current);
      ref.current.forEach((s) => { if (isUnsaved(s.draft)) putDraft(source.key, s.note.path, { ...s.draft, pending: true }); });
    };
  }, [source, saveAll]);

  useEffect(() => {
    const el = document.querySelector('[data-section="' + CSS.escape(startAt) + '"]');
    if (el) el.scrollIntoView({ block: 'start' });
  }, []);

  const go = async (to: string) => {
    if (quiet.current) clearTimeout(quiet.current);
    if (await saveAll(true)) location.hash = to;
  };

  const words = sections.reduce((n, s) => n + bodyWords(s.draft.body), 0);
  const started = sections.reduce((n, s) => n + s.draft.startWords, 0);
  const unsaved = sections.some((s) => isUnsaved(s.draft));
  const chip = state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved' : unsaved ? (state === 'device' || !navigator.onLine ? 'On this device' : 'Saved on device') : 'Saved';
  const cmd = () => { const c = commands.current[focused]; return c ? c.current : null; };
  const keepFocus = { onMouseDown: (e: Event) => e.preventDefault() };

  return (
    <div class={'writer chapter-page paper-' + look.paper} style={lookStyle(look)}>
      <header class="writer-bar">
        <button type="button" class="primary" onClick={() => go(backTo)}>Done</button>
        <button type="button" class="bar-button" onClick={() => go(href.write(focused))} title="Back to one scene at a time"><Icon name="page" /><span class="bar-label">One scene</span></button>
        <span class="writer-title">{bookTitle}</span>
        <span class="writer-words">{num(words)} words{words - started ? ' · ' + (words - started > 0 ? '+' : '') + num(words - started) : ''}</span>
        <span class={'save-chip ' + (chip === 'Saved' ? 'good' : state === 'error' ? 'bad' : '')} role="status">{chip === 'Saved' && <Icon name="check" size={16} />}{chip}</span>
        {timer}
      </header>
      <div class="writer-cols">
        <div class="writer-page">
          <div class="writer-tools" role="toolbar" aria-label="Formatting">
            <button type="button" class="tool" aria-label="Bold" {...keepFocus} onClick={() => { const c = cmd(); if (c) c.bold(); }}><b>B</b></button>
            <button type="button" class="tool" aria-label="Italic" {...keepFocus} onClick={() => { const c = cmd(); if (c) c.italic(); }}><i>I</i></button>
            <button type="button" class="tool wide" aria-label="Normal" {...keepFocus} onClick={() => { const c = cmd(); if (c) c.plain(); }}><span class="bar-label always">Normal</span></button>
            <button type="button" class="tool" aria-label="Highlight" {...keepFocus} onClick={() => { const c = cmd(); if (c) c.highlight(); }}><Icon name="marker" /></button>
            <button type="button" class="tool" aria-label="Undo" {...keepFocus} onClick={() => { const c = cmd(); if (c) c.undo(); }}><Icon name="undo" /></button>
            <button type="button" class="tool" aria-label="Redo" {...keepFocus} onClick={() => { const c = cmd(); if (c) c.redo(); }}><Icon name="redo" /></button>
          </div>
          <div class="page-head">
            <h1>{chapterHeading(group)}</h1>
            <p class="meta">The whole chapter on one page. Each scene saves on its own; the lines between them are scene breaks.</p>
            {message && <p class={state === 'error' ? 'error' : 'note-line'}>{message}</p>}
          </div>
          {sections.map((s, i) => {
            const c = commands.current[s.note.path] || (commands.current[s.note.path] = { current: null });
            return (
              <section key={s.note.path} class="chapter-section" data-section={s.note.path}>
                {i > 0 && <div class="scene-break" aria-hidden="true" />}
                <p class="section-name">
                  <a href={href.write(s.note.path)} onClick={(e) => { e.preventDefault(); go(href.write(s.note.path)); }}>{[s.note.data.id, s.note.data.title].filter(Boolean).join(' ')}</a>
                  <span class="meta"> · {num(bodyWords(s.draft.body))} words{String(s.note.data.status || '') === 'planned' ? ' · planned' : ''}</span>
                </p>
                <div onFocusCapture={() => setFocused(s.note.path)}>
                  <StyledEditor value={splitLead(s.draft.body).text} onChange={(t) => changed(s.note.path, t)} onCaret={() => {}} label={'Text of ' + String(s.note.data.title || s.note.data.id || '')}
                    commands={c} options={opts} />
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
