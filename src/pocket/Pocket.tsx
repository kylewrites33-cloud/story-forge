// Sparrow Pocket's screens (2026-11-20): the chapters with cards waiting, one card at a time (use a version, Reject,
// tweak a version, tell the Writer, Undo), and the chapter as a reading page where any paragraph can be rewritten.
// Every press saves exactly what the Edit room saves for it: the answers on the changes note with the to-dos they tick
// (marksAction), the words in the scene through the writing page's own save (PocketVault.saveBody), and a reply as the
// Edit room's reply (replyAction). The button words are the Edit room's (src/ui/Changes.tsx).
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { applyChange, answersTo, KIND_LABEL, parseChanges, revertChange, shortLabel, todoEdits, tweakStatus, type Change, type ChangeStatus } from '../lib/changes.ts';
import { bookHtml, quoteHtml } from '../lib/cardtext.ts';
import { DemoSource } from '../lib/demo-source.ts';
import { GitHubSource } from '../lib/github.ts';
import { jobNotes } from '../lib/jobs.ts';
import { bookChapters, cardBooks, chapterKey, deck, pageText, paragraphs, readPlace, replaceParagraph, withPageText, type DeckCard, type Paragraph, type PocketChapter } from '../lib/pocket.ts';
import { PREF, readJson, readPref, writeJson, writePref } from '../lib/prefs.ts';
import { isConnected, loadSettings, saveSettings, type Settings } from '../lib/settings.ts';
import { bookTodos } from '../lib/todos.ts';
import type { BookEntry, NoteRecord, VaultIndex } from '../lib/types.ts';
import { activeBook } from '../lib/vault-index.ts';
import { askFor, openAsk, recentProblem } from '../team/asks.ts';
import { replyAction, replyTarget } from '../team/reply.ts';
import { marksAction } from '../vault/ops.ts';
import { PocketVault } from './vault.ts';

// ---- Addresses: #/ the chapters, #/c/CH-020/C-03 a card, #/r/CH-020 the chapter, #/key the key ----
type Route = { page: 'home' } | { page: 'key' } | { page: 'cards'; ch: string; card: string } | { page: 'read'; ch: string; card: string };
function parseRoute(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/').map((x) => decodeURIComponent(x));
  if (p[0] === 'key') return { page: 'key' };
  if (p[0] === 'c' && p[1]) return { page: 'cards', ch: p[1], card: p[2] || '' };
  if (p[0] === 'r' && p[1]) return { page: 'read', ch: p[1], card: p[2] || '' };
  return { page: 'home' };
}
const to = { home: '#/', key: '#/key', cards: (ch: string, card = '') => '#/c/' + encodeURIComponent(ch) + (card ? '/' + card : ''), read: (ch: string, card = '') => '#/r/' + encodeURIComponent(ch) + (card ? '/' + card : '') };
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
        {s.error && <p class="pk-error" role="alert">{s.error}</p>}
      </main>
    );
  }
  const books = cardBooks(view);
  const want = readPref(PREF.pocketBook);
  const act = activeBook(view);
  const book = books.find((b) => b.folder === want) || books.find((b) => act && b.folder === act.folder) || books[0] || null;
  const chapters = book ? bookChapters(view, book) : [];
  const chapter = (key: string) => chapters.find((c) => chapterKey(c) === key) || null;
  const banners = <Banners vault={vault} said={linkSaid} onSaid={() => setLinkSaid(null)} />;

  if (route.page === 'cards' && book) {
    const ch = chapter(route.ch);
    if (ch && ch.note) return <CardsScreen key={route.ch} vault={vault} view={view} book={book} ch={ch} cardId={route.card} banners={banners} demo={demo} />;
  }
  if (route.page === 'read' && book) {
    const ch = chapter(route.ch);
    if (ch) return <ReadScreen key={route.ch} vault={vault} book={book} ch={ch} cardId={route.card} banners={banners} />;
  }
  return <HomeScreen vault={vault} book={book} books={books} chapters={chapters} banners={banners} demo={demo}
    onBook={(folder) => { writePref(PREF.pocketBook, folder); bump((n) => n + 1); }} />;
}

/** What went wrong or what happened elsewhere, at the top of every screen until Kyle closes it. */
function Banners({ vault, said, onSaid }: { vault: PocketVault; said: { ok: boolean; text: string } | null; onSaid: () => void }) {
  const s = vault.state;
  return (
    <>
      {said && <p class="pk-note" role="status">{said.text} <button type="button" class="pk-link" onClick={onSaid}>Close</button></p>}
      {s.error && <p class="pk-error" role="alert">{s.error} <button type="button" class="pk-link" onClick={() => vault.clearError()}>Close</button></p>}
      {s.notice && <p class="pk-note" role="status">{s.notice} <button type="button" class="pk-link" onClick={() => vault.clearNotice()}>Close</button></p>}
    </>
  );
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
      <p>One time only. On your iPad, open Sparrow, Settings, “Add my phone”, and point this phone's camera at the square it shows.</p>
      <ol class="pk-steps">
        <li>Point the camera at the iPad and open the address it finds.</li>
        <li>In Chrome's menu, press “Add to Home screen”.</li>
        <li>Done. Your books are here.</li>
      </ol>
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

function HomeScreen({ vault, book, books, chapters, banners, demo, onBook }: { vault: PocketVault; book: BookEntry | null; onBook: (folder: string) => void; books: BookEntry[]; chapters: PocketChapter[]; banners: ComponentChildren; demo: boolean }) {
  const [picking, setPicking] = useState(false);
  const s = vault.state;
  const listed = chapters.filter((c) => c.note);
  const waiting = listed.reduce((t, c) => t + c.open, 0);
  const place = readPlace(readJson(PREF.pocketPlace));
  const carry = book && place && place.book === book.folder ? listed.find((c) => chapterKey(c) === place.chapter && c.open > 0) : null;
  const carryAt = carry && place ? deck(carry, (n) => vault.bodyOf(n)).findIndex((d) => d.change.id === place.card) : -1;
  const sending = s.outbox.length + vault.waitingWords();
  return (
    <main class="pk">
      {banners}
      {demo && <p class="pk-note">This is a made-up sample. Nothing you do here is saved. <a class="pk-link" href={to.key}>Add your key</a></p>}
      <header class="pk-bookhead">
        {books.length > 1
          ? <button type="button" class="pk-bookpick" aria-expanded={picking} onClick={() => setPicking(!picking)}>{book ? book.title : 'Choose a book'} <span aria-hidden="true">▾</span></button>
          : <h1 class="pk-bookpick">{book ? book.title : 'No cards yet'}</h1>}
        <p class="pk-sub">{book ? (waiting ? waiting + (waiting === 1 ? ' card' : ' cards') + ' waiting in this book' : 'No cards waiting in this book') : 'The team has not written change cards for any book yet.'}</p>
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
      {carry && (
        <a class="pk-carry" href={to.cards(chapterKey(carry), carryAt >= 0 && place ? place.card : '')}>
          <span class="pk-kicker">Carry on</span>
          <span class="pk-carry-title">{carry.chapter}{carry.title ? ' · ' + carry.title : ''}</span>
          <span>{carry.open + (carry.open === 1 ? ' card' : ' cards') + ' waiting.' + (carryAt >= 0 ? ' You stopped at card ' + (carryAt + 1) + '.' : '')}</span>
        </a>
      )}
      {listed.length > 0 && <h2 class="pk-kicker">Chapters</h2>}
      <ul class="pk-list">
        {listed.map((c) => (
          <li key={chapterKey(c)}>
            <a class={'pk-row' + (carry && c === carry ? ' on' : '')} href={c.open ? to.cards(chapterKey(c)) : to.read(chapterKey(c))}>
              <span class="pk-row-num">{c.chapter}</span>
              <span class="pk-row-title">{c.title || 'Chapter ' + c.chapter}</span>
              <span class={'pk-row-end' + (c.open ? ' pk-count' : '')}>{c.open ? c.open + (c.open === 1 ? ' card' : ' cards') : '✓ done'}</span>
            </a>
          </li>
        ))}
      </ul>
      <footer class="pk-foot">
        <p class="pk-quiet">{s.syncing ? 'Reading your vault…' : sending ? sending + (sending === 1 ? ' change waits' : ' changes wait') + ' on this phone' + (navigator.onLine ? '.' : ' until it is online.') : s.snap ? 'Up to date' + (s.snap.lastSync ? ' as of ' + new Date(s.snap.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '') + '.' : ''}</p>
        <p class="pk-buttons">
          <button type="button" onClick={() => void vault.sync()} disabled={s.syncing}>Sync</button>
          <a class="pk-button" href={to.key}>Your key</a>
          <a class="pk-button" href="../">Open Sparrow</a>
        </p>
      </footer>
    </main>
  );
}

// ---- One card at a time ----

const STATUS_SAID: Record<ChangeStatus, string> = { open: 'Opened again', kept: 'Accepted', other: 'Used version 2', no: 'Rejected', mine: 'Your own words', rewrite: 'In the rewrite', replaced: 'Replaced' };

/** The last choice, for Undo: which card, what it did, and the words it put in. */
interface Last { ch: string; id: string; status: ChangeStatus; scene: string | null; put: string | null; two: boolean }
let lastChoice: Last | null = null;

function Quote({ text, cls, was, label }: { text: string; cls: string; was?: string; label: string }) {
  return (
    <section class={'pk-box ' + cls}>
      <p class="pk-kicker">{label}</p>
      {text ? <div class="pk-prose" dangerouslySetInnerHTML={{ __html: quoteHtml(text, was) }} /> : <p class="pk-prose pk-quiet">(cut)</p>}
    </section>
  );
}

function CardsScreen({ vault, view, book, ch, cardId, banners, demo }: { vault: PocketVault; view: VaultIndex; book: BookEntry; ch: PocketChapter; cardId: string; banners: ComponentChildren; demo: boolean }) {
  const [sheet, setSheet] = useState<null | { kind: 'which' } | { kind: 'tweak'; which: 'now' | 'other'; words: string } | { kind: 'tell'; words: string }>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [last, setLast] = useState<Last | null>(lastChoice && lastChoice.ch === chapterKey(ch) ? lastChoice : null);
  const ck = chapterKey(ch);
  const textOf = (n: NoteRecord) => vault.bodyOf(n);
  const cards = deck(ch, textOf);
  const all = parseChanges(ch.note!.body).changes;
  let i = cards.findIndex((d) => d.change.id === cardId);
  if (i < 0) i = 0;
  const dc: DeckCard | null = cards[i] || null;
  useEffect(() => { if (dc) writeJson(PREF.pocketPlace, { book: book.folder, chapter: ck, card: dc.change.id }); setSheet(null); }, [dc && dc.change.id]);
  const title = 'Chapter ' + ch.chapter + (ch.title ? ' · ' + ch.title : '');
  const remember = (l: Last | null) => { lastChoice = l; setLast(l); };

  /** Answers on the changes note, with the to-dos they tick off or open again: one save, as the Edit room makes it. */
  const record = (c: Change, status: ChangeStatus) => {
    const after = all.map((x) => (x.id === c.id ? { ...x, status } : x));
    const at = new Date().toISOString();
    const ticks = todoEdits(after, [c.id], bookTodos(view, book));
    vault.act(marksAction(ch.note!.path, { [c.id]: status }, ticks.map((t) => ({ path: t.path, decision: 'edit' as const, reason: '', at, fields: t.fields }))));
  };
  /** Put words into the scene where the card's old words are (the writing page's own save). */
  const putIn = (d: DeckCard, c: Change, which: 'now' | 'other'): string | null => {
    if (!d.scene) return 'The words this card quotes are not on the page any more, so it cannot put anything there.';
    const body = vault.bodyOf(d.scene);
    const r = applyChange(pageText(body), c, which);
    if (!r) return 'Those words changed after the team wrote ' + c.id + ', so it could not go in. Rewrite the paragraph yourself from In the chapter.';
    void vault.saveBody(d.scene, withPageText(body, r.text));
    return null;
  };
  const next = () => { const n = cards[i + 1] || cards[i - 1] || null; go(to.cards(ck, n ? n.change.id : ''), true); };
  const choose = (status: ChangeStatus, words?: string) => {
    if (!dc) return;
    const c = dc.change;
    let put: string | null = null;
    if (words != null) {
      const err = putIn(dc, { ...c, now: words }, 'now');
      if (err) { setSaid({ ok: false, text: err }); return; }
      put = words;
    } else if (status === 'kept' || status === 'other') {
      const err = putIn(dc, c, status === 'other' ? 'other' : 'now');
      if (err) { setSaid({ ok: false, text: err }); return; }
      put = status === 'other' ? c.other : c.now;
    }
    record(c, status);
    remember({ ch: ck, id: c.id, status, scene: dc.scene ? dc.scene.path : null, put, two: c.other != null });
    setSaid(null);
    next();
  };
  const undo = () => {
    const l = last;
    if (!l) return;
    const c = all.find((x) => x.id === l.id);
    if (!c) { remember(null); return; }
    const scene = l.scene ? view.notes[l.scene] : null;
    if (l.put != null && scene) {
      const body = vault.bodyOf(scene);
      const t = revertChange(pageText(body), { ...c, now: l.put }, 'now');
      if (t == null) { setSaid({ ok: false, text: 'The words ' + c.id + ' put in have changed since, so it cannot be taken back out. Your page stays as it is.' }); return; }
      void vault.saveBody(scene, withPageText(body, t));
    }
    record(c, 'open');
    remember(null);
    setSaid(null);
    go(to.cards(ck, c.id), true);
  };
  const lastLine = last ? (last.status === 'kept' && last.two ? 'Used version 1' : last.status === 'mine' ? 'Your own words went in' : STATUS_SAID[last.status]) + ' on ' + last.id + '.' : '';

  const head = (
    <header class="pk-cardhead">
      <p class="pk-topline">
        <a class="pk-link" href={to.home}>‹ Chapters</a>
        {last && <span class="pk-undo">{lastLine} <button type="button" class="pk-link" onClick={undo}>Undo</button></span>}
      </p>
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
        <section class="pk-done">
          <h1>All decided in chapter {ch.chapter}</h1>
          <p>No cards wait in this chapter.</p>
          <p class="pk-buttons"><a class="pk-button pk-primary" href={to.home}>Back to the chapters</a><a class="pk-button" href={to.read(ck)}>Read the chapter</a></p>
        </section>
      </main>
    );
  }
  const c = dc.change;
  const here = Boolean(dc.scene);
  const two = c.other != null;
  // Reply to the Writer, as the Edit room shows it (src/ui/Changes.tsx).
  const jobs = jobNotes(view);
  const target = replyTarget(ch.chapter);
  const replying = Boolean(openAsk(jobs, { kind: 'reply', target, book: book.folder }));
  const replyProblem = recentProblem(askFor(jobs, { kind: 'reply', target, book: book.folder }));
  const made = answersTo(all, c.id);
  const send = (words: string) => {
    if (!vault.source.commit) { setSaid({ ok: false, text: 'Replies need your own vault, not the demo.' }); return; }
    const snap = vault.state.snap;
    if (!snap) { setSaid({ ok: false, text: 'Press Sync first.' }); return; }
    try {
      vault.act(replyAction(snap.index, vault.state.outbox, vault.schema(), ch.note!.path, c.id, words, book.folder, ch.chapter));
      setSheet(null);
      setSaid(null);
    } catch (e) {
      setSaid({ ok: false, text: (e as Error).message });
    }
  };

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
        {sheet && sheet.kind === 'tweak' ? null : !here ? (
          <section class="pk-box">
            <p>The words this card quotes are not on the page as it quotes them (you have probably changed them yourself), so it cannot put anything there. I wrote my own keeps your words.</p>
            <p class="pk-buttons"><button type="button" class="pk-primary" onClick={() => choose('mine')}>I wrote my own</button><button type="button" onClick={() => choose('no')}>Reject</button></p>
          </section>
        ) : (
          <>
            <section class="pk-box">
              <p class="pk-kicker">{two ? 'Version 1' : 'The new words'}</p>
              <div class="pk-prose" dangerouslySetInnerHTML={{ __html: c.now ? quoteHtml(c.now, c.was) : '<p>(cut)</p>' }} />
              {!sheet && <button type="button" class="pk-primary pk-wide" onClick={() => choose('kept')}>{two ? 'Use version 1' : 'Accept'}</button>}
            </section>
            {two && (
              <section class="pk-box">
                <p class="pk-kicker">Version 2</p>
                <div class="pk-prose" dangerouslySetInnerHTML={{ __html: c.other ? quoteHtml(c.other, c.was) : '<p>(cut)</p>' }} />
                {!sheet && <button type="button" class="pk-primary pk-wide" onClick={() => choose('other')}>Use version 2</button>}
              </section>
            )}
          </>
        )}
        {(c.replies || []).length > 0 && (
          <section class="pk-replies">
            {(c.replies || []).map((r, k) => <p key={k}><span class="pk-kicker">You told the Writer</span>{r}</p>)}
            {made.length
              ? <p>{made.map((m) => <a key={m.id} class="pk-link" href={to.cards(ck, m.id)}>{'New card ' + m.id + (m.status === 'open' ? ': see it' : ': decided')}</a>)}</p>
              : replying ? <p class="pk-waiting">The Writer is making a new card from your reply. It shows here in a few minutes.</p>
                : replyProblem ? <p class="pk-error">{replyProblem}</p> : null}
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
            <button type="button" class="pk-primary" disabled={!sheet.words.trim()} onClick={() => choose(tweakStatus(c, sheet.words), sheet.words)}>Save and use</button>
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
            <button type="button" class="pk-primary" disabled={!sheet.words.trim()} onClick={() => send(sheet.words)}>Send to the Writer</button>
          </p>
          <label class="pk-label" for="pk-tell">Tell the Writer why</label>
          <textarea id="pk-tell" class="pk-box-text" rows={4} value={sheet.words} placeholder="Why you chose this, or what you want instead"
            onInput={(e) => setSheet({ ...sheet, words: (e.currentTarget as HTMLTextAreaElement).value })} />
          <p class="pk-quiet">The Writer reads your reply and makes a new card from it, here in this chapter. A paid team job; the Jobs page in Sparrow shows what it cost.{demo ? ' (In the sample nothing is sent.)' : ''}</p>
        </div>
      )}
      {!sheet && (
        <nav class="pk-bar" aria-label="This card">
          <button type="button" onClick={() => choose('no')}>Reject</button>
          <button type="button" disabled={!here} onClick={() => setSheet(two ? { kind: 'which' } : { kind: 'tweak', which: 'now', words: c.now })}>Tweak</button>
          <button type="button" onClick={() => setSheet({ kind: 'tell', words: '' })}>Tell the Writer</button>
          <a href={to.read(ck, c.id)}>In the chapter</a>
        </nav>
      )}
    </main>
  );
}

// ---- The chapter as a page ----

function ReadScreen({ vault, book, ch, cardId, banners }: { vault: PocketVault; book: BookEntry; ch: PocketChapter; cardId: string; banners: ComponentChildren }) {
  const [pick, setPick] = useState<{ scene: string; p: Paragraph } | null>(null);
  const [edit, setEdit] = useState<{ scene: string; p: Paragraph; words: string } | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const ck = chapterKey(ch);
  const textOf = (n: NoteRecord) => vault.bodyOf(n);
  const cards = ch.note ? deck(ch, textOf) : [];
  useEffect(() => {
    if (!cardId) return;
    const el = document.querySelector('[data-cards~="' + cardId.replace(/"/g, '') + '"]');
    if (el) el.scrollIntoView({ block: 'center' });
  }, [cardId]);
  const save = async () => {
    if (!edit) return;
    const scene = ch.scenes.find((s) => s.path === edit.scene);
    if (!scene) return;
    const body = vault.bodyOf(scene);
    let text: string;
    try { text = replaceParagraph(pageText(body), edit.p, edit.words); } catch (e) { setSaid({ ok: false, text: (e as Error).message }); return; }
    setBusy(true);
    const err = await vault.saveBody(scene, withPageText(body, text));
    setBusy(false);
    if (err) { setSaid({ ok: false, text: err }); return; }
    setEdit(null);
    setPick(null);
    setSaid({ ok: true, text: navigator.onLine ? 'Saved.' : 'Saved on this phone. It goes to the vault when the phone is online.' });
  };
  return (
    <main class={'pk pk-read' + (pick || edit ? ' pk-sheeted' : '')}>
      {banners}
      <header class="pk-nav pk-readhead">
        <a class="pk-navbtn" href={ch.note && ch.open ? to.cards(ck, cardId) : to.home}>{ch.note && ch.open ? '‹ Cards' : '‹ Chapters'}</a>
        <div class="pk-navtitle"><b>{'Chapter ' + ch.chapter + (ch.title ? ' · ' + ch.title : '')}</b><span>{cards.length ? 'Bars show where cards are' : 'Press a paragraph to change it'}</span></div>
        <span class="pk-navbtn" aria-hidden="true" />
      </header>
      {said && <p class={said.ok ? 'pk-note' : 'pk-error'} role="status">{said.text} <button type="button" class="pk-link" onClick={() => setSaid(null)}>Close</button></p>}
      {ch.scenes.map((s) => {
        const mine = cards.filter((d) => d.scene === s);
        return (
          <section key={s.path} class="pk-scene">
            {paragraphs(pageText(textOf(s)), mine).map((p) => {
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
            <button type="button" class="pk-primary" disabled={busy || edit.words === edit.p.text} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          </p>
          <textarea class="pk-box-text" rows={Math.min(14, Math.max(5, Math.ceil(edit.words.length / 30)))} value={edit.words} aria-label="Your paragraph"
            onInput={(e) => setEdit({ ...edit, words: (e.currentTarget as HTMLTextAreaElement).value })} />
          <p class="pk-quiet">Shown as it is stored: words between *stars* are in italics, and a line starting with &gt; is a System screen. Save changes only this paragraph of {book.title}.</p>
        </div>
      )}
    </main>
  );
}
