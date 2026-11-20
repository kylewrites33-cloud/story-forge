// The square code for "Add my phone" (src/lib/qr.ts). That it scans was proved with two separate decoders (zxing-cpp and
// OpenCV) on 2026-11-20, across key lengths and every mask; these tests hold the parts a decoder depends on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataBytes, fitVersion, penalty, qrMatrix, qrSvg } from '../src/lib/qr.ts';

const finderAt = (m: boolean[][], x: number, y: number) => {
  for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) {
    const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
    assert.equal(m[y + dy][x + dx], d !== 2, 'finder at ' + x + ',' + y + ' module ' + dx + ',' + dy);
  }
};

test('capacities match the standard\'s table for byte mode', () => {
  // Bytes a version holds at level M (ISO/IEC 18004 table 7, byte mode): 14, 26, 42, 62 for versions 1 to 4, 152 at 8, 180 at 9 and 213 at 10;
  // version 10 and up spend 16 bits on the count.
  const byteCap = (v: number, l: 'L' | 'M') => Math.floor((dataBytes(v, l) * 8 - 4 - (v < 10 ? 8 : 16)) / 8);
  assert.deepEqual([1, 2, 3, 4].map((v) => byteCap(v, 'M')), [14, 26, 42, 62]);
  assert.deepEqual([8, 9, 10].map((v) => byteCap(v, 'M')), [152, 180, 213]);
  assert.equal(byteCap(40, 'L'), 2953);
  assert.deepEqual(fitVersion(14), { ver: 1, level: 'M' });
  assert.deepEqual(fitVersion(15), { ver: 2, level: 'M' });
  assert.equal(fitVersion(5000), null);
});

test('a symbol has its size, finder squares, timing lines and the dark module', () => {
  [5, 77, 160, 400].forEach((n) => {
    const m = qrMatrix('x'.repeat(n));
    const size = m.length;
    assert.equal((size - 17) % 4, 0, 'size is 4v + 17');
    assert.ok(m.every((r) => r.length === size));
    finderAt(m, 0, 0); finderAt(m, size - 7, 0); finderAt(m, 0, size - 7);
    for (let i = 8; i < size - 8; i++) { assert.equal(m[6][i], i % 2 === 0); assert.equal(m[i][6], i % 2 === 0); }
    assert.equal(m[size - 8][8], true, 'the dark module');
  });
});

test('the two copies of the format bits agree, and say level M and the mask', () => {
  const m = qrMatrix('https://example.org/pocket/#key=github_pat_FAKE');
  const size = m.length;
  const first: boolean[] = [], second: boolean[] = [];
  for (let i = 0; i <= 5; i++) first.push(m[i][8]);
  first.push(m[7][8], m[8][8], m[8][7]);
  for (let i = 9; i < 15; i++) first.push(m[8][14 - i]);
  for (let i = 0; i < 8; i++) second.push(m[8][size - 1 - i]);
  for (let i = 8; i < 15; i++) second.push(m[size - 15 + i][8]);
  assert.deepEqual(first, second);
  const bits = first.reduce((a, b, i) => a | ((b ? 1 : 0) << i), 0) ^ 0x5412;
  assert.equal(bits >>> 13, 0, 'level M is 00');
});

test('the mask chosen scores no worse than any other', () => {
  const t = 'https://kylewrites33-cloud.github.io/story-forge/pocket/#key=github_pat_' + 'FAKE'.repeat(20);
  const best = penalty(qrMatrix(t));
  for (let mask = 0; mask < 8; mask++) assert.ok(best <= penalty(qrMatrix(t, mask)), 'mask ' + mask);
});

test('the picture is black squares on white with the quiet zone', () => {
  const svg = qrSvg('HELLO', 'Code & "key"');
  assert.match(svg, /^<svg [^>]*viewBox="0 0 29 29"/, 'version 1 is 21 modules plus 4 each side');
  assert.match(svg, /<rect width="29" height="29" fill="#fff"\/>/);
  assert.match(svg, /aria-label="Code &amp; &quot;key&quot;"/);
  assert.match(svg, /<path fill="#000" d="M4 4h1v1h-1z/, 'the top left finder starts after the quiet zone');
});

test('words too long for any code are a plain sentence', () => {
  assert.throws(() => qrMatrix('x'.repeat(3000)), /too long for a square code/);
});
