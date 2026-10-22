// The app's frame (redesigned with Kyle, 2026-10-21; design review, 2026-10-22): a sidebar on the left with the book
// open on screen (its cover and title, then six rooms: Home, Manuscript, Plan, Codex, Review and Publish; the room on
// screen lists its pages beneath it, one level down) and at the foot Team (its pages open beneath it the same way),
// To-do, the Timer, Settings and a small sync line. Plan's first page, Steps, is the old Workflow mode.
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
import { ROOMS, roomOf, isTeamPlace, TEAM_PLACES } from '../lib/rooms.ts';
import { jobNotes } from '../lib/jobs.ts';
import { taskNotes } from '../lib/tasks.ts';
import { roomLinks } from './Rooms.tsx';
import { useFlow } from './Flow.tsx';
import { FindButton } from './Find.tsx';

/** The scene to keep writing in a book: the one last opened on this device, or else the first scene. */
export function keepWriting(index: VaultIndex, book: BookEntry, sourceKey: string): string | null {
  const recent = loadRecent(sourceKey).find((r) => r.path.startsWith(book.folder + '/') && index.notes[r.path]);
  if (recent) return recent.path;
  const first = book.scenes.find((p) => index.notes[p] && index.notes[p].data.kind !== 'test');
  return first || null;
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

/** A stage's name for the sidebar: the part after the colon ("Story planning: premise and cast seeds" is "Premise and cast seeds"). */
export function shortStage(title: string): string {
  const at = title.indexOf(':');
  const t = at >= 0 ? title.slice(at + 1).trim() : title.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : title;
}

const SLIM = '(max-width: 699px)';

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
  const [sideOpen, setSideOpenState] = useState(() => loadSideOpen(typeof matchMedia === 'function' && matchMedia(WIDE_SIDE).matches));
  const setSideOpen = (v: boolean) => { setSideOpenState(v); saveSideOpen(v); };
  const showSide = Boolean(side) && sideOpen;
  const flow = useFlow(index, book);
  const hash = typeof location === 'undefined' ? '' : location.hash;
  const [pagesOpen, setPagesOpen] = useState(false);
  useEffect(() => {
    const close = () => { setOpen(false); setPagesOpen(false); };
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
  const roomTitle = inTeam ? 'Team' : inRoom ? inRoom.title : '';
  const pageTitle = (pages.find((p) => p.current) || { title: '' }).title;
  const barTitle = roomTitle ? (pageTitle && pageTitle !== roomTitle && pages.length > 1 ? roomTitle + ' · ' + pageTitle : roomTitle) : title;
  const teamButton = side
    ? <button type="button" class={'top-team' + (showSide ? ' on' : '')} aria-pressed={showSide} onClick={() => setSideOpen(!showSide)}><Icon name="spark" size={20} /><span class="top-team-label">Team</span></button>
    : <a class="top-team" href={href.chat()}><Icon name="spark" size={20} /><span class="top-team-label">Team</span></a>;

  return (
    <div class={'shell' + (open ? ' rail-open' : '') + (side ? ' has-side' : '') + (showSide ? ' side-open' : '')}>
      <aside class="rail" aria-label="Story Forge">
        <div class="rail-head">
          <a class="brand" href="#/" title="Story Forge home"><span class="brand-mark" aria-hidden="true">SF</span><span class="rail-label brand-name">Story Forge</span></a>
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
              {ROOMS.map((r) => {
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
              })}
            </>
          )}
          <div class="rail-foot">
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
