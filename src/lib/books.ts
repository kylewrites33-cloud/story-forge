// New series and books from the home page: the app writes Series.md or Book.md with the properties the schema requires,
// in the folders sf reads (Series/<Name>/Series.md, Series/<Name>/Books/<N> <Title>/Book.md), as Kyle's commits.
import { Frontmatter } from './frontmatter.js';
import { safeTitle } from './scenes.ts';
import { makeNote } from './vault-index.ts';
import type { NoteRecord, VaultSource } from './types.ts';

function today(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

async function add(source: VaultSource, path: string, text: string, message: string, what: string): Promise<NoteRecord> {
  if (!source.write) throw new Error('This vault cannot be changed from the app.');
  try {
    const sha = await source.write(path, text, '', message);
    return makeNote(path, sha, text);
  } catch (e) {
    if ((e as { conflict?: boolean }).conflict) throw new Error(what + ' is already in the vault. Choose another name.');
    throw e;
  }
}

export function seriesText(name: string, genre: string, now: Date): string {
  const data: Record<string, unknown> = { type: 'series', name, genre: genre.trim(), status: 'active', created: today(now) };
  return Frontmatter.join(data, '\n' + name + ' was started in the Story Forge app.\n');
}

export async function createSeries(source: VaultSource, name: string, genre: string, now: Date): Promise<NoteRecord> {
  const clean = safeTitle(name);
  if (!clean) throw new Error('Give the series a name first.');
  return add(source, 'Series/' + clean + '/Series.md', seriesText(clean, genre, now), 'vault: new series ' + clean + '\n\nStarted in the Story Forge app.', 'A series called ' + clean);
}

export function bookText(title: string, seriesName: string, number: number, now: Date): string {
  const data: Record<string, unknown> = { type: 'book', title, series: '[[' + seriesName + ']]', number, stage: 'spark', created: today(now) };
  return Frontmatter.join(data, '\n' + title + ' was started in the Story Forge app.\n');
}

/** The next book number in a series, from its books' folders. */
export function nextBookNumber(numbers: (number | null)[]): number {
  return numbers.reduce<number>((m, n) => Math.max(m, n || 0), 0) + 1;
}

export async function createBook(source: VaultSource, seriesFolder: string, seriesName: string, title: string, number: number, now: Date): Promise<NoteRecord> {
  const clean = safeTitle(title);
  if (!clean) throw new Error('Give the book a title first.');
  if (!(number > 0)) throw new Error('Give the book a number, such as 1.');
  return add(source, seriesFolder + '/Books/' + number + ' ' + clean + '/Book.md', bookText(clean, seriesName, number, now),
    'vault: new book ' + clean + '\n\nStarted in the Story Forge app.', 'A book called ' + number + ' ' + clean);
}

/** Manuscript files the app can bring in: Word, plain text and Markdown, up to 20 MB. */
export function manuscriptProblem(name: string, size: number): string | null {
  if (!/\.(docx|txt|md)$/i.test(name)) return 'Choose a Word file (.docx), a text file (.txt) or a Markdown file (.md).';
  if (size > 20 * 1024 * 1024) return 'That file is bigger than 20 MB. Save it without pictures and try again.';
  return null;
}

/** Where a manuscript goes: the book's Research folder, under a safe name that is not taken. */
export function manuscriptPath(bookFolder: string, name: string, taken: string[]): string {
  const m = /^(.*?)(\.[^.]+)$/.exec(name);
  const stem = safeTitle(m ? m[1] : name) || 'Manuscript';
  const ext = m ? m[2].toLowerCase() : '.txt';
  let path = bookFolder + '/Research/' + stem + ext;
  for (let i = 2; taken.indexOf(path) >= 0; i++) path = bookFolder + '/Research/' + stem + ' (' + i + ')' + ext;
  return path;
}

/** A file's bytes as base64, for saving a Word file unchanged. */
export async function fileBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
