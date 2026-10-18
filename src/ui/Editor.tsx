// Full-screen writing: one scene's prose in a plain text box. Each change is kept on this device straight away; it goes
// to the vault when Kyle presses Done, after two quiet minutes, or (if he is offline) when the connection is back.
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  bodyWords, isUnsaved, listSnapshots, loadDrafts, openDraft, putDraft, saveDraft, saveSnapshot, splitLead,
  type Draft, type SnapshotEntry
} from '../lib/drafts.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { toNumber } from '../lib/links.ts';
import { archiveForJoin, archivedWhy, joinedBody, noteJoinForTeam, removeJoined, restoreArchived, splitAt, splitOff } from '../lib/scenes.ts';
import { chapterHeading, type ChapterGroup } from '../lib/board.ts';
import { formatValue, isEmptyValue, label as fieldLabel } from '../lib/format.ts';
import { cardFields, propDef } from '../lib/schema.ts';
import type { FileEntry, NoteRecord, SaveEntry, Schema, VaultSource } from '../lib/types.ts';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';
import { boardLinks } from './StoryBoards.tsx';
import { StyledEditor, type EditorCommands } from './StyledEditor.tsx';
import { loadRates, readingLine } from '../lib/home.ts';
import { LOOK_CHOICES, loadLook, lookStyle, saveLook, type PageLook } from '../lib/page.ts';
import { defaultJobTitle, jobAsk, type JobKind, type OnJob } from '../lib/jobs.ts';
import { matcher, namedIn, type CodexEntry } from '../lib/codex.ts';
import { findAll, markList, unstyle } from '../lib/styled.ts';
import { withBody } from '../lib/drafts.ts';
import { propertyOrder } from '../lib/schema.ts';
import { render } from '../lib/markdown.ts';

const QUIET_SAVE_MS = 2 * 60 * 1000;
const STYLED_KEY = 'story-forge.styled';

/** Styled text is on unless Kyle turned it off on this device. */
function loadStyled(): boolean {
  try { return localStorage.getItem(STYLED_KEY) !== 'off'; } catch { return true; }
}
function saveStyled(on: boolean) {
  try { if (on) localStorage.removeItem(STYLED_KEY); else localStorage.setItem(STYLED_KEY, 'off'); } catch { /* the choice lasts until reload */ }
}
const num = (n: number) => n.toLocaleString('en-US');

// The chapter list (left) and scene panel (right) sit beside the page when there is room, and slide over it when there
// is not: the list needs 900 px, both need 1200 px. On a wide screen, whether each is open is remembered on the device.
const WIDE_LEFT = '(min-width: 900px)';
const WIDE_RIGHT = '(min-width: 1200px)';
const wide = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
function loadSide(key: string, fallback: boolean): boolean {
  try { const v = localStorage.getItem('story-forge.' + key); return v == null ? fallback : v === 'open'; } catch { return fallback; }
}
function saveSide(key: string, open: boolean) {
  try { localStorage.setItem('story-forge.' + key, open ? 'open' : 'closed'); } catch { /* lasts until reload */ }
}
type Tab = 'card' | 'notes' | 'marks' | 'copies' | 'target' | 'tools' | 'page' | 'team';

export interface EditorBook { title: string; folder: string; groups: ChapterGroup[]; archive?: FileEntry[] }

type Saving = 'idle' | 'saving' | 'saved' | 'device' | 'error';

function offlineError(e: unknown): boolean {
  return (e as { status?: number }).status === 0 || !navigator.onLine;
}

export function Editor({ source, schema, note, next, nextMentions, book, backTo, onSaved, onChanged, onAdd, onJob, codex, braindump }: {
  source: VaultSource; schema: Schema; note: NoteRecord;
  /** The scene after this one in reading order, for Join, and the book's notes that name it. */
  next: NoteRecord | null;
  nextMentions: NoteRecord[];
  /** The book the scene is in, for the chapter list. */
  book: EditorBook | null;
  backTo: string;
  onSaved: (n: NoteRecord) => void;
  /** Sync after scenes were added or removed, so the boards show them. */
  onChanged: () => Promise<void>;
  /** Add a scene to a chapter and open it. */
  onAdd?: (chapter: number | null, chapterTitle: string, title: string) => Promise<string | null>;
  /** Ask the team for a job on this scene, its chapter or the book. */
  onJob?: OnJob;
  /** The book's characters, places, items and lore, whose names light up in the text. */
  codex?: CodexEntry[];
  /** The book's Braindump note, for the Notes tab (null: the book has none yet). */
  braindump?: NoteRecord | null;
}) {
  const bookFolder = book ? book.folder : null;
  const canSave = Boolean(source.readFresh && source.write);
  const [draft, setDraftState] = useState<Draft>(() => openDraft(note, loadDrafts(source.key)[note.path], new Date()));
  const draftRef = useRef(draft);
  const [state, setState] = useState<Saving>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [left, setLeft] = useState(() => wide(WIDE_LEFT) && loadSide('chapters', true));
  const [right, setRight] = useState(() => wide(WIDE_RIGHT) && loadSide('scene-panel', true));
  const [tab, setTab] = useState<Tab>('card');
  const [look, setLook] = useState<PageLook>(loadLook);
  const [focus, setFocus] = useState(false);
  const commands = useRef<EditorCommands | null>(null);
  const caret = useRef<number | null>(null);
  const [made, setMade] = useState<NoteRecord | null>(null);
  const [picked, setPicked] = useState<CodexEntry | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [repl, setRepl] = useState('');
  const [hit, setHit] = useState(0);
  // The codex as one key, so the names are only worked out again when a name, nickname or colour changes.
  const codexKey = (codex || []).map((e) => e.name + '|' + e.terms.join(',') + '|' + e.color).join(';');
  const allNames = useMemo(() => matcher(codex || []), [codexKey]);
  const names = look.names === 'on' && (codex || []).length ? allNames : null;
  const findQ = findOpen ? query : '';
  const styleOpts = useMemo(() => ({ names, find: findQ }), [names, findQ]);
  const box = useRef<HTMLTextAreaElement>(null);
  const saving = useRef(false);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kept = useRef(true);

  const setDraft = useCallback((d: Draft) => {
    draftRef.current = d;
    setDraftState(d);
    kept.current = putDraft(source.key, d.path, d);
  }, [source]);

  const grow = () => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  useEffect(grow, []);

  /** Send the draft to the vault. `closing` keeps it waiting on the device if the connection is down. */
  const save = useCallback(async (closing: boolean): Promise<boolean> => {
    const d = draftRef.current;
    if (!isUnsaved(d)) { if (closing) putDraft(source.key, d.path, null); return true; }
    if (!canSave) { setState('device'); setMessage('The demo vault keeps your writing until the page reloads.'); return true; }
    if (!navigator.onLine) {
      setDraft({ ...d, pending: true });
      setState('device');
      return true;
    }
    if (saving.current) return false;
    saving.current = true;
    setState('saving');
    try {
      const r = await saveDraft(source, d, new Date());
      onSaved(r.note);
      const now = draftRef.current;
      // Words typed while it was saving stay in the draft for the next save.
      const next: Draft = { ...now, baseSha: r.note.sha, baseBody: d.body, target: now.target === d.target ? null : now.target, status: now.status === d.status ? null : now.status, pending: false, error: undefined };
      if (closing && !isUnsaved(next)) { draftRef.current = next; putDraft(source.key, d.path, null); }
      else setDraft(next);
      setState('saved');
      setMessage(r.clash ? 'This scene had also changed somewhere else. Your version is saved; the other one is kept as a copy (' + r.clash.slice(r.clash.lastIndexOf('/') + 1).replace(/\.md$/, '') + ').' : null);
      return true;
    } catch (e) {
      if (offlineError(e)) {
        setDraft({ ...draftRef.current, pending: true });
        setState('device');
        return true;
      }
      const msg = (e as Error).message;
      setDraft({ ...draftRef.current, pending: closing, error: msg });
      setState('error');
      setMessage(msg);
      return false;
    } finally {
      saving.current = false;
    }
  }, [source, canSave, onSaved, setDraft]);

  const [styled, setStyled] = useState(loadStyled);
  // Bumped when the text changes from outside the writing box (copy restored, split, join), so the styled box reloads.
  const [loaded, setLoaded] = useState(0);
  const reload = () => setLoaded((n) => n + 1);
  const onInput = (e: Event) => changed((e.currentTarget as HTMLTextAreaElement).value);
  const changed = (text: string) => {
    setDraft({ ...draftRef.current, body: splitLead(draftRef.current.body).lead + text, updatedAt: new Date().toISOString() });
    if (state !== 'error') setState('idle');
    grow();
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(() => { save(false); }, QUIET_SAVE_MS);
  };

  // Leaving the page or putting the iPad down: try to save, and keep it waiting on the device either way.
  useEffect(() => {
    const away = () => {
      if (document.visibilityState !== 'hidden' || !isUnsaved(draftRef.current)) return;
      setDraft({ ...draftRef.current, pending: true });
      save(false);
    };
    document.addEventListener('visibilitychange', away);
    return () => {
      document.removeEventListener('visibilitychange', away);
      if (quiet.current) clearTimeout(quiet.current);
      if (isUnsaved(draftRef.current)) putDraft(source.key, draftRef.current.path, { ...draftRef.current, pending: true });
    };
  }, [source, save, setDraft]);

  const mark = () => { const el = box.current; if (el) caret.current = el.selectionStart; };

  /** Split at the cursor: the words after it become a new scene right after this one. */
  const split = async (newTitle: string): Promise<string | null> => {
    if (!bookFolder || !canSave) return 'Splitting needs your own vault, not the demo.';
    if (!navigator.onLine) return 'Connect to the internet to split a scene.';
    const d = draftRef.current;
    const { lead, text: words } = splitLead(d.body);
    const at = caret.current == null ? words.length : Math.min(caret.current, words.length);
    const parts = splitAt(words, at);
    if (!parts.after.trim()) return 'Put the cursor where the new scene should start, then press Split.';
    if (!parts.before.trim()) return 'The cursor is at the very start. Put it where the new scene should start.';
    try {
      const created = await splitOff(source, note, next, d.body, parts.after, newTitle, bookFolder, new Date());
      setDraft({ ...draftRef.current, body: lead + parts.before });
      reload();
      setTimeout(grow, 0);
      await save(false);
      await onChanged();
      setMade(created);
      setMessage(null);
      return null;
    } catch (e) {
      return offlineError(e) ? 'Connect to the internet to split a scene.' : (e as Error).message;
    }
  };

  /** Join the next scene onto the end of this one; the next scene's note moves to the Archive. */
  const join = async (): Promise<string | null> => {
    if (!next || !canSave || !source.remove) return 'Joining needs your own vault, not the demo.';
    if (!navigator.onLine) return 'Connect to the internet to join scenes.';
    try {
      const taken = await archiveForJoin(source, note, next, new Date());
      setDraft({ ...draftRef.current, body: joinedBody(draftRef.current.body, taken.body) });
      reload();
      setTimeout(grow, 0);
      if (!(await save(false)) || isUnsaved(draftRef.current)) return 'The joined words did not save, so ' + String(next.data.id || 'the next scene') + ' stays where it is. Its copy is in the Archive.';
      await removeJoined(source, next, taken.sha, title);
      setMade(null);
      const told = bookFolder ? await noteJoinForTeam(source, bookFolder, next, note, nextMentions, new Date()) : null;
      await onChanged();
      setMessage(String(next.data.id || 'The next scene') + ' is joined onto the end. Its old note is in the book\'s Archive folder.' +
        (told ? ' The team has a note to update anything that still names ' + String(next.data.id || 'it') + '.' : ''));
      return null;
    } catch (e) {
      return offlineError(e) ? 'Connect to the internet to join scenes.' : (e as Error).message;
    }
  };

  // Ctrl+S (Cmd+S on a Mac) saves to the vault now, instead of the browser's "save page" box. Same on any keyboard,
  // including one attached to the iPad.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (quiet.current) clearTimeout(quiet.current);
        save(false);
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [save]);

  // Focus mode: only the page. Esc (or the button in the corner) brings the bars back. Full screen where the browser allows it.
  const enterFocus = () => {
    setFocus(true);
    const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
    try { if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => { /* the page alone is enough */ }); } catch { /* not offered */ }
  };
  const leaveFocus = useCallback(() => {
    setFocus(false);
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => { /* already out */ }); } catch { /* not offered */ }
  }, []);
  useEffect(() => {
    if (!focus) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') leaveFocus(); };
    // Leaving full screen with the browser's own Esc leaves focus mode too.
    const fs = () => { if (!document.fullscreenElement) setFocus(false); };
    window.addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', fs);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', fs); };
  }, [focus, leaveFocus]);
  useEffect(() => () => { try { if (document.fullscreenElement) document.exitFullscreen().catch(() => { /* gone */ }); } catch { /* not offered */ } }, []);

  /** Leave the writing screen for another page, saving first (as Done does). */
  const go = async (to: string) => {
    if (quiet.current) clearTimeout(quiet.current);
    const ok = await save(true);
    if (ok) location.hash = to;
  };
  const done = () => go(backTo);
  const link = (to: string) => ({ href: to, onClick: (e: MouseEvent) => { e.preventDefault(); go(to); } });

  const toggleLeft = () => { const v = !left; setLeft(v); if (wide(WIDE_LEFT)) saveSide('chapters', v); };
  const toggleRight = () => { const v = !right; setRight(v); if (wide(WIDE_RIGHT)) saveSide('scene-panel', v); };
  const openTab = (t: Tab) => { setTab(t); if (!right) setRight(true); };
  // The dimmed page behind a panel that slides over it: pressing it closes that panel.
  const closeOver = () => { if (!wide(WIDE_LEFT)) setLeft(false); if (!wide(WIDE_RIGHT)) setRight(false); };

  /** Bold or italic in the plain text box: put stars around the selection. */
  const wrapPlain = (stars: string) => {
    const el = box.current;
    if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd, v = el.value;
    const nv = v.slice(0, a) + stars + v.slice(a, b) + stars + v.slice(b);
    el.value = nv;
    changed(nv);
    el.focus();
    el.setSelectionRange(a + stars.length, b + stars.length);
  };
  /** The same commands for the plain text box, so the tool row and Find work in either view. */
  const plainBox = (): EditorCommands => {
    const set = (v: string, a: number, b: number) => {
      const el = box.current;
      if (!el) return;
      el.value = v;
      changed(v);
      el.focus();
      el.setSelectionRange(a, b);
      caret.current = a;
    };
    const cur = () => box.current;
    return {
      bold: () => wrapPlain('**'), italic: () => wrapPlain('*'), undo: () => {}, redo: () => {},
      highlight: () => wrapPlain('=='),
      plain: () => { const el = cur(); if (!el) return; const r = unstyle(el.value, el.selectionStart, el.selectionEnd); set(r.text, r.start, r.end); },
      select: (a, b) => { const el = cur(); if (!el) return; el.focus(); el.setSelectionRange(a, b); caret.current = a; },
      replaceRange: (a, b, t) => { const el = cur(); if (!el) return; set(el.value.slice(0, a) + t + el.value.slice(b), a + t.length, a + t.length); },
      setAll: (t) => { const el = cur(); if (el) set(t, 0, 0); }
    };
  };
  const cmd = (): EditorCommands | null => (styled ? commands.current : plainBox());

  // Tool buttons must not take the cursor out of the page.
  const keepFocus = { onMouseDown: (e: Event) => e.preventDefault(), onPointerDown: (e: Event) => { if ((e as PointerEvent).pointerType === 'mouse') e.preventDefault(); } };

  const { text } = splitLead(draft.body);
  const words = bodyWords(draft.body);
  const target = draft.target != null ? draft.target : toNumber(note.data.target_words);
  const sitting = words - draft.startWords;
  const title = [note.data.id, note.data.title].filter(Boolean).join(' ') || note.path;
  const sceneName = String(note.data.title || note.data.id || 'this scene');
  const unsaved = isUnsaved(draft);
  const status =
    state === 'saving' ? 'Saving to the vault…'
      : state === 'error' ? 'Not saved to the vault. It is safe on this device.'
        : !kept.current ? 'This device would not keep a copy. Press Done to save.'
          : unsaved ? (draft.pending || !navigator.onLine ? 'Saved on this device. It goes to the vault when you are back online.' : 'Saved on this device.')
            : state === 'saved' ? 'Saved to the vault.' : 'Nothing changed yet.';
  // The short form for the top bar. The full sentence shows under the heading when it needs attention.
  const chip =
    state === 'saving' ? { text: 'Saving…', cls: '' }
      : state === 'error' || !kept.current ? { text: 'Not saved', cls: 'bad' }
        : unsaved ? { text: draft.pending || !navigator.onLine ? 'On this device' : 'Saved on device', cls: draft.pending || !navigator.onLine ? 'warn' : '' }
          : { text: 'Saved', cls: 'good' };
  const loud = state === 'error' || !kept.current || (unsaved && (draft.pending || !navigator.onLine));
  const sceneStatus = String(draft.status || note.data.status || '');
  const group = book ? book.groups.find((g) => g.scenes.some((n) => n.path === note.path)) || null : null;
  const heading = group && group.num != null ? chapterHeading(group) : String(note.data.title || title);
  const sub = [group && group.num != null ? title : String(note.data.id || ''), note.data.pov ? formatValue('pov', note.data.pov, propDef(schema, note.type, 'pov')) : '', sceneStatus]
    .filter(Boolean).join(' · ');
  const nextName = next ? String(next.data.title || next.data.id || 'Next scene') : '';
  const subtitle = isEmptyValue(note.data.subtitle) ? '' : String(note.data.subtitle);
  const reading = readingLine(words, loadRates());
  // The chapter's scenes as a strip of blocks sized by their length; this scene's block uses its live word count.
  const strip = group && group.scenes.length > 1 ? group.scenes.map((n) => ({ note: n, words: n.path === note.path ? words : toNumber(n.data.words) || 0 })) : [];
  // A scene with few or no words still gets a block wide enough to see and press.
  const stripMin = Math.max(1, strip.reduce((m, x) => Math.max(m, x.words), 0) * 0.12);
  const stripTotal = strip.reduce((s, x) => s + Math.max(x.words, stripMin), 0);

  return (
    <div class={'writer paper-' + look.paper + (focus ? ' focus' : '') + (left && !focus ? ' left-open' : '') + (right && !focus ? ' right-open' : '')} style={lookStyle(look)}>
      {focus && <button type="button" class="leave-focus" onClick={leaveFocus} aria-label="Leave focus mode" title="Leave focus mode (Esc)"><Icon name="focus" /><span class="bar-label">Leave focus</span></button>}
      <header class="writer-bar">
        <button type="button" class="primary" onClick={done}>Done</button>
        {book && (
          <button type="button" class="bar-button" onClick={toggleLeft} aria-expanded={left} aria-label="Chapters">
            <Icon name="list" /><span class="bar-label">Chapters</span>
          </button>
        )}
        <span class="writer-title">{book ? book.title : title}</span>
        <span class="writer-words">
          {num(words)}{target ? ' / ' + num(target) : ''} words{sitting ? ' · ' + (sitting > 0 ? '+' : '') + num(sitting) : ''}
        </span>
        <span class={'save-chip ' + chip.cls} title={status} role="status">{chip.cls === 'good' && <Icon name="check" size={16} />}{chip.text}</span>
        {group && group.scenes.length > 1 && (
          <button type="button" class="bar-button" onClick={() => go(href.chapter(note.path))} aria-label="Whole chapter" title="The whole chapter on one page">
            <Icon name="page" /><span class="bar-label">Whole chapter</span>
          </button>
        )}
        <button type="button" class="bar-button" onClick={enterFocus} aria-label="Focus mode" title="Focus mode: only the page">
          <Icon name="focus" /><span class="bar-label">Focus</span>
        </button>
        <button type="button" class="bar-button" onClick={toggleRight} aria-expanded={right} aria-label="Scene panel">
          <Icon name="panel" /><span class="bar-label">Scene</span>
        </button>
      </header>
      <div class="writer-cols">
        {book && left && !focus && (
          <aside class="writer-side" aria-label="Chapters">
            <div class="side-head">
              <strong>{book.title}</strong>
              <button type="button" class="icon-button" onClick={toggleLeft} aria-label="Hide the chapter list"><Icon name="left" /></button>
            </div>
            <nav class="scene-list">
              {book.groups.map((g) => (
                <div key={g.key}>
                  <p class="side-chapter">{chapterHeading(g)}</p>
                  {g.scenes.map((n) => (
                    <a key={n.path} {...link(href.write(n.path))} class="side-scene" aria-current={n.path === note.path ? 'page' : undefined}>
                      <span>{String(n.data.title || n.data.id || n.path)}</span>
                      <span class="side-words">{n.path === note.path ? num(words) : num(toNumber(n.data.words) || 0)}</span>
                    </a>
                  ))}
                </div>
              ))}
              {onAdd && <AddInList onAdd={async (t) => {
                if (!(await save(true))) return 'Save this scene first: it did not reach the vault.';
                return onAdd(group ? group.num : null, group ? group.title : '', t);
              }} chapter={group && group.num != null ? group.num : null} />}
            </nav>
            {book.archive && book.archive.length > 0 && <ArchiveList source={source} files={book.archive} bookFolder={book.folder} canSave={canSave} onChanged={onChanged} />}
            <nav class="side-boards" aria-label="Boards">
              {boardLinks(schema, book.folder).map((l) => (
                <a key={l.key} {...link(l.to)}><Icon name={l.icon} size={18} />{l.title}</a>
              ))}
            </nav>
          </aside>
        )}
        <div class="writer-page">
          <div class="writer-tools" role="toolbar" aria-label="Formatting">
            <button type="button" class="tool" aria-label="Bold" title="Bold (Ctrl or Cmd+B)" {...keepFocus}
              onClick={() => { const c = cmd(); if (c) c.bold(); }}><b>B</b></button>
            <button type="button" class="tool" aria-label="Italic" title="Italic (Ctrl or Cmd+I)" {...keepFocus}
              onClick={() => { const c = cmd(); if (c) c.italic(); }}><i>I</i></button>
            <button type="button" class="tool wide" aria-label="Normal" title="Normal: take bold, italic and highlighting off the words" {...keepFocus}
              onClick={() => { const c = cmd(); if (c) c.plain(); }}><span class="bar-label always">Normal</span></button>
            <button type="button" class="tool" aria-label="Highlight" title="Highlight: mark words to come back to" {...keepFocus}
              onClick={() => { const c = cmd(); if (c) c.highlight(); }}><Icon name="marker" /></button>
            {styled && <>
              <button type="button" class="tool" aria-label="Undo" title="Undo (Ctrl or Cmd+Z)" {...keepFocus} onClick={() => commands.current && commands.current.undo()}><Icon name="undo" /></button>
              <button type="button" class="tool" aria-label="Redo" title="Redo" {...keepFocus} onClick={() => commands.current && commands.current.redo()}><Icon name="redo" /></button>
            </>}
            <button type="button" class="tool" aria-label="Find and replace" title="Find and replace (Ctrl or Cmd+F)" aria-pressed={findOpen} onClick={() => setFindOpen(!findOpen)}><Icon name="search" /></button>
            <span class="tool-gap" />
            <button type="button" class="tool wide" {...keepFocus} onClick={() => openTab('tools')}><Icon name="split" /><span class="bar-label">Split here</span></button>
            {next && <button type="button" class="tool wide" {...keepFocus} onClick={() => openTab('tools')}><Icon name="join" /><span class="bar-label">Join next</span></button>}
          </div>
          {findOpen && <FindBar text={text} query={query} setQuery={(q) => { setQuery(q); setHit(0); }} repl={repl} setRepl={setRepl} hit={hit} setHit={setHit}
            cmd={cmd} onClose={() => setFindOpen(false)} />}
          <div class="page-head">
            <h1>{heading}</h1>
            {subtitle && <p class="page-subtitle">{subtitle}</p>}
            {sub && <p class="meta">{sub}</p>}
            {reading && <p class="meta">{reading}</p>}
            {strip.length > 0 && (
              <nav class="chapter-strip" aria-label="Scenes in this chapter, sized by length">
                {strip.map(({ note: n, words: w }) => (
                  <a key={n.path} {...link(href.write(n.path))} style={{ flexGrow: String(Math.max(w, stripMin) / stripTotal) }}
                    aria-current={n.path === note.path ? 'page' : undefined} title={String(n.data.title || n.data.id || '') + ' · ' + num(w) + ' words'}>
                    <span class="visually-hidden">{String(n.data.title || n.data.id || '')}, {num(w)} words</span>
                  </a>
                ))}
              </nav>
            )}
            {target ? <span class="writer-progress" aria-hidden="true"><span style={{ width: Math.min(100, Math.round(words * 100 / target)) + '%' }} /></span> : null}
            {loud && <p class={state === 'error' ? 'error' : 'note-line'}>{status}</p>}
            {message && <p class={state === 'error' ? 'error' : 'note-line'}>{message}</p>}
            {made && <p class="note-line">The rest is now <a {...link(href.write(made.path))}>{[made.data.id, made.data.title].filter(Boolean).join(' ')}</a>.</p>}
          </div>
          {styled ? (
            <StyledEditor key={loaded} value={text} onChange={changed} onCaret={(n) => { caret.current = n; }} label={'Text of ' + title} commands={commands}
              options={styleOpts} onName={(i) => { const e = allNames.entries[i] || (names && names.entries[i]); if (e) { setPicked(e); openTab('card'); } }} />
          ) : <textarea
            ref={box}
            class="writer-text"
            value={text}
            onInput={onInput}
            onSelect={mark}
            onKeyUp={mark}
            onClick={mark}
            onBlur={mark}
            spellcheck
            autocapitalize="sentences"
            aria-label={'Text of ' + title}
          />}
          <div class="writer-done">
            <span>Done with {sceneName}?</span>
            <span class="buttons">
              {sceneStatus === 'planned' && <button type="button" onClick={() => setDraft({ ...draftRef.current, status: 'drafted' })}>Mark as drafted</button>}
              {next
                ? <a class="button primary" {...link(href.write(next.path))}>Next: {nextName} <Icon name="right" size={18} /></a>
                : <button type="button" class="primary" onClick={done}>Back to the Chapter Grid</button>}
            </span>
          </div>
        </div>
        {right && !focus && (
          <aside class="writer-right" aria-label="Scene panel">
            <div class="side-head">
              <strong>Scene</strong>
              <button type="button" class="icon-button" onClick={toggleRight} aria-label="Hide the scene panel"><Icon name="right" /></button>
            </div>
            <div class="panel-tabs" role="tablist">
              {([['card', 'Card'], ['notes', 'Notes'], ['marks', 'Marks'], ['copies', 'Copies'], ['target', 'Target'], ['page', 'Page'], ['tools', 'Split and join'], ['team', 'Team']] as [Tab, string][]).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>
            {tab === 'card' && (picked
              ? <CodexCard schema={schema} entry={picked} link={link} onBack={() => setPicked(null)} />
              : <CardPanel schema={schema} note={note} status={sceneStatus} link={link} named={namedIn(text, allNames)} onPick={setPicked} />)}
            {tab === 'notes' && <NotesPanel source={source} bookFolder={bookFolder} note={braindump || null} canSave={canSave} onChanged={onChanged} />}
            {tab === 'marks' && <MarksPanel text={text} onGo={(a, b) => { const c = cmd(); if (c) c.select(a, b); closeOver(); }} />}
            {tab === 'target' && <TargetPanel value={target || null} onSet={(n) => { setDraft({ ...draftRef.current, target: n }); }} />}
            {tab === 'copies' && (
              <CopiesPanel source={source} note={note} body={draft.body} canSave={canSave}
                onUse={(body) => { setDraft({ ...draftRef.current, body }); reload(); setTimeout(grow, 0); }} />
            )}
            {tab === 'team' && (
              <TeamPanel status={sceneStatus} id={String(note.data.id || '')} title={String(note.data.title || '')} chapter={group && group.num != null ? group.num : null}
                bookFolder={bookFolder} onJob={onJob} link={link} />
            )}
            {tab === 'page' && <PagePanel look={look} onLook={(l) => { setLook(l); saveLook(l); }} />}
            {tab === 'tools' && (
              <ScenePanel status={sceneStatus} next={next}
                styled={styled} onStyled={(on) => { saveStyled(on); setStyled(on); setTimeout(grow, 0); }}
                onDrafted={() => { setDraft({ ...draftRef.current, status: 'drafted' }); }}
                onSplit={split} onJoin={join} />
            )}
          </aside>
        )}
        {(left || right) && !focus && <div class="scrim" onClick={closeOver} aria-hidden="true" />}
      </div>
    </div>
  );
}

/** The scene's card beside the page: its turn, hook and the rest, read only. */
function CardPanel({ schema, note, status, link, named, onPick }: {
  schema: Schema; note: NoteRecord; status: string; link: (to: string) => { href: string; onClick: (e: MouseEvent) => void };
  named: { entry: CodexEntry; count: number }[]; onPick: (e: CodexEntry) => void;
}) {
  const rows = cardFields(schema, note.type).filter((k) => k !== 'title' && k !== 'words' && k !== 'status' && !isEmptyValue(note.data[k]));
  return (
    <div class="writer-panel">
      {status && <p class="hint">Status: {status}{!isEmptyValue(note.data.accepted) ? ' · card accepted' : ''}</p>}
      {rows.length ? rows.map((k) => (
        <div class="panel-card" key={k}>
          <span class="panel-key">{fieldLabel(k)}</span>
          {formatValue(k, note.data[k], propDef(schema, note.type, k))}
        </div>
      )) : <p class="hint">This scene's card is empty.</p>}
      {!isEmptyValue(note.data.decision_note) && isEmptyValue(note.data.accepted) && <p class="reason-shown">Needs work: {String(note.data.decision_note)}</p>}
      <a class="button" {...link(href.note(note.path))}>Open the whole note</a>
      {named.length > 0 && (
        <div>
          <span class="panel-key">Named in this scene</span>
          <ul class="named-list">
            {named.map(({ entry, count }) => (
              <li key={entry.name}>
                <button type="button" class="link" onClick={() => onPick(entry)}>
                  <span class="name-dot" style={{ background: entry.color }} />{entry.name}
                </button>
                <span class="meta"> {KIND_WORD[entry.type] || entry.type} · {count === 1 ? 'once' : count + ' times'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const KIND_WORD: Record<string, string> = { character: 'character', place: 'place', item: 'item', lore: 'lore' };
/** What a codex card leaves out: bookkeeping, and things the heading already says. */
const CODEX_QUIET = ['aliases', 'type', 'name', 'status', 'ai', 'created', 'updated', 'tags', 'extends', 'color', 'relationships', 'threads_live'];

/** A character, place or item beside the page, opened by pressing its name in the text. */
function CodexCard({ schema, entry, link, onBack }: {
  schema: Schema; entry: CodexEntry; link: (to: string) => { href: string; onClick: (e: MouseEvent) => void }; onBack: () => void;
}) {
  const d = entry.note.data;
  const keys = propertyOrder(schema, entry.note.type, d).filter((k) => CODEX_QUIET.indexOf(k) < 0 && !isEmptyValue(d[k]));
  // The note's first paragraph, without the secret callouts that come after it.
  const intro = entry.note.body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('>') && !p.startsWith('#')) || '';
  return (
    <div class="writer-panel">
      <button type="button" class="link" onClick={onBack}><Icon name="left" size={16} />Back to the scene card</button>
      <h3 class="codex-name"><span class="name-dot" style={{ background: entry.color }} />{entry.name}</h3>
      <p class="hint">{KIND_WORD[entry.type] || entry.type}{entry.terms.length > 1 ? ' · also ' + entry.terms.filter((t) => t !== entry.name).join(', ') : ''}</p>
      {intro && <div class="prose small" dangerouslySetInnerHTML={{ __html: render(intro) }} />}
      {keys.map((k) => (
        <div class="panel-card" key={k}>
          <span class="panel-key">{fieldLabel(k)}</span>
          {formatValue(k, d[k], propDef(schema, entry.note.type, k))}
        </div>
      ))}
      <a class="button" {...link(href.note(entry.note.path))}>Open the whole note</a>
    </div>
  );
}

/** Find and replace in this scene. Matches are marked on the page; the arrows step through them. */
function FindBar({ text, query, setQuery, repl, setRepl, hit, setHit, cmd, onClose }: {
  text: string; query: string; setQuery: (q: string) => void; repl: string; setRepl: (r: string) => void;
  hit: number; setHit: (n: number) => void; cmd: () => EditorCommands | null; onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (input.current) { input.current.focus(); input.current.select(); } }, []);
  const found = findAll(text, query);
  const at = found.length ? Math.min(hit, found.length - 1) : -1;
  const go = (n: number) => {
    if (!found.length) return;
    const i = (n + found.length) % found.length;
    setHit(i);
    const c = cmd();
    if (c) c.select(found[i], found[i] + query.length);
  };
  const one = () => {
    const c = cmd();
    if (!c || at < 0) return;
    c.replaceRange(found[at], found[at] + query.length, repl);
  };
  const all = () => {
    const c = cmd();
    if (!c || !found.length) return;
    let out = '', from = 0;
    found.forEach((i) => { out += text.slice(from, i) + repl; from = i + query.length; });
    c.setAll(out + text.slice(from));
  };
  return (
    <div class="find-bar" role="search">
      <div class="find-row">
      <label class="search">
        <Icon name="search" size={18} />
        <span class="visually-hidden">Find</span>
        <input ref={input} type="search" value={query} placeholder="Find in this scene"
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); go(at + (e.shiftKey ? -1 : 1)); } if (e.key === 'Escape') onClose(); }} />
      </label>
      <span class="meta find-count">{query ? (found.length ? (at + 1) + ' of ' + found.length : 'None') : ''}</span>
      <button type="button" class="icon-button" aria-label="Previous" disabled={!found.length} onClick={() => go(at - 1)}><Icon name="up" /></button>
      <button type="button" class="icon-button" aria-label="Next" disabled={!found.length} onClick={() => go(at + 1)}><Icon name="down" /></button>
      <button type="button" class="icon-button" aria-label="Close Find" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div class="find-row">
      <label class="search">
        <span class="visually-hidden">Replace with</span>
        <input type="text" value={repl} placeholder="Replace with" onInput={(e) => setRepl((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <button type="button" disabled={at < 0} onClick={one}>Replace</button>
      <button type="button" disabled={!found.length} onClick={all}>Replace all</button>
      </div>
    </div>
  );
}

/** Highlighter marks in this scene, to jump to. */
function MarksPanel({ text, onGo }: { text: string; onGo: (start: number, end: number) => void }) {
  const list = markList(text);
  return (
    <div class="writer-panel">
      <p class="hint">Select words and press the highlighter in the tool row to mark them to come back to. Normal takes the mark off. In the file a mark is ==like this==, which Obsidian shows as a highlight too.</p>
      {list.length ? (
        <ul class="mark-list">
          {list.map((m) => (
            <li key={m.at}><button type="button" class="link" onClick={() => onGo(m.at, m.at + m.text.length + 4)}><mark>{m.text.length > 80 ? m.text.slice(0, 77) + '…' : m.text}</mark></button></li>
          ))}
        </ul>
      ) : <p class="hint">No marks in this scene.</p>}
    </div>
  );
}

/** The book's Braindump beside the page: loose notes, research and reminders, saved to Braindump.md in the book's folder. */
function NotesPanel({ source, bookFolder, note, canSave, onChanged }: {
  source: VaultSource; bookFolder: string | null; note: NoteRecord | null; canSave: boolean; onChanged: () => Promise<void>;
}) {
  const [text, setText] = useState(note ? note.body.replace(/^\n/, '') : '');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const changedText = text !== (note ? note.body.replace(/^\n/, '') : '');
  if (!bookFolder) return <div class="writer-panel"><p class="hint">Notes belong to a book; this scene is not in one.</p></div>;
  const save = async () => {
    if (!source.write || !source.readFresh) return;
    if (!navigator.onLine) { setSaid({ error: true, text: 'Connect to the internet to save your notes.' }); return; }
    setBusy(true);
    setSaid(null);
    try {
      const path = note ? note.path : bookFolder + '/Braindump.md';
      let sha = '', base = Frontmatter.join({ type: 'braindump' }, '\n');
      try { const f = await source.readFresh(path); sha = f.sha; base = f.text; } catch (e) { if ((e as { status?: number }).status !== 404 && !/has no/.test((e as Error).message)) throw e; }
      const next = withBody(base, '\n' + text.replace(/^\n+/, '').replace(/\s*$/, '\n'));
      await source.write(path, next, sha, 'braindump: notes from the writing screen\n\nWritten in the Story Forge app.');
      await onChanged();
      setSaid({ error: false, text: 'Saved in the book\'s Braindump note.' });
    } catch (e) {
      setSaid({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="writer-panel">
      <label class="reason">
        Notes for this book: research, reminders, loose ideas. They stay beside the page while you write.
        <textarea class="notes-box" rows={14} value={text} onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)} placeholder="Anything you want to keep in view" />
      </label>
      {canSave && <div class="buttons"><button type="button" class="primary" disabled={busy || !changedText} onClick={save}>{busy ? 'Saving…' : 'Save notes'}</button></div>}
      {said && <p class={said.error ? 'error' : 'ok'}>{said.text}</p>}
      <p class="hint">Saved in the book's Braindump note, which the team reads too.</p>
    </div>
  );
}

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** Every save of this scene from the vault's history, newest first, with Go back to this version. */
function HistoryList({ source, note, body, canSave, keep, onUse }: {
  source: VaultSource; note: NoteRecord; body: string; canSave: boolean;
  keep: (text: string, name: string) => Promise<boolean>; onUse: (body: string) => void;
}) {
  const [list, setList] = useState<SaveEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ entry: SaveEntry; body: string } | null>(null);
  const [showing, setShowing] = useState(false);
  if (!source.history || !source.readAt) return null;
  const load = async () => {
    setShowing(true);
    if (!navigator.onLine) { setError('Connect to the internet to see the history.'); return; }
    try { setList(await source.history!(note.path)); setError(null); } catch (e) { setError((e as Error).message); }
  };
  const view = async (entry: SaveEntry) => {
    try { setOpen({ entry, body: Frontmatter.parse(await source.readAt!(note.path, entry.commit)).body }); } catch (e) { setError((e as Error).message); }
  };
  const now = bodyWords(body);
  if (!showing) return <div><span class="panel-key">Every save</span><p class="hint">The vault keeps every save of this scene, yours and the team's.</p><button type="button" onClick={load}><Icon name="history" size={18} />Show every save</button></div>;
  return (
    <div>
      <span class="panel-key">Every save</span>
      {error && <p class="error">{error}</p>}
      {open ? (
        <div class="copy-view">
          <p><strong>{when(open.entry.date)}</strong> · {open.entry.agent ? 'by the ' + open.entry.agent : 'by you'} · {num(bodyWords(open.body))} words ({bodyWords(open.body) - now >= 0 ? '+' : ''}{num(bodyWords(open.body) - now)} against now)</p>
          <div class="buttons">
            <button type="button" class="primary" disabled={!canSave} onClick={async () => { if (await keep(body, 'before going back to ' + open.entry.date.slice(0, 10))) { onUse(open.body); setOpen(null); } }}>Go back to this version</button>
            <button type="button" onClick={() => setOpen(null)}>Close</button>
          </div>
          <pre class="copy-text">{splitLead(open.body).text}</pre>
        </div>
      ) : list && (list.length ? (
        <ul class="copy-list history">
          {list.map((e) => (
            <li key={e.commit}>
              <button type="button" class="link" onClick={() => view(e)}>{when(e.date)}</button>
              <span class="meta"> {e.agent ? e.agent : 'You'} · {e.message.replace(/^[a-z-]+: /, '')}</span>
            </li>
          ))}
        </ul>
      ) : <p class="hint">No saves found.</p>)}
    </div>
  );
}

/** Joined or removed scenes in the book's Archive folder, with Restore. */
function ArchiveList({ source, files, bookFolder, canSave, onChanged }: {
  source: VaultSource; files: FileEntry[]; bookFolder: string; canSave: boolean; onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [sure, setSure] = useState<{ file: FileEntry; why: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (f: FileEntry) => f.path.slice(f.path.lastIndexOf('/') + 1).replace(/\.md$/, '');
  const ask = async (f: FileEntry) => {
    setError(null);
    try { setSure({ file: f, why: archivedWhy(await source.read(f.path, f.sha)) }); } catch (e) { setError((e as Error).message); }
  };
  const restore = async () => {
    if (!sure) return;
    if (!navigator.onLine) { setError('Connect to the internet to restore a scene.'); return; }
    setBusy(true);
    try { await restoreArchived(source, sure.file, bookFolder); setSure(null); await onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div class="side-archive">
      <button type="button" class="side-add" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="archive" size={18} />Archive ({files.length})</button>
      {open && (
        <ul class="archive-list">
          {files.map((f) => (
            <li key={f.path}>
              <span>{name(f)}</span>
              {canSave && <button type="button" class="link" onClick={() => ask(f)}>Restore</button>}
            </li>
          ))}
        </ul>
      )}
      {sure && (
        <div class="side-add-form">
          <p class="hint">{sure.why ? sure.why + ' ' : ''}Restore puts {name(sure.file)} back in its old place.{/^Joined/.test(sure.why) ? ' Its words are still in the scene it joined too, so take them out there if you only want them once.' : ''}</p>
          <div class="buttons">
            <button type="button" class="primary" disabled={busy} onClick={restore}>{busy ? 'Restoring…' : 'Restore'}</button>
            <button type="button" onClick={() => setSure(null)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p class="error">{error}</p>}
    </div>
  );
}

/** Add a scene from the chapter list: a title, then it opens for writing. */
function AddInList({ onAdd, chapter }: { onAdd: (title: string) => Promise<string | null>; chapter: number | null }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return <button type="button" class="side-add" onClick={() => setOpen(true)}><Icon name="plus" size={18} />Add a scene{chapter != null ? ' to chapter ' + chapter : ''}</button>;
  const go = async () => {
    setBusy(true);
    const err = await onAdd(title.trim());
    setBusy(false);
    setError(err);
  };
  return (
    <div class="side-add-form">
      <label class="reason">
        Title of the new scene
        <input type="text" value={title} onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <div class="buttons">
        <button type="button" class="primary" disabled={busy || !title.trim()} onClick={go}>{busy ? 'Adding…' : 'Add'}</button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
      </div>
      {error && <p class="error">{error}</p>}
    </div>
  );
}

function ScenePanel({ status, next, onDrafted, onSplit, onJoin, styled, onStyled }: {
  status: string; next: NoteRecord | null; onDrafted: () => void; styled: boolean; onStyled: (on: boolean) => void;
  onSplit: (title: string) => Promise<string | null>; onJoin: () => Promise<string | null>;
}) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const err = await fn();
    setBusy(false);
    setError(err);
    if (!err) { setTitle(''); setSure(false); }
  };
  const nextName = next ? [next.data.id, next.data.title].filter(Boolean).join(' ') : '';
  return (
    <div class="writer-panel">
      {status === 'planned' && (
        <div>
          <p class="hint">This scene is still marked planned, so its words do not count on the Chapter Grid yet.</p>
          <div class="buttons"><button type="button" class="primary" onClick={onDrafted}>Mark as drafted</button></div>
        </div>
      )}
      <label class="reason">
        Split at the cursor. The words after the cursor become a new scene with this title:
        <input type="text" value={title} onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} placeholder="Title of the new scene" />
      </label>
      <div class="buttons">
        <button type="button" class="primary" disabled={busy || !title.trim()} onClick={() => run(() => onSplit(title.trim()))}>Split here</button>
      </div>
      {next && (
        <div>
          <p class="hint">Join {nextName} onto the end of this scene. Its old note moves to the book's Archive folder.</p>
          <div class="buttons">
            {sure ? (
              <>
                <button type="button" class="primary" disabled={busy} onClick={() => run(onJoin)}>Yes, join {String(next.data.id || 'it')}</button>
                <button type="button" onClick={() => setSure(false)}>Cancel</button>
              </>
            ) : <button type="button" disabled={busy} onClick={() => setSure(true)}>Join the next scene</button>}
          </div>
        </div>
      )}
      <label class="check">
        <input type="checkbox" checked={styled} onChange={(e) => onStyled((e.currentTarget as HTMLInputElement).checked)} />
        Show italics and bold as styled text on this device. Turn it off to see the plain text with its stars.
      </label>
      {busy && <p class="hint">Working…</p>}
      {error && <p class="error">{error}</p>}
    </div>
  );
}

/** Ask the team: each button writes a job note the vault's GitHub workflow runs. Kyle's words never get drafted over. */
function TeamPanel({ status, id, title, chapter, bookFolder, onJob, link }: {
  status: string; id: string; title: string; chapter: number | null; bookFolder: string | null; onJob?: OnJob;
  link: (to: string) => { href: string; onClick: (e: MouseEvent) => void };
}) {
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState<JobKind | ''>('');
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  if (!onJob) return <div class="writer-panel"><p class="hint">Asking the team needs your own vault, not the demo.</p></div>;
  const send = async (kind: JobKind, target: string, words = '') => {
    setBusy(kind);
    setSaid(null);
    const jobTitle = kind === 'custom' ? (words.trim().length > 60 ? words.trim().slice(0, 57).replace(/\s+\S*$/, '') + '…' : words.trim()) || 'Ask the team' : defaultJobTitle(kind, target, kind === 'notes' || kind === 'table-read' ? '' : title);
    const r = await onJob({ title: jobTitle, kind, target, book: bookFolder || '', ask: kind === 'table-read' ? jobAsk(kind, target, words) : words });
    setBusy('');
    setSaid(r);
    if (!r.error && kind === 'custom') { setAsk(''); setAsking(false); }
  };
  const chapterTarget = chapter != null ? 'Chapter ' + chapter : '';
  return (
    <div class="writer-panel team-panel">
      {status === 'planned'
        ? <button type="button" class="primary" disabled={busy !== '' || !id} onClick={() => send('draft', id)}>{busy === 'draft' ? 'Sending…' : 'Draft this scene'}</button>
        : <p class="hint">This scene has words in it, so the team won't draft over it.</p>}
      <button type="button" disabled={busy !== '' || !chapterTarget} onClick={() => send('notes', chapterTarget)}>{busy === 'notes' ? 'Sending…' : 'Notes on this chapter'}</button>
      <button type="button" disabled={busy !== '' || !chapterTarget} onClick={() => send('table-read', chapterTarget, '')}>{busy === 'table-read' ? 'Sending…' : 'Table read of this chapter'}</button>
      <button type="button" disabled={busy !== '' || !id} onClick={() => send('check', id)}>{busy === 'check' ? 'Sending…' : 'Check for AI-sounding phrases'}</button>
      <button type="button" disabled={busy !== ''} onClick={() => send('learn', '')}>{busy === 'learn' ? 'Sending…' : 'Learn from my edits'}</button>
      {asking ? (
        <div class="side-add-form">
          <label class="reason">
            What do you want the team to do?
            <input type="text" value={ask} onInput={(e) => setAsk((e.currentTarget as HTMLInputElement).value)} placeholder="One line" />
          </label>
          <div class="buttons">
            <button type="button" class="primary" disabled={busy !== '' || !ask.trim()} onClick={() => send('custom', '', ask)}>{busy === 'custom' ? 'Sending…' : 'Send'}</button>
            <button type="button" onClick={() => { setAsking(false); setAsk(''); }}>Cancel</button>
          </div>
        </div>
      ) : <button type="button" disabled={busy !== ''} onClick={() => { setAsking(true); setSaid(null); }}>Ask the team…</button>}
      {said && <p class={said.error ? 'error' : 'ok'}>{said.text}</p>}
      <p class="hint">Each press writes a job into the vault. The team picks it up and the answer lands on the <a {...link(href.jobs())}>Jobs</a> screen. A table read is three test readers who only see this chapter's pages.</p>
    </div>
  );
}

/** How the page looks on this device: text size, spacing, width, font and paper. */
function PagePanel({ look, onLook }: { look: PageLook; onLook: (l: PageLook) => void }) {
  return (
    <div class="writer-panel page-panel">
      {LOOK_CHOICES.map((c) => (
        <div key={c.key} role="group" aria-label={c.label}>
          <span class="panel-key">{c.label}</span>
          <div class="seg small wrap">
            {c.options.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={look[c.key] === v} onClick={() => onLook({ ...look, [c.key]: v })}>{l}</button>
            ))}
          </div>
        </div>
      ))}
      <p class="hint">These choices stay on this device. The iPad and the computer can each have their own.</p>
    </div>
  );
}

function TargetPanel({ value, onSet }: { value: number | null; onSet: (n: number) => void }) {
  const [v, setV] = useState(value ? String(value) : '');
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
  return (
    <div class="writer-panel">
      <label class="reason">
        Word target for this scene
        <input type="text" inputMode="numeric" value={v} onInput={(e) => setV((e.currentTarget as HTMLInputElement).value)} placeholder="For example 2500" />
      </label>
      <div class="buttons">
        <button type="button" class="primary" disabled={!(n > 0)} onClick={() => onSet(n)}>Set target</button>
      </div>
      <p class="hint">The target is saved with the scene next time it saves.</p>
    </div>
  );
}

function CopiesPanel({ source, note, body, canSave, onUse }: {
  source: VaultSource; note: NoteRecord; body: string; canSave: boolean; onUse: (body: string) => void;
}) {
  const [list, setList] = useState<SnapshotEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');
  const [open, setOpen] = useState<{ entry: SnapshotEntry; body: string } | null>(null);

  const load = useCallback(async () => {
    if (!navigator.onLine) { setError('Connect to the internet to see or save copies.'); return; }
    try {
      setList(await listSnapshots(source, note));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [source, note]);
  useEffect(() => { load(); }, [load]);

  const keep = async (text: string, name: string) => {
    setBusy(true);
    try {
      await saveSnapshot(source, note, text, name, new Date());
      setLabel('');
      await load();
      return true;
    } catch (e) {
      setError(offlineError(e) ? 'Connect to the internet to save a copy.' : (e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const view = async (entry: SnapshotEntry) => {
    try {
      const text = await source.read(entry.path, entry.sha);
      setOpen({ entry, body: Frontmatter.parse(text).body });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Going back to an older copy saves what is on screen as a copy first, so nothing is lost.
  const use = async () => {
    if (!open) return;
    if (await keep(body, 'before going back to v' + open.entry.version)) { onUse(open.body); setOpen(null); }
  };

  return (
    <div class="writer-panel">
      {canSave && (
        <>
          <label class="reason">
            Save a copy of this version
            <input type="text" value={label} onInput={(e) => setLabel((e.currentTarget as HTMLInputElement).value)} placeholder="Name, for example before cutting the fight" />
          </label>
          <div class="buttons">
            <button type="button" class="primary" disabled={busy} onClick={() => keep(body, label.trim() || 'copy')}>Save a copy</button>
          </div>
        </>
      )}
      {error && <p class="error">{error}</p>}
      {open ? (
        <div class="copy-view">
          <p><strong>Copy {open.entry.version}{open.entry.label ? ' (' + open.entry.label + ')' : ''}</strong>, {num(bodyWords(open.body))} words</p>
          <div class="buttons">
            <button type="button" class="primary" disabled={busy || !canSave} onClick={use}>Go back to this version</button>
            <button type="button" onClick={() => setOpen(null)}>Close</button>
          </div>
          <pre class="copy-text">{splitLead(open.body).text}</pre>
        </div>
      ) : list && (
        list.length ? (
          <ul class="copy-list">
            {list.map((s) => (
              <li key={s.path}><button type="button" class="link" onClick={() => view(s)}>Copy {s.version}{s.label ? ' (' + s.label + ')' : ''}</button></li>
            ))}
          </ul>
        ) : <p class="hint">No copies of this scene yet.</p>
      )}
      {!open && <HistoryList source={source} note={note} body={body} canSave={canSave} keep={keep} onUse={onUse} />}
    </div>
  );
}
