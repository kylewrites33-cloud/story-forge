// A chapter's plan: Kyle's own paragraphs about what the chapter should do, kept beside the prose in the book's
// Chapter Plans folder (Kyle, 2026-10-18: "it would make sense for that to live on the right hand column too, since right
// now I keep it in the doc while im writing, then delete it away when the chapter's done"). The writing screen shows it
// in the right-hand column's Plan tab; agents read it and never edit it.
import { Frontmatter } from './frontmatter.js';
import type { NoteRecord } from './types.ts';

export const PLAN_TYPE = 'chapter-plan';

export function planTitle(chapter: number): string {
  return 'Chapter ' + chapter + ' plan';
}

export function planPath(bookFolder: string, chapter: number): string {
  return bookFolder + '/Chapter Plans/' + planTitle(chapter) + '.md';
}

export function planFor(notes: Record<string, NoteRecord>, bookFolder: string, chapter: number | null): NoteRecord | null {
  if (chapter == null) return null;
  return Object.values(notes).find((n) => n.type === PLAN_TYPE && n.path.startsWith(bookFolder + '/') && Number(n.data.chapter) === chapter) || null;
}

/** The property block a new plan starts with. */
export function planHead(chapter: number): string {
  return Frontmatter.join({ type: PLAN_TYPE, title: planTitle(chapter), chapter }, '');
}

// A chapter's scrap: words Kyle cut from the chapter and loose notes he wants to keep without putting them in the story
// (Kyle, 2026-10-22: "can you please give me a scrap section in the right hand chapter column pullout?"). Kept in the
// book's Chapter Scraps folder; the right-hand column's Scrap tab shows it. The team leaves it alone unless he asks.
export const SCRAP_TYPE = 'chapter-scrap';

export function scrapTitle(chapter: number): string {
  return 'Chapter ' + chapter + ' scrap';
}

export function scrapPath(bookFolder: string, chapter: number): string {
  return bookFolder + '/Chapter Scraps/' + scrapTitle(chapter) + '.md';
}

export function scrapFor(notes: Record<string, NoteRecord>, bookFolder: string, chapter: number | null): NoteRecord | null {
  if (chapter == null) return null;
  return Object.values(notes).find((n) => n.type === SCRAP_TYPE && n.path.startsWith(bookFolder + '/') && Number(n.data.chapter) === chapter) || null;
}

/** The property block a new scrap starts with. */
export function scrapHead(chapter: number): string {
  return Frontmatter.join({ type: SCRAP_TYPE, title: scrapTitle(chapter), chapter }, '');
}

/** The scrap with these words added at the end, a blank line after what was there. */
export function addToScrap(text: string, words: string): string {
  const add = words.trim();
  if (!add) return text;
  const before = text.replace(/\s+$/, '');
  return before ? before + '\n\n' + add + '\n' : add + '\n';
}
