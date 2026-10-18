// Notes to the Team: Kyle's standing instructions, one `note` per file in the book's `Notes to the Team/` folder, to the
// whole team or one agent. Agents handle open notes first and set `answered_in` to the session that answered it. The app
// lists them (open first), writes new ones as Kyle's commit, and marks them done or open again through the write queue.
import { Frontmatter } from './frontmatter.js';
import { basename, linkName } from './links.ts';
import { safeTitle } from './scenes.ts';
import { makeNote } from './vault-index.ts';
import type { BookEntry, NoteRecord, VaultIndex, VaultSource } from './types.ts';

export const NOTES_FOLDER = 'Notes to the Team';
/** Who a note goes to when it is for everyone. */
export const WHOLE_TEAM = 'Team';

const str = (v: unknown) => (v == null ? '' : String(v).trim());

export function isOpenNote(n: NoteRecord): boolean {
  return str(n.data.status || 'open') !== 'done';
}

/** A book's Notes to the Team: open ones first, then by title. */
export function bookNotesToTeam(index: VaultIndex, book: BookEntry): NoteRecord[] {
  const pre = book.folder + '/' + NOTES_FOLDER + '/';
  return Object.values(index.notes).filter((n) => n.type === 'note' && n.path.startsWith(pre))
    .sort((a, b) => Number(isOpenNote(b)) - Number(isOpenNote(a)) || str(a.data.title || basename(a.path)).localeCompare(str(b.data.title || basename(b.path))));
}

/** Who a note is for, in Kyle's words: "The whole team" or the agent's name. */
export function noteTo(n: NoteRecord): string {
  const to = str(n.data.to);
  return !to || to.toLowerCase() === 'team' || to.toLowerCase() === 'whole team' ? 'The whole team' : to;
}

/** The session a note was answered in: the book's session note the `answered_in` link names, if the index has it. */
export function answeredIn(index: VaultIndex, book: BookEntry, n: NoteRecord): { name: string; path: string | null } | null {
  const name = linkName(n.data.answered_in);
  if (!name) return null;
  const pre = book.folder + '/';
  const s = Object.values(index.notes).find((x) => x.type === 'session' && x.path.startsWith(pre) && (basename(x.path) === name || str(x.data.title) === name));
  return { name, path: s ? s.path : null };
}

export interface NewNote {
  /** A short name for the note; it becomes the file's name. */
  title: string;
  /** "Team", or one agent's name. */
  to: string;
  /** The instruction in Kyle's words. */
  body: string;
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** A title from Kyle's words when he gives none: the first words of the instruction. */
export function noteTitle(title: string, body: string): string {
  const t = safeTitle(title);
  if (t) return t;
  const words = safeTitle(body.replace(/\s+/g, ' ')).replace(/[.,;:!?]+$/, '');
  if (words.length <= 60) return words;
  return words.slice(0, 59).replace(/\s+\S*$/, '').replace(/[\s,.;:!?-]+$/, '');
}

export function noteText(n: NewNote, now: Date): string {
  const data: Record<string, unknown> = { type: 'note', title: n.title, to: str(n.to) || WHOLE_TEAM, status: 'open', created: ymd(now) };
  return Frontmatter.join(data, '\n' + n.body.trim() + '\n');
}

/** A free file name in the folder: "Title.md", or "Title 2.md" and so on when that is taken. */
export function freePath(folder: string, title: string, taken: string[]): string {
  const has = new Set(taken.map((p) => p.toLowerCase()));
  for (let i = 1; ; i++) {
    const p = folder + '/' + title + (i === 1 ? '' : ' ' + i) + '.md';
    if (!has.has(p.toLowerCase())) return p;
  }
}

/** Write a new Note to the Team into the book's folder as Kyle's commit (no Agent trailer). */
export async function createNote(source: VaultSource, bookFolder: string, n: NewNote, now: Date): Promise<NoteRecord> {
  if (!source.write) throw new Error('This vault cannot be changed from the app.');
  const body = n.body.trim();
  if (!body) throw new Error('Write the instruction first.');
  const title = noteTitle(n.title, body);
  if (!title) throw new Error('Give the note a few words of title.');
  for (let attempt = 0; ; attempt++) {
    const { files } = await source.tree();
    const path = freePath(bookFolder + '/' + NOTES_FOLDER, title, files.map((f) => f.path));
    const text = noteText({ title, to: n.to, body }, now);
    try {
      const sha = await source.write(path, text, '', 'notes: add ' + title + '\n\nA Note to the Team, written in the Story Forge app.');
      return makeNote(path, sha, text);
    } catch (e) {
      if ((e as { conflict?: boolean }).conflict && attempt < 3) continue;
      throw e;
    }
  }
}
