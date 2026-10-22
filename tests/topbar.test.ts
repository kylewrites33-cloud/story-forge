import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTopRoom, topRoom } from '../src/lib/topbar.ts';

const ipad = { app: true, width: 1366, tallest: 1024, screenW: 1366, screenH: 1024 };

test('the home-screen app under the clock bar keeps room for it', () => {
  assert.deepEqual(topRoom(ipad, 'auto'), { clockBar: true, windowButton: false });
});

test('a window a little shorter than the screen still keeps the room (Kyle, 2026-10-22)', () => {
  assert.deepEqual(topRoom({ ...ipad, tallest: 1000 }, 'auto'), { clockBar: true, windowButton: false });
  assert.deepEqual(topRoom({ ...ipad, tallest: 1010 }, 'auto'), { clockBar: true, windowButton: false });
});

test('split view and Stage Manager windows keep room for the window button instead', () => {
  assert.deepEqual(topRoom({ ...ipad, width: 900 }, 'auto'), { clockBar: false, windowButton: true });
  assert.deepEqual(topRoom({ ...ipad, tallest: 800 }, 'auto'), { clockBar: false, windowButton: true });
});

test('a browser tab or a desktop keeps no room', () => {
  assert.deepEqual(topRoom({ ...ipad, app: false }, 'auto'), { clockBar: false, windowButton: false });
});

test('the Settings choice wins over the guess for the clock bar', () => {
  assert.equal(topRoom({ ...ipad, app: false }, 'room').clockBar, true);
  assert.equal(topRoom(ipad, 'none').clockBar, false);
  assert.equal(topRoom({ ...ipad, width: 900 }, 'room').windowButton, true);
  assert.equal(cleanTopRoom('room'), 'room');
  assert.equal(cleanTopRoom('junk'), 'auto');
  assert.equal(cleanTopRoom(null), 'auto');
});
