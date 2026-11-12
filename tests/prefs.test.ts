// What the app keeps on a device goes through one module (src/lib/prefs.ts), under names listed once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PREF, readJson, readPref, storeOf, writeJson, writePref } from '../src/lib/prefs.ts';

const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : []; });
const code = (text: string) => text.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const SRC = files('src').filter((f) => f !== join('src', 'lib', 'prefs.ts'));

test('only the settings module touches the device\'s storage', () => {
  const others = SRC.filter((f) => /\b(localStorage|sessionStorage)\b/.test(code(readFileSync(f, 'utf8'))));
  assert.deepEqual(others, [], 'use readPref, writePref or storeOf from src/lib/prefs.ts');
});

test('every name the app stores under is in the one list, and nowhere else', () => {
  const names = Object.values(PREF) as string[];
  assert.equal(new Set(names).size, names.length, 'no name twice');
  const stray: string[] = [];
  SRC.forEach((f) => {
    const text = code(readFileSync(f, 'utf8'));
    names.forEach((n) => { if (text.includes('\'' + n + '\'') && !/Event\('sf-pomodoro'\)|Listener\('sf-pomodoro'/.test(text)) stray.push(f + ': ' + n); });
  });
  assert.deepEqual(stray, []);
});

test('the names never change: a device already holds things under them', () => {
  // A new setting adds a line here. Changing or removing one strands what Kyle's iPad and desktop keep under it.
  const held = ['story-forge.settings', 'story-forge.outbox.', 'story-forge.landed.', 'story-forge.queue.', 'story-forge.drafts.', 'story-forge.sync-notice.',
    'story-forge.change-choices.', 'story-forge.change-rules.', 'story-forge.change-rules-skip.', 'story-forge.added.', 'story-forge.seen-jobs.', 'story-forge.filled.',
    'story-forge.options-done.', 'story-forge.recent.', 'sf-pomodoro', 'sf-pomodoro-log:', 'sf-typed', 'sf-typing', 'sf-timer-sounds', 'story-forge.theme',
    'story-forge.page-look', 'story-forge.page-look.asks-left', 'sparrow.top-room', 'story-forge.listen', 'story-forge.read-rates', 'story-forge.check-show',
    'story-forge.fill-auto', 'story-forge.panel-tab', 'story-forge.chapters', 'story-forge.scene-panel', 'story-forge.side-tools', 'story-forge.shown-scenes.',
    'story-forge.chapter-list-scroll.', 'story-forge.side-chat.', 'story-forge.side-chat-open', 'story-forge.beats-open.', 'story-forge.beat-ruler',
    'story-forge.changes-view', 'story-forge.rewrite-left-off.', 'story-forge.rewrite.hide-same', 'story-forge.home-sort', 'story-forge.home-view',
    'story-forge.grid-view-2', 'story-forge.tension-tab', 'story-forge.matrix-show', 'story-forge.plot-grid-mode', 'story-forge.promises-settled',
    'sf-castweb-focus:', 'story-forge.todo-view', 'story-forge.todo-map-filter', 'sf-team-sort', 'sf-chat-prefill', 'story-forge.rewrite-edits.',
    'story-forge.draft-view.', 'story-forge.rewrite-opened.', 'character-study.cache.', 'character-study.lens'];
  const names = Object.values(PREF) as string[];
  held.forEach((n) => assert.ok(names.indexOf(n) >= 0, n + ' is gone from PREF'));
  assert.equal(names.length, held.length, 'a new name goes in this list too');
});

function fake(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear(), key: () => null, get length() { return m.size; } } as Storage;
}

test('reading and writing, and a device that will not keep anything', () => {
  const g = globalThis as { localStorage?: Storage; sessionStorage?: Storage };
  const before = { l: Object.getOwnPropertyDescriptor(g, 'localStorage'), s: Object.getOwnPropertyDescriptor(g, 'sessionStorage') };
  const put = (name: 'localStorage' | 'sessionStorage', value: unknown) => Object.defineProperty(g, name, { configurable: true, get: typeof value === 'function' ? value as () => Storage : () => value as Storage });
  try {
    put('localStorage', fake()); put('sessionStorage', fake());
    assert.equal(readPref('a'), null);
    writePref('a', '1');
    assert.equal(readPref('a'), '1');
    assert.equal(readPref('a', 'visit'), null, 'a visit\'s things are kept apart');
    writePref('a', 'v', 'visit');
    assert.equal(readPref('a', 'visit'), 'v');
    writePref('a', null);
    assert.equal(readPref('a'), null);
    writeJson('j', { n: 1 });
    assert.deepEqual(readJson('j'), { n: 1 });
    writePref('bad', '{not json');
    assert.equal(readJson('bad'), null);
    assert.equal(readJson('none'), null);
    // Storage that throws (private mode, full) or is missing: reads say null, writes do nothing.
    put('localStorage', () => { throw new Error('denied'); });
    assert.equal(storeOf(), null);
    assert.equal(readPref('a'), null);
    assert.doesNotThrow(() => writePref('a', '1'));
    const full = fake(); full.setItem = () => { throw new Error('full'); };
    put('localStorage', full);
    assert.doesNotThrow(() => writePref('a', '1'));
    assert.equal(readPref('a'), null);
  } finally {
    if (before.l) Object.defineProperty(g, 'localStorage', before.l); else delete g.localStorage;
    if (before.s) Object.defineProperty(g, 'sessionStorage', before.s); else delete g.sessionStorage;
  }
});
