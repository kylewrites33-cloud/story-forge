// Book covers: a picture in the book's folder (Cover.jpg), shrunk on the device before it is saved, and kept on the
// device by blob sha so it shows offline and is downloaded once. The picture as Kyle chose it is kept too, untouched, in
// the book's Cover/ folder (the vault's rule 11: cover images live there), for publishing.
import { readPicture, writePicture } from './cache.ts';
import type { BookEntry, VaultSource } from './types.ts';

/** Book covers show at most about 330 px tall (Book details), so 720 px is sharp on the iPad's screen and small to fetch
 * (Kyle, 2026-10-29: "it'll be a small thumbnail"). Crow's character pictures keep the older 900. */
export const COVER_HEIGHT = 720;
const PICTURE_HEIGHT = 900;
const MAX_BYTES = 15 * 1024 * 1024;

const urls = new Map<string, string>();

/** An address the page can show for the cover, or null when the book has none or it cannot be fetched now. */
export async function coverUrl(source: VaultSource, book: BookEntry): Promise<string | null> {
  const f = book.cover;
  if (!f) return null;
  const known = urls.get(f.sha);
  if (known) return known;
  let blob = await readPicture(f.sha);
  if (!blob) {
    if (!source.readBytes) return null;
    try {
      blob = await source.readBytes(f.path, f.sha);
    } catch {
      return null;
    }
    await writePicture(f.sha, blob);
  }
  const url = URL.createObjectURL(blob);
  urls.set(f.sha, url);
  return url;
}

/** A plain sentence when the file cannot be a cover, else null. */
export function coverProblem(file: { name: string; type: string; size: number }): string | null {
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) return 'That file is not a picture. Choose a JPEG or PNG.';
  if (file.size > MAX_BYTES) return 'That picture is over 15 MB. Choose a smaller one.';
  return null;
}

/** The size a picture is shrunk to: no taller than `height` and no wider than it either, never enlarged. */
export function shrunkSize(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / height, max / width);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** A print book is 6 by 9 inches, so a cover is 2 wide to 3 tall (Kyle, 2026-10-29: "can you make sure it conforms to
 * 6x9 format automatically? Maybe it'll end up cutting off the bottom of some images if necessary"). */
export const COVER_SHAPE = 6 / 9;

/** The part of a picture kept to give it the shape width / height: a picture too tall loses its bottom, one too wide
 * loses the same amount from each side. */
export function cropTo(width: number, height: number, shape: number): { x: number; y: number; width: number; height: number } {
  if (width / height > shape) {
    const w = Math.max(1, Math.round(height * shape));
    return { x: Math.floor((width - w) / 2), y: 0, width: w, height };
  }
  return { x: 0, y: 0, width, height: Math.max(1, Math.min(height, Math.round(width / shape))) };
}

/** The picture shrunk to cover size and turned into JPEG, as base64; cut to `shape` (width / height) first when given.
 * Runs in the browser. */
export async function shrinkToJpeg(file: Blob, height = PICTURE_HEIGHT, quality = 0.85, shape?: number): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This browser cannot open that picture. Try a JPEG or PNG.');
  }
  const part = shape ? cropTo(bitmap.width, bitmap.height, shape) : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const size = shrunkSize(part.width, part.height, height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot shrink pictures. Try another browser.');
  ctx.drawImage(bitmap, part.x, part.y, part.width, part.height, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = canvas.toDataURL('image/jpeg', quality);
  return data.slice(data.indexOf(',') + 1);
}

/** Where the full-size picture is kept: the book's Cover/ folder, one file per picture added, named by the time. */
export function originalPath(bookFolder: string, fileName: string, now: Date): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(fileName);
  const ext = m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate()) + ' ' + p(now.getHours()) + p(now.getMinutes()) + p(now.getSeconds());
  return bookFolder + '/Cover/Original cover ' + stamp + '.' + ext;
}

/** A file's bytes as base64. Runs in the browser. */
async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(out);
}

/** A picture from the device becomes the book's cover: the full-size picture is kept untouched in the book's Cover/
 * folder, and a small copy cut to 6 by 9 becomes Cover.jpg, which is what the app shows. Two commits, made with Kyle's key. */
export async function addCover(source: VaultSource, book: BookEntry, file: File, now = new Date()): Promise<void> {
  if (!source.writeBytes) throw new Error('Covers need your own vault, not the demo.');
  const small = await shrinkToJpeg(file, COVER_HEIGHT, 0.82, COVER_SHAPE);
  try {
    await source.writeBytes(originalPath(book.folder, file.name, now), await toBase64(file), '', 'books: full-size cover for ' + book.title);
  } catch (e) {
    if ((e as { conflict?: boolean }).conflict) throw new Error('A picture with that name is already in the Cover folder. Wait a moment and try again.');
    throw e;
  }
  await saveCover(source, book, small);
}

/** Save a picture as the book's Cover.jpg, replacing the one there. One commit, made with Kyle's key. */
export async function saveCover(source: VaultSource, book: BookEntry, base64: string): Promise<void> {
  if (!source.writeBytes) throw new Error('Covers need your own vault, not the demo.');
  const path = book.folder + '/Cover.jpg';
  const old = book.cover && book.cover.path === path ? book.cover.sha : '';
  try {
    await source.writeBytes(path, base64, old, 'books: cover for ' + book.title);
  } catch (e) {
    if ((e as { conflict?: boolean }).conflict) throw new Error('The cover changed somewhere else. Press Sync, then try again.');
    throw e;
  }
}
