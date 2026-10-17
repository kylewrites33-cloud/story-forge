// Draws the app icons (a chapter grid of cards on the accent colour) as PNG files, with no image library.
// Run with `npm run icons`; the output in public/icons is committed.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const ACCENT = [0xb4, 0x40, 0x0c];
const CARD = [0xfb, 0xf3, 0xea];
const DONE = [0xf2, 0xb4, 0x8a];

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

// Shapes in a 0..1 square: [x, y, w, h, radius, colour]
function shapes(inset) {
  const s = (v) => inset + v * (1 - 2 * inset);
  const list = [];
  const cols = 2, rows = 3, gap = 0.07, x0 = 0.2, y0 = 0.17, w = (0.6 - gap) / cols, h = (0.66 - gap * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const colour = r === 0 ? DONE : CARD;
      list.push([s(x0 + c * (w + gap)), s(y0 + r * (h + gap)), w * (1 - 2 * inset), h * (1 - 2 * inset), 0.035, colour]);
    }
  }
  return list;
}

function inRounded(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r), cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function draw(size, { inset = 0, corner = 0 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const list = shapes(inset);
  const SS = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size, py = (y + (sy + 0.5) / SS) / size;
          if (corner && !inRounded(px, py, 0, 0, 1, 1, corner)) continue;
          let col = ACCENT;
          for (const [qx, qy, qw, qh, qr, qc] of list) if (inRounded(px, py, qx, qy, qw, qh, qr)) col = qc;
          r += col[0]; g += col[1]; b += col[2]; a += 255;
        }
      }
      const n = SS * SS, i = (y * size + x) * 4;
      const cov = a / 255;
      buf[i] = cov ? r / cov : 0; buf[i + 1] = cov ? g / cov : 0; buf[i + 2] = cov ? b / cov : 0; buf[i + 3] = a / n;
    }
  }
  return png(size, buf);
}

function svg() {
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const rects = shapes(0).map(([x, y, w, h, r, c]) => `<rect x="${(x * 512).toFixed(1)}" y="${(y * 512).toFixed(1)}" width="${(w * 512).toFixed(1)}" height="${(h * 512).toFixed(1)}" rx="${(r * 512).toFixed(1)}" fill="${hex(c)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${hex(ACCENT)}"/>${rects}</svg>\n`;
}

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), draw(192, { corner: 0.22 }));
fs.writeFileSync(path.join(out, 'icon-512.png'), draw(512, { corner: 0.22 }));
fs.writeFileSync(path.join(out, 'icon-512-maskable.png'), draw(512, { inset: 0.1 }));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), draw(180));
fs.writeFileSync(path.join(out, 'icon.svg'), svg());
console.log('Wrote icons to ' + out);
