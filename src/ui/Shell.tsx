// The app's frame, like Sudowrite's and Novelcrafter's: a sidebar on the left with the book open on screen (its cover
// and title, then its boards grouped as Write, Plan, Codex, Review and Publish) and the app's own places at the foot
// (Chat, Jobs, To-do, sync, Settings). From 1100 px wide the sidebar shows names beside the icons; from 700 px it is a
// narrow strip of icons with short names, and the menu button opens it in full over the page; narrower still, a slim
// bar with the menu button sits at the top. Every size has every place. Below the foot, at the bottom of the scroll,
// the AI team and its skills are listed (each folds away, remembered on the device), with the team's history; the
// narrow strip shows them as three icons instead. On the right, the team chat sits beside the page from 1200 px wide and
// slides over it narrower; a round Chat button at the bottom right opens it, and its arrow hides it (per device).
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { teamColour } from '../lib/team.ts';
import { loadRecent } from '../lib/home.ts';
import { loadSideOpen, saveSideOpen } from '../lib/chat.ts';
import type { BookEntry, Schema, VaultIndex, VaultSource } from '../lib/types.ts';
import { boardLinks, type BoardLink } from './StoryBoards.tsx';
import { Cover } from './Home.tsx';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';
import { Avatar, useTeam } from './Team.tsx';

const GROUPS: [string, string[]][] = [
  ['Write', ['chapter-grid']],
  ['Plan', ['ideas', 'story-juice', 'beat-sheet', 'conflict-matrix', 'notes']],
  ['Codex', ['characters', 'matrix']],
  ['Review', ['edit-queue', 'sessions', 'taste']],
  ['Publish', ['market']]
];
// The "seeing the book" pages: Promises, Plot Grid and Timeline plan the book; Themes and Cast web review it.
GROUPS[1][1].push('promises', 'plot-grid', 'timeline');
GROUPS[3][1].push('themes', 'cast-web');
// Writers Room charts: Character Arcs under Plan, Tension and Pacing under Review.
GROUPS.forEach(([name, keys]) => { if (name === 'Plan') keys.push('arcs'); if (name === 'Review') keys.push('tension'); });

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

/** A sidebar section that folds away, open or shut as last left on this device. */
function useFold(key: string, start: boolean): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try { const v = localStorage.getItem('sf-rail-' + key); return v == null ? start : v === '1'; } catch { return start; }
  });
  return [open, (v: boolean) => { setOpen(v); try { localStorage.setItem('sf-rail-' + key, v ? '1' : '0'); } catch { /* this visit only */ } }];
}

const WIDE_SIDE = '(min-width: 1200px)';

export function Shell({ source, schema, index, book, board, place, at = '', demo, sync, title, side, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const [sideOpen, setSideOpenState] = useState(() => loadSideOpen(typeof matchMedia === 'function' && matchMedia(WIDE_SIDE).matches));
  const setSideOpen = (v: boolean) => { setSideOpenState(v); saveSideOpen(v); };
  const showSide = Boolean(side) && sideOpen;
  const team = useTeam(index);
  const [teamOpen, setTeamOpen] = useFold('team', true);
  const [skillsOpen, setSkillsOpen] = useFold('skills', true);
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
    <div class={'shell' + (open ? ' rail-open' : '') + (side ? ' has-side' : '') + (showSide ? ' side-open' : '')}>
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
              {item(href.board('details', book.folder), 'image', 'Book details', board === 'details', 'rail-details')}
              {item(href.board('overview', book.folder), 'gauge', 'Overview', board === 'overview')}
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
            {item(href.workflow(), 'outline', 'Workflow', place === 'workflow')}
            {item(href.recipes(), 'recipe', 'Recipes', place === 'recipes')}
            {demo && item(href.settings(), 'demo', 'Demo vault', false, 'rail-demo')}
            <button type="button" class={'rail-item rail-sync' + (sync.good ? ' good' : '') + (sync.warn ? ' warn' : '')} onClick={sync.onSync} disabled={sync.busy} title={sync.title}>
              <Icon name={sync.good ? 'check' : 'sync'} size={20} /><span class="rail-label">{sync.label}</span>
            </button>
            {item(href.settings(), 'gear', 'Settings', place === 'settings')}
          </div>
          <div class="rail-team">
            <div class="rail-strip-only">
              {item(href.team(), 'team', 'Team', place === 'team')}
              {item(href.skills(), 'idea', 'Skills', place === 'skills')}
              {item(href.history(), 'history', 'History', place === 'history')}
              {item(href.workflow(), 'outline', 'Workflow', place === 'workflow')}
            </div>
            <details class="rail-section" open={teamOpen} onToggle={(e) => setTeamOpen((e.currentTarget as HTMLDetailsElement).open)}>
              <summary class="rail-summary">The AI team <span class="rail-count">{team.members.length}</span></summary>
              {item(href.team(), 'team', 'Whole team', at === href.team())}
              {team.members.map((m) => (
                <a key={m.slug} class="rail-item rail-person" href={href.team(m.slug)} aria-current={at === href.team(m.slug) ? 'page' : undefined} title={m.name + ' · ' + m.team}
                  style={{ borderLeftColor: teamColour(m.team) }}>
                  <Avatar name={m.name} size={24} /><span class="rail-label">{m.name}</span>
                </a>
              ))}
              {item(href.history(), 'history', 'Session history', place === 'history')}
            </details>
            <details class="rail-section" open={skillsOpen} onToggle={(e) => setSkillsOpen((e.currentTarget as HTMLDetailsElement).open)}>
              <summary class="rail-summary">Skills <span class="rail-count">{team.skills.length}</span></summary>
              {item(href.skills(), 'idea', 'All skills', at === href.skills())}
              {team.skills.map((s) => (
                <a key={s.name} class="rail-item rail-skill" href={href.skills(s.name)} aria-current={at === href.skills(s.name) ? 'page' : undefined}
                  title={s.label + (s.agents.length ? ' · ' + s.agents.join(', ') : ' · the coordinator')}>
                  <span class="rail-label">{s.label}</span>
                  <span class="rail-skill-who">{s.agents.length ? s.agents.length === 1 ? s.agents[0] : s.agents.length + ' agents' : 'Coordinator'}</span>
                </a>
              ))}
            </details>
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
