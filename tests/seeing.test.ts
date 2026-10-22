import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildIndex, makeNote } from '../src/lib/vault-index.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { applyToData, applyToText, editChange } from '../src/lib/ideas.ts';
import { lastFifthStart, promiseLane, promiseLanes, promiseWarnings, sceneRef } from '../src/lib/promises.ts';
import { gapsOf, plotGapWarnings, plotGrid, threadToggle, tooLong } from '../src/lib/plotgrid.ts';
import { isJump, timeline } from '../src/lib/timeline.ts';
import { cardLinks, chapterCols, heatLevel, keywordPattern, themeGrid } from '../src/lib/themes.ts';
import { aboutIn, castWeb, defaultFocus, hubFor, lineWidth, parseRelationship, tensionOf } from '../src/lib/castweb.ts';
import type { NoteRecord } from '../src/lib/types.ts';
import { DEMO, FsSource } from './helpers.ts';

async function demo() {
  const src = new FsSource(DEMO);
  const schema = parseSchema(fs.readFileSync(path.join(DEMO, 'System/schema.json'), 'utf8'));
  const { files } = await src.tree();
  const index = await buildIndex({ schema, files, read: (p) => src.read(p), phase: 6 });
  return { index, book: index.books[0] };
}

const scene = (id: string, data: Record<string, unknown> = {}, body = ''): NoteRecord =>
  ({ path: 'Series/S/Books/1 B/Scenes/' + id + '.md', sha: id, type: 'scene', data: { type: 'scene', id, title: id, ...data }, body, error: null });

test('promise lanes mark planted, reinforced and paid scenes and fold settled ones after open ones', async () => {
  const { index, book } = await demo();
  const { scenes, lanes } = promiseLanes(index, book);
  assert.ok(scenes.every((s) => s.data.kind !== 'test'));
  assert.equal(lanes.length, 4);
  assert.deepEqual(lanes.map((l) => l.open), [true, true, true, false]);
  const p1 = lanes.find((l) => l.id === 'P-001')!;
  assert.equal(p1.importance, 5);
  assert.deepEqual(p1.marks[0], ['planted']);
  assert.ok(p1.unpaid);
  const p2 = lanes.find((l) => l.id === 'P-002')!;
  assert.equal(p2.open, false);
  assert.ok(p2.marks.some((m) => m.includes('paid')));
});

test('promise warnings: open and unpaid near the end, and scenes the book does not have', async () => {
  const { index, book } = await demo();
  const w = promiseWarnings(index, book.folder);
  assert.ok(w.some((x) => /P-001 The Cracked Bell is still open/.test(x.text)));
  assert.ok(!w.some((x) => /P-003/.test(x.text)), 'P-003 is paid in S-008');
  assert.ok(w.every((x) => x.check === 'promises' && x.href === '#/board/promises/' + encodeURIComponent(book.folder)));
  const scenes = [scene('S-001'), scene('S-002')];
  const lane = promiseLane({ ...scenes[0], type: 'promise', data: { id: 'P-009', title: 'X', planted: ['[[S-001 The Crack]]'], paid: ['S-044'] } }, scenes, ['S-001', 'S-002', 'S-007']);
  assert.deepEqual(lane.missing, [{ field: 'paid', ref: 'S-044' }]);
  assert.deepEqual(lane.marks[0], ['planted']);
  assert.equal(sceneRef('S-012 The Crack'), 'S-012');
  assert.equal(lastFifthStart(10), 8);
  assert.equal(lastFifthStart(1), 0);
  assert.deepEqual(promiseWarnings(index, 'No such book'), []);
});

test('gaps run between a thread\'s first and last scene and are flagged past 4 scenes or 15%', () => {
  assert.deepEqual(gapsOf([false, true, false, false, true, false]), [{ from: 2, to: 3, length: 2, flagged: true }]);
  assert.deepEqual(gapsOf([false, false]), []);
  assert.equal(tooLong(5, 100), true);
  assert.equal(tooLong(4, 100), false);
  assert.equal(tooLong(4, 20), true);
  assert.equal(tooLong(3, 20), false);
});

test('the plot grid reads each scene\'s threads, marks the team\'s guesses, and warns about long gaps', async () => {
  const { index, book } = await demo();
  const { scenes, rows } = plotGrid(index, book, 'threads');
  assert.deepEqual(rows.map((r) => r.name).sort(), ['Mara and Tobin', 'The Warden\'s Hunt', 'Who Cracked the Bell']);
  const bell = rows.find((r) => r.name === 'Who Cracked the Bell')!;
  assert.deepEqual(bell.seen, [true, false, false, false, true, false, true]);
  assert.equal(bell.draft[6], true, 'S-008 lists threads in card_draft');
  assert.equal(bell.draft[0], false);
  assert.equal(scenes.length, 7);
  const w = plotGapWarnings(index, book.folder);
  assert.ok(w.some((x) => /Who Cracked the Bell disappears for 3 scenes \(S-002 to S-004\)/.test(x.text)), JSON.stringify(w));
  const cast = plotGrid(index, book, 'cast');
  assert.ok(cast.rows.find((r) => r.name === 'Mara Quill')!.seen[0]);
});

test('pressing a square adds or removes the thread, and confirms a guess first', () => {
  const t = { name: 'Who Cracked the Bell', terms: ['Who Cracked the Bell'] };
  assert.deepEqual(threadToggle({}, t), { action: 'add', fields: { threads: '[[Who Cracked the Bell]]' } });
  assert.deepEqual(threadToggle({ threads: ['[[Mara and Tobin]]', '[[Who Cracked the Bell]]'] }, t), { action: 'remove', fields: { threads: '[[Mara and Tobin]]' } });
  assert.deepEqual(threadToggle({ threads: ['[[Who Cracked the Bell]]'], card_draft: ['tension', 'threads'] }, t), { action: 'confirm', fields: { card_draft: 'tension' } });
  assert.deepEqual(threadToggle({ threads: [], card_draft: ['threads'] }, t), { action: 'add', fields: { threads: '[[Who Cracked the Bell]]', card_draft: '' } });
  // An unquoted [[link]] reads as a nested list; it is written back as a link.
  assert.deepEqual(threadToggle({ threads: [['Mara and Tobin']] }, t).fields.threads, '[[Mara and Tobin]], [[Who Cracked the Bell]]');
});

test('a thread toggle changes only the threads and card_draft lines, never the prose', () => {
  const text = '---\ntype: scene\nid: S-008\ntitle: The Last Ring\norder: 8\nthreads:\n  - "[[Mara and Tobin]]"\ncard_draft:\n  - threads\nstatus: planned\n---\nBody stays, [[Who Cracked the Bell]].\n';
  const n = makeNote('x.md', 'a', text);
  const t = threadToggle(n.data, { name: 'Who Cracked the Bell', terms: ['Who Cracked the Bell'] });
  const out = applyToText(text, editChange(t.fields));
  assert.equal(out, '---\ntype: scene\nid: S-008\ntitle: The Last Ring\norder: 8\nthreads:\n  - "[[Mara and Tobin]]"\n  - "[[Who Cracked the Bell]]"\nstatus: planned\n---\nBody stays, [[Who Cracked the Bell]].\n');
  const data = applyToData(n.data, editChange(t.fields));
  assert.deepEqual(data.threads, ['[[Mara and Tobin]]', '[[Who Cracked the Bell]]']);
  assert.equal('card_draft' in data, false);
});

test('the timeline finds flashbacks, time jumps and scenes with no day', async () => {
  const { index, book } = await demo();
  const t = timeline(index, book);
  assert.equal(t.points.length, 6);
  assert.deepEqual(t.missing.map((s) => s.data.id), ['S-008']);
  assert.deepEqual(t.events.map((e) => e.kind + ' ' + e.point.scene.data.id), ['flashback S-003', 'jump S-006']);
  assert.match(t.events[0].text, /S-003 goes back 2 days, to day 1/);
  assert.match(t.events[1].text, /S-006 jumps 9 days ahead, from day 5 to day 14/);
  assert.equal(t.min, 1);
  assert.equal(t.max, 14);
  assert.equal(isJump(1, 1), false);
  assert.equal(isJump(3, 1), true);
  assert.equal(isJump(3, 2), false);
  assert.equal(isJump(7, 5), true);
});

test('the themes heatmap counts whole-word keywords per chapter and marks cards that link the theme', async () => {
  const { index, book } = await demo();
  const g = themeGrid(index, book);
  assert.deepEqual(g.chapters.map((c) => c.num), [1, 2, 3, 4]);
  assert.equal(g.chapters[0].title, 'Frost');
  const cold = g.rows.find((r) => r.name === 'Cold')!;
  assert.equal(cold.cells[0].count, 2, 'cold and sting in S-001');
  assert.equal(cold.cells[0].hits[0].scene.data.id, 'S-001');
  const debt = g.rows.find((r) => r.name === 'Debt')!;
  assert.equal(debt.cells[2].count, 2, 'ledger and tolls in S-005');
  assert.deepEqual(debt.cells[3].cards.map((s) => s.data.id), ['S-008']);
  assert.equal(heatLevel(0, 4), 0);
  assert.equal(heatLevel(1, 4), 1);
  assert.equal(heatLevel(4, 4), 4);
  const re = keywordPattern(['ice'])!;
  assert.equal('Ice, ICE, nice, iced, ice.'.match(re)!.length, 3);
  assert.deepEqual(cardLinks({ goal: 'Face [[Debt|the debt]] now', labels: ['big moment'], themes: ['[[Cold]]'] }), ['Debt', 'big moment', 'Cold']);
  assert.deepEqual(chapterCols([scene('S-1', { chapter: 2 }), scene('S-2'), scene('S-3', { chapter: 1 })]).map((c) => c.key), ['c2', 'c1', 'none']);
});

test('the cast web sizes circles by presence and draws relationship lines as tense as the text says', async () => {
  const { index, book } = await demo();
  const w = castWeb(index, book);
  const names = w.nodes.map((n) => n.name);
  assert.deepEqual(names, ['Mara Quill', 'The Warden', 'Tobin Quill']);
  const mara = w.nodes[0], warden = w.nodes[1];
  assert.ok(mara.scenes > warden.scenes);
  const edge = (a: string, b: string) => w.edges.find((e) => [names[e.a], names[e.b]].sort().join('|') === [a, b].sort().join('|'));
  assert.equal(edge('Mara Quill', 'The Warden')!.tension, 9);
  assert.equal(edge('Tobin Quill', 'The Warden')!.tension, 6);
  assert.equal(edge('Mara Quill', 'Tobin Quill')!.tension, 2);
  assert.equal(w.edges.length, 3);
  // The picture starts on the character on stage the most, with everyone tied to them, tensest first.
  assert.equal(defaultFocus(w), 0);
  const hub = hubFor(w, 0);
  assert.deepEqual(hub.spokes.map((s) => names[s.node]), ['The Warden', 'Tobin Quill']);
  hub.spokes.forEach((s) => { assert.ok(s.x > 0 && s.x < hub.width && s.y > 0 && s.y < hub.height); });
});

test('relationship items and the words that say how tense they are', () => {
  assert.deepEqual(parseRelationship('[[Tobin Quill]]'), { name: 'Tobin Quill', text: '', tension: null });
  assert.deepEqual(parseRelationship('[[The Warden]] (rival, 7/10)'), { name: 'The Warden', text: 'rival, 7/10', tension: 7 });
  assert.deepEqual(parseRelationship([['Mara Quill']]), { name: 'Mara Quill', text: '', tension: null });
  assert.equal(parseRelationship('Rue: enemy')!.tension, 9);
  assert.equal(tensionOf('tension: 3'), 3);
  assert.equal(tensionOf('they are friends'), 2);
  assert.equal(tensionOf('they share a house'), null);
  assert.equal(lineWidth(null), 3);
  assert.ok(lineWidth(10) > lineWidth(2));
  assert.equal(aboutIn('Tobin rows. Mara sings.\n> [!secret]\n> Tobin knows.', ['Tobin']), 'Tobin rows.');
});

test('a character with many ties gets two columns with no two names on the same row', () => {
  const nodes = Array.from({ length: 31 }, (_, i) => ({ name: 'C' + i, note: {} as never, color: 'red', scenes: i }));
  const edges = nodes.slice(1).map((_, i) => ({ a: 0, b: i + 1, tension: i % 11, texts: [] }));
  const hub = hubFor({ nodes, edges, unknown: [], anyTension: true }, 0);
  assert.equal(hub.spokes.length, 30);
  (['left', 'right'] as const).forEach((side) => {
    const ys = hub.spokes.filter((s) => s.side === side).map((s) => s.y);
    ys.slice(1).forEach((y, i) => assert.ok(y - ys[i] >= 60, side + ' rows too close'));
  });
  hub.spokes.forEach((s) => assert.ok(s.y - 24 >= 0 && s.y + 24 <= hub.height && s.x - 160 > 0 && s.x + 160 < hub.width));
});
