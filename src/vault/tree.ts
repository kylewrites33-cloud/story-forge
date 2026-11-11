// The vault as one save sees it: the files as they are when the save starts, with the save's own changes on top.
// Every op of the save reads and writes here, in order, so a later op sees what an earlier one did (a note it added,
// a file it renamed). What comes out is the one list of files to write and to remove.
import { makeNote } from '../lib/vault-index.ts';
import type { CommitPlan, FileEntry, Head, NoteRecord } from '../lib/types.ts';

/** How many notes are read at once. */
const READS = 6;

export class Tree {
  /** Files this save has read or changed: their text now, or null for one it removes. */
  private now = new Map<string, string | null>();
  /** Files as the vault had them when they were read. */
  private was = new Map<string, { text: string; sha: string }>();
  /** Paths the vault does not have. */
  private absent = new Set<string>();
  /** Files that are not text (a picture, a Word file), as base64. They are written whole and never read back. */
  private bytes = new Map<string, string>();
  private list: FileEntry[] | null = null;
  private head: Head;

  constructor(head: Head) { this.head = head; }

  /** A file's text as this save has it; null when it is not there. */
  async read(path: string): Promise<string | null> {
    if (this.now.has(path)) return this.now.get(path)!;
    if (this.absent.has(path)) return null;
    const cur = await this.head.read(path);
    // Another read or a write of the same path may have finished while this one was out.
    if (this.now.has(path)) return this.now.get(path)!;
    if (!cur) { this.absent.add(path); return null; }
    this.was.set(path, cur);
    this.now.set(path, cur.text);
    return cur.text;
  }

  /** Read several files, a few at a time. */
  async readMany(paths: string[]): Promise<void> {
    const todo = paths.filter((p, i) => paths.indexOf(p) === i && !this.now.has(p) && !this.absent.has(p));
    for (let i = 0; i < todo.length; i += READS) await Promise.all(todo.slice(i, i + READS).map((p) => this.read(p)));
  }

  write(path: string, text: string): void { this.bytes.delete(path); this.now.set(path, text); }

  /** A file that is not text, added or replaced whole. */
  writeBytes(path: string, base64: string): void { this.now.delete(path); this.bytes.set(path, base64); }

  /** Take a file out. Only a file this save has read can go: its words must have been seen first. */
  remove(path: string): void { if (this.now.has(path)) this.now.set(path, null); }

  /** Has this save changed, added or removed this file? */
  touched(path: string): boolean {
    if (!this.now.has(path)) return false;
    const w = this.was.get(path);
    return !w || this.now.get(path) !== w.text;
  }

  /** Every file as this save has them: the vault's, less the ones removed, plus the ones added. A file this save has
   * changed or added has no sha yet. */
  async files(): Promise<FileEntry[]> {
    if (!this.list) this.list = await this.head.files();
    const out: FileEntry[] = [];
    const seen = new Set<string>();
    this.list.forEach((f) => {
      seen.add(f.path);
      if (this.now.has(f.path) && this.now.get(f.path) === null) return;
      out.push(this.touched(f.path) || this.bytes.has(f.path) ? { path: f.path, sha: '' } : f);
    });
    this.now.forEach((text, path) => { if (text !== null && !seen.has(path)) out.push({ path, sha: '' }); });
    this.bytes.forEach((_b, path) => { if (!seen.has(path)) out.push({ path, sha: '' }); });
    return out;
  }

  /** What the save writes and removes: only files that differ from the vault's. */
  changes(): Pick<CommitPlan, 'writes' | 'removes' | 'blobs'> {
    const writes: { path: string; text: string }[] = [];
    const removes: string[] = [];
    this.now.forEach((text, path) => {
      if (text === null) { if (this.was.has(path)) removes.push(path); }
      else if (this.touched(path)) writes.push({ path, text });
    });
    const blobs: { path: string; base64: string }[] = [];
    this.bytes.forEach((base64, path) => blobs.push({ path, base64 }));
    return { writes, removes, blobs };
  }

  /** The text files this save read or wrote that pass `keep`, as the vault has them once it lands: for the files
   * the app holds as text and not as notes (the team's). */
  texts(shas: Record<string, string>, keep: (path: string) => boolean): Record<string, { sha: string; text: string }> {
    const out: Record<string, { sha: string; text: string }> = {};
    this.now.forEach((text, path) => {
      if (text === null || !keep(path)) return;
      const w = this.was.get(path);
      out[path] = { sha: shas[path] || (w ? w.sha : ''), text };
    });
    return out;
  }

  /** The notes this save read or wrote, as the vault has them once it lands (`shas`: the new sha of each file written). */
  saved(shas: Record<string, string>): NoteRecord[] {
    const out: NoteRecord[] = [];
    this.now.forEach((text, path) => {
      if (text === null) return;
      const w = this.was.get(path);
      out.push(makeNote(path, shas[path] || (w ? w.sha : ''), text));
    });
    return out;
  }

  /** The files this save took out of the vault. */
  removed(): string[] {
    return this.changes().removes || [];
  }
}
