import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addRocketFile, MAX_BYTES, rocketFiles, rocketName, rocketProblem } from '../src/lib/market.ts';
import type { FileEntry, VaultSource } from '../src/lib/types.ts';

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
  const writes: { path: string; text: string; message: string }[] = [];
  const source: VaultSource = {
    key: 't', label: 't',
    tree: async () => ({ files: [], truncated: false }),
    read: async () => '',
    write: async (path, text, sha, message) => {
      assert.equal(sha, '');
      if (path.endsWith('/e.csv')) throw Object.assign(new Error('taken'), { conflict: true });
      writes.push({ path, text, message });
      return 'sha';
    }
  };
  const path = await addRocketFile(source, SERIES, [], 'e.csv', '﻿Title,Author\n');
  assert.equal(path, SERIES + '/Market/Rocket Exports/e (2).csv');
  assert.equal(writes[0].text, 'Title,Author\n');
  assert.match(writes[0].message, /^market: add Rocket file e \(2\)\.csv/);
  assert.doesNotMatch(writes[0].message, /Agent:/);
});
