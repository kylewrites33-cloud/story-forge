import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTeamPlace, ROOMS, roomOf } from '../src/lib/rooms.ts';

test('every board the sidebar used to list sits in exactly one room', () => {
  const old = ['chapter-grid', 'ideas', 'story-juice', 'beat-sheet', 'conflict-matrix', 'notes', 'characters', 'matrix', 'edit-queue', 'sessions', 'taste',
    'market', 'promises', 'plot-grid', 'timeline', 'themes', 'cast-web', 'arcs', 'tension', 'overview', 'details'];
  for (const b of old) assert.equal(ROOMS.filter((r) => r.boards.indexOf(b) >= 0).length, 1, b);
  assert.equal(roomOf('edit-queue')!.key, 'manuscript');
  assert.equal(roomOf('details')!.key, 'publish');
  assert.equal(roomOf('nothing'), null);
  assert.ok(isTeamPlace('history') && isTeamPlace('workflow') && !isTeamPlace('todo'));
});
