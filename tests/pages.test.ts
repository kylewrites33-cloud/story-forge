// The one list of the app's pages (`src/app/pages.ts`). `tests/golden/pages.json` is what the four older copies of the
// page map (rooms.ts, Rooms.tsx, StoryBoards.tsx, Seeing.tsx) gave for the demo vault's schema on the day they were
// removed, 2026-11-11: with every board, with none, without Characters, and with three boards renamed by the schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { barTitle, folderOf, page, PAGES, pageOf, pagesIn, placeOf, roomLinks, roomOf, ROOMS, TEAM, tellingOf, toolLinks, type Page } from '../src/app/pages.ts';
import { href, parseHash } from '../src/app/route.ts';
import { pageContext } from '../src/lib/context.ts';
import { sync } from '../src/lib/sync.ts';
import { parseSchema } from '../src/lib/schema.ts';
import type { BookEntry } from '../src/lib/types.ts';
import { demoSchemaText, FsSource, DEMO, ROOT } from './helpers.ts';

const golden = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'golden', 'pages.json'), 'utf8'));
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const all = PAGES as readonly Page[];

function variants(): Record<string, string> {
  const text = demoSchemaText();
  const j = JSON.parse(text);
  const { characters, ...rest } = j.boards; void characters;
  return { full: text, bare: JSON.stringify({ ...j, boards: {} }), nochars: JSON.stringify({ ...j, boards: rest }),
    renamed: JSON.stringify({ ...j, boards: { ...j.boards, market: { ...j.boards.market, title: 'The Shelf' }, ideas: { ...j.boards.ideas, title: 'Sparks' }, 'chapter-grid': { ...j.boards['chapter-grid'], title: 'Grid' } } }) };
}

test('the rooms list the same pages, by the same names and addresses, as the older page map did', () => {
  for (const [name, text] of Object.entries(variants())) {
    const schema = parseSchema(text);
    assert.deepEqual({ rooms: roomLinks(schema, 'Series/X/Books/1 Y'), tools: toolLinks(schema, 'Series/X/Books/1 Y') }, golden[name], name);
  }
  for (const r of ROOMS) assert.deepEqual(pagesIn(r.key).map((p) => p.id), golden.rooms[r.key], r.key);
  assert.deepEqual(pagesIn(TEAM.key).filter((p) => !p.under).map((p) => ({ key: p.id, title: p.title, icon: p.icon })), golden.team);
});

test('the sidebar reads Home, Market, Plan, Write, Edit, Publish, with the Codex lower down (Kyle, 2026-10-22 and 2026-11-06)', () => {
  assert.deepEqual(ROOMS.filter((r) => !r.lower).map((r) => r.title), ['Home', 'Market', 'Plan', 'Write', 'Edit', 'Publish']);
  assert.deepEqual(ROOMS.filter((r) => r.lower).map((r) => r.key), ['codex']);
  assert.deepEqual(pagesIn('market').map((p) => p.id), ['market', 'market-steps']);
  assert.deepEqual(pagesIn('write'), []);
  assert.equal(roomOf('chapter-grid')!.key, 'plan');
  assert.equal(roomOf('details')!.key, 'publish');
  assert.equal(roomOf('edit-queue'), null);
  assert.equal(roomOf('nothing'), null);
  assert.equal(roomOf('todo'), null, 'an app place is in no room of a book');
  assert.equal(roomOf('toString'), null);
  assert.ok(page('history')!.room === 'team' && page('workflow')!.room === 'team' && !page('todo')!.room);
  assert.equal(page('history')!.under, 'team', 'History shows under Agents');
});

test('every page has one id, a room that exists, and an address that opens it', () => {
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  const tools = all.filter((p) => p.tool != null).map((p) => p.tool!).sort((a, b) => a - b);
  assert.deepEqual(tools, tools.map((_, i) => i + 1), 'Book tools numbers its boards 1 to n with no gap');
  for (const p of all) {
    if (p.room) assert.ok(p.room === TEAM.key || ROOMS.some((r) => r.key === p.room), p.id + ' room');
    if (p.under) assert.ok(page(p.under), p.id + ' under');
    if (p.reread) assert.equal(p.reread % 15, 0, p.id + ' reread');
    const at = p.of === 'book' ? p.to(BOOK) : p.id === 'note' || p.of === 'write' ? p.to(BOOK + '/Scenes/S-001 The Crack.md') : p.to('');
    const opened = pageOf(parseHash(at));
    // The market research steps are a stage of Steps; the sidebar tells the two apart.
    assert.equal(opened && opened.id, p.id === 'market-steps' ? 'steps' : p.id, p.id + ' at ' + at);
    if (p.of === 'book') assert.equal(folderOf(parseHash(at)), BOOK);
  }
});

test('an address opens its page; an unknown board opens none; old links to the Edit Queue open To-do', () => {
  assert.deepEqual(parseHash('#/board/edit-queue/Series%2FX%2FBooks%2F1%20Y'), { name: 'todo' });
  assert.equal(parseHash('#/board/ideas/Series%2FX').name, 'board');
  const at = (h: string) => { const p = pageOf(parseHash(h)); return p ? p.id : null; };
  assert.equal(at('#/'), 'books');
  assert.equal(at('#/books'), 'books');
  assert.equal(at('#/nowhere'), 'books');
  assert.equal(at(href.book(BOOK)), 'chapter-grid');
  assert.equal(at(href.board('chapter-grid', BOOK)), 'chapter-grid');
  assert.equal(at(href.ideas(BOOK)), 'ideas');
  assert.equal(at(href.board('nothing-here', BOOK)), null);
  assert.equal(at(href.board('todo', BOOK)), null, 'an app place is not a board');
  assert.equal(at(href.flowStep(BOOK, '18-19')), 'steps');
  assert.equal(at(href.history('Writer')), 'history');
  assert.equal(at(href.series('Series/Ember Road')), 'series');
  assert.equal(at(href.beats(BOOK + '/Scenes/S-001 The Crack.md')), 'beats');
  assert.equal(placeOf(page('books')), 'books');
  assert.equal(placeOf(page('overview')), '');
  assert.equal(placeOf(page('note')), '');
  assert.equal(placeOf(page('write')), '');
  assert.equal(placeOf(null), '');
});

test('the top bar names a place, or the book with its board', async () => {
  const snap = await sync(new FsSource(DEMO), null);
  const schema = parseSchema(demoSchemaText());
  const book = snap.index.books.find((b) => b.folder === BOOK)!;
  const bar = (h: string, b = book) => barTitle(pageOf(parseHash(h)), parseHash(h), schema, b);
  assert.equal(bar('#/todo'), 'To-do');
  assert.equal(bar('#/'), 'Books');
  assert.equal(bar('#/chat'), 'Chat with the team');
  assert.equal(bar('#/history'), 'Session history');
  assert.equal(bar(href.ideas(BOOK)), 'Ash Bell · Ideas');
  assert.equal(bar(href.board('overview', BOOK)), 'Ash Bell · Home');
  assert.equal(bar(href.board('details', BOOK)), 'Ash Bell');
  assert.equal(bar(href.board('nothing-here', BOOK)), 'Ash Bell');
  assert.equal(bar(href.flow(BOOK)), 'Ash Bell · Workflow');
  assert.equal(bar(href.note(BOOK + '/Book.md')), 'Ash Bell');
  assert.equal(barTitle(page('note'), parseHash(href.note('x.md')), schema, null), 'Sparrow');
  assert.equal(barTitle(page('story-juice'), parseHash(href.board('story-juice', BOOK)), parseSchema(variants().bare), book), 'Ash Bell', 'a board the schema lacks has no name');
});

test('each page tells the team chat where Kyle is and what is on screen', async () => {
  const snap = await sync(new FsSource(DEMO), null);
  const index = snap.index;
  const schema = parseSchema(demoSchemaText());
  const book = index.books.find((b) => b.folder === BOOK)!;
  const tell = (h: string, nav: BookEntry | null = book) => tellingOf(pageOf(parseHash(h)), parseHash(h), schema, index, nav, nav || book);
  const ids = (h: string) => (tell(h).notes || []).map((n) => String(n.data.id || n.data.name || ''));

  assert.equal(tell(href.ideas(BOOK)).name, 'the Ideas board');
  assert.equal(tell(href.ideas(BOOK)).notes!.length, book.ideas!.length, 'every idea, pile by pile');
  assert.equal(tell(href.board('overview', BOOK)).name, 'the Home board');
  assert.equal(tell(href.board('overview', BOOK)).notes, undefined);
  assert.equal(tell(href.board('market', BOOK)).name, 'the Market board');
  assert.equal(tell(href.book(BOOK)).name, 'the Chapter Grid board');
  assert.deepEqual(ids(href.book(BOOK)), book.scenes.map((p) => index.notes[p]).filter((n) => n.data.kind !== 'test').map((n) => String(n.data.id)));
  assert.deepEqual(ids(href.board('tension', BOOK)), ids(href.book(BOOK)));
  assert.ok(ids(href.board('matrix', BOOK)).length > 0);
  assert.deepEqual(ids(href.board('arcs', BOOK)), ids(href.board('matrix', BOOK)));
  assert.ok(ids(href.board('characters', BOOK)).length > 0);
  assert.equal(tell(href.board('details', BOOK)).name, 'this page');
  assert.equal(tell(href.board('nothing-here', BOOK)).name, 'this page');

  assert.equal(tell('#/todo', null).name, 'the To-do list');
  assert.equal(tell('#/', null).name, 'the Books page');
  assert.equal(tell('#/jobs').name, 'the Jobs page');
  assert.equal(tell('#/history/Writer').name, 'Session history');
  assert.deepEqual(tell('#/team/writer').lines, ['Looking at the team member: writer']);
  assert.equal(tell('#/team').lines, undefined);
  assert.deepEqual(tell('#/skills/anti-slop').lines, ['Looking at the skill: anti-slop']);
  assert.deepEqual(tell(href.series('Series/Ember Road'), null).lines, ['Looking at the series: `Series/Ember Road`']);
  assert.match(tell('#/workflow/3').lines![0], /^Looking at the workflow \(System\/Workflow\.md\), step 3\. /);
  assert.equal(tell(href.flow(BOOK)).name, 'Workflow mode');
  assert.match(tell(href.flow(BOOK)).lines![0], /^In Workflow mode, on its home of the workflow/);
  assert.match(tell(href.flowStage(BOOK, 2)).lines![0], /^In Workflow mode, on stage 2 /);
  assert.match(tell(href.flowStep(BOOK, '18-19')).lines![0], /^In Workflow mode, on step 18-19 /);

  const scene = BOOK + '/Scenes/S-005 The Ledger.md';
  const note = tell(href.note(scene));
  assert.equal(note.name, 'a note');
  assert.deepEqual(note.notes, [index.notes[scene]]);
  assert.match(note.lines![0], /^The note begins: /);
  assert.equal(tell(href.note('No/Such.md')).notes, undefined);

  // The text the chat job carries.
  assert.match(pageContext(tell(href.ideas(BOOK))), /^Kyle sent this from the Ideas board in the Sparrow app\./);
  assert.match(pageContext(tell(href.ideas(BOOK))), /Book: Ash Bell \(/);
});

test('a page says when the vault should be read again', async () => {
  const snap = await sync(new FsSource(DEMO), null);
  assert.equal(page('jobs')!.reread, 60);
  assert.equal(page('chat')!.reread, 60);
  assert.equal(page('write')!.reread, 30);
  assert.equal(page('beats')!.reread, undefined);
  assert.ok(page('chat')!.noSide && page('settings')!.noSide && !page('todo')!.noSide);
  const chat = page('chat')!.waiting!;
  assert.equal(chat(snap.index, parseHash('#/chat')), false, 'the list of conversations waits on nothing');
  assert.equal(chat(snap.index, parseHash('#/chat/new')), false);
  assert.equal(chat(snap.index, parseHash('#/chat/no-such-thread')), false);
  const write = page('write')!.waiting!;
  assert.equal(write(snap.index, parseHash(href.write('No/Such.md'))), false);
  assert.equal(typeof write(snap.index, parseHash(href.write(BOOK + '/Scenes/S-005 The Ledger.md'))), 'boolean');
});
