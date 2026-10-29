// The home page, like Novelcrafter's "Your Novels": Books or Series at the top, the scenes Kyle wrote in last,
// then every book as a cover card (or a list), with search and sort. A series page shows its books and its notes.
import { useEffect, useState } from 'preact/hooks';
import { sceneLabel } from '../lib/board.ts';
import { coverUrl } from '../lib/covers.ts';
import { timeAgo } from '../lib/format.ts';
import {
  bookChapters, bookWords, continueList, coverPattern, lastWorked, loadRecent, readingLine, loadRates, sortBooks, type BookSort
} from '../lib/home.ts';
import { toNumber } from '../lib/links.ts';
import type { BookEntry, Schema, SeriesEntry, VaultIndex, VaultSource } from '../lib/types.ts';
import { buildDocx, exportName, manuscript, saveBackup } from '../lib/docx.ts';
import { activeBook } from '../lib/vault-index.ts';
import { chaptersDone, storyScenes } from '../lib/overview.ts';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';
import { IdeasLink, Warnings } from './screens.tsx';
import { StageStrip } from './Overview.tsx';
import type { Decision } from '../lib/ideas.ts';
import { nextBookNumber } from '../lib/books.ts';
import { safeTitle } from '../lib/scenes.ts';

type OnCreateBook = (seriesFolder: string, seriesName: string, title: string, number: number) => Promise<string | null>;
type OnCreateSeries = (name: string, genre: string) => Promise<string | null>;

/** Start a book: in a series the vault has, or in a new series made first. Or start only a series. */
export function CreateForm({ index, onCreateBook, onCreateSeries, seriesFolder, onClose }: {
  index: VaultIndex; onCreateBook?: OnCreateBook; onCreateSeries?: OnCreateSeries; seriesFolder?: string; onClose: () => void;
}) {
  const NEW = '__new__';
  const [series, setSeries] = useState(seriesFolder || (index.series[0] ? index.series[0].folder : NEW));
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('');
  const [title, setTitle] = useState('');
  const books = index.books.filter((b) => b.seriesFolder === series);
  const [number, setNumber] = useState(String(nextBookNumber(books.map((b) => b.number))));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickSeries = (f: string) => { setSeries(f); setNumber(String(nextBookNumber(index.books.filter((b) => b.seriesFolder === f).map((b) => b.number)))); };
  const go = async (bookToo: boolean) => {
    setBusy(true);
    setError(null);
    let folder = series, sname = (index.series.find((x) => x.folder === series) || { name: '' }).name;
    if (series === NEW) {
      if (!onCreateSeries) return;
      // Make the series first; its page opens, then the book is added to it.
      const err = await onCreateSeries(name, genre);
      if (err) { setError(err); setBusy(false); return; }
      folder = 'Series/' + safeTitle(name);
      sname = safeTitle(name);
      if (!bookToo) { setBusy(false); onClose(); return; }
    }
    const err = onCreateBook ? await onCreateBook(folder, sname, title, parseInt(number, 10)) : null;
    setBusy(false);
    if (err) setError(err); else onClose();
  };
  return (
    <div class="create-form">
      <h2>Start something new</h2>
      <label class="reason">
        Series
        <select value={series} onChange={(e) => pickSeries((e.currentTarget as HTMLSelectElement).value)}>
          {index.series.map((x) => <option key={x.folder} value={x.folder}>{x.name}</option>)}
          <option value={NEW}>A new series…</option>
        </select>
      </label>
      {series === NEW && (
        <>
          <label class="reason">Name of the new series<input type="text" value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} placeholder="For example Ember Road" /></label>
          <label class="reason">Genre (you can leave it empty)<input type="text" value={genre} onInput={(e) => setGenre((e.currentTarget as HTMLInputElement).value)} placeholder="For example Cozy LitRPG" /></label>
        </>
      )}
      <label class="reason">Title of the book<input type="text" value={title} onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} placeholder="A working title is fine" /></label>
      <label class="reason">Book number in the series<input type="text" inputMode="numeric" value={number} onInput={(e) => setNumber((e.currentTarget as HTMLInputElement).value)} /></label>
      <div class="buttons">
        <button type="button" class="primary" disabled={busy || !title.trim() || (series === NEW && !name.trim()) || !(parseInt(number, 10) > 0)} onClick={() => go(true)}>{busy ? 'Starting…' : 'Create book'}</button>
        {series === NEW && <button type="button" disabled={busy || !name.trim()} onClick={() => go(false)}>Create only the series</button>}
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
      {error && <p class="error">{error}</p>}
    </div>
  );
}

const num = (n: number) => n.toLocaleString('en-US');

function loadPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try { const v = localStorage.getItem('story-forge.' + key) as T | null; return v && allowed.indexOf(v) >= 0 ? v : fallback; } catch { return fallback; }
}
function savePref(key: string, v: string) {
  try { localStorage.setItem('story-forge.' + key, v); } catch { /* lasts until reload */ }
}

/** The book's cover picture, or a pattern made from its title while there is none (or it is still loading). */
export function Cover({ source, book, small }: { source: VaultSource; book: BookEntry; small?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const sha = book.cover ? book.cover.sha : '';
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (sha) coverUrl(source, book).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [source, sha]);
  return (
    <span class={'cover' + (small ? ' small' : '')} style={url ? undefined : coverPattern(book.title)} aria-hidden="true">
      {url ? <img src={url} alt="" /> : !small && <span class="cover-title">{book.title}</span>}
    </span>
  );
}

/** Book details, like Novelcrafter's novel settings (the cog by the novel's name): the cover, added or changed from the
 * device, with the book's name, series and stage. */
export function BookDetails({ source, book, onCover, schema, index, onDecide }: {
  source: VaultSource; book: BookEntry; onCover?: (book: BookEntry, file: File) => Promise<string | null>; schema: Schema; index: VaultIndex;
  /** Changes the book's stage (the stage pills moved here from Home and the Chapter Grid, design review 2026-10-22). */
  onDecide?: (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <section class="book-details">
      <p class="crumb"><a href={href.series(book.seriesFolder)}>{book.seriesName}</a> · <a href={href.book(book.folder)}>{book.title}</a></p>
      <h1>Book details</h1>
      <h2 class="details-stage">The book's stage</h2>
      <StageStrip schema={schema} index={index} book={book} onDecide={onDecide} />
      <div class="details-body">
        <div class="details-cover">
          <Cover source={source} book={book} />
          {onCover && (
            <label class={'button' + (busy ? ' disabled' : '')}>
              <Icon name="image" size={18} />{busy ? 'Saving…' : book.cover ? 'Change cover' : 'Add a cover'}
              <input type="file" accept="image/*" class="visually-hidden" disabled={busy} onChange={async (e) => {
                const input = e.currentTarget as HTMLInputElement;
                const file = input.files && input.files[0];
                input.value = '';
                if (!file) return;
                setBusy(true);
                setSaved(false);
                const problem = await onCover(book, file);
                setError(problem);
                setSaved(!problem);
                setBusy(false);
              }} />
            </label>
          )}
          {error && <p class="error">{error}</p>}
          {saved && <p class="meta">Saved. The app shows a small copy; the full-size picture is kept in the book's Cover folder.</p>}
        </div>
        <dl class="details-list">
          <dt>Title</dt><dd>{book.title}</dd>
          <dt>Series</dt><dd>{book.seriesName}{book.number != null ? ', book ' + book.number : ''}</dd>
          <dt>Stage</dt><dd>{book.stage}</dd>
        </dl>
      </div>
      <ExportWord source={source} schema={schema} index={index} book={book} />
    </section>
  );
}

/** Hand a .docx made on this device to the browser's downloads. */
export function downloadWord(bytes: Uint8Array<ArrayBuffer>, name: string) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Export to Word (Kyle, 2026-10-18): the whole book as a .docx named series_book_date, made on this device and
 * downloaded; italics and bold come through. Shown on Book details and, as a card, on Publish's first page, the Market
 * board (Kyle, 2026-10-23: he could not find it behind the page menu). */
export function ExportWord({ source, schema, index, book, card }: { source: VaultSource; schema: Schema; index: VaultIndex; book: BookEntry; card?: boolean }) {
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const [backup, setBackup] = useState<{ error: boolean; text: string } | null>(null);
  const run = () => {
    try {
      const m = manuscript(schema, index, book);
      if (!m.scenes) { setSaid({ error: true, text: 'This book has no written scenes yet, so there is nothing to export.' }); return; }
      const data = index.notes[book.path] ? index.notes[book.path].data : {};
      const name = exportName(book);
      const bytes = buildDocx(book.title, typeof data.author === 'string' ? data.author : '', m) as Uint8Array<ArrayBuffer>;
      downloadWord(bytes, name);
      setSaid({ error: false, text: 'Made ' + name + ': ' + m.chapters.length + (m.chapters.length === 1 ? ' chapter, ' : ' chapters, ') + num(m.words) + ' words. Look for it in your downloads.' });
      // A copy goes into the vault's Book Backups folder too (Kyle, 2026-10-18).
      if (source.writeBytes) {
        setBackup({ error: false, text: 'Saving a backup copy in the vault…' });
        saveBackup(source, book, bytes, name)
          .then((path) => setBackup({ error: false, text: 'Backup saved in the vault: ' + path.split('/').slice(0, -1).join(' › ') + '.' }))
          .catch((e) => setBackup({ error: true, text: 'The download worked, but the backup copy did not save: ' + (e instanceof Error ? e.message : String(e)) + ' Press Export to Word again when you are back online.' }));
      }
    } catch (e) {
      setSaid({ error: true, text: 'The Word file could not be made: ' + (e instanceof Error ? e.message : String(e)) });
    }
  };
  return (
    <div class={'details-export' + (card ? ' export-card' : '')}>
      <h2>{card ? 'Export the whole book' : 'Export'}</h2>
      <p class="hint">The whole book in reading order as a Word file, with its italics and bold. A copy is saved in the vault's Book Backups folder. Scenes still open in the writing screen export as last saved.</p>
      <button type="button" onClick={run}><Icon name="download" size={18} />Export to Word</button>
      {said && <p class={said.error ? 'error' : 'hint'} role="status">{said.text}</p>}
      {backup && <p class={backup.error ? 'error' : 'hint'} role="status">{backup.text}</p>}
    </div>
  );
}

const STAGE_DONE = ['publish', 'done'];

function stageDot(stage: string): string {
  return STAGE_DONE.indexOf(stage) >= 0 ? 'dot-done' : stage === 'draft' || stage === 'revise' || stage === 'polish' ? 'dot-going' : 'dot-early';
}

/** One book as a tall cover card (or a row in the list). */
function BookCard({ source, index, book, list }: { source: VaultSource; index: VaultIndex; book: BookEntry; list: boolean }) {
  const words = bookWords(index, book);
  const chapters = bookChapters(index, book);
  const data = index.notes[book.path] ? index.notes[book.path].data : {};
  const target = toNumber(data.target_words);
  const active = activeBook(index);
  // Progress counts only chapters Kyle has marked done (Kyle, 2026-10-22).
  const done = chaptersDone(storyScenes(index, book));
  const line = [
    'stage ' + book.stage,
    chapters ? done.done + ' of ' + chapters + (chapters === 1 ? ' chapter' : ' chapters') + ' done' : book.scenes.length + (book.scenes.length === 1 ? ' scene' : ' scenes'),
    words ? num(words) + ' words' : ''
  ].filter(Boolean).join(' · ');
  return (
    <li class={list ? 'book-row' : 'book-card'}>
      <a href={href.board('overview', book.folder)}>
        <Cover source={source} book={book} small={list} />
        <span class="book-text">
          <span class="meta">{book.seriesName}{book.number != null ? ' · Book ' + book.number : ''}{active && active.folder === book.folder ? ' · active book' : ''}</span>
          <span class="book-title">{book.title}</span>
          <span class="meta"><span class={'dot ' + stageDot(book.stage)} />{line}</span>
          {target && words ? <span class="book-progress" title={num(done.words) + ' of ' + num(target) + ' words in done chapters'}><span style={{ width: Math.min(100, Math.round(done.words * 100 / target)) + '%' }} /></span> : null}
        </span>
      </a>
      <IdeasLink index={index} book={book} />
    </li>
  );
}

function BookGrid({ source, index, books, list, onNew }: { source: VaultSource; index: VaultIndex; books: BookEntry[]; list: boolean; onNew?: () => void }) {
  return (
    <ul class={list ? 'book-rows' : 'book-cards'}>
      {onNew && !list && (
        <li class="book-card new-tile">
          <button type="button" onClick={onNew}><span class="new-cover"><Icon name="plus" size={28} /><span>New book</span></span></button>
        </li>
      )}
      {books.map((b) => <BookCard key={b.folder} source={source} index={index} book={b} list={list} />)}
    </ul>
  );
}

function Tabs({ series }: { series: boolean }) {
  return (
    <nav class="line-tabs" aria-label="Show">
      <a href={href.home()} aria-current={series ? undefined : 'page'}><Icon name="books" size={18} />Books</a>
      <a href={href.allSeries()} aria-current={series ? 'page' : undefined}><Icon name="shelf" size={18} />Series</a>
    </nav>
  );
}

const SORTS: readonly BookSort[] = ['recent', 'name', 'series'];
const VIEWS = ['covers', 'list'] as const;

/** The home page: Books (with Continue where you left off) or Series. */
export function Home({ source, index, series, onCreateBook, onCreateSeries }: { source: VaultSource; index: VaultIndex; series: boolean; onCreateBook?: OnCreateBook; onCreateSeries?: OnCreateSeries }) {
  const [creating, setCreating] = useState(false);
  const create = onCreateBook && (creating
    ? <CreateForm index={index} onCreateBook={onCreateBook} onCreateSeries={onCreateSeries} onClose={() => setCreating(false)} />
    : <button type="button" class="primary new-button" onClick={() => setCreating(true)}><Icon name="plus" size={18} />{series ? 'New series or book' : 'New book'}</button>);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<BookSort>(() => loadPref('home-sort', SORTS, 'recent'));
  const [view, setView] = useState<'covers' | 'list'>(() => loadPref('home-view', VIEWS, 'covers'));
  const recent = loadRecent(source.key);
  const worked = lastWorked(index, recent);
  const rates = loadRates();

  if (!index.books.length) {
    return (
      <section class="home">
        <h1 class="home-title">Your Books</h1>
        <div class="empty-box">
          <h2>Nothing here yet</h2>
          <p>Start your first book here. To bring in a manuscript you already wrote, start the book, then use Bring in a manuscript on its page.</p>
          {create}
        </div>
      </section>
    );
  }

  const tools = (
    <div class="home-tools">
      <label class="search">
        <span class="visually-hidden">Search books or series</span>
        <input type="search" value={query} placeholder={series ? 'Search series…' : 'Search books or series…'} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
      </label>
      {!series && (
        <label class="select">
          <span class="visually-hidden">Sort by</span>
          <select value={sort} onChange={(e) => { const v = (e.currentTarget as HTMLSelectElement).value as BookSort; setSort(v); savePref('home-sort', v); }}>
            <option value="recent">Last worked on</option>
            <option value="name">Name</option>
            <option value="series">Series and number</option>
          </select>
        </label>
      )}
      <div class="seg small" role="group" aria-label="View as">
        {VIEWS.map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); savePref('home-view', v); }}>{v === 'covers' ? 'Covers' : 'List'}</button>
        ))}
      </div>
    </div>
  );

  if (series) {
    const q = query.trim().toLowerCase();
    const list = index.series.filter((s) => !q || s.name.toLowerCase().indexOf(q) >= 0 || index.books.some((b) => b.seriesFolder === s.folder && b.title.toLowerCase().indexOf(q) >= 0));
    return (
      <section class="home">
        <div class="home-head"><div><h1 class="home-title">Your Series</h1>
        <p class="home-sub">Every series and the books in it.</p></div>{!creating && create}</div>
        {creating && create}
        <Tabs series />
        {tools}
        {!list.length && <p class="empty">No series matches "{query}".</p>}
        <ul class={view === 'list' ? 'book-rows' : 'series-cards'}>
          {list.map((s) => <SeriesCard key={s.folder} source={source} index={index} series={s} list={view === 'list'} />)}
        </ul>
      </section>
    );
  }

  const go = continueList(index, recent);
  const active = activeBook(index);
  const books = sortBooks(index.books.slice(), query, sort, worked);
  return (
    <section class="home">
      <div class="home-head"><div><h1 class="home-title">Your Books</h1>
      <p class="home-sub">Which one do you want to work on today?</p></div>{!creating && create}</div>
      {creating && create}
      <Tabs series={false} />
      {(go.length > 0 || active) && (
        <>
          <p class="home-label">Continue where you left off</p>
          <ul class="continue">
            {go.length ? go.map(({ note, book, at }) => {
              const named = sceneLabel(book.scenes.map((p) => index.notes[p]).filter(Boolean), note);
              return (
                <li key={note.path}>
                  <a href={href.write(note.path)}>
                    <span class="book-title">{book.title}</span>
                    <span class="meta">{[named.chapter, named.scene].filter(Boolean).join(' · ')}</span>
                    <span class="meta">{timeAgo(at)}</span>
                    <span class="go">Keep writing <Icon name="right" size={16} /></span>
                  </a>
                </li>
              );
            }) : active && (
              <li>
                <a href={href.board('overview', active.folder)}>
                  <span class="book-title">{active.title}</span>
                  <span class="meta">The active book · {readingLine(bookWords(index, active), rates) || 'no words yet'}</span>
                  <span class="go">Open the book <Icon name="right" size={16} /></span>
                </a>
              </li>
            )}
          </ul>
        </>
      )}
      {tools}
      {!books.length && <p class="empty">No book matches "{query}".</p>}
      <BookGrid source={source} index={index} books={books} list={view === 'list'} onNew={onCreateBook && !creating ? () => { setCreating(true); window.scrollTo(0, 0); } : undefined} />
      <Warnings list={index.warnings} />
    </section>
  );
}

function seriesBooks(index: VaultIndex, s: SeriesEntry): BookEntry[] {
  return index.books.filter((b) => b.seriesFolder === s.folder);
}

function SeriesCard({ source, index, series, list }: { source: VaultSource; index: VaultIndex; series: SeriesEntry; list: boolean }) {
  const books = seriesBooks(index, series);
  const words = books.reduce((n, b) => n + bookWords(index, b), 0);
  return (
    <li class={list ? 'book-row' : 'series-card'}>
      <a href={href.series(series.folder)}>
        <span class="cover-row">
          {books.slice(0, list ? 1 : 4).map((b) => <Cover key={b.folder} source={source} book={b} small />)}
          {!books.length && <span class="cover small" style={coverPattern(series.name)} />}
        </span>
        <span class="book-text">
          <span class="book-title">{series.name}</span>
          {series.genre && <span class="meta">{series.genre}</span>}
          <span class="meta">{books.length === 1 ? '1 book' : books.length + ' books'}{words ? ' · ' + num(words) + ' words' : ''}{series.status ? ' · ' + series.status : ''}</span>
        </span>
      </a>
    </li>
  );
}

/** One series: its books, and the series notes the boards show. */
export function SeriesPage({ source, index, folder, onCreateBook }: { source: VaultSource; index: VaultIndex; folder: string; onCreateBook?: OnCreateBook }) {
  const [creating, setCreating] = useState(false);
  const s = index.series.find((x) => x.folder === folder);
  if (!s) return <p class="empty">That series is not in the vault. <a href={href.allSeries()}>See every series</a>.</p>;
  const books = seriesBooks(index, s);
  const words = books.reduce((n, b) => n + bookWords(index, b), 0);
  const base = books.find((b) => activeBook(index) && activeBook(index)!.folder === b.folder) || books[books.length - 1];
  const chars = (s.characters || []).length, market = (s.market || []).length, rocket = (s.rocket || []).length;
  return (
    <section class="home">
      <p class="crumb"><a href={href.allSeries()}>Series</a></p>
      <h1>{s.name}</h1>
      <p class="meta">{[s.genre, books.length === 1 ? '1 book' : books.length + ' books', words ? num(words) + ' words' : '', readingLine(words, loadRates())].filter(Boolean).join(' · ')}</p>
      <h2>Books</h2>
      {onCreateBook && (creating
        ? <CreateForm index={index} onCreateBook={onCreateBook} seriesFolder={folder} onClose={() => setCreating(false)} />
        : <div class="buttons"><button type="button" onClick={() => setCreating(true)}><Icon name="plus" size={18} />New book in {s.name}</button></div>)}
      {books.length ? <BookGrid source={source} index={index} books={books} list={false} />
        : <div class="empty-box"><h2>Nothing here yet</h2><p>This series has no books yet.</p></div>}
      {base && (
        <>
          <h2>Shared by every book</h2>
          <ul class="series-links">
            <li><a class="button" href={href.board('characters', base.folder)}><Icon name="people" size={18} />Characters{chars ? ' (' + chars + ')' : ''}</a></li>
            <li><a class="button" href={href.board('market', base.folder)}><Icon name="market" size={18} />Market{market || rocket ? ' (' + [market ? market + ' notes' : '', rocket ? rocket + ' Rocket files' : ''].filter(Boolean).join(', ') + ')' : ''}</a></li>
            <li><a class="button" href={href.note(s.path)}><Icon name="books" size={18} />The series note</a></li>
          </ul>
        </>
      )}
    </section>
  );
}
