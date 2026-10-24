// A book's saved drafts (Kyle, 2026-10-24: "i see value in at least labeling and keeping draft 1 accessible"). When
// editing begins, every scene is copied into the book's `Drafts/Draft 1/` folder with a `Draft 1.md` note beside it, and
// the copies never change. The scene files are always the draft being worked on: Draft 2 once Draft 1 is saved. Saving
// again makes Draft 2's copies and starts Draft 3. The vault tool and the index skip the Drafts folder, so the copies'
// scene IDs never clash with the real scenes; the app reads them only to show a saved draft or export it.
import { Frontmatter } from './frontmatter.js';
import { bodyWords } from './drafts.ts';
import type { FileEntry, NoteRecord, VaultSource } from './types.ts';

export const DRAFTS_FOLDER = 'Drafts';

export interface SavedDraft {
  number: number;
  /** The `Draft N.md` note, if it is there. */
  note: FileEntry | null;
  /** The scene copies in `Drafts/Draft N/`. */
  files: FileEntry[];
}

/** The book's saved drafts, oldest first, from the vault's file list. */
export function savedDrafts(files: FileEntry[], bookFolder: string): SavedDraft[] {
  const dir = bookFolder + '/' + DRAFTS_FOLDER + '/';
  const by = new Map<number, SavedDraft>();
  const get = (n: number) => { let d = by.get(n); if (!d) { d = { number: n, note: null, files: [] }; by.set(n, d); } return d; };
  files.forEach((f) => {
    if (!f.path.startsWith(dir)) return;
    const rest = f.path.slice(dir.length);
    const note = /^Draft (\d+)\.md$/.exec(rest);
    if (note) { get(Number(note[1])).note = f; return; }
    const copy = /^Draft (\d+)\/([^/]+\.md)$/.exec(rest);
    if (copy) get(Number(copy[1])).files.push(f);
  });
  return Array.from(by.values()).filter((d) => d.files.length || d.note).sort((a, b) => a.number - b.number);
}

/** The number of the draft the scene files hold now: one more than the last saved draft. */
export function workingNumber(drafts: SavedDraft[]): number {
  return drafts.reduce((m, d) => Math.max(m, d.number), 0) + 1;
}

const fileName = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/** A scene's copy in a saved draft: the file of the same name, or else the one that starts with its ID. */
export function copyFor(d: SavedDraft, scene: { path: string; data: Record<string, unknown> }): FileEntry | null {
  const name = fileName(scene.path);
  const same = d.files.find((f) => fileName(f.path) === name);
  if (same) return same;
  const id = String(scene.data.id || '');
  return id ? d.files.find((f) => fileName(f.path).startsWith(id + ' ') || fileName(f.path) === id + '.md') || null : null;
}

export function draftNoteText(number: number, scenes: number, words: number, now: Date, note = ''): string {
  const data: Record<string, unknown> = { type: 'draft', title: 'Draft ' + number, number, saved: now.toISOString().slice(0, 16), scenes, words };
  if (note.trim()) data.note = note.trim();
  const day = now.toISOString().slice(0, 10);
  return Frontmatter.join(data, 'Draft ' + number + ' of the book as it stood on ' + day + ': ' + scenes + ' scenes, ' + words.toLocaleString('en-US') + ' words. The copies are in the folder `Draft ' + number + '/` beside this note and are never changed.\n');
}

/** Copy every scene of the book into `Drafts/Draft N/` and write the Draft N note, as one save where the vault allows it.
 * `scenes` are the book's scene notes as last saved. Returns the new draft's number. */
export async function saveBookDraft(source: VaultSource, bookFolder: string, scenes: NoteRecord[], now: Date, note = ''): Promise<{ number: number; scenes: number; words: number }> {
  if (!source.write) throw new Error('This vault cannot be changed from the app.');
  if (!scenes.length) throw new Error('This book has no scenes yet, so there is no draft to save.');
  const { files } = await source.tree();
  const number = workingNumber(savedDrafts(files, bookFolder));
  const dir = bookFolder + '/' + DRAFTS_FOLDER + '/Draft ' + number;
  const shas = new Map(files.map((f) => [f.path, f.sha]));
  const out: { path: string; text: string }[] = [];
  let words = 0;
  for (const s of scenes) {
    const sha = shas.get(s.path) || s.sha;
    const text = await source.read(s.path, sha);
    out.push({ path: dir + '/' + fileName(s.path), text });
    words += bodyWords(s.body);
  }
  out.push({ path: bookFolder + '/' + DRAFTS_FOLDER + '/Draft ' + number + '.md', text: draftNoteText(number, scenes.length, words, now, note) });
  const message = 'drafts: save Draft ' + number + ' of ' + fileName(bookFolder) + ' (' + scenes.length + ' scenes)\n\nSaved in the Sparrow app; the scene files are now Draft ' + (number + 1) + '.';
  if (source.writeMany) await source.writeMany(out, message);
  else for (const f of out) await source.write(f.path, f.text, '', message);
  return { number, scenes: scenes.length, words };
}

/** A saved draft's scene copies as notes, for export, in the order of `scenes` (the book now) with copies of scenes
 * no longer in the book left out. */
export async function readDraft(source: VaultSource, d: SavedDraft, scenes: NoteRecord[], make: (path: string, sha: string, text: string) => NoteRecord): Promise<NoteRecord[]> {
  const out: NoteRecord[] = [];
  const used = new Set<string>();
  for (const s of scenes) {
    const f = copyFor(d, s);
    if (!f || used.has(f.path)) continue;
    used.add(f.path);
    out.push(make(f.path, f.sha, await source.read(f.path, f.sha)));
  }
  return out;
}
