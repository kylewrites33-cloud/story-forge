// The one way to ask the team (src/team/asks.ts): where an ask stands, and answers marked used on the job note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askState, fromOldWay, isTaken, takenNames, takenRecord, waiting, withTaken, WHOLE } from '../src/team/asks.ts';
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
