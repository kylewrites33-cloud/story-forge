// Draws the app icons (Sparrow: a cream sparrow over a dark line, on terracotta; Kyle's pick, 2026-10-22) as PNG files and
// an SVG, with no image library.
// Run with `npm run icons`; the output in public/icons is committed.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const ACCENT = [0xb5, 0x53, 0x2f];
const CREAM = [0xfb, 0xf3, 0xe6];
const INK = [0x2b, 0x25, 0x22];

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// The sparrow in a 512 square, drawn in this order. Paths use absolute M, L, C and Z only, so the same list gives the
// SVG and the PNGs; the eye and the wing line are cut back to the background colour. src/ui/Shell.tsx draws the same
// bird in the sidebar.
const BIRD_PATH = 'M378 156 L432 170 L380 184 C384 250 346 310 276 326 C242 336 208 328 190 310 L82 358 L68 340 L166 272 C176 210 216 146 266 124 C316 102 366 116 378 156 Z';
const WING_PATH = 'M200 286 C256 290 312 260 328 212';
const BIRD = [
  { line: [[120, 384], [392, 384]], width: 10, colour: INK },
  { path: BIRD_PATH, colour: CREAM },
  { curve: WING_PATH, width: 12, colour: ACCENT },
  { circle: [342, 160, 11], colour: ACCENT },
];

// Each shape as one or more closed polygons in the 512 square.
function bezier(p0, p1, p2, p3, steps = 24) {
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}
function pathPolys(d) {
  const nums = d.match(/[MLCZ]|-?[\d.]+/g);
  const polys = [];
  let cur = null, i = 0;
  const pt = () => [Number(nums[i++]), Number(nums[i++])];
  while (i < nums.length) {
    const cmd = nums[i++];
    if (cmd === 'M') { cur = [pt()]; polys.push(cur); }
    else if (cmd === 'L') cur.push(pt());
    else if (cmd === 'C') { const a = pt(), b = pt(), c = pt(); cur.push(...bezier(cur[cur.length - 1], a, b, c)); }
  }
  return polys;
}
function arc(cx, cy, r, from, to, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) { const a = from + (to - from) * i / steps; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}
function polygons(s) {
  if (s.path) return pathPolys(s.path);
  if (s.circle) return [arc(s.circle[0], s.circle[1], s.circle[2], 0, 2 * Math.PI, 48)];
  if (s.curve) {
    const pts = pathPolys(s.curve)[0], out = [];
    for (let k = 0; k < pts.length - 1; k++) out.push(...polygons({ line: [pts[k], pts[k + 1]], width: s.width }));
    return out;
  }
  const [[x0, y0], [x1, y1]] = s.line, r = s.width / 2, a = Math.atan2(y1 - y0, x1 - x0);
  return [[...arc(x1, y1, r, a - Math.PI / 2, a + Math.PI / 2, 16), ...arc(x0, y0, r, a + Math.PI / 2, a + Math.PI * 1.5, 16)]];
}
function roundedSquare(r) {
  return [[...arc(512 - r, r, r, -Math.PI / 2, 0, 16), ...arc(512 - r, 512 - r, r, 0, Math.PI / 2, 16),
    ...arc(r, 512 - r, r, Math.PI / 2, Math.PI, 16), ...arc(r, r, r, Math.PI, Math.PI * 1.5, 16)]];
}

// Fill polygons (nonzero winding) into a supersampled colour buffer, one sample row at a time.
function fill(buf, n, polys, colour, scale, shift) {
  const edges = [];
  for (const poly of polys) {
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k], q = poly[(k + 1) % poly.length];
      const a = [p[0] * scale + shift, p[1] * scale + shift], b = [q[0] * scale + shift, q[1] * scale + shift];
      if (a[1] !== b[1]) edges.push(a[1] < b[1] ? [a, b, 1] : [b, a, -1]);
    }
  }
  for (let y = 0; y < n; y++) {
    const sy = y + 0.5, hits = [];
    for (const [a, b, w] of edges) if (sy >= a[1] && sy < b[1]) hits.push([a[0] + (sy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]), w]);
    hits.sort((p, q) => p[0] - q[0]);
    let wind = 0;
    for (let k = 0; k < hits.length - 1; k++) {
      wind += hits[k][1];
      if (!wind) continue;
      const from = Math.max(0, Math.ceil(hits[k][0] - 0.5)), to = Math.min(n - 1, Math.floor(hits[k + 1][0] - 0.5));
      for (let x = from; x <= to; x++) { const i = (y * n + x) * 4; buf[i] = colour[0]; buf[i + 1] = colour[1]; buf[i + 2] = colour[2]; buf[i + 3] = 255; }
    }
  }
}

// corner: rounded background (0 = square). inset: share of each side kept clear, for maskable icons.
function draw(size, { inset = 0, corner = 0 } = {}) {
  const SS = 4, n = size * SS, big = Buffer.alloc(n * n * 4);
  fill(big, n, corner ? roundedSquare(corner * 512) : [[[0, 0], [512, 0], [512, 512], [0, 512]]], ACCENT, n / 512, 0);
  const scale = n / 512 * (1 - 2 * inset);
  for (const s of BIRD) fill(big, n, polygons(s), s.colour, scale, inset * n);
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * n + x * SS + sx) * 4, w = big[i + 3];
          r += big[i] * w; g += big[i + 1] * w; b += big[i + 2] * w; a += w;
        }
      }
      const i = (y * size + x) * 4;
      buf[i] = a ? r / a : 0; buf[i + 1] = a ? g / a : 0; buf[i + 2] = a ? b / a : 0; buf[i + 3] = a / (SS * SS);
    }
  }
  return png(size, buf);
}

function svg() {
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const parts = BIRD.map((s) => s.path ? `<path d="${s.path}" fill="${hex(s.colour)}"/>`
    : s.curve ? `<path d="${s.curve}" stroke="${hex(s.colour)}" stroke-width="${s.width}" fill="none" stroke-linecap="round"/>`
    : s.circle ? `<circle cx="${s.circle[0]}" cy="${s.circle[1]}" r="${s.circle[2]}" fill="${hex(s.colour)}"/>`
    : `<path d="M${s.line[0].join(' ')} L${s.line[1].join(' ')}" stroke="${hex(s.colour)}" stroke-width="${s.width}" stroke-linecap="round"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${hex(ACCENT)}"/>${parts}</svg>\n`;
}

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), draw(192, { corner: 0.22 }));
fs.writeFileSync(path.join(out, 'icon-512.png'), draw(512, { corner: 0.22 }));
fs.writeFileSync(path.join(out, 'icon-512-maskable.png'), draw(512, { inset: 0.1 }));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), draw(180));
fs.writeFileSync(path.join(out, 'icon.svg'), svg());
console.log('Wrote icons to ' + out);
