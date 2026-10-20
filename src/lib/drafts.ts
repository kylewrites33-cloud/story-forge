// Writing in the app: a scene's prose as Kyle is typing it. Every change is kept on this device at once (localStorage),
// so nothing is lost offline or if the browser closes, and goes to the vault as one commit with Kyle's token, so it counts
// as his. Only the body and the computed word count change; every property line stays as it was.
// When the scene changed somewhere else since Kyle opened it (another device, an agent), the two are merged line by line,
// as the open page does: lines only the other side changed come in, lines Kyle changed stay his. Only where both changed
// the same lines does Kyle's version win, with the other version saved first as a snapshot, the way the vault's clash
// rule says (Kyle, 2026-10-20: words written offline must sync back without losing either side).
import { Frontmatter } from './frontmatter.js';
import { Prose, wordCount } from './prose.js';
import { makeNote } from './vault-index.ts';
import { merge3 } from './live.ts';
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
  /** A status Kyle chose in the editor (planned to drafted), saved with the next save. Missing or null leaves it. */
  status?: string | null;
  /** The scene was split or joined, so its one-line summary (`headline`) no longer fits: the next save clears it and
   * the team writes a new one. */
  freshHeadline?: boolean;
  /** Words when this sitting started, for "+312 this sitting". */
  startWords: number;
  updatedAt: string;
  /** Kyle pressed Done (or the app was closed) while offline: save it when the connection is back. */
  pending: boolean;
  /** The last plain-sentence failure, if saving failed for a reason other than being offline. */
  error?: string;
  /** For a note the vault does not have yet (a chapter's first beats): its property block, so the first save adds it. */
  create?: string;
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
  const unsaved = isUnsaved(existing);
  if (!unsaved && existing.baseSha !== note.sha) return fresh();
  return existing;
}

export function isUnsaved(d: Draft): boolean {
  return d.body !== d.baseBody || d.target != null || d.status != null || Boolean(d.freshHeadline);
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

/** The note's text without one single-line property (the team writes it again). */
export function withoutProperty(text: string, key: string): string {
  const s = Frontmatter.split(text);
  if (!s.hasFm || !s.yaml) return text;
  const lines = s.yaml.split(/\r?\n/);
  const eol = s.yaml.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const kept = lines.filter((l) => !new RegExp('^' + key + '[ \\t]*:').test(l));
  return kept.length === lines.length ? text : s.open + kept.join(eol) + s.close + s.body;
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
  /** Where the other version went, when the scene had changed elsewhere on the same lines Kyle changed. */
  clash: string | null;
  /** Lines from the other version came into the saved scene, so it holds more than the draft did. */
  merged: boolean;
}

/** Save a draft to the vault: re-read the scene, merge in what changed elsewhere, keep a clashing version as a
 * snapshot, write Kyle's body. */
export async function saveDraft(source: VaultSource, d: Draft, now: Date): Promise<SaveResult> {
  if (!source.readFresh || !source.write) throw new Error('This vault cannot be changed from the app.');
  let clash: string | null = null;
  if (d.create && !d.baseSha) {
    const text = d.create + d.body;
    const data = makeNote(d.path, '', text).data;
    try {
      const sha = await source.write(d.path, text, '', verbFor(String(data.type || ''), true) + (data.title || d.path) + '\n\nWritten in the Story Forge app.');
      return { note: makeNote(d.path, sha, text), clash, merged: false };
    } catch (e) {
      // Made somewhere else a moment ago: save over it the usual way, keeping the other version as a copy.
      if (!(e as { conflict?: boolean }).conflict) throw e;
    }
  }
  for (let attempt = 0; ; attempt++) {
    const { text, sha } = await source.readFresh(d.path);
    const cur = makeNote(d.path, sha, text);
    if (cur.error) throw new Error('This scene\'s properties cannot be read (' + cur.error + '). Fix it in Obsidian, then try again.');
    let body = d.body;
    if (cur.body !== d.baseBody && cur.body !== d.body) {
      const m = merge3(d.baseBody, d.body, cur.body);
      if (m.clash && !clash) clash = await saveSnapshot(source, cur, cur.body, 'changed elsewhere', now);
      body = m.text;
    }
    const merged = body !== d.body;
    const set: Record<string, unknown> = {};
    if (d.status && cur.data.status !== d.status) set.status = d.status;
    if (cur.type === 'scene') {
      const w = sceneWords(d.status || cur.data.status, body);
      if (cur.data.words !== w) set.words = w;
    }
    if (d.target != null && cur.data.target_words !== d.target) set.target_words = d.target;
    let next = withBody(text, body, set);
    if (d.freshHeadline) next = withoutProperty(next, 'headline');
    if (next === text) return { note: cur, clash, merged };
    const name = [cur.data.id, cur.data.title].filter(Boolean).join(' ') || d.path;
    try {
      const newSha = await source.write(d.path, next, sha, verbFor(cur.type, false) + name + '\n\nWritten in the Story Forge app.');
      return { note: makeNote(d.path, newSha, next), clash, merged };
    } catch (e) {
      if ((e as { conflict?: boolean }).conflict && attempt === 0) continue;
      throw e;
    }
  }
}

function verbFor(type: string, adding: boolean): string {
  if (type === 'chapter-beats') return adding ? 'beats: add ' : 'beats: edit ';
  if (type === 'chapter-plan') return adding ? 'plans: add ' : 'plans: edit ';
  return adding ? 'scenes: add ' : 'scenes: edit ';
}

export interface DraftFlush {
  saved: NoteRecord[];
  /** A plain sentence when something did not save. */
  error: string | null;
  /** A plain sentence when a scene that waited had also changed somewhere else, so Kyle knows what happened. */
  notice: string | null;
}

/** The scene's name for Kyle: its ID and title, or its file name. */
function nameOf(d: Draft, note?: NoteRecord): string {
  const n = note ? [note.data.id, note.data.title].filter(Boolean).join(' ') : '';
  return n || d.path.slice(d.path.lastIndexOf('/') + 1).replace(/\.md$/, '');
}

/** What Kyle is told when scenes that waited on the device met changes made elsewhere. */
export function mergeNotice(mergedIn: string[], clashed: string[]): string | null {
  const parts: string[] = [];
  if (mergedIn.length) parts.push(mergedIn.join(', ') + ' had also changed somewhere else. Both sets of changes are now in the scene.');
  if (clashed.length) parts.push(clashed.join(', ') + ' had the same lines changed in two places. Your lines are kept; the other version is in the scene\'s Copies, named "changed elsewhere".');
  return parts.length ? parts.join(' ') : null;
}

/** Save every draft Kyle finished while offline. A draft that saves is forgotten; one that fails stays, with its error. */
export async function flushDrafts(source: VaultSource, sourceKey: string, now: Date, storage: Store = defaultStore()): Promise<DraftFlush> {
  const saved: NoteRecord[] = [];
  let error: string | null = null;
  const mergedIn: string[] = [], clashed: string[] = [];
  for (const d of Object.values(loadDrafts(sourceKey, storage)).filter((x) => x.pending)) {
    try {
      const r = await saveDraft(source, d, now);
      saved.push(r.note);
      if (r.clash) clashed.push(nameOf(d, r.note));
      else if (r.merged) mergedIn.push(nameOf(d, r.note));
      // Kyle may have opened it again since: forget it only if it still holds what was sent.
      const still = loadDrafts(sourceKey, storage)[d.path];
      if (still && still.body === d.body && still.pending) putDraft(sourceKey, d.path, null, storage);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 0) return { saved, error: null, notice: mergeNotice(mergedIn, clashed) };
      error = 'Your writing in ' + d.path.slice(d.path.lastIndexOf('/') + 1).replace(/\.md$/, '') + ' did not save: ' + err.message;
      putDraft(sourceKey, d.path, { ...d, error: err.message }, storage);
    }
  }
  return { saved, error, notice: mergeNotice(mergedIn, clashed) };
}

const NOTICE = 'story-forge.sync-notice.';

/** The last merge notice Kyle has not closed yet. */
export function loadNotice(sourceKey: string, storage: Store = defaultStore()): string | null {
  try { return (storage && storage.getItem(NOTICE + sourceKey)) || null; } catch { return null; }
}

export function saveNotice(sourceKey: string, notice: string | null, storage: Store = defaultStore()): void {
  try {
    if (!storage) return;
    if (notice) storage.setItem(NOTICE + sourceKey, notice);
    else storage.removeItem(NOTICE + sourceKey);
  } catch { /* it shows until the page reloads */ }
}

/** How many finished drafts wait for a connection. */
export function pendingCount(sourceKey: string, storage: Store = defaultStore()): number {
  return Object.values(loadDrafts(sourceKey, storage)).filter((d) => d.pending).length;
}
