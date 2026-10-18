// The home page and its helpers: scenes Kyle wrote in lately, books searched and sorted, cover patterns, label colours,
// pages and reading time, the Chapter Grid filter, and an outline pasted in as new scenes.
import { linkName, nameList, toNumber } from './links.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

/** A scene Kyle opened in the writing screen, newest first. Kept per source on the device. */
export interface Recent { path: string; at: string }

const RECENT_MAX = 12;
const recentKey = (source: string) => 'story-forge.recent.' + source;

export function loadRecent(source: string): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey(source)) || '[]');
    return Array.isArray(v) ? v.filter((r) => r && typeof r.path === 'string' && typeof r.at === 'string') : [];
  } catch {
    return [];
  }
}

/** The list with this scene moved to the top. */
export function addRecent(list: Recent[], path: string, now: Date): Recent[] {
  return [{ path, at: now.toISOString() }].concat(list.filter((r) => r.path !== path)).slice(0, RECENT_MAX);
}

export function noteRecent(source: string, path: string, now: Date = new Date()): void {
  try { localStorage.setItem(recentKey(source), JSON.stringify(addRecent(loadRecent(source), path, now))); } catch { /* the list is a convenience */ }
}

/** The scenes to offer under "Continue where you left off": still in the vault, at most `max`, newest first. */
export function continueList(index: VaultIndex, recent: Recent[], max = 3): { note: NoteRecord; book: BookEntry; at: string }[] {
  const out: { note: NoteRecord; book: BookEntry; at: string }[] = [];
  for (const r of recent) {
    const note = index.notes[r.path];
    const book = note && index.books.find((b) => b.scenes.indexOf(r.path) >= 0);
    if (note && book) out.push({ note, book, at: r.at });
    if (out.length >= max) break;
  }
  return out;
}

/** When Kyle last wrote in each book, from the recent list. */
export function lastWorked(index: VaultIndex, recent: Recent[]): Record<string, string> {
  const out: Record<string, string> = {};
  recent.forEach((r) => {
    const book = index.books.find((b) => b.scenes.indexOf(r.path) >= 0);
    if (book && (!out[book.folder] || out[book.folder] < r.at)) out[book.folder] = r.at;
  });
  return out;
}

export type BookSort = 'recent' | 'name' | 'series';

/** Books matching the search (title or series name), in the chosen order. */
export function sortBooks(books: BookEntry[], query: string, sort: BookSort, worked: Record<string, string>): BookEntry[] {
  const q = query.trim().toLowerCase();
  const list = books.filter((b) => !q || b.title.toLowerCase().indexOf(q) >= 0 || b.seriesName.toLowerCase().indexOf(q) >= 0);
  const bySeries = (a: BookEntry, b: BookEntry) => a.seriesName.localeCompare(b.seriesName) || (a.number ?? Infinity) - (b.number ?? Infinity) || a.title.localeCompare(b.title);
  if (sort === 'name') return list.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'series') return list.sort(bySeries);
  return list.sort((a, b) => (worked[b.folder] || '').localeCompare(worked[a.folder] || '') || bySeries(a, b));
}

/** Total words of a book's scenes. */
export function bookWords(index: VaultIndex, book: BookEntry): number {
  return book.scenes.reduce((n, p) => n + (index.notes[p] ? toNumber(index.notes[p].data.words) || 0 : 0), 0);
}

/** How many chapters a book's scenes fall in. */
export function bookChapters(index: VaultIndex, book: BookEntry): number {
  const seen = new Set<number>();
  book.scenes.forEach((p) => { const c = index.notes[p] && toNumber(index.notes[p].data.chapter); if (c != null) seen.add(c); });
  return seen.size;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A cover for a book with no picture: two colours and a pattern picked from its title, so each book looks different. */
export function coverPattern(title: string): { background: string } {
  const h = hash(title);
  const hue = h % 360;
  const kind = (h >>> 9) % 4;
  const a = 'hsl(' + hue + ' 38% 34%)', b = 'hsl(' + ((hue + 28) % 360) + ' 42% 22%)', c = 'hsl(' + hue + ' 30% 44%)';
  const background =
    kind === 0 ? 'linear-gradient(160deg, ' + a + ', ' + b + ')'
      : kind === 1 ? 'repeating-linear-gradient(45deg, ' + a + ' 0 14px, ' + c + ' 14px 28px)'
        : kind === 2 ? 'radial-gradient(circle at 30% 25%, ' + c + ' 0 18%, transparent 19%), linear-gradient(200deg, ' + a + ', ' + b + ')'
          : 'repeating-linear-gradient(0deg, ' + b + ' 0 2px, transparent 2px 22px), linear-gradient(180deg, ' + c + ', ' + a + ')';
  return { background };
}

/** The colour of a scene label: the same label always gets the same colour. */
const LABEL_HUES = [12, 38, 95, 150, 190, 215, 260, 300, 340];
export function labelHue(name: string): number {
  return LABEL_HUES[hash(name.trim().toLowerCase()) % LABEL_HUES.length];
}

/** A scene's labels, from a list or a comma-separated line. */
export function labelsOf(v: unknown): string[] {
  const list = Array.isArray(v) ? nameList(v) : typeof v === 'string' ? v.split(',') : [];
  return list.map((s) => String(s).trim()).filter(Boolean);
}

/** Pages and reading time for a word count. Kyle can change both rates in Settings. */
export interface ReadRates { wordsPerPage: number; wordsPerMinute: number }
export const DEFAULT_RATES: ReadRates = { wordsPerPage: 250, wordsPerMinute: 250 };
const RATES_KEY = 'story-forge.read-rates';

export function loadRates(): ReadRates {
  try {
    const v = JSON.parse(localStorage.getItem(RATES_KEY) || 'null');
    if (v && v.wordsPerPage > 0 && v.wordsPerMinute > 0) return { wordsPerPage: v.wordsPerPage, wordsPerMinute: v.wordsPerMinute };
  } catch { /* defaults */ }
  return DEFAULT_RATES;
}
export function saveRates(r: ReadRates): void {
  try { localStorage.setItem(RATES_KEY, JSON.stringify(r)); } catch { /* lasts until reload */ }
}

/** "about 12 pages · 48 minutes to read". */
export function readingLine(words: number, rates: ReadRates = DEFAULT_RATES): string {
  if (words <= 0) return '';
  const pages = Math.max(1, Math.round(words / rates.wordsPerPage));
  const mins = Math.max(1, Math.round(words / rates.wordsPerMinute));
  const time = mins < 60 ? mins + (mins === 1 ? ' minute' : ' minutes')
    : Math.floor(mins / 60) + (Math.floor(mins / 60) === 1 ? ' hour' : ' hours') + (mins % 60 ? ' ' + (mins % 60) + (mins % 60 === 1 ? ' minute' : ' minutes') : '');
  return 'about ' + pages + (pages === 1 ? ' page' : ' pages') + ' · ' + time + ' to read';
}

/** Whether a scene matches the Chapter Grid filter: every word typed appears in its card or its text. */
export function sceneMatches(note: NoteRecord, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const d = note.data;
  const card = [d.id, d.title, d.headline, d.subtitle, d.summary, d.turn, d.hook, d.goal, d.status, linkName(d.pov), linkName(d.place)]
    .concat(nameList(d.cast)).concat(labelsOf(d.labels)).map((v) => (v == null ? '' : String(v))).join(' ');
  const hay = (card + ' ' + note.body).toLowerCase();
  return words.every((w) => hay.indexOf(w) >= 0);
}

/** An outline pasted in as text: a "Chapter 3: The Mill" line starts a chapter; every other line is a scene title.
 * Bullets and numbers in front of a line are dropped. Scenes before any chapter line go in chapter 1. */
export interface OutlineScene { chapter: number; chapterTitle: string; title: string }
export function parseOutline(text: string, firstChapter = 1): OutlineScene[] {
  const out: OutlineScene[] = [];
  let chapter = firstChapter, title = '';
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const ch = line.match(/^#*\s*chapter\s+(\d+)\s*[:.\-–—]?\s*(.*)$/i);
    if (ch) {
      chapter = Number(ch[1]);
      title = ch[2].trim();
      return;
    }
    const name = line.replace(/^([-*•+]|\d+[.)])\s+/, '').replace(/^#+\s*/, '').trim();
    if (!name) return;
    // Only the first scene of a chapter carries the chapter title, as the Chapter Grid expects.
    const first = !out.length || out[out.length - 1].chapter !== chapter;
    out.push({ chapter, chapterTitle: first ? title : '', title: name });
  });
  return out;
}
