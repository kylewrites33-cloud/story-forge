import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { readSnapshot, writeSnapshot, clearSnapshots } from '../lib/cache.ts';
import { DemoSource } from '../lib/demo-source.ts';
import { timeAgo } from '../lib/format.ts';
import { GitHubSource } from '../lib/github.ts';
import { parseSchema } from '../lib/schema.ts';
import { isConnected, loadSettings, saveSettings, type Settings } from '../lib/settings.ts';
import { sync } from '../lib/sync.ts';
import type { Schema, Snapshot, VaultSource } from '../lib/types.ts';
import { activeBook } from '../lib/vault-index.ts';
import { href, useRoute } from './route.ts';
import { BookList, ChapterGrid, NoteView } from './screens.tsx';
import { SettingsScreen } from './SettingsScreen.tsx';

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

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const next = await sync(source, snapRef.current && snapRef.current.key === source.key ? snapRef.current : null);
      setSnap(next);
      setError(null);
      await writeSnapshot(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [source]);

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

  const onSave = (s: Settings) => setSettings(saveSettings(s));
  const onForget = async () => {
    await clearSnapshots();
    setSnap(null);
    setSettings(saveSettings({ ...settings, token: '' }));
  };

  let body;
  if (route.name === 'settings') {
    body = <SettingsScreen settings={settings} onSave={onSave} onForget={onForget} />;
  } else if (!snap || !schema) {
    body = <p class="empty">{!loaded || syncing ? 'Loading the vault…' : 'Nothing saved yet. Connect to the internet and tap Sync.'}</p>;
  } else if (route.name === 'note') {
    body = <NoteView schema={schema} index={snap.index} path={route.path} />;
  } else if (route.name === 'book') {
    const book = snap.index.books.find((b) => b.folder === route.folder);
    body = book ? <ChapterGrid schema={schema} index={snap.index} book={book} /> : <p class="empty">That book is not in the vault. <a href={href.books()}>See all books</a>.</p>;
  } else {
    const active = route.name === 'home' ? activeBook(snap.index) : null;
    body = active ? <ChapterGrid schema={schema} index={snap.index} book={active} /> : <BookList index={snap.index} />;
  }

  return (
    <>
      <header class="top">
        <a class="brand" href="#/">Story Forge</a>
        <nav>
          <a href={href.books()} aria-current={route.name === 'books' ? 'page' : undefined}>Books</a>
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
        {error && <p class="error">{error}</p>}
      </div>
      <main>{body}</main>
    </>
  );
}
