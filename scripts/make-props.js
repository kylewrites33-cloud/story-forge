// Writes src/lib/prop-names.ts: the name of every property a note can have, read from the schema
// (demo-vault/System/schema.json, the app's copy of the vault's). Run it after the schema copy is refreshed:
// npm run props. tests/props.test.ts fails when the list and the schema differ.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, '..', 'demo-vault', 'System', 'schema.json');
const out = path.join(here, '..', 'src', 'lib', 'prop-names.ts');

/** Every property name in a schema: the common ones and each type's, sorted. */
export function propNames(schema) {
  const names = new Set(Object.keys((schema.common && schema.common.properties) || {}));
  for (const t of Object.values(schema.types || {})) for (const k of Object.keys(t.properties || {})) names.add(k);
  return Array.from(names).sort();
}

/** The text of src/lib/prop-names.ts for a schema. */
export function renderPropNames(schema) {
  const names = propNames(schema);
  return '// The name of every property a note can have, from the vault schema. Do not edit: refresh\n'
    + '// demo-vault/System/schema.json, then run `npm run props`. tests/props.test.ts checks the two agree.\n'
    + 'export type Prop =\n' + names.map((n) => "  | '" + n + "'").join('\n') + ';\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(out, renderPropNames(JSON.parse(fs.readFileSync(schemaPath, 'utf8'))));
  console.log('Wrote ' + path.relative(process.cwd(), out) + '.');
}
