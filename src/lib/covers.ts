// Book covers: a picture in the book's folder (Cover.jpg), shrunk on the device before it is saved, and kept on the
// device by blob sha so it shows offline and is downloaded once.
import { readPicture, writePicture } from './cache.ts';
import type { BookEntry, VaultSource } from './types.ts';

/** Covers are saved at most this tall, which is plenty for the home page and keeps the vault small. */
const COVER_HEIGHT = 900;
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

/** The picture shrunk to cover size and turned into JPEG, as base64. Runs in the browser. */
export async function shrinkToJpeg(file: Blob): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This browser cannot open that picture. Try a JPEG or PNG.');
  }
  const scale = Math.min(1, COVER_HEIGHT / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot shrink pictures. Try another browser.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = canvas.toDataURL('image/jpeg', 0.85);
  return data.slice(data.indexOf(',') + 1);
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
