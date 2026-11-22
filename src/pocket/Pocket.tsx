// Sparrow Pocket's screens (2026-11-20): the chapters with cards waiting, one card at a time (use a version, Reject,
// tweak a version, tell the Writer, Undo), and the chapter as a reading page where any paragraph can be rewritten.
// Since 2026-11-21 (Kyle: "im a little worried about messing up the main app with this pocket app ... let the phone
// record my choices, and the ipad apply it when i next open it"; "no send button necessary if its automatic") every
// press only records a choice on the phone (src/pocket/vault.ts). The choices go up by themselves to the book's phone
// note, and Sparrow on the iPad puts them in with its own buttons. The pages show the chapter as it will be then.
// Write mode (2026-11-21; Kyle: "can you make a writing mode, too? so theres writing and editing? maybe we can use the
// beat mode. and i can open each beat and write in it, rewrite beat titles, and add, delete, or move beats arond"): the
// chapter by its beats, as Sparrow's Beats mode lays it out. Each press is recorded the same way.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { applyChange, answersTo, KIND_LABEL, parseChanges, shortLabel, type Change } from '../lib/changes.ts';
import { bookHtml, quoteHtml } from '../lib/cardtext.ts';
import { DemoSource } from '../lib/demo-source.ts';
import { GitHubSource } from '../lib/github.ts';
import { jobNotes } from '../lib/jobs.ts';
import { bookChapters, chapterKey, decidedOnPhone, deck, inChapter, pageText, paragraphs, phoneAliases, pocketBooks, readPlace, replaceParagraph, replayChapter, waitingInVault, type DeckCard, type Paragraph, type PocketChapter, type Replayed, type Waiting } from '../lib/pocket.ts';
import { cleanParagraph, type PhoneKind } from '../lib/phone-choices.ts';
import { beatWords, findBeat, moveTarget } from '../lib/phone-beats.ts';
import type { BeatView } from '../lib/beats.ts';
import { PREF, readJson, readPref, writeJson, writePref } from '../lib/prefs.ts';
import { isConnected, loadSettings, phoneLink, saveSettings, type Settings } from '../lib/settings.ts';
import type { BookEntry, NoteRecord, VaultIndex } from '../lib/types.ts';
import { activeBook } from '../lib/vault-index.ts';
import { propText } from '../lib/props.ts';
import { askFor, openAsk, recentProblem } from '../team/asks.ts';
import { PocketVault, type Kept } from './vault.ts';

// ---- Addresses: #/ the chapters, #/c/CH-020/C-03 a card, #/r/CH-020 the chapter, #/w/CH-020 its beats,
// #/w/CH-020/S-001-3fa9c2 one beat open, #/key the key ----
type Route = { page: 'home' } | { page: 'key' } | { page: 'cards'; ch: string; card: string } | { page: 'read'; ch: string; card: string }
  | { page: 'write'; ch: string; beat: string };
function parseRoute(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/').map((x) => decodeURIComponent(x));
  if (p[0] === 'key') return { page: 'key' };
  if (p[0] === 'c' && p[1]) return { page: 'cards', ch: p[1], card: p[2] || '' };
  if (p[0] === 'r' && p[1]) return { page: 'read', ch: p[1], card: p[2] || '' };
  if (p[0] === 'w' && p[1]) return { page: 'write', ch: p[1], beat: p[2] || '' };
  return { page: 'home' };
}
const to = { home: '#/', key: '#/key', cards: (ch: string, card = '') => '#/c/' + encodeURIComponent(ch) + (card ? '/' + card : ''), read: (ch: string, card = '') => '#/r/' + encodeURIComponent(ch) + (card ? '/' + card : ''),
  write: (ch: string, beat = '') => '#/w/' + encodeURIComponent(ch) + (beat ? '/' + encodeURIComponent(beat) : '') };

/** Write or Edit, remembered on this phone (Kyle, 2026-11-21: "so theres writing and editing"). */
type Mode = 'write' | 'edit';
const readMode = (): Mode => (readPref(PREF.pocketMode) === 'write' ? 'write' : 'edit');
function go(hash: string, replace = false) {
  if (replace) { history.replaceState(null, '', location.pathname + location.search + hash); window.dispatchEvent(new HashChangeEvent('hashchange')); }
  else location.hash = hash;
}
function useRoute(): Route {
  const [r, setR] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => { setR(parseRoute(location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

const offline = (e: unknown) => (e as { status?: number }).status === 0;

export function PocketApp({ fromLink }: { fromLink: Settings | null }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [demo, setDemo] = useState(false);
  const [linkSaid, setLinkSaid] = useState<{ ok: boolean; text: string } | null>(fromLink ? { ok: true, text: 'Checking your key with GitHub…' } : null);
  // The key from the square code: checked with GitHub, then kept on this phone as Settings keeps it.
  useEffect(() => {
    if (!fromLink) return;
    new GitHubSource(fromLink).test()
      .then(() => { setSettings(saveSettings(fromLink)); setLinkSaid({ ok: true, text: 'Your key is saved on this phone.' }); })
      .catch((e: Error) => {
        if (offline(e)) { setSettings(saveSettings(fromLink)); setLinkSaid({ ok: true, text: 'Your key is saved on this phone. It is checked with GitHub when the phone is online.' }); }
        else setLinkSaid({ ok: false, text: e.message });
      });
  }, []);
  const connected = isConnected(settings);
  const vault = useMemo(() => (connected ? new PocketVault(new GitHubSource(settings)) : demo ? new PocketVault(new DemoSource()) : null), [settings, demo]);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!vault) return;
    const off = vault.subscribe(() => bump((n) => n + 1));
    void vault.start();
    return () => { off(); vault.stop(); };
  }, [vault]);
  const route = useRoute();
  // Leaving a chapter (for the chapters or another chapter) sends what was chosen in it.
  const inCh = route.page === 'cards' || route.page === 'read' || route.page === 'write' ? route.ch : '';
  const [wasIn, setWasIn] = useState(inCh);
  if (wasIn !== inCh) { if (wasIn && vault) void vault.send(); setWasIn(inCh); }

  if (!vault || route.page === 'key' || (linkSaid && !linkSaid.ok)) {
    return <KeyScreen settings={settings} said={linkSaid} connected={connected} demo={demo}
      onSaved={(s) => { setLinkSaid(null); setDemo(false); setSettings(saveSettings(s)); go(to.home); }}
      onDemo={() => { setLinkSaid(null); setDemo(true); go(to.home); }} />;
  }
  const view = vault.view();
  const s = vault.state;
  if (!view) {
    return (
      <main class="pk">
        <Banners vault={vault} said={linkSaid} onSaid={() => setLinkSaid(null)} />
        <p class="pk-quiet">{s.loaded && !navigator.onLine ? 'This phone has no copy of your vault yet. Connect to the internet once to read it.' : s.error ? '' : 'Reading your vault…'}</p>
      </main>
    );
  }
  const books = pocketBooks(view);
  const want = readPref(PREF.pocketBook);
  const act = activeBook(view);
  const book = books.find((b) => b.folder === want) || books.find((b) => act && b.folder === act.folder) || books[0] || null;
  const banners = <Banners vault={vault} said={linkSaid} onSaid={() => setLinkSaid(null)} />;
  const here = book ? hereFor(vault, view, book, banners, demo) : null;

  if (route.page === 'cards' && here) {
    const ch = here.chapter(route.ch);
    if (ch && ch.note) return <CardsScreen key={route.ch} here={here} ch={ch} cardId={route.card} />;
  }
  if (route.page === 'read' && here) {
    const ch = here.chapter(route.ch);
    if (ch) return <ReadScreen key={route.ch} here={here} ch={ch} cardId={route.card} />;
  }
  if (route.page === 'write' && here) {
    const ch = here.chapter(route.ch);
    if (ch) return <WriteScreen key={route.ch + '/' + route.beat} here={here} ch={ch} openAt={route.beat} />;
  }
  return <HomeScreen vault={vault} here={here} books={books} banners={banners} demo={demo}
    onBook={(folder) => { writePref(PREF.pocketBook, folder); bump((n) => n + 1); }} />;
}

/** One book as the phone shows it: its chapters, and every choice made on the phone that the iPad has not put in yet
 * (on the vault's phone notes, then the ones still on the phone), with the pages as they will be once it has. */
interface Here {
  vault: PocketVault;
  view: VaultIndex;
  book: BookEntry;
  chapters: PocketChapter[];
  waiting: Waiting[];
  chapter: (key: string) => PocketChapter | null;
  /** A scene's body with the phone's choices in. */
  textOf: (n: NoteRecord) => string;
  decided: (ch: PocketChapter) => Map<string, Waiting>;
  /** Cards still to decide in a chapter. */
  left: (ch: PocketChapter) => number;
  /** The chapter with every phone choice in, laid out by its beats. */
  replay: (ch: PocketChapter) => Replayed;
  banners: ComponentChildren;
  demo: boolean;
}

function hereFor(vault: PocketVault, view: VaultIndex, book: BookEntry, banners: ComponentChildren, demo: boolean): Here {
  const chapters = bookChapters(view, book);
  const kept = vault.state.kept.filter((k) => k.book === book.folder).map((k): Waiting => ({ ...k, note: '' }));
  const waiting = waitingInVault(view, book.folder).concat(kept);
  const alias = phoneAliases(view, book.folder);
  const replays = new Map<string, Replayed>();
  const now = new Date();
  const replay = (ch: PocketChapter) => {
    const k = chapterKey(ch);
    if (!replays.has(k)) replays.set(k, replayChapter(view, book, ch, chapters, waiting, alias, now));
    return replays.get(k)!;
  };
  const textOf = (n: NoteRecord) => {
    const ch = chapters.find((c) => c.scenes.some((x) => x.path === n.path));
    const s = ch ? replay(ch).text.scenes.find((x) => x.path === n.path) : null;
    return s ? s.body : n.body;
  };
  const decided = (ch: PocketChapter) => decidedOnPhone(waiting, ch);
  return {
    vault, view, book, chapters, waiting, textOf, decided, banners, demo, replay,
    chapter: (key) => chapters.find((c) => chapterKey(c) === key) || null,
    left: (ch) => { const d = decided(ch); return ch.note ? parseChanges(ch.note.body).changes.filter((c) => c.status === 'open' && !d.has(c.id)).length : 0; }
  };
}

/** What went wrong, at the top of every screen until Kyle closes it. */
function Banners({ vault, said, onSaid }: { vault: PocketVault; said: { ok: boolean; text: string } | null; onSaid: () => void }) {
  const s = vault.state;
  return (
    <>
      {said && <p class="pk-note" role="status">{said.text} <button type="button" class="pk-link" onClick={onSaid}>Close</button></p>}
      {s.error && <p class="pk-error" role="alert">{s.error} <button type="button" class="pk-link" onClick={() => vault.clearError()}>Close</button></p>}
    </>
  );
}

const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);

/** Where the phone's choices stand, in one small line: waiting to go, going, or sent and waiting for the iPad. */
function SendLine({ here, vault }: { here: Here | null; vault: PocketVault }) {
  const s = vault.state;
  const kept = s.kept.length;
  const inVault = here ? here.waiting.filter((w) => w.note).length : 0;
  let line: string;
  if (!vault.canSend) line = kept ? plural(kept, 'choice', 'choices') + ' in this sample. Nothing here is sent.' : 'This is a sample. Nothing here is sent.';
  else if (kept && !navigator.onLine) line = plural(kept, 'choice waits', 'choices wait') + ' on this phone until it is online.';
  else if (kept && s.sending) line = 'Sending ' + plural(kept, 'choice', 'choices') + '…';
  else if (kept) line = plural(kept, 'choice', 'choices') + ' waiting to go.';
  else if (inVault) line = 'All sent. ' + plural(inVault, 'choice waits', 'choices wait') + ' for your iPad to put ' + (inVault === 1 ? 'it' : 'them') + ' in.';
  else line = 'All sent.';
  return <p class="pk-sendline" role="status">{line}</p>;
}

// ---- The Android app (2026-11-21) ----
// Kyle: "Can we ditch address strip". The app file (android/) shows Pocket in its own window with no address bar, so it
// keeps its own key, apart from Chrome's. In Chrome on an Android phone with a key, one press hands that key to the app
// through its own address (sparrowpocket://open?key=...), which only the app answers.

const inPocketApp = typeof navigator !== 'undefined' && /SparrowPocketApp/.test(navigator.userAgent);
const inAndroidChrome = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent) && !inPocketApp && !/; wv\)/.test(navigator.userAgent);
function appLink(s: Settings): string {
  return 'sparrowpocket://open?' + phoneLink(s, '').replace(/^[^#]*#/, '');
}

// ---- The key ----

function KeyScreen({ settings, said, connected, demo, onSaved, onDemo }: {
  settings: Settings; said: { ok: boolean; text: string } | null; connected: boolean; demo: boolean;
  onSaved: (s: Settings) => void; onDemo: () => void;
}) {
  const [token, setToken] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(said);
  const save = async (e: Event) => {
    e.preventDefault();
    const next = { ...settings, token: token.trim() };
    if (!next.token) { setResult({ ok: false, text: 'Paste the key first.' }); return; }
    setBusy(true);
    setResult({ ok: true, text: 'Checking the key with GitHub…' });
    try {
      // The same connection test as Sparrow's Settings.
      await new GitHubSource(next).test();
      setToken('');
      onSaved(next);
    } catch (err) {
      setResult({ ok: false, text: offline(err) ? 'This phone cannot reach GitHub. Connect to the internet and press Test and save again.' : (err as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <main class="pk pk-key">
      <h1>Sparrow Pocket</h1>
      {connected || demo ? <p><a class="pk-link" href={to.home}>‹ Back to your chapters</a></p> : null}
      {inPocketApp
        ? <p>One time only. Open Sparrow Pocket in Chrome on this phone, where it already has your key, and press “Give my key to the Pocket app” at the bottom of its first page. Or paste your key below.</p>
        : <>
          <p>One time only. On your iPad, open Sparrow, Settings, “Add my phone”, and point this phone's camera at the square it shows.</p>
          <ol class="pk-steps">
            <li>Point the camera at the iPad and open the address it finds.</li>
            <li>In Chrome's menu, press “Add to Home screen”.</li>
            <li>Done. Your books are here.</li>
          </ol>
        </>}
      {connected && inAndroidChrome && <p><a class="pk-button" href={appLink(settings)}>Give my key to the Pocket app</a></p>}
      {connected && <p class="pk-note">A key is saved on this phone. Paste a new one below to change it.</p>}
      <h2>Or paste your key</h2>
      <form onSubmit={save}>
        <label class="pk-label" for="pk-key">Your key (the GitHub key Sparrow uses)</label>
        <div class="pk-keyrow">
          <input id="pk-key" type={show ? 'text' : 'password'} value={token} onInput={(e) => setToken((e.currentTarget as HTMLInputElement).value)}
            autocomplete="off" autocapitalize="off" spellcheck={false} placeholder="github_pat_…" />
          <button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
        </div>
        <button type="submit" class="pk-primary pk-wide" disabled={busy}>{busy ? 'Testing…' : 'Test and save'}</button>
      </form>
      {result && <p class={result.ok ? 'pk-note' : 'pk-error'} role="status">{result.text}</p>}
      <p class="pk-quiet">The key stays on this phone and is only ever sent to GitHub.</p>
      {!connected && <p><button type="button" class="pk-link" onClick={onDemo}>Look at a made-up sample first</button></p>}
    </main>
  );
}


// ---- The chapters ----

function HomeScreen({ vault, here, books, banners, demo, onBook }: { vault: PocketVault; here: Here | null; books: BookEntry[]; banners: ComponentChildren; demo: boolean; onBook: (folder: string) => void }) {
  const [picking, setPicking] = useState(false);
  const [, setMode] = useState<Mode>(readMode);
  const s = vault.state;
  const book = here ? here.book : null;
  const listed = here ? here.chapters : [];
  const mode = readMode();
  const leftOf = new Map(listed.map((c) => [c, here!.left(c)] as [PocketChapter, number]));
  const waiting = listed.reduce((t, c) => t + (leftOf.get(c) || 0), 0);
  const place = readPlace(readJson(PREF.pocketPlace));
  const carry = here && book && place && place.book === book.folder ? listed.find((c) => chapterKey(c) === place.chapter && (leftOf.get(c) || 0) > 0) : null;
  const carryAt = carry && place && here ? deck(carry, here.textOf, new Set(here.decided(carry).keys())).findIndex((d) => d.change.id === place.card) : -1;
  return (
    <main class="pk">
      {banners}
      {demo && <p class="pk-note">This is a made-up sample. Nothing you do here is sent. <a class="pk-link" href={to.key}>Add your key</a></p>}
      <header class="pk-bookhead">
        {books.length > 1
          ? <button type="button" class="pk-bookpick" aria-expanded={picking} onClick={() => setPicking(!picking)}>{book ? book.title : 'Choose a book'} <span aria-hidden="true">▾</span></button>
          : <h1 class="pk-bookpick">{book ? book.title : 'No cards yet'}</h1>}
        <p class="pk-sub">{book ? (waiting ? plural(waiting, 'card', 'cards') + ' waiting in this book' : 'No cards waiting in this book') : 'No book has chapters yet.'}</p>
        {book && <ModeSwitch mode={mode} onMode={(m) => { writePref(PREF.pocketMode, m); setPicking(false); setMode(m); }} />}
      </header>
      {picking && (
        <ul class="pk-list" aria-label="Books">
          {books.map((b) => (
            <li key={b.folder}><button type="button" class={'pk-row' + (book && b.folder === book.folder ? ' on' : '')} aria-pressed={Boolean(book && b.folder === book.folder)}
              onClick={() => { onBook(b.folder); setPicking(false); }}>
              <span class="pk-row-title">{b.title}</span><span class="pk-row-end">{book && b.folder === book.folder ? 'chosen' : ''}</span>
            </button></li>
          ))}
        </ul>
      )}
      {carry && mode === 'edit' && (
        <a class="pk-carry" href={to.cards(chapterKey(carry), carryAt >= 0 && place ? place.card : '')}>
          <span class="pk-kicker">Carry on</span>
          <span class="pk-carry-title">{carry.chapter}{carry.title ? ' · ' + carry.title : ''}</span>
          <span>{plural(leftOf.get(carry) || 0, 'card', 'cards') + ' waiting.' + (carryAt >= 0 ? ' You stopped at card ' + (carryAt + 1) + '.' : '')}</span>
        </a>
      )}
      {listed.length > 0 && <h2 class="pk-kicker">Chapters</h2>}
      <ul class="pk-list">
        {listed.map((c) => {
          const left = leftOf.get(c) || 0;
          const laid = here!.replay(c).laid;
          const words = laid.beats.reduce((t, b) => t + beatWords(b.prose), 0);
          const href = mode === 'write' ? to.write(chapterKey(c)) : left ? to.cards(chapterKey(c)) : to.read(chapterKey(c));
          return (
            <li key={chapterKey(c)}>
              <a class={'pk-row' + (carry && c === carry && mode === 'edit' ? ' on' : '')} href={href}>
                <span class="pk-row-num">{c.chapter}</span>
                <span class="pk-row-title">{c.title || 'Chapter ' + c.chapter}
                  <span class="pk-row-sub">{plural(laid.beats.length, 'beat', 'beats') + ' · ' + wordsSaid(words)}</span>
                </span>
                <span class={'pk-row-end' + (left ? ' pk-count' : '')}>{left ? plural(left, 'card', 'cards') : c.note ? '✓ done' : 'no cards'}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <footer class="pk-foot">
        <SendLine here={here} vault={vault} />
        <p class="pk-quiet">{s.syncing ? 'Reading your vault…' : s.snap && s.snap.lastSync ? 'Read from your vault at ' + new Date(s.snap.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.' : ''}</p>
        <p class="pk-buttons">
          <button type="button" onClick={() => void vault.sync()} disabled={s.syncing}>Sync</button>
          <a class="pk-button" href={to.key}>Your key</a>
          <a class="pk-button" href="../">Open Sparrow</a>
        </p>
        {vault.canSend && inAndroidChrome && <p class="pk-buttons"><a class="pk-button" href={appLink(loadSettings())}>Give my key to the Pocket app</a></p>}
      </footer>
    </main>
  );
}

// ---- One card at a time ----

/** The last choice, for Undo: which card and what it was. */
interface Last { ch: string; id: string; card: string; said: string }
let lastChoice: Last | null = null;

function Quote({ text, cls, was, label }: { text: string; cls: string; was?: string; label: string }) {
  return (
    <section class={'pk-box ' + cls}>
      <p class="pk-kicker">{label}</p>
      {text ? <div class="pk-prose" dangerouslySetInnerHTML={{ __html: quoteHtml(text, was) }} /> : <p class="pk-prose pk-quiet">(cut)</p>}
    </section>
  );
}

function CardsScreen({ here, ch, cardId }: { here: Here; ch: PocketChapter; cardId: string }) {
  const { vault, view, book, banners, demo } = here;
  const [sheet, setSheet] = useState<null | { kind: 'which' } | { kind: 'tweak'; which: 'now' | 'other'; words: string } | { kind: 'tell'; words: string }>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [last, setLast] = useState<Last | null>(lastChoice && lastChoice.ch === chapterKey(ch) ? lastChoice : null);
  const ck = chapterKey(ch);
  const decided = here.decided(ch);
  const cards = deck(ch, here.textOf, new Set(decided.keys()));
  const all = parseChanges(ch.note!.body).changes;
  let i = cards.findIndex((d) => d.change.id === cardId);
  if (i < 0) i = 0;
  const dc: DeckCard | null = cards[i] || null;
  useEffect(() => { if (dc) writeJson(PREF.pocketPlace, { book: book.folder, chapter: ck, card: dc.change.id }); setSheet(null); }, [dc && dc.change.id]);
  const title = 'Chapter ' + ch.chapter + (ch.title ? ' · ' + ch.title : '');
  const remember = (l: Last | null) => { lastChoice = l; setLast(l); };
  const base = { book: book.folder, chapter: ch.chapter, chapterId: ch.id, scene: '', was: '', now: '', words: '', made: new Date().toISOString() };

  /** Keep the choice on the phone; the card shows as decided, and the next one comes up. */
  const keep = (c: Change, kind: PhoneKind, version: number, words: string, saidText: string, move: boolean) => {
    const k: Kept = vault.record({ ...base, kind, version, card: c.id, words });
    remember({ ch: ck, id: k.id, card: c.id, said: saidText });
    setSaid(null);
    if (move) { const n = cards[i + 1] || cards[i - 1] || null; go(to.cards(ck, n ? n.change.id : ''), true); }
  };
  /** Words a card would put in must fit the page as the phone has it, as they must on the iPad. */
  const fits = (d: DeckCard, c: Change, words: string): boolean => {
    if (!d.scene || !applyChange(pageText(here.textOf(d.scene)), { ...c, now: words }, 'now')) {
      setSaid({ ok: false, text: 'Those words changed after the team wrote ' + c.id + ', so it cannot go in. Rewrite the paragraph yourself from In the chapter.' });
      return false;
    }
    return true;
  };
  const use = (which: 'now' | 'other') => {
    if (!dc) return;
    const c = dc.change;
    const words = which === 'other' ? c.other || '' : c.now;
    if (!fits(dc, c, words)) return;
    keep(c, 'use', c.other == null ? 0 : which === 'other' ? 2 : 1, words, c.other == null ? 'Accepted' : 'Used version ' + (which === 'other' ? 2 : 1), true);
  };
  const tweak = (which: 'now' | 'other', words: string) => {
    if (!dc) return;
    const c = dc.change;
    if (!fits(dc, c, words)) return;
    keep(c, 'tweak', c.other == null ? 0 : which === 'other' ? 2 : 1, words, 'Your tweak kept', true);
  };
  const reject = () => { if (dc) keep(dc.change, 'reject', 0, '', 'Rejected', true); };
  const tell = (words: string) => {
    if (!dc || !words.trim()) return;
    keep(dc.change, 'tell', 0, words.trim(), 'Told the Writer', false);
    setSheet(null);
  };
  const undo = async () => {
    const l = last;
    if (!l) return;
    const err = await vault.undo(l.id);
    if (err) { setSaid({ ok: false, text: err }); return; }
    remember(null);
    setSaid(null);
    go(to.cards(ck, l.card), true);
  };
  const lastLine = last ? last.said + ' on ' + last.card + '.' : '';

  const head = (
    <header class="pk-cardhead">
      <p class="pk-topline">
        <a class="pk-link" href={to.home}>‹ Chapters</a>
        {last && <span class="pk-undo">{lastLine} <button type="button" class="pk-link" onClick={() => void undo()}>Undo</button></span>}
      </p>
      <ChapterSwitch here={here} ch={ch} mode="edit" />
      <div class="pk-nav">
        <button type="button" class="pk-navbtn" disabled={!dc || i === 0} onClick={() => cards[i - 1] && go(to.cards(ck, cards[i - 1].change.id), true)}>‹ Back</button>
        <div class="pk-navtitle"><b>{title}</b><span>{cards.length ? 'Card ' + (i + 1) + ' of ' + cards.length : 'All decided'}</span></div>
        <button type="button" class="pk-navbtn" disabled={!dc || i >= cards.length - 1} onClick={() => cards[i + 1] && go(to.cards(ck, cards[i + 1].change.id), true)}>Next ›</button>
      </div>
      {cards.length > 0 && <div class="pk-progress" aria-hidden="true"><span style={{ width: Math.round(((i + 1) / cards.length) * 100) + '%' }} /></div>}
    </header>
  );

  if (!dc) {
    return (
      <main class="pk">
        {banners}
        {head}
        {said && <p class={said.ok ? 'pk-note' : 'pk-error'} role="status">{said.text}</p>}
        <section class="pk-done">
          <h1>All decided in chapter {ch.chapter}</h1>
          <p>No cards wait in this chapter. Your iPad puts your choices in when you next open the book there.</p>
          <SendLine here={here} vault={vault} />
          <p class="pk-buttons"><a class="pk-button pk-primary" href={to.home}>Back to the chapters</a><a class="pk-button" href={to.read(ck)}>Read the chapter</a></p>
        </section>
      </main>
    );
  }
  const c = dc.change;
  const onPage = Boolean(dc.scene);
  const two = c.other != null;
  // What was already said to the Writer on this card: in the vault, and from this phone, waiting for the iPad.
  const told = here.waiting.filter((w) => w.kind === 'tell' && w.card === c.id && inChapter(w, ch));
  const jobs = jobNotes(view);
  const target = 'Chapter ' + ch.chapter;
  const replying = Boolean(openAsk(jobs, { kind: 'reply', target, book: book.folder }));
  const replyProblem = recentProblem(askFor(jobs, { kind: 'reply', target, book: book.folder }));
  const made = answersTo(all, c.id);

  return (
    <main class={'pk pk-cards' + (sheet ? ' pk-sheeted' : '')}>
      {banners}
      {head}
      {said && <p class={said.ok ? 'pk-note' : 'pk-error'} role="status">{said.text}</p>}
      <article class="pk-card" data-card={c.id}>
        <p class="pk-cardkind"><b>{shortLabel(c)}</b><span>{(shortLabel(c).startsWith(KIND_LABEL[c.kind]) ? '' : KIND_LABEL[c.kind] + ' · ') + c.id + (c.by ? ' · ' + c.by : '')}</span></p>
        {c.asked ? <p class="pk-why"><span class="pk-kicker">You asked</span>{c.asked}</p> : null}
        {c.does ? <p class="pk-why"><span class="pk-kicker">The change</span>{c.does}</p> : null}
        {!c.asked && !c.does && c.why ? <p class="pk-why">{c.why}</p> : null}
        {sheet && sheet.kind === 'tell' ? null : <Quote text={c.was} cls="pk-yours" label="Yours" />}
        {sheet && sheet.kind === 'tweak' ? null : !onPage ? (
          <section class="pk-box">
            <p>The words this card quotes are not on the page as it quotes them (you have probably changed them yourself), so it cannot put anything there. Decide it on the iPad, or Reject it here.</p>
            <p class="pk-buttons"><button type="button" onClick={reject}>Reject</button></p>
          </section>
        ) : (
          <>
            <section class="pk-box">
              <p class="pk-kicker">{two ? 'Version 1' : 'The new words'}</p>
              <div class="pk-prose" dangerouslySetInnerHTML={{ __html: c.now ? quoteHtml(c.now, c.was) : '<p>(cut)</p>' }} />
              {!sheet && <button type="button" class="pk-primary pk-wide" onClick={() => use('now')}>{two ? 'Use version 1' : 'Accept'}</button>}
            </section>
            {two && (
              <section class="pk-box">
                <p class="pk-kicker">Version 2</p>
                <div class="pk-prose" dangerouslySetInnerHTML={{ __html: c.other ? quoteHtml(c.other, c.was) : '<p>(cut)</p>' }} />
                {!sheet && <button type="button" class="pk-primary pk-wide" onClick={() => use('other')}>Use version 2</button>}
              </section>
            )}
          </>
        )}
        {((c.replies || []).length > 0 || told.length > 0) && (
          <section class="pk-replies">
            {(c.replies || []).map((r, k) => <p key={'v' + k}><span class="pk-kicker">You told the Writer</span>{r}</p>)}
            {told.map((w, k) => <p key={'p' + k}><span class="pk-kicker">You told the Writer, from this phone</span>{w.words}</p>)}
            {told.length > 0 && <p class="pk-waiting">Your iPad sends this to the Writer when you next open the book there.</p>}
            {made.length
              ? <p>{made.map((m) => <a key={m.id} class="pk-link" href={to.cards(ck, m.id)}>{'New card ' + m.id + (m.status === 'open' ? ': see it' : ': decided')}</a>)}</p>
              : !told.length && replying ? <p class="pk-waiting">The Writer is making a new card from your reply. It shows here in a few minutes.</p>
                : !told.length && replyProblem ? <p class="pk-error">{replyProblem}</p> : null}
          </section>
        )}
      </article>

      {sheet && sheet.kind === 'which' && (
        <div class="pk-sheet" role="dialog" aria-label="Which version to tweak">
          <p class="pk-sheethead"><button type="button" class="pk-link" onClick={() => setSheet(null)}>Cancel</button><b>Tweak which version?</b></p>
          <p class="pk-buttons">
            <button type="button" class="pk-wide" onClick={() => setSheet({ kind: 'tweak', which: 'now', words: c.now })}>Version 1</button>
            <button type="button" class="pk-wide" onClick={() => setSheet({ kind: 'tweak', which: 'other', words: c.other || '' })}>Version 2</button>
          </p>
        </div>
      )}
      {sheet && sheet.kind === 'tweak' && (
        <div class="pk-sheet" role="dialog" aria-label="Tweak">
          <p class="pk-sheethead">
            <button type="button" class="pk-link" onClick={() => setSheet(null)}>Cancel</button>
            <span>{two ? (sheet.which === 'other' ? 'Tweaking version 2' : 'Tweaking version 1') : 'Tweaking the new words'}</span>
            <button type="button" class="pk-primary" disabled={!sheet.words.trim()} onClick={() => tweak(sheet.which, sheet.words)}>Save and use</button>
          </p>
          <textarea class="pk-box-text" rows={Math.min(12, Math.max(4, Math.ceil(sheet.words.length / 30)))} value={sheet.words} aria-label="Your edit"
            onInput={(e) => setSheet({ ...sheet, words: (e.currentTarget as HTMLTextAreaElement).value })} />
          <p class="pk-quiet">Shown as it is stored: words between *stars* are in italics.</p>
        </div>
      )}
      {sheet && sheet.kind === 'tell' && (
        <div class="pk-sheet" role="dialog" aria-label="Tell the Writer">
          <p class="pk-sheethead">
            <button type="button" class="pk-link" onClick={() => setSheet(null)}>Cancel</button>
            <button type="button" class="pk-primary" disabled={!sheet.words.trim()} onClick={() => tell(sheet.words)}>Send to the Writer</button>
          </p>
          <label class="pk-label" for="pk-tell">Tell the Writer why</label>
          <textarea id="pk-tell" class="pk-box-text" rows={4} value={sheet.words} placeholder="Why you chose this, or what you want instead"
            onInput={(e) => setSheet({ ...sheet, words: (e.currentTarget as HTMLTextAreaElement).value })} />
          <p class="pk-quiet">Your iPad sends it to the Writer when you next open the book there, and the Writer makes a new card from it in this chapter. A paid team job; the Jobs page in Sparrow shows what it cost.{demo ? ' (In the sample nothing is sent.)' : ''}</p>
        </div>
      )}
      {!sheet && (
        <nav class="pk-bar" aria-label="This card">
          <button type="button" onClick={reject}>Reject</button>
          <button type="button" disabled={!onPage} onClick={() => setSheet(two ? { kind: 'which' } : { kind: 'tweak', which: 'now', words: c.now })}>Tweak</button>
          <button type="button" onClick={() => setSheet({ kind: 'tell', words: '' })}>Tell the Writer</button>
          <a href={to.read(ck, c.id)}>In the chapter</a>
        </nav>
      )}
    </main>
  );
}

// ---- The chapter as a page ----

function ReadScreen({ here, ch, cardId }: { here: Here; ch: PocketChapter; cardId: string }) {
  const { vault, book, banners } = here;
  const [pick, setPick] = useState<{ scene: string; p: Paragraph } | null>(null);
  const [edit, setEdit] = useState<{ scene: string; p: Paragraph; words: string } | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const ck = chapterKey(ch);
  const cards = ch.note ? deck(ch, here.textOf, new Set(here.decided(ch).keys())) : [];
  const left = here.left(ch);
  useEffect(() => {
    if (!cardId) return;
    const el = document.querySelector('[data-cards~="' + cardId.replace(/"/g, '') + '"]');
    if (el) el.scrollIntoView({ block: 'center' });
  }, [cardId]);
  const save = () => {
    if (!edit) return;
    const scene = ch.scenes.find((s) => s.path === edit.scene);
    if (!scene) return;
    const text = pageText(here.textOf(scene));
    try { replaceParagraph(text, edit.p, edit.words); } catch (e) { setSaid({ ok: false, text: (e as Error).message }); return; }
    // The iPad finds the paragraph by its words, so they must stand in the scene once.
    if (text.indexOf(edit.p.text) !== text.lastIndexOf(edit.p.text)) {
      setSaid({ ok: false, text: 'This paragraph is in the scene twice, so your iPad could not tell which one you mean. Rewrite it on the iPad.' });
      return;
    }
    const k = vault.record({ book: book.folder, kind: 'rewrite', version: 0, card: '', chapter: ch.chapter, chapterId: ch.id, scene: propText(scene, 'id'), words: '', was: edit.p.text, now: cleanParagraph(edit.words), made: new Date().toISOString() });
    setLast(k.id);
    setEdit(null);
    setPick(null);
    setSaid({ ok: true, text: 'Kept on this phone. Your iPad puts it in when you next open the book there.' });
  };
  const undo = async () => {
    if (!last) return;
    const err = await vault.undo(last);
    setLast(null);
    setSaid(err ? { ok: false, text: err } : { ok: true, text: 'Taken back.' });
  };
  return (
    <main class={'pk pk-read' + (pick || edit ? ' pk-sheeted' : '')}>
      {banners}
      <header class="pk-nav pk-readhead">
        <a class="pk-navbtn" href={ch.note && left ? to.cards(ck, cardId) : to.home}>{ch.note && left ? '‹ Cards' : '‹ Chapters'}</a>
        <div class="pk-navtitle"><b>{'Chapter ' + ch.chapter + (ch.title ? ' · ' + ch.title : '')}</b><span>{cards.length ? 'Bars show where cards are' : 'Press a paragraph to change it'}</span></div>
        <span class="pk-navbtn" aria-hidden="true" />
      </header>
      <ChapterSwitch here={here} ch={ch} mode="edit" />
      {said && <p class={said.ok ? 'pk-note' : 'pk-error'} role="status">{said.text} {last && said.ok && <button type="button" class="pk-link" onClick={() => void undo()}>Undo</button>} <button type="button" class="pk-link" onClick={() => setSaid(null)}>Close</button></p>}
      {ch.scenes.map((s) => {
        const mine = cards.filter((d) => d.scene === s);
        return (
          <section key={s.path} class="pk-scene">
            {paragraphs(pageText(here.textOf(s)), mine).map((p) => {
              const on = (pick && pick.scene === s.path && pick.p.at === p.at) || (edit && edit.scene === s.path && edit.p.at === p.at);
              return (
                <div key={p.at} class={'pk-para' + (p.cards.length ? ' has-card' : '') + (on ? ' on' : '')} data-cards={p.cards.map((c) => c.id).join(' ')}>
                  {p.cards.length
                    ? <a class="pk-bar-mark" href={to.cards(ck, p.cards[0].id)} aria-label={'Open card ' + p.cards[0].id} />
                    : <span class="pk-bar-mark none" aria-hidden="true" />}
                  <div class="pk-prose" role="button" tabIndex={0} onClick={() => { setEdit(null); setSaid(null); setPick({ scene: s.path, p }); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') setPick({ scene: s.path, p }); }}
                    dangerouslySetInnerHTML={{ __html: bookHtml(p.text) }} />
                </div>
              );
            })}
          </section>
        );
      })}
      {pick && !edit && (
        <div class="pk-sheet" role="dialog" aria-label="This paragraph">
          <p class="pk-sheethead"><b>This paragraph</b><button type="button" class="pk-link" onClick={() => setPick(null)}>Close</button></p>
          {pick.p.cards.map((c) => (
            <a key={c.id} class="pk-choice" href={to.cards(ck, c.id)}><b>{'See its card, ' + c.id}</b><span>{shortLabel(c)}</span></a>
          ))}
          <button type="button" class="pk-choice" onClick={() => setEdit({ scene: pick.scene, p: pick.p, words: pick.p.text })}>
            <b>Rewrite it myself</b><span>Opens just this paragraph to type in.</span>
          </button>
        </div>
      )}
      {edit && (
        <div class="pk-sheet" role="dialog" aria-label="Rewrite this paragraph">
          <p class="pk-sheethead">
            <button type="button" class="pk-link" onClick={() => setEdit(null)}>Cancel</button>
            <span>Your paragraph</span>
            <button type="button" class="pk-primary" disabled={edit.words === edit.p.text} onClick={save}>Save</button>
          </p>
          <textarea class="pk-box-text" rows={Math.min(14, Math.max(5, Math.ceil(edit.words.length / 30)))} value={edit.words} aria-label="Your paragraph"
            onInput={(e) => setEdit({ ...edit, words: (e.currentTarget as HTMLTextAreaElement).value })} />
          <p class="pk-quiet">Shown as it is stored: words between *stars* are in italics, and a line starting with &gt; is a System screen. Save keeps it on this phone; your iPad puts it into {book.title} when you next open the book there.</p>
        </div>
      )}
    </main>
  );
}

// ---- Write or Edit ----

function ModeSwitch({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  return (
    <div class="pk-mode" role="group" aria-label="Write or edit">
      <button type="button" class={mode === 'write' ? 'on' : ''} aria-pressed={mode === 'write'} onClick={() => onMode('write')}>Write</button>
      <button type="button" class={mode === 'edit' ? 'on' : ''} aria-pressed={mode === 'edit'} onClick={() => onMode('edit')}>Edit</button>
    </div>
  );
}

/** The switch at the top of a chapter: Write shows its beats, Edit its cards (or the page when none wait). */
function ChapterSwitch({ here, ch, mode }: { here: Here; ch: PocketChapter; mode: Mode }) {
  const ck = chapterKey(ch);
  return <ModeSwitch mode={mode} onMode={(m) => {
    writePref(PREF.pocketMode, m);
    if (m === mode) return;
    go(m === 'write' ? to.write(ck) : here.left(ch) ? to.cards(ck) : to.read(ck), true);
  }} />;
}

// ---- Write: the chapter by its beats (2026-11-21) ----
// Kyle, 2026-11-22: "for pocket let's have the beats in write mode have a 3rd section--one for writing too. So both the
// beat planning and the writing field can expand for each card. Also right on the main screen I should be able to add a
// beat, and push a button to move beats around". Each beat is a card on the chapter's list: press it to open its name,
// its planning notes (kept in the beats note, never in the chapter) and its writing (the chapter's words), right there.
// Move up and Move down sit on every card, and Add a beat at the top and foot of the list.

/** A new beat's ID on the phone, until the iPad saves it and gives it its own. */
const newBeatId = () => 'new-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** The beat just added, so it opens with its name ready to type (as Beats mode's Add a beat does). */
let justAdded = '';

const beatLabel = (b: BeatView, i: number) => 'beat ' + (i + 1) + (b.title ? ', ' + b.title : '');
const nameOf = (b: BeatView) => b.title || (b.loose ? 'Opening words, no name yet' : 'No name yet');
function firstLine(prose: string): string {
  const line = prose.split('\n').map((l) => l.replace(/^\s*>\s?/, '').replace(/[*_=`]/g, '').trim()).find(Boolean) || '';
  return line.length > 90 ? line.slice(0, 88).replace(/\s+\S*$/, '') + '…' : line;
}
const wordsSaid = (n: number) => n.toLocaleString('en-US') + (n === 1 ? ' word' : ' words');
const rowsFor = (t: string, min: number) => Math.min(22, Math.max(min, Math.ceil(t.length / 34) + t.split('\n').length));

/** What every beat choice carries. */
const beatBase = (here: Here, ch: PocketChapter) => ({ book: here.book.folder, version: 0, card: '', chapter: ch.chapter, chapterId: ch.id, scene: '', words: '', was: '', now: '', made: new Date().toISOString() });

function WriteHead({ here, ch, sub, back }: { here: Here; ch: PocketChapter; sub: string; back?: ComponentChildren }) {
  return (
    <header class="pk-cardhead">
      <p class="pk-topline">{back || <a class="pk-link" href={to.home}>‹ Chapters</a>}</p>
      <ChapterSwitch here={here} ch={ch} mode="write" />
      <div class="pk-navtitle pk-writetitle"><b>{'Chapter ' + ch.chapter + (ch.title ? ' · ' + ch.title : '')}</b><span>{sub}</span></div>
    </header>
  );
}

function WriteScreen({ here, ch, openAt }: { here: Here; ch: PocketChapter; openAt: string }) {
  const { vault, banners } = here;
  const r = here.replay(ch);
  const beats = r.laid.beats;
  // The beats open on this screen, by the ID each had when it was opened (a rename gives a beat a new ID; findBeat follows it).
  const [open, setOpen] = useState<string[]>(() => (openAt ? [openAt] : []));
  const openFor = (b: BeatView) => open.find((id) => findBeat(beats, id, r.alias) === b) || '';
  const toggle = (b: BeatView) => { const id = openFor(b); setOpen(id ? open.filter((x) => x !== id) : open.concat(b.key)); };
  useEffect(() => {
    if (!openAt) return;
    const el = document.querySelector('[data-beat="' + CSS.escape(openAt) + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  }, []);
  const total = beats.reduce((t, b) => t + beatWords(b.prose), 0);
  const notes = beats.reduce((t, b) => t + beatWords(b.notes), 0);
  const add = (after: BeatView | null, i: number) => {
    const id = newBeatId();
    vault.record({ ...beatBase(here, ch), kind: 'beat-add', beat: id, beatName: 'beat ' + (i + 2), place: after ? 'after ' + after.key : 'end', now: '' });
    justAdded = id;
    setOpen(open.concat(id));
    setTimeout(() => { const el = document.querySelector('[data-beat="' + CSS.escape(id) + '"]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }, 0);
  };
  const move = (b: BeatView, i: number, dir: 'up' | 'down') => {
    const t = moveTarget(beats, b.key, dir);
    if (t === undefined) return;
    vault.record({ ...beatBase(here, ch), kind: 'beat-move', beat: b.key, beatName: beatLabel(b, i), place: t == null ? 'end' : 'before ' + t });
  };
  return (
    <main class="pk pk-write">
      {banners}
      <WriteHead here={here} ch={ch} sub={plural(beats.length, 'beat', 'beats') + ' · ' + wordsSaid(total) + (notes ? ' · ' + wordsSaid(notes) + ' of notes' : '')} />
      <p class="pk-buttons"><button type="button" class="pk-wide" disabled={!ch.scenes.length} onClick={() => add(null, beats.length - 1)}>Add a beat</button></p>
      <ol class="pk-beats">
        {beats.map((b, i) => {
          const newScene = i === 0 || beats[i - 1].path !== b.path;
          const n = beatWords(b.prose);
          const id = openFor(b);
          const up = moveTarget(beats, b.key, 'up'), down = moveTarget(beats, b.key, 'down');
          return (
            <li key={id || b.key} data-beat={id || b.key} class={'pk-beatcard' + (id ? ' open' : '') + (b.loose ? ' loose' : '')}>
              {newScene && i > 0 && <p class="pk-beatscene" aria-hidden="true">~ {b.scene}</p>}
              {!id && (
                <div class="pk-beatrow">
                  <button type="button" class="pk-beat" aria-expanded={false} onClick={() => toggle(b)}>
                    <span class="pk-beat-num">{i + 1}</span>
                    <span class="pk-beat-main">
                      <b>{nameOf(b)}</b>
                      <span>{firstLine(b.notes) || firstLine(b.prose) || 'Nothing yet.'}</span>
                      <span class="pk-beat-words">{[n ? wordsSaid(n) : '', b.notes ? 'notes' : ''].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                  <MoveButtons i={i} up={up} down={down} onMove={(dir) => move(b, i, dir)} />
                </div>
              )}
              {id && <BeatEditor key={id} here={here} ch={ch} beatId={id} moves={<MoveButtons i={i} up={up} down={down} onMove={(dir) => move(b, i, dir)} />}
                onAdd={(x, k) => add(x, k)} onClose={() => setOpen(open.filter((x) => x !== id))} />}
            </li>
          );
        })}
      </ol>
      {!beats.length && <p class="pk-quiet">{ch.scenes.length ? 'This chapter has no beats yet.' : 'This chapter has no scenes yet.'}</p>}
      {beats.length > 0 && <p class="pk-buttons"><button type="button" class="pk-wide" disabled={!ch.scenes.length} onClick={() => add(null, beats.length - 1)}>Add a beat at the end</button></p>}
      <footer class="pk-foot"><SendLine here={here} vault={vault} /></footer>
    </main>
  );
}

function MoveButtons({ i, up, down, onMove }: { i: number; up: string | null | undefined; down: string | null | undefined; onMove: (dir: 'up' | 'down') => void }) {
  return (
    <span class="pk-movebtns">
      <button type="button" disabled={up === undefined} aria-label={'Move beat ' + (i + 1) + ' up'} onClick={() => onMove('up')}>▲</button>
      <button type="button" disabled={down === undefined} aria-label={'Move beat ' + (i + 1) + ' down'} onClick={() => onMove('down')}>▼</button>
    </span>
  );
}

/** The parts of an open beat Kyle has folded up, the same for every beat on this phone (Kyle, 2026-11-22: "How do I
 * minimize each section within a card?"). The summary starts folded. */
type Part = 'summary' | 'plan' | 'writing';
function readFolds(): Part[] {
  try { const v = JSON.parse(readPref(PREF.pocketFolds) || '["summary"]'); return Array.isArray(v) ? v : ['summary']; } catch { return ['summary']; }
}

/** A quiet moment after typing before the words are kept as a choice (they are kept at once on leaving). */
const TYPE_MS = 700;

/** One open beat: its name, its planning notes and its writing, each kept as one choice per sitting. */
function BeatEditor({ here, ch, beatId, moves, onAdd, onClose }: { here: Here; ch: PocketChapter; beatId: string; moves: ComponentChildren; onAdd: (after: BeatView, i: number) => void; onClose: () => void }) {
  const [folds, setFolds] = useState<Part[]>(readFolds);
  const fold = (p: Part) => { const next = folds.indexOf(p) >= 0 ? folds.filter((x) => x !== p) : folds.concat(p); setFolds(next); writePref(PREF.pocketFolds, JSON.stringify(next)); };
  const shut = (p: Part) => folds.indexOf(p) >= 0;
  const { vault } = here;
  const r = here.replay(ch);
  const beats = r.laid.beats;
  const b = findBeat(beats, beatId, r.alias);
  const i = b ? beats.indexOf(b) : -1;
  const [words, setWords] = useState(b ? b.prose : '');
  const [notes, setNotes] = useState(b ? b.notes : '');
  const [title, setTitle] = useState(b ? b.title : '');
  const [asking, setAsking] = useState(false);
  type Dirty = { words?: string; notes?: string; title?: string };
  const sit = useRef<{ write: string; notes: string; rename: string; timer: number; dirty: Dirty }>({ write: '', notes: '', rename: '', timer: 0, dirty: {} });
  const cur = useRef({ b, i, title });
  cur.current = { b, i, title };
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (justAdded && justAdded === beatId && titleRef.current) { justAdded = ''; titleRef.current.focus(); }
  }, []);

  const flush = () => {
    const st = sit.current;
    clearTimeout(st.timer);
    const d = st.dirty;
    st.dirty = {};
    const c = cur.current;
    if (!c.b) return;
    const name = beatLabel({ ...c.b, title: c.title }, c.i);
    if (d.words != null) {
      if (!(st.write && vault.update(st.write, { now: d.words, beatName: name }))) {
        if (d.words !== c.b.prose) st.write = vault.record({ ...beatBase(here, ch), kind: 'beat-write', beat: c.b.key, beatName: name, was: c.b.prose, now: d.words }).id;
      }
    }
    if (d.notes != null) {
      if (!(st.notes && vault.update(st.notes, { now: d.notes, beatName: name }))) {
        if (d.notes !== c.b.notes) st.notes = vault.record({ ...beatBase(here, ch), kind: 'beat-notes', beat: c.b.key, beatName: name, was: c.b.notes, now: d.notes }).id;
      }
    }
    if (d.title != null) {
      // A beat added on this phone and not sent yet takes its name in the same choice.
      const added = vault.state.kept.find((k) => k.kind === 'beat-add' && (k.beat === beatId || k.beat === c.b!.key));
      if (added) vault.update(added.id, { now: d.title, beatName: name });
      else if (!(st.rename && vault.update(st.rename, { now: d.title, beatName: name }))) {
        if (d.title !== c.b.title) st.rename = vault.record({ ...beatBase(here, ch), kind: 'beat-rename', beat: c.b.key, beatName: name, was: c.b.title, now: d.title }).id;
      }
    }
  };
  const later = (part: Dirty) => {
    const st = sit.current;
    st.dirty = { ...st.dirty, ...part };
    clearTimeout(st.timer);
    st.timer = window.setTimeout(flush, TYPE_MS);
  };
  useEffect(() => () => flush(), []);

  if (!b) return <p class="pk-note">This beat is not in the chapter any more.</p>;
  const remove = () => {
    flush();
    vault.record({ ...beatBase(here, ch), kind: 'beat-delete', beat: b.key, beatName: beatLabel({ ...b, title }, i), was: words });
    setAsking(false);
    onClose();
  };
  const n = beatWords(words), nn = beatWords(notes);
  const id = 'pk-b-' + beatId;
  const Head = ({ p, label, sub }: { p: Part; label: string; sub: string }) => (
    <button type="button" class="pk-part" aria-expanded={!shut(p)} onClick={() => { flush(); fold(p); }}>
      <span class="pk-part-arrow" aria-hidden="true">{shut(p) ? '▸' : '▾'}</span><b>{label}</b><span class="pk-quiet">{sub}</span>
    </button>
  );
  return (
    <div class="pk-beatbody">
      <div class="pk-beattop">
        <span class="pk-beat-num">{i + 1}</span>
        <input id={id + '-t'} ref={titleRef} class="pk-beat-title" type="text" value={title} placeholder="Name this beat" autocomplete="off" aria-label={'Beat ' + (i + 1) + ' name'}
          onInput={(e) => { const v = (e.currentTarget as HTMLInputElement).value; setTitle(v); later({ title: v }); }}
          onBlur={flush} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }} />
        {moves}
      </div>
      {b.summary && <Head p="summary" label="Summary" sub={shut('summary') ? firstLine(b.summary) : ''} />}
      {b.summary && !shut('summary') && <p class="pk-part-text">{b.summary}</p>}
      <Head p="plan" label="Plan" sub={wordsSaid(nn) + ', never in the chapter'} />
      {!shut('plan') && <textarea id={id + '-n'} class="pk-box-text pk-beat-notes" rows={rowsFor(notes, 3)} value={notes} placeholder="Your thoughts for this beat" aria-label="Plan"
        onInput={(e) => { const v = (e.currentTarget as HTMLTextAreaElement).value; setNotes(v); later({ notes: v }); }} onBlur={flush} />}
      <Head p="writing" label="Writing" sub={wordsSaid(n)} />
      {!shut('writing') && <textarea id={id + '-w'} class="pk-box-text pk-beat-text" rows={rowsFor(words, 6)} value={words} placeholder="Write this beat" aria-label="Writing"
        onInput={(e) => { const v = (e.currentTarget as HTMLTextAreaElement).value; setWords(v); later({ words: v }); }} onBlur={flush} />}
      {!shut('writing') && <p class="pk-quiet pk-small">Goes into the chapter when you next open the book on your iPad. *Stars* make italics; a line starting with &gt; is a System screen.</p>}
      <div class="pk-beattools">
        <button type="button" onClick={() => { flush(); onAdd(b, i); }}>Add a beat after this</button>
        <button type="button" onClick={() => { flush(); setAsking(true); }}>Delete this beat</button>
        <button type="button" class="pk-wide pk-primary" onClick={() => { flush(); onClose(); }}>Close this beat</button>
      </div>
      {asking && (
        <div class="pk-sheet" role="dialog" aria-label="Delete this beat">
          <p class="pk-ask">{'Delete beat ' + (i + 1) + (words.trim() || notes.trim() ? ', its ' + [words.trim() ? wordsSaid(n) : '', notes.trim() ? wordsSaid(nn) + ' of notes' : ''].filter(Boolean).join(' and ') + '? A copy goes to the book\'s Archive.' : '?')}</p>
          <p class="pk-buttons">
            <button type="button" class="pk-primary" onClick={remove}>Yes, delete it</button>
            <button type="button" onClick={() => setAsking(false)}>Cancel</button>
          </p>
        </div>
      )}
    </div>
  );
}
