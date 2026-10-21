// The tabs across the top of a room (Kyle, 2026-10-21): each board of a book's room, and each of the Team room's places.
// The tab strip scrolls sideways on its own when a room has more tabs than fit; the page never does.
import type { Schema, BookEntry } from '../lib/types.ts';
import { roomOf, TEAM_PLACES } from '../lib/rooms.ts';
import { boardLinks, type BoardLink } from './StoryBoards.tsx';
import { href } from './route.ts';

/** The book's boards with Book details added, keyed by board. In Workflow mode the Chapter Grid has its own address. */
export function roomLinks(schema: Schema, folder: string, workflow: boolean): Record<string, BoardLink> {
  const out: Record<string, BoardLink> = {};
  boardLinks(schema, folder).forEach((l) => { out[l.key] = l; });
  out.details = { key: 'details', title: 'Book details', to: href.board('details', folder), icon: 'image' };
  if (workflow && out['chapter-grid']) out['chapter-grid'] = { ...out['chapter-grid'], to: href.board('chapter-grid', folder) };
  return out;
}

export function RoomTabs({ schema, book, board, workflow }: { schema: Schema; book: BookEntry; board: string; workflow: boolean }) {
  const room = roomOf(board);
  if (!room || room.boards.length < 2) return null;
  const links = roomLinks(schema, book.folder, workflow);
  const here = room.boards.map((k) => links[k]).filter(Boolean);
  if (here.length < 2) return null;
  return (
    <nav class="room-tabs" aria-label={room.title}>
      <span class="room-name">{room.title}</span>
      <div class="room-tab-row">
        {here.map((l) => <a key={l.key} href={l.to} aria-current={l.key === board ? 'page' : undefined}>{l.title}</a>)}
      </div>
    </nav>
  );
}

export function TeamTabs({ place }: { place: string }) {
  const to: Record<string, string> = { chat: href.chat(), jobs: href.jobs(), team: href.team(), skills: href.skills(), recipes: href.recipes(), workflow: href.workflow() };
  const on = place === 'history' ? 'team' : place;
  return (
    <nav class="room-tabs" aria-label="Team">
      <span class="room-name">Team</span>
      <div class="room-tab-row">
        {TEAM_PLACES.map((p) => <a key={p.key} href={to[p.key]} aria-current={p.key === on ? 'page' : undefined}>{p.title}</a>)}
      </div>
    </nav>
  );
}
