import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { propNum, propText } from '../src/lib/props.ts';
import { propNames, renderPropNames } from '../scripts/make-props.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'demo-vault', 'System', 'schema.json'), 'utf8'));

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sources(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

test('a property reads as text or as a number, and a missing one is empty or 0', () => {
  const n = { data: { id: 'S-004', title: 'The well', chapter: 7, words: '1200', rating: 'high', draft: 0, tags: null } as Record<string, unknown> };
  assert.equal(propText(n, 'id'), 'S-004');
  assert.equal(propText(n, 'chapter'), '7');
  assert.equal(propText(n, 'headline'), '');
  assert.equal(propText(n, 'draft'), '');
  assert.equal(propText(n, 'tags'), '');
  assert.equal(propNum(n, 'chapter'), 7);
  assert.equal(propNum(n, 'words'), 1200);
  assert.equal(propNum(n, 'rating'), 0);
  assert.equal(propNum(n, 'target_words'), 0);
});

test('the list of property names is the schema\'s', () => {
  const names = propNames(schema);
  for (const k of ['id', 'title', 'status', 'chapter', 'created', 'tags', 'kind']) assert.ok(names.includes(k), k);
  const copy = fs.readFileSync(path.join(root, 'src', 'lib', 'prop-names.ts'), 'utf8');
  assert.equal(copy, renderPropNames(schema), 'src/lib/prop-names.ts differs from the schema. Run npm run props.');
});

test('no file casts a note property to text by hand', () => {
  const byHand = /(?<![A-Za-z_$.])String\([A-Za-z_][A-Za-z_0-9.]*\.data\.[a-z_]+ \|\| ''\)/;
  const found = sources(path.join(root, 'src'))
    .filter((f) => byHand.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(root, f));
  assert.deepEqual(found, [], 'Use propText(note, \'name\') from src/lib/props.ts.');
});
