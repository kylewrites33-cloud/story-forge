// Kyle's choices on the Ideas board wait here until GitHub has them, so a choice made offline is not lost.
// The queue lives in this browser's localStorage, one list per source; a newer choice on the same idea replaces the older one.
import { applyToData, applyToText, changeFor, commitMessage, type Decision } from './ideas.ts';
import { Frontmatter } from './frontmatter.js';
import { makeNote } from './vault-index.ts';
import type { NoteRecord, VaultIndex, VaultSource } from './types.ts';

export interface Choice {
  path: string;
  decision: Decision;
  reason: string;
  /** When Kyle chose, as an ISO time; it becomes the idea's decided time. */
  at: string;
  /** The last plain-sentence failure, if saving it failed for a reason other than being offline. */
  error?: string;
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

export function enqueue(list: Choice[], c: Choice): Choice[] {
  return list.filter((x) => x.path !== c.path).concat(c);
}

/** The index as Kyle should see it: every waiting choice already applied to its idea's properties. */
export function overlay(index: VaultIndex, list: Choice[]): VaultIndex {
  if (!list.length) return index;
  const notes = { ...index.notes };
  list.forEach((c) => {
    const n = notes[c.path];
    if (!n) return;
    notes[c.path] = { ...n, data: applyToData(n.data, changeFor(n.data, c.decision, new Date(c.at), c.reason)) };
  });
  return { ...index, notes };
}

/** Save one choice: read the note as GitHub has it now, change only the lines the choice touches, and write it back. */
export async function saveChoice(source: VaultSource, c: Choice): Promise<NoteRecord> {
  if (!source.readFresh || !source.write) throw new Error('This vault cannot be changed from the app.');
  for (let attempt = 0; ; attempt++) {
    const { text, sha } = await source.readFresh(c.path);
    const data = Frontmatter.parse(text).data || {};
    const next = applyToText(text, changeFor(data, c.decision, new Date(c.at), c.reason));
    if (next === text) return makeNote(c.path, sha, text);
    try {
      const newSha = await source.write(c.path, next, sha, commitMessage(data, c.decision));
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
