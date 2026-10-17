// Copies the FRONTMATTER section of the vault's sf.js into src/lib/frontmatter.js.
// Usage: node scripts/sync-parser.js [path to author-business]   (default ../author-business)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const vault = path.resolve(process.argv[2] || path.join(here, '..', '..', 'author-business'));
const sfPath = path.join(vault, 'System', 'Tools', 'sf.js');
const out = path.join(here, '..', 'src', 'lib', 'frontmatter.js');

export const HEADER = `// @ts-nocheck
/* The frontmatter parser, copied as is from author-business System/Tools/sf.js (the FRONTMATTER section), so the app
 * and the sf tool read notes the same way. Do not edit it here: change sf.js, then copy the block again with
 * \`npm run sync-parser\`. tests/frontmatter.test.ts checks the copy still matches when the vault is checked out beside
 * this repository. */
`;

// The block from "const Frontmatter = (() => {" to its closing "})();", without the first line.
export function extractBlock(sfText) {
  const lines = sfText.split('\n');
  const start = lines.indexOf('const Frontmatter = (() => {');
  if (start < 0) throw new Error('sf.js has no "const Frontmatter = (() => {" line.');
  const end = lines.findIndex((l, i) => i > start && l === '})();');
  if (end < 0) throw new Error('sf.js has no end to the Frontmatter section.');
  return lines.slice(start + 1, end + 1).join('\n');
}

export function render(sfText) {
  return HEADER + 'export const Frontmatter = (() => {\n' + extractBlock(sfText) + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!fs.existsSync(sfPath)) {
    console.error('Cannot find ' + sfPath + '. Give the path to author-business.');
    process.exit(1);
  }
  fs.writeFileSync(out, render(fs.readFileSync(sfPath, 'utf8')));
  console.log('Copied the frontmatter parser from ' + sfPath);
}
