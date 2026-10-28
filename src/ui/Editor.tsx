// Full-screen writing: one scene's prose, styled the way a word processor shows it. Each change is kept on this device
// straight away; it goes to the vault when Kyle presses Done, after two quiet minutes, or (if he is offline) when the connection is back.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLockedPage } from './viewport.ts';
import {
  bodyWords, holdOpen, isUnsaved, loadDrafts, openDraft, putDraft, saveDraft, saveSnapshot, splitLead, type Draft
} from '../lib/drafts.ts';
import { toNumber } from '../lib/links.ts';
import { archiveForJoin, joinedBody, noteJoinForTeam, removeJoined, splitAt, splitOff } from '../lib/scenes.ts';
import { chapterHeading, type ChapterGroup } from '../lib/board.ts';
import { formatValue, isEmptyValue, sceneHeader } from '../lib/format.ts';
import { propDef } from '../lib/schema.ts';
import type { FileEntry, NoteRecord, Schema, VaultSource } from '../lib/types.ts';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';
import { DONE_STATUSES } from '../lib/overview.ts';
import { boardLinks } from './StoryBoards.tsx';
import { BeatsView, type BeatsApi } from './BeatsPage.tsx';
import { StyledEditor, type EditorCommands } from './StyledEditor.tsx';
import { loadLook, lookStyle, saveLook, type PageLook } from '../lib/page.ts';
import { askBody, defaultJobTitle, jobAsk, resultBody, type OnJob } from '../lib/jobs.ts';
import { passageFor, passageMessage, type PassageTool } from '../lib/chat.ts';
import { SceneChat, type OnChat } from './Chat.tsx';
import type { Conversation } from '../lib/chat.ts';
import { answeredKeys, askingKeys, askItems, bracketKey, fillAnswers, fillJob, findBrackets, isOpenJob, loadAutoFill, loadFilled, placeAnswer, saveAutoFill, saveFilled, type Bracket } from '../lib/brackets.ts';
import { lineAt, loadDots, mapFor, merge3, saveDots } from '../lib/live.ts';
import { chapterTodos, isOpen, type NewTodo } from '../lib/todos.ts';
import { trackWords, wordsNotTyped } from '../lib/pomodoro.ts';
import type { ComponentChildren } from 'preact';
import type { Decision } from '../lib/ideas.ts';
import type { Choice } from '../lib/write-queue.ts';

type OnTodo = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;

import { matcher, namedIn, type CodexEntry } from '../lib/codex.ts';
import { FlowTab } from './Flow.tsx';
import type { CodexNow } from '../lib/codexnow.ts';
import { markList } from '../lib/styled.ts';
import { typedWords } from '../lib/drafts.ts';
import { makeNote } from '../lib/vault-index.ts';
import type { CheckOptions } from '../lib/lintcheck.ts';
import { CheckPanel } from './CheckPanel.tsx';
import { addRules, addSkip, applyChange, loadRules, loadSkips, parseChanges, placeChanges, revertChange, rewriteSpan, ruleFits, saveChoices, swapsOf, todoTicks, withChoices, type Change, type ChangeStatus } from '../lib/changes.ts';
import { copyFor, workingNumber, type SavedDraft } from '../lib/bookdrafts.ts';
import { styledHtml } from '../lib/styled.ts';
import { AskForChanges, ChangesBar, ChangesPage, ChangesPanel, DraftMenu, showCard, loadView, saveView, type ChangesView } from './Changes.tsx';
import { ListenBar, useListen } from './Listen.tsx';
import { OptionsAsk, OptionsPanel, usePassageOptions } from './OptionsPanel.tsx';
import { SceneSection, type SectionApi } from './SceneSection.tsx';
import {
  AddChapterAtEnd, ArchiveList, BeatsList, CardPanel, CodexCard, CopiesPanel, DeleteAsk, FindBar, MarksPanel, MoveChapter, NotesPanel, offlineError, PagePanel,
  PlanPanel, ScenePanel, SideAddForm, TargetPanel, TeamPanel, TodosPanel
} from './EditorPanels.tsx';

const QUIET_SAVE_MS = 2 * 60 * 1000;
// Where to land after the change arrows open another chapter: its first change, or its last when going back.
let landAt: 'first' | 'last' | null = null;
// While Kyle types without a two-minute pause, the words still go to the vault this often (Kyle, 2026-10-20).
const TYPING_SAVE_MS = 5 * 60 * 1000;
// How long after the last letter the page's words are counted again.
const COUNT_MS = 300;
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
type Tab = 'changes' | 'flow' | 'chat' | 'plan' | 'scrap' | 'beats' | 'todos' | 'card' | 'notes' | 'marks' | 'copies' | 'target' | 'tools' | 'page' | 'team' | 'check' | 'options';
const TABS: [Tab, string][] = [['changes', 'Changes'], ['chat', 'Chat'], ['plan', 'Plan'], ['scrap', 'Scrap'], ['beats', 'Beats'], ['flow', 'Workflow'], ['card', 'Card'], ['todos', 'To-dos'], ['notes', 'Notes'], ['marks', 'Marks'],
  ['copies', 'Copies'], ['target', 'Target'], ['page', 'Page look'], ['tools', 'Done, split, join'], ['team', 'Ask the team'], ['check', 'Check'], ['options', 'Options']];
// One row of four tabs and More (Kyle, 2026-10-23: "this design change is good as long as we don't lose any
// functionality", with To-dos in the row instead of Scrap). Every other tab is one press away in More, by heading.
const MAIN_TABS: Tab[] = ['chat', 'plan', 'beats', 'todos'];
// While a chapter has the team's changes (Workflow 1.2, step 41), Changes takes the first place and Beats moves into More.
const EDIT_TABS: Tab[] = ['changes', 'chat', 'plan', 'todos'];
// What the More button says while a part picked from it is open: short, so the row fits beside the page on the iPad.
const SHORT: Partial<Record<Tab, string>> = { tools: 'Split, join', team: 'Ask', options: 'Options', flow: 'Workflow', notes: 'Braindump', check: 'Check' };
const MORE_GROUPS: [string, [Tab, string, string][]][] = [
  ['This scene', [['card', 'cards', 'Card and names'], ['marks', 'marker', 'Marks'], ['target', 'gauge', 'Word target'], ['copies', 'history', 'Copies'], ['tools', 'split', 'Done, split, join']]],
  ['This chapter', [['changes', 'swap', 'Changes from the team'], ['beats', 'beats', 'Beats'], ['scrap', 'note', 'Scrap'], ['flow', 'outline', 'From the workflow']]],
  ['The team', [['team', 'spark', 'Ask the team for a job'], ['options', 'swap', 'Options to pick from']]],
  ['Tools', [['check', 'scan', 'Check for AI phrases'], ['page', 'type', 'Page look'], ['notes', 'idea', 'Braindump (whole book)']]],
];
// The right-hand column opens on the tab Kyle used last on this device; the team's chat the first time.
const TAB_KEY = 'story-forge.panel-tab';
function loadTab(): Tab {
  try { const t = localStorage.getItem(TAB_KEY) as Tab | null; return t && TABS.some(([k]) => k === t) ? t : 'chat'; } catch { return 'chat'; }
}

export interface EditorBook { title: string; folder: string; groups: ChapterGroup[]; archive?: FileEntry[] }

type Saving = 'idle' | 'saving' | 'saved' | 'device' | 'error';

export function Editor({ source, schema, note, next, prev, nextMentions, book, backTo, onSaved, onChanged, onAdd, onAddChapter, onRenameChapter, onMoveChapter, onDeleteScenes, onJob, onChat, codex, codexNow, braindump, sceneNotes, todos, onTodo, onAddTodo, waiting, timer, fillJobs, convo, plan, scrap, beats, chapterBeats, optionJobs, checkOpts, recipes = [], flow, changes, drafts }: {
  source: VaultSource; schema: Schema; note: NoteRecord;
  /** The scene after this one in reading order, for Join, and the book's notes that name it. */
  next: NoteRecord | null;
  /** The scene before this one in reading order, for the Previous button at the bottom of the page. */
  prev: NoteRecord | null;
  nextMentions: NoteRecord[];
  /** The book the scene is in, for the chapter list. */
  book: EditorBook | null;
  backTo: string;
  onSaved: (n: NoteRecord) => void;
  /** Sync after scenes were added or removed, so the boards show them. */
  onChanged: () => Promise<void>;
  /** Add a scene to a chapter and open it. */
  onAdd?: (chapter: number | null, chapterTitle: string, title: string) => Promise<string | null>;
  /** Add a chapter of one scene after chapter `after` (null: after the last), later chapters moving up one, and open it. */
  onAddChapter?: (after: number | null, chapterTitle: string) => Promise<string | null>;
  /** Give a chapter a new name (its scenes' chapter_title), saved through the queue. */
  onRenameChapter?: (scenes: NoteRecord[], title: string) => void;
  /** Move a chapter to another number, the ones between closing up. */
  onMoveChapter?: (from: number, to: number) => Promise<string | null>;
  /** Delete scenes (to the book's Archive); a chapter left empty closes up. */
  onDeleteScenes?: (paths: string[]) => Promise<string | null>;
  /** Ask the team for a job on this scene, its chapter or the book. */
  onJob?: OnJob;
  /** Send a message to the team in this scene's conversation (the toolbar's Rewrite, Describe, Brainstorm, Write on). */
  onChat?: OnChat;
  /** The book's characters, places, items and lore, whose names light up in the text. */
  codex?: CodexEntry[];
  /** A codex note's state at this scene and its secrets, for the codex card. */
  codexNow?: (note: NoteRecord) => CodexNow;
  /** The book's Braindump note, for the Notes tab (null: the book has none yet). */
  braindump?: NoteRecord | null;
  /** This scene's notes (Kyle's outline, Team notes, questions), shown under its card, never on the page. */
  sceneNotes?: NoteRecord | null;
  /** The book's to-dos (its Tasks folder); the To-dos tab shows this chapter's. */
  todos?: NoteRecord[];
  /** Tick or untick a to-do (a status edit through the write queue). */
  onTodo?: OnTodo;
  onAddTodo?: (t: NewTodo) => Promise<string | null>;
  /** Choices waiting to save, by path, for the to-dos' Saving badge. */
  waiting?: Record<string, Choice>;
  /** The Pomodoro timer, drawn in the top bar (or beside Leave focus in Focus mode) so it never covers the page. */
  timer?: (variant: 'bar' | 'focus') => ComponentChildren;
  /** The team's fill jobs for this scene: the {braces} they are answering, and their answers. */
  fillJobs?: NoteRecord[];
  /** This scene's conversation with the team, for the Chat tab. */
  convo?: Conversation | null;
  /** The chapter's plan (Chapter Plans), for the Plan tab; null when the chapter has none yet. */
  plan?: NoteRecord | null;
  /** The chapter's scrap (Chapter Scraps): words cut from it and loose notes, for the Scrap tab; null when it has none yet. */
  scrap?: NoteRecord | null;
  /** Beats mode: the chapter by its beats takes the page's place (its beats note, and a beats job still open). */
  beats?: { note: NoteRecord | null; asking: NoteRecord | null } | null;
  /** The open scene's chapter beats note, listed in the right column's Beats tab. */
  chapterBeats?: NoteRecord | null;
  /** This scene's options jobs (Options for a passage), newest first. */
  optionJobs?: NoteRecord[];
  /** The book's settings for Check (its Style Guide and the vault's Config). */
  checkOpts?: CheckOptions;
  /** The vault's recipes by name, for the Team tab's "With a recipe". */
  recipes?: string[];
  /** Workflow mode's results for this book and the way there, for the Workflow tab (what was kept about this chapter and its people). */
  flow?: { results: NoteRecord[]; href: string };
  /** The chapter's changes note, and every chapter's count of changes waiting with the scene to open, for the Changes view
   * (Workflow 1.2, step 41). */
  changes?: { note: NoteRecord | null; book: { chapter: number; open: number; path: string }[]; asking?: boolean; like?: (pairs: [string, string][]) => number };
  /** The book's saved drafts, saving the next one and exporting any of them to Word. */
  drafts?: { saved: SavedDraft[]; onSave: () => Promise<string | null>; onExport: (n: number | null) => Promise<string | null> };
}) {
  useLockedPage();
  const beatsMode = Boolean(beats);
  // The chapter list's long press (or right-click): a small menu under the chapter, then a form in the same place.
  const [chMenu, setChMenu] = useState<string | null>(null);
  const [chAdd, setChAdd] = useState<{ key: string; kind: 'chapter' | 'scene' | 'rename' | 'move' | 'delete' } | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(() => { try { return localStorage.getItem('story-forge.side-tools') === '1'; } catch { return false; } });
  const namingDone = useRef(false);
  // Chapters whose scenes Kyle asked to see in the list (hold a chapter, Show scenes), kept per book on the device.
  const shownKey = 'story-forge.shown-scenes.' + (book ? book.folder : '');
  const [shownScenes, setShownScenes] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(shownKey) || '[]'); } catch { return []; } });
  const toggleScenes = (k: string) => {
    const next = shownScenes.indexOf(k) >= 0 ? shownScenes.filter((x) => x !== k) : shownScenes.concat(k);
    setShownScenes(next);
    try { localStorage.setItem(shownKey, JSON.stringify(next)); } catch { /* lasts until reload */ }
  };
  const hold = useRef<{ t: ReturnType<typeof setTimeout> | null; x: number; y: number; fired: number }>({ t: null, x: 0, y: 0, fired: 0 });
  const beatsSaver = useRef<((closing: boolean) => Promise<boolean>) | null>(null);
  // In beats mode the tool row works on the beat Kyle is in (Kyle, 2026-10-19: "the full word processor tool set too").
  const beatsApi = useRef<BeatsApi | null>(null);
  const beatText = useRef('');
  const [, setBeatRev] = useState(0);
  const [beatsChip, setBeatsChip] = useState({ text: 'Saved', cls: 'good' });
  const bookFolder = book ? book.folder : null;
  const canSave = Boolean(source.readFresh && source.write);
  const [draft, setDraftState] = useState<Draft>(() => openDraft(note, loadDrafts(source.key)[note.path], new Date()));
  const draftRef = useRef(draft);
  const [state, setState] = useState<Saving>('idle');
  const [message, setMessage] = useState<string | null>(null);
  // Between 900 and 1200 px the chapter list and the right-hand column share the room beside the page: the right one
  // (the team's chat) wins when both were open.
  const left0 = () => wide(WIDE_LEFT) && loadSide('chapters', true) && (wide(WIDE_RIGHT) || !loadSide('scene-panel', true));
  const [left, setLeft] = useState(left0);
  const [right, setRight] = useState(() => (wide(WIDE_RIGHT) || (wide(WIDE_LEFT) && !left0())) && loadSide('scene-panel', true));
  const [tab, setTabState] = useState<Tab>(loadTab);
  const setTab = (t: Tab) => { setTabState(t); setMoreList(false); try { localStorage.setItem(TAB_KEY, t); } catch { /* lasts until reload */ } };
  // The More list fills the column in place of the open tab until one is picked or More is pressed again.
  const [moreList, setMoreList] = useState(false);
  // The right-hand column opens at its top, and every tab or the More list starts at the top too (Kyle, 2026-10-23:
  // "it should always start at the very top. It shouldn't have the same behavior as the chapters").
  const rightRef = useRef<HTMLElement>(null);
  useEffect(() => { if (rightRef.current) rightRef.current.scrollTop = 0; }, [tab, moreList]);
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
  const [asked, setAsked] = useState<{ busy: PassageTool | ''; error: boolean; text: string } | null>(null);
  // {Braces}: what Fill braces said, answers that found no place, and the per-device switch to send them unasked.
  const [filling, setFilling] = useState<{ busy: boolean; error: boolean; text: string } | null>(null);
  const [unplaced, setUnplaced] = useState<{ key: string; marker: string; answer: string }[]>([]);
  const [autoFill, setAutoFill] = useState(loadAutoFill);
  // Lines added by the team or from elsewhere, with a dot beside them until Kyle clicks into them (this device only).
  const [dots, setDotsState] = useState<string[]>(() => loadDots(source.key, note.path));
  const setDots = (f: (d: string[]) => string[]) => setDotsState((prev) => { const d = f(prev); if (d !== prev) saveDots(source.key, note.path, d); return d; });
  const addDots = (lines: string[]) => { if (lines.length) setDots((prev) => prev.concat(lines.filter((l, i) => prev.indexOf(l) < 0 && lines.indexOf(l) === i))); };
  /** Kyle clicked or typed in a line: its dot goes. */
  const clearDot = (at: number) => {
    const line = lineAt(splitLead(draftRef.current.body).text, at);
    setDots((prev) => (prev.indexOf(line) >= 0 ? prev.filter((l) => l !== line) : prev));
  };
  const dotSet = useMemo(() => new Set(dots), [dots]);
  const fills = fillJobs || [];
  const fillKey = fills.map((j) => j.path + '@' + j.sha).join(';');
  const asking = useMemo(() => askingKeys(fills), [fillKey]);
  const answered = useMemo(() => answeredKeys(fills), [fillKey]);
  const askingMarkers = useMemo(() => {
    const out = new Set<string>();
    fills.filter(isOpenJob).forEach((j) => askItems(askBody(j.body)).forEach((it) => out.add(it.marker.trim().toLowerCase())));
    return out;
  }, [fillKey]);
  // The codex as one key, so the names are only worked out again when a name, nickname or colour changes.
  const codexKey = (codex || []).map((e) => e.name + '|' + e.terms.join(',') + '|' + e.color).join(';');
  const allNames = useMemo(() => matcher(codex || []), [codexKey]);
  const names = look.names === 'on' && (codex || []).length ? allNames : null;
  const findQ = findOpen ? query : '';
  const styleOpts = useMemo(() => ({ names, find: findQ, asks: true, asking: askingMarkers, added: dotSet }), [names, findQ, askingMarkers, dotSet]);
  const beatOpts = useMemo(() => ({ names, find: findQ, asks: true }), [names, findQ]);
  const sibOpts = useMemo(() => ({ names }), [names]);
  // The chapter's other scenes on the same page (Kyle, 2026-10-22). Each saves itself; these are their handles.
  const sibs = useRef(new Map<string, SectionApi>());
  const [sibFocus, setSibFocus] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  // Opened at a scene further down its chapter: the page starts at that scene.
  useEffect(() => {
    const el = mainRef.current;
    const first = el && el.parentElement ? el.parentElement.querySelector('[data-section]') : null;
    if (el && first && first.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) el.scrollIntoView({ block: 'start' });
  }, [note.path]);
  const registerSib = useCallback((path: string, api: SectionApi | null) => { if (api) sibs.current.set(path, api); else sibs.current.delete(path); }, []);
  const saveSiblings = async (closing: boolean): Promise<boolean> => {
    let ok = true;
    for (const api of Array.from(sibs.current.values())) if (!(await api.save(closing))) ok = false;
    return ok;
  };
  const saving = useRef(false);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSince = useRef<number | null>(null);
  const kept = useRef(true);

  // Every version of the scene this page has started from, so an older copy that a slow read brings back is never merged.
  const seen = useRef<Set<string>>(new Set([draft.baseSha]));
  const setDraft = useCallback((d: Draft) => {
    seen.current.add(d.baseSha);
    draftRef.current = d;
    setDraftState(d);
    kept.current = putDraft(source.key, d.path, d);
  }, [source]);

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
      // Lines from elsewhere went into the saved scene: an empty base sha lets the live read below bring them into the page.
      const next: Draft = { ...now, baseSha: r.merged ? '' : r.note.sha, baseBody: d.body, target: now.target === d.target ? null : now.target, status: now.status === d.status ? null : now.status, freshHeadline: undefined, pending: false, error: undefined };
      if (closing && !isUnsaved(next)) { draftRef.current = next; putDraft(source.key, d.path, null); }
      else setDraft(next);
      setState('saved');
      setMessage(r.clash ? 'This scene had also changed somewhere else, on lines you changed too. Your lines are saved; the other version is kept as a copy (' + r.clash.slice(r.clash.lastIndexOf('/') + 1).replace(/\.md$/, '') + ').'
        : r.merged ? 'This scene had also changed somewhere else. Both sets of changes are saved, and the new lines come into your page.' : null);
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

  // Whether what is typed at the cursor will be bold, italic or highlighted: the tool row's buttons show it pressed.
  const [typing, setTyping] = useState({ i: false, b: false, h: false });
  // Bumped when the text changes from outside the writing box (copy restored, split, join), so the styled box reloads.
  const [loaded, setLoaded] = useState(0);
  const reload = () => setLoaded((n) => n + 1);
  const changed = (text: string) => {
    setDraft({ ...draftRef.current, body: splitLead(draftRef.current.body).lead + text, updatedAt: new Date().toISOString() });
    if (state !== 'error') setState('idle');
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(() => { typingSince.current = null; save(false); }, QUIET_SAVE_MS);
    if (typingSince.current == null) typingSince.current = Date.now();
    else if (Date.now() - typingSince.current >= TYPING_SAVE_MS) { typingSince.current = null; save(false); }
  };

  // While the scene is open, only this page saves it (the 30-second sync leaves it alone).
  useEffect(() => holdOpen(note.path), [note.path]);

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

  /** Split at the cursor: the words after it become a new scene right after this one. */
  const split = async (newTitle: string): Promise<string | null> => {
    if (!bookFolder || !canSave) return 'Splitting needs your own vault, not the demo.';
    if (!navigator.onLine) return 'Connect to the internet to split a scene.';
    if (!(await saveSiblings(false))) return 'Another scene of this chapter did not save yet. Try again in a moment.';
    const d = draftRef.current;
    const { lead, text: words } = splitLead(d.body);
    const at = caret.current == null ? words.length : Math.min(caret.current, words.length);
    const parts = splitAt(words, at);
    if (!parts.after.trim()) return 'Put the cursor where the new scene should start, then press Split.';
    if (!parts.before.trim()) return 'The cursor is at the very start. Put it where the new scene should start.';
    try {
      const created = await splitOff(source, note, next, d.body, parts.after, newTitle, bookFolder, new Date());
      setDraft({ ...draftRef.current, body: lead + parts.before, freshHeadline: true });
      reload();
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
    // The next scene may be on this page with words typed into it: they reach the vault before it is joined.
    if (!(await saveSiblings(true))) return 'The next scene did not save yet, so it was not joined. Try again in a moment.';
    try {
      const taken = await archiveForJoin(source, note, next, new Date());
      const joined = joinedBody(draftRef.current.body, taken.body);
      wordsNotTyped(bodyWords(joined) - bodyWords(draftRef.current.body));
      setDraft({ ...draftRef.current, body: joined, freshHeadline: true });
      reload();
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
    if (beatsSaver.current && !(await beatsSaver.current(true))) return;
    const ok = await save(true);
    // The chapter's other scenes: a scene that cannot save now waits on the device for the next sync.
    await saveSiblings(true);
    if (ok) location.hash = to;
  };
  const done = () => go(backTo);
  const link = (to: string) => ({ href: to, onClick: (e: MouseEvent) => { e.preventDefault(); go(to); } });

  /** Props for a row in the chapter list that opens a menu when held (or right-clicked). `inner` keeps the hold from also
   * reaching the chapter around it. */
  const holdFor = (openMenu: () => void, inner = false) => {
    const stop = () => { const h = hold.current; if (h.t) clearTimeout(h.t); h.t = null; };
    return {
      'data-own-hold': '',
      onPointerDown: (e: PointerEvent) => {
        if (inner) e.stopPropagation();
        if (e.pointerType === 'mouse') return;
        stop();
        const h = hold.current;
        h.x = e.clientX; h.y = e.clientY;
        h.t = setTimeout(() => { h.t = null; h.fired = Date.now(); openMenu(); }, 500);
      },
      onPointerMove: (e: PointerEvent) => { const h = hold.current; if (h.t && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) stop(); },
      onPointerUp: stop,
      onPointerCancel: stop,
      onContextMenu: (e: MouseEvent) => { e.preventDefault(); if (inner) e.stopPropagation(); if (Date.now() - hold.current.fired > 800) openMenu(); },
      onClickCapture: (e: MouseEvent) => {
        // The finger lifting after the hold is not a press of the scene under it.
        if (Date.now() - hold.current.fired < 800 && !(e.target as Element).closest('.side-menu, .side-add-form')) { hold.current.fired = 0; e.preventDefault(); e.stopPropagation(); }
      }
    };
  };

  /** Delete scenes from the chapter list: save what is typed first, then the scenes go to the Archive. When the open
   * scene goes, the page moves to the next scene left in the book (or back, when none is). */
  const remove = async (scenes: NoteRecord[]): Promise<string | null> => {
    if (!onDeleteScenes || !book) return null;
    if (quiet.current) clearTimeout(quiet.current);
    if (beatsSaver.current && !(await beatsSaver.current(true))) return 'Save this scene first: it did not reach the vault.';
    if (!(await save(true))) return 'Save this scene first: it did not reach the vault.';
    await saveSiblings(true);
    const paths = scenes.map((n) => n.path);
    const all = book.groups.reduce((list: NoteRecord[], g) => list.concat(g.scenes), []);
    const at = all.findIndex((n) => paths.indexOf(n.path) >= 0);
    const stay = all.filter((n) => paths.indexOf(n.path) < 0);
    const land = stay.find((n) => all.indexOf(n) > at) || stay.filter((n) => all.indexOf(n) < at).pop() || null;
    const err = await onDeleteScenes(paths);
    if (err) return err;
    setChAdd(null);
    if (paths.indexOf(note.path) >= 0) location.hash = land ? href.write(land.path) : backTo;
    return null;
  };

  // Between 900 and 1200 px only one side fits beside the page, so opening one closes the other.
  const shared = () => wide(WIDE_LEFT) && !wide(WIDE_RIGHT);
  const toggleLeft = () => { const v = !left; setLeft(v); if (wide(WIDE_LEFT)) saveSide('chapters', v); if (v && right && shared()) setRight(false); };
  const showRight = (v: boolean) => { setRight(v); if (wide(WIDE_LEFT)) saveSide('scene-panel', v); if (v && left && shared()) setLeft(false); };
  const toggleRight = () => showRight(!right);
  // The chapter list keeps where Kyle left it scrolled, per book, across scenes and visits to other screens (Kyle,
  // 2026-10-22: "rather than moving the left side chapter bar as i select through ... simply remember its position when
  // i leave and re-enter"). Only the very first time, with nothing remembered, does it open at the chapter he is in.
  const sideRef = useRef<HTMLElement | null>(null);
  const sideShown = Boolean(book && left && !focus);
  const sideKey = 'story-forge.chapter-list-scroll.' + (book ? book.folder : '');
  useLayoutEffect(() => {
    const side = sideRef.current;
    if (!sideShown || !side) return;
    let saved: number | null = null;
    try { const v = localStorage.getItem(sideKey); saved = v == null ? null : Number(v); } catch { /* no storage: open at the chapter */ }
    if (saved != null && isFinite(saved)) { side.scrollTop = saved; }
    else {
      const here = side.querySelector<HTMLElement>('.side-scene[aria-current="page"]');
      if (here) {
        const head = here.parentElement && here.parentElement.querySelector<HTMLElement>('.side-chapter');
        const top = (head || here).getBoundingClientRect().top - side.getBoundingClientRect().top + side.scrollTop;
        side.scrollTop = Math.max(0, top - side.clientHeight / 4);
      }
    }
    const keep = () => { try { localStorage.setItem(sideKey, String(Math.round(side.scrollTop))); } catch { /* lasts until reload */ } };
    side.addEventListener('scroll', keep, { passive: true });
    return () => side.removeEventListener('scroll', keep);
  }, [sideShown, sideKey]);
  const openTab = (t: Tab) => { setTab(t); if (!right) showRight(true); };
  // The dimmed page behind a panel that slides over it: pressing it closes that panel.
  const closeOver = () => { if (!wide(WIDE_LEFT)) { setLeft(false); setRight(false); } };

  // While the page shows the team's changes or a saved draft, the writing box is not there: tools and new words go to the text.
  const readOnly = useRef(false);
  const cmd = (): EditorCommands | null => {
    if (beatsMode) return beatsApi.current ? beatsApi.current.cmd() : null;
    const sib = sibFocus ? sibs.current.get(sibFocus) : null;
    if (sib && sib.commands.current) return sib.commands.current;
    return readOnly.current ? null : commands.current;
  };
  /** Put new text on the page (the team's answers, words from elsewhere), keeping Kyle's cursor in his sentence. */
  const applyText = (next: string, map: (n: number) => number) => {
    // These words are not Kyle's typing: they count in neither the Pomodoro nor the day's words typed.
    wordsNotTyped(bodyWords(next) - bodyWords(pageText()));
    const c = cmd();
    if (c) c.apply(next, map);
    else { changed(next); reload(); }
  };
  const pageText = () => (beatsMode ? beatText.current : splitLead(draftRef.current.body).text);

  // ---- {Braces} (the code calls each ask a bracket) ----
  // Brackets sent a moment ago, before the job shows up in the next read of the vault (key: when it was sent).
  const sent = useRef<Map<string, number>>(new Map());
  const notAsked = (b: Bracket) => {
    const k = bracketKey(b);
    const t = sent.current.get(k);
    return !asking.has(k) && !answered.has(k) && !(t && Date.now() - t < 10 * 60 * 1000);
  };
  const fill = async (auto = false) => {
    const id = String(note.data.id || '');
    if (!onJob || !id || !bookFolder) { if (!auto) setFilling({ busy: false, error: true, text: 'Filling braces needs your own vault, not the demo.' }); return; }
    const words = pageText();
    const list = findBrackets(words).filter(notAsked);
    if (!list.length) {
      const all = findBrackets(words);
      if (!auto) setFilling({ busy: false, error: false, text: all.length ? (all.some((b) => asking.has(bracketKey(b)))
        ? 'The team already has every ask in braces on this page.'
        : 'The team has answered every ask in braces on this page. Delete the braces once you are happy with the answer, or change their words to ask again.') : 'Put {braces} in your text first: {...} for a gap the team fills in, or {a question} for an answer under that paragraph. Square brackets stay your own text.' });
      return;
    }
    setFilling({ busy: true, error: false, text: '' });
    const r = await onJob(fillJob(id, [id, note.data.title].filter(Boolean).join(' '), bookFolder, list, words));
    if (!r.error) list.forEach((b) => sent.current.set(bracketKey(b), Date.now()));
    setFilling({ busy: false, error: r.error, text: r.error ? r.text : 'The team is filling ' + (list.length === 1 ? '1 ask' : list.length + ' asks') + '. Keep writing: the words appear by each one, with a dot beside them. Your braces stay until you delete them.' });
  };

  // The team's answers: put each one into the page once, where its braces are now.
  const filled = useRef<Set<string>>(loadFilled(source.key));
  useEffect(() => {
    if (beatsMode) return;
    const start = pageText();
    let cur = start;
    const maps: ((n: number) => number)[] = [];
    const added: string[] = [];
    const lost: { key: string; marker: string; answer: string }[] = [];
    let any = false;
    fills.forEach((j) => {
      if (String(j.data.status || '') !== 'done') return;
      const answers = fillAnswers(resultBody(j.body));
      // An answer from long ago that is no longer needed here was used on another device: say nothing about it.
      const old = Date.now() - Date.parse(String(j.data.finished || j.data.created || '')) > 3 * 60 * 60 * 1000;
      askItems(askBody(j.body)).forEach((it) => {
        const key = String(j.data.id || j.path) + ':' + it.name;
        const answer = answers[it.name];
        if (!answer || filled.current.has(key)) return;
        filled.current.add(key);
        any = true;
        const r = placeAnswer(cur, it, answer);
        if (!r) { if (!old && cur.indexOf(answer.trim().slice(0, 40)) < 0) lost.push({ key, marker: it.marker, answer }); return; }
        cur = r.text;
        maps.push(r.map);
        // What to look for afterwards: a later answer on the same line changes that line again.
        answer.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => added.push(l.slice(0, 60)));
      });
    });
    if (!any) return;
    saveFilled(source.key, filled.current);
    if (cur !== start) {
      applyText(cur, (n) => maps.reduce((x, f) => f(x), n));
      addDots(cur.split('\n').filter((l) => l.trim() && added.some((a) => l.indexOf(a) >= 0)));
    }
    if (lost.length) setUnplaced((u) => u.concat(lost));
  }, [fillKey]);

  // ---- Words from elsewhere ----
  // The scene changed in the vault while it is open here (a Claude session pushed a paragraph, another device saved):
  // read it fresh from the vault, then merge it into the page line by line. Kyle's lines win where both changed; the
  // other version is then kept as a copy.
  const merging = useRef(false);
  useEffect(() => {
    const d0 = draftRef.current;
    if (beatsMode) return;
    if (saving.current || merging.current || !source.readFresh || !navigator.onLine) return;
    if (note.sha === d0.baseSha || note.body === d0.baseBody || seen.current.has(note.sha)) return;
    merging.current = true;
    source.readFresh(note.path).then(({ text: raw, sha }) => {
      const fresh = makeNote(note.path, sha, raw);
      // The version the read brought is settled either way: never fetch for it again.
      seen.current.add(note.sha);
      const d = draftRef.current;
      if (fresh.error || saving.current || sha === d.baseSha || fresh.body === d.baseBody || seen.current.has(sha)) return;
      if (fresh.body === d.body) { setDraft({ ...d, baseSha: sha, baseBody: fresh.body }); return; }
      const r = merge3(d.baseBody, d.body, fresh.body);
      const before = pageText();
      setDraft({ ...d, baseSha: sha, baseBody: fresh.body });
      const after = splitLead(r.text).text;
      if (after !== before) applyText(after, mapFor(before, after));
      addDots(r.added);
      if (r.clash) {
        setMessage('This scene also changed somewhere else, on lines you are writing. Your lines are kept; the other version is saved as a copy (Copies tab).');
        saveSnapshot(source, fresh, fresh.body, 'changed elsewhere', new Date()).catch(() => { /* the message already said so */ });
      }
    }).catch(() => { /* the next read tries again */ }).finally(() => { merging.current = false; });
  }, [note.sha, state]);

  /** Send the words on the page (the selection, the paragraph or what comes before the cursor) to the team. */
  const askTeam = async (tool: PassageTool) => {
    const id = String(note.data.id || '');
    if (!onChat || !id) { setAsked({ busy: '', error: true, text: 'Asking the team needs your own vault, not the demo.' }); return; }
    const c = cmd();
    const passage = passageFor(tool, pageText(), c ? c.selection() : null);
    if (!passage) { setAsked({ busy: '', error: true, text: 'Write a few words first, or pick some, then ask again.' }); return; }
    setAsked({ busy: tool, error: false, text: '' });
    const r = await onChat(id, passageMessage(tool, [id, note.data.title].filter(Boolean).join(' '), passage), bookFolder || '');
    if ('error' in r) setAsked({ busy: '', error: true, text: r.error });
    else setAsked({ busy: '', error: false, text: 'Sent to the team. The answer comes in this scene\'s conversation, usually within a few minutes.' });
  };

  // Tool buttons must not take the cursor out of the page.
  const keepFocus = { onMouseDown: (e: Event) => e.preventDefault(), onPointerDown: (e: Event) => { if ((e as PointerEvent).pointerType === 'mouse') e.preventDefault(); } };

  // Check, Listen and Options for a passage (Writers Room, Kyle 2026-10-18).
  const pageRoot = () => (beatsMode ? (beatsApi.current ? beatsApi.current.root() : null) : document.querySelector<HTMLElement>('.writer-page .writer-text.styled'));
  const checkOptions = useMemo<CheckOptions>(() => checkOpts || { lint: {}, minSev: 1 }, [JSON.stringify(checkOpts || null)]);
  const listen = useListen(() => [{ text: pageText(), root: pageRoot }], () => {
    const c = cmd();
    const s = c ? c.selection() : null;
    return s && s.end > s.start ? { part: 0, at: s.start } : null;
  });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const opt = usePassageOptions({ source, note, bookFolder, onJob, jobs: optionJobs || [], canSave, addDots,
    selection: () => { const c = cmd(); return c ? c.selection() : null; }, pageText, body: () => draftRef.current.body, apply: applyText });

  // The ••• menu in the bar, the menu over picked words, and the format row above the iPad's keyboard (design review, 2026-10-22).
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItem = (icon: string, labelText: string, act: () => void) => (
    <button type="button" role="menuitem" {...keepFocus} onClick={() => { setMoreOpen(false); act(); }}><Icon name={icon} size={20} /><span>{labelText}</span></button>
  );
  const [selBox, setSelBox] = useState<{ top: number; left: number } | null>(null);
  const [selMore, setSelMore] = useState(false);
  useEffect(() => {
    const on = () => {
      const sel = window.getSelection();
      const root = document.querySelector('.writer-page .writer-text.styled');
      if (!sel || sel.isCollapsed || !sel.rangeCount || !root || !root.contains(sel.anchorNode)) { setSelBox(null); setSelMore(false); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) { setSelBox(null); return; }
      // Under the words, so the iPad's own Copy and Paste menu above them stays clear.
      const w = Math.min(460, window.innerWidth - 32);
      setSelBox({ top: Math.min(r.bottom + 10, window.innerHeight - 70), left: Math.max(16, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 16)) });
    };
    document.addEventListener('selectionchange', on);
    window.addEventListener('scroll', on, true);
    return () => { document.removeEventListener('selectionchange', on); window.removeEventListener('scroll', on, true); };
  }, []);
  const [seed, setSeed] = useState('');
  const askAbout = () => {
    const c = cmd();
    const s2 = c ? c.selection() : null;
    const picked = s2 && s2.end > s2.start ? pageText().slice(s2.start, s2.end).trim() : '';
    setSeed(picked ? 'About these words: “' + (picked.length > 400 ? picked.slice(0, 397) + '…' : picked) + '”\n\n' : '');
    openTab('chat');
  };
  const [kb, setKb] = useState<{ top: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || typeof matchMedia !== 'function' || !matchMedia('(pointer: coarse)').matches) return;
    const on = () => {
      const up = window.innerHeight - vv.height > 150 && document.activeElement && document.activeElement.closest && document.activeElement.closest('.writer-page');
      const top = up ? Math.round(vv.offsetTop + vv.height - 56) : null;
      setKb((k) => (k ? k.top : null) === top ? k : top == null ? null : { top });
    };
    // Looked at again later and every second too: the iPad may not say when its keyboard goes away (src/ui/viewport.ts).
    let later: ReturnType<typeof setTimeout>[] = [];
    const check = () => { on(); later.forEach(clearTimeout); later = [150, 500, 1200].map((ms) => setTimeout(on, ms)); };
    const every = setInterval(on, 1000);
    vv.addEventListener('resize', check); vv.addEventListener('scroll', check); window.addEventListener('resize', check);
    document.addEventListener('focusin', check); document.addEventListener('focusout', check);
    return () => {
      clearInterval(every); later.forEach(clearTimeout);
      vv.removeEventListener('resize', check); vv.removeEventListener('scroll', check); window.removeEventListener('resize', check);
      document.removeEventListener('focusin', check); document.removeEventListener('focusout', check);
    };
  }, []);

  const { text } = splitLead(draft.body);
  const [beatWords, setBeatWords] = useState<Record<string, number>>({});
  // In beats mode the beats hold the live words (Kyle, 2026-10-19: the target bar and the rest show there too).
  // The page's words are counted again a moment after typing pauses, not on every letter, which kept typing slow in a long
  // chapter (audit, 2026-10-23). Another scene is counted at once.
  const [counted, setCounted] = useState(() => ({ path: note.path, body: draft.body, words: bodyWords(draft.body) }));
  const bodyCount = counted.path === note.path ? counted.words : bodyWords(draft.body);
  useEffect(() => {
    if (counted.path === note.path && counted.body === draft.body) return;
    const t = setTimeout(() => setCounted({ path: note.path, body: draft.body, words: bodyWords(draft.body) }), counted.path === note.path ? COUNT_MS : 0);
    return () => clearTimeout(t);
  }, [draft.body, note.path]);
  const words = beatsMode && beatWords[note.path] != null ? beatWords[note.path] : bodyCount;
  const brackets = findBrackets(text);
  const newBrackets = brackets.filter(notAsked).length;
  const askedBrackets = brackets.filter((b) => !notAsked(b) && !answered.has(bracketKey(b))).length;
  // Fill braces on their own: 20 quiet seconds after the last change, any closed braces the cursor is not in go.
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (beatsMode || !autoFill || !newBrackets) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      const at = caret.current;
      if (findBrackets(pageText()).some((b) => at != null && at > b.at && at < b.end)) return;
      fill(true);
    }, 20000);
    return () => { if (autoTimer.current) clearTimeout(autoTimer.current); };
  }, [text, autoFill, newBrackets]);
  const target = draft.target != null ? draft.target : toNumber(note.data.target_words);
  const sitting = words - draft.startWords;
  // Words typed count for the day, and for the Pomodoro while it runs.
  const lastWords = useRef(words);
  useEffect(() => {
    if (lastWords.current !== words && !beatsMode) trackWords(note.path, String(note.data.id || ''), lastWords.current, words);
    lastWords.current = words;
  }, [words, note.path]);
  // Words typed in the moment before leaving the page still count.
  const leaving = useRef({ path: note.path, id: '', beats: beatsMode });
  leaving.current = { path: note.path, id: String(note.data.id || ''), beats: beatsMode };
  useEffect(() => () => {
    const l = leaving.current;
    if (l.beats) return;
    const w = bodyWords(draftRef.current.body);
    if (w !== lastWords.current) trackWords(l.path, l.id, lastWords.current, w);
  }, []);
  const title = [note.data.id, sceneHeader(note.data)].filter(Boolean).join(' ') || note.path;
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
  const heading = group && group.num != null ? chapterHeading(group) : sceneHeader(note.data, title);
  const sub = [group && group.num != null ? title : String(note.data.id || ''), note.data.pov ? formatValue('pov', note.data.pov, propDef(schema, note.type, 'pov')) : '', sceneStatus]
    .filter(Boolean).join(' · ');
  // The bottom bar names where it goes: the chapter when it is another chapter or a one-scene chapter, else the scene.
  const sideName = (n: NoteRecord | null) => {
    if (!n) return '';
    const g = book ? book.groups.find((x) => x.scenes.some((y) => y.path === n.path)) : null;
    return g && g.num != null && (g !== group || g.scenes.length === 1) ? chapterHeading(g) : sceneHeader(n.data, String(n.data.id || ''));
  };
  // A chapter of several scenes is one page: the scenes before this one above it, the rest below, a line between each.
  const together = Boolean(group && group.num != null && group.scenes.length > 1 && !beatsMode);
  const above = together && group ? group.scenes.slice(0, group.scenes.findIndex((n) => n.path === note.path)) : [];
  const below = together && group ? group.scenes.slice(group.scenes.findIndex((n) => n.path === note.path) + 1) : [];
  // The arrows at the foot go chapter to chapter once a chapter is one page.
  const gi = book && group ? book.groups.indexOf(group) : -1;
  const prevGo = gi > 0 && group && group.num != null && book ? book.groups[gi - 1].scenes[0] || prev : prev;
  const nextGo = gi >= 0 && group && group.num != null && book && book.groups[gi + 1] ? book.groups[gi + 1].scenes[0] || next : together ? null : next;
  const subtitle = isEmptyValue(note.data.subtitle) ? '' : String(note.data.subtitle);
  // The chapter's scenes as a strip of blocks sized by their length; this scene's block uses its live word count.
  const strip = group && group.scenes.length > 1 ? group.scenes.map((n) => ({ note: n, words: n.path === note.path ? words : beatsMode && beatWords[n.path] != null ? beatWords[n.path] : typedWords(n) })) : [];
  // A scene with few or no words still gets a block wide enough to see and press.
  const stripMin = Math.max(1, strip.reduce((m, x) => Math.max(m, x.words), 0) * 0.12);
  const stripTotal = strip.reduce((s, x) => s + Math.max(x.words, stripMin), 0);
  const chapterNum = group && group.num != null ? group.num : null;
  const chapterList = chapterTodos(todos || [], chapterNum);
  const openTodos = chapterList.filter(isOpen).length;

  // ---- Saved drafts (Kyle, 2026-10-24: "i see value in at least labeling and keeping draft 1 accessible") ----
  const savedList = drafts ? drafts.saved : [];
  const working = workingNumber(savedList);
  const viewKey = 'story-forge.draft-view.' + (bookFolder || '');
  const [draftView, setDraftViewState] = useState<number | null>(() => { try { const v = Number(sessionStorage.getItem(viewKey)); return v > 0 ? v : null; } catch { return null; } });
  const setDraftView = async (n: number | null) => {
    // Leaving the working draft on screen: its words reach the vault first, as on any other page.
    if (n != null && draftView == null) { if (quiet.current) clearTimeout(quiet.current); await save(false); }
    setDraftViewState(n);
    try { if (n == null) sessionStorage.removeItem(viewKey); else sessionStorage.setItem(viewKey, String(n)); } catch { /* lasts until reload */ }
  };
  const shownDraft = draftView != null && savedList.some((d) => d.number === draftView) ? draftView : null;
  const [oldText, setOldText] = useState<{ key: string; text: string | null; error?: string } | null>(null);
  const oldKey = shownDraft + '|' + note.path;
  useEffect(() => {
    if (shownDraft == null) return;
    const d = savedList.find((x) => x.number === shownDraft);
    const f = d ? copyFor(d, note) : null;
    if (!f) { setOldText({ key: oldKey, text: null }); return; }
    setOldText({ key: oldKey, text: '' });
    source.read(f.path, f.sha)
      .then((raw) => setOldText({ key: oldKey, text: splitLead(makeNote(f.path, f.sha, raw).body).text }))
      .catch((e) => setOldText({ key: oldKey, text: null, error: offlineError(e) ? 'Connect to the internet to see Draft ' + shownDraft + ' of this scene.' : (e as Error).message }));
  }, [oldKey]);

  // ---- The team's changes (Workflow 1.2, step 41) ----
  const [chView, setChViewState] = useState<ChangesView>(loadView);
  const setChView = (v: ChangesView) => { setChViewState(v); saveView(v); };
  const [chTick, setChTick] = useState(0);
  const [chCur, setChCur] = useState<string | null>(null);
  const curRef = useRef<string | null>(null);
  curRef.current = chCur;
  const chNote = changes ? changes.note : null;
  const sceneId = String(note.data.id || '');
  const chParsed = useMemo(() => (chNote ? parseChanges(chNote.body) : { intro: '', changes: [] as Change[] }), [chNote ? chNote.path + '@' + chNote.sha : '']);
  const chAll = useMemo(() => (chNote ? withChoices(chParsed.changes, chNote.path, source.key) : []), [chParsed, chTick]);
  const chMine = chAll.filter((c) => !c.scene || !sceneId || c.scene === sceneId);
  const chPlace = useMemo(() => placeChanges(text, chMine, sceneId), [text, chAll, sceneId]);
  const chOpenHere = chMine.filter((c) => c.status === 'open').length;
  const chBookOpen = (changes ? changes.book : []).reduce((t, x) => t + (x.chapter === chapterNum ? 0 : x.open), 0) + chAll.filter((c) => c.status === 'open').length;
  const showMarks = !beatsMode && shownDraft == null && chView !== 'original' && chPlace.placed.length > 0;
  readOnly.current = showMarks || shownDraft != null;
  const record = (choices: Record<string, ChangeStatus>) => {
    if (!chNote) return;
    // Kept on this device at once; it reaches the vault now, or with the next sync when offline.
    saveChoices(source, chNote.path, choices).catch(() => { /* waits on this device */ });
    setChTick((n) => n + 1);
    // The to-dos these changes carry out tick off by themselves, and open again on Undo (Kyle, 2026-10-28).
    if (!onTodo) return;
    const after = chAll.map((c) => (choices[c.id] ? { ...c, status: choices[c.id] } : c));
    todoTicks(after, Object.keys(choices)).forEach((t) => {
      const n = (todos || []).find((x) => String(x.data.id || '') === t.id);
      if (!n) return;
      if (t.done && isOpen(n)) onTodo(n.path, 'edit', '', { status: 'done', done_note: t.note });
      else if (!t.done && !isOpen(n) && /^Edit room:/.test(String(n.data.done_note || ''))) onTodo(n.path, 'edit', '', { status: 'open', done_note: '' });
    });
  };
  const putText = (t: string) => {
    wordsNotTyped(bodyWords(t) - bodyWords(pageText()));
    changed(t);
    reload();
  };
  const nextOpen = (after: string | null) => {
    const list = chPlace.placed;
    const i = list.findIndex((p) => p.change.id === after);
    const rest = list.filter((_, k) => k !== i);
    return (i >= 0 && rest[i]) || rest[0] || null;
  };
  const chooseChange = (c: Change, status: ChangeStatus) => {
    if (status === 'kept' || status === 'other') {
      const r = applyChange(pageText(), c, status === 'other' ? 'other' : 'now');
      if (!r) { setMessage('Those words changed after the team wrote ' + c.id + ', so it could not go in. Use Edit it myself to put your own words in.'); return; }
      putText(r.text);
    }
    const n = nextOpen(c.id);
    record({ [c.id]: status });
    setChCur(n ? n.change.id : null);
  };
  const undoChange = (c: Change) => {
    if (chNote && ruleFits({ ...c, status: 'open' }, rules)) addSkip(source.key, chNote.path + '#' + c.id);
    if (c.status === 'kept' || c.status === 'other') {
      const t = revertChange(pageText(), c, c.status === 'other' ? 'other' : 'now');
      if (t == null) { setMessage('The words ' + c.id + ' put in have changed since, so it cannot be taken back out. Your page stays as it is.'); return; }
      putText(t);
    }
    record({ [c.id]: 'open' });
    setChCur(c.id);
  };
  // Edit it myself keeps the card open beside the page, with the team's words, until Kyle says he is done (Kyle,
  // 2026-10-28: "maybe when i tap edit it myself, the change stays open until i tap mark my changes as complete").
  const [mineOpen, setMineOpen] = useState<string | null>(null);
  const editingId = mineOpen && chNote && mineOpen.startsWith(chNote.path + '#') ? mineOpen.slice(chNote.path.length + 1) : null;
  const doneMine = (c: Change) => { record({ [c.id]: 'mine' }); setMineOpen(null); };
  // A change whose words Kyle already rewrote: Back to Draft 1 finds his version by the words around the change in
  // Draft 1 and puts Draft 1's words back (Kyle, 2026-10-28: "maybe reject should instead be revert to draft one").
  const firstDraft = savedList.find((d) => d.number === 1) || null;
  const revertToDraft = async (c: Change) => {
    const f = firstDraft ? copyFor(firstDraft, note) : null;
    if (!f) { setMessage('This scene has no Draft 1 copy, so there is nothing to go back to.'); return; }
    let old: string;
    try { old = splitLead(makeNote(f.path, f.sha, await source.read(f.path, f.sha)).body).text; }
    catch (e) { setMessage(offlineError(e) ? 'Connect to the internet to bring back Draft 1.' : (e as Error).message); return; }
    const page = pageText();
    const span = rewriteSpan(page, c.was, old);
    if (!span) { setMessage('Could not find where ' + c.id + ' sat on your page, so nothing changed. Use Self-Edit to put Draft 1\'s words back by hand.'); return; }
    putText(page.slice(0, span.at) + c.was + page.slice(span.end));
    record({ [c.id]: 'no' });
  };
  const editMine = (c: Change) => {
    const t = pageText();
    const found = chPlace.placed.find((p) => p.change.id === c.id);
    if (chNote) setMineOpen(chNote.path + '#' + c.id);
    setChCur(c.id);
    setChView('original');
    // The writing box comes back; then Kyle's words that the change was about are picked, ready to type over.
    if (found) setTimeout(() => { const ed = commands.current; if (ed && pageText() === t) ed.select(found.at, found.end); }, 60);
    closeOver();
  };
  const acceptAll = () => {
    let t = pageText();
    const choices: Record<string, ChangeStatus> = {};
    placeChanges(t, chMine, sceneId).placed.slice().reverse().forEach((p) => {
      t = t.slice(0, p.at) + p.change.now + t.slice(p.end);
      choices[p.change.id] = 'kept';
    });
    if (!Object.keys(choices).length) return;
    putText(t);
    record(choices);
  };
  // Accept everywhere (Kyle, 2026-10-28: "if i make a change to say greys name, can there be a button like, apply this
  // identical change in all cases"): the change's word swaps become a rule on this device; every waiting change that
  // makes only those swaps is accepted here now, and in each chapter as it opens. Undo on one leaves that one alone.
  const [rules, setRules] = useState<[string, string][]>(() => loadRules(source.key));
  const acceptByRules = (list: [string, string][]): number => {
    if (!chNote || !canSave || shownDraft != null || !list.length) return 0;
    const skips = loadSkips(source.key);
    let t = pageText();
    const choices: Record<string, ChangeStatus> = {};
    placeChanges(t, chMine, sceneId).placed.slice().reverse().forEach((p) => {
      if (!ruleFits(p.change, list) || skips.indexOf(chNote.path + '#' + p.change.id) >= 0) return;
      t = t.slice(0, p.at) + p.change.now + t.slice(p.end);
      choices[p.change.id] = 'kept';
    });
    const n = Object.keys(choices).length;
    if (!n) return 0;
    putText(t);
    record(choices);
    return n;
  };
  const acceptEverywhere = (c: Change) => {
    const sw = swapsOf(c);
    if (!sw) return;
    const all = addRules(source.key, sw);
    setRules(all);
    const n = acceptByRules(sw);
    const left = changes && changes.like ? Math.max(0, changes.like(sw) - n) : 0;
    setMessage('Accepted ' + n + ' here (' + sw.map(([a, b]) => a + ' → ' + b).join(', ') + ').' + (left ? ' The other ' + left + ' are accepted as you open each chapter.' : ''));
  };
  const rulesRan = useRef('');
  useEffect(() => {
    const key = (chNote ? chNote.path + '@' + chNote.sha : '') + '|' + sceneId + '|' + rules.length;
    if (!chNote || !rules.length || rulesRan.current === key || beatsMode) return;
    rulesRan.current = key;
    const n = acceptByRules(rules);
    if (n) setMessage('Accepted ' + n + (n === 1 ? ' change' : ' changes') + ' here that you said to accept everywhere.');
  }, [chNote ? chNote.path + '@' + chNote.sha : '', sceneId, rules.length, beatsMode]);

  // The arrows: the next change on this page, then on into the next chapter that has any (and back).
  const chIdx = chPlace.placed.findIndex((p) => p.change.id === chCur);
  const otherChapter = (dir: 1 | -1) => {
    const list = (changes ? changes.book : []).filter((x) => x.open > 0 && chapterNum != null && (dir > 0 ? x.chapter > chapterNum : x.chapter < chapterNum));
    return dir > 0 ? list[0] || null : list[list.length - 1] || null;
  };
  const goChange = (dir: 1 | -1) => {
    const list = chPlace.placed;
    const k = chIdx < 0 ? (dir > 0 ? 0 : list.length - 1) : chIdx + dir;
    if (showMarks && k >= 0 && k < list.length) { setChCur(list[k].change.id); if (right && tab !== 'changes') setTab('changes'); return; }
    const o = otherChapter(dir);
    if (o) { landAt = dir > 0 ? 'first' : 'last'; go(href.write(o.path)); }
  };
  useEffect(() => {
    if (!landAt || !showMarks) return;
    const list = chPlace.placed;
    setChCur(landAt === 'first' ? list[0].change.id : list[list.length - 1].change.id);
    landAt = null;
  }, [showMarks]);
  useEffect(() => {
    if (!chCur) return;
    const el = document.querySelector('.changes-page [data-chg="' + chCur.replace(/"/g, '') + '"]');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [chCur, showMarks]);
  // Word's margin: as Kyle scrolls the page, the Changes column follows to the first change in view.
  useEffect(() => {
    if (!showMarks || tab !== 'changes') return;
    let t = 0;
    const follow = (e: Event) => {
      // Only the page's own scrolling counts: when Kyle scrolls the column itself, it stays where he puts it (Kyle,
      // 2026-10-28: "when I try to scroll up to the button, it auto scrolls back down").
      const from = e.target as Element | Document;
      const page = document.querySelector('.changes-page');
      if (!page || (from instanceof Element && !from.contains(page))) return;
      clearTimeout(t);
      t = window.setTimeout(() => {
        const marks = Array.from(document.querySelectorAll('.changes-page [data-chg]')) as HTMLElement[];
        const seen = marks.filter((m) => { const r = m.getBoundingClientRect(); return r.bottom > window.innerHeight * 0.2 && r.top < window.innerHeight; });
        const mark = seen.find((m) => m.dataset.chg === curRef.current) || seen[0];
        if (mark && mark.dataset.chg) showCard(mark.dataset.chg, true);
      }, 180);
    };
    document.addEventListener('scroll', follow, true);
    return () => { clearTimeout(t); document.removeEventListener('scroll', follow, true); };
  }, [showMarks, tab]);
  const pickChange = (id: string) => { setChCur(id); openTab('changes'); };

  // The page's heading: the chapter, the scene line, the chapter strip and the target bar. Beats mode shows it too.
  const headParts = (
    <>
      {group && group.num != null && onRenameChapter && !beatsMode
        ? naming != null
          ? (
            <form class="chapter-name-edit" onSubmit={(e) => { e.preventDefault(); namingDone.current = true; onRenameChapter(group.scenes, naming); setNaming(null); }}>
              <label><span class="chapter-name-num">Chapter {group.num}:</span>
                <input type="text" value={naming} aria-label={'Name of chapter ' + group.num} placeholder="Chapter name" enterKeyHint="done" autoFocus
                  onInput={(e) => setNaming((e.currentTarget as HTMLInputElement).value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); namingDone.current = true; setNaming(null); } }}
                  onBlur={() => { if (!namingDone.current && naming.trim() !== group.title) onRenameChapter(group.scenes, naming); setNaming(null); }} />
              </label>
            </form>
          )
          // Tap the chapter's name to change it (Kyle, 2026-10-22).
          : <h1><button type="button" class="chapter-name" title="Rename the chapter" onClick={() => { namingDone.current = false; setNaming(group.title); }}>{heading}</button></h1>
        : <h1>{heading}</h1>}
      {subtitle && <p class="page-subtitle">{subtitle}</p>}
      {sub && !together && <p class="meta">{sub}</p>}
      {strip.length > 0 && (
        <nav class="chapter-strip" aria-label="Scenes in this chapter, sized by length">
          {strip.map(({ note: n, words: w }) => (
            <a key={n.path} {...link(beatsMode ? href.beats(n.path) : href.write(n.path))} style={{ flexGrow: String(Math.max(w, stripMin) / stripTotal) }}
              aria-current={n.path === note.path ? 'page' : undefined} title={sceneHeader(n.data) + ' · ' + num(w) + ' words'}>
              <span class="visually-hidden">{sceneHeader(n.data)}, {num(w)} words</span>
            </a>
          ))}
        </nav>
      )}
      {target ? <span class="writer-progress" aria-hidden="true"><span style={{ width: Math.min(100, Math.round(words * 100 / target)) + '%' }} /></span> : null}
    </>
  );
  const pageHead = (
    <div class="page-head">
      {headParts}
      {loud && <p class={state === 'error' ? 'error' : 'note-line'}>{status}</p>}
      {message && <p class={state === 'error' ? 'error' : 'note-line'}>{message}</p>}
      {made && <p class="note-line">The rest is now <a {...link(href.write(made.path))}>{[made.data.id, sceneHeader(made.data)].filter(Boolean).join(' ')}</a>.</p>}
    </div>
  );
  return (
     <div class={'writer paper-' + look.paper + (look.asks === 'margin' ? ' asks-margin' : '') + (kb ? ' kb-up' : '') + (focus ? ' focus' : '') + (left && !focus ? ' left-open' : '') + (right && !focus ? ' right-open' : '') + (left && right && !focus ? ' has-both' : '') + (right && tab === 'changes' && chNote ? ' edit-wide' : '')} style={lookStyle(look)}>
      {focus && (
        <div class="focus-corner">
          {timer && timer('focus')}
          <button type="button" class="leave-focus" onClick={leaveFocus} aria-label="Leave focus mode" title="Leave focus mode (Esc)"><Icon name="focus" /><span class="bar-label">Leave focus</span></button>
        </div>
      )}
      {/* One slim bar (design review, 2026-10-22): Chapters, where you are, Undo, Redo, B, I, Highlight, Find, then
          Saved, the timer, Team and •••. With the iPad's on-screen keyboard up, the formatting moves to a row above it. */}
      <header class="writer-bar">
        {/* The way out (Kyle, 2026-10-22: "there doesnt seem to be a way to back out of writing mode"): saves, then the book's Home. */}
        {book && <a class="bar-button" {...link(href.board('overview', book.folder))} aria-label="Back to the book's Home" title="Back to the book's Home"><Icon name="left" /><span class="bar-label">Home</span></a>}
        {book
          ? <button type="button" class="bar-button" onClick={toggleLeft} aria-expanded={left} aria-label="Chapters"><Icon name="menu" /><span class="bar-label">Chapters</span></button>
          : <button type="button" class="bar-button" onClick={done} aria-label="Back"><Icon name="left" /><span class="bar-label">Back</span></button>}
        <span class="writer-where">
          <span class="writer-title">{group && group.num != null ? group.num + ' · ' + (group.title || title) : title}</span>
          {book && <span class="writer-book">{book.title}</span>}
        </span>
        <span class="bar-format" role="toolbar" aria-label="Formatting">
          <button type="button" class="tool" aria-label="Undo" title="Undo (Ctrl or Cmd+Z)" {...keepFocus} onClick={() => { const c = cmd(); if (c) c.undo(); }}><Icon name="undo" /></button>
          <button type="button" class="tool" aria-label="Redo" title="Redo" {...keepFocus} onClick={() => { const c = cmd(); if (c) c.redo(); }}><Icon name="redo" /></button>
          <span class="bar-sep" aria-hidden="true" />
          <button type="button" class="tool" aria-label="Bold" title="Bold (Ctrl or Cmd+B)" aria-pressed={typing.b} {...keepFocus} onClick={() => { const c = cmd(); if (c) c.bold(); }}><b>B</b></button>
          <button type="button" class="tool" aria-label="Italic" title="Italic (Ctrl or Cmd+I)" aria-pressed={typing.i} {...keepFocus} onClick={() => { const c = cmd(); if (c) c.italic(); }}><i>I</i></button>
          <button type="button" class="tool" aria-label="Highlight" title="Highlight: mark words to come back to" aria-pressed={typing.h} {...keepFocus} onClick={() => { const c = cmd(); if (c) c.highlight(); }}><Icon name="marker" /></button>
          <span class="bar-sep" aria-hidden="true" />
          <button type="button" class="tool" aria-label="Find and replace" title="Find and replace (Ctrl or Cmd+F)" aria-pressed={findOpen} onClick={() => setFindOpen(!findOpen)}><Icon name="search" /></button>
        </span>
        <span class="bar-gap" />
        {beatsMode
          ? <span class={'save-chip ' + beatsChip.cls} role="status">{beatsChip.cls === 'good' && <Icon name="check" size={16} />}{beatsChip.text}</span>
          : <span class={'save-chip ' + chip.cls} title={status + ' · ' + num(words) + (target ? ' of ' + num(target) : '') + ' words'} role="status">{chip.cls === 'good' && <Icon name="check" size={16} />}{chip.text}{sitting ? <span class="bar-label"> · {(sitting > 0 ? '+' : '') + num(sitting)} today</span> : null}</span>}
        {timer && timer('bar')}
        <button type="button" class={'bar-team' + (right ? ' on' : '')} onClick={toggleRight} aria-expanded={right}
          title="Show or hide the side column: chat, the scene's card and the chapter's plan"><Icon name="spark" size={20} /><span class="bar-label always">Team</span></button>
        <div class="more-wrap">
          <button type="button" class="bar-button compact" aria-label="More" aria-expanded={moreOpen} {...keepFocus} onClick={() => setMoreOpen(!moreOpen)}><Icon name="more" /></button>
          {moreOpen && (
            <>
              <button type="button" class="more-backdrop" aria-label="Close" tabIndex={-1} onClick={() => setMoreOpen(false)} />
              <div class="more-menu" role="menu">
                {!beatsMode && moreItem('split', 'Split here', () => openTab('tools'))}
                {next && !beatsMode && moreItem('join', 'Join the next scene', () => openTab('tools'))}
                {(codex || []).length > 0 && moreItem('people', look.names === 'on' ? 'Names: underlined (turn off)' : 'Names: underline them', () => { const l: PageLook = { ...look, names: look.names === 'on' ? 'off' : 'on' }; setLook(l); saveLook(l); })}
                {moreItem('scan', 'Check for AI-sounding phrases', () => openTab('check'))}
                {listen.supported && moreItem('speaker', listen.state !== 'idle' ? 'Stop reading aloud' : 'Listen: read it aloud', () => (listen.state !== 'idle' && listen.reader ? listen.reader.stop() : listen.start()))}
                {!beatsMode && moreItem('bracket', filling && filling.busy ? 'Filling braces…' : 'Fill the {braces}' + (newBrackets ? ' (' + newBrackets + ')' : ''), () => fill())}
                {moreItem('team', 'Ask the team for a job', () => openTab('team'))}
                {moreItem('focus', 'Focus: only the page', enterFocus)}
                {moreItem('type', 'Page look', () => openTab('page'))}
                {moreItem('history', 'Copies', () => openTab('copies'))}
                {(sceneStatus === 'planned' || sceneStatus === 'drafted' || !sceneStatus) && moreItem('check', sceneStatus === 'drafted' ? 'Mark as done' : 'Mark as drafted', () => openTab('tools'))}
                {onAdd && group && group.num != null && moreItem('plus', 'Add a scene to this chapter', () => { if (!left) toggleLeft(); setChMenu(null); setChAdd({ key: group.scenes[0].path, kind: 'scene' }); })}
                {moreItem('grid', 'Done: back to the Chapter Grid', done)}
              </div>
            </>
          )}
        </div>
      </header>
      <div class="writer-cols">
        {book && left && !focus && (
          <aside class="writer-side" aria-label="Chapters" ref={sideRef}>
            <div class="side-head">
              <strong>{book.title}</strong>
              <button type="button" class="icon-button" onClick={toggleLeft} aria-label="Hide the chapter list"><Icon name="left" /></button>
            </div>
            <nav class="scene-list">
              {book.groups.map((g) => {
                const canHold = g.num != null && Boolean(onAdd || onAddChapter || onRenameChapter || onMoveChapter || onDeleteScenes);
                // Menus follow the chapter by its first scene, so Move up keeps its panel open under the moved chapter.
                const gk = g.scenes.length ? g.scenes[0].path : g.key;
                const openMenu = () => { setChAdd(null); setChMenu(gk); };
                // Hold a finger on a chapter (or right-click it) for Add a chapter below and Add another scene (Kyle,
                // 2026-10-22). A short press still opens the scene; moving the finger scrolls the list as before.
                const holdProps = canHold ? holdFor(openMenu) : {};
                const extra = canHold && (
                  <>
                    {chMenu === gk && (
                      <div class="side-menu" role="menu" aria-label={'Chapter ' + g.num}>
                        <button type="button" role="menuitem" onClick={() => { setChMenu(null); toggleScenes(gk); }}><Icon name="list" size={18} />{shownScenes.indexOf(gk) >= 0 ? 'Hide scenes' : 'Show scenes'}</button>
                        {onAddChapter && <button type="button" role="menuitem" onClick={() => { setChMenu(null); setChAdd({ key: gk, kind: 'chapter' }); }}><Icon name="plus" size={18} />Add a chapter below</button>}
                        {onAdd && <button type="button" role="menuitem" onClick={() => { setChMenu(null); setChAdd({ key: gk, kind: 'scene' }); }}><Icon name="plus" size={18} />Add another scene</button>}
                        {onMoveChapter && book.groups.filter((x) => x.num != null).length > 1 && <button type="button" role="menuitem" onClick={() => { setChMenu(null); setChAdd({ key: gk, kind: 'move' }); }}><Icon name="move" size={18} />Move chapter</button>}
                        {onRenameChapter && <button type="button" role="menuitem" onClick={() => { setChMenu(null); setChAdd({ key: gk, kind: 'rename' }); }}><Icon name="pen" size={18} />Rename the chapter</button>}
                        {onDeleteScenes && <button type="button" role="menuitem" class="side-menu-delete" onClick={() => { setChMenu(null); setChAdd({ key: gk, kind: 'delete' }); }}><Icon name="archive" size={18} />Delete chapter</button>}
                        <button type="button" role="menuitem" class="side-menu-cancel" onClick={() => setChMenu(null)}>Cancel</button>
                      </div>
                    )}
                    {chAdd && chAdd.key === gk && chAdd.kind === 'chapter' && onAddChapter && (
                      <SideAddForm label={'Title of the new chapter ' + ((g.num as number) + 1) + ' (you can leave it empty)'} button="Add and start writing" allowEmpty
                        hint={g === book.groups[book.groups.length - 1] ? '' : 'The chapters after it move up one.'}
                        onCancel={() => setChAdd(null)} onAdd={async (t) => {
                          if (!(await save(true))) return 'Save this scene first: it did not reach the vault.';
                          return onAddChapter(g.num, t);
                        }} />
                    )}
                    {chAdd && chAdd.key === gk && chAdd.kind === 'move' && onMoveChapter && (
                      <MoveChapter num={g.num as number} last={book.groups.reduce((m, x) => Math.max(m, x.num == null ? 0 : x.num), 0)}
                        onMove={async (to) => {
                          if (!(await save(true))) return 'Save this scene first: it did not reach the vault.';
                          return onMoveChapter(g.num as number, to);
                        }} onClose={() => setChAdd(null)} />
                    )}
                    {chAdd && chAdd.key === gk && chAdd.kind === 'rename' && onRenameChapter && (
                      <SideAddForm label={'Name of chapter ' + g.num} button="Rename" allowEmpty initial={g.title}
                        onCancel={() => setChAdd(null)} onAdd={async (t) => { onRenameChapter(g.scenes, t); setChAdd(null); return null; }} />
                    )}
                    {chAdd && chAdd.key === gk && chAdd.kind === 'delete' && onDeleteScenes && (
                      <DeleteAsk what={'chapter ' + g.num + (g.title ? ', ' + g.title + ',' : '')} words={g.scenes.reduce((t, n) => t + (n.path === note.path ? words : typedWords(n)), 0)}
                        later={g !== book.groups[book.groups.length - 1] && book.groups.some((x) => x.num != null && x.num > (g.num as number))}
                        onCancel={() => setChAdd(null)} onDelete={() => remove(g.scenes)} />
                    )}
                    {chAdd && chAdd.key === gk && chAdd.kind === 'scene' && onAdd && (
                      <SideAddForm label={'Title of the new scene in chapter ' + g.num} button="Add and start writing"
                        onCancel={() => setChAdd(null)} onAdd={async (t) => {
                          if (!(await save(true))) return 'Save this scene first: it did not reach the vault.';
                          return onAdd(g.num, g.title, t);
                        }} />
                    )}
                  </>
                );
                // Chapters only, every chapter alike (Kyle, 2026-10-22: "by default the left hand view will just show the
                // chapters"). A chapter opens at its first scene, or at the scene Kyle is in; its words are all its scenes'.
                // Show scenes in the hold menu lists them under it, indented, the chapter's row staying as it was.
                // Hold a scene listed under its chapter (or under No chapter yet) to delete just that scene (Kyle, 2026-10-27).
                const row = (n: NoteRecord, label: string) => {
                  const sk = 'scene:' + n.path;
                  const a = (
                    <a key={n.path} {...link(beatsMode ? href.beats(n.path) : href.write(n.path))} class="side-scene side-sub"
                      aria-current={n.path === note.path ? 'page' : undefined} title={sceneHeader(n.data, n.path)}>
                      <span class="side-name">{label}</span>
                      <span class="side-words">{n.path === note.path ? num(words) : num(typedWords(n))}</span>
                    </a>
                  );
                  if (!onDeleteScenes) return a;
                  return (
                    <div key={n.path} {...holdFor(() => { setChAdd(null); setChMenu(sk); }, true)}>
                      {a}
                      {chMenu === sk && (
                        <div class="side-menu" role="menu" aria-label={label}>
                          <button type="button" role="menuitem" class="side-menu-delete" onClick={() => { setChMenu(null); setChAdd({ key: sk, kind: 'delete' }); }}><Icon name="archive" size={18} />Delete this scene</button>
                          <button type="button" role="menuitem" class="side-menu-cancel" onClick={() => setChMenu(null)}>Cancel</button>
                        </div>
                      )}
                      {chAdd && chAdd.key === sk && chAdd.kind === 'delete' && (
                        <DeleteAsk what={'the scene ' + label} words={n.path === note.path ? words : typedWords(n)}
                          later={g.num != null && g.scenes.length === 1 && book.groups.some((x) => x.num != null && x.num > (g.num as number))}
                          onCancel={() => setChAdd(null)} onDelete={() => remove([n])} />
                      )}
                    </div>
                  );
                };
                if (g.num == null) return (
                  <div key={g.key} class="side-group">
                    <p class="side-chapter">{chapterHeading(g)}</p>
                    {g.scenes.map((n) => row(n, sceneHeader(n.data, n.path)))}
                  </div>
                );
                const inHere = g.scenes.some((n) => n.path === note.path);
                const to = inHere ? note : g.scenes[0];
                const gWords = g.scenes.reduce((t, n) => t + (n.path === note.path ? words : typedWords(n)), 0);
                return (
                  <div key={g.key} class="side-group" {...holdProps}>
                    <a {...link(beatsMode ? href.beats(to.path) : href.write(to.path))} class="side-scene side-chapter-row"
                      aria-current={inHere ? 'page' : undefined} title={chapterHeading(g)}>
                      <span class="side-num">{g.num}</span>
                      <span class="side-name">{g.title || sceneHeader(g.scenes[0].data, g.scenes[0].path)}</span>
                      {g.scenes.every((n) => DONE_STATUSES.indexOf(n.path === note.path ? sceneStatus : String(n.data.status || '')) >= 0) && <span class="side-done" title="Done"><Icon name="check" size={16} /><span class="visually-hidden">Done</span></span>}
                      {changes && (changes.book.find((x) => x.chapter === g.num) || { open: 0 }).open > 0 && (
                        <span class="side-changes" title="Changes from the team waiting">{g.num === chapterNum ? chAll.filter((c) => c.status === 'open').length : (changes.book.find((x) => x.chapter === g.num) || { open: 0 }).open}</span>
                      )}
                      <span class="side-words">{num(gWords)}</span>
                    </a>
                    {shownScenes.indexOf(gk) >= 0 && g.scenes.map((n) => row(n, sceneHeader(n.data, n.path)))}
                    {extra}
                  </div>
                );
              })}
              {/* One scene per chapter is Kyle's way, so the list ends with Add a chapter (Kyle, 2026-10-22). */}
              {onAddChapter && <AddChapterAtEnd onAdd={async (t) => {
                if (!(await save(true))) return 'Save this scene first: it did not reach the vault.';
                return onAddChapter(null, t);
              }} />}
              {!onAddChapter && onAdd && <AddChapterAtEnd scene onAdd={async (t) => {
                if (!(await save(true))) return 'Save this scene first: it did not reach the vault.';
                return onAdd(group ? group.num : null, group ? group.title : '', t);
              }} />}
            </nav>
            {/* The boards and the archive stay folded behind one button, so the column is only chapters (Kyle,
                2026-10-22: "i dont anticipate using those frequently and would prefer them not to take visual space"). */}
            <div class="side-tools">
              <button type="button" class="side-tools-toggle" aria-expanded={toolsOpen} onClick={() => { const v = !toolsOpen; setToolsOpen(v); try { localStorage.setItem('story-forge.side-tools', v ? '1' : ''); } catch { /* lasts until reload */ } }}>
                <Icon name="grid" size={18} />Book tools<Icon name={toolsOpen ? 'up' : 'down'} size={16} />
              </button>
              {toolsOpen && (
                <>
                  {book.archive && book.archive.length > 0 && <ArchiveList source={source} files={book.archive} bookFolder={book.folder} canSave={canSave} onChanged={onChanged} />}
                  <nav class="side-boards" aria-label="Boards">
                    {boardLinks(schema, book.folder).map((l) => (
                      <a key={l.key} {...link(l.to)}><Icon name={l.icon} size={18} />{l.title}</a>
                    ))}
                  </nav>
                </>
              )}
            </div>
          </aside>
        )}
        <div class={'writer-page' + (beatsMode ? ' beats-mode' : '')}>
          <ListenBar l={listen} />
          {selBox && !beatsMode && (
            <div class="sel-menu" role="toolbar" aria-label="For the words you picked" style={{ top: selBox.top + 'px', left: selBox.left + 'px' }}>
              <button type="button" {...keepFocus} disabled={Boolean(asked && asked.busy)} onClick={() => askTeam('rewrite')}><Icon name="swap" size={18} />{asked && asked.busy === 'rewrite' ? 'Sending…' : 'Rewrite'}</button>
              <button type="button" {...keepFocus} disabled={Boolean(asked && asked.busy)} onClick={() => askTeam('describe')}><Icon name="eye" size={18} />{asked && asked.busy === 'describe' ? 'Sending…' : 'Describe'}</button>
              <button type="button" {...keepFocus} onClick={() => { setOptionsOpen(true); opt.setSaid(null); }}>Options{opt.ready > 0 && <span class="count-badge">{opt.ready}</span>}</button>
              <button type="button" {...keepFocus} onClick={askAbout}><Icon name="chat" size={18} />Ask about this</button>
              <button type="button" class="sel-more" aria-label="More for these words" aria-expanded={selMore} {...keepFocus} onClick={() => setSelMore(!selMore)}><Icon name="more" size={18} /></button>
              {selMore && (
                <div class="sel-more-menu">
                  <button type="button" {...keepFocus} onClick={() => { setSelMore(false); askTeam('brainstorm'); }}><Icon name="idea" size={18} />Brainstorm what comes next</button>
                  <button type="button" {...keepFocus} onClick={() => { setSelMore(false); askTeam('write-on'); }}><Icon name="pen" size={18} />Write on from here</button>
                  <button type="button" {...keepFocus} onClick={() => { setSelMore(false); fill(); }}><Icon name="bracket" size={18} />Fill the {'{braces}'}</button>
                </div>
              )}
            </div>
          )}
          {kb && (
            <div class="kb-row" role="toolbar" aria-label="Formatting" style={{ top: kb.top + 'px' }}>
              {prev ? <a class="tool" {...link(href.write(prev.path))} aria-label={'Previous section: ' + sideName(prev)}><Icon name="left" /></a> : <span class="tool" aria-hidden="true" />}
              {next ? <a class="tool" {...link(href.write(next.path))} aria-label={'Next section: ' + sideName(next)}><Icon name="right" /></a> : <span class="tool" aria-hidden="true" />}
              <span class="bar-sep" aria-hidden="true" />
              <button type="button" class="tool" aria-label="Undo" {...keepFocus} onClick={() => { const c = cmd(); if (c) c.undo(); }}><Icon name="undo" /></button>
              <button type="button" class="tool" aria-label="Redo" {...keepFocus} onClick={() => { const c = cmd(); if (c) c.redo(); }}><Icon name="redo" /></button>
              <button type="button" class="tool" aria-label="Bold" aria-pressed={typing.b} {...keepFocus} onClick={() => { const c = cmd(); if (c) c.bold(); }}><b>B</b></button>
              <button type="button" class="tool" aria-label="Italic" aria-pressed={typing.i} {...keepFocus} onClick={() => { const c = cmd(); if (c) c.italic(); }}><i>I</i></button>
              <button type="button" class="tool" aria-label="Highlight" aria-pressed={typing.h} {...keepFocus} onClick={() => { const c = cmd(); if (c) c.highlight(); }}><Icon name="marker" /></button>
            </div>
          )}
          {((group && (group.num != null || group.scenes.length > 1)) || drafts) && (
            <div class="page-switch-row">
              {group && (group.num != null || group.scenes.length > 1) && (
                <div class="view-seg page-switch" role="group" aria-label="How to see this chapter">
                  <button type="button" aria-pressed={!beatsMode} onClick={() => { if (beatsMode) go(href.write(note.path)); }}>Page</button>
                  {group.num != null && <button type="button" aria-pressed={beatsMode} onClick={() => { if (!beatsMode) go(href.beats(note.path)); }}>Beats</button>}
                  {group.scenes.length > 1 && <button type="button" aria-pressed={false} onClick={() => go(href.chapter(note.path))}>Whole chapter</button>}
                </div>
              )}
              {drafts && !beatsMode && (
                <DraftMenu working={working} saved={savedList.map((d) => d.number)} viewing={shownDraft} onView={setDraftView} canSave={canSave}
                  onExport={drafts.onExport}
                  onSave={async () => {
                    if (quiet.current) clearTimeout(quiet.current);
                    if (!(await save(false)) || isUnsaved(draftRef.current)) return 'This scene did not reach the vault yet, so the draft was not saved. Try again in a moment.';
                    if (!(await saveSiblings(false))) return 'Another scene of this chapter did not save yet. Try again in a moment.';
                    return drafts.onSave();
                  }} />
              )}
            </div>
          )}
          {optionsOpen && <OptionsAsk busy={opt.busy} keep={keepFocus} onClose={() => setOptionsOpen(false)}
            onAsk={async (m) => { if (await opt.ask(m)) setOptionsOpen(false); }} />}
          {opt.said && !opt.busy && (
            <p class={'tool-said ' + (opt.said.error ? 'error' : 'ok')} role="status">
              {opt.said.text}
              <button type="button" class="icon-button" aria-label="Close" onClick={() => opt.setSaid(null)}><Icon name="close" size={16} /></button>
            </p>
          )}
          {opt.ready > 0 && !beatsMode && !(right && tab === 'options') && (
            <p class="tool-said ok" role="status">The team's options are ready. <button type="button" class="link" onClick={() => openTab('options')}>Show them</button></p>
          )}
          {asked && !asked.busy && (
            <p class={'tool-said ' + (asked.error ? 'error' : 'ok')} role="status">
              {asked.text}{!asked.error && note.data.id && <> <a {...link(href.chat(String(note.data.id), bookFolder || ''))}>Open the conversation</a></>}
              <button type="button" class="icon-button" aria-label="Close" onClick={() => setAsked(null)}><Icon name="close" size={16} /></button>
            </p>
          )}
          {filling && !filling.busy && (
            <p class={'tool-said ' + (filling.error ? 'error' : 'ok')} role="status">
              {filling.text}
              <button type="button" class="icon-button" aria-label="Close" onClick={() => setFilling(null)}><Icon name="close" size={16} /></button>
            </p>
          )}
          {!filling && askedBrackets > 0 && <p class="tool-said ok" role="status"><span class="job-dot" aria-hidden="true" /> The team is filling {askedBrackets === 1 ? '1 ask in braces' : askedBrackets + ' asks in braces'} on this page.</p>}
          {unplaced.map((u) => (
            <div class="tool-said unplaced" key={u.key} role="status">
              <span>The team answered <b>{u.marker.length > 50 ? u.marker.slice(0, 47) + '…' + u.marker.slice(-1) : u.marker}</b>, but those braces are no longer on the page:</span>
              <blockquote>{u.answer.length > 300 ? u.answer.slice(0, 297) + '…' : u.answer}</blockquote>
              <span class="buttons">
                <button type="button" onClick={() => {
                  const before = pageText();
                  const add = u.answer.trim();
                  const after = before.replace(/\s*$/, '') + '\n\n' + add;
                  applyText(after, (n) => n);
                  addDots(add.split('\n').filter((l) => l.trim()));
                  setUnplaced((list) => list.filter((x) => x.key !== u.key));
                }}>Put it at the end</button>
                <button type="button" onClick={() => setUnplaced((list) => list.filter((x) => x.key !== u.key))}>Leave it out</button>
              </span>
            </div>
          ))}
          {findOpen && <FindBar text={beatsMode ? beatText.current : text} query={query} setQuery={(q) => { setQuery(q); setHit(0); }} repl={repl} setRepl={setRepl} hit={hit} setHit={setHit}
            cmd={cmd} onClose={() => setFindOpen(false)} />}
          {beats && group && group.num != null && bookFolder ? (
            <BeatsView source={source} group={group} bookFolder={bookFolder} beatsNote={beats.note} codex={codex || []} startAt={note.path}
              onSaved={onSaved} onJob={onJob} asking={beats.asking} saver={beatsSaver}
              onStatus={(text, cls) => setBeatsChip({ text, cls })} onOpen={(p) => go(href.write(p))}
              options={beatOpts} onLook={setTyping} api={beatsApi}
              onName={(i) => { const e = allNames.entries[i] || (names && names.entries[i]); if (e) { setPicked(e); openTab('card'); } }}
              onActive={(t) => { beatText.current = t; if (findOpen) setBeatRev((r) => r + 1); }}
              head={headParts} onWords={setBeatWords} />
          ) : <>
          {pageHead}
          {shownDraft != null && (
            <p class="draft-banner" role="status">Draft {shownDraft}, saved and read only. <button type="button" class="link" onClick={() => setDraftView(null)}>Back to Draft {working}</button></p>
          )}
          {shownDraft == null && chNote && chMine.length > 0 && (
            <ChangesBar view={chView} onView={setChView} open={chOpenHere} total={chBookOpen}
              place={showMarks && chIdx >= 0 ? (chIdx + 1) + ' of ' + chPlace.placed.length : ''}
              onPrev={(showMarks && chIdx > 0) || otherChapter(-1) ? () => goChange(-1) : null}
              onNext={(showMarks && chIdx < chPlace.placed.length - 1) || otherChapter(1) ? () => goChange(1) : null}
              />
          )}
          {showMarks && <p class="hint changes-hint">To type, press Self-Edit, or Edit it myself on a change.</p>}
          {above.map((n) => (
            <div key={n.path}>
              <SceneSection source={source} note={n} options={sibOpts} onSaved={onSaved} onFocus={() => setSibFocus(n.path)} onLook={setTyping} register={registerSib} />
              <div class="scene-break" aria-hidden="true" />
            </div>
          ))}
          <div class={"main-section" + (below.length ? " has-below" : "")} ref={mainRef} onFocusCapture={() => setSibFocus(null)}>
          {shownDraft != null ? (
            oldText && oldText.key === oldKey && oldText.text
              ? <div class="writer-text styled draft-readonly" role="document" aria-label={'Draft ' + shownDraft + ' of ' + title} dangerouslySetInnerHTML={{ __html: styledHtml(oldText.text, styleOpts) }} />
              : <p class={'writer-text ' + (oldText && oldText.error ? 'error' : 'hint')}>{!oldText || oldText.key !== oldKey || oldText.text === '' ? 'Opening Draft ' + shownDraft + '…' : oldText.error || 'This scene was not in Draft ' + shownDraft + '.'}</p>
          ) : showMarks
            ? <ChangesPage text={text} placed={chPlace.placed} view={chView} current={chCur} onPick={pickChange} options={styleOpts} label={'Text of ' + title + ' with the team\'s changes'} />
            : <StyledEditor key={loaded} value={text} onChange={changed} onCaret={(n) => { caret.current = n; clearDot(n); }} label={'Text of ' + title} commands={commands}
              options={styleOpts} onLook={setTyping} onName={(i) => { const e = allNames.entries[i] || (names && names.entries[i]); if (e) { setPicked(e); openTab('card'); } }} />}
          </div>
          {below.map((n) => (
            <div key={n.path}>
              <div class="scene-break" aria-hidden="true" />
              <SceneSection source={source} note={n} options={sibOpts} onSaved={onSaved} onFocus={() => setSibFocus(n.path)} onLook={setTyping} register={registerSib} />
            </div>
          ))}
          <nav class="writer-done side-arrows" aria-label="Previous and next section">
            {prevGo
              ? <a class="side-go" {...link(href.write(prevGo.path))} aria-label={'Previous section: ' + sideName(prevGo)} title={'Previous: ' + sideName(prevGo)}><Icon name="left" size={22} /></a>
              : <span class="side-go" aria-hidden="true" />}
            {nextGo
              ? <a class="side-go" {...link(href.write(nextGo.path))} aria-label={'Next section: ' + sideName(nextGo)} title={'Next: ' + sideName(nextGo)}><Icon name="right" size={22} /></a>
              : <span class="side-go" aria-hidden="true" />}
          </nav>
          </>}
        </div>
        {right && !focus && (
          <aside class="writer-right" aria-label="Scene panel" ref={rightRef}>
            {(() => {
              const mark = (k: Tab) => (k === 'todos' && openTodos > 0 ? <span class="count-badge">{openTodos}</span>
                : k === 'changes' && chOpenHere > 0 ? <span class="count-badge">{chOpenHere}</span>
                : k === 'chat' && convo && convo.pending ? <span class="job-dot" aria-hidden="true" /> : null);
              const mainTabs = chNote ? EDIT_TABS : MAIN_TABS;
              const inMore = mainTabs.indexOf(tab) < 0;
              const moreName = inMore ? SHORT[tab] || (TABS.find(([x]) => x === tab) || [tab, 'More'])[1] : 'More';
              const marks = markList(text).length;
              return (
                <>
                  <div class="side-head side-tabs-head">
                    <div class="panel-tabs side-tabs" role="tablist" aria-label="Beside the page">
                      {mainTabs.map((k) => (
                        <button key={k} type="button" role="tab" aria-selected={tab === k && !moreList} onClick={() => setTab(k)}>
                          {(TABS.find(([x]) => x === k) || [k, k])[1]}{mark(k)}
                        </button>
                      ))}
                      <button type="button" class="side-more" aria-haspopup="true" aria-expanded={moreList} aria-selected={inMore || moreList}
                        title={inMore ? moreName + ': press for the rest' : 'Everything else: the scene card, scrap, copies, check and more'}
                        onClick={() => setMoreList(!moreList)}>
                        <span class="side-more-name">{moreName}</span><Icon name={moreList ? 'up' : 'down'} size={16} />
                      </button>
                    </div>
                    <button type="button" class="icon-button" onClick={toggleRight} aria-label="Hide this column" title="Hide this column"><Icon name="right" /></button>
                  </div>
                  {moreList && (
                    <div class="side-more-list" role="menu" aria-label="More">
                      {MORE_GROUPS.map(([g, items]) => (
                        <div key={g} role="group" aria-label={g}>
                          <span class="panel-key">{g}</span>
                          {items.filter(([k]) => (k !== 'beats' || chNote) && (k !== 'changes' || !chNote)).map(([k, icon, name]) => (
                            <button key={k} type="button" role="menuitem" aria-current={tab === k ? 'true' : undefined} onClick={() => setTab(k)}>
                              <Icon name={icon} size={20} />{k === 'scrap' && chapterNum != null ? 'Scrap for chapter ' + chapterNum : name}
                              {k === 'marks' && marks > 0 && <span class="meta">{marks}</span>}
                              {k === 'target' && target ? <span class="meta">{num(target)}</span> : null}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            {!moreList && <>
            {tab === 'changes' && (
              chNote
                ? <ChangesPanel elsewhere={chAll.filter((c) => c.status === 'open' && !chMine.includes(c)).length} intro={chParsed.intro} changes={chMine} placedIds={chPlace.placed.map((p) => p.change.id)} current={chCur} onAcceptAll={acceptAll}
                  editing={editingId} onDoneMine={doneMine} onStopMine={() => setMineOpen(null)} onRevert={firstDraft ? revertToDraft : null}
                  onPick={(id) => { if (chView === 'original' && id !== editingId) setChView('all'); setChCur(id); closeOver(); }}
                  onChoose={chooseChange} onUndo={undoChange} onMine={editMine} onEverywhere={acceptEverywhere} like={changes && changes.like ? changes.like : null} chapter={chapterNum} bookOpen={chBookOpen} notePath={chNote.path} link={link} />
                : <div class="panel-body">
                  <p class="hint">This chapter has no changes from the team. When the Writer revises a chapter (workflow step 39), its changes show here and on the page, for you to keep or not.</p>
                  <AskForChanges chapter={chapterNum} asking={Boolean(changes && changes.asking)}
                    onAsk={onJob && bookFolder && chapterNum != null ? () => onJob({ title: defaultJobTitle('revise', 'Chapter ' + chapterNum), kind: 'revise', target: 'Chapter ' + chapterNum, book: bookFolder, ask: jobAsk('revise', 'Chapter ' + chapterNum, '') }) : null} />
                </div>
            )}
            {tab === 'chat' && (
              <SceneChat convo={convo || null} thread={String(note.data.id || '')} book={bookFolder || ''} onChat={note.data.id ? onChat : undefined} seed={seed} fromTop
                fullHref={link(href.chat(String(note.data.id || ''), bookFolder || ''))} />
            )}
            {tab === 'plan' && (
              <PlanPanel key={(bookFolder || '') + '#' + chapterNum} source={source} bookFolder={bookFolder} chapter={chapterNum} plan={plan || null} canSave={canSave} />
            )}
            {tab === 'scrap' && (
              <PlanPanel key={'scrap#' + (bookFolder || '') + '#' + chapterNum} kind="scrap" source={source} bookFolder={bookFolder} chapter={chapterNum} plan={scrap || null} canSave={canSave}
                keepFocus={keepFocus} take={() => {
                  // Cut the words picked on the page, as one step to undo there, and hand them to the scrap.
                  const c = cmd();
                  const s = c ? c.selection() : null;
                  if (!c || !s || s.end <= s.start) return null;
                  const words = pageText().slice(s.start, s.end);
                  if (!words.trim()) return null;
                  c.replaceRange(s.start, s.end, '');
                  return words;
                }} />
            )}
            {tab === 'beats' && (
              <BeatsList note={chapterBeats || null} chapter={chapterNum} sceneId={String(note.data.id || '')} text={beatsMode ? null : text}
                lastId={group && group.scenes.length ? String(group.scenes[group.scenes.length - 1].data.id || '') : ''}
                onGo={(at) => { const c = cmd(); if (c) c.select(at, at); closeOver(); }} beatsLink={link(href.beats(note.path))} />
            )}
            {tab === 'todos' && (
              <TodosPanel todos={chapterList} chapter={chapterNum} sceneId={String(note.data.id || '')} onTodo={onTodo} onAdd={onAddTodo}
                onJob={onJob} bookFolder={bookFolder} waiting={waiting || {}} link={link} />
            )}
            {tab === 'card' && (picked
              ? <CodexCard schema={schema} entry={picked} link={link} onBack={() => setPicked(null)} now={codexNow ? codexNow(picked.note) : null} />
              : <CardPanel schema={schema} note={note} status={sceneStatus} onDrafted={() => setDraft({ ...draftRef.current, status: 'drafted' })} link={link} named={namedIn(text, allNames)} onPick={setPicked} notes={sceneNotes || null} />)}
            {tab === 'notes' && <NotesPanel source={source} bookFolder={bookFolder} note={braindump || null} canSave={canSave} onChanged={onChanged} />}
            {tab === 'marks' && <MarksPanel text={text} onGo={(a, b) => { const c = cmd(); if (c) c.select(a, b); closeOver(); }} />}
            {tab === 'target' && <TargetPanel value={target || null} onSet={(n) => { setDraft({ ...draftRef.current, target: n }); }} />}
            {tab === 'copies' && (
              <CopiesPanel source={source} note={note} body={draft.body} canSave={canSave}
                onUse={(body) => { wordsNotTyped(bodyWords(body) - bodyWords(draftRef.current.body)); setDraft({ ...draftRef.current, body }); reload(); }} />
            )}
            {tab === 'team' && (
              <TeamPanel status={sceneStatus} id={String(note.data.id || '')} title={String(note.data.title || '')} chapter={group && group.num != null ? group.num : null}
                bookFolder={bookFolder} onJob={onJob} link={link} autoFill={autoFill} onAutoFill={(on) => { saveAutoFill(on); setAutoFill(on); }} recipes={recipes} />
            )}
            {tab === 'page' && <PagePanel look={look} onLook={(l) => { setLook(l); saveLook(l); }} />}
            {tab === 'check' && (
              <CheckPanel sections={[{ key: note.path, label: title, text, root: pageRoot, select: (a, b) => { const c = cmd(); if (c) c.select(a, b); } }]}
                opts={checkOptions} onJump={closeOver}
                deeper={<p class="hint">For a closer read by the Line Editor (a paid team job), use the Team tab's deeper check.</p>} />
            )}
            {tab === 'flow' && (
              <FlowTab results={flow ? flow.results : []} chapter={chapterNum} sceneId={String(note.data.id || '')} flowHref={flow ? flow.href : href.home()} link={link}
                names={namedIn(text, allNames).filter((x) => x.entry.type === 'character').map((x) => x.entry.name)} />
            )}
            {tab === 'options' && (
              <OptionsPanel jobs={optionJobs || []} done={opt.done} onPick={opt.pick} onEnd={opt.end} onDone={opt.markDone} />
            )}
            {tab === 'tools' && (
              <ScenePanel status={sceneStatus} next={next} alone={!group || group.scenes.length < 2}
                onStatus={(st) => { setDraft({ ...draftRef.current, status: st }); }}
                onSplit={split} onJoin={join} />
            )}
            </>}
          </aside>
        )}
        {(left || right) && !focus && <div class="scrim" onClick={closeOver} aria-hidden="true" />}
      </div>
    </div>
  );
}
