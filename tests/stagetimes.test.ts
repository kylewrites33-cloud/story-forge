import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SixStage, StageKey } from '../src/lib/bookstages.ts';
import { addDays, afterDraft, datesToRecord, daysBetween, estimate, stageDates, typicalDays } from '../src/lib/stagetimes.ts';

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

test('editing in a pass: this pass at its own pace, then the rest of editing as it went before', () => {
  const others = [{ draft2_end: '2026-09-05', editing_end: '2026-10-29', editing_paused: 52 }];
  assert.equal(afterDraft(others, 2), 2);
  const dates = stageDates({ editing_start: '2026-10-29' });
  // 11 of 37 chapters (30%) since Nov 5: three days for 30%, so 7 more, then 2 days of proofreads, then 3 to publish.
  const est = estimate(six('editing', 10), dates, [book1], '2026-11-07', { to: 2, percent: 30, start: '2026-11-05', after: afterDraft(others, 2) });
  assert.equal(est.stages[4].left, 9);
  assert.equal(est.date, '2026-11-19');
});

test('the first day of a pass: a first guess for it, not one morning\'s pace (Kyle, 2026-11-12)', () => {
  const dates = stageDates({ editing_start: '2026-10-29' });
  // Draft 3 began today with 4% decided: 7 days for this pass, 7 for the final pass (no book has its dates yet), 3 to publish.
  const est = estimate(six('editing', 35), dates, [book1], '2026-11-12', { to: 3, percent: 4, start: '2026-11-12', after: null });
  assert.equal(est.stages[4].left, 14);
  assert.equal(est.stages[4].due, '2026-11-26');
  assert.equal(est.date, '2026-11-29');
});
