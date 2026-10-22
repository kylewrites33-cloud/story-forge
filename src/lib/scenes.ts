// Making and reshaping scenes from the app: a new scene, a scene split in two, two scenes joined into one.
// Every step keeps Kyle's words safe before anything is taken away: a split saves a copy first, and a join moves the
// scene it absorbs to the book's Archive folder (with a note saying why) before removing it from Scenes.
// IDs never change and are never reused; the `order` property places a scene in reading order.
import { Frontmatter } from './frontmatter.js';
import { saveSnapshot } from './drafts.ts';
import { applyToText, editChange } from './ideas.ts';
import { makeNote } from './vault-index.ts';
import type { FileEntry, NoteRecord, VaultSource } from './types.ts';

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

function today(d: Date): string {
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

/** Add a scene to the vault. Returns the new note. */
export async function createScene(source: VaultSource, s: NewScene, now: Date, why: string): Promise<NoteRecord> {
  if (!source.write) throw new Error('This vault cannot be changed from the app.');
  const title = safeTitle(s.title);
  if (!title) throw new Error('Give the scene a title first.');
  for (let attempt = 0; ; attempt++) {
    const { files } = await source.tree();
    const id = nextSceneId(files, s.bookFolder);
    const path = s.bookFolder + '/Scenes/' + id + ' ' + title + '.md';
    const text = sceneText(id, { ...s, title }, now);
    try {
      const sha = await source.write(path, text, '', 'scenes: add ' + id + ' ' + title + '\n\n' + why);
      return makeNote(path, sha, text);
    } catch (e) {
      // Someone else took that ID a moment ago: count again once.
      if ((e as { conflict?: boolean }).conflict && attempt === 0) continue;
      throw e;
    }
  }
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

/** Save the words after the cursor as a new scene right after this one. A copy of the whole scene is saved first.
 * The caller then saves this scene with the words before the cursor (through the writing screen's normal save). */
export async function splitOff(source: VaultSource, note: NoteRecord, next: NoteRecord | null, wholeBody: string, after: string,
  title: string, bookFolder: string, now: Date): Promise<NoteRecord> {
  await saveSnapshot(source, note, wholeBody, 'before split', now);
  const status = String(note.data.status || 'drafted');
  return createScene(source, {
    bookFolder, title, chapter: num(note.data.chapter), chapterTitle: typeof note.data.chapter_title === 'string' ? note.data.chapter_title : '',
    order: orderBetween(note, next), status, from: note, body: after
  }, now, 'Split from ' + [note.data.id, note.data.title].filter(Boolean).join(' ') + ' in the Sparrow app.');
}

/** Take the next scene's words for joining: move its note to the Archive (with a note saying why), and return its body.
 * The caller saves the joined body into this scene, then calls `removeJoined`. */
export async function archiveForJoin(source: VaultSource, into: NoteRecord, next: NoteRecord, now: Date): Promise<{ body: string; sha: string }> {
  if (!source.readFresh || !source.write) throw new Error('This vault cannot be changed from the app.');
  const fresh = await source.readFresh(next.path);
  const cur = makeNote(next.path, fresh.sha, fresh.text);
  const intoName = [into.data.id, into.data.title].filter(Boolean).join(' ');
  const why = 'Joined onto the end of ' + intoName + ' in the Sparrow app on ' + today(now) + '. Its words are there now; this is the note as it was.';
  const dest = archivePath(next.path);
  let destSha = '';
  try {
    destSha = (await source.readFresh(dest)).sha;
  } catch (e) {
    if ((e as { status?: number }).status !== 404 && !/has no/.test((e as Error).message)) throw e;
  }
  await source.write(dest, archivedText(fresh.text, why), destSha,
    'scenes: archive ' + [cur.data.id, cur.data.title].filter(Boolean).join(' ') + '\n\n' + why);
  return { body: cur.body, sha: fresh.sha };
}

/** Remove the joined scene from Scenes once its words are saved in the scene it joined. */
export async function removeJoined(source: VaultSource, next: NoteRecord, sha: string, intoName: string): Promise<void> {
  if (!source.remove) throw new Error('This vault cannot be changed from the app.');
  await source.remove(next.path, sha, 'scenes: join ' + [next.data.id, next.data.title].filter(Boolean).join(' ') + ' into ' + intoName +
    '\n\nJoined in the Sparrow app. The note as it was is in the book\'s Archive folder.');
}

/** Notes in a book whose properties name a scene ID (progressions at it, beats and promises listing it). */
export function mentionsOf(notes: NoteRecord[], id: string): NoteRecord[] {
  const re = new RegExp('\\b' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
  return notes.filter((n) => n.data.id !== id && re.test(JSON.stringify(n.data)));
}

/** After a join, the old ID is gone: leave the team an open note to point notes that name it at the scene it joined.
 * The app only reads some note types, so the list is a start; sf validate finds the rest. */
export async function noteJoinForTeam(source: VaultSource, bookFolder: string, from: NoteRecord, into: NoteRecord, mentions: NoteRecord[], now: Date): Promise<string | null> {
  if (!source.write) return null;
  const fromId = String(from.data.id || ''), intoId = String(into.data.id || '');
  const title = 'Joined ' + fromId + ' into ' + intoId + ' ' + now.toISOString().slice(0, 10);
  const path = bookFolder + '/Notes to the Team/' + title + '.md';
  const body = '\nKyle joined ' + [fromId, from.data.title].filter(Boolean).join(' ') + ' onto the end of ' + [intoId, into.data.title].filter(Boolean).join(' ') +
    ' in the Sparrow app. ' + fromId + ' no longer exists (its old note is in the Archive). Point every note that still names ' + fromId +
    ' (progressions, promises, beats, Story So Far) at ' + intoId + ' or wherever fits now. `sf validate` lists them.\n' +
    (mentions.length ? '\nThe app saw these:\n\n' + mentions.map((n) => '- [[' + n.path.slice(n.path.lastIndexOf('/') + 1).replace(/\.md$/, '') + ']]').join('\n') + '\n' : '');
  const text = Frontmatter.join({ type: 'note', title, to: 'Continuity Keeper', status: 'open', created: today(now) }, body);
  try {
    await source.write(path, text, '', 'notes: ' + title + '\n\nWritten by the Sparrow app after a join.');
    return path;
  } catch (e) {
    if ((e as { conflict?: boolean }).conflict) return null;
    throw e;
  }
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

/** Put an archived scene back in the book's Scenes folder, then take it out of the Archive. Its ID and order are as they
 * were, so it comes back where it stood. */
export async function restoreArchived(source: VaultSource, entry: FileEntry, bookFolder: string): Promise<NoteRecord> {
  if (!source.write || !source.remove) throw new Error('This vault cannot be changed from the app.');
  const text = await source.read(entry.path, entry.sha);
  const name = entry.path.slice(entry.path.lastIndexOf('/') + 1);
  const dest = bookFolder + '/Scenes/' + name;
  const back = unarchivedText(text);
  let sha: string;
  try {
    sha = await source.write(dest, back, '', 'scenes: restore ' + name.replace(/\.md$/, '') + '\n\nRestored from the book\'s Archive in the Sparrow app.');
  } catch (e) {
    if ((e as { conflict?: boolean }).conflict) throw new Error('A scene called ' + name.replace(/\.md$/, '') + ' is already in Scenes, so this one stays in the Archive.');
    throw e;
  }
  await source.remove(entry.path, entry.sha, 'scenes: ' + name.replace(/\.md$/, '') + ' back from the Archive\n\nIt is in Scenes again.');
  return makeNote(dest, sha, back);
}

/** A scene's file name follows its title ("S-012 Grey lies to Rue.md"). A new title writes the note under the new name
 * (title line changed, nothing else) and then removes the old file, so the body is never lost. */
export async function renameScene(source: VaultSource, note: NoteRecord, title: string): Promise<NoteRecord> {
  if (!source.readFresh || !source.write || !source.remove) throw new Error('This vault cannot be changed from the app.');
  const clean = safeTitle(title);
  if (!clean) throw new Error('Give the scene a title first.');
  const fresh = await source.readFresh(note.path);
  const cur = makeNote(note.path, fresh.sha, fresh.text);
  const id = String(cur.data.id || '');
  const dir = note.path.slice(0, note.path.lastIndexOf('/'));
  const dest = dir + '/' + (id ? id + ' ' : '') + clean + '.md';
  const text = applyToText(fresh.text, editChange({ title: clean }));
  const why = 'Renamed in the Sparrow app: ' + String(cur.data.title || '') + ' -> ' + clean + '.';
  if (dest === note.path) {
    const sha = await source.write(note.path, text, fresh.sha, 'scenes: retitle ' + id + '\n\n' + why);
    return makeNote(note.path, sha, text);
  }
  let sha: string;
  try {
    sha = await source.write(dest, text, '', 'scenes: rename ' + id + ' to ' + clean + '\n\n' + why);
  } catch (e) {
    if ((e as { conflict?: boolean }).conflict) throw new Error('A scene called ' + clean + ' is already there. Choose another title.');
    throw e;
  }
  await source.remove(note.path, fresh.sha, 'scenes: rename ' + id + ' (old file name)\n\n' + why);
  return makeNote(dest, sha, text);
}

/** A scene's planning notes (Kyle's outline, Team notes, Open for Kyle questions), kept beside the prose in the book's
 * Scene Notes folder as a `scene-notes` note, so the page shows only the story. */
export function sceneNotesFor(notes: Record<string, NoteRecord>, bookFolder: string, sceneId: string): NoteRecord | null {
  const want = String(sceneId || '').toUpperCase();
  if (!want) return null;
  return Object.values(notes).find((n) => n.type === 'scene-notes' && n.path.startsWith(bookFolder + '/')
    && String(n.data.scene || '').toUpperCase() === want) || null;
}
