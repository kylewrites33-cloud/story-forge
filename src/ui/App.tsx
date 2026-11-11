import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { readSnapshot, writeSnapshot, clearSnapshots } from '../lib/cache.ts';
import { DemoSource } from '../lib/demo-source.ts';
import { timeAgo } from '../lib/format.ts';
import { GitHubSource } from '../lib/github.ts';
import { parseSchema } from '../lib/schema.ts';
import { isConnected, loadSettings, saveSettings, type Settings } from '../lib/settings.ts';
import { sync } from '../lib/sync.ts';
import type { Decision } from '../lib/ideas.ts';
import { addRocketFile, rocketFile, rocketProblem } from '../lib/market.ts';
import type { NewTask } from '../lib/tasks.ts';
import { bookTodos, type NewTodo } from '../lib/todos.ts';
import { defaultJobTitle, jobLabel, jobNotes, openJobFor, type NewJob } from '../lib/jobs.ts';
import { archiveNote, archiveScene, createScene, mentionsOf, orderBetween, renameScene, safeTitle, sceneNotesFor } from '../lib/scenes.ts';
import { applyShifts, chapterCloseUp, chapterMove, chapterNotes, chapterShifts, chapterTitleEdits, closeMap, makeRoom, moveMap, renumberLists, roomMap } from '../lib/chapters.ts';
import { createBook, createSeries, fileBase64, manuscriptPath, manuscriptProblem } from '../lib/books.ts';
import { jobAsk } from '../lib/jobs.ts';
import { loadDrafts, moveDrafts, putDraft, typedWords } from '../lib/drafts.ts';
import type { BookEntry, DeviceFile, NoteRecord, Schema, Snapshot, VaultIndex, VaultSource } from '../lib/types.ts';
import { activeBook, makeNote } from '../lib/vault-index.ts';
import { chapterGroups, sceneLabel } from '../lib/board.ts';
import { ChapterTitlesPage } from './ChapterTitles.tsx';
import { flushDrafts, loadNotice, pendingCount, saveNotice } from '../lib/drafts.ts';
import type { Choice } from '../lib/write-queue.ts';
import { foldSaved, overlayActions } from '../vault/apply.ts';
import type { MakerName, Payloads } from '../vault/makers.ts';
import { chaptersAction, deleteAction, choiceAction, createAction, draftAction, filesAction, marksAction, newId, restoreAction, textAction, type Action } from '../vault/ops.ts';
import { BRAINDUMP_START, changeRecord, type TextChange } from '../vault/text.ts';
import { logPath, type LogItem } from '../lib/pomodoro.ts';
import { add, landedOf, loadLanded, loadOutbox, saveLanded, saveOutbox, settle, waitingCount, waitingOf } from '../vault/outbox.ts';
import { pushAction, pushAll, type Pushed } from '../vault/push.ts';
import { oldSaving } from '../vault/switch.ts';
import { IdeasBoard } from './IdeasBoard.tsx';
import { TastePage } from './Taste.tsx';
import { boardNotes, castFor, STORY_BOARDS, type StoryBoard } from '../lib/boards.ts';
import { boardLinks, StoryBoardScreen } from './StoryBoards.tsx';
import { Shell } from './Shell.tsx';
import { CodexBoard } from './Codex.tsx';
import { DecideQueue } from './Decide.tsx';
import { ChangesOverview } from './Changes.tsx';
import { rewriteDone, rewriteProgress, withRewriteDone } from '../lib/rewrite.ts';
import { decideQueue } from '../lib/overview.ts';
import { CODEX_PAGES } from '../lib/rooms.ts';
import { href, parseHash, useRoute } from './route.ts';
import { ChapterGrid, NoteView } from './screens.tsx';
import { BookDetails, downloadWord, Home, SeriesPage } from './Home.tsx';
import { makeBackupFolder } from '../lib/docx.ts';
import { addCover, coverFiles, coverProblem } from '../lib/covers.ts';
import { noteRecent } from '../lib/home.ts';
import { SettingsScreen } from './SettingsScreen.tsx';
import { Editor } from './Editor.tsx';
import { PomodoroTimer } from './Pomodoro.tsx';
import { TodoList } from './TodoList.tsx';
import { JobsScreen } from './Jobs.tsx';
import { codexFor } from '../lib/codex.ts';
import { ChapterPage } from './ChapterPage.tsx';
import { beatsNoteFor } from '../lib/beats.ts';
import { changesNoteFor, chapterChanges, countLike, isStoryCall, type ChangeStatus } from '../lib/changes.ts';
import { copyFor, saveBookDraft } from '../lib/bookdrafts.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { buildDocx, exportName, manuscript } from '../lib/docx.ts';
import { fillJobsFor, isOpenJob } from '../lib/brackets.ts';
import { optionJobsFor } from '../lib/options.ts';
import { checkOptions } from '../lib/lintcheck.ts';
import { planFor, scrapFor } from '../lib/plans.ts';
import { MatrixBoard } from './Matrix.tsx';
import { TensionBoard } from './TensionPage.tsx';
import { ArcsBoard } from './ArcsPage.tsx';
import { codexNow } from '../lib/codexnow.ts';
import { SEEING_BOARDS, SeeingBoard } from './Seeing.tsx';
import { ChatScreen } from './Chat.tsx';
import { HistoryScreen, MemberPage, SkillsScreen, TeamScreen } from './Team.tsx';
import { chatJob, conversation, isThread, loadSideThreads, nextChatThread } from '../lib/chat.ts';
import { pageContext, type PageView } from '../lib/context.ts';
import { TeamSide } from './Chat.tsx';
import { PILES, piles } from '../lib/ideas.ts';
import type { NewNote } from '../lib/notes.ts';
import { recipeName, recipeNotes, saveRecipe, type RecipeFields } from '../lib/recipes.ts';
import { OverviewPage } from './Overview.tsx';
import { NotesScreen } from './NotesToTeam.tsx';
import { SessionsScreen, SessionView } from './Sessions.tsx';
import { RecipesScreen } from './Recipes.tsx';
import { WorkflowScreen } from './Workflow.tsx';
import { addWorkflowNote, WORKFLOW_PATH } from '../lib/workflow.ts';
import { ForgeSpecialist } from './Forge.tsx';
import { FlowScreen, FromTheWorkflow } from './Flow.tsx';
import { flowResults, type NewResult } from '../lib/flow.ts';
import { nameList, toNumber } from '../lib/links.ts';

function makeSource(s: Settings): VaultSource {
  return isConnected(s) ? new GitHubSource(s) : new DemoSource();
}

export function App() {
  const route = useRoute();
  const [settings, setSettings] = useState(loadSettings);
  const source = useMemo(() => makeSource(settings), [settings]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What happened when writing that waited on this device met changes made elsewhere. It stays until Kyle closes it,
  // even across a reload, because it may come while he is on a writing screen.
  const [notice, setNoticeState] = useState<string | null>(() => loadNotice(source.key));
  const setNotice = useCallback((n: string | null) => { setNoticeState(n); saveNotice(source.key, n); }, [source]);
  const [online, setOnline] = useState(navigator.onLine);
  const [, tick] = useState(0);
  const snapRef = useRef<Snapshot | null>(null);
  snapRef.current = snap;
  // The outbox: what Kyle has done that the vault does not have yet (src/vault).
  const [outbox, setOutboxState] = useState<Action[]>(() => loadOutbox(source.key));
  const outboxRef = useRef<Action[]>(outbox);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const schemaRef = useRef<Schema | null>(null);
  const lastOpened = useRef('');

  const setOutbox = useCallback((list: Action[]) => {
    outboxRef.current = list;
    setOutboxState(list);
    saveOutbox(source.key, list);
  }, [source]);
  /** Put choices that belong together in the outbox as one action: they go up as one save. */
  const act = useCallback((choices: Choice[]) => {
    if (choices.length) setOutbox(add(outboxRef.current, choiceAction(choices)));
  }, [setOutbox]);

  useEffect(() => { setOutbox(loadOutbox(source.key)); }, [source, setOutbox]);

  /** A new note (or several of one kind) as an action, with the ID it will most likely get. Throws a plain sentence
   * when what Kyle typed cannot make a note. */
  const planned = useCallback(<K extends MakerName>(name: K, payload: Payloads[K] | Payloads[K][]): Action => {
    const cur = snapRef.current;
    if (!cur) throw new Error('Press Sync first.');
    // The files the app knows of: the saved copy's notes, each book's archived scenes and saved drafts (their numbers
    // count when the next free one is worked out), and the new notes still waiting.
    const paths = Object.keys(cur.index.notes);
    cur.index.books.forEach((b) => {
      (b.archive || []).forEach((f) => paths.push(f.path));
      (b.drafts || []).forEach((d) => (d.files || []).forEach((f) => paths.push(f.path)));
    });
    outboxRef.current.forEach((a) => a.ops.forEach((op) => { if (op.kind === 'create') paths.push(op.path); }));
    return createAction(name, payload, paths.map((path) => ({ path, sha: '' })));
  }, []);
  /** Put a new note in the outbox: it shows at once and is saved when the connection allows. */
  const create = useCallback(<K extends MakerName>(name: K, payload: Payloads[K] | Payloads[K][]): Action => {
    const action = planned(name, payload);
    setOutbox(add(outboxRef.current, action));
    return action;
  }, [planned, setOutbox]);

  /** Write the saved copy to the device. What went up before this is in it now, so it leaves the list kept for the
   * moment between a save and this write (outbox.ts, loadLanded). */
  const persist = useCallback(async (s: Snapshot) => {
    const ids = loadLanded(s.key).map((a) => a.id);
    await writeSnapshot(s);
    if (ids.length) saveLanded(s.key, loadLanded(s.key).filter((a) => ids.indexOf(a.id) < 0));
  }, []);
  // Writing the saved copy copies the whole vault, so after the outbox goes up it is written once things go quiet, not
  // once for each save (Keep after Keep in the Edit room), and at once when the app is put away.
  const snapTimer = useRef(0);
  const writeSnapNow = useCallback(() => {
    if (!snapTimer.current) return;
    clearTimeout(snapTimer.current);
    snapTimer.current = 0;
    if (snapRef.current) void persist(snapRef.current);
  }, [persist]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') writeSnapNow(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', writeSnapNow);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', writeSnapNow); writeSnapNow(); };
  }, [writeSnapNow]);

  /** Put notes the app just saved into the saved copy, so every screen shows them before the next sync. `soon` is for
   * the outbox: the copy on the device is written once things go quiet. Anything else (writing) is written at once. */
  const foldNotes = useCallback(async (saved: NoteRecord[], soon = false, removed: string[] = [], texts: Record<string, { sha: string; text: string }> = {}) => {
    const cur = snapRef.current;
    if ((!saved.length && !removed.length && !Object.keys(texts).length) || !cur || cur.key !== source.key) return;
    const next = { ...cur, index: foldSaved(cur.index, saved, schemaRef.current, removed, texts) };
    snapRef.current = next;
    setSnap(next);
    clearTimeout(snapTimer.current);
    snapTimer.current = 0;
    if (soon) snapTimer.current = window.setTimeout(writeSnapNow, 1500);
    else await persist(next);
  }, [source, writeSnapNow, persist]);

  // One lane for sending the outbox up and for reading the vault down, so the two never cross: a sync that started
  // before a save landed could otherwise finish after it and put the older note back on the screen until the next sync.
  // A call while one of its kind waits to start joins it; nothing waits more than 25 seconds on a call that hangs.
  const lane = useRef<Promise<unknown>>(Promise.resolve());
  const waitingRuns = useRef<{ [kind: string]: Promise<unknown> | undefined }>({});
  const inLane = useCallback(<T,>(kind: string, job: () => Promise<T>): Promise<T> => {
    const joined = waitingRuns.current[kind] as Promise<T> | undefined;
    if (joined) return joined;
    let timer = 0;
    const before = Promise.race([lane.current, new Promise((r) => { timer = window.setTimeout(r, 25000); })]);
    const run = before.then(() => { clearTimeout(timer); waitingRuns.current[kind] = undefined; return job(); });
    waitingRuns.current[kind] = run;
    lane.current = run.catch(() => undefined);
    return run;
  }, []);
  // Another vault: a call for it must not join a run that was waiting for the old one. The lane itself carries on, so
  // what is still running for the old vault finishes before the new vault's first run starts. (Not at the app's start:
  // a part of the page may already have asked for a push by then, and the lane must keep it in line.)
  const laneSource = useRef(source);
  useEffect(() => { if (laneSource.current !== source) { laneSource.current = source; waitingRuns.current = {}; } }, [source]);

  /** The actions a push has taken and not finished with, by id, and the push that is running. An action must never be in
   * two pushes at once: the second would be made again on top of the first's save, and a change that adds (a note on the
   * workflow, words typed) would land twice. */
  const sending = useRef(new Set<string>());
  const pushing = useRef<Promise<unknown> | null>(null);
  /** Send the outbox to GitHub, one save for each action, then fold the saved notes into the saved copy. */
  const pushNow = useCallback(async (): Promise<string | null> => {
    if (!outboxRef.current.length || !navigator.onLine) return null;
    // One push at a time. A push that hangs holds the next one for 25 seconds at most, and what it took stays its own.
    if (pushing.current) await Promise.race([pushing.current.catch(() => undefined), new Promise((r) => { window.setTimeout(r, 25000); })]);
    const sent = outboxRef.current.filter((a) => !sending.current.has(a.id));
    if (!sent.length) return null;
    sent.forEach((a) => sending.current.add(a.id));
    const run = (async (): Promise<string | null> => {
      const res = await pushAll(source, sent, { legacy: oldSaving() });
      if (sourceRef.current !== source) {
        // Kyle pointed the app at another vault while this was saving: settle this vault's own list where it is kept.
        saveOutbox(source.key, settle(loadOutbox(source.key), res.done, res.failed, res.renames));
        return res.error;
      }
      // Only the actions this push handled leave or take a failure; ones Kyle added while it ran wait for the next push.
      const left = settle(outboxRef.current, res.done, res.failed, res.renames);
      // What went up stays on the device, in its own list, until the saved copy with it in has been written.
      const landed = landedOf(sent, res.done, res.renames);
      if (landed.length) saveLanded(source.key, loadLanded(source.key).concat(landed));
      setOutbox(left);
      if (res.error) setError(res.error);
      // A new note saved under another ID than it was shown with: what Kyle wrote in it follows, and so does the page.
      if (Object.keys(res.renames).length) {
        moveDrafts(source.key, res.renames);
        const at = parseHash(location.hash);
        if ('path' in at && res.renames[at.path]) location.replace(location.hash.replace(encodeURIComponent(at.path), encodeURIComponent(res.renames[at.path])));
      }
      await foldNotes(res.saved, true, res.removed, res.texts);
      if (left.some((a) => !sent.some((x) => x.id === a.id))) setTimeout(() => runFlushRef.current(), 0);
      return res.error;
    })();
    pushing.current = run;
    try { return await run; } finally {
      sent.forEach((a) => sending.current.delete(a.id));
      if (pushing.current === run) pushing.current = null;
    }
  }, [source, setOutbox, foldNotes]);
  const runFlush = useCallback((): Promise<string | null> => inLane('push', pushNow).catch((e: Error) => { setError(e.message); return e.message; }), [inLane, pushNow]);
  const runFlushRef = useRef(runFlush);
  runFlushRef.current = runFlush;
  /** Send one action now, without it waiting in the outbox: all of it lands or nothing does, and the answer is known
   * before the page moves on. For a change to chapter numbers (ops.ts says why that never waits). Throws a plain sentence. */
  const sendNow = useCallback((action: Action): Promise<Pushed> => inLane('now ' + action.id, async () => {
    const cur = snapRef.current;
    const res = await pushAction(source, action, { known: cur && cur.key === source.key ? cur.index.notes : undefined });
    await foldNotes(res.saved, false, res.removed, res.texts);
    return res;
  }), [source, inLane, foldNotes]);
  /** Before a chapter is added in the middle, moved or deleted: what waits for this book goes up first. Answers on the
   * team's changes wait by their note's file name, and a new scene or a moved card by its chapter number; those are
   * about to change, so they must be in the vault before that. */
  const beforeRenames = useCallback(async (bookFolder: string) => {
    const inBook = (op: Action['ops'][number]) => op.path.startsWith(bookFolder + '/');
    if (!outboxRef.current.some((a) => a.ops.some(inBook))) return;
    await runFlush();
    const left = outboxRef.current.flatMap((a) => a.ops).filter(inBook);
    if (left.some((op) => op.path.startsWith(bookFolder + '/Changes/'))) throw new Error('Your answers on the team\'s changes have not saved yet. Press Sync, then try again.');
    if (left.some((op) => op.kind === 'create' || (op.kind === 'edit' && op.edit.type === 'choice' && op.edit.choice.decision === 'move'))) {
      throw new Error('Something you added or moved in this book has not saved yet. Press Sync, then try again.');
    }
  }, [runFlush]);

  const runSync = useCallback((): Promise<void> => inLane('sync', async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      // The outbox first: a new scene must be in the vault before the words Kyle wrote in it can be saved to it.
      const pushError = await pushNow();
      const written = await flushDrafts(source, source.key, new Date());
      await foldNotes(written.saved);
      if (written.notice) setNotice(written.notice);
      const saveError = pushError || written.error;
      const next = await sync(source, snapRef.current && snapRef.current.key === source.key ? snapRef.current : null);
      snapRef.current = next;
      setSnap(next);
      setError(saveError);
      clearTimeout(snapTimer.current);
      snapTimer.current = 0;
      await persist(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }), [source, inLane, pushNow, foldNotes, setNotice]);

  /** The book's scenes in reading order as Kyle sees them, new ones that still wait included. */
  const scenesShown = useCallback((book: BookEntry): NoteRecord[] => {
    const cur = snapRef.current;
    if (!cur) return [];
    const shown = overlayActions(cur.index, outboxRef.current, schemaRef.current);
    const b = shown.books.find((x) => x.folder === book.folder) || book;
    return b.scenes.map((p) => shown.notes[p]).filter(Boolean);
  }, []);

  /** Add a scene to a book and open it for writing. It shows at once and is saved when the connection allows
   * (2026-11-11; before, it needed the connection). */
  const onAddScene = useCallback(async (book: BookEntry, chapter: number | null, chapterTitle: string, title: string): Promise<string | null> => {
    const cur = snapRef.current;
    if (!cur) return 'Press Sync first.';
    if (oldSaving() && !navigator.onLine) return 'Connect to the internet to add a scene.';
    const scenes = oldSaving() ? book.scenes.map((p) => cur.index.notes[p]).filter(Boolean) : scenesShown(book);
    // After the chapter's last scene, or after the book's last scene for a new chapter.
    const inCh = scenes.filter((n) => chapter != null && n.data.chapter === chapter);
    const prev = inCh.length ? inCh[inCh.length - 1] : chapter == null || !scenes.some((n) => typeof n.data.chapter === 'number' && n.data.chapter > chapter) ? scenes[scenes.length - 1] || null : null;
    const next = prev ? scenes[scenes.indexOf(prev) + 1] || null : scenes[0] || null;
    const s = { bookFolder: book.folder, title, chapter, chapterTitle, order: orderBetween(prev, next), status: 'drafted', body: '' };
    try {
      if (oldSaving()) {
        const made = await createScene(source, s, new Date(), 'Added in the Sparrow app.');
        await runSync();
        location.hash = href.write(made.path);
        return null;
      }
      const made = create('scene', { s, at: new Date().toISOString() });
      runFlush();
      location.hash = href.write(made.ops[0].path);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [source, runSync, runFlush, create, scenesShown]);

  /** Add a chapter of one scene after chapter `after` (null: after the book's last chapter) and open it for writing.
   * In the middle of the book, the later chapters move up one (Kyle, 2026-10-22). A new last chapter shows at once and
   * works offline; one in the middle needs the connection and is one save with the renumbering (2026-11-11). */
  const onAddChapter = useCallback(async (book: BookEntry, after: number | null, chapterTitle: string): Promise<string | null> => {
    const cur = snapRef.current;
    if (!cur) return 'Press Sync first.';
    const old = oldSaving();
    const scenes = old ? book.scenes.map((p) => cur.index.notes[p]).filter(Boolean) : scenesShown(book);
    const nums = scenes.map((n) => toNumber(n.data.chapter)).filter((n): n is number => n != null);
    const last = nums.length ? Math.max(...nums) : 0;
    const at = after == null || after >= last ? last + 1 : after + 1;
    if (!navigator.onLine && (old || at <= last)) return at <= last && !old ? 'Connect to the internet to add a chapter in the middle of the book: the chapters after it get new numbers.' : 'Connect to the internet to add a chapter.';
    const inCh = scenes.filter((n) => toNumber(n.data.chapter) === at - 1);
    const prev = inCh.length ? inCh[inCh.length - 1] : scenes[scenes.length - 1] || null;
    const next = prev ? scenes[scenes.indexOf(prev) + 1] || null : scenes[0] || null;
    const title = chapterTitle.trim();
    const s = { bookFolder: book.folder, title: title || 'Chapter ' + at, chapter: at, chapterTitle: title, order: orderBetween(prev, next), status: 'drafted', body: '' };
    try {
      if (old) {
        if (at <= last) {
          // Keep or No choices still waiting on this device are saved by file name, so they go up before the names change.
          await beforeRenames(book.folder);
          await makeRoom(source, chapterShifts(cur.index.notes, book.folder, at - 1), at);
          await renumberLists(source, cur.index.notes, book.folder, roomMap(at - 1), 'A new chapter ' + at + ' was added in the Sparrow app.');
        }
        const made = await createScene(source, s, new Date(), 'Added in the Sparrow app.');
        await runSync();
        location.hash = href.write(made.path);
        return null;
      }
      if (at > last) {
        const made = create('scene', { s, at: new Date().toISOString() });
        runFlush();
        location.hash = href.write(made.ops[0].path);
        return null;
      }
      // What waits for this book is addressed by file names that are about to change, so it goes up first.
      await beforeRenames(book.folder);
      const scene = planned('scene', { s, at: new Date().toISOString() }).ops[0];
      const res = await sendNow(chaptersAction(book.folder, { type: 'room', after: at - 1 }, 'A new chapter ' + at + ' was added in the Sparrow app.', [scene]));
      location.hash = href.write(res.renames[scene.path] || scene.path);
      return null;
    } catch (e) {
      if (old) await runSync().catch(() => undefined);
      return (e as Error).message;
    }
  }, [source, runSync, runFlush, beforeRenames, create, planned, sendNow, scenesShown]);

  /** A card dragged to a new place on the Chapter Grid: give it an order between its new neighbours (and the chapter it went into). */
  const onMove = useCallback((book: BookEntry, path: string, chapter: number | null, chapterTitle: string, before: string | null) => {
    const cur = snapRef.current;
    if (!cur) return;
    const shown = overlayActions(cur.index, outboxRef.current);
    const b = shown.books.find((x) => x.folder === book.folder);
    if (!b) return;
    const rest = b.scenes.filter((p) => p !== path).map((p) => shown.notes[p]).filter(Boolean);
    let prev: NoteRecord | null, next: NoteRecord | null;
    if (before) {
      const at = rest.findIndex((n) => n.path === before);
      next = at >= 0 ? rest[at] : null;
      prev = at > 0 ? rest[at - 1] : null;
    } else {
      const same = (n: NoteRecord) => (chapter == null ? typeof n.data.chapter !== 'number' : n.data.chapter === chapter);
      const inCh = rest.filter(same);
      prev = inCh.length ? inCh[inCh.length - 1] : null;
      next = prev ? rest[rest.indexOf(prev) + 1] || null : null;
    }
    const at = new Date().toISOString();
    const moves: Choice[] = [{ path, decision: 'move', reason: '', at, move: { order: orderBetween(prev, next), chapter, chapterTitle } }];
    // A chapter's title lives on its scenes. If the card that carried it leaves, the next scene in that chapter takes it on.
    const moved = shown.notes[path];
    const oldTitle = moved && typeof moved.data.chapter_title === 'string' ? moved.data.chapter_title : '';
    const oldCh = moved && typeof moved.data.chapter === 'number' ? moved.data.chapter : null;
    if (oldTitle && oldCh != null && oldCh !== chapter) {
      const left = rest.filter((n) => n.data.chapter === oldCh);
      if (left.length && !left.some((n) => n.data.chapter_title)) {
        const heir = left[0];
        const order = typeof heir.data.order === 'number' ? heir.data.order : orderBetween(rest[rest.indexOf(heir) - 1] || null, rest[rest.indexOf(heir) + 1] || null);
        moves.push({ path: heir.path, decision: 'move', reason: '', at, move: { order, chapter: oldCh, chapterTitle: oldTitle } });
      }
    }
    // The move and the name handed on are one action: they save together or not at all.
    act(moves);
    runFlush();
  }, [act, runFlush]);

  /** Save a Publisher Rocket export into the series' Market folder, then sync so the board lists it. */
  const onAddRocket = useCallback(async (book: BookEntry, file: File): Promise<{ error: boolean; text: string }> => {
    const problem = rocketProblem(file.name, file.size);
    if (problem) return { error: true, text: problem };
    if (!navigator.onLine) return { error: true, text: 'Connect to the internet to add a Rocket file.' };
    if (!oldSaving() && source.commit) {
      // One save through the one saving system; a name that is taken gets the next free one at the save.
      try {
        const f = rocketFile(book.seriesFolder, file.name, await file.text());
        const res = await sendNow(filesAction([f]));
        const path = res.renames[f.path] || f.path;
        await runSync();
        return { error: false, text: 'Saved ' + path.slice(path.lastIndexOf('/') + 1) + ' in the vault. Ask the team in the project chat to read it.' };
      } catch (e) {
        return { error: true, text: (e as Error).message };
      }
    }
    const series = snapRef.current && snapRef.current.index.series.find((s) => s.folder === book.seriesFolder);
    try {
      const path = await addRocketFile(source, book.seriesFolder, (series && series.rocket) || [], file.name, await file.text());
      await runSync();
      return { error: false, text: 'Saved ' + path.slice(path.lastIndexOf('/') + 1) + ' in the vault. Ask the team in the project chat to read it.' };
    } catch (e) {
      return { error: true, text: (e as Error).message };
    }
  }, [source, runSync, sendNow]);

  /** Add a to-do to the vault's Tasks folder. It shows at once and is saved when the connection allows (2026-11-11). */
  const onAddTask = useCallback(async (t: NewTask): Promise<string | null> => {
    try {
      create('task', { t, at: new Date().toISOString() });
      runFlush();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [create, runFlush]);

  /** Add a to-do beside the page: a task note in the book's own Tasks folder. It shows at once, offline too. */
  const onAddTodo = useCallback(async (bookFolder: string, t: NewTodo): Promise<string | null> => {
    try {
      create('todo', { book: bookFolder, t, at: new Date().toISOString() });
      runFlush();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [create, runFlush]);

  /** Ask the team for one piece of work: write a job note into the vault's Jobs folder, then sync so the Jobs screen shows it.
   * A job of the same kind and target that the team has not finished yet is reported instead of made twice. */
  const onJob = useCallback(async (j: NewJob): Promise<{ error: boolean; text: string }> => {
    const cur = snapRef.current;
    // Fill braces may run again while one is waiting: the page only sends asks the team does not have yet.
    const open = cur && j.kind !== 'fill' ? openJobFor(jobNotes(overlayActions(cur.index, outboxRef.current, schemaRef.current)), j.kind, j.target) : null;
    if (open) {
      const s = String(open.data.status || 'requested');
      return { error: false, text: String(open.data.id || 'A job') + ' (' + jobLabel(j.kind).toLowerCase() + (j.target ? ', ' + j.target : '') + ') is already ' + (s === 'running' ? 'being worked on' : 'waiting for the team') + '. See Jobs.' };
    }
    try {
      // The ask is a job note in the outbox (2026-11-11): it shows in Jobs at once and goes up when the connection allows.
      create('job', { j, at: new Date().toISOString() });
      runFlush();
      return { error: false, text: navigator.onLine ? 'Sent to the team. The team picks it up within a few minutes; see Jobs.' : 'Saved on this device. It goes to the team when you are back online; see Jobs.' };
    } catch (e) {
      return { error: true, text: (e as Error).message };
    }
  }, [create, runFlush]);

  /** Send a message in a conversation with the team: one chat job note, shown at once, then a sync in the background.
   * A conversation not started yet ('new') gets the next free chat-NNN. A message may follow one still waiting for a reply. */
  const onChat = useCallback(async (thread: string, words: string, book: string, page = ''): Promise<{ thread: string; book: string } | { error: string }> => {
    const cur = snapRef.current;
    if (!cur) return { error: 'Press Sync first.' };
    // Messages still waiting on the device count, so two new conversations started offline get two names.
    const shown = overlayActions(cur.index, outboxRef.current, schemaRef.current);
    const t = thread === 'new' ? nextChatThread(shown) : thread;
    if (!isThread(t)) return { error: 'That conversation has no name the team knows. Start a new conversation instead.' };
    const folder = book || (activeBook(shown) || shown.books[0] || { folder: '' }).folder;
    try {
      create('job', { j: chatJob(t, words, folder, page), at: new Date().toISOString() });
      runFlush();
      return { thread: t, book: folder };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [create, runFlush]);

  /** A picture from the device becomes the book's cover: kept full size in the book's Cover/ folder, and a small copy
   * made here is saved as Cover.jpg in the book's folder. */
  const onCover = useCallback(async (book: BookEntry, file: File): Promise<string | null> => {
    const problem = coverProblem(file);
    if (problem) return problem;
    if (!navigator.onLine) return 'Connect to the internet to add a cover.';
    try {
      // The full-size picture and the small copy go up as one save (2026-11-11; before, two).
      if (!oldSaving() && source.commit) await sendNow(filesAction(await coverFiles(book, file)));
      else await addCover(source, book, file);
      await runSync();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [source, runSync, sendNow]);

  /** Files from the device saved as they are, as one save (the Word backup of Export to Word). */
  const onFiles = useCallback(async (files: DeviceFile[]): Promise<void> => { await sendNow(filesAction(files)); }, [sendNow]);

  /** Scenes from a pasted outline, added as planned scenes at the end of the book: one save for all of them, and they
   * show at once (2026-11-11; before, one save each, with the connection). */
  const onAddMany = useCallback(async (book: BookEntry, list: { chapter: number; chapterTitle: string; title: string }[]): Promise<string | null> => {
    const cur = snapRef.current;
    if (!cur) return 'Press Sync first.';
    if (!oldSaving()) {
      try {
        const scenes = scenesShown(book);
        let prev: NoteRecord | null = scenes[scenes.length - 1] || null;
        const at = new Date().toISOString();
        create('scene', list.map((x) => {
          const s = { bookFolder: book.folder, title: x.title, chapter: x.chapter, chapterTitle: x.chapterTitle, order: orderBetween(prev, null), status: 'planned', body: '' };
          prev = { path: '', sha: '', type: 'scene', data: { order: s.order }, body: '', error: null };
          return { s, at, why: 'Added from an outline in the Sparrow app.' };
        }));
        runFlush();
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    }
    if (!navigator.onLine) return 'Connect to the internet to add scenes.';
    let prev: NoteRecord | null = book.scenes.length ? cur.index.notes[book.scenes[book.scenes.length - 1]] || null : null;
    const made: NoteRecord[] = [];
    try {
      for (const s of list) {
        const n = await createScene(source, { bookFolder: book.folder, title: s.title, chapter: s.chapter, chapterTitle: s.chapterTitle, order: orderBetween(prev, null), status: 'planned', body: '' },
          new Date(), 'Added from an outline in the Sparrow app.');
        made.push(n);
        prev = n;
      }
      await runSync();
      return null;
    } catch (e) {
      await runSync();
      return (made.length ? made.length + ' of ' + list.length + ' scenes were added. ' : '') + (e as Error).message;
    }
  }, [source, runSync, runFlush, create, scenesShown]);

  const onJobRef = useRef(onJob);
  onJobRef.current = onJob;

  /** A scene card's new title: the file is renamed to match, then the boards sync. */
  const onRename = useCallback(async (note: NoteRecord, title: string): Promise<string | null> => {
    if (!oldSaving()) {
      // The new title shows at once and waits with everything else; the save renames the file, and the words kept on
      // the device and what waits for the scene follow it to the new name (2026-11-11; before, it needed the connection).
      const clean = safeTitle(title);
      if (!clean) return 'Give the scene a title first.';
      const id = String(note.data.id || '');
      const dest = note.path.slice(0, note.path.lastIndexOf('/')) + '/' + (id ? id + ' ' : '') + clean + '.md';
      const cur = snapRef.current;
      if (dest !== note.path && cur && Object.keys(cur.index.notes).some((p) => p.toLowerCase() === dest.toLowerCase())) return 'A scene called ' + clean + ' is already there. Choose another title.';
      const at = new Date();
      setOutbox(add(outboxRef.current, { id: newId(at), at: at.toISOString(), ops: [{ kind: 'retitle', path: note.path, title: clean, what: 'scene' }] }));
      runFlush();
      return null;
    }
    if (!navigator.onLine) return 'Connect to the internet to change a title.';
    const d = loadDrafts(source.key)[note.path];
    if (d && d.body !== d.baseBody) return 'This scene has writing that has not reached the vault yet. Open it and press Done first, then change the title.';
    try {
      await renameScene(source, note, title);
      await runSync();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [source, runSync, setOutbox, runFlush]);

  /** Save a manuscript from the device in the book's Research folder, unchanged, and ask the team to bring it in as scenes. */
  const onImport = useCallback(async (book: BookEntry, file: File): Promise<{ error: boolean; text: string }> => {
    const problem = manuscriptProblem(file.name, file.size);
    if (problem) return { error: true, text: problem };
    if (!navigator.onLine || !source.write) return { error: true, text: 'Connect to the internet to bring in a manuscript.' };
    try {
      const { files } = await source.tree();
      const path = manuscriptPath(book.folder, file.name, files.map((f) => f.path));
      const why = 'manuscripts: add ' + path.slice(path.lastIndexOf('/') + 1) + '\n\nAdded in the Sparrow app to bring in as scenes.';
      if (!oldSaving() && source.commit) {
        // The file and the ask to the team go up as one save, so there is never a manuscript in the vault that nobody
        // was asked to bring in (2026-11-11; before, two saves).
        const rel = path.slice(book.folder.length + 1);
        const ask = planned('job', { j: { title: 'Bring in ' + file.name.replace(/\.[^.]+$/, ''), kind: 'import', target: rel, book: book.folder, ask: jobAsk('import', rel, '') }, at: new Date().toISOString() });
        // Every manuscript goes up byte for byte, a text file too: it is saved unchanged, and a long one is too big to
        // travel inside the save's own list of files.
        await sendNow(filesAction([{ path, taken: 'refuse', message: why, base64: await fileBase64(file) }], ask.ops));
        return { error: false, text: 'Saved ' + rel + '. The team is bringing it in as scenes; see Jobs.' };
      }
      if (/\.docx$/i.test(path)) {
        if (!source.writeBytes) return { error: true, text: 'This vault cannot take Word files from the app.' };
        await source.writeBytes(path, await fileBase64(file), '', why);
      } else await source.write(path, await file.text(), '', why);
      const rel = path.slice(book.folder.length + 1);
      const r = await onJobRef.current({ title: 'Bring in ' + file.name.replace(/\.[^.]+$/, ''), kind: 'import', target: rel, book: book.folder, ask: jobAsk('import', rel, '') });
      return r.error ? r : { error: false, text: 'Saved ' + rel + '. The team is bringing it in as scenes; see Jobs.' };
    } catch (e) {
      return { error: true, text: (e as Error).message };
    }
  }, [source, planned, sendNow]);

  const onCreateSeries = useCallback(async (name: string, genre: string): Promise<string | null> => {
    if (!oldSaving()) {
      // A new series is a new note like any other: it shows at once and goes up when the connection allows.
      try { const a = create('series', { name, genre, at: new Date().toISOString() }); runFlush(); const p = a.ops[0].path; location.hash = href.series(p.slice(0, p.lastIndexOf('/'))); return null; } catch (e) { return (e as Error).message; }
    }
    if (!navigator.onLine) return 'Connect to the internet to start a series.';
    try { const n = await createSeries(source, name, genre, new Date()); await makeBackupFolder(source, String(n.data.name || name)); await runSync(); location.hash = href.series(n.path.slice(0, n.path.lastIndexOf('/'))); return null; } catch (e) { return (e as Error).message; }
  }, [source, runSync, create, runFlush]);

  const onCreateBook = useCallback(async (seriesFolder: string, seriesName: string, title: string, number: number): Promise<string | null> => {
    if (!oldSaving()) {
      try { const a = create('book', { seriesFolder, seriesName, title, number, at: new Date().toISOString() }); runFlush(); const p = a.ops[0].path; location.hash = href.book(p.slice(0, p.lastIndexOf('/'))); return null; } catch (e) { return (e as Error).message; }
    }
    if (!navigator.onLine) return 'Connect to the internet to start a book.';
    try { const n = await createBook(source, seriesFolder, seriesName, title, number, new Date()); await makeBackupFolder(source, seriesName, String(n.data.title || title)); await runSync(); location.hash = href.book(n.path.slice(0, n.path.lastIndexOf('/'))); return null; } catch (e) { return (e as Error).message; }
  }, [source, runSync, create, runFlush]);

  /** Rewrite now: after the Rewrite choice reaches the vault, ask the team to do the rewrite. */
  const onRewrite = useCallback(async (path: string, reason: string) => {
    await runFlushRef.current();
    const cur = snapRef.current;
    const n = cur && cur.index.notes[path];
    const book = cur ? cur.index.books.find((b) => path.startsWith(b.folder + '/') || path.startsWith(b.seriesFolder + '/')) : null;
    const target = n && n.data.id ? String(n.data.id) : path;
    await onJobRef.current({ title: defaultJobTitle('rewrite', target, n ? String(n.data.title || n.data.name || '') : ''), kind: 'rewrite', target, book: book ? book.folder : '', ask: jobAsk('rewrite', target + (n && n.data.id ? ' (' + path + ')' : ''), reason) });
  }, []);

  /** Writers Room pages: a new Note to the Team, a new or changed recipe; each saves at once, then syncs. */
  const onAddNote = useCallback(async (book: BookEntry, n: NewNote): Promise<string | null> => {
    try { create('note', { book: book.folder, n, at: new Date().toISOString() }); runFlush(); return null; } catch (e) { return (e as Error).message; }
  }, [create, runFlush]);
  const onAddRecipe = useCallback(async (r: RecipeFields): Promise<string | null> => {
    try { create('recipe', { r, at: new Date().toISOString() }); runFlush(); return null; } catch (e) { return (e as Error).message; }
  }, [create, runFlush]);
  const onSaveRecipe = useCallback(async (note: NoteRecord, r: RecipeFields): Promise<string | null> => {
    if (!oldSaving()) {
      // The recipe's words change at once and wait with everything else; a new name renames its file at the save.
      if (!r.body.trim()) return 'A recipe needs its instruction. Write it, or leave the recipe as it was.';
      const title = safeTitle(r.title) || recipeName(note);
      const rename: Action['ops'] = title === recipeName(note) ? [] : [{ kind: 'retitle', path: note.path, title, what: 'recipe' }];
      setOutbox(add(outboxRef.current, textAction([{ path: note.path, change: { what: 'recipe', use_for: r.use_for, body: r.body } }], rename)));
      runFlush();
      return null;
    }
    if (!navigator.onLine) return 'Connect to the internet to change a recipe.';
    try { await saveRecipe(source, note, r); await runSync(); return null; } catch (e) { return (e as Error).message; }
  }, [source, runSync, setOutbox, runFlush]);

  const onWorkflowNote = useCallback(async (note: string): Promise<string | null> => {
    if (!oldSaving() && source.commit) {
      // The note shows at once under "Kyle's notes" and waits with everything else (2026-11-11; before, it needed the connection).
      const d = new Date();
      const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      setOutbox(add(outboxRef.current, textAction([{ path: WORKFLOW_PATH, change: { what: 'workflow-note', note, day } }])));
      runFlush();
      return null;
    }
    if (!navigator.onLine) return 'Connect to the internet to add a note to the workflow.';
    if (!source.readFresh || !source.write) return 'This vault cannot be written from here.';
    try {
      const fresh = await source.readFresh(WORKFLOW_PATH);
      const d = new Date();
      const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      await source.write(WORKFLOW_PATH, addWorkflowNote(fresh.text, note, day), fresh.sha, 'workflow: Kyle\'s note');
      await runSync();
      return null;
    } catch (e) { return (e as Error).message; }
  }, [source, runSync, setOutbox, runFlush]);

  /** The book's draft saved: every scene copied to `Drafts/Draft N/` with its note, as one save through the one saving
   * system, made on the vault as it is at that moment (2026-11-11). Answers the draft's number. */
  const saveDraft = useCallback(async (book: BookEntry): Promise<number> => {
    if (oldSaving() || !source.commit) {
      const cur = snapRef.current;
      return (await saveBookDraft(source, book.folder, cur ? book.scenes.map((p) => cur.index.notes[p]).filter(Boolean) : [], new Date())).number;
    }
    const res = await sendNow(draftAction(book.folder));
    const made = res.saved.map((n) => /\/Drafts\/Draft (\d+)\.md$/.exec(n.path)).find(Boolean);
    return made ? Number(made[1]) : 0;
  }, [source, sendNow]);

  /** A scene brought back from the book's Archive: in Scenes again and out of the Archive in one save. */
  const onRestore = useCallback(async (book: BookEntry, path: string): Promise<void> => { await sendNow(restoreAction(book.folder, path)); }, [sendNow]);

  /** Words Kyle wrote in a box of their own (the front and back matter, the book's Braindump): they show at once and
   * wait with everything else (2026-11-11; before, they needed the connection). */
  const onWords = useCallback((path: string, change: Extract<TextChange, { what: 'words' }>): void => {
    setOutbox(add(outboxRef.current, textAction([{ path, change }])));
    runFlush();
  }, [setOutbox, runFlush]);

  /** Done with this chapter in the Rewrite tab (Kyle, 2026-11-05): the book note marks the chapter through; when the last
   * rewritten chapter is through, Draft 2 is saved by itself and the pages go on as draft 3. */
  const onRewriteThrough = useCallback(async (book: BookEntry, chapter: number, done: boolean): Promise<string | null> => {
    if (!oldSaving()) {
      // The mark shows at once and waits with everything else (2026-11-11; before, it needed the connection).
      const change: TextChange = { what: 'through', chapter, done };
      const cur = snapRef.current;
      const shown = cur ? overlayActions(cur.index, outboxRef.current, schemaRef.current).notes[book.path] : null;
      setOutbox(add(outboxRef.current, textAction([{ path: book.path, change }])));
      const flushed = runFlush();
      const scenes = cur ? book.scenes.map((p) => cur.index.notes[p]).filter(Boolean) : [];
      const after = shown ? rewriteProgress(book.rewrite || [], scenes, rewriteDone(changeRecord(shown, change))) : null;
      if (!done || !after || !after.total || after.through < after.done || after.done < after.total) return null;
      // The last chapter: Draft 2 is saved (the copies in Drafts/Draft N/), which needs the connection.
      if (!navigator.onLine || !scenes.length) return 'Chapter ' + chapter + ' is through, the last one. Save the draft from Book details when you are connected.';
      try {
        await flushed;
        const number = await saveDraft(book);
        await runSync();
        return 'Chapter ' + chapter + ' is through, the last one. Draft ' + number + ' is saved; your pages are now draft ' + (number + 1) + '.';
      } catch (e) {
        await runSync().catch(() => undefined);
        return 'Chapter ' + chapter + ' is through, the last one, but the draft did not save: ' + (e as Error).message + ' Save it from Book details.';
      }
    }
    if (!navigator.onLine) return 'Connect to the internet to mark the chapter.';
    if (!source.readFresh || !source.write) return 'This vault cannot be written from here.';
    try {
      const fresh = await source.readFresh(book.path);
      const next = withRewriteDone(fresh.text, chapter, done);
      await source.write(book.path, next, fresh.sha, 'rewrite: chapter ' + chapter + (done ? ' through' : ' opened again') + ' in the Rewrite tab');
      const cur = snapRef.current;
      const scenes = cur ? book.scenes.map((p) => cur.index.notes[p]).filter(Boolean) : [];
      const after = rewriteProgress(book.rewrite || [], scenes, rewriteDone({ data: Frontmatter.parse(next).data as Record<string, unknown> }));
      if (!done || !after.total || after.through < after.done || after.done < after.total) { await runSync(); return null; }
      // The last chapter: Draft 2 is saved (the copies in Drafts/Draft N/), and the scene files go on as the next draft.
      if (!cur || !scenes.length) { await runSync(); return 'Chapter ' + chapter + ' is through, the last one. Save the draft from Book details.'; }
      const d = await saveBookDraft(source, book.folder, scenes, new Date());
      await runSync();
      return 'Chapter ' + chapter + ' is through, the last one. Draft ' + d.number + ' is saved; your pages are now draft ' + (d.number + 1) + '.';
    } catch (e) {
      await runSync().catch(() => undefined);
      return (e as Error).message;
    }
  }, [source, runSync, setOutbox, runFlush, saveDraft]);

  /** The Writing Log: finished Pomodoros and the typing counts, handed over by the timer. They wait with everything
   * else and each handing-over is one save (2026-11-11; before, the timer sent them itself, one save for each). */
  const onLog = useCallback((items: LogItem[]) => {
    if (!items.length) return;
    const now = new Date();
    const at = now.toISOString();
    const changes = items.map((i): { path: string; change: TextChange } => i.kind === 'pomodoro' ? { path: logPath(i.record.date), change: { what: 'log-pomodoro', record: i.record, at } }
      : i.kind === 'typed' ? { path: logPath(i.date), change: { what: 'log-typed', date: i.date, words: i.words, at } }
        : { path: logPath(i.date), change: { what: 'log-typing', date: i.date, minutes: i.minutes, at } });
    setOutbox(add(outboxRef.current, textAction(changes, [], now)));
    runFlush();
  }, [setOutbox, runFlush]);

  /** The Chapter titles page: a tick, or a title Kyle wrote. It shows at once and waits with everything else. */
  const onTitles = useCallback((path: string, change: TextChange) => {
    setOutbox(add(outboxRef.current, textAction([{ path, change }])));
    runFlush();
  }, [setOutbox, runFlush]);

  /** Workflow mode: results Kyle brought in or wrote, saved as idea notes in the book's Ideas folder, then a sync so every screen has them. */
  const onResults = useCallback(async (book: BookEntry, list: NewResult[]): Promise<string | null> => {
    if (!list.length) return 'Write or paste a result first.';
    // Results added together are one action: they go up as one save, each with the next ID.
    const at = new Date().toISOString();
    try { create('result', list.map((r) => ({ book: book.folder, r, at }))); runFlush(); return null; } catch (e) { return (e as Error).message; }
  }, [create, runFlush]);

  const onDecide = useCallback((path: string, decision: Decision, reason: string, fields?: Record<string, string>) => {
    act([{ path, decision, reason, at: new Date().toISOString(), ...(fields ? { fields } : {}) }]);
    runFlush();
  }, [act, runFlush]);

  /** Keep, No and the rest on the team's changes to a chapter (the Edit room), with the to-dos those answers tick off
   * or open again: one action, so one save (2026-11-11; before, each note was its own save from a list of its own). */
  const onMarks = useCallback((path: string, marks: Record<string, ChangeStatus>, ticks: { path: string; fields: Record<string, string> }[]) => {
    const at = new Date().toISOString();
    setOutbox(add(outboxRef.current, marksAction(path, marks, ticks.map((t) => ({ path: t.path, decision: 'edit' as const, reason: '', at, fields: t.fields })))));
    runFlush();
  }, [setOutbox, runFlush]);

  /** Move a chapter to another number; the chapters between close up (Kyle, 2026-10-22). Then sync so the list shows it. */
  const onMoveChapter = useCallback(async (book: BookEntry, from: number, to: number): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to move a chapter.';
    const cur = snapRef.current;
    if (!cur) return 'Press Sync first.';
    const scenes = book.scenes.map((p) => cur.index.notes[p]).filter(Boolean);
    const nums = scenes.map((n) => toNumber(n.data.chapter)).filter((n): n is number => n != null);
    const last = nums.length ? Math.max(...nums) : 0;
    if (!Number.isInteger(to) || to < 1 || to > last) return 'Choose a chapter number from 1 to ' + last + '.';
    const why = 'Chapter ' + from + ' moved to chapter ' + to + ' in the Sparrow app.';
    try {
      // What waits for this book is addressed by file names that are about to change, so it goes up first.
      await beforeRenames(book.folder);
      if (!oldSaving()) {
        // One save: every note of the chapters between follows, or nothing changes (2026-11-11; before, one save a note).
        await sendNow(chaptersAction(book.folder, { type: 'move', from, to }, why));
        return null;
      }
      await applyShifts(source, chapterMove(cur.index.notes, book.folder, scenes, from, to), why);
      await renumberLists(source, cur.index.notes, book.folder, moveMap(from, to), why);
      await runSync();
      return null;
    } catch (e) {
      if (oldSaving()) await runSync().catch(() => undefined);
      return (e as Error).message;
    }
  }, [source, runSync, beforeRenames, sendNow]);

  /** Delete scenes from the chapter list (Kyle, 2026-10-27: "I definitely need an option to hard press it and delete it").
   * Each scene goes to the book's Archive (Restore brings it back). A chapter left with no scenes takes its beats, plan,
   * scrap, to-dos and scene notes to the Archive too, and the chapters after it close up by one. */
  const onDeleteScenes = useCallback(async (book: BookEntry, paths: string[]): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to delete: the words go to the Archive first.';
    const cur = snapRef.current;
    if (!cur) return 'Press Sync first.';
    const scenes = book.scenes.map((p) => cur.index.notes[p]).filter(Boolean);
    const going = scenes.filter((n) => paths.indexOf(n.path) >= 0);
    const now = new Date();
    if (!oldSaving()) {
      try {
        // What waits for this book goes up first: a chapter left empty closes the ones after it up, and what waits is
        // addressed by their numbers.
        await beforeRenames(book.folder);
        // One save: the scenes to the Archive, an emptied chapter's notes with them, the chapters after it closed up,
        // or nothing changes (2026-11-11; before, two saves a note and one more for every note that followed).
        const res = await sendNow(deleteAction(book.folder, paths, now));
        res.removed.forEach((p) => putDraft(source.key, p, null));
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    }
    try {
      for (const n of going) {
        await archiveScene(source, n, now);
        putDraft(source.key, n.path, null);
      }
      const emptied = Array.from(new Set(going.map((n) => toNumber(n.data.chapter)).filter((c): c is number => c != null)))
        .filter((c) => !scenes.some((n) => paths.indexOf(n.path) < 0 && toNumber(n.data.chapter) === c))
        .sort((a, b) => b - a);
      for (const ch of emptied) {
        const fresh = snapRef.current ? snapRef.current.index.notes : cur.index.notes;
        await beforeRenames(book.folder);
        const extra = chapterNotes(fresh, book.folder, ch);
        const dir = book.folder + '/Archive/Deleted chapter ' + ch + ' ' + now.toISOString().slice(0, 10) + '/';
        for (const n of extra) await archiveNote(source, n.path, dir + n.path.slice(n.path.lastIndexOf('/') + 1), 'Its chapter ' + ch + ' was deleted in the Sparrow app', now);
        await applyShifts(source, chapterCloseUp(fresh, book.folder, ch, going.map((n) => n.path).concat(extra.map((n) => n.path))),
          'Chapter ' + ch + ' was deleted in the Sparrow app, so the chapters after it close up by one.');
        const titles = await renumberLists(source, fresh, book.folder, closeMap(ch), 'Chapter ' + ch + ' was deleted in the Sparrow app.');
        if (titles && source.write) {
          await source.write(dir + 'Chapter ' + ch + ' title options.md', '> [!note] Archived\n> The title options of chapter ' + ch + ', deleted in the Sparrow app on ' + now.toISOString().slice(0, 10) + '.\n\n' + titles + '\n', '',
            'archive: title options of deleted chapter ' + ch + '\n\nIts chapter was deleted in the Sparrow app. They left Chapter Titles.md and are kept here.');
        }
        await runSync();
      }
      if (!emptied.length) await runSync();
      return null;
    } catch (e) {
      await runSync().catch(() => undefined);
      return (e as Error).message;
    }
  }, [source, runSync, beforeRenames, sendNow]);

  /** Rename a chapter: its name lives on its scenes' chapter_title lines, saved through the queue like any edit. */
  const onRenameChapter = useCallback((scenes: NoteRecord[], title: string) => {
    const clean = title.replace(/\s+/g, ' ').trim();
    const at = new Date().toISOString();
    // One action for the whole chapter: every scene's line changes in one save.
    act(chapterTitleEdits(scenes, clean).map((path): Choice => ({ path, decision: 'edit', reason: '', at, fields: { chapter_title: clean } })));
    runFlush();
  }, [act, runFlush]);

  // Show the saved copy at once, then refresh it.
  useEffect(() => {
    let live = true;
    setLoaded(false);
    setError(null);
    readSnapshot(source.key).then((read) => {
      if (!live) return;
      // The app was closed between a save and the write of the saved copy: show what went up on the older copy.
      const landed = read ? loadLanded(source.key) : [];
      let schema: Schema | null = null;
      try { if (read && landed.length) schema = parseSchema(read.schemaText); } catch { schema = null; }
      const saved = read && landed.length ? { ...read, index: overlayActions(read.index, landed, schema) } : read;
      setSnap(saved);
      snapRef.current = saved;
      setLoaded(true);
      runSync();
    });
    return () => { live = false; };
  }, [source, runSync]);

  useEffect(() => {
    const up = () => { setOnline(true); runSync(); };
    const down = () => setOnline(false);
    const visible = () => { if (document.visibilityState === 'visible') runSync(); };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    document.addEventListener('visibilitychange', visible);
    // The clock on the screen ticks every minute; on the Jobs screen the vault is read again too, so a finished job shows up.
    const timer = setInterval(() => {
      tick((n) => n + 1);
      const name = parseHash(location.hash).name;
      if ((name === 'jobs' || name === 'chat') && document.visibilityState === 'visible') runSync();
    }, 60000);
    // An open conversation waiting on a reply is read again every 15 seconds, about as often as the runner looks for work.
    // So is an open scene while the team is answering its chat or its braces; any open scene is read every 30 seconds,
    // so words pushed from elsewhere come into the page without reloading.
    let beat = 0;
    const quick = setInterval(() => {
      beat++;
      const r = parseHash(location.hash);
      const cur = snapRef.current;
      if (!cur || document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (r.name === 'chat' && r.thread && r.thread !== 'new') { if (conversation(cur.index, r.thread, r.book).pending) runSync(); return; }
      if (r.name !== 'write') {
        // The team column beside a board or page, open and waiting on a reply.
        if (document.querySelector('.team-side')) {
          const sides = loadSideThreads(source.key);
          if (Object.keys(sides).some((b) => conversation(cur.index, sides[b], b).pending)) runSync();
        }
        return;
      }
      const note = cur.index.notes[r.path];
      const book = note ? cur.index.books.find((b) => r.path.startsWith(b.folder + '/')) : null;
      const id = note ? String(note.data.id || '') : '';
      const busy = book && id ? fillJobsFor(jobNotes(cur.index), id, book.folder).some(isOpenJob) || optionJobsFor(jobNotes(cur.index), id, book.folder).some(isOpenJob) || conversation(cur.index, id, book.folder).pending : false;
      if (busy || beat % 2 === 0) runSync();
    }, 15000);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      document.removeEventListener('visibilitychange', visible);
      clearInterval(timer);
      clearInterval(quick);
    };
  }, [runSync, source]);

  const schema = useMemo<Schema | null>(() => {
    if (!snap) return null;
    try { return parseSchema(snap.schemaText); } catch { return null; }
  }, [snap]);

  schemaRef.current = schema;
  const view = useMemo<VaultIndex | null>(() => (snap ? overlayActions(snap.index, outbox, schema) : null), [snap, outbox, schema]);
  const waiting = useMemo(() => waitingOf(outbox), [outbox]);
  const waitingN = useMemo(() => waitingCount(outbox), [outbox]);

  const onSave = (s: Settings) => setSettings(saveSettings(s));
  const onForget = async () => {
    await clearSnapshots();
    setSnap(null);
    setSettings(saveSettings({ ...settings, token: '' }));
  };

  // The writing screen fills the page with its own bars: no menu or sync bar.
  if ((route.name === 'write' || route.name === 'beats') && view && schema) {
    const note = view.notes[route.path];
    if (note) {
      if (lastOpened.current !== route.path) { lastOpened.current = route.path; noteRecent(source.key, route.path); }
      const book = view.books.find((b) => route.path.startsWith(b.folder + '/')) || null;
      const at = book ? book.scenes.indexOf(route.path) : -1;
      const next = book && at >= 0 && at + 1 < book.scenes.length ? view.notes[book.scenes[at + 1]] || null : null;
      const prev = book && at > 0 ? view.notes[book.scenes[at - 1]] || null : null;
      const groups = book ? chapterGroups(schema, book.scenes.map((p) => view.notes[p]).filter(Boolean)) : [];
      // Beats mode: the chapter by its beats in the page's place.
      const chapter = typeof note.data.chapter === 'number' ? note.data.chapter : null;
      const beats = route.name === 'beats' && book && chapter != null ? {
        note: beatsNoteFor(view.notes, book.folder, chapter),
        asking: jobNotes(view).find((j) => String(j.data.kind || '') === 'beats' && String(j.data.target || '') === 'Chapter ' + chapter && String(j.data.book || '') === book.folder
          && ['requested', 'running'].indexOf(String(j.data.status || 'requested')) >= 0) || null
      } : null;
      return (
        <Editor key={route.path + (beats ? ':beats' : '')} beats={beats} source={source} schema={schema} note={note} next={next} prev={prev}
          nextMentions={book && next && next.data.id ? mentionsOf(Object.values(view.notes).filter((n) => n.path.startsWith(book.folder + '/')), String(next.data.id || '')) : []}
          book={book ? { title: book.title, folder: book.folder, groups, archive: book.archive || [] } : null}
          onAdd={book && source.write ? (chapter, chapterTitle, title) => onAddScene(book, chapter, chapterTitle, title) : undefined}
          onAddChapter={book && source.write && source.readFresh ? (after, chapterTitle) => onAddChapter(book, after, chapterTitle) : undefined}
          onRenameChapter={book && source.write ? onRenameChapter : undefined}
          onMoveChapter={book && source.write && source.readFresh && source.remove ? (from, to) => onMoveChapter(book, from, to) : undefined}
          onDeleteScenes={book && source.write && source.readFresh && source.remove ? (paths) => onDeleteScenes(book, paths) : undefined}
          onRestore={book && source.commit && !oldSaving() ? (path) => onRestore(book, path) : undefined}
          onNotes={book && source.commit && !oldSaving() ? (was, body) => onWords(book.braindump || book.folder + '/Braindump.md', { what: 'words', of: 'braindump', was, body, start: BRAINDUMP_START, name: book.title }) : undefined}
          onFiles={source.commit && !oldSaving() ? onFiles : undefined}
          onJob={book && source.write ? onJob : undefined} onChat={book && source.write ? onChat : undefined}
          todos={book ? bookTodos(view, book) : []} onTodo={source.write ? onDecide : undefined} onMarks={source.write ? onMarks : undefined} waiting={waiting}
          onAddTodo={book && source.write ? (t) => onAddTodo(book.folder, t) : undefined}
          timer={(variant) => <PomodoroTimer source={source} index={view} variant={variant} onLogged={foldNotes} onLog={source.commit && !oldSaving() ? onLog : undefined} />}
          codexNow={book ? (n) => codexNow(view, book, n, note.path) : undefined}
          codex={book ? codexFor(view, book) : []} braindump={book && book.braindump ? view.notes[book.braindump] || null : null}
          sceneNotes={book ? sceneNotesFor(view.notes, book.folder, String(note.data.id || '')) : null}
          fillJobs={book && note.data.id ? fillJobsFor(jobNotes(view), String(note.data.id), book.folder) : []}
          optionJobs={book && note.data.id ? optionJobsFor(jobNotes(view), String(note.data.id), book.folder) : []}
          checkOpts={book ? checkOptionsFor(view, book.folder) : undefined}
          convo={book && note.data.id ? conversation(view, String(note.data.id), book.folder) : null}
          plan={book ? planFor(view.notes, book.folder, typeof note.data.chapter === 'number' ? note.data.chapter : null) : null}
          scrap={book ? scrapFor(view.notes, book.folder, typeof note.data.chapter === 'number' ? note.data.chapter : null) : null}
          chapterBeats={book ? beatsNoteFor(view.notes, book.folder, typeof note.data.chapter === 'number' ? note.data.chapter : null) : null}
          recipes={recipeNotes(view).map(recipeName)}
          flow={book ? { results: flowResults(view, book), href: href.flow(book.folder) } : undefined}
          changes={book ? { note: changesNoteFor(view.notes, book.folder, chapter), asking: chapter != null && Boolean(openJobFor(jobNotes(view).filter((j) => String(j.data.book || '') === book.folder), 'revise', 'Chapter ' + chapter)), book: chapterChanges(view.notes, book.folder, (ch) => { const g = groups.find((x) => x.num === ch); return g && g.scenes.length ? g.scenes[0].path : null; }), like: (pairs) => countLike(view.notes, book.folder, pairs) } : undefined}
          rewrite={book ? { files: book.rewrite || [], done: rewriteDone(view.notes[book.path]), onThrough: source.write ? (ch, done) => onRewriteThrough(book, ch, done) : undefined } : null}
          drafts={book ? {
            saved: book.drafts || [],
            onSave: async () => {
              if (!source.write) return 'Saving a draft needs your own vault, not the demo.';
              if (!navigator.onLine) return 'Connect to the internet to save a draft.';
              try {
                await saveDraft(book);
                await runSync();
                return null;
              } catch (e) { return (e as Error).message; }
            },
            onExport: async (n) => {
              try {
                const notes = { ...view.notes };
                const d = n == null ? null : (book.drafts || []).find((x) => x.number === n);
                if (n != null && !d) return 'Draft ' + n + ' is not in the vault.';
                // A saved draft: each scene's words as its copy holds them; a scene the draft did not have is left out.
                if (d) for (const p of book.scenes) {
                  const s = view.notes[p];
                  if (!s) continue;
                  const f = copyFor(d, s);
                  notes[p] = f ? { ...makeNote(p, f.sha, await source.read(f.path, f.sha)), path: p } : { ...s, body: '' };
                }
                const m = manuscript(schema, { ...view, notes }, book);
                if (!m.scenes) return 'This draft has no written scenes, so there is nothing to export.';
                const data = view.notes[book.path] ? view.notes[book.path].data : {};
                const working = (book.drafts || []).reduce((x, y) => Math.max(x, y.number), 0) + 1;
                const name = exportName(book).replace(/\.docx$/, '_Draft ' + (n == null ? working : n) + '.docx');
                downloadWord(buildDocx(book.title, typeof data.author === 'string' ? data.author : '', m) as Uint8Array<ArrayBuffer>, name);
                return null;
              } catch (e) { return 'The Word file could not be made: ' + (e as Error).message; }
            }
          } : undefined}
          backTo={book ? href.book(book.folder) : href.note(route.path)} onSaved={(n) => { foldNotes([n]); }} onChanged={runSync} />
      );
    }
  }

  if (route.name === 'chapter' && view && schema) {
    const note = view.notes[route.path];
    const book = note ? view.books.find((b) => route.path.startsWith(b.folder + '/')) : null;
    const group = book ? chapterGroups(schema, book.scenes.map((p) => view.notes[p]).filter(Boolean)).find((g) => g.scenes.some((n) => n.path === route.path)) : null;
    if (book && group) {
      return <ChapterPage key={group.key + ':' + book.folder} source={source} group={group} bookTitle={book.title} codex={codexFor(view, book)} startAt={route.path}
        checkOpts={checkOptionsFor(view, book.folder)}
        backTo={href.book(book.folder)} onSaved={(n) => { foldNotes([n]); }} timer={<PomodoroTimer source={source} index={view} variant="bar" onLogged={foldNotes} onLog={source.commit && !oldSaving() ? onLog : undefined} />} />;
    }
  }

  const drafts = pendingCount(source.key);
  let body;
  if (route.name === 'settings') {
    body = <SettingsScreen settings={settings} onSave={onSave} onForget={onForget} />;
  } else if (!snap || !schema || !view) {
    body = <p class="empty">{!loaded || syncing ? 'Loading the vault…' : 'Nothing saved yet. Connect to the internet and press Sync.'}</p>;
  } else if (route.name === 'write' || route.name === 'chapter' || route.name === 'beats') {
    body = <p class="empty">That scene is not in the saved copy. Press Sync, then try again.</p>;
  } else if (route.name === 'jobs') {
    body = <JobsScreen index={view} waiting={waiting} onDecide={source.write ? onDecide : undefined} syncing={syncing} />;
  } else if (route.name === 'chat') {
    body = <ChatScreen index={view} thread={route.thread} book={route.book} onChat={source.write ? onChat : undefined}
      onDecide={source.write ? onDecide : undefined} waiting={waiting} demo={source instanceof DemoSource} />;
  } else if (route.name === 'todo') {
    body = <TodoList index={view} waiting={waiting} onDecide={onDecide} onAdd={source.write ? onAddTask : undefined}
      schema={schema} book={activeBook(view)} onRewrite={source.write ? onRewrite : undefined} />;
  } else if (route.name === 'team') {
    body = route.slug ? <MemberPage source={source} index={view} schema={schema} slug={route.slug} canTalk={Boolean(source.write)} />
      : <TeamScreen source={source} index={view} schema={schema} canTalk={Boolean(source.write)}
        extra={<ForgeSpecialist onJob={source.write ? onJob : undefined} book={(activeBook(view) || view.books[0] || { folder: '' }).folder} />} />;
  } else if (route.name === 'skills') {
    body = <SkillsScreen index={view} skill={route.skill} />;
  } else if (route.name === 'history') {
    body = <HistoryScreen source={source} index={view} who={route.who} />;
  } else if (route.name === 'workflow') {
    body = <WorkflowScreen index={view} step={route.step} onNote={source.write && source.readFresh ? onWorkflowNote : undefined} />;
  } else if (route.name === 'recipes') {
    body = <RecipesScreen index={view} onAdd={source.write ? onAddRecipe : undefined} onSave={source.write && source.readFresh ? onSaveRecipe : undefined} />;
  } else if (route.name === 'flow') {
    const book = view.books.find((b) => b.folder === route.folder);
    if (!book) body = <p class="empty">That book is not in the vault. <a href={href.books()}>See all books</a>.</p>;
    else {
      body = <FlowScreen index={view} book={book} stage={route.stage} step={route.step} sourceKey={source.key} waiting={waiting}
        onJob={source.write ? onJob : undefined} onDecide={source.write ? onDecide : undefined} onResults={source.write ? onResults : undefined} />;
    }
  } else if (route.name === 'note' && view.notes[route.path] && view.notes[route.path].type === 'session') {
    body = <SessionView index={view} note={view.notes[route.path]} />;
  } else if (route.name === 'note') {
    const n = view.notes[route.path];
    const nb = n && n.type === 'character' ? view.books.find((b) => route.path.startsWith(b.folder + '/')) || activeBook(view) : null;
    const who = n ? String(n.data.name || n.data.title || '').trim() : '';
    body = (
      <>
        <NoteView schema={schema} index={view} path={route.path} />
        {nb && who && <FromTheWorkflow index={view} book={nb} names={[who].concat(nameList(n.data.aliases))} title={who} onResults={source.write ? onResults : undefined} />}
      </>
    );
  } else if (route.name === 'series') {
    body = route.folder ? <SeriesPage source={source} index={view} folder={route.folder} onCreateBook={source.write ? onCreateBook : undefined} />
      : <Home source={source} index={view} series onCreateSeries={source.write ? onCreateSeries : undefined} onCreateBook={source.write ? onCreateBook : undefined} />;
  } else if (route.name === 'ideas' || route.name === 'book' || route.name === 'board') {
    const book = view.books.find((b) => b.folder === route.folder);
    const boardKey = route.name === 'board' ? route.board : route.name === 'ideas' ? 'ideas' : 'chapter-grid';
    if (!book) body = <p class="empty">That book is not in the vault. <a href={href.books()}>See all books</a>.</p>;
    else {
      let screen;
      if (CODEX_PAGES[boardKey]) screen = <CodexBoard schema={schema} index={view} book={book} board={boardKey} />;
      else if (boardKey === 'details') screen = <BookDetails source={source} schema={schema} index={view} book={book} onFiles={source.commit && !oldSaving() ? onFiles : undefined} onMatter={source.commit && !oldSaving() ? onWords : undefined} onCover={source.writeBytes ? onCover : undefined} onDecide={source.write ? onDecide : undefined} />;
      else if (boardKey === 'decide') screen = <DecideQueue index={view} book={book} onDecide={source.write ? onDecide : undefined} />;
      else if (boardKey === 'chapter-titles') screen = <ChapterTitlesPage source={source} index={view} book={book} onChange={source.commit && !oldSaving() ? onTitles : undefined} groups={chapterGroups(schema, book.scenes.map((p) => view.notes[p]).filter(Boolean))} onRename={source.write ? onRenameChapter : undefined} />;
      else if (boardKey === 'story-calls') screen = <DecideQueue index={view} book={book} onDecide={source.write ? onDecide : undefined} calls />;
      else if (boardKey === 'changes') screen = <ChangesOverview book={book} chapters={chapterChanges(view.notes, book.folder, (ch) => { const g = chapterGroups(schema, book.scenes.map((p) => view.notes[p]).filter(Boolean)).find((x) => x.num === ch); return g && g.scenes.length ? g.scenes[0].path : null; })}
        calls={decideQueue(view, book).filter(isStoryCall).length} firstScene={book.scenes[0] || null}
        rewrite={rewriteProgress(book.rewrite || [], book.scenes.map((p) => view.notes[p]).filter(Boolean), rewriteDone(view.notes[book.path]))} />;
      else if (boardKey === 'matrix') screen = <MatrixBoard schema={schema} index={view} book={book} />;
      else if (boardKey === 'overview') {
        const scenesOf = book.scenes.map((p) => view.notes[p]).filter(Boolean);
        const keepFor = (path: string) => {
          const rn = view.notes[path];
          const named = rn ? sceneLabel(scenesOf, rn) : null;
          return rn && named ? { title: named.chapter || named.scene || 'Your scene',
            where: [named.chapter ? named.scene : '', typedWords(rn).toLocaleString('en-US') + ' words'].filter(Boolean).join(' · ') } : null;
        };
        screen = <OverviewPage schema={schema} index={view} book={book} sourceKey={source.key} keepFor={keepFor} onJob={source.write ? onJob : undefined} onDecide={source.write ? onDecide : undefined} />;
      }
      else if (boardKey === 'notes') screen = <NotesScreen index={view} book={book} waiting={waiting} onDecide={source.write ? onDecide : undefined} onAdd={source.write ? onAddNote : undefined} />;
      else if (boardKey === 'sessions') screen = <SessionsScreen index={view} book={book} />;
      else if (SEEING_BOARDS.indexOf(boardKey) >= 0) screen = <SeeingBoard board={boardKey} schema={schema} index={view} book={book} onDecide={source.write ? onDecide : undefined} />;
      else if (boardKey === 'ideas') screen = <IdeasBoard schema={schema} index={view} book={book} waiting={waiting} onDecide={onDecide} onJob={source.write ? onJob : undefined} />;
      else if (boardKey === 'taste') screen = <TastePage source={source} index={view} book={book} onJob={source.write ? onJob : undefined} />;
      else if (boardKey === 'tension') screen = <TensionBoard schema={schema} index={view} book={book} onDecide={source.write ? onDecide : undefined} waiting={waiting} />;
      else if (boardKey === 'arcs') screen = <ArcsBoard index={view} book={book} onDecide={source.write ? onDecide : undefined} waiting={waiting} />;
      else if ((STORY_BOARDS as readonly string[]).indexOf(boardKey) >= 0) {
        screen = <StoryBoardScreen schema={schema} index={view} book={book} waiting={waiting} onDecide={onDecide} board={boardKey as StoryBoard} onAddRocket={source.write ? onAddRocket : undefined} onRewrite={source.write ? onRewrite : undefined} />;
      } else if (boardKey === 'chapter-grid') {
        screen = <ChapterGrid schema={schema} index={view} book={book} waiting={waiting} onDecide={onDecide} onAdd={source.write ? onAddScene : undefined}
          onAddMany={source.write ? onAddMany : undefined} onMove={source.write ? onMove : undefined}
          source={source} onJob={source.write ? onJob : undefined}
          onRename={source.remove ? onRename : undefined} onImport={source.write ? onImport : undefined} />;
      }
      else screen = <p class="empty">The app has no {boardKey} board yet. <a href={href.book(book.folder)}>Back to the Chapter Grid</a>.</p>;
      body = screen;
    }
  } else {
    body = <Home source={source} index={view} series={false} onCreateSeries={source.write ? onCreateSeries : undefined} onCreateBook={source.write ? onCreateBook : undefined} />;
  }

  // The top bar shows the boards of the book on screen, or else of the active book.
  const navBook = view
    ? (route.name === 'book' || route.name === 'ideas' || route.name === 'board' || route.name === 'flow' ? view.books.find((b) => b.folder === route.folder) : null) ||
      (route.name === 'note' ? view.books.find((b) => route.path.startsWith(b.folder + '/')) : null) ||
      (route.name === 'home' || route.name === 'books' || route.name === 'series' ? null : activeBook(view))
    : null;
  const at = route.name === 'team' ? href.team(route.slug) : route.name === 'skills' ? href.skills(route.skill) : route.name === 'history' ? href.history(route.who) : '';
  const boardKey = route.name === 'board' ? route.board : route.name === 'ideas' ? 'ideas'
    : route.name === 'book' ? 'chapter-grid' : '';

  // The sync line, the waiting choices and drafts, shrunk to one button in the top bar. Pressing it syncs.
  const waitingText = [
    waitingN ? (online ? 'Saving ' + (waitingN === 1 ? '1 change' : waitingN + ' changes') + '.' : (waitingN === 1 ? '1 change is saved on this device and goes' : waitingN + ' changes are saved on this device and go') + ' up when you are back online.') : '',
    drafts ? (drafts === 1 ? 'Writing in 1 scene is' : 'Writing in ' + drafts + ' scenes is') + ' saved on this device' + (online ? '. Press to send it to the vault.' : ' and goes up when you are back online.') : ''
  ].filter(Boolean).join(' ');
  const syncLine = syncing ? 'Syncing…' : !online ? 'Offline. Showing the copy saved ' + (snap ? timeAgo(snap.lastSync) : 'never') + '.' : snap ? 'Synced ' + timeAgo(snap.lastSync) + '. Press to sync again.' : 'Not synced yet.';
  const chip = syncing ? 'Syncing…' : !online ? 'Offline' : waitingN ? 'Saving ' + waitingN + '…' : drafts ? drafts + ' waiting' : snap ? 'Synced' : 'Sync';

  const place = route.name === 'home' || route.name === 'books' ? 'home' : route.name === 'series' ? 'series'
    : route.name === 'chat' || route.name === 'jobs' || route.name === 'todo' || route.name === 'settings'
      || route.name === 'team' || route.name === 'skills' || route.name === 'history' || route.name === 'recipes' || route.name === 'workflow' ? route.name : '';
  const PLACE_TITLE: Record<string, string> = { home: 'Books', series: 'Series', chat: 'Chat with the team', jobs: 'Jobs', todo: 'To-do', settings: 'Settings',
    team: 'The team', skills: 'Skills', history: 'Session history', recipes: 'Recipes', workflow: 'Workflow' };
  const navLink = navBook && schema && boardKey ? boardLinks(schema, navBook.folder).find((l) => l.key === boardKey) : null;
  const pageTitle = PLACE_TITLE[place] || (navBook ? navBook.title + (navLink ? ' · ' + navLink.title : route.name === 'flow' ? ' · Workflow' : '') : 'Sparrow');
  const syncGood = Boolean(snap && !syncing && online && !waitingN && !drafts);

  // The team column: on every page but Settings and the Chat screen, with what is on screen sent along with each message.
  const sideBook = view ? navBook || activeBook(view) : null;
  const WHERE: Record<string, string> = { home: 'the Books page', series: 'the Series page', jobs: 'the Jobs page', todo: 'the To-do list',
    team: 'the Team page', skills: 'the Skills page', history: 'Session history', recipes: 'the Recipes page', workflow: 'the Workflow page' };
  const where = navLink ? 'the ' + navLink.title + ' board' : WHERE[place] || (route.name === 'note' ? 'a note' : route.name === 'flow' ? 'Workflow mode' : 'this page');
  const pageView = (): PageView => {
    const v: PageView = { name: where, book: sideBook };
    if (!view) return v;
    const notesOf = (paths?: string[]) => (paths || []).map((p) => view.notes[p]).filter(Boolean);
    if (navBook && boardKey) {
      if (boardKey === 'ideas') { const pl = piles(notesOf(navBook.ideas)); v.notes = PILES.flatMap((x) => pl[x.key] || []); }
      else if (boardKey === 'chapter-grid') v.notes = notesOf(navBook.scenes).filter((n) => n.data.kind !== 'test');
      else if (boardKey === 'matrix') v.notes = castFor(view, navBook).map((c) => c.note);
      else if (boardKey === 'tension') v.notes = notesOf(navBook.scenes).filter((n) => n.data.kind !== 'test');
      else if (boardKey === 'arcs') v.notes = castFor(view, navBook).map((c) => c.note);
      else if ((STORY_BOARDS as readonly string[]).indexOf(boardKey) >= 0) v.notes = boardNotes(view, navBook, boardKey as StoryBoard);
    } else if (route.name === 'note') {
      const n = view.notes[route.path];
      if (n) {
        v.notes = [n];
        const body = n.body.replace(/\s+/g, ' ').trim();
        if (body) v.lines = ['The note begins: ' + (body.length > 500 ? body.slice(0, 500) + '…' : body)];
      }
    } else if (route.name === 'team' && route.slug) v.lines = ['Looking at the team member: ' + route.slug];
    else if (route.name === 'skills' && route.skill) v.lines = ['Looking at the skill: ' + route.skill];
    else if (route.name === 'flow') v.lines = ['In Workflow mode' + (route.step ? ', on step ' + route.step : route.stage ? ', on stage ' + route.stage : ', on its home') + ' of the workflow (System/Workflow.md). Results are idea notes with `step`; Kyle keeps, puts off or drops them.'];
    else if (route.name === 'workflow') v.lines = ['Looking at the workflow (System/Workflow.md)' + (route.step ? ', step ' + route.step : '') + '. Kyle may want to judge or change a step: answer about the workflow, and propose changes as a note, never by editing it.'];
    else if (route.name === 'series' && route.folder) v.lines = ['Looking at the series: `' + route.folder + '`'];
    return v;
  };
  const showSide = Boolean(view) && place !== 'chat' && place !== 'settings';
  const side = showSide && view ? (close: () => void) => {
    return <TeamSide index={view} sourceKey={source.key} book={sideBook ? sideBook.folder : ''} page={pageContext(pageView())}
      onChat={source.write ? onChat : undefined} onClose={close} />;
  } : null;

  return (
    <Shell source={source} schema={schema} index={view} book={navBook} board={boardKey} place={place} at={at} demo={source instanceof DemoSource} title={pageTitle} side={side}
      timer={(where) => <PomodoroTimer source={source} index={view} variant={where} onLogged={foldNotes} onLog={source.commit && !oldSaving() ? onLog : undefined} />}
      sync={{ label: chip, title: syncLine + (waitingText ? ' ' + waitingText : ''), good: syncGood, warn: !online || drafts > 0, busy: syncing || !online, onSync: runSync }}>
      {(error || notice || (!online && (waitingN > 0 || drafts > 0))) && (
        <div class="banner" role="status">
          {notice && <p class="notice"><span>{notice}</span> <button type="button" onClick={() => setNotice(null)}>OK</button></p>}
          {!online && waitingText && <p class="waiting">{waitingText}</p>}
          {error && <p class="error">{error}</p>}
        </div>
      )}
      <main>{body}</main>
    </Shell>
  );
}

/** What Check (AI phrases) takes from the vault: the book's Style Guide and the vault's Config, as sf lint does. */
function checkOptionsFor(view: VaultIndex, bookFolder: string) {
  const guide = view.notes[bookFolder + '/Style Guide.md'];
  const config = view.notes['System/Config.md'];
  return checkOptions(guide ? guide.data : null, config ? config.data : null);
}
