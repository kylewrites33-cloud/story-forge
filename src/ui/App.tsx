import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { readSnapshot, writeSnapshot, clearSnapshots } from '../lib/cache.ts';
import { DemoSource } from '../lib/demo-source.ts';
import { timeAgo } from '../lib/format.ts';
import { GitHubSource } from '../lib/github.ts';
import { parseSchema } from '../lib/schema.ts';
import { isConnected, loadSettings, saveSettings, type Settings } from '../lib/settings.ts';
import { sync } from '../lib/sync.ts';
import type { Decision } from '../lib/ideas.ts';
import { addRocketFile, rocketProblem } from '../lib/market.ts';
import { createTask, type NewTask } from '../lib/tasks.ts';
import { bookTodos, createTodo, type NewTodo } from '../lib/todos.ts';
import { createJob, defaultJobTitle, jobLabel, jobNotes, openJobFor, type NewJob } from '../lib/jobs.ts';
import { createScene, mentionsOf, orderBetween, renameScene, sceneNotesFor } from '../lib/scenes.ts';
import { applyShifts, chapterMove, chapterShifts, chapterTitleEdits, makeRoom } from '../lib/chapters.ts';
import { createBook, createSeries, fileBase64, manuscriptPath, manuscriptProblem } from '../lib/books.ts';
import { jobAsk } from '../lib/jobs.ts';
import { loadDrafts, typedWords } from '../lib/drafts.ts';
import type { BookEntry, NoteRecord, Schema, Snapshot, VaultIndex, VaultSource } from '../lib/types.ts';
import { activeBook, resortScenes } from '../lib/vault-index.ts';
import { chapterGroups } from '../lib/board.ts';
import { Icon } from './Icon.tsx';
import { flushDrafts, loadNotice, pendingCount, saveNotice } from '../lib/drafts.ts';
import { enqueue, flush, loadQueue, overlay, sameSlot, saveQueue, type Choice } from '../lib/write-queue.ts';
import { IdeasBoard } from './IdeasBoard.tsx';
import { TastePage } from './Taste.tsx';
import { boardNotes, castFor, STORY_BOARDS, type StoryBoard } from '../lib/boards.ts';
import { boardLinks, StoryBoardScreen } from './StoryBoards.tsx';
import { keepWriting, Shell } from './Shell.tsx';
import { CodexBoard } from './Codex.tsx';
import { DecideQueue } from './Decide.tsx';
import { CODEX_PAGES } from '../lib/rooms.ts';
import { href, parseHash, useRoute } from './route.ts';
import { ChapterGrid, NoteView } from './screens.tsx';
import { BookDetails, Home, SeriesPage } from './Home.tsx';
import { makeBackupFolder } from '../lib/docx.ts';
import { coverProblem, saveCover, shrinkToJpeg } from '../lib/covers.ts';
import { noteRecent } from '../lib/home.ts';
import { SettingsScreen } from './SettingsScreen.tsx';
import { Editor } from './Editor.tsx';
import { PomodoroTimer } from './Pomodoro.tsx';
import { TodoList } from './TodoList.tsx';
import { JobsScreen } from './Jobs.tsx';
import { codexFor } from '../lib/codex.ts';
import { ChapterPage } from './ChapterPage.tsx';
import { beatsNoteFor } from '../lib/beats.ts';
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
import { createNote, type NewNote } from '../lib/notes.ts';
import { createRecipe, recipeName, recipeNotes, saveRecipe, type RecipeFields } from '../lib/recipes.ts';
import { OverviewPage } from './Overview.tsx';
import { NotesScreen } from './NotesToTeam.tsx';
import { SessionsScreen, SessionView } from './Sessions.tsx';
import { RecipesScreen } from './Recipes.tsx';
import { WorkflowScreen } from './Workflow.tsx';
import { addWorkflowNote, WORKFLOW_PATH } from '../lib/workflow.ts';
import { ForgeSpecialist } from './Forge.tsx';
import { FlowScreen, FromTheWorkflow } from './Flow.tsx';
import { createResults, flowResults, type NewResult } from '../lib/flow.ts';
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
  const [queue, setQueueState] = useState<Choice[]>(() => loadQueue(source.key));
  const queueRef = useRef<Choice[]>(queue);
  const flushing = useRef(false);
  const lastOpened = useRef('');

  const setQueue = useCallback((list: Choice[]) => {
    queueRef.current = list;
    setQueueState(list);
    saveQueue(source.key, list);
  }, [source]);

  useEffect(() => { setQueue(loadQueue(source.key)); }, [source, setQueue]);

  /** Put notes the app just saved into the saved copy, so every screen shows them before the next sync. */
  const foldNotes = useCallback(async (saved: NoteRecord[]) => {
    const cur = snapRef.current;
    if (!saved.length || !cur || cur.key !== source.key) return;
    const notes = { ...cur.index.notes };
    saved.forEach((n) => { notes[n.path] = n; });
    const next = { ...cur, index: resortScenes({ ...cur.index, notes }) };
    snapRef.current = next;
    setSnap(next);
    await writeSnapshot(next);
  }, [source]);

  /** Send waiting choices to GitHub, then fold the saved notes into the saved copy. */
  const runFlush = useCallback(async (): Promise<string | null> => {
    if (flushing.current || !queueRef.current.length || !navigator.onLine) return null;
    flushing.current = true;
    try {
      const sent = queueRef.current;
      const res = await flush(source, sent);
      // Choices made while saving stay in the queue; a newer choice on the same idea replaces what was sent.
      const later = queueRef.current.filter((c) => sent.indexOf(c) < 0);
      let left = res.left.filter((c) => !later.some((x) => sameSlot(x, c)));
      left = later.reduce(enqueue, left);
      setQueue(left);
      if (res.error) setError(res.error);
      await foldNotes(res.saved);
      if (left.some((c) => later.indexOf(c) >= 0)) setTimeout(() => runFlushRef.current(), 0);
      return res.error;
    } finally {
      flushing.current = false;
    }
  }, [source, setQueue, foldNotes]);
  const runFlushRef = useRef(runFlush);
  runFlushRef.current = runFlush;

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const written = await flushDrafts(source, source.key, new Date());
      await foldNotes(written.saved);
      if (written.notice) setNotice(written.notice);
      const saveError = (await runFlush()) || written.error;
      const next = await sync(source, snapRef.current && snapRef.current.key === source.key ? snapRef.current : null);
      setSnap(next);
      setError(saveError);
      await writeSnapshot(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [source, runFlush, foldNotes, setNotice]);

  /** Add a scene to a book, sync so every screen has it, and open it for writing. */
  const onAddScene = useCallback(async (book: BookEntry, chapter: number | null, chapterTitle: string, title: string): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to add a scene.';
    const cur = snapRef.current;
    if (!cur) return 'Press Sync first.';
    const scenes = book.scenes.map((p) => cur.index.notes[p]).filter(Boolean);
    // After the chapter's last scene, or after the book's last scene for a new chapter.
    const inCh = scenes.filter((n) => chapter != null && n.data.chapter === chapter);
    const prev = inCh.length ? inCh[inCh.length - 1] : chapter == null || !scenes.some((n) => typeof n.data.chapter === 'number' && n.data.chapter > chapter) ? scenes[scenes.length - 1] || null : null;
    const next = prev ? scenes[scenes.indexOf(prev) + 1] || null : scenes[0] || null;
    try {
      const made = await createScene(source, { bookFolder: book.folder, title, chapter, chapterTitle, order: orderBetween(prev, next), status: 'drafted', body: '' },
        new Date(), 'Added in the Sparrow app.');
      await runSync();
      location.hash = href.write(made.path);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [source, runSync]);

  /** Add a chapter of one scene after chapter `after` (null: after the book's last chapter) and open it for writing.
   * In the middle of the book, the later chapters move up one first (Kyle, 2026-10-22). */
  const onAddChapter = useCallback(async (book: BookEntry, after: number | null, chapterTitle: string): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to add a chapter.';
    const cur = snapRef.current;
    if (!cur) return 'Press Sync first.';
    const scenes = book.scenes.map((p) => cur.index.notes[p]).filter(Boolean);
    const nums = scenes.map((n) => toNumber(n.data.chapter)).filter((n): n is number => n != null);
    const last = nums.length ? Math.max(...nums) : 0;
    const at = after == null || after >= last ? last + 1 : after + 1;
    const inCh = scenes.filter((n) => toNumber(n.data.chapter) === at - 1);
    const prev = inCh.length ? inCh[inCh.length - 1] : scenes[scenes.length - 1] || null;
    const next = prev ? scenes[scenes.indexOf(prev) + 1] || null : scenes[0] || null;
    const title = chapterTitle.trim();
    try {
      if (at <= last) await makeRoom(source, chapterShifts(cur.index.notes, book.folder, at - 1), at);
      const made = await createScene(source, { bookFolder: book.folder, title: title || 'Chapter ' + at, chapter: at, chapterTitle: title, order: orderBetween(prev, next), status: 'drafted', body: '' },
        new Date(), 'Added in the Sparrow app.');
      await runSync();
      location.hash = href.write(made.path);
      return null;
    } catch (e) {
      await runSync().catch(() => undefined);
      return (e as Error).message;
    }
  }, [source, runSync]);

  /** A card dragged to a new place on the Chapter Grid: give it an order between its new neighbours (and the chapter it went into). */
  const onMove = useCallback((book: BookEntry, path: string, chapter: number | null, chapterTitle: string, before: string | null) => {
    const cur = snapRef.current;
    if (!cur) return;
    const shown = overlay(cur.index, queueRef.current);
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
    let list = enqueue(queueRef.current, { path, decision: 'move', reason: '', at, move: { order: orderBetween(prev, next), chapter, chapterTitle } });
    // A chapter's title lives on its scenes. If the card that carried it leaves, the next scene in that chapter takes it on.
    const moved = shown.notes[path];
    const oldTitle = moved && typeof moved.data.chapter_title === 'string' ? moved.data.chapter_title : '';
    const oldCh = moved && typeof moved.data.chapter === 'number' ? moved.data.chapter : null;
    if (oldTitle && oldCh != null && oldCh !== chapter) {
      const left = rest.filter((n) => n.data.chapter === oldCh);
      if (left.length && !left.some((n) => n.data.chapter_title)) {
        const heir = left[0];
        const order = typeof heir.data.order === 'number' ? heir.data.order : orderBetween(rest[rest.indexOf(heir) - 1] || null, rest[rest.indexOf(heir) + 1] || null);
        list = enqueue(list, { path: heir.path, decision: 'move', reason: '', at, move: { order, chapter: oldCh, chapterTitle: oldTitle } });
      }
    }
    setQueue(list);
    runFlush();
  }, [setQueue, runFlush]);

  /** Save a Publisher Rocket export into the series' Market folder, then sync so the board lists it. */
  const onAddRocket = useCallback(async (book: BookEntry, file: File): Promise<{ error: boolean; text: string }> => {
    const problem = rocketProblem(file.name, file.size);
    if (problem) return { error: true, text: problem };
    if (!navigator.onLine) return { error: true, text: 'Connect to the internet to add a Rocket file.' };
    const series = snapRef.current && snapRef.current.index.series.find((s) => s.folder === book.seriesFolder);
    try {
      const path = await addRocketFile(source, book.seriesFolder, (series && series.rocket) || [], file.name, await file.text());
      await runSync();
      return { error: false, text: 'Saved ' + path.slice(path.lastIndexOf('/') + 1) + ' in the vault. Ask the team in the project chat to read it.' };
    } catch (e) {
      return { error: true, text: (e as Error).message };
    }
  }, [source, runSync]);

  /** Add a to-do to the vault's Tasks folder, then sync so the list shows it. */
  const onAddTask = useCallback(async (t: NewTask): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to add a to-do.';
    try {
      await createTask(source, t, new Date());
      await runSync();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [source, runSync]);

  /** Add a to-do beside the page: a task note in the book's own Tasks folder, then sync so the panel shows it. */
  const onAddTodo = useCallback(async (bookFolder: string, t: NewTodo): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to add a to-do.';
    try {
      const made = await createTodo(source, bookFolder, t, new Date());
      const now = snapRef.current;
      if (now && now.key === source.key) {
        const tasks = (now.index.tasks || []).filter((p) => p !== made.path).concat(made.path).sort();
        const next = { ...now, index: { ...now.index, notes: { ...now.index.notes, [made.path]: made }, tasks } };
        snapRef.current = next;
        setSnap(next);
        await writeSnapshot(next);
      }
      runSync();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [source, runSync]);

  /** Ask the team for one piece of work: write a job note into the vault's Jobs folder, then sync so the Jobs screen shows it.
   * A job of the same kind and target that GitHub has not finished yet is reported instead of made twice. */
  const onJob = useCallback(async (j: NewJob): Promise<{ error: boolean; text: string }> => {
    if (!navigator.onLine) return { error: true, text: 'Connect to the internet to ask the team.' };
    const cur = snapRef.current;
    // Fill braces may run again while one is waiting: the page only sends asks the team does not have yet.
    const open = cur && j.kind !== 'fill' ? openJobFor(jobNotes(overlay(cur.index, queueRef.current)), j.kind, j.target) : null;
    if (open) {
      const s = String(open.data.status || 'requested');
      return { error: false, text: String(open.data.id || 'A job') + ' (' + jobLabel(j.kind).toLowerCase() + (j.target ? ', ' + j.target : '') + ') is already ' + (s === 'running' ? 'being worked on' : 'waiting for GitHub') + '. See Jobs.' };
    }
    try {
      await createJob(source, j, new Date());
      await runSync();
      return { error: false, text: 'Sent to the team. GitHub runs it in a few minutes; see Jobs.' };
    } catch (e) {
      return { error: true, text: (e as Error).message };
    }
  }, [source, runSync]);

  /** Send a message in a conversation with the team: one chat job note, shown at once, then a sync in the background.
   * A conversation not started yet ('new') gets the next free chat-NNN. A message may follow one still waiting for a reply. */
  const onChat = useCallback(async (thread: string, words: string, book: string, page = ''): Promise<{ thread: string; book: string } | { error: string }> => {
    if (!navigator.onLine) return { error: 'Connect to the internet to send a message.' };
    const cur = snapRef.current;
    if (!cur) return { error: 'Press Sync first.' };
    const shown = overlay(cur.index, queueRef.current);
    const t = thread === 'new' ? nextChatThread(shown) : thread;
    if (!isThread(t)) return { error: 'That conversation has no name the team knows. Start a new conversation instead.' };
    const folder = book || (activeBook(shown) || shown.books[0] || { folder: '' }).folder;
    try {
      const made = await createJob(source, chatJob(t, words, folder, page), new Date());
      const now = snapRef.current;
      if (now && now.key === source.key) {
        const jobs = (now.index.jobs || []).filter((p) => p !== made.path).concat(made.path).sort();
        const next = { ...now, index: { ...now.index, notes: { ...now.index.notes, [made.path]: made }, jobs } };
        snapRef.current = next;
        setSnap(next);
        await writeSnapshot(next);
      }
      runSync();
      return { thread: t, book: folder };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [source, runSync]);

  /** A picture from the device becomes the book's cover: shrunk here, saved as Cover.jpg in the book's folder. */
  const onCover = useCallback(async (book: BookEntry, file: File): Promise<string | null> => {
    const problem = coverProblem(file);
    if (problem) return problem;
    if (!navigator.onLine) return 'Connect to the internet to add a cover.';
    try {
      await saveCover(source, book, await shrinkToJpeg(file));
      await runSync();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [source, runSync]);

  /** Scenes from a pasted outline, added one after another as planned scenes at the end of the book. */
  const onAddMany = useCallback(async (book: BookEntry, list: { chapter: number; chapterTitle: string; title: string }[]): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to add scenes.';
    const cur = snapRef.current;
    if (!cur) return 'Press Sync first.';
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
  }, [source, runSync]);

  const onJobRef = useRef(onJob);
  onJobRef.current = onJob;

  /** A scene card's new title: the file is renamed to match, then the boards sync. */
  const onRename = useCallback(async (note: NoteRecord, title: string): Promise<string | null> => {
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
  }, [source, runSync]);

  /** Save a manuscript from the device in the book's Research folder, unchanged, and ask the team to bring it in as scenes. */
  const onImport = useCallback(async (book: BookEntry, file: File): Promise<{ error: boolean; text: string }> => {
    const problem = manuscriptProblem(file.name, file.size);
    if (problem) return { error: true, text: problem };
    if (!navigator.onLine || !source.write) return { error: true, text: 'Connect to the internet to bring in a manuscript.' };
    try {
      const { files } = await source.tree();
      const path = manuscriptPath(book.folder, file.name, files.map((f) => f.path));
      const why = 'manuscripts: add ' + path.slice(path.lastIndexOf('/') + 1) + '\n\nAdded in the Sparrow app to bring in as scenes.';
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
  }, [source]);

  const onCreateSeries = useCallback(async (name: string, genre: string): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to start a series.';
    try { const n = await createSeries(source, name, genre, new Date()); await makeBackupFolder(source, String(n.data.name || name)); await runSync(); location.hash = href.series(n.path.slice(0, n.path.lastIndexOf('/'))); return null; } catch (e) { return (e as Error).message; }
  }, [source, runSync]);

  const onCreateBook = useCallback(async (seriesFolder: string, seriesName: string, title: string, number: number): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to start a book.';
    try { const n = await createBook(source, seriesFolder, seriesName, title, number, new Date()); await makeBackupFolder(source, seriesName, String(n.data.title || title)); await runSync(); location.hash = href.book(n.path.slice(0, n.path.lastIndexOf('/'))); return null; } catch (e) { return (e as Error).message; }
  }, [source, runSync]);

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
    if (!navigator.onLine) return 'Connect to the internet to add a note.';
    try { await createNote(source, book.folder, n, new Date()); await runSync(); return null; } catch (e) { return (e as Error).message; }
  }, [source, runSync]);
  const onAddRecipe = useCallback(async (r: RecipeFields): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to add a recipe.';
    try { await createRecipe(source, r, new Date()); await runSync(); return null; } catch (e) { return (e as Error).message; }
  }, [source, runSync]);
  const onSaveRecipe = useCallback(async (note: NoteRecord, r: RecipeFields): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to change a recipe.';
    try { await saveRecipe(source, note, r); await runSync(); return null; } catch (e) { return (e as Error).message; }
  }, [source, runSync]);

  const onWorkflowNote = useCallback(async (note: string): Promise<string | null> => {
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
  }, [source, runSync]);

  /** Workflow mode: results Kyle brought in or wrote, saved as idea notes in the book's Ideas folder, then a sync so every screen has them. */
  const onResults = useCallback(async (book: BookEntry, list: NewResult[]): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to save results.';
    if (!list.length) return 'Write or paste a result first.';
    try { await createResults(source, book.folder, list, new Date()); await runSync(); return null; } catch (e) { return (e as Error).message; }
  }, [source, runSync]);

  const onDecide = useCallback((path: string, decision: Decision, reason: string, fields?: Record<string, string>) => {
    setQueue(enqueue(queueRef.current, { path, decision, reason, at: new Date().toISOString(), ...(fields ? { fields } : {}) }));
    runFlush();
  }, [setQueue, runFlush]);

  /** Move a chapter to another number; the chapters between close up (Kyle, 2026-10-22). Then sync so the list shows it. */
  const onMoveChapter = useCallback(async (book: BookEntry, from: number, to: number): Promise<string | null> => {
    if (!navigator.onLine) return 'Connect to the internet to move a chapter.';
    const cur = snapRef.current;
    if (!cur) return 'Press Sync first.';
    const scenes = book.scenes.map((p) => cur.index.notes[p]).filter(Boolean);
    const nums = scenes.map((n) => toNumber(n.data.chapter)).filter((n): n is number => n != null);
    const last = nums.length ? Math.max(...nums) : 0;
    if (!Number.isInteger(to) || to < 1 || to > last) return 'Choose a chapter number from 1 to ' + last + '.';
    try {
      await applyShifts(source, chapterMove(cur.index.notes, book.folder, scenes, from, to), 'Chapter ' + from + ' moved to chapter ' + to + ' in the Sparrow app.');
      await runSync();
      return null;
    } catch (e) {
      await runSync().catch(() => undefined);
      return (e as Error).message;
    }
  }, [source, runSync]);

  /** Rename a chapter: its name lives on its scenes' chapter_title lines, saved through the queue like any edit. */
  const onRenameChapter = useCallback((scenes: NoteRecord[], title: string) => {
    const clean = title.replace(/\s+/g, ' ').trim();
    const at = new Date().toISOString();
    let list = queueRef.current;
    chapterTitleEdits(scenes, clean).forEach((path) => { list = enqueue(list, { path, decision: 'edit', reason: '', at, fields: { chapter_title: clean } }); });
    setQueue(list);
    runFlush();
  }, [setQueue, runFlush]);

  // Show the saved copy at once, then refresh it.
  useEffect(() => {
    let live = true;
    setLoaded(false);
    setError(null);
    readSnapshot(source.key).then((saved) => {
      if (!live) return;
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

  const view = useMemo<VaultIndex | null>(() => (snap ? overlay(snap.index, queue) : null), [snap, queue]);
  const waiting = useMemo(() => {
    const out: Record<string, Choice> = {};
    queue.forEach((c) => { out[c.path] = c; });
    return out;
  }, [queue]);

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
          onJob={book && source.write ? onJob : undefined} onChat={book && source.write ? onChat : undefined}
          todos={book ? bookTodos(view, book) : []} onTodo={source.write ? onDecide : undefined} waiting={waiting}
          onAddTodo={book && source.write ? (t) => onAddTodo(book.folder, t) : undefined}
          timer={(variant) => <PomodoroTimer source={source} index={view} variant={variant} onLogged={foldNotes} />}
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
        backTo={href.book(book.folder)} onSaved={(n) => { foldNotes([n]); }} timer={<PomodoroTimer source={source} index={view} variant="bar" onLogged={foldNotes} />} />;
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
      else if (boardKey === 'details') screen = <BookDetails source={source} schema={schema} index={view} book={book} onCover={source.writeBytes ? onCover : undefined} onDecide={source.write ? onDecide : undefined} />;
      else if (boardKey === 'decide') screen = <DecideQueue index={view} book={book} onDecide={source.write ? onDecide : undefined} />;
      else if (boardKey === 'matrix') screen = <MatrixBoard schema={schema} index={view} book={book} />;
      else if (boardKey === 'overview') {
        const resume = keepWriting(view, book, source.key);
        const rn = resume ? view.notes[resume] : null;
        const keep = rn ? { to: href.write(rn.path), title: String(rn.data.title || rn.data.headline || 'Your scene'),
          where: [rn.data.chapter != null && rn.data.chapter !== '' ? 'Chapter ' + rn.data.chapter : '', typedWords(rn).toLocaleString('en-US') + ' words'].filter(Boolean).join(' · ') } : null;
        screen = <OverviewPage schema={schema} index={view} book={book} sourceKey={source.key} keep={keep} onJob={source.write ? onJob : undefined} onDecide={source.write ? onDecide : undefined} />;
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
    queue.length ? (online ? 'Saving ' + (queue.length === 1 ? '1 choice' : queue.length + ' choices') + '.' : (queue.length === 1 ? '1 choice is' : queue.length + ' choices are') + ' saved on this device and go up when you are back online.') : '',
    drafts ? (drafts === 1 ? 'Writing in 1 scene is' : 'Writing in ' + drafts + ' scenes is') + ' saved on this device' + (online ? '. Press to send it to the vault.' : ' and goes up when you are back online.') : ''
  ].filter(Boolean).join(' ');
  const syncLine = syncing ? 'Syncing…' : !online ? 'Offline. Showing the copy saved ' + (snap ? timeAgo(snap.lastSync) : 'never') + '.' : snap ? 'Synced ' + timeAgo(snap.lastSync) + '. Press to sync again.' : 'Not synced yet.';
  const chip = syncing ? 'Syncing…' : !online ? 'Offline' : queue.length ? 'Saving ' + queue.length + '…' : drafts ? drafts + ' waiting' : snap ? 'Synced' : 'Sync';

  const place = route.name === 'home' || route.name === 'books' ? 'home' : route.name === 'series' ? 'series'
    : route.name === 'chat' || route.name === 'jobs' || route.name === 'todo' || route.name === 'settings'
      || route.name === 'team' || route.name === 'skills' || route.name === 'history' || route.name === 'recipes' || route.name === 'workflow' ? route.name : '';
  const PLACE_TITLE: Record<string, string> = { home: 'Books', series: 'Series', chat: 'Chat with the team', jobs: 'Jobs', todo: 'To-do', settings: 'Settings',
    team: 'The team', skills: 'Skills', history: 'Session history', recipes: 'Recipes', workflow: 'Workflow' };
  const navLink = navBook && schema && boardKey ? boardLinks(schema, navBook.folder).find((l) => l.key === boardKey) : null;
  const pageTitle = PLACE_TITLE[place] || (navBook ? navBook.title + (navLink ? ' · ' + navLink.title : route.name === 'flow' ? ' · Workflow' : '') : 'Sparrow');
  const syncGood = Boolean(snap && !syncing && online && !queue.length && !drafts);

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
      where={where}
      onChat={source.write ? onChat : undefined} onClose={close} />;
  } : null;

  return (
    <Shell source={source} schema={schema} index={view} book={navBook} board={boardKey} place={place} at={at} demo={source instanceof DemoSource} title={pageTitle} side={side}
      timer={(where) => <PomodoroTimer source={source} index={view} variant={where} onLogged={foldNotes} />}
      sync={{ label: chip, title: syncLine + (waitingText ? ' ' + waitingText : ''), good: syncGood, warn: !online || drafts > 0, busy: syncing || !online, onSync: runSync }}>
      {(error || notice || (!online && (queue.length > 0 || drafts > 0))) && (
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
