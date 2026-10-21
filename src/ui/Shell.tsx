// The app's frame (redesigned with Kyle, 2026-10-21): a sidebar on the left with the book open on screen (its cover and
// title, the Workflow | Writing switch, then six rooms: Home, Manuscript, Plan, Codex, Review and Publish, whose boards
// show as tabs at the top of each room) and at the foot Team (Chat, Jobs, Agents, Skills, Recipes and the Workflow
// table, as tabs), To-do, Settings and a small sync line. In Workflow mode the stages come first and the rooms follow.
// From 1100 px wide the sidebar shows names beside the icons; from 700 px it is a narrow strip of icons with short
// names, and the menu button opens it in full over the page; narrower still, a slim bar with the menu button sits at
// the top. Every size has every place. On the right, the team chat sits beside the page from 1200 px wide and slides
// over it narrower; a round Chat button at the bottom right opens it, and its arrow hides it (per device).
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loadRecent } from '../lib/home.ts';
import { loadSideOpen, saveSideOpen } from '../lib/chat.ts';
import type { BookEntry, Schema, VaultIndex, VaultSource } from '../lib/types.ts';
import { Cover } from './Home.tsx';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';
import { ROOMS, roomOf, isTeamPlace } from '../lib/rooms.ts';
import { jobNotes } from '../lib/jobs.ts';
import { taskNotes } from '../lib/tasks.ts';
import { roomLinks } from './Rooms.tsx';
import { loadMode } from '../lib/flow.ts';
import { ModeSwitch, stageIcon, useFlow } from './Flow.tsx';

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
  children: ComponentChildren;
}

const WIDE_SIDE = '(min-width: 1200px)';

/** A stage's name for the sidebar: the part after the colon ("Story planning: premise and cast seeds" is "Premise and cast seeds"). */
export function shortStage(title: string): string {
  const at = title.indexOf(':');
  const t = at >= 0 ? title.slice(at + 1).trim() : title.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : title;
}

export function Shell({ source, schema, index, book, board, place, at = '', demo, sync, title, side, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const [sideOpen, setSideOpenState] = useState(() => loadSideOpen(typeof matchMedia === 'function' && matchMedia(WIDE_SIDE).matches));
  const setSideOpen = (v: boolean) => { setSideOpenState(v); saveSideOpen(v); };
  const showSide = Boolean(side) && sideOpen;
  const flow = useFlow(index, book);
  const mode = book && index ? loadMode(source.key, index, book) : 'writing';
  const hash = typeof location === 'undefined' ? '' : location.hash;
  useEffect(() => {
    const close = () => setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      // Over the page (narrow screens), Escape hides the chat too; beside it, the chat stays.
      if (!matchMedia(WIDE_SIDE).matches && document.querySelector('.shell.side-open')) setSideOpen(false);
    };
    window.addEventListener('hashchange', close);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('hashchange', close); window.removeEventListener('keydown', key); };
  }, []);

  const links = book && schema ? roomLinks(schema, book.folder, mode === 'workflow') : {};
  const running = index ? jobNotes(index).some((n) => n.data.status === 'running') : false;
  const openTodos = index ? taskNotes(index).filter((n) => ['open', 'doing'].indexOf(String(n.data.status || 'open')) >= 0).length : 0;
  const inRoom = roomOf(board);
  const item = (to: string, icon: string, label: string, current: boolean, extra?: string, count?: number) => (
    <a key={to + label} class={'rail-item' + (extra ? ' ' + extra : '')} href={to} aria-current={current ? 'page' : undefined} title={count == null ? label : label + ' (' + count + ')'}>
      <Icon name={icon} size={20} /><span class="rail-label">{label}</span>{extra && extra.indexOf('rail-busy') >= 0 && <span class="job-dot" aria-hidden="true" />}{count != null && <span class="rail-count rail-label">{count}</span>}
    </a>
  );

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
          {book && index && (() => {
            const rooms = ROOMS.map((r) => {
              const first = r.boards.map((k) => links[k]).find(Boolean);
              if (!first) return null;
              return item(first.to, r.icon, r.title, Boolean(inRoom && inRoom.key === r.key), 'rail-room');
            });
            return (
              <>
                <div class="rail-book">
                  <a class="rail-book-link" href={mode === 'workflow' ? href.flow(book.folder) : href.board('overview', book.folder)} title={book.title}>
                    <Cover source={source} book={book} small />
                    <span class="rail-book-text rail-label">
                      <span class="rail-book-title">{book.title}</span>
                      <span class="rail-book-series">{book.seriesName}{book.number != null ? ' · Book ' + book.number : ''}</span>
                    </span>
                  </a>
                  <a class="rail-book-switch rail-label" href={href.home()} title="All books and series" aria-label="All books and series"><Icon name="books" size={18} /></a>
                </div>
                <ModeSwitch sourceKey={source.key} index={index} book={book} waiting={mode === 'workflow' ? 0 : flow.waiting} compact />
                {mode === 'workflow' && (
                  <>
                    {item(href.flow(book.folder), 'outline', 'All stages', hash === href.flow(book.folder), undefined, flow.waiting || undefined)}
                    {flow.stages.map((st) => {
                      const n = st.tasks.filter((t) => flow.statuses[t.key] && (flow.statuses[t.key].state === 'judge' || flow.statuses[t.key].state === 'check')).length;
                      const here = hash === href.flowStage(book.folder, st.index + 1) || st.tasks.some((t) => hash === href.flowStep(book.folder, t.key));
                      return item(href.flowStage(book.folder, st.index + 1), stageIcon(st.index), shortStage(st.title), here, 'rail-stage', n || undefined);
                    })}
                    <p class="rail-heading">The book</p>
                  </>
                )}
                {rooms}
              </>
            );
          })()}
          <div class="rail-foot">
            {item(href.chat(), 'team', 'Team', isTeamPlace(place), running ? 'rail-busy' : undefined)}
            {item(href.todo(), 'todo', 'To-do', place === 'todo', undefined, openTodos || undefined)}
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
        <header class="slim-bar">
          <button type="button" class="icon-button" aria-label="Open the menu" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="panel" /></button>
          <span class="slim-title">{title}</span>
          <button type="button" class={'icon-button rail-sync' + (sync.good ? ' good' : '') + (sync.warn ? ' warn' : '')} onClick={sync.onSync} disabled={sync.busy} title={sync.title} aria-label={sync.label}>
            <Icon name={sync.good ? 'check' : 'sync'} />
          </button>
        </header>
        {children}
      </div>
      {side && showSide && (
        <>
          <button type="button" class="side-backdrop" aria-label="Hide the chat" tabIndex={-1} onClick={() => setSideOpen(false)} />
          {side(() => setSideOpen(false))}
        </>
      )}
      {side && !showSide && (
        <button type="button" class="side-open-button" title="Chat with the team" aria-label="Chat with the team" onClick={() => setSideOpen(true)}>
          <Icon name="chat" size={24} />
        </button>
      )}
    </div>
  );
}
