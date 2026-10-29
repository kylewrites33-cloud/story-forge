import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  addToDay, addTypedToDay, addTyping, addTypingToDay, flushTyping, loadTyping, markTyping, toMinutes, typingDue, wordsAnHour, TYPING_GAP_MS, advance, flushTyped, loadTyped, trackWords, wordsNotTyped, typedDue, saveTimer, loadTimer, clock, flushLog, idleState, loadLog, msLeft, noteWords, pause, recordLine, resume, saveLog, startWork, pomodoroCount, stop, stoppedRecord, today, wordsSoFar
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
  assert.equal(wordsSoFar(s), 300);
  s = pause(s, T0 + 60000);
  assert.equal(noteWords(s, 'a.md', 'S-001', 1300, 1400), s, 'paused: not counted');
  s = resume(s, T0 + 120000);
  assert.equal(advance(s, T0 + 25 * 60000).record, null, 'the pause moved the end');
  const { state, record } = advance(s, T0 + 26 * 60000);
  assert.deepEqual(record, { date: '2026-10-18', time: '09:30', minutes: 25, words: 300, scenes: ['S-001', 'S-002'] });
  assert.equal(state.phase, 'break');
  assert.equal(state.justDone?.words, 300);
  const after = advance(state, T0 + 40 * 60000);
  assert.equal(after.state.phase, 'idle');
  assert.equal(after.record, null);
  assert.equal(noteWords(idleState(), 'a.md', 'S-001', 1, 9).phase, 'idle');
  assert.equal(stop(startWork(idleState(), T0)).workMin, 25);
  // Rewriting: cutting 200 words and writing 120 new ones counts the 120.
  let r = startWork(idleState(), T0);
  r = noteWords(r, 'a.md', 'S-059', 943, 743);
  for (let w = 743; w < 863; w += 6) r = noteWords(r, 'a.md', 'S-059', w, w + 6);
  assert.equal(wordsSoFar(r), 120);
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

test('a Pomodoro stopped early keeps its minutes and words but is not a whole Pomodoro', () => {
  let s = startWork(idleState(), T0);
  s = noteWords(s, 'a.md', 'S-001', 100, 220);
  s = pause(s, T0 + 10 * 60000);
  s = resume(s, T0 + 20 * 60000);
  const r = stoppedRecord(s, T0 + 25 * 60000);
  assert.deepEqual(r, { date: '2026-10-18', time: '09:30', minutes: 15, words: 120, scenes: ['S-001'], stopped: true });
  assert.equal(stoppedRecord(startWork(idleState(), T0), T0 + 20000), null, 'under a minute and no words');
  assert.equal(stoppedRecord(idleState(), T0), null);
  assert.equal(recordLine(r!), '- 09:30, 15 minutes (stopped early), 120 words (S-001)');
  const full = { date: '2026-10-18', time: '10:00', minutes: 25, words: 10, scenes: [] };
  const n = makeNote('Writing Log/2026-10-18.md', 'x', addToDay(addToDay('', r!, new Date(T0)), full, new Date(T0)));
  assert.equal(n.data.pomodoros, 1);
  assert.equal(n.data.minutes, 40);
  assert.equal(n.data.words, 130);
  const index = { notes: {} } as unknown as VaultIndex;
  assert.deepEqual(today(index, [r!, full], new Date(T0)), { pomodoros: 1, minutes: 40, words: 130, typed: 0, typing: 0 });
  assert.equal(pomodoroCount(40), '1.6');
  assert.equal(pomodoroCount(44), '1.76');
  assert.equal(pomodoroCount(125), '5');
  assert.equal(pomodoroCount(0), '0');
});

test('finished Pomodoros wait on the device, then go to the Writing Log as Kyle\'s commits', async () => {
  const src = new MemSource();
  saveLog(src.key, [
    { date: '2026-10-18', time: '09:30', minutes: 25, words: 300, scenes: ['S-001'] },
    { date: '2026-10-18', time: '10:00', minutes: 25, words: 200, scenes: ['S-001'] }
  ]);
  const index = { notes: {} } as unknown as VaultIndex;
  assert.deepEqual(today(index, loadLog(src.key), new Date('2026-10-18T12:00:00')), { pomodoros: 2, minutes: 50, words: 500, typed: 0, typing: 0 });
  const saved = await flushLog(src, new Date('2026-10-18T10:30:00Z'));
  assert.equal(saved.length, 2);
  assert.deepEqual(loadLog(src.key), []);
  const n = makeNote('Writing Log/2026-10-18.md', 'x', src.files.get('Writing Log/2026-10-18.md') as string);
  assert.equal(n.data.pomodoros, 2);
  assert.equal(n.data.words, 500);
  assert.doesNotMatch(src.writes.map((w) => w.message).join('\n'), /Agent:/);
  const withNote = { notes: { [n.path]: n } } as unknown as VaultIndex;
  assert.deepEqual(today(withNote, [], new Date('2026-10-18T12:00:00')), { pomodoros: 2, minutes: 50, words: 500, typed: 500, typing: 0 });
  assert.deepEqual(today(withNote, [], new Date('2026-10-19T12:00:00')), { pomodoros: 0, minutes: 0, words: 0, typed: 0, typing: 0 });
});

test('words typed count with no Pomodoro running, and the team\'s words never count', async () => {
  store.clear();
  const t = new Date('2026-10-21T09:00:00').getTime();
  trackWords('a.md', 'S-001', 100, 160, t);
  assert.equal(loadTyped().days['2026-10-21'], 60, 'no Pomodoro running: still counted');
  trackWords('a.md', 'S-001', 160, 100, t + 1000);
  assert.equal(loadTyped().days['2026-10-21'], 60, 'deleting takes nothing away');
  // The team fills a bracket with 40 words while Kyle types 3 more: only his 3 count.
  wordsNotTyped(40, t + 2000);
  trackWords('a.md', 'S-001', 100, 143, t + 2100);
  assert.equal(loadTyped().days['2026-10-21'], 63);
  // Deleting the team's words does not lower the count; typing afterwards counts again.
  trackWords('a.md', 'S-001', 143, 103, t + 3000);
  trackWords('a.md', 'S-001', 103, 105, t + 4000);
  assert.equal(loadTyped().days['2026-10-21'], 65);
  // Words not typed that never arrive do not swallow Kyle's later typing.
  wordsNotTyped(50, t + 5000);
  trackWords('a.md', 'S-001', 105, 110, t + 11000);
  assert.equal(loadTyped().days['2026-10-21'], 70);
  // A running Pomodoro counts the same typed words and leaves the team's out.
  saveTimer(startWork(idleState(), t + 12000));
  wordsNotTyped(30, t + 13000);
  trackWords('a.md', 'S-001', 110, 145, t + 13100);
  assert.equal(wordsSoFar(loadTimer()), 5);
  assert.equal(loadTyped().days['2026-10-21'], 75);
  assert.equal(typedDue(loadTyped(), t + 13100 + 60000), false, 'still typing');
  assert.equal(typedDue(loadTyped(), t + 13100 + 2 * 60000), true, 'a two-minute pause');
  assert.equal(typedDue({ ...loadTyped(), typedAt: t + 10 * 60000 }, t + 10 * 60000), true, 'ten minutes of steady typing');

  // It goes to the day's note as `typed`; a day logged before then starts from its Pomodoro words.
  const src = new MemSource();
  src.files.set('Writing Log/2026-10-21.md', addToDay('', { date: '2026-10-21', time: '08:00', minutes: 25, words: 516, scenes: ['S-051'] }, new Date(t)));
  const saved = await flushTyped(src, new Date(t + 20 * 60000));
  assert.equal(saved.length, 1);
  assert.deepEqual(loadTyped().days, {});
  const n = makeNote('Writing Log/2026-10-21.md', 'x', src.files.get('Writing Log/2026-10-21.md') as string);
  assert.equal(n.data.typed, 516 + 75);
  assert.equal(n.data.words, 516, 'the Pomodoro words stay as they were');
  assert.match(n.body, /## Pomodoros\n- 08:00, 25 minutes, 516 words \(S-051\)/);
  assert.doesNotMatch(src.writes.map((w) => w.message).join('\n'), /Agent:/);
  assert.equal(today({ notes: { [n.path]: n } } as unknown as VaultIndex, [], new Date(t), { days: { '2026-10-21': 9 }, firstAt: 0, typedAt: 0 }).typed, 600);
  // A day with no Pomodoro gets a note of its own.
  const fresh = makeNote('Writing Log/2026-10-22.md', 'x', addTypedToDay('', '2026-10-22', 300, new Date(t)));
  assert.equal(fresh.data.typed, 300);
  assert.equal(fresh.data.pomodoros, 0);
  store.clear();
});

test('minutes typing count only the time between changes two minutes or less apart', async () => {
  store.clear();
  const t = new Date('2026-10-29T09:00:00').getTime();
  let a = loadTyping();
  a = addTyping(a, t);
  assert.deepEqual(a.days, {}, 'the first key starts the clock');
  a = addTyping(a, t + 30000);
  a = addTyping(a, t + 90000);
  assert.equal(a.days['2026-10-29'], 90000);
  a = addTyping(a, t + 90000 + TYPING_GAP_MS + 1);
  assert.equal(a.days['2026-10-29'], 90000, 'a long gap counts nothing');
  a = addTyping(a, t + 90000 + TYPING_GAP_MS + 1 + TYPING_GAP_MS);
  assert.equal(toMinutes(a.days['2026-10-29']), 3.5, 'a gap of exactly two minutes counts');
  assert.deepEqual(addTyping(a, t).days, a.days, 'a clock moved back adds nothing');
  // markTyping writes to the device, at most once a second.
  markTyping(t); markTyping(t + 500); markTyping(t + 60000);
  assert.equal(loadTyping().days['2026-10-29'], 60000);
  assert.equal(typingDue(loadTyping(), t + 61000), false, 'still typing');
  assert.equal(typingDue(loadTyping(), t + 60000 + TYPING_GAP_MS), true, 'a two-minute pause');
  // It goes to the day's note as typing_minutes, beside the words typed, and adds up.
  const src = new MemSource();
  src.files.set('Writing Log/2026-10-29.md', addTypedToDay('', '2026-10-29', 300, new Date(t)));
  const saved = await flushTyping(src, new Date(t + 5 * 60000));
  assert.equal(saved.length, 1);
  assert.deepEqual(loadTyping().days, {});
  src.files.set('Writing Log/2026-10-29.md', addTypingToDay(src.files.get('Writing Log/2026-10-29.md') as string, '2026-10-29', 0.5, new Date(t)));
  const n = makeNote('Writing Log/2026-10-29.md', 'x', src.files.get('Writing Log/2026-10-29.md') as string);
  assert.equal(n.data.typing_minutes, 1.5);
  assert.equal(n.data.typed, 300);
  assert.match(src.writes[0].message, /^log: 1 minute typing on 2026-10-29/);
  assert.doesNotMatch(src.writes.map((w) => w.message).join('\n'), /Agent:/);
  const day = today({ notes: { [n.path]: n } } as unknown as VaultIndex, [], new Date(t), undefined, { days: { '2026-10-29': 30000 }, lastAt: 0, firstAt: 0 });
  assert.equal(day.typing, 2);
  assert.equal(wordsAnHour(day.typed, day.typing), 9000);
  assert.equal(wordsAnHour(100, 0.5), null, 'under a minute is too little to say');
  store.clear();
});

test('a writing day the app wrote passes sf validate', { skip: !hasVault && 'the vault is not beside this repository' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-log-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  const r = { date: '2026-10-18', time: '09:30', minutes: 25, words: 412, scenes: ['S-001'] };
  fs.writeFileSync(path.join(dir, 'Writing Log', '2026-10-18.md'), addTypedToDay(addToDay(addToDay('', r, new Date()), r, new Date()), '2026-10-18', 900, new Date()));
  fs.writeFileSync(path.join(dir, 'Writing Log', '2026-10-19.md'), addTypingToDay(addTypedToDay('', '2026-10-19', 250, new Date()), '2026-10-19', 12.3, new Date()));
  fs.writeFileSync(path.join(dir, 'Writing Log', '2026-10-20.md'), addTypingToDay('', '2026-10-20', 4.5, new Date()));
  const out = execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'validate'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /no errors, no warnings/);
});
