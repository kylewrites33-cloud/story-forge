// Making and reshaping scenes from the app: a new scene, a scene split in two, two scenes joined into one.
// Every step keeps Kyle's words safe before anything is taken away: a split saves a copy first, and a join moves the
// scene it absorbs to the book's Archive folder (with a note saying why) before removing it from Scenes.
// IDs never change and are never reused; the `order` property places a scene in reading order.
import { Frontmatter } from './frontmatter.js';
import type { FileEntry, Made, NoteRecord } from './types.ts';
import { propText } from './props.ts';

/** The next free scene ID in a book, from a fresh file list, the way `sf next-id scene` counts
 * (every file in the book except Snapshots, Exports and Archive). */
export function nextSceneId(files: FileEntry[], bookFolder: string): string {
  let max = 0;
  const prefix = bookFolder + '/';
  files.forEach((f) => {
    if (!f.path.startsWith(prefix) || /\/(Snapshots|Exports|Archive)\//.test(f.path)) return;
    const m = /^S-(\d+)/.exec(f.path.slice(f.path.lastIndexOf('/') + 1));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'S-' + String(max + 1).padStart(3, '0');
}

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

/** An order that falls between two scenes (either may be missing). */
export function orderBetween(prev: NoteRecord | null, next: NoteRecord | null): number {
  const a = prev ? num(prev.data.order) : null;
  const b = next ? num(next.data.order) : null;
  if (a != null && b != null) return b > a ? Math.round(((a + b) / 2) * 1000) / 1000 : a + 0.5;
  if (a != null) return Math.floor(a) + 1;
  if (b != null) return b > 1 ? Math.floor(b) - 1 : b / 2;
  return 1;
}

/** Characters that break file names, as sf's safeFileName removes them. */
export function safeTitle(s: string): string {
  return String(s || '').replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90).trim();
}

export function today(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export interface NewScene {
  bookFolder: string;
  title: string;
  chapter: number | null;
  chapterTitle?: string;
  order: number;
  status: string;
  /** Properties to carry over from the scene it came from (a split): act, pov, cast, place. */
  from?: NoteRecord | null;
  body: string;
}

/** The text of a new scene note, properties in the schema's order. */
export function sceneText(id: string, s: NewScene, now: Date): string {
  const data: Record<string, unknown> = { type: 'scene', id, title: s.title, status: s.status, kind: 'story' };
  if (s.chapter != null) data.chapter = s.chapter;
  if (s.chapterTitle) data.chapter_title = s.chapterTitle;
  data.order = s.order;
  if (s.from) ['act', 'pov', 'cast', 'place'].forEach((k) => { if (s.from!.data[k] != null && s.from!.data[k] !== '') data[k] = s.from!.data[k]; });
  data.created = today(now);
  return Frontmatter.join(data, '\n' + s.body.replace(/^\s+/, ''));
}

/** A new scene, worked out from the files the vault has (for the `scene` maker, src/vault/makers.ts): the next free
 * S-number in the book, or `keep`, the ID it was shown with, unless a scene in the book took that number meanwhile.
 * Throws a plain sentence when there is no title. */
export function planScene(files: FileEntry[], s: NewScene, now: Date, keep = '', why = 'Added in the Sparrow app.'): Made {
  const title = safeTitle(s.title);
  if (!title) throw new Error('Give the scene a title first.');
  const want = /^S-(\d+)$/.exec(keep);
  const prefix = s.bookFolder + '/';
  const taken = want && files.some((f) => {
    if (!f.path.startsWith(prefix) || /\/(Snapshots|Exports|Archive)\//.test(f.path)) return false;
    const m = /^S-(\d+)/.exec(f.path.slice(f.path.lastIndexOf('/') + 1));
    return Boolean(m) && parseInt(m![1], 10) === parseInt(want[1], 10);
  });
  const id = want && !taken ? keep : nextSceneId(files, s.bookFolder);
  return { id, path: s.bookFolder + '/Scenes/' + id + ' ' + title + '.md', text: sceneText(id, { ...s, title }, now), message: 'scenes: add ' + id + ' ' + title + '\n\n' + why };
}

/** Where a scene goes when it is joined into another: the book's Archive folder, same file name. */
export function archivePath(path: string): string {
  const m = /^(Series\/[^/]+\/Books\/[^/]+)\/(.*)$/.exec(path);
  const name = path.slice(path.lastIndexOf('/') + 1);
  return (m ? m[1] : path.slice(0, path.lastIndexOf('/'))) + '/Archive/' + name;
}

/** The archived copy: the note as it was, with a callout under the properties saying why it moved. */
export function archivedText(text: string, why: string): string {
  const s = Frontmatter.split(text);
  const note = '> [!note] Archived\n> ' + why + '\n';
  if (!s.hasFm) return note + '\n' + text;
  return s.open + (s.yaml || '') + s.close + '\n' + note + s.body;
}

/** The body after joining: this scene's words, a blank line, then the next scene's words. */
export function joinedBody(body: string, nextBody: string): string {
  return body.replace(/\s+$/, '') + '\n\n' + nextBody.replace(/^\s+/, '');
}

/** Split support: the body before the cursor (kept in this scene) and after it (the new scene). */
export function splitAt(body: string, at: number): { before: string; after: string } {
  return { before: body.slice(0, at).replace(/\s+$/, '') + '\n', after: body.slice(at).replace(/^\s+/, '') };
}

/** Notes in a book whose properties name a scene ID (progressions at it, beats and promises listing it). */
export function mentionsOf(notes: NoteRecord[], id: string): NoteRecord[] {
  const re = new RegExp('\\b' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
  return notes.filter((n) => n.data.id !== id && re.test(JSON.stringify(n.data)));
}

/** What a joined scene's archived copy says about where its words went. */
export function joinedWhy(into: { data: Record<string, unknown> }, now: Date): string {
  return 'Joined onto the end of ' + [into.data.id, into.data.title].filter(Boolean).join(' ') + ' in the Sparrow app on ' + today(now) + '. Its words are there now; this is the note as it was.';
}

/** The open note the team gets after a join (the old ID is gone): its path, text and history line. `mentions` are the
 * paths of the notes the app saw naming the joined scene. */
export function joinNote(bookFolder: string, from: { data: Record<string, unknown> }, into: { data: Record<string, unknown> }, mentions: string[], now: Date): { path: string; text: string; message: string } {
  const fromId = propText(from, 'id'), intoId = propText(into, 'id');
  const title = 'Joined ' + fromId + ' into ' + intoId + ' ' + now.toISOString().slice(0, 10);
  const path = bookFolder + '/Notes to the Team/' + title + '.md';
  const body = '\nKyle joined ' + [fromId, from.data.title].filter(Boolean).join(' ') + ' onto the end of ' + [intoId, into.data.title].filter(Boolean).join(' ') +
    ' in the Sparrow app. ' + fromId + ' no longer exists (its old note is in the Archive). Point every note that still names ' + fromId +
    ' (progressions, promises, beats, Story So Far) at ' + intoId + ' or wherever fits now. `sf validate` lists them.\n' +
    (mentions.length ? '\nThe app saw these:\n\n' + mentions.map((p) => '- [[' + p.slice(p.lastIndexOf('/') + 1).replace(/\.md$/, '') + ']]').join('\n') + '\n' : '');
  return { path, text: Frontmatter.join({ type: 'note', title, to: 'Continuity Keeper', status: 'open', created: today(now) }, body), message: 'notes: ' + title + '\n\nWritten by the Sparrow app after a join.' };
}

/** An archived scene's text with the "Archived" callout taken out again. */
export function unarchivedText(text: string): string {
  const s = Frontmatter.split(text);
  const strip = (b: string) => b.replace(/^(\r?\n)?> \[!note\] Archived\r?\n(?:>.*\r?\n)*/, '');
  return s.hasFm ? s.open + (s.yaml || '') + s.close + strip(s.body) : strip(text);
}

/** What the Archived callout says about where the scene went ("Joined onto the end of S-004 Ice on the Ford ..."). */
export function archivedWhy(text: string): string {
  const m = /> \[!note\] Archived\r?\n> (.*)/.exec(text);
  return m ? m[1].trim() : '';
}

/** A scene's planning notes (Kyle's outline, Team notes, Open for Kyle questions), kept beside the prose in the book's
 * Scene Notes folder as a `scene-notes` note, so the page shows only the story. */
export function sceneNotesFor(notes: Record<string, NoteRecord>, bookFolder: string, sceneId: string): NoteRecord | null {
  const want = String(sceneId || '').toUpperCase();
  if (!want) return null;
  return Object.values(notes).find((n) => n.type === 'scene-notes' && n.path.startsWith(bookFolder + '/')
    && propText(n, 'scene').toUpperCase() === want) || null;
}
