import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  addToDay, advance, clock, flushLog, idleState, loadLog, msLeft, noteWords, pause, recordLine, resume, saveLog, startWork, stop, today, wordsSoFar
} from '../src/lib/pomodoro.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import type { VaultIndex } from '../src/lib/types.ts';
import { DEMO, hasVault, MemSource, VAULT } from './helpers.ts';

// The timer keeps its log in localStorage; Node has none, so a small stand-in.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k) : null),
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }
};

const T0 = new Date('2026-10-18T09:30:00').getTime();

test('a work Pomodoro counts only the words written in it', () => {
  let s = startWork(idleState(), T0);
  assert.equal(clock(msLeft(s, T0)), '25:00');
  s = noteWords(s, 'a.md', 'S-001', 1000, 1004);
  s = noteWords(s, 'a.md', 'S-001', 1004, 1300);
  s = noteWords(s, 'b.md', 'S-002', 50, 40);
  assert.equal(wordsSoFar(s), 290);
  s = pause(s, T0 + 60000);
  assert.equal(noteWords(s, 'a.md', 'S-001', 1300, 1400), s, 'paused: not counted');
  s = resume(s, T0 + 120000);
  assert.equal(advance(s, T0 + 25 * 60000).record, null, 'the pause moved the end');
  const { state, record } = advance(s, T0 + 26 * 60000);
  assert.deepEqual(record, { date: '2026-10-18', time: '09:30', minutes: 25, words: 290, scenes: ['S-001', 'S-002'] });
  assert.equal(state.phase, 'break');
  assert.equal(state.justDone?.words, 290);
  const after = advance(state, T0 + 40 * 60000);
  assert.equal(after.state.phase, 'idle');
  assert.equal(after.record, null);
  assert.equal(noteWords(idleState(), 'a.md', 'S-001', 1, 9).phase, 'idle');
  assert.equal(stop(startWork(idleState(), T0)).workMin, 25);
});

test('each Pomodoro adds one line to the day and raises its counts', () => {
  const r = { date: '2026-10-18', time: '09:30', minutes: 25, words: 412, scenes: ['S-012'] };
  assert.equal(recordLine(r), '- 09:30, 25 minutes, 412 words (S-012)');
  const first = addToDay('', r, new Date('2026-10-18T09:56:00Z'));
  const second = addToDay(first.replace('## Pomodoros', 'Kyle\'s note.\n\n## Pomodoros'), { ...r, time: '10:00', words: 1, scenes: [] }, new Date('2026-10-18T10:26:00Z'));
  const n = makeNote('Writing Log/2026-10-18.md', 'x', second);
  assert.equal(n.data.pomodoros, 2);
  assert.equal(n.data.minutes, 50);
  assert.equal(n.data.words, 413);
  assert.equal(n.data.updated, '2026-10-18T10:26:00Z');
  assert.match(n.body, /Kyle's note\.\n\n## Pomodoros\n- 09:30, 25 minutes, 412 words \(S-012\)\n- 10:00, 25 minutes, 1 word\n$/);
});

test('finished Pomodoros wait on the device, then go to the Writing Log as Kyle\'s commits', async () => {
  const src = new MemSource();
  saveLog(src.key, [
    { date: '2026-10-18', time: '09:30', minutes: 25, words: 300, scenes: ['S-001'] },
    { date: '2026-10-18', time: '10:00', minutes: 25, words: 200, scenes: ['S-001'] }
  ]);
  const index = { notes: {} } as unknown as VaultIndex;
  assert.deepEqual(today(index, loadLog(src.key), new Date('2026-10-18T12:00:00')), { pomodoros: 2, words: 500 });
  const saved = await flushLog(src, new Date('2026-10-18T10:30:00Z'));
  assert.equal(saved.length, 2);
  assert.deepEqual(loadLog(src.key), []);
  const n = makeNote('Writing Log/2026-10-18.md', 'x', src.files.get('Writing Log/2026-10-18.md') as string);
  assert.equal(n.data.pomodoros, 2);
  assert.equal(n.data.words, 500);
  assert.doesNotMatch(src.writes.map((w) => w.message).join('\n'), /Agent:/);
  const withNote = { notes: { [n.path]: n } } as unknown as VaultIndex;
  assert.deepEqual(today(withNote, [], new Date('2026-10-18T12:00:00')), { pomodoros: 2, words: 500 });
  assert.deepEqual(today(withNote, [], new Date('2026-10-19T12:00:00')), { pomodoros: 0, words: 0 });
});

test('a writing day the app wrote passes sf validate', { skip: !hasVault && 'the vault is not beside this repository' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-log-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  const r = { date: '2026-10-18', time: '09:30', minutes: 25, words: 412, scenes: ['S-001'] };
  fs.writeFileSync(path.join(dir, 'Writing Log', '2026-10-18.md'), addToDay(addToDay('', r, new Date()), r, new Date()));
  const out = execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'validate'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /no errors, no warnings/);
});
