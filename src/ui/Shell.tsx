// The app's frame (redesigned with Kyle, 2026-10-21; design review, 2026-10-22): a sidebar on the left with the book
// open on screen (its cover and title, then the rooms Home, Plan, Write, Edit and Publish; the room on screen lists its
// pages beneath it, one level down; Write opens the writing screen at the last scene) and at the foot the Codex and
// Team (their pages open beneath them the same way), To-do, the Timer, Settings and a small sync line. Plan's first page, Steps, is the old Workflow mode.
// A top bar on every page holds the room and page (a menu of the room's pages), Find, and Team, which opens the team
// panel on the right of any page; the floating chat button is gone. From 1100 px wide the sidebar shows names beside
// the icons; from 700 px it is a narrow strip of icons, and the menu button opens it in full over the page; narrower
// still, the menu button sits in the top bar. Every size has every place.
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loadRecent } from '../lib/home.ts';
import { loadSideOpen, saveSideOpen } from '../lib/chat.ts';
import type { BookEntry, Schema, VaultIndex, VaultSource } from '../lib/types.ts';
import { Cover } from './Home.tsx';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';
import { LOWER_ROOMS, ROOMS, roomOf, isTeamPlace, TEAM_PLACES, type Room } from '../lib/rooms.ts';
import { jobNotes } from '../lib/jobs.ts';
import { taskNotes } from '../lib/tasks.ts';
import { roomLinks } from './Rooms.tsx';
import { useFlow } from './Flow.tsx';
import { FindButton } from './Find.tsx';

/** The scene to keep writing in a book: the one last opened on this device, or else the last scene with writing in it,
 * or else the first scene. */
export function keepWriting(index: VaultIndex, book: BookEntry, sourceKey: string): string | null {
  const recent = loadRecent(sourceKey).find((r) => book.scenes.indexOf(r.path) >= 0 && index.notes[r.path]);
  if (recent) return recent.path;
  const scenes = book.scenes.filter((p) => index.notes[p] && index.notes[p].data.kind !== 'test');
  const started = scenes.filter((p) => String(index.notes[p].data.status || 'planned') !== 'planned');
  return started.length ? started[started.length - 1] : scenes[0] || null;
}

export interface ShellProps {
  source: VaultSource;
  schema: Schema | null;
  index: VaultIndex | null;
  book: BookEntry | null;
  /** The board on screen, or '' when none. */
  board: string;
  /** Which of the app's own places is on screen: home, series, chat, jobs, todo, settings, team, skills, history, or ''. */
  place: string;
  /** The page's address (its hash), so a team member or skill on screen shows as current. */
  at?: string;
  demo: boolean;
  sync: { label: string; title: string; good: boolean; warn: boolean; busy: boolean; onSync: () => void };
  /** The page's name for the slim top bar. */
  title: string;
  /** The team chat column for this page, given a way to hide it; none on pages that are themselves the chat. */
  side?: ((close: () => void) => ComponentChildren) | null;
  /** The Pomodoro timer, given where it sits: the sidebar's foot, or the slim top bar on a phone. One timer at a time. */
  timer?: (where: 'rail' | 'bar') => ComponentChildren;
  children: ComponentChildren;
}

const WIDE_SIDE = '(min-width: 1200px)';

const SLIM = '(max-width: 699px)';

// The app's sparrow: the same bird and colours as the icons drawn by scripts/make-icons.js (Kyle's pick, 2026-10-22).
// Its colours stay the same in every theme, like the home-screen icon.
function SparrowMark() {
  return (
    <svg viewBox="0 0 512 512" width="32" height="32">
      <rect width="512" height="512" rx="112" fill="#b5532f" />
      <path d="M120 384 L392 384" stroke="#2b2522" stroke-width="10" stroke-linecap="round" />
      <path d="M378 156 L432 170 L380 184 C384 250 346 310 276 326 C242 336 208 328 190 310 L82 358 L68 340 L166 272 C176 210 216 146 266 124 C316 102 366 116 378 156 Z" fill="#fbf3e6" />
      <path d="M200 286 C256 290 312 260 328 212" stroke="#b5532f" stroke-width="12" fill="none" stroke-linecap="round" />
      <circle cx="342" cy="160" r="11" fill="#b5532f" />
    </svg>
  );
}

export function Shell({ source, schema, index, book, board, place, at = '', demo, sync, title, side, timer, children }: ShellProps) {
  const [slim, setSlim] = useState(() => typeof matchMedia === 'function' && matchMedia(SLIM).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(SLIM);
    const on = () => setSlim(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  const [open, setOpen] = useState(false);
  // Beside the page (1200 px and wider) the team column stays as Kyle left it. Narrower it lies over the page, so it
  // opens only when Kyle presses Team, and leaving a page or the window narrowing closes it (Kyle's screenshot,
  // 2026-10-22: after leaving the writing screen in split view it covered half of Home).
  const [sideOpen, setSideOpenState] = useState(() => typeof matchMedia === 'function' && matchMedia(WIDE_SIDE).matches && loadSideOpen(true));
  const setSideOpen = (v: boolean) => { setSideOpenState(v); if (matchMedia(WIDE_SIDE).matches) saveSideOpen(v); };
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(WIDE_SIDE);
    const on = () => setSideOpenState(m.matches && loadSideOpen(true));
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  const showSide = Boolean(side) && sideOpen;
  const flow = useFlow(index, book);
  const hash = typeof location === 'undefined' ? '' : location.hash;
  const [pagesOpen, setPagesOpen] = useState(false);
  useEffect(() => {
    const close = () => { setOpen(false); setPagesOpen(false); if (!matchMedia(WIDE_SIDE).matches) setSideOpenState(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false); setPagesOpen(false);
      // Over the page (narrow screens), Escape hides the team panel too; beside it, the panel stays.
      if (!matchMedia(WIDE_SIDE).matches && document.querySelector('.shell.side-open')) setSideOpen(false);
    };
    window.addEventListener('hashchange', close);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('hashchange', close); window.removeEventListener('keydown', key); };
  }, []);

  const links = book && schema ? roomLinks(schema, book.folder, false) : {};
  const running = index ? jobNotes(index).some((n) => n.data.status === 'running') : false;
  const openTodos = index ? taskNotes(index).filter((n) => ['open', 'doing'].indexOf(String(n.data.status || 'open')) >= 0).length : 0;
  const onSteps = Boolean(book) && hash.indexOf(href.flow(book ? book.folder : '')) === 0;
  const inRoom = onSteps ? roomOf('steps') : roomOf(board);
  const pageKey = onSteps ? 'steps' : board;
  const teamTo: Record<string, string> = { chat: href.chat(), jobs: href.jobs(), team: href.team(), skills: href.skills(), recipes: href.recipes(), workflow: href.workflow() };
  const teamOn = place === 'history' ? 'team' : place;
  const inTeam = isTeamPlace(place);
  const item = (to: string, icon: string, label: string, current: boolean, extra?: string, count?: number) => (
    <a key={to + label} class={'rail-item' + (extra ? ' ' + extra : '')} href={to} aria-current={current ? 'page' : undefined} title={count == null ? label : label + ' (' + count + ')'}>
      <Icon name={icon} size={20} /><span class="rail-label">{label}</span>{extra && extra.indexOf('rail-busy') >= 0 && <span class="job-dot" aria-hidden="true" />}{count != null && <span class="rail-count rail-label">{count}</span>}
    </a>
  );
  const sub = (to: string, label: string, current: boolean, count?: number) => (
    <a key={to + label} class="rail-sub" href={to} aria-current={current ? 'page' : undefined}>
      <span class="rail-label">{label}</span>{count ? <span class="rail-count">{count}</span> : null}
    </a>
  );
  // The pages of the room (or Team) on screen, for the sidebar and the top bar's menu.
  const pages: { to: string; title: string; current: boolean; count?: number }[] = inTeam
    ? TEAM_PLACES.map((p) => ({ to: teamTo[p.key], title: p.title, current: p.key === teamOn }))
    : inRoom ? inRoom.boards.map((k) => links[k]).filter(Boolean).map((l) => ({ to: l.to, title: l.title, current: l.key === pageKey, count: l.key === 'steps' ? flow.waiting : undefined })) : [];
  // A room in the sidebar, with its pages beneath it when it is on screen. Write has no pages: it opens the writing
  // screen at the scene to keep writing, or the Chapter Grid when the book has no scenes yet.
  const roomItem = (r: Room) => {
    if (!book || !index) return null;
    if (r.key === 'write') {
      const scene = keepWriting(index, book, source.key);
      const to = scene ? href.write(scene) : links['chapter-grid'] ? links['chapter-grid'].to : '';
      return to ? <div key={r.key} class="rail-room-group">{item(to, r.icon, r.title, false, 'rail-room')}</div> : null;
    }
    const first = r.boards.map((k) => links[k]).find(Boolean);
    if (!first) return null;
    const here = Boolean(inRoom && inRoom.key === r.key);
    const to = r.key === 'plan' ? links.ideas ? links.ideas.to : first.to : first.to;
    return (
      <div key={r.key} class={'rail-room-group' + (here ? ' here' : '')}>
        {item(to, r.icon, r.title, here && pages.length < 2, 'rail-room' + (here ? ' rail-room-here' : ''), r.key === 'plan' && flow.waiting ? flow.waiting : undefined)}
        {here && pages.length > 1 && <div class="rail-subs">{pages.map((p) => sub(p.to, p.title, p.current, p.count))}</div>}
      </div>
    );
  };
  const roomTitle = inTeam ? 'Team' : inRoom ? inRoom.title : '';
  const pageTitle = (pages.find((p) => p.current) || { title: '' }).title;
  const barTitle = roomTitle ? (pageTitle && pageTitle !== roomTitle && pages.length > 1 ? roomTitle + ' · ' + pageTitle : roomTitle) : title;
  const teamButton = side
    ? <button type="button" class={'top-team' + (showSide ? ' on' : '')} aria-pressed={showSide} onClick={() => setSideOpen(!showSide)}><Icon name="spark" size={20} /><span class="top-team-label">Team</span></button>
    : <a class="top-team" href={href.chat()}><Icon name="spark" size={20} /><span class="top-team-label">Team</span></a>;

  return (
    <div class={'shell' + (open ? ' rail-open' : '') + (side ? ' has-side' : '') + (showSide ? ' side-open' : '')}>
      <aside class="rail" aria-label="Sparrow">
        <div class="rail-head">
          <a class="brand" href="#/" title="Sparrow home"><span class="brand-mark" aria-hidden="true"><SparrowMark /></span><span class="rail-label brand-name">Sparrow</span></a>
          <button type="button" class="rail-toggle" aria-label={open ? 'Close the menu' : 'Open the menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'close' : 'panel'} size={20} />
          </button>
        </div>
        <nav class="rail-scroll" aria-label="Places">
          {!(book && index) && (
            <>
              {item(href.home(), 'books', 'Books', place === 'home')}
              {item(href.allSeries(), 'shelf', 'Series', place === 'series')}
            </>
          )}
          {book && index && (
            <>
              <div class="rail-book">
                <a class="rail-book-link" href={href.board('overview', book.folder)} title={book.title}>
                  <Cover source={source} book={book} small />
                  <span class="rail-book-text rail-label">
                    <span class="rail-book-title">{book.title}</span>
                    <span class="rail-book-series">{book.seriesName}{book.number != null ? ' · Book ' + book.number : ''}</span>
                  </span>
                </a>
                <a class="rail-book-switch rail-label" href={href.home()} title="All books and series" aria-label="All books and series"><Icon name="books" size={18} /></a>
              </div>
              {ROOMS.filter((r) => LOWER_ROOMS.indexOf(r.key) < 0).map(roomItem)}
            </>
          )}
          <div class="rail-foot">
            {book && index && ROOMS.filter((r) => LOWER_ROOMS.indexOf(r.key) >= 0).map(roomItem)}
            {item(href.chat(), 'spark', 'Team', false, (running ? 'rail-busy' : '') + (inTeam ? ' rail-room-here' : '') || undefined)}
            {inTeam && <div class="rail-subs">{pages.map((p) => sub(p.to, p.title, p.current))}</div>}
            {item(href.todo(), 'todo', 'To-do', place === 'todo', undefined, openTodos || undefined)}
            {timer && !slim && timer('rail')}
            {item(href.settings(), 'gear', 'Settings', place === 'settings')}
            {demo && item(href.settings(), 'demo', 'Demo vault', false, 'rail-demo')}
            <button type="button" class={'rail-sync-line' + (sync.good ? ' good' : '') + (sync.warn ? ' warn' : '')} onClick={sync.onSync} disabled={sync.busy} title={sync.title}>
              <span class="sync-dot" aria-hidden="true" /><span class="rail-label">{sync.label}</span>
            </button>
          </div>
        </nav>
      </aside>
      <button type="button" class="rail-backdrop" aria-label="Close the menu" tabIndex={-1} onClick={() => setOpen(false)} />
      <div class="shell-main">
        <header class="top-bar">
          <button type="button" class="icon-button top-menu" aria-label="Open the menu" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button>
          <div class="top-title">
            {pages.length > 1 ? (
              <>
                <button type="button" class="top-title-button" aria-expanded={pagesOpen} onClick={() => setPagesOpen(!pagesOpen)}>
                  <span class="top-title-text">{barTitle}</span><Icon name="down" size={18} />
                </button>
                {pagesOpen && (
                  <>
                    <button type="button" class="top-pages-backdrop" aria-label="Close" tabIndex={-1} onClick={() => setPagesOpen(false)} />
                    <nav class="top-pages" aria-label={roomTitle}>
                      {pages.map((p) => <a key={p.to + p.title} href={p.to} aria-current={p.current ? 'page' : undefined}>{p.title}{p.count ? <span class="rail-count">{p.count}</span> : null}</a>)}
                    </nav>
                  </>
                )}
              </>
            ) : <span class="top-title-text">{barTitle}</span>}
          </div>
          {index && book && <FindButton index={index} book={book} />}
          {timer && slim && timer('bar')}
          {slim && (
            <button type="button" class={'icon-button rail-sync' + (sync.good ? ' good' : '') + (sync.warn ? ' warn' : '')} onClick={sync.onSync} disabled={sync.busy} title={sync.title} aria-label={sync.label}>
              <Icon name={sync.good ? 'check' : 'sync'} />
            </button>
          )}
          {index && teamButton}
        </header>
        {children}
      </div>
      {side && showSide && (
        <>
          <button type="button" class="side-backdrop" aria-label="Hide the team panel" tabIndex={-1} onClick={() => setSideOpen(false)} />
          {side(() => setSideOpen(false))}
        </>
      )}
    </div>
  );
}
