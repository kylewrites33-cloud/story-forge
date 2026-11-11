// The one saving system, the Writing Log: finished Pomodoros, words typed and minutes typing, handed over by the timer
// and carried to the day's note like every other change.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addToDay, addTypedToDay, addTypingToDay, flushLog, flushTyped, flushTyping, loadTyped, loadTyping, logPath, markTyping, saveLog, takeTypingCounts, today,
  trackWords, type LogItem, type PomodoroRecord
} from '../src/lib/pomodoro.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { sync } from '../src/lib/sync.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import type { VaultIndex } from '../src/lib/types.ts';
import { editRecord, editText, foldSaved, overlayActions } from '../src/vault/apply.ts';
import { textAction, type Action } from '../src/vault/ops.ts';
import { add, loadOutbox, saveOutbox } from '../src/vault/outbox.ts';
import { pushAll } from '../src/vault/push.ts';
import type { TextChange } from '../src/vault/text.ts';
import { DEMO, demoSchemaText, FsSource, MemSource } from './helpers.ts';

// The timer keeps its meters in localStorage; Node has none, so a small stand-in.
const device = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (device.has(k) ? device.get(k) : null),
  setItem: (k: string, v: string) => { device.set(k, v); },
  removeItem: (k: string) => { device.delete(k); }
};

const schema = parseSchema(demoSchemaText());
const DAY = '2026-11-11';
const PATH = logPath(DAY);
const AT = '2026-11-11T15:00:00.000Z';
const R1: PomodoroRecord = { date: DAY, time: '09:30', minutes: 25, words: 412, scenes: ['S-012', 'S-013'] };
const R2: PomodoroRecord = { date: DAY, time: '10:05', minutes: 11, words: 90, scenes: ['S-013'], stopped: true };

async function vault(): Promise<MemSource> {
  const fs2 = new FsSource(DEMO);
  const src = new MemSource();
  for (const f of (await fs2.tree()).files) if (f.path.endsWith('.md') || f.path.endsWith('.json')) src.files.set(f.path, await fs2.read(f.path));
  return src;
}
const indexOf = async (src: MemSource): Promise<VaultIndex> => (await sync(src, null)).index;
/** What the app does with what the timer hands over (onLog in App.tsx). */
function logAction(items: LogItem[], id: string, at = AT): Action {
  const changes = items.map((i): { path: string; change: TextChange } => i.kind === 'pomodoro' ? { path: logPath(i.record.date), change: { what: 'log-pomodoro', record: i.record, at } }
    : i.kind === 'typed' ? { path: logPath(i.date), change: { what: 'log-typed', date: i.date, words: i.words, at } }
      : { path: logPath(i.date), change: { what: 'log-typing', date: i.date, minutes: i.minutes, at } });
  return { ...textAction(changes, [], new Date(at)), id };
}

test('each change to a day of the Writing Log shows on screen exactly as the saved text will read it', () => {
  const start = addToDay('', R1, new Date(AT));
  const changes: TextChange[] = [
    { what: 'log-pomodoro', record: R2, at: AT },
    { what: 'log-typed', date: DAY, words: 120, at: AT },
    { what: 'log-typing', date: DAY, minutes: 3.5, at: AT }
  ];
  let text = start;
  changes.forEach((change) => {
    const edit = { type: 'text' as const, change };
    const next = editText(text, edit);
    assert.notEqual(next, text);
    assert.deepEqual(editRecord(makeNote(PATH, 'x', text), edit), makeNote(PATH, 'x', next), change.what);
    text = next;
  });
  assert.equal(text, addTypingToDay(addTypedToDay(addToDay(start, R2, new Date(AT)), DAY, 120, new Date(AT)), DAY, 3.5, new Date(AT)));
});

test('the first Pomodoro of a day starts the day\'s note: it shows at once, waits across closing the app, and is one save', async () => {
  const src = await vault();
  const index = await indexOf(src);
  assert.equal(index.notes[PATH], undefined);

  const m = new Map<string, string>();
  const s = { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } } as unknown as Storage;
  saveOutbox('k', add([], logAction([{ kind: 'pomodoro', record: R1 }], 'p1')), s);
  const waiting = loadOutbox('k', s);
  assert.equal(waiting.length, 1, 'it is still there when the app opens again');
  const shown = overlayActions(index, waiting, schema);
  assert.deepEqual(shown.notes[PATH], makeNote(PATH, '', addToDay('', R1, new Date(AT))));
  // The timer's panel reads the day from what is shown, with nothing waiting in the timer's own list.
  assert.deepEqual(today(shown, [], new Date(DAY + 'T12:00:00')), { pomodoros: 1, minutes: 25, words: 412, typed: 412, typing: 0 });

  const res = await pushAll(src, waiting);
  assert.deepEqual(res.done, ['p1']);
  assert.equal(src.commits.length, 1);
  assert.deepEqual(src.commits[0].paths, [PATH]);
  assert.equal(src.commits[0].message, 'log: Pomodoro at 09:30 on 2026-11-11, 412 words\n\nKept by the Sparrow app\'s timer.');
  assert.equal(src.files.get(PATH), addToDay('', R1, new Date(AT)));
  // The saved copy takes the save's answer: the same as a fresh read.
  const folded = foldSaved(index, res.saved, schema, res.removed, res.texts);
  assert.deepEqual(folded.notes[PATH], (await indexOf(src)).notes[PATH]);
});

test('Pomodoros and typing counts land as the timer\'s own sending left them', async () => {
  // The old way: the timer sends each itself.
  device.clear();
  const old = await vault();
  saveLog(old.key, [R1, R2]);
  await flushLog(old, new Date(AT));
  const t = new Date(DAY + 'T10:10:00').getTime();
  trackWords('a.md', 'S-013', 1000, 1060, t);
  trackWords('a.md', 'S-013', 1060, 1120, t + 210000);
  markTyping(t);
  markTyping(t + 90000);
  markTyping(t + 210000);
  await flushTyped(old, new Date(AT));
  await flushTyping(old, new Date(AT));
  assert.equal(old.writes.length, 4, 'four saves the old way');

  // The new way: the timer hands them over, and the saving system carries them.
  device.clear();
  const src = await vault();
  let list = add([], logAction([{ kind: 'pomodoro', record: R1 }, { kind: 'pomodoro', record: R2 }], 'p'));
  // The same typing an hour later (the meter writes to the device at most once a second, counted from its last mark).
  const u = t + 3600000;
  trackWords('a.md', 'S-013', 1000, 1060, u);
  trackWords('a.md', 'S-013', 1060, 1120, u + 210000);
  markTyping(u);
  markTyping(u + 90000);
  markTyping(u + 210000);
  assert.deepEqual(takeTypingCounts(false, u + 215000), [], 'not due yet: Kyle is still typing');
  const items = takeTypingCounts(true, u + 215000);
  assert.deepEqual(items, [{ kind: 'typed', date: DAY, words: 120 }, { kind: 'typing', date: DAY, minutes: 3.5 }]);
  assert.deepEqual(loadTyped().days, {}, 'what was taken has left the meter');
  assert.deepEqual(loadTyping().days, {});
  assert.deepEqual(takeTypingCounts(true, u + 216000), [], 'so nothing is counted twice');
  list = add(list, logAction(items, 'c'));
  assert.equal(list.length, 2);
  const res = await pushAll(src, list);
  assert.deepEqual(res.done, ['p', 'c']);
  assert.equal(src.commits.length, 1, 'what waited together is one save');
  assert.equal(src.files.get(PATH), old.files.get(PATH), 'the day\'s note is the same');
  assert.match(src.files.get(PATH)!, /^typed: 622$/m);
  assert.match(src.files.get(PATH)!, /^typing_minutes: 3.5$/m);
});

test('counts land on the day as the vault has it then, on top of what another device logged', async () => {
  const src = await vault();
  const index = await indexOf(src);
  const mine = add([], logAction([{ kind: 'typed', date: DAY, words: 50 }, { kind: 'typing', date: DAY, minutes: 2 }], 'c'));
  // Shown at once on a day with no note yet.
  assert.deepEqual(today(overlayActions(index, mine, schema), [], new Date(DAY + 'T12:00:00')), { pomodoros: 0, minutes: 0, words: 0, typed: 50, typing: 2 });
  // The iPad logged a Pomodoro and some typing meanwhile.
  src.files.set(PATH, addTypingToDay(addTypedToDay(addToDay('', R1, new Date(AT)), DAY, 30, new Date(AT)), DAY, 1.5, new Date(AT)));
  await pushAll(src, mine);
  const text = src.files.get(PATH)!;
  assert.match(text, /^pomodoros: 1$/m);
  assert.match(text, /^typed: 492$/m);
  assert.match(text, /^typing_minutes: 3.5$/m);
  assert.match(text, /- 09:30, 25 minutes, 412 words \(S-012, S-013\)/);
});

test('the part of a tenth of a minute not taken stays in the meter, and an earlier day\'s leftover seconds are dropped', () => {
  device.clear();
  const t = new Date('2026-11-12T23:58:00').getTime();
  markTyping(t);
  markTyping(t + 100000);
  const items = takeTypingCounts(true, t + 100000);
  assert.deepEqual(items, [{ kind: 'typing', date: '2026-11-12', minutes: 1.6 }]);
  assert.equal(Math.round(loadTyping().days['2026-11-12']), 4000, 'four seconds wait for the next tenth');
  // The next day: yesterday's four seconds are too few to send and go.
  const next = t + 24 * 3600000;
  assert.deepEqual(takeTypingCounts(true, next), []);
  assert.deepEqual(loadTyping().days, {});
});
