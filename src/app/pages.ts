// The one list of the app's pages (code structure redesign, step 2; Kyle's yes 2026-11-11). Every page says here, once,
// what it is called, where it is (its address), which room it belongs to, what it tells the team chat, and how often
// it wants the vault read again. The sidebar, the top bar, the writing page's Book tools, the chat's "sent from" line
// and the app's reading loop all read this list. What a page draws is beside it in `src/app/screens.tsx`, one entry
// for each page here; the compiler fails if a page has none. A new page is one entry here and one there.
//
// The rooms (Kyle, 2026-10-21): the sidebar shows rooms, not every board, and the room on screen opens its pages
// beneath it (design review, 2026-10-22). Home is the Overview. Plan opens with Steps, the old Workflow mode. Kyle,
// 2026-10-22: the rooms under Home are Plan, Write, Edit (was Review) and Publish; the Codex sits lower, with Team and
// To-do. Write has no pages: it opens the writing screen at the scene he was last in. Kyle, 2026-11-06: Market is its
// own room, between Home and Plan ("They're two very large stages. We have different AI agents responsible for those
// steps"): the Market board and the workflow's market research steps.
import { boardNotes, castFor, STORY_BOARDS, type StoryBoard } from '../lib/boards.ts';
import { conversation } from '../lib/chat.ts';
import type { PageView } from '../lib/context.ts';
import { PILES, piles } from '../lib/ideas.ts';
import { fillJobsFor, isOpenJob } from '../lib/brackets.ts';
import { jobNotes } from '../lib/jobs.ts';
import { optionJobsFor } from '../lib/options.ts';
import type { BookEntry, NoteRecord, Schema, VaultIndex } from '../lib/types.ts';
import { href, type Route } from './route.ts';

export interface Room {
  key: string;
  title: string;
  icon: string;
  /** Listed in the sidebar's lower group, with Team and To-do, instead of under the book (Kyle, 2026-10-22). */
  lower?: boolean;
}

/** The book's rooms, in the sidebar's order. */
export const ROOMS: Room[] = [
  { key: 'home', title: 'Home', icon: 'home' },
  { key: 'market', title: 'Market', icon: 'market' },
  { key: 'plan', title: 'Plan', icon: 'threads' },
  { key: 'write', title: 'Write', icon: 'pen' },
  { key: 'review', title: 'Edit', icon: 'scan' },
  { key: 'publish', title: 'Publish', icon: 'upload' },
  { key: 'codex', title: 'Codex', icon: 'people', lower: true }
];

/** The team's room: not a book's, so it is not in ROOMS. Its pages are the app pages with `room: 'team'`. */
export const TEAM: Room = { key: 'team', title: 'Team', icon: 'spark' };

/** What a page hands its `tells`: the vault as shown, the book on screen (or the active one) and the address. */
export interface Telling { index: VaultIndex; book: BookEntry | null; route: Route }

export interface Page {
  id: string;
  /** 'book': a page of one book. 'app': one of the app's own places. 'write': fills the screen with its own bars. */
  of: 'book' | 'app' | 'write';
  /** Its name. For a board the vault's schema lists, the schema's title for it wins. */
  title: string;
  /** Its line under its room, when that is not its name (Home's first page is "Overview"). */
  inRoom?: string;
  icon: string;
  /** The room it is listed under: one of ROOMS, or 'team'. */
  room?: string;
  /** In its room without a line of its own: the page named here shows as the current one (History, under Agents). */
  under?: string;
  /** Its address. A book's page takes the book's folder. */
  to: (folder: string) => string;
  /** Listed only when the vault's schema has a board by this page's id ('schema'), or has the Characters board ('characters'). */
  when?: 'schema' | 'characters';
  /** Its place among the boards under Book tools on the writing page (the Story Juice chain's order); absent, not there. */
  tool?: number;
  /** The top bar's words when the page is in no room. */
  bar?: string;
  /** How the team chat is told where Kyle is: "Kyle sent this from <where>". */
  where?: string;
  /** No team column beside it (the Chat page is the chat; Settings has no vault). */
  noSide?: boolean;
  /** What is on screen, for the chat's "sent from" lines. */
  tells?: (t: Telling) => { notes?: NoteRecord[]; lines?: string[] };
  /** Read the vault again this often while the page is open, in seconds (a multiple of 15). */
  reread?: number;
  /** True while the team is answering something this page shows: the vault is then read again every 15 seconds. */
  waiting?: (index: VaultIndex, route: Route) => boolean;
}

const board = (id: string) => (folder: string) => href.board(id, folder);
const notesOf = (index: VaultIndex, paths?: string[]) => (paths || []).map((p) => index.notes[p]).filter(Boolean);
const scenesOf = (t: Telling) => ({ notes: t.book ? notesOf(t.index, t.book.scenes).filter((n) => n.data.kind !== 'test') : [] });
const castOf = (t: Telling) => ({ notes: t.book ? castFor(t.index, t.book).map((c) => c.note) : [] });
const boardOf = (id: StoryBoard) => (t: Telling) => ({ notes: t.book ? boardNotes(t.index, t.book, id) : [] });
const bookOf = (index: VaultIndex, path: string) => index.books.find((b) => path.startsWith(b.folder + '/')) || null;

/** Every page. A room lists its pages in the order they stand here. */
export const PAGES = [
  // Home
  { id: 'overview', of: 'book', title: 'Home', inRoom: 'Overview', icon: 'home', room: 'home', to: board('overview'), tool: 10 },
  { id: 'decide', of: 'book', title: 'Decide one at a time', icon: 'cards', room: 'home', to: board('decide') },
  // Market. The research steps are a stage of the workflow; the sidebar finds which (the first unless it says otherwise).
  { id: 'market', of: 'book', title: 'Market', inRoom: 'Market board', icon: 'market', room: 'market', to: board('market'), when: 'schema', tool: 7, tells: boardOf('market') },
  { id: 'market-steps', of: 'book', title: 'Research steps', icon: 'outline', room: 'market', to: (folder: string) => href.flowStage(folder, 1) },
  // Plan
  { id: 'steps', of: 'book', title: 'Steps', icon: 'outline', room: 'plan', to: (folder: string) => href.flow(folder), where: 'Workflow mode',
    tells: (t: Telling) => ({ lines: t.route.name === 'flow' ? ['In Workflow mode' + (t.route.step ? ', on step ' + t.route.step : t.route.stage ? ', on stage ' + t.route.stage : ', on its home') + ' of the workflow (System/Workflow.md). Results are idea notes with `step`; Kyle keeps, puts off or drops them.'] : [] }) },
  { id: 'chapter-grid', of: 'book', title: 'Chapter Grid', icon: 'grid', room: 'plan', to: (folder: string) => href.book(folder), tool: 1, tells: scenesOf },
  { id: 'ideas', of: 'book', title: 'Ideas', icon: 'idea', room: 'plan', to: (folder: string) => href.ideas(folder), tool: 2,
    tells: (t: Telling) => { const pl = piles(notesOf(t.index, t.book ? t.book.ideas : [])); return { notes: PILES.flatMap((x) => pl[x.key] || []) }; } },
  { id: 'story-juice', of: 'book', title: 'Story Juice', icon: 'juice', room: 'plan', to: board('story-juice'), when: 'schema', tool: 3, tells: boardOf('story-juice') },
  { id: 'beat-sheet', of: 'book', title: 'Beat Sheet', icon: 'beats', room: 'plan', to: board('beat-sheet'), when: 'schema', tool: 6, tells: boardOf('beat-sheet') },
  { id: 'conflict-matrix', of: 'book', title: 'Conflict Matrix', icon: 'conflict', room: 'plan', to: board('conflict-matrix'), when: 'schema', tool: 5, tells: boardOf('conflict-matrix') },
  { id: 'promises', of: 'book', title: 'Promises', icon: 'promise', room: 'plan', to: board('promises'), tool: 15 },
  { id: 'plot-grid', of: 'book', title: 'Plot Grid', icon: 'threads', room: 'plan', to: board('plot-grid'), tool: 16 },
  { id: 'timeline', of: 'book', title: 'Timeline', icon: 'timeline', room: 'plan', to: board('timeline'), tool: 17 },
  { id: 'arcs', of: 'book', title: 'Character Arcs', icon: 'arc', room: 'plan', to: board('arcs'), tool: 14, tells: castOf },
  { id: 'notes', of: 'book', title: 'Notes to the Team', icon: 'note', room: 'plan', to: board('notes'), tool: 11 },
  // Edit (the room's key is still 'review'). The pages for Workflow 1.2's editing stage came on 2026-10-24.
  { id: 'changes', of: 'book', title: 'Changes', icon: 'swap', room: 'review', to: board('changes') },
  { id: 'story-calls', of: 'book', title: 'Story calls', icon: 'cards', room: 'review', to: board('story-calls') },
  { id: 'chapter-titles', of: 'book', title: 'Chapter titles', icon: 'pen', room: 'review', to: board('chapter-titles') },
  { id: 'tension', of: 'book', title: 'Tension and Pacing', icon: 'tension', room: 'review', to: board('tension'), tool: 13, tells: scenesOf },
  { id: 'themes', of: 'book', title: 'Themes', icon: 'heat', room: 'review', to: board('themes'), tool: 18 },
  { id: 'sessions', of: 'book', title: 'Sessions', icon: 'sessions', room: 'review', to: board('sessions'), tool: 12 },
  { id: 'taste', of: 'book', title: 'Taste', icon: 'taste', room: 'review', to: board('taste'), tool: 9 },
  // Publish. Book details holds Export to Word and the Kindle file.
  { id: 'details', of: 'book', title: 'Book details', icon: 'image', room: 'publish', to: board('details') },
  // Codex. Places, Items and Lore are its own pages for each kind of entry; they come with the Characters board.
  { id: 'characters', of: 'book', title: 'Characters', icon: 'people', room: 'codex', to: board('characters'), when: 'schema', tool: 4, tells: boardOf('characters') },
  { id: 'places', of: 'book', title: 'Places', icon: 'map', room: 'codex', to: board('places'), when: 'characters' },
  { id: 'items', of: 'book', title: 'Items', icon: 'item', room: 'codex', to: board('items'), when: 'characters' },
  { id: 'lore', of: 'book', title: 'Lore', icon: 'lore', room: 'codex', to: board('lore'), when: 'characters' },
  { id: 'matrix', of: 'book', title: 'Matrix', icon: 'matrix', room: 'codex', to: board('matrix'), tool: 8, tells: castOf },
  { id: 'cast-web', of: 'book', title: 'Cast web', icon: 'web', room: 'codex', to: board('cast-web'), tool: 19 },

  // The team's places.
  { id: 'chat', of: 'app', title: 'Chat', icon: 'chat', room: 'team', to: () => href.chat(), bar: 'Chat with the team', noSide: true, reread: 60,
    waiting: (index: VaultIndex, r: Route) => r.name === 'chat' && Boolean(r.thread) && r.thread !== 'new' && conversation(index, r.thread, r.book).pending },
  { id: 'jobs', of: 'app', title: 'Jobs', icon: 'team', room: 'team', to: () => href.jobs(), bar: 'Jobs', where: 'the Jobs page', reread: 60 },
  { id: 'team', of: 'app', title: 'Agents', icon: 'people', room: 'team', to: () => href.team(), bar: 'The team', where: 'the Team page',
    tells: (t: Telling) => ({ lines: t.route.name === 'team' && t.route.slug ? ['Looking at the team member: ' + t.route.slug] : [] }) },
  { id: 'skills', of: 'app', title: 'Skills', icon: 'idea', room: 'team', to: () => href.skills(), bar: 'Skills', where: 'the Skills page',
    tells: (t: Telling) => ({ lines: t.route.name === 'skills' && t.route.skill ? ['Looking at the skill: ' + t.route.skill] : [] }) },
  { id: 'recipes', of: 'app', title: 'Recipes', icon: 'recipe', room: 'team', to: () => href.recipes(), bar: 'Recipes', where: 'the Recipes page' },
  { id: 'workflow', of: 'app', title: 'Workflow table', icon: 'list', room: 'team', to: () => href.workflow(), bar: 'Workflow', where: 'the Workflow page',
    tells: (t: Telling) => ({ lines: t.route.name === 'workflow' ? ['Looking at the workflow (System/Workflow.md)' + (t.route.step ? ', step ' + t.route.step : '') + '. Kyle may want to judge or change a step: answer about the workflow, and propose changes as a note, never by editing it.'] : [] }) },
  { id: 'history', of: 'app', title: 'Session history', icon: 'people', room: 'team', under: 'team', to: () => href.history(), bar: 'Session history', where: 'Session history' },

  // The app's other places.
  { id: 'books', of: 'app', title: 'Books', icon: 'books', to: () => href.home(), bar: 'Books', where: 'the Books page' },
  { id: 'series', of: 'app', title: 'Series', icon: 'shelf', to: () => href.allSeries(), bar: 'Series', where: 'the Series page',
    tells: (t: Telling) => ({ lines: t.route.name === 'series' && t.route.folder ? ['Looking at the series: `' + t.route.folder + '`'] : [] }) },
  { id: 'todo', of: 'app', title: 'To-do', icon: 'todo', to: () => href.todo(), bar: 'To-do', where: 'the To-do list' },
  { id: 'settings', of: 'app', title: 'Settings', icon: 'gear', to: () => href.settings(), bar: 'Settings', noSide: true },
  { id: 'note', of: 'app', title: 'Note', icon: 'note', to: (path: string) => href.note(path), where: 'a note',
    tells: (t: Telling) => {
      const n = t.route.name === 'note' ? t.index.notes[t.route.path] : null;
      if (!n) return {};
      const body = n.body.replace(/\s+/g, ' ').trim();
      return { notes: [n], lines: body ? ['The note begins: ' + (body.length > 500 ? body.slice(0, 500) + '…' : body)] : [] };
    } },

  // The writing screen, by scene, by its chapter's beats, and the whole chapter. Each takes a scene's path. An open
  // scene is read again every 30 seconds, so words pushed from elsewhere come into the page without reloading, and
  // every 15 while the team is answering its chat or its braces.
  { id: 'write', of: 'write', title: 'Write', icon: 'pen', to: (path: string) => href.write(path), reread: 30,
    waiting: (index: VaultIndex, r: Route) => {
      if (r.name !== 'write') return false;
      const note = index.notes[r.path];
      const book = note ? bookOf(index, r.path) : null;
      const id = note ? String(note.data.id || '') : '';
      if (!book || !id) return false;
      return fillJobsFor(jobNotes(index), id, book.folder).some(isOpenJob) || optionJobsFor(jobNotes(index), id, book.folder).some(isOpenJob) || conversation(index, id, book.folder).pending;
    } },
  { id: 'beats', of: 'write', title: 'Beats', icon: 'beats', to: (path: string) => href.beats(path) },
  { id: 'chapter', of: 'write', title: 'Whole chapter', icon: 'pen', to: (path: string) => href.chapter(path) }
] as const satisfies readonly Page[];

export type PageId = (typeof PAGES)[number]['id'];

const BY_ID: Record<string, Page> = Object.fromEntries(PAGES.map((p) => [p.id, p]));

/** The page by this id, or null. */
export function page(id: string): Page | null {
  return Object.prototype.hasOwnProperty.call(BY_ID, id) ? BY_ID[id] : null;
}

/** A room's pages, in its order. */
export function pagesIn(room: string): Page[] {
  return (PAGES as readonly Page[]).filter((p) => p.room === room);
}

/** The room a book's page belongs to, or null (the team's room is not a book's). */
export function roomOf(id: string): Room | null {
  const p = page(id);
  return (p && p.of === 'book' && ROOMS.find((r) => r.key === p.room)) || null;
}

/** The page an address opens, or null for an address the list does not have (a board by an unknown name). */
export function pageOf(route: Route): Page | null {
  switch (route.name) {
    case 'home': case 'books': return page('books');
    case 'book': return page('chapter-grid');
    case 'ideas': return page('ideas');
    case 'board': { const p = page(route.board); return p && p.of === 'book' ? p : null; }
    case 'flow': return page('steps');
    default: return page(route.name);
  }
}

/** The book an address names, by its folder; '' when it names none. */
export function folderOf(route: Route): string {
  return route.name === 'book' || route.name === 'ideas' || route.name === 'board' || route.name === 'flow' ? route.folder : '';
}

/** One line of a room's list or of Book tools: a page, named and addressed for a book. */
export interface PageLink { key: string; title: string; to: string; icon: string }

const has = (schema: Schema, p: Page) => !p.when || Boolean(schema.boards[p.when === 'schema' ? p.id : 'characters']);
const nameOf = (schema: Schema, p: Page) => (schema.boards[p.id] && schema.boards[p.id].title) || p.title;

/** A book's pages as its rooms list them, keyed by id; a page the vault's schema leaves out is not there. */
export function roomLinks(schema: Schema, folder: string): Record<string, PageLink> {
  const out: Record<string, PageLink> = {};
  for (const p of PAGES as readonly Page[]) if (p.of === 'book' && has(schema, p)) out[p.id] = { key: p.id, title: p.inRoom || nameOf(schema, p), to: p.to(folder), icon: p.icon };
  return out;
}

/** A book's boards as the writing page lists them under Book tools, in the order the Story Juice chain uses them. */
export function toolLinks(schema: Schema, folder: string): PageLink[] {
  return (PAGES as readonly Page[]).filter((p) => p.tool != null && has(schema, p)).sort((a, b) => a.tool! - b.tool!)
    .map((p) => ({ key: p.id, title: nameOf(schema, p), to: p.to(folder), icon: p.icon }));
}

/** The place name the sidebar marks as current: an app page's id, with Books for both its addresses; '' for a book's page. */
export function placeOf(p: Page | null): string {
  return p && p.of === 'app' && p.id !== 'note' ? p.id : '';
}

/** The page's name as a board of this book, when Book tools lists it; null otherwise. */
function boardName(p: Page | null, schema: Schema | null, book: BookEntry | null): string | null {
  return p && p.of === 'book' && p.tool != null && schema && book && has(schema, p) ? nameOf(schema, p) : null;
}

/** The top bar's words for a page in no room: the place's name, or the book's title with the board's. */
export function barTitle(p: Page | null, route: Route, schema: Schema | null, book: BookEntry | null): string {
  if (p && p.bar) return p.bar;
  if (!book) return 'Sparrow';
  const name = route.name === 'flow' ? null : boardName(p, schema, book);
  return book.title + (name ? ' · ' + name : route.name === 'flow' ? ' · Workflow' : '');
}

/** What the team chat is told about the page Kyle sent from: where he is, the book, and what is on screen. */
export function tellingOf(p: Page | null, route: Route, schema: Schema | null, index: VaultIndex | null, navBook: BookEntry | null, sideBook: BookEntry | null): PageView {
  const name = route.name === 'flow' ? null : boardName(p, schema, navBook);
  const v: PageView = { name: name ? 'the ' + name + ' board' : (p && p.where) || 'this page', book: sideBook };
  if (!index || !p || !p.tells) return v;
  const told = p.tells({ index, book: navBook, route });
  if (told.notes) v.notes = told.notes;
  if (told.lines && told.lines.length) v.lines = told.lines;
  return v;
}

/** The boards the vault's schema can list, for the pages that draw one. */
export const isStoryBoard = (id: string): id is StoryBoard => (STORY_BOARDS as readonly string[]).indexOf(id) >= 0;
