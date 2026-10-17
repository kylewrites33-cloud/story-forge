// One sync: read the tree, load the schema, rebuild the index, fetching only files that changed since last time.
import { parseSchema, SCHEMA_PATH } from './schema.ts';
import { buildIndex } from './vault-index.ts';
import type { Snapshot, VaultSource } from './types.ts';

export async function sync(source: VaultSource, previous: Snapshot | null, now: () => Date = () => new Date()): Promise<Snapshot> {
  const { files, truncated } = await source.tree();
  const schemaFile = files.find((f) => f.path === SCHEMA_PATH);
  if (!schemaFile) throw new Error('There is no ' + SCHEMA_PATH + ' in ' + source.label + '. Check the vault folder in Settings.');
  const reuse = previous && previous.schemaSha === schemaFile.sha;
  const schemaText = reuse ? previous.schemaText : await source.read(SCHEMA_PATH, schemaFile.sha);
  const schema = parseSchema(schemaText);
  const index = await buildIndex({ schema, files, read: (p, sha) => source.read(p, sha), previous: previous ? previous.index : null });
  if (truncated) index.warnings.unshift('The vault has more files than GitHub lists in one go, so some notes may be missing.');
  return { key: source.key, schemaSha: schemaFile.sha, schemaText, index, lastSync: now().toISOString() };
}
