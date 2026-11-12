// The one way to ask the team (src/team/asks.ts): where an ask stands, and answers marked used on the job note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askFor, askProblem, askState, fromOldWay, isTaken, NO_WATCH, openAsk, openAsks, recentProblem, takenNames, takenRecord, waiting, watchStep, WATCH_SLOWS_AFTER, withTaken, WHOLE } from '../src/team/asks.ts';
import { makeNote } from '../src/lib/vault-index.ts';

const JOB = '---\ntype: job\nid: J-030\ntitle: Fill 2 asks in S-055\nkind: fill\ntarget: S-055\nstatus: done\nfinished: 2026-11-12T15:04\nresult: Filled 2.\n---\n## Ask\nKyle left 2.\n\n## Result\n### B1\nA crow.\n';
const job = (text = JOB) => makeNote('Jobs/J-030 Fill 2 asks in S-055.md', 'x', text);

test('an ask is requested, running, answered, taken, failed or cancelled', () => {
  assert.equal(askState({ data: {} }), 'requested');
  assert.equal(askState({ data: { status: 'running' } }), 'running');
  assert.equal(askState({ data: { status: 'failed' } }), 'failed');
  assert.equal(askState({ data: { status: 'cancelled' } }), 'cancelled');
  assert.equal(askState({ data: { status: 'done' } }), 'answered');
  assert.equal(askState({ data: { status: 'done', taken: ['all'] } }), 'taken');
  assert.ok(waiting({ data: {} }) && waiting({ data: { status: 'running' } }) && !waiting({ data: { status: 'done' } }));
});

test('an ask with several answers is taken only when each one is used', () => {
  assert.equal(askState({ data: { status: 'done', taken: ['B1'] } }, ['B1', 'B2']), 'answered');
  assert.equal(askState({ data: { status: 'done', taken: ['B1', 'B2'] } }, ['B1', 'B2']), 'taken');
  assert.equal(askState({ data: { status: 'done', taken: [WHOLE] } }, ['B1', 'B2']), 'taken');
  assert.ok(isTaken({ data: { taken: 'B1, B2' } }, 'B2') && !isTaken({ data: { taken: ['B1'] } }, 'B2') && !isTaken({ data: {} }));
});

test('marking an answer used adds one line to the job note and changes no other', () => {
  const one = withTaken(JOB, ['B1']);
  assert.equal(one, JOB.replace('result: Filled 2.\n', 'result: Filled 2.\ntaken: [B1]\n'));
  const two = withTaken(one, ['B2', 'B1']);
  assert.equal(two, JOB.replace('result: Filled 2.\n', 'result: Filled 2.\ntaken: [B1, B2]\n'));
  assert.deepEqual(takenNames(job(two)), ['B1', 'B2']);
  // The whole ask used stands for every answer.
  assert.equal(withTaken(two, [WHOLE]), JOB.replace('result: Filled 2.\n', 'result: Filled 2.\ntaken: [all]\n'));
  // A list the team wrote out line by line is read and rewritten as one line.
  assert.deepEqual(takenNames(job(withTaken(JOB.replace('result: Filled 2.\n', 'taken:\n  - B2\nresult: Filled 2.\n'), ['B1']))), ['B2', 'B1']);
  // Nothing that is not a plain name gets into the note's properties.
  assert.equal(withTaken(JOB, ['B1]\nstatus: keep']), JOB);
});

test('the note on screen and the saved text agree', () => {
  for (const names of [['B1'], ['B2', 'B1'], [WHOLE]]) {
    const shown = takenRecord(job(), names);
    const saved = job(withTaken(JOB, names));
    assert.deepEqual(shown.data, saved.data);
    assert.equal(shown.body, saved.body);
  }
});

test('a note whose properties cannot be read says so in a plain sentence', () => {
  assert.throws(() => withTaken('No properties here.\n', ['B1']), /cannot be marked as used/);
});

test('asks finished before the change are still told from the device\'s own list', () => {
  assert.ok(fromOldWay({ data: { status: 'done', finished: '2026-11-10T09:00' } }));
  assert.ok(!fromOldWay({ data: { status: 'done', finished: '2026-11-13T09:00' } }));
  assert.ok(!fromOldWay({ data: { status: 'done' } }));
});

const j = (id: string, status: string, more: Record<string, unknown> = {}) => ({ data: { id, kind: 'beats', target: 'Chapter 3', book: 'B', status, ...more } });

test('a feature finds its ask: the one the team still has, or else the newest', () => {
  const jobs = [j('J-001', 'done'), j('J-002', 'failed'), j('J-003', 'done', { target: 'Chapter 4' }), j('J-004', 'done', { book: 'Other' }), j('J-010', 'done', { kind: 'revise' })];
  const of = { kind: 'beats', target: 'Chapter 3', book: 'B' };
  assert.equal(askFor(jobs, of)!.data.id, 'J-002');
  assert.equal(openAsk(jobs, of), null);
  assert.equal(askFor(jobs.concat([j('J-000', 'running')]), of)!.data.id, 'J-000', 'an open ask comes before a newer finished one');
  assert.equal(openAsk(jobs.concat([j('J-005', 'requested')]), of)!.data.id, 'J-005');
  assert.equal(askFor(jobs, { kind: 'beats', target: 'Chapter 9', book: 'B' }), null);
  assert.equal(askFor(jobs, { kind: 'beats' })!.data.id, 'J-004', 'with no target or book, any of the kind');
});

test('one sentence for an ask the team could not finish, shown for a day', () => {
  assert.equal(askProblem(j('J-001', 'failed')), 'The team could not finish this. Ask again when you are ready; the Jobs page has the details.');
  assert.equal(askProblem(j('J-001', 'failed', { result: 'The spend cap was reached' })), 'The team could not finish this. The spend cap was reached. Ask again when you are ready; the Jobs page has the details.');
  assert.match(askProblem(j('J-001', 'failed', { result: 'It ran out of time.' })), /this\. It ran out of time\. Ask again/);
  const now = Date.parse('2026-11-12T12:00');
  assert.ok(recentProblem(j('J-001', 'failed', { finished: '2026-11-12T09:00' }), now));
  assert.equal(recentProblem(j('J-001', 'failed', { finished: '2026-11-10T09:00' }), now), '', 'a failure from two days ago is not brought up again');
  assert.ok(recentProblem(j('J-001', 'failed', { created: '2026-11-12' }), now), 'with no finish time, the day it was asked');
  assert.equal(recentProblem(j('J-001', 'failed', { created: '2026-11-09' }), now), '');
  assert.equal(recentProblem(j('J-001', 'done', { finished: '2026-11-12T09:00' }), now), '');
  assert.equal(recentProblem(j('J-001', 'running'), now), '');
  assert.equal(recentProblem(null, now), '');
});

test('the one watcher: every look while the team has an ask, once a minute after 20 quiet minutes, fast again when anything moves', () => {
  const t0 = 1_000_000_000_000;
  assert.deepEqual(watchStep(NO_WATCH, [j('J-001', 'done'), j('J-002', 'failed'), j('J-003', 'cancelled')], t0), { read: false, watch: NO_WATCH });
  const open = [j('J-001', 'done'), j('J-002', 'requested')];
  assert.equal(openAsks(open), 'J-002:requested');
  let w = NO_WATCH;
  let reads = 0;
  for (let i = 0; i < 80; i++) { const s = watchStep(w, open, t0 + i * 15000); w = s.watch; if (s.read) reads++; }
  assert.equal(reads, 80, 'every 15 seconds for the first 20 minutes');
  assert.equal(w.since, t0);
  reads = 0;
  for (let i = 80; i < 120; i++) { const s = watchStep(w, open, t0 + i * 15000); w = s.watch; if (s.read) reads++; }
  assert.equal(reads, 10, 'then once a minute');
  const later = t0 + WATCH_SLOWS_AFTER + 10 * 60 * 1000 + 15000;
  const moved = watchStep(w, [j('J-002', 'running')], later);
  assert.ok(moved.read && moved.watch.since === later, 'the ask started: fast again');
  assert.ok(watchStep(moved.watch, [j('J-002', 'running')], later + 15000).read);
  assert.deepEqual(watchStep(moved.watch, [j('J-002', 'done')], later + 30000), { read: false, watch: NO_WATCH });
});
