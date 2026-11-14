// Makes the app icons from Kyle's own picture, scripts/icon-source.png (Kyle, 2026-11-12: "Make this the new sparrow app
// icon": a white round bird with a red eye and a red wing on a flat red square), with no image library.
// Run with `npm run icons`; the output in public/icons is committed. To change the icon, replace icon-source.png (a
// square PNG, 8-bit RGB or RGBA) and, for the sharp SVG, BIRD below; the vault skill `app-icon` has the steps.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'public', 'icons');

// The bird as one shape (eye and wing are holes), traced from icon-source.png with potrace in a 512 square.
// src/ui/Shell.tsx draws the same shape in the sidebar.
export const BACKGROUND = '#d64236';
export const BIRD_TRANSFORM = 'translate(0 512) scale(0.1 -0.1)';
export const BIRD = 'M2913 4056 c-341 -65 -620 -281 -972 -754 -46 -61 -86 -112 -89 -112 -3 0 -28 15 -56 34 -138 91 -259 131 -401 131 -234 0 -334 -142 -225 -318 17 -27 30 -50 30 -51 0 -2 -30 -5 -68 -8 -223 -16 -338 -199 -245 -389 20 -40 58 -92 98 -133 56 -58 65 -72 65 -104 2 -414 311 -901 740 -1169 758 -473 1791 -167 2203 652 232 463 197 978 -96 1410 l-54 79 135 151 c163 182 167 187 153 214 -21 38 -205 67 -353 55 l-78 -7 -61 67 c-187 203 -468 301 -726 252z m414 -352 c121 -60 146 -224 49 -320 -90 -91 -234 -77 -304 28 -113 171 72 382 255 292z m-476 -684 c299 -57 447 -370 332 -702 -231 -665 -1100 -751 -1684 -169 -92 92 -156 168 -148 175 20 17 297 207 379 261 543 353 874 482 1121 435z';

// Crow's icon, from Kyle's picture scripts/crow-icon-source.png (Kyle, 2026-11-14: "can you change the app icon", in
// the Crow project): a black crow against a pale moon on a night-blue square. Traced with potrace in a 512 square as two
// shapes: the moon and crow together, then the crow on top (the eye is a hole). Run with `npm run icons`.
export const CROW_BACKGROUND = '#353c67';
export const CROW_MOON = '#e5e3ef';
export const CROW_INK = '#15181e';
export const CROW_TRANSFORM = 'translate(0 512) scale(0.1 -0.1)';
export const CROW_MOON_SHAPE = 'M2490 4894 c-886 -59 -1698 -696 -1981 -1554 -139 -422 -152 -795 -43 -1230 l37 -145 -159 -160 c-88 -88 -194 -202 -238 -252 -43 -51 -85 -93 -92 -93 -12 0 -14 -118 -14 -730 l0 -730 1435 0 c1313 0 1435 1 1435 16 0 9 17 37 39 63 50 61 131 175 186 264 l45 71 117 41 c585 203 1068 641 1358 1230 414 840 258 1789 -414 2518 -418 454 -1106 731 -1711 691z';
export const CROW_SHAPE = 'M2470 3803 c-407 -67 -715 -369 -930 -908 -96 -241 -95 -239 -303 -381 -548 -376 -873 -655 -1166 -1003 l-71 -85 0 -713 0 -713 1424 0 1423 0 62 78 c193 242 396 615 466 860 50 172 66 271 72 447 9 277 -33 446 -178 723 -94 179 -95 188 -54 356 73 298 170 507 256 551 53 28 404 97 735 145 114 16 209 32 212 34 14 14 -215 126 -398 194 -74 27 -241 82 -370 121 -144 43 -304 100 -412 145 -196 83 -309 119 -443 141 -83 14 -265 18 -325 8z m600 -272 c58 -40 76 -125 37 -182 -52 -78 -140 -88 -203 -25 -115 115 32 299 166 207z';

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

// Reads an 8-bit, non-interlaced RGB or RGBA PNG into RGBA pixels.
function readPng(file) {
  const buf = fs.readFileSync(file);
  let i = 8, w = 0, h = 0, type = 0;
  const idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i), t = buf.toString('latin1', i + 4, i + 8), data = buf.subarray(i + 8, i + 8 + len);
    if (t === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9];
      if (data[8] !== 8 || (type !== 2 && type !== 6) || data[12] !== 0) throw new Error('The icon picture must be an 8-bit RGB or RGBA PNG, not interlaced.');
    } else if (t === 'IDAT') idat.push(data);
    i += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * h), rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 0xff;
    }
  }
  for (let k = 0; k < w * h; k++) {
    rgba[k * 4] = px[k * bpp]; rgba[k * 4 + 1] = px[k * bpp + 1]; rgba[k * 4 + 2] = px[k * bpp + 2]; rgba[k * 4 + 3] = bpp === 4 ? px[k * bpp + 3] : 255;
  }
  return { w, h, rgba };
}

// Shrinks the picture to size by averaging every source pixel each new pixel covers; corner (share of the side) rounds
// the corners, smoothed at the edge.
function icon(src, size, corner = 0) {
  const { w, h, rgba } = src, buf = Buffer.alloc(size * size * 4), sx = w / size, sy = h / size, r = corner * size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let R = 0, G = 0, B = 0, A = 0, n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.min(h, Math.ceil((y + 1) * sy)); yy++) {
        for (let xx = Math.floor(x * sx); xx < Math.min(w, Math.ceil((x + 1) * sx)); xx++) {
          const i = (yy * w + xx) * 4; R += rgba[i]; G += rgba[i + 1]; B += rgba[i + 2]; A += rgba[i + 3]; n++;
        }
      }
      let cover = 1;
      if (r) {
        const cx = Math.min(Math.max(x + 0.5, r), size - r), cy = Math.min(Math.max(y + 0.5, r), size - r);
        cover = Math.min(1, Math.max(0, r - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5));
      }
      const i = (y * size + x) * 4;
      buf[i] = R / n; buf[i + 1] = G / n; buf[i + 2] = B / n; buf[i + 3] = (A / n) * cover;
    }
  }
  return png(size, buf);
}

function svg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${BACKGROUND}"/><path transform="${BIRD_TRANSFORM}" fill="#fff" d="${BIRD}"/></svg>\n`;
}

function crowSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${CROW_BACKGROUND}"/><g transform="${CROW_TRANSFORM}"><path fill="${CROW_MOON}" d="${CROW_MOON_SHAPE}"/><path fill="${CROW_INK}" stroke="${CROW_INK}" stroke-width="12" d="${CROW_SHAPE}"/></g></svg>\n`;
}

// Writes every size of one app's icon from its picture into dir.
function writeIcons(source, dir, vector) {
  const src = readPng(path.join(here, source));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'icon-192.png'), icon(src, 192, 0.22));
  fs.writeFileSync(path.join(dir, 'icon-512.png'), icon(src, 512, 0.22));
  // The bird already sits inside the middle 80 percent, so the whole square works as the maskable icon.
  fs.writeFileSync(path.join(dir, 'icon-512-maskable.png'), icon(src, 512));
  // iPad and iPhone round the corners themselves.
  fs.writeFileSync(path.join(dir, 'apple-touch-icon.png'), icon(src, 180));
  fs.writeFileSync(path.join(dir, 'icon.svg'), vector);
  console.log('Wrote icons to ' + dir);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeIcons('icon-source.png', out, svg());
  writeIcons('crow-icon-source.png', path.join(here, '..', 'public', 'crow', 'icons'), crowSvg());
}
