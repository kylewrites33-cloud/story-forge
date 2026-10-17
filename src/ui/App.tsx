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
import { createScene, mentionsOf, orderBetween } from '../lib/scenes.ts';
import type { BookEntry, NoteRecord, Schema, Snapshot, VaultIndex, VaultSource } from '../lib/types.ts';
import { activeBook, resortScenes } from '../lib/vault-index.ts';
import { flushDrafts, pendingCount } from '../lib/drafts.ts';
import { enqueue, flush, loadQueue, overlay, sameSlot, saveQueue, type Choice } from '../lib/write-queue.ts';
import { IdeasBoard } from './IdeasBoard.tsx';
import { STORY_BOARDS, type StoryBoard } from '../lib/boards.ts';
import { BoardNav, StoryBoardScreen } from './StoryBoards.tsx';
import { href, useRoute } from './route.ts';
import { BookList, ChapterGrid, NoteView } from './screens.tsx';
import { SettingsScreen } from './SettingsScreen.tsx';
import { Editor } from './Editor.tsx';

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
  const [online, setOnline] = useState(navigator.onLine);
  const [, tick] = useState(0);
  const snapRef = useRef<Snapshot | null>(null);
  snapRef.current = snap;
  const [queue, setQueueState] = useState<Choice[]>(() => loadQueue(source.key));
  const queueRef = useRef<Choice[]>(queue);
  const flushing = useRef(false);

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
  }, [source, runFlush, foldNotes]);

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
        new Date(), 'Added in the Story Forge app.');
      await runSync();
      location.hash = href.write(made.path);
      return null;
    } catch (e) {
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

  const onDecide = useCallback((path: string, decision: Decision, reason: string) => {
    setQueue(enqueue(queueRef.current, { path, decision, reason, at: new Date().toISOString() }));
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
    const timer = setInterval(() => tick((n) => n + 1), 60000);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      document.removeEventListener('visibilitychange', visible);
      clearInterval(timer);
    };
  }, [runSync]);

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

  // The writing screen fills the page: no menu or sync bar.
  if (route.name === 'write' && view) {
    const note = view.notes[route.path];
    if (note) {
      const book = view.books.find((b) => route.path.startsWith(b.folder + '/')) || null;
      const at = book ? book.scenes.indexOf(route.path) : -1;
      const next = book && at >= 0 && at + 1 < book.scenes.length ? view.notes[book.scenes[at + 1]] || null : null;
      return (
        <Editor key={route.path} source={source} note={note} next={next}
          nextMentions={book && next && next.data.id ? mentionsOf(Object.values(view.notes).filter((n) => n.path.startsWith(book.folder + '/')), String(next.data.id || '')) : []}
          bookFolder={book ? book.folder : null}
          backTo={href.note(route.path)} onSaved={(n) => { foldNotes([n]); }} onChanged={runSync} />
      );
    }
  }

  const drafts = pendingCount(source.key);
  let body;
  if (route.name === 'settings') {
    body = <SettingsScreen settings={settings} onSave={onSave} onForget={onForget} />;
  } else if (!snap || !schema || !view) {
    body = <p class="empty">{!loaded || syncing ? 'Loading the vault…' : 'Nothing saved yet. Connect to the internet and press Sync.'}</p>;
  } else if (route.name === 'write') {
    body = <p class="empty">That scene is not in the saved copy. Press Sync, then try again.</p>;
  } else if (route.name === 'note') {
    body = <NoteView schema={schema} index={view} path={route.path} />;
  } else if (route.name === 'ideas' || route.name === 'book' || route.name === 'board' || (route.name === 'home' && activeBook(view))) {
    const book = route.name === 'home' ? activeBook(view) : view.books.find((b) => b.folder === route.folder);
    const boardKey = route.name === 'board' ? route.board : route.name === 'ideas' ? 'ideas' : 'chapter-grid';
    if (!book) body = <p class="empty">That book is not in the vault. <a href={href.books()}>See all books</a>.</p>;
    else {
      let screen;
      if (boardKey === 'ideas') screen = <IdeasBoard schema={schema} index={view} book={book} waiting={waiting} onDecide={onDecide} />;
      else if ((STORY_BOARDS as readonly string[]).indexOf(boardKey) >= 0) {
        screen = <StoryBoardScreen schema={schema} index={view} book={book} waiting={waiting} onDecide={onDecide} board={boardKey as StoryBoard} onAddRocket={source.write ? onAddRocket : undefined} />;
      } else if (boardKey === 'chapter-grid') {
        screen = <ChapterGrid schema={schema} index={view} book={book} waiting={waiting} onDecide={onDecide} onAdd={source.write ? onAddScene : undefined} onMove={source.write ? onMove : undefined} />;
      }
      else screen = <p class="empty">The app has no {boardKey} board yet. <a href={href.book(book.folder)}>Back to the Chapter Grid</a>.</p>;
      body = <><BoardNav schema={schema} book={book} current={boardKey} />{screen}</>;
    }
  } else {
    body = <BookList index={view} />;
  }

  // The Ideas tab opens the book on screen, or else the active book.
  const ideasBook = view
    ? (route.name === 'book' || route.name === 'ideas' || route.name === 'board' ? view.books.find((b) => b.folder === route.folder) : null) ||
      (route.name === 'note' ? view.books.find((b) => route.path.startsWith(b.folder + '/')) : null) || activeBook(view)
    : null;

  return (
    <>
      <header class="top">
        <a class="brand" href="#/">Story Forge</a>
        <nav>
          <a href={href.books()} aria-current={route.name === 'books' ? 'page' : undefined}>Books</a>
          {ideasBook && <a href={href.ideas(ideasBook.folder)} aria-current={route.name === 'ideas' ? 'page' : undefined}>Ideas</a>}
          <a href={href.settings()} aria-current={route.name === 'settings' ? 'page' : undefined}>Settings</a>
        </nav>
      </header>
      <div class="banner" role="status">
        {source instanceof DemoSource && (
          <p class="demo">This is the demo vault. <a href={href.settings()}>Add your token in Settings</a> to see your own books.</p>
        )}
        <p class="sync">
          <span>
            {syncing ? 'Syncing…' : !online ? 'Offline. Showing the copy saved ' + (snap ? timeAgo(snap.lastSync) : 'never') + '.' : snap ? 'Synced ' + timeAgo(snap.lastSync) + '.' : 'Not synced yet.'}
          </span>
          <button type="button" onClick={runSync} disabled={syncing || !online}>Sync</button>
        </p>
        {queue.length > 0 && (
          <p class="waiting">
            {online
              ? 'Saving ' + (queue.length === 1 ? '1 choice' : queue.length + ' choices') + '…'
              : (queue.length === 1 ? '1 choice is' : queue.length + ' choices are') + ' saved on this device and go up when you are back online.'}
          </p>
        )}
        {drafts > 0 && (
          <p class="waiting">
            {(drafts === 1 ? 'Writing in 1 scene is' : 'Writing in ' + drafts + ' scenes is') + ' saved on this device' + (online ? '. Press Sync to send it to the vault.' : ' and goes up when you are back online.')}
          </p>
        )}
        {error && <p class="error">{error}</p>}
      </div>
      <main>{body}</main>
    </>
  );
}
