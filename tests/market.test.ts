import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_BYTES, rocketFile, rocketFiles, rocketName, rocketProblem } from '../src/lib/market.ts';
import type { FileEntry } from '../src/lib/types.ts';
import { filesAction } from '../src/vault/ops.ts';
import { pushAction } from '../src/vault/push.ts';
import { MemSource } from './helpers.ts';

const SERIES = 'Series/Quest Declined';

test('Rocket files are listed by name from the series Market folder only', () => {
  const files: FileEntry[] = [
    { path: SERIES + '/Market/Rocket Exports/Competition - healer litrpg.csv', sha: 'a' },
    { path: SERIES + '/Market/Rocket Exports/Old/Nested.csv', sha: 'b' },
    { path: SERIES + '/Market/Healer Unranked.md', sha: 'c' },
    { path: 'Series/Other/Market/Rocket Exports/x.csv', sha: 'd' }
  ];
  assert.deepEqual(rocketFiles(files, SERIES), ['Competition - healer litrpg.csv']);
});

test('a Rocket file never replaces an earlier one and keeps a safe name', () => {
  assert.equal(rocketName('Keyword Search - retired healer.csv', []), 'Keyword Search - retired healer.csv');
  assert.equal(rocketName('a.CSV', ['a.csv', 'a (2).csv']), 'a (3).csv');
  assert.equal(rocketName('x/y:z.csv', []), 'x y z.csv');
});

test('only CSV files of a sendable size are added, with a plain sentence otherwise', () => {
  assert.equal(rocketProblem('a.csv', 10), null);
  assert.match(rocketProblem('a.xlsx', 10)!, /not a CSV file/);
  assert.match(rocketProblem('a.csv', 0)!, /empty/);
  assert.match(rocketProblem('a.csv', MAX_BYTES + 1)!, /too big/);
});

test('adding a Rocket file commits it as Kyle\'s, and takes the next name when one appeared since the last sync', async () => {
  const src = new MemSource();
  src.files.set(SERIES + '/Market/Rocket Exports/e.csv', 'Taken since the last sync.\n');
  const f = rocketFile(SERIES, 'e.csv', '\uFEFFTitle,Author\n');
  const res = await pushAction(src, filesAction([f]));
  const path = SERIES + '/Market/Rocket Exports/e (2).csv';
  assert.equal(res.renames[f.path], path);
  assert.equal(src.files.get(path), 'Title,Author\n');
  assert.equal(src.files.get(f.path), 'Taken since the last sync.\n');
  assert.match(src.commits[0].message, /^market: add Rocket file e \(2\)\.csv/);
  assert.doesNotMatch(src.commits[0].message, /Agent:/);
});
