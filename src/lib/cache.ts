// The offline copy: one snapshot per source (the demo vault, or one repository and branch) in IndexedDB.
import { openDB, type IDBPDatabase } from 'idb';
import type { Snapshot } from './types.ts';

const DB = 'story-forge';
const STORE = 'snapshots';
const PICTURES = 'pictures';

let dbp: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB, 2, {
      upgrade(d, from) {
        if (from < 1) d.createObjectStore(STORE, { keyPath: 'key' });
        if (from < 2) d.createObjectStore(PICTURES);
      }
    });
  }
  return dbp;
}

export async function readSnapshot(key: string): Promise<Snapshot | null> {
  try {
    return ((await (await db()).get(STORE, key)) as Snapshot | undefined) || null;
  } catch {
    // Private browsing or storage turned off: the app still works, it just cannot work offline.
    return null;
  }
}

export async function writeSnapshot(s: Snapshot): Promise<boolean> {
  try {
    await (await db()).put(STORE, s);
    return true;
  } catch {
    return false;
  }
}

/** Forget every saved copy, for "Forget token" in Settings. */
export async function clearSnapshots(): Promise<void> {
  try {
    await (await db()).clear(STORE);
  } catch {
    /* nothing saved, nothing to clear */
  }
}

/** A picture (a book cover) by its blob sha, so it is downloaded once and shows offline. */
export async function readPicture(sha: string): Promise<Blob | null> {
  try {
    return ((await (await db()).get(PICTURES, sha)) as Blob | undefined) || null;
  } catch {
    return null;
  }
}

export async function writePicture(sha: string, blob: Blob): Promise<void> {
  try {
    await (await db()).put(PICTURES, blob, sha);
  } catch {
    /* it is fetched again next time */
  }
}
