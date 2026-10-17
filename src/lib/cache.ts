// The offline copy: one snapshot per source (the demo vault, or one repository and branch) in IndexedDB.
import { openDB, type IDBPDatabase } from 'idb';
import type { Snapshot } from './types.ts';

const DB = 'story-forge';
const STORE = 'snapshots';

let dbp: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB, 1, {
      upgrade(d) {
        d.createObjectStore(STORE, { keyPath: 'key' });
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
