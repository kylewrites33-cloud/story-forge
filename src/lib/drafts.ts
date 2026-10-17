// Writing in the app: a scene's prose as Kyle is typing it. Every change is kept on this device at once (localStorage),
// so nothing is lost offline or if the browser closes, and goes to the vault as one commit with Kyle's token, so it counts
// as his. Only the body and the computed word count change; every property line stays as it was.
// When the scene changed somewhere else since Kyle opened it (Obsidian, an agent), Kyle's version wins and the other
// version is saved first as a snapshot, the way the vault's clash rule says.
import { Frontmatter } from './frontmatter.js';
import { Prose, wordCount } from './prose.js';
import { makeNote } from './vault-index.ts';
import type { NoteRecord, VaultSource } from './types.ts';

export interface Draft {
  path: string;
  /** The blob sha and body the draft started from. A save that finds a different body on GitHub is a clash. */
  baseSha: string;
  baseBody: string;
  /** The body as Kyle has it now. */
  body: string;
  /** A word target Kyle set in the editor, saved with the next save; null leaves the note's target alone. */
  target: number | null;
  /** Words when this sitting started, for "+312 this sitting". */
  startWords: number;
  updatedAt: string;
  /** Kyle pressed Done (or the app was closed) while offline: save it when the connection is back. */
  pending: boolean;
  /** The last plain-sentence failure, if saving failed for a reason other than being offline. */
  error?: string;
}

const KEY = 'story-forge.drafts.';

type Store = Storage | null;
const defaultStore = (): Store => globalThis.localStorage ?? null;

export function loadDrafts(sourceKey: string, storage: Store = defaultStore()): Record<string, Draft> {
  try {
    const raw = storage && storage.getItem(KEY + sourceKey);
    const all = raw ? JSON.parse(raw) : {};
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

/** Keep one draft (or forget it, with null). Returns false when the device would not store it. */
export function putDraft(sourceKey: string, path: string, d: Draft | null, storage: Store = defaultStore()): boolean {
  try {
    if (!storage) return false;
    const all = loadDrafts(sourceKey, storage);
    if (d) all[path] = d;
    else delete all[path];
    if (Object.keys(all).length) storage.setItem(KEY + sourceKey, JSON.stringify(all));
    else storage.removeItem(KEY + sourceKey);
    return true;
  } catch {
    return false;
  }
}

/** Words in a body, as `sf words` counts them: reading text only (no callouts, comments or headings). */
export function bodyWords(body: string): number {
  return wordCount(Prose.proseText(body));
}

/** What `sf words` writes on a scene: nothing counts while it is planned. */
export function sceneWords(status: unknown, body: string): number {
  return status === 'planned' ? 0 : bodyWords(body);
}

/** The editor shows the body without the blank line that follows the properties; this puts it back. */
export function splitLead(body: string): { lead: string; text: string } {
  const m = /^(\r?\n)+/.exec(body);
  const lead = m ? m[0] : '';
  return { lead, text: body.slice(lead.length) };
}

/** Start editing a note, or carry on with the draft already on this device. A draft with no unsaved words is
 * dropped when the note has changed since, so Kyle always starts from the newest version. */
export function openDraft(note: NoteRecord, existing: Draft | undefined, now: Date): Draft {
  const fresh = (): Draft => ({
    path: note.path, baseSha: note.sha, baseBody: note.body, body: note.body, target: null,
    startWords: bodyWords(note.body), updatedAt: now.toISOString(), pending: false
  });
  if (!existing) return fresh();
  const unsaved = existing.body !== existing.baseBody || existing.target != null;
  if (!unsaved && existing.baseSha !== note.sha) return fresh();
  return existing;
}

export function isUnsaved(d: Draft): boolean {
  return d.body !== d.baseBody || d.target != null;
}

/** The note's text with a new body. The property block is kept byte for byte, apart from the lines named in `set`. */
export function withBody(text: string, body: string, set: Record<string, unknown> = {}): string {
  const p = Frontmatter.parse(text);
  if (p.error) throw new Error('This scene\'s properties cannot be read (' + p.error + '). Fix it in Obsidian, then try again.');
  const s = Frontmatter.split(text);
  let out = s.hasFm ? s.open + (s.yaml || '') + s.close + body : body;
  Object.keys(set).forEach((k) => { out = Frontmatter.setScalar(out, k, set[k]); });
  return out;
}

/** A local time to the minute, the way sf stamps snapshots: 2026-10-17T21:40. */
export function nowStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/** Characters that break file names, as sf's safeFileName removes them. */
function safeName(s: string): string {
  return String(s || 'Untitled').replace(/[\\/:*?"<>|#^[\]()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90).trim() || 'Untitled';
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(0, i) : '';
}

function stemOf(path: string, data: Record<string, unknown>): string {
  if (typeof data.id === 'string' && data.id) return data.id;
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '');
}

/** The Snapshots folder for a note: its book's (or series') folder, as sf snapshot uses. */
export function snapshotFolder(path: string): string {
  const m = /^(Series\/[^/]+\/Books\/[^/]+)\//.exec(path) || /^(Series\/[^/]+)\//.exec(path);
  return (m ? m[1] : dirOf(dirOf(path))) + '/Snapshots';
}

export interface SnapshotEntry {
  path: string;
  sha: string;
  version: number;
  label: string;
}

/** The snapshots of one note that the vault has, newest first, from a fresh file list. */
export async function listSnapshots(source: VaultSource, note: NoteRecord): Promise<SnapshotEntry[]> {
  const dir = snapshotFolder(note.path) + '/';
  const stem = stemOf(note.path, note.data) + ' v';
  const { files } = await source.tree();
  return files
    .filter((f) => f.path.startsWith(dir) && f.path.indexOf('/', dir.length) < 0 && f.path.slice(dir.length).startsWith(stem))
    .map((f) => {
      const m = /^ v(\d+)(?: \((.*)\))?\.md$/.exec(f.path.slice(dir.length + stem.length - 2));
      return { path: f.path, sha: f.sha, version: m ? Number(m[1]) : 0, label: m && m[2] ? m[2] : '' };
    })
    .sort((a, b) => b.version - a.version);
}

/** Save a body as the note's next snapshot, in sf snapshot's format. Returns the new file's path. */
export async function saveSnapshot(source: VaultSource, note: { path: string; data: Record<string, unknown> }, body: string, label: string, now: Date): Promise<string> {
  if (!source.write) throw new Error('This vault cannot be changed from the app.');
  const clean = safeName(label) || 'copy';
  const stem = stemOf(note.path, note.data);
  for (let attempt = 0; ; attempt++) {
    const have = await listSnapshots(source, { path: note.path, sha: '', type: '', data: note.data, body: '', error: null });
    const version = have.reduce((mx, s) => Math.max(mx, s.version), 0) + 1;
    const dest = snapshotFolder(note.path) + '/' + stem + ' v' + version + ' (' + clean + ').md';
    const text = Frontmatter.join({ type: 'snapshot', of: note.path, version, label: clean, taken: nowStamp(now), words: bodyWords(body) }, body);
    try {
      await source.write(dest, text, '', 'snapshot: ' + stem + ' v' + version + ' (' + clean + ')\n\nSaved in the Story Forge app.');
      return dest;
    } catch (e) {
      // Another copy took that number a moment ago: count again once.
      if ((e as { conflict?: boolean }).conflict && attempt === 0) continue;
      throw e;
    }
  }
}

export interface SaveResult {
  note: NoteRecord;
  /** Where the other version went, when the scene had changed elsewhere. */
  clash: string | null;
}

/** Save a draft to the vault: re-read the scene, keep any other version as a snapshot, write Kyle's body. */
export async function saveDraft(source: VaultSource, d: Draft, now: Date): Promise<SaveResult> {
  if (!source.readFresh || !source.write) throw new Error('This vault cannot be changed from the app.');
  let clash: string | null = null;
  for (let attempt = 0; ; attempt++) {
    const { text, sha } = await source.readFresh(d.path);
    const cur = makeNote(d.path, sha, text);
    if (cur.error) throw new Error('This scene\'s properties cannot be read (' + cur.error + '). Fix it in Obsidian, then try again.');
    if (!clash && cur.body !== d.baseBody && cur.body !== d.body) {
      clash = await saveSnapshot(source, cur, cur.body, 'changed elsewhere', now);
    }
    const set: Record<string, unknown> = {};
    if (cur.type === 'scene') {
      const w = sceneWords(cur.data.status, d.body);
      if (cur.data.words !== w) set.words = w;
    }
    if (d.target != null && cur.data.target_words !== d.target) set.target_words = d.target;
    const next = withBody(text, d.body, set);
    if (next === text) return { note: cur, clash };
    const name = [cur.data.id, cur.data.title].filter(Boolean).join(' ') || d.path;
    try {
      const newSha = await source.write(d.path, next, sha, 'scenes: edit ' + name + '\n\nWritten in the Story Forge app.');
      return { note: makeNote(d.path, newSha, next), clash };
    } catch (e) {
      if ((e as { conflict?: boolean }).conflict && attempt === 0) continue;
      throw e;
    }
  }
}

export interface DraftFlush {
  saved: NoteRecord[];
  /** A plain sentence when something did not save. */
  error: string | null;
}

/** Save every draft Kyle finished while offline. A draft that saves is forgotten; one that fails stays, with its error. */
export async function flushDrafts(source: VaultSource, sourceKey: string, now: Date, storage: Store = defaultStore()): Promise<DraftFlush> {
  const saved: NoteRecord[] = [];
  let error: string | null = null;
  for (const d of Object.values(loadDrafts(sourceKey, storage)).filter((x) => x.pending)) {
    try {
      const r = await saveDraft(source, d, now);
      saved.push(r.note);
      // Kyle may have opened it again since: forget it only if it still holds what was sent.
      const still = loadDrafts(sourceKey, storage)[d.path];
      if (still && still.body === d.body && still.pending) putDraft(sourceKey, d.path, null, storage);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 0) return { saved, error: null };
      error = 'Your writing in ' + d.path.slice(d.path.lastIndexOf('/') + 1).replace(/\.md$/, '') + ' did not save: ' + err.message;
      putDraft(sourceKey, d.path, { ...d, error: err.message }, storage);
    }
  }
  return { saved, error };
}

/** How many finished drafts wait for a connection. */
export function pendingCount(sourceKey: string, storage: Store = defaultStore()): number {
  return Object.values(loadDrafts(sourceKey, storage)).filter((d) => d.pending).length;
}
