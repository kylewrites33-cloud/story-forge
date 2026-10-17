// Kyle's choices on the Ideas board wait here until GitHub has them, so a choice made offline is not lost.
// The queue lives in this browser's localStorage, one list per source; a newer choice on the same idea replaces the older one.
import { applyToData, applyToText, changeFor, commitMessage, editChange, moveChange, type Change, type Decision, type Move } from './ideas.ts';
import { Frontmatter } from './frontmatter.js';
import { makeNote, resortScenes } from './vault-index.ts';
import type { NoteRecord, VaultIndex, VaultSource } from './types.ts';

export interface Choice {
  path: string;
  decision: Decision;
  reason: string;
  /** When Kyle chose, as an ISO time; it becomes the idea's decided time. */
  at: string;
  /** The last plain-sentence failure, if saving it failed for a reason other than being offline. */
  error?: string;
  /** For a scene card dragged on the Chapter Grid: where it went. */
  move?: Move;
  /** For a card Kyle edited: the properties he changed. */
  fields?: Record<string, string>;
}

/** What a waiting choice does to a note with these properties. */
export function changeOf(data: Record<string, unknown>, c: Choice): Change {
  if (c.decision === 'move' && c.move) return moveChange(c.move);
  if (c.decision === 'edit') return editChange(c.fields || {});
  return changeFor(data, c.decision, new Date(c.at), c.reason);
}

const KEY = 'story-forge.queue.';

export function loadQueue(sourceKey: string, storage: Storage | null = globalThis.localStorage ?? null): Choice[] {
  try {
    const raw = storage && storage.getItem(KEY + sourceKey);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((c) => c && typeof c.path === 'string' && typeof c.decision === 'string') : [];
  } catch {
    return [];
  }
}

export function saveQueue(sourceKey: string, list: Choice[], storage: Storage | null = globalThis.localStorage ?? null): void {
  try {
    if (!storage) return;
    if (list.length) storage.setItem(KEY + sourceKey, JSON.stringify(list));
    else storage.removeItem(KEY + sourceKey);
  } catch {
    /* storage full or turned off: the choice still saves now if the connection holds */
  }
}

/** Moves, edits and decisions (accept, keep) each have their own slot on a note; a newer choice replaces an older one in its slot. */
function slot(c: Choice): string {
  return c.decision === 'move' || c.decision === 'edit' ? c.decision : 'decide';
}

export function sameSlot(a: Choice, b: Choice): boolean {
  return a.path === b.path && slot(a) === slot(b);
}

/** Add a choice. A second edit to a note that has not saved yet joins the first, so neither is lost. */
export function enqueue(list: Choice[], c: Choice): Choice[] {
  const prev = c.decision === 'edit' ? list.find((x) => sameSlot(x, c)) : null;
  const next = prev ? { ...c, fields: { ...(prev.fields || {}), ...(c.fields || {}) } } : c;
  return list.filter((x) => !sameSlot(x, c)).concat(next);
}

/** The index as Kyle should see it: every waiting choice already applied to its idea's properties. */
export function overlay(index: VaultIndex, list: Choice[]): VaultIndex {
  if (!list.length) return index;
  const notes = { ...index.notes };
  list.forEach((c) => {
    const n = notes[c.path];
    if (!n) return;
    notes[c.path] = { ...n, data: applyToData(n.data, changeOf(n.data, c)) };
  });
  const out = { ...index, notes };
  return list.some((c) => c.decision === 'move') ? resortScenes(out) : out;
}

/** Save one choice: read the note as GitHub has it now, change only the lines the choice touches, and write it back. */
export async function saveChoice(source: VaultSource, c: Choice): Promise<NoteRecord> {
  if (!source.readFresh || !source.write) throw new Error('This vault cannot be changed from the app.');
  for (let attempt = 0; ; attempt++) {
    const { text, sha } = await source.readFresh(c.path);
    const data = Frontmatter.parse(text).data || {};
    const next = applyToText(text, changeOf(data, c));
    if (next === text) return makeNote(c.path, sha, text);
    try {
      const newSha = await source.write(c.path, next, sha, commitMessage(data, c.decision, c.fields));
      return makeNote(c.path, newSha, next);
    } catch (e) {
      // Someone (Obsidian, an agent) changed the note between our read and our write: read it again and redo the edit once.
      if ((e as { conflict?: boolean }).conflict && attempt === 0) continue;
      throw e;
    }
  }
}

export interface FlushResult {
  saved: NoteRecord[];
  left: Choice[];
  /** A plain sentence when something did not save. */
  error: string | null;
}

/** Save every waiting choice in order. Stops at the first connection failure and keeps the rest for next time. */
export async function flush(source: VaultSource, list: Choice[]): Promise<FlushResult> {
  const saved: NoteRecord[] = [];
  const left: Choice[] = [];
  let error: string | null = null;
  let offline = false;
  for (const c of list) {
    if (offline) { left.push(c); continue; }
    try {
      saved.push(await saveChoice(source, c));
    } catch (e) {
      const err = e as Error & { status?: number };
      error = err.message;
      if (err.status === 0) offline = true;
      // A note that is gone (moved or renamed in Obsidian) cannot take the choice; let it go rather than retry forever.
      if (err.status !== 404) left.push(offline ? c : { ...c, error: err.message });
    }
  }
  return { saved, left, error };
}
