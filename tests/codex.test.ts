import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appearances, codexFor, matcher, mentions, namedIn, termsOf } from '../src/lib/codex.ts';
import { findAll, markList, styledHtml, textOf, unstyle } from '../src/lib/styled.ts';
import { buildIndex } from '../src/lib/vault-index.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { DEMO, FsSource } from './helpers.ts';
import fs from 'node:fs';
import path from 'node:path';

async function demo() {
  const src = new FsSource(DEMO);
  const schema = parseSchema(fs.readFileSync(path.join(DEMO, 'System/schema.json'), 'utf8'));
  const { files } = await src.tree();
  return buildIndex({ schema, files, read: (p) => src.read(p), phase: 6 });
}

test('the codex has the cast, places, items and lore, with first names', async () => {
  const index = await demo();
  const book = index.books[0];
  const c = codexFor(index, book);
  const names = c.map((e) => e.name);
  assert.ok(names.includes('Mara Quill'));
  assert.ok(names.includes('Cinder Ford'));
  assert.ok(names.includes('Ash Bell'));
  assert.ok(c.find((e) => e.name === 'Mara Quill')!.terms.includes('Mara'));
  const m = matcher(c);
  const scene = index.notes[book.scenes[0]];
  assert.ok(namedIn(scene.body, m).some((x) => x.entry.name === 'Mara Quill'));
  const mara = c.find((e) => e.name === 'Mara Quill')!;
  assert.ok(appearances(book.scenes.map((p) => index.notes[p]), mara, m).length >= 1);
});

test('names match whole words with their case', () => {
  const m = matcher([{ name: 'Grey Merrifield', type: 'character', note: null as never, terms: ['Grey Merrifield', 'Grey'], color: 'red' }]);
  assert.deepEqual(mentions('Grey met Grey Merrifield. greyish Greyson', m).map((x) => [x.from, x.to]), [[0, 4], [9, 24]]);
});

test('styled text keeps every character with names, marks and find', () => {
  const m = matcher([{ name: 'Mara', type: 'character', note: null as never, terms: ['Mara'], color: 'hsl(1 50% 50%)' }]);
  const t = 'Mara said *quiet* and ==come back== **to Mara** now.\n> note';
  const h = styledHtml(t, { names: m, find: 'come' });
  assert.equal(textOf(h), t);
  assert.ok(h.includes('md-name'));
  assert.ok(h.includes('md-hl'));
  assert.ok(h.includes('md-find'));
});

test('Normal takes away the marks the selection touches', () => {
  assert.deepEqual(unstyle('a *bc* d', 4, 4), { text: 'a bc d', start: 3, end: 3 });
  assert.equal(unstyle('a **b *c* d** e', 2, 13).text, 'a b c d e');
  assert.equal(unstyle('x ==mark== y', 5, 5).text, 'x mark y');
  assert.equal(unstyle('plain', 1, 3).text, 'plain');
});

test('find and the list of marks', () => {
  assert.deepEqual(findAll('Aa aA', 'a'), [0, 1, 3, 4]);
  assert.deepEqual(markList('one ==two==\n==three=='), [{ at: 4, text: 'two' }, { at: 12, text: 'three' }]);
});

test('everyday words never light up as names', () => {
  // Kyle, 2026-10-18: "the" lit up as the Demon Lord, whose name starts with a small "the".
  assert.deepEqual(termsOf('the Demon Lord', { aliases: ['Demon Lord', 'the former Demon Lord'] }, true), ['the Demon Lord', 'Demon Lord', 'the former Demon Lord']);
  assert.deepEqual(termsOf('The Warden', {}, true), ['The Warden']);
  assert.deepEqual(termsOf('Grey Merrifield', { aliases: ['Grey', 'healer', 'The', 'Him'] }, true), ['Grey Merrifield', 'Grey']);
  assert.deepEqual(termsOf('Mara Quill', {}, true), ['Mara Quill', 'Mara']);
});
