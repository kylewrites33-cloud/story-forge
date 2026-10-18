// The app's frame, like Sudowrite's and Novelcrafter's: a sidebar on the left with the book open on screen (its cover
// and title, then its boards grouped as Write, Plan, Codex, Review and Publish) and the app's own places at the foot
// (Chat, Jobs, To-do, sync, Settings). From 1100 px wide the sidebar shows names beside the icons; from 700 px it is a
// narrow strip of icons with short names, and the menu button opens it in full over the page; narrower still, a slim
// bar with the menu button sits at the top. Every size has every place.
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loadRecent } from '../lib/home.ts';
import type { BookEntry, Schema, VaultIndex, VaultSource } from '../lib/types.ts';
import { boardLinks, type BoardLink } from './StoryBoards.tsx';
import { Cover } from './Home.tsx';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';

const GROUPS: [string, string[]][] = [
  ['Write', ['chapter-grid']],
  ['Plan', ['ideas', 'story-juice', 'beat-sheet', 'conflict-matrix']],
  ['Codex', ['characters', 'matrix']],
  ['Review', ['edit-queue']],
  ['Publish', ['market']]
];

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
  /** Which of the app's own places is on screen: home, series, chat, jobs, todo, settings, or ''. */
  place: string;
  demo: boolean;
  sync: { label: string; title: string; good: boolean; warn: boolean; busy: boolean; onSync: () => void };
  /** The page's name for the slim top bar. */
  title: string;
  children: ComponentChildren;
}

export function Shell({ source, schema, index, book, board, place, demo, sync, title, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('hashchange', close);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('hashchange', close); window.removeEventListener('keydown', key); };
  }, []);

  const links = book && schema ? boardLinks(schema, book.folder) : [];
  const byKey: Record<string, BoardLink> = {};
  links.forEach((l) => { byKey[l.key] = l; });
  const resume = book && index ? keepWriting(index, book, source.key) : null;
  const item = (to: string, icon: string, label: string, current: boolean, extra?: string) => (
    <a key={to + label} class={'rail-item' + (extra ? ' ' + extra : '')} href={to} aria-current={current ? 'page' : undefined} title={label}>
      <Icon name={icon} size={20} /><span class="rail-label">{label}</span>
    </a>
  );

  return (
    <div class={'shell' + (open ? ' rail-open' : '')}>
      <aside class="rail" aria-label="Story Forge">
        <div class="rail-head">
          <a class="brand" href="#/" title="Story Forge home"><span class="brand-mark" aria-hidden="true">SF</span><span class="rail-label brand-name">Story Forge</span></a>
          <button type="button" class="rail-toggle" aria-label={open ? 'Close the menu' : 'Open the menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'close' : 'panel'} size={20} />
          </button>
        </div>
        <nav class="rail-scroll" aria-label="Places">
          {item(href.home(), 'home', 'Books', place === 'home')}
          {item(href.allSeries(), 'shelf', 'Series', place === 'series')}
          {book && (
            <>
              <a class="rail-book" href={href.book(book.folder)} title={book.title}>
                <Cover source={source} book={book} small />
                <span class="rail-book-text rail-label">
                  <span class="rail-book-title">{book.title}</span>
                  <span class="rail-book-series">{book.seriesName}{book.number != null ? ' · Book ' + book.number : ''}</span>
                </span>
              </a>
              {resume && item(href.write(resume), 'pen', 'Keep writing', false, 'rail-write')}
              {GROUPS.map(([name, keys]) => {
                const here = keys.map((k) => byKey[k]).filter(Boolean);
                if (!here.length) return null;
                return (
                  <div class="rail-group" key={name}>
                    <p class="rail-heading">{name}</p>
                    {here.map((l) => item(l.to, l.icon, l.title, l.key === board))}
                  </div>
                );
              })}
            </>
          )}
          <div class="rail-foot">
            {item(href.chat(), 'chat', 'Chat', place === 'chat')}
            {item(href.jobs(), 'team', 'Jobs', place === 'jobs')}
            {item(href.todo(), 'todo', 'To-do', place === 'todo')}
            {demo && item(href.settings(), 'demo', 'Demo vault', false, 'rail-demo')}
            <button type="button" class={'rail-item rail-sync' + (sync.good ? ' good' : '') + (sync.warn ? ' warn' : '')} onClick={sync.onSync} disabled={sync.busy} title={sync.title}>
              <Icon name={sync.good ? 'check' : 'sync'} size={20} /><span class="rail-label">{sync.label}</span>
            </button>
            {item(href.settings(), 'gear', 'Settings', place === 'settings')}
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
    </div>
  );
}
