import { test } from 'node:test';
import assert from 'node:assert/strict';
import { label, listLines, longList } from '../src/lib/format.ts';

test('a list of timed sentences shows one per line; short names stay a comma run', () => {
  const abilities = ['B1 S-001: Inspect, Level 99.1, Max [Error]', 'B2 S-024: Terrakinesis: moves soil and stone by will'];
  assert.equal(longList(abilities), true);
  assert.equal(longList(['Grey', 'Poppy']), false);
  assert.deepEqual(listLines([{ 'B2 S-024': 'Terrakinesis' }, 'B1 S-001: Heal']), ['B2 S-024: Terrakinesis', 'B1 S-001: Heal']);
  assert.equal(label('open'), 'Not decided yet');
  assert.equal(label('wants'), 'Wants over time');
});
