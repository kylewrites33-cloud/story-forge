import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COVER_HEIGHT, originalPath, shrunkSize } from '../src/lib/covers.ts';

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
