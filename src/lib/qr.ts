// A small QR code maker, for Settings' "Add my phone" (2026-11-20): the square a phone's camera reads to open Sparrow
// Pocket with the key already in it. Drawn on the device, so the key never goes to a server (no new dependency, per
// CLAUDE.md). Byte mode only, error correction level M (L when the words would not fit), versions 1 to 40, the eight
// masks scored the standard way. Follows ISO/IEC 18004; the tables are the standard's. Tested by tests/qr.test.ts, and
// proved to scan with two separate decoders before the button went in (see docs/Features.md, Sparrow Pocket).

export type Level = 'L' | 'M';

// Error correction codewords per block, and blocks, by version (index 0 unused). From the standard's table 9.
const ECC_PER_BLOCK: Record<Level, number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
};
const BLOCKS: Record<Level, number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
};
/** The two bits a level writes in the format information. */
const LEVEL_BITS: Record<Level, number> = { L: 1, M: 0 };

/** Modules that carry data and error correction (everything but the fixed patterns and format and version bits). */
function rawModules(ver: number): number {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}

/** Bytes of data a version holds at a level, after its error correction. */
export function dataBytes(ver: number, level: Level): number {
  return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[level][ver] * BLOCKS[level][ver];
}

/** Where the alignment patterns' centres are, along each side. */
function alignment(ver: number): number[] {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

// ---- Reed-Solomon over GF(256), polynomial 0x11D ----
function mul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function divisor(degree: number): number[] {
  const out = new Array<number>(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      out[j] = mul(out[j], root);
      if (j + 1 < degree) out[j] ^= out[j + 1];
    }
    root = mul(root, 0x02);
  }
  return out;
}
function remainder(data: number[], div: number[]): number[] {
  const out = new Array<number>(div.length).fill(0);
  data.forEach((b) => {
    const factor = b ^ (out.shift() as number);
    out.push(0);
    div.forEach((d, i) => { out[i] ^= mul(d, factor); });
  });
  return out;
}

/** The data codewords with their error correction, split into blocks and interleaved as the standard lays them out. */
function withEcc(data: number[], ver: number, level: Level): number[] {
  const blocks = BLOCKS[level][ver], ecc = ECC_PER_BLOCK[level][ver];
  const raw = Math.floor(rawModules(ver) / 8);
  const short = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const div = divisor(ecc);
  const list: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const len = shortLen - ecc + (i < short ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    const e = remainder(dat, div);
    if (i < short) dat.push(0);
    list.push(dat.concat(e));
  }
  const out: number[] = [];
  for (let i = 0; i < list[0].length; i++) {
    list.forEach((b, j) => { if (i !== shortLen - ecc || j >= short) out.push(b[i]); });
  }
  return out;
}

/** The smallest version (and level) that holds this many bytes: M first, L when M cannot. */
export function fitVersion(bytes: number): { ver: number; level: Level } | null {
  for (const level of ['M', 'L'] as Level[]) {
    for (let ver = 1; ver <= 40; ver++) {
      const count = ver < 10 ? 8 : 16;
      const bits = 4 + count + bytes * 8;
      if (bits <= dataBytes(ver, level) * 8) return { ver, level };
    }
  }
  return null;
}

/** The bytes a QR code carries for these words: mode, count, the words as UTF-8, end mark and padding. */
function codewords(bytes: Uint8Array, ver: number, level: Level): number[] {
  const bits: number[] = [];
  const put = (v: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(0x4, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const cap = dataBytes(ver, level) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; out.length < cap / 8; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

/** How badly a finished symbol reads, by the standard's four penalty rules (lower is better). */
export function penalty(m: boolean[][]): number {
  const size = m.length;
  let score = 0;
  const line = (get: (i: number) => boolean) => {
    // Rule 1: runs of five or more of one colour. Rule 3: the 1:1:3:1:1 finder look with four light on one side.
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && get(i) === get(i - 1)) { run++; continue; }
      if (run >= 5) score += 3 + (run - 5);
      run = 1;
    }
    const at = (i: number) => (i < 0 || i >= size ? false : get(i));
    for (let i = 0; i + 7 <= size; i++) {
      if (!(at(i) && !at(i + 1) && at(i + 2) && at(i + 3) && at(i + 4) && !at(i + 5) && at(i + 6))) continue;
      const lightBefore = [1, 2, 3, 4].every((k) => !at(i - k));
      const lightAfter = [7, 8, 9, 10].every((k) => !at(i + k));
      if (lightBefore || lightAfter) score += 40;
    }
  };
  for (let y = 0; y < size; y++) line((x) => m[y][x]);
  for (let x = 0; x < size; x++) line((y) => m[y][x]);
  // Rule 2: two-by-two blocks of one colour.
  for (let y = 0; y + 1 < size; y++) for (let x = 0; x + 1 < size; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
  }
  // Rule 4: how far the dark share is from half, in steps of five per cent.
  let dark = 0;
  m.forEach((row) => row.forEach((c) => { if (c) dark++; }));
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

/** A QR code for these words: rows of modules, true for dark, without the quiet zone (draw four light modules round
 * it). Throws a plain sentence when the words are too long for any QR code. */
export function qrMatrix(text: string, forceMask = -1): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const fit = fitVersion(bytes.length);
  if (!fit) throw new Error('Those words are too long for a square code.');
  const { ver, level } = fit;
  const size = ver * 4 + 17;
  const mod: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => { mod[y][x] = dark; fixed[y][x] = true; };

  // Timing lines, finder squares, alignment squares.
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, d !== 2 && d !== 4);
    }
  });
  const al = alignment(ver);
  al.forEach((ay, i) => al.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const format = (mask: number) => {
    const data = (LEVEL_BITS[level] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  // The data, in the zigzag from the bottom right.
  const all = withEcc(codewords(bytes, ver, level), ver, level);
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const up = ((right + 1) & 2) === 0;
      const y = up ? size - 1 - v : v;
      if (fixed[y][x] || k >= all.length * 8) continue;
      mod[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) === 1;
      k++;
    }
  }

  const masked = (mask: number): boolean[][] => {
    const out = mod.map((row) => row.slice());
    const f = MASKS[mask];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && f(x, y)) out[y][x] = !out[y][x];
    return out;
  };
  let best = -1, bestScore = Infinity, bestM: boolean[][] = mod;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask >= 0 && mask !== forceMask) continue;
    format(mask);
    const m = masked(mask);
    const s = penalty(m);
    if (s < bestScore) { best = mask; bestScore = s; bestM = m; }
  }
  format(best);
  // The format bits were written into `mod`; copy them over the masked symbol (they are fixed, so masking skipped them).
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (fixed[y][x]) bestM[y][x] = mod[y][x];
  return bestM;
}

/** The code as an SVG picture: black squares on white with the four-module quiet zone, one unit per module. */
export function qrSvg(text: string, title = 'Square code'): string {
  const m = qrMatrix(text);
  const n = m.length + 8;
  let path = '';
  m.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += 'M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z'; }));
  const esc = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="' + esc.replace(/"/g, '&quot;') + '">'
    + '<rect width="' + n + '" height="' + n + '" fill="#fff"/><path fill="#000" d="' + path + '"/></svg>';
}
