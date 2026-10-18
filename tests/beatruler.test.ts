import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildIndex } from '../src/lib/vault-index.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { beatDefFor, beatRuler, placeLabel, SAVE_THE_CAT, verdictFor } from '../src/lib/beatruler.ts';
import type { NoteRecord } from '../src/lib/types.ts';
import { DEMO, FsSource } from './helpers.ts';

async function demo() {
  const src = new FsSource(DEMO);
  const schema = parseSchema(fs.readFileSync(path.join(DEMO, 'System/schema.json'), 'utf8'));
  const { files } = await src.tree();
  return buildIndex({ schema, files, read: (p) => src.read(p), phase: 6 });
}

const beat = (data: Record<string, unknown>): NoteRecord => ({ path: 'B.md', sha: '', type: 'beat', data: { type: 'beat', ...data }, body: '', error: null });

test('the fifteen beats in Save the Cat order, with their places', () => {
  assert.equal(SAVE_THE_CAT.length, 15);
  assert.equal(placeLabel(SAVE_THE_CAT.find((d) => d.id === 'catalyst')!), '10%');
  assert.equal(placeLabel(SAVE_THE_CAT.find((d) => d.id === 'fun-and-games')!), '20–50%');
});

test('a beat note is matched by its position, else its title', () => {
  assert.equal(beatDefFor(beat({ position: 'save-the-cat catalyst', title: 'Grey loses' }))!.id, 'catalyst');
  assert.equal(beatDefFor(beat({ position: 'save-the-cat break-into-two' }))!.id, 'break-into-two');
  assert.equal(beatDefFor(beat({ position: 'save-the-cat dark-night' }))!.id, 'dark-night');
  assert.equal(beatDefFor(beat({ position: '10%', title: 'Catalyst' }))!.id, 'catalyst');
  assert.equal(beatDefFor(beat({ position: '1%', title: 'Opening image' }))!.id, 'opening-image');
  assert.equal(beatDefFor(beat({ title: 'Dark Night of the Soul' }))!.id, 'dark-night');
  assert.equal(beatDefFor(beat({ position: 'act-1 inciting event', title: 'The bell must ring' })), null);
});

test('early, on time and late, with three points of give', () => {
  const cat = SAVE_THE_CAT.find((d) => d.id === 'catalyst')!;
  assert.equal(verdictFor(cat, { from: 2, to: 6 }), 'early');
  assert.equal(verdictFor(cat, { from: 5, to: 8 }), 'on-time');
  assert.equal(verdictFor(cat, { from: 12, to: 15 }), 'on-time');
  assert.equal(verdictFor(cat, { from: 14, to: 18 }), 'late');
  assert.equal(verdictFor(cat, null), 'no-scenes');
});

test('the demo book: beats found by the scene\'s beat link and by the beat\'s scenes list', async () => {
  const index = await demo();
  const r = beatRuler(index, index.books[0]);
  const by = Object.fromEntries(r.map((b) => [b.def.id, b]));
  assert.deepEqual(Object.keys(by).sort(), ['all-is-lost', 'catalyst', 'finale', 'midpoint', 'opening-image']);
  assert.deepEqual(by.midpoint.scenes, ['S-004']);
  assert.equal(by.midpoint.verdict, 'on-time');
  assert.equal(by['opening-image'].verdict, 'on-time');
  // Seven story scenes of even weight: S-003 sits at 29-43%, far after the 10% catalyst.
  assert.equal(by.catalyst.verdict, 'late');
  assert.equal(by['all-is-lost'].verdict, 'on-time');
  assert.equal(by.finale.verdict, 'on-time');
});
