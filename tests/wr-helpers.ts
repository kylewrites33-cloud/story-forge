// Shared by the Writers Room tests (Overview, next step, notes, sessions, recipes): the demo vault's index and small fakes.
import { parseSchema } from '../src/lib/schema.ts';
import { PHASE } from '../src/lib/sync.ts';
import { buildIndex, makeNote } from '../src/lib/vault-index.ts';
import type { VaultIndex } from '../src/lib/types.ts';
import { DEMO, demoSchemaText, FsSource } from './helpers.ts';

export const BOOK = 'Series/Ember Road/Books/1 Ash Bell';

export async function demoIndex() {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  const schema = parseSchema(demoSchemaText());
  const index = await buildIndex({ schema, files, read: (p, sha) => src.read(p, sha), phase: PHASE });
  const book = index.books.find((b) => b.folder === BOOK)!;
  return { schema, index, book, files };
}

/** The index with one note's text replaced (or added). */
export function withNote(index: VaultIndex, path: string, text: string): VaultIndex {
  return { ...index, notes: { ...index.notes, [path]: makeNote(path, 'x', text) } };
}

export class MemStorage {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}
