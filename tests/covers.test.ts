import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COVER_HEIGHT, COVER_SHAPE, cropTo, originalPath, shrunkSize } from '../src/lib/covers.ts';

test('a cover is shrunk to thumbnail size, never enlarged', () => {
  assert.deepEqual(shrunkSize(1600, 2560, COVER_HEIGHT), { width: 450, height: 720 });
  assert.deepEqual(shrunkSize(3000, 1000, COVER_HEIGHT), { width: 720, height: 240 });
  assert.deepEqual(shrunkSize(400, 600, COVER_HEIGHT), { width: 400, height: 600 });
});

test('the full-size picture is kept in the book Cover folder, named by the time', () => {
  const at = new Date(2026, 9, 29, 17, 5, 9);
  assert.equal(originalPath('Series/S/Books/1 B', 'IMG_0412.JPEG', at), 'Series/S/Books/1 B/Cover/Original cover 2026-10-29 170509.jpg');
  assert.equal(originalPath('Series/S/Books/1 B', 'cover.png', at), 'Series/S/Books/1 B/Cover/Original cover 2026-10-29 170509.png');
  assert.equal(originalPath('Series/S/Books/1 B', 'image', at), 'Series/S/Books/1 B/Cover/Original cover 2026-10-29 170509.jpg');
});

test('a cover is cut to 6 by 9: a tall picture loses its bottom, a wide one its sides', () => {
  assert.deepEqual(cropTo(1000, 2000, COVER_SHAPE), { x: 0, y: 0, width: 1000, height: 1500 });
  assert.deepEqual(cropTo(3000, 3000, COVER_SHAPE), { x: 500, y: 0, width: 2000, height: 3000 });
  assert.deepEqual(cropTo(1600, 2400, COVER_SHAPE), { x: 0, y: 0, width: 1600, height: 2400 });
});
