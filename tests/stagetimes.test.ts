import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SixStage, StageKey } from '../src/lib/bookstages.ts';
import { addDays, datesToRecord, daysBetween, estimate, stageDates, typicalDays } from '../src/lib/stagetimes.ts';

const KEYS: StageKey[] = ['market', 'planning', 'outlining', 'writing', 'editing', 'publishing'];
const six = (current: StageKey | null, percent = 0): SixStage[] => {
  const at = current ? KEYS.indexOf(current) : 99;
  return KEYS.map((key, i) => ({ key, name: key, percent: i < at ? 100 : i === at ? percent : 0, detail: '', current: key === current, elsewhere: false }));
};

const book1 = stageDates({
  market_start: '2026-07-08', market_end: '2026-07-15', planning_start: '2026-07-15', planning_end: '2026-07-20',
  outlining_start: '2026-07-20', outlining_end: '2026-07-25', writing_start: '2026-07-25', writing_end: '2026-08-05',
  editing_start: '2026-08-05', editing_end: '2026-10-29', publishing_start: '2026-10-29', publishing_end: '2026-11-01'
});

test('days between and after', () => {
  assert.equal(daysBetween('2026-10-29', '2026-11-06'), 8);
  assert.equal(addDays('2026-10-29', 8), '2026-11-06');
});

test('other books give the typical days per stage', () => {
  const t = typicalDays([book1]);
  assert.deepEqual(t.editing, { days: 85, books: 1 });
  assert.deepEqual(t.publishing, { days: 3, books: 1 });
});

test('the current stage finishes at his pace, later stages take what they took before', () => {
  const dates = stageDates({ editing_start: '2026-10-29' });
  const est = estimate(six('editing', 20), dates, [book1], '2026-11-06');
  const ed = est.stages.find((s) => s.key === 'editing')!;
  assert.equal(ed.basis, 'pace');
  assert.equal(ed.left, 32); // 8 days for 20%, so 32 more for the other 80%
  assert.equal(ed.due, '2026-12-08');
  assert.equal(est.date, '2026-12-11'); // plus 3 days of publishing
  assert.equal(est.guessed, false);
});

test('early in a stage the other books decide; with no books it is a first guess', () => {
  const dates = stageDates({ editing_start: '2026-11-05' });
  assert.equal(estimate(six('editing', 2), dates, [book1], '2026-11-06').stages[4].left, 84);
  const alone = estimate(six('editing', 2), dates, [], '2026-11-06');
  assert.equal(alone.stages[4].basis, 'guess');
  assert.equal(alone.guessed, true);
});

test('a published book has no estimate', () => {
  assert.equal(estimate(six(null), book1, [], '2026-11-06').date, null);
});

test('the record keeps itself: a start for the stage it is in, an end for stages it left', () => {
  const dates = stageDates({ writing_start: '2026-10-17' });
  assert.deepEqual(datesToRecord(six('editing', 5), dates, false, '2026-11-06'), { writing_end: '2026-11-06', editing_start: '2026-11-06' });
  assert.deepEqual(datesToRecord(six('editing', 5), stageDates({ editing_start: '2026-10-29' }), false, '2026-11-06'), {});
  assert.deepEqual(datesToRecord(six(null), stageDates({ publishing_start: '2026-10-29' }), true, '2026-11-06'), { publishing_end: '2026-11-06' });
});

test('days the book sat waiting come off the days a stage took', () => {
  const t = typicalDays([stageDates({ editing_start: '2026-08-05', editing_end: '2026-10-29', editing_paused: 52 })]);
  assert.equal(t.editing!.days, 33);
});

test('a stage that overlapped the one before counts only the days after it', () => {
  const b = stageDates({ editing_start: '2026-08-05', editing_end: '2026-10-29', publishing_start: '2026-09-05', publishing_end: '2026-11-01' });
  assert.equal(typicalDays([b]).publishing!.days, 3);
});
