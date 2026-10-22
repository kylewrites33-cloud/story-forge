import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTeamPlace, LOWER_ROOMS, ROOMS, roomOf } from '../src/lib/rooms.ts';
import { parseHash } from '../src/ui/route.ts';

test('every board the sidebar used to list sits in exactly one room', () => {
  const old = ['chapter-grid', 'ideas', 'story-juice', 'beat-sheet', 'conflict-matrix', 'notes', 'characters', 'matrix', 'sessions', 'taste',
    'market', 'promises', 'plot-grid', 'timeline', 'themes', 'cast-web', 'arcs', 'tension', 'overview', 'details'];
  for (const b of old) assert.equal(ROOMS.filter((r) => r.boards.indexOf(b) >= 0).length, 1, b);
  assert.equal(roomOf('chapter-grid')!.key, 'plan');
  assert.equal(roomOf('edit-queue'), null);
  assert.equal(roomOf('details')!.key, 'publish');
  assert.equal(roomOf('nothing'), null);
  assert.ok(isTeamPlace('history') && isTeamPlace('workflow') && !isTeamPlace('todo'));
});

test('the sidebar reads Home, Plan, Write, Edit, Publish, with the Codex lower down (Kyle, 2026-10-22)', () => {
  assert.deepEqual(ROOMS.filter((r) => LOWER_ROOMS.indexOf(r.key) < 0).map((r) => r.title), ['Home', 'Plan', 'Write', 'Edit', 'Publish']);
  assert.deepEqual(LOWER_ROOMS, ['codex']);
  assert.deepEqual(ROOMS.find((r) => r.key === 'write')!.boards, []);
});

test('old links to the Edit Queue open To-do', () => {
  assert.deepEqual(parseHash('#/board/edit-queue/Series%2FX%2FBooks%2F1%20Y'), { name: 'todo' });
  assert.equal(parseHash('#/board/ideas/Series%2FX').name, 'board');
});
