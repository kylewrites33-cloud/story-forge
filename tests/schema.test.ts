import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardFields, defaultBoard, enumValues, indexedTypes, parseSchema, propDef, propertyOrder } from '../src/lib/schema.ts';
import { sync } from '../src/lib/sync.ts';
import { DEMO, demoSchemaText, FsSource } from './helpers.ts';

test('loads the demo vault schema', () => {
  const s = parseSchema(demoSchemaText());
  assert.equal(s.version, 1);
  assert.deepEqual(cardFields(s, 'scene'), ['title', 'headline', 'subtitle', 'labels', 'pov', 'turn', 'hook', 'status', 'words']);
  assert.deepEqual(enumValues(s, propDef(s, 'scene', 'status')), ['planned', 'drafted', 'revised', 'final']);
  assert.deepEqual(enumValues(s, propDef(s, 'scene', 'kind')), ['story', 'test']);
  assert.equal(defaultBoard(s, 'scene')?.board.title, 'Chapter Grid');
  assert.equal(propDef(s, 'scene', 'updated')?.computed, true, 'shared properties come from common');
});

test('indexes series, books and the types on phase 1 boards', () => {
  const s = parseSchema(demoSchemaText());
  assert.deepEqual(indexedTypes(s, 1), ['series', 'book', 'scene']);
  assert.ok(indexedTypes(s, 3).includes('character'));
});

test('orders a note\'s properties as the schema lists them, extras last', () => {
  const s = parseSchema(demoSchemaText());
  assert.deepEqual(propertyOrder(s, 'scene', { status: 'planned', mood: 'grim', title: 'A', id: 'S-001', type: 'scene' }), ['type', 'id', 'title', 'status', 'mood']);
});

test('says plainly what is wrong with a bad schema', () => {
  assert.throws(() => parseSchema('{ nope'), /System\/schema.json is not valid JSON/);
  assert.throws(() => parseSchema('[]'), /does not hold a schema object/);
  assert.throws(() => parseSchema('{"types": {}}'), /has no version number/);
  assert.throws(() => parseSchema('{"version": 1, "types": {"series": {}, "book": {}}}'), /has no "scene" type/);
});

test('sync reads the schema once and reuses it while its sha is unchanged', async () => {
  const src = new FsSource(DEMO);
  const first = await sync(src, null);
  assert.ok(src.reads.includes('System/schema.json'));
  assert.equal(first.key, src.key);
  src.reads.length = 0;
  const second = await sync(src, first);
  assert.deepEqual(src.reads, [], 'nothing changed, so nothing is read again');
  assert.equal(second.schemaText, first.schemaText);
});

test('sync fails with a plain sentence when the vault has no schema', async () => {
  const src = new FsSource(DEMO);
  src.tree = async () => ({ files: [], truncated: false });
  await assert.rejects(sync(src, null), /There is no System\/schema.json/);
});
