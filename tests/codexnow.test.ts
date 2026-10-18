import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildIndex } from '../src/lib/vault-index.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { codexFor, matcher, presence } from '../src/lib/codex.ts';
import { codexNow, nowForNote, parseWhen, plannedNotNamed, secretStates, splitSecrets } from '../src/lib/codexnow.ts';
import { DEMO, FsSource } from './helpers.ts';

async function demo() {
  const src = new FsSource(DEMO);
  const schema = parseSchema(fs.readFileSync(path.join(DEMO, 'System/schema.json'), 'utf8'));
  const { files } = await src.tree();
  return buildIndex({ schema, files, read: (p) => src.read(p), phase: 6 });
}

test('secrets are split the way sf splits them, timed by a scene in their title', () => {
  const body = 'Open text.\n\n> [!secret] Book 1, S-030\n> The kitchen.\n\n> [!secret]\n> Untimed.\n\n## Draft disagrees\n\n> [!secret] S-004\n> Still a secret.\n';
  const parts = splitSecrets(body);
  assert.equal(parts.length, 3);
  assert.deepEqual(parts[0].when, { book: 1, scene: 'S-030' });
  assert.equal(parts[0].text, 'The kitchen.');
  assert.equal(parts[1].when, null);
  assert.deepEqual(parseWhen('B2 S-004'), { book: 2, scene: 'S-004' });
  assert.equal(parseWhen('later'), null);
});

test('a secret is known after its scene, here at it, held before it; untimed ones wait for a reveal list', () => {
  const parts = splitSecrets('> [!secret] Book 2, S-002\n> a\n\n> [!secret] Book 1, S-009\n> b\n\n> [!secret]\n> c\n');
  const pos = (at: number, reveals: string[][] = []) => ({ bookNumber: 2, ids: ['S-001', 'S-002', 'S-003'], at, reveals });
  assert.deepEqual(secretStates(parts, ['Mara'], pos(0)), ['held', 'known', 'held']);
  assert.deepEqual(secretStates(parts, ['Mara'], pos(1)), ['here', 'known', 'held']);
  assert.deepEqual(secretStates(parts, ['Mara'], pos(2, [[], ['Mara'], []])), ['known', 'known', 'known']);
  assert.deepEqual(secretStates(parts, ['Mara'], pos(1, [[], ['mara'], []])), ['here', 'known', 'here']);
});

test('the demo codex: now from progressions up to the open scene, and secrets by scene', async () => {
  const index = await demo();
  const book = index.books[0];
  const scene = (id: string) => book.scenes.find((p) => index.notes[p].data.id === id)!;
  const codex = codexFor(index, book);
  const bell = codex.find((e) => e.name === 'Ash Bell')!.note;
  assert.equal(codexNow(index, book, bell, scene('S-002')).latest, null);
  const at3 = codexNow(index, book, bell, scene('S-003'));
  assert.equal(at3.latest!.change, 'The Warden takes the bell.');
  assert.equal(at3.open, true);
  const mara = codex.find((e) => e.name === 'Mara Quill')!.note;
  const maraNow = codexNow(index, book, mara, scene('S-006'));
  assert.equal(maraNow.latest!.at, 'S-005');
  assert.equal(maraNow.secrets.length, 1);
  assert.equal(maraNow.secrets[0].state, 'held');
  const warden = codex.find((e) => e.name === 'The Warden')!.note;
  assert.deepEqual(codexNow(index, book, warden, scene('S-005')).secrets.map((s) => s.state), ['held']);
  assert.deepEqual(codexNow(index, book, warden, scene('S-006')).secrets.map((s) => s.state), ['here']);
  assert.equal(codexNow(index, book, warden, scene('S-008')).never, true);
  const law = codex.find((e) => e.name === 'Bell Law')!.note;
  assert.deepEqual(codexNow(index, book, law, scene('S-001')).secrets.map((s) => s.state), ['held']);
  assert.deepEqual(codexNow(index, book, law, scene('S-002')).secrets.map((s) => s.state), ['here']);
  assert.deepEqual(codexNow(index, book, law, scene('S-003')).secrets.map((s) => s.state), ['known']);
  // With no scene open, the writing stands at the last scene that is not just planned (S-004).
  const where = codexNow(index, book, law);
  assert.equal(where.scene, 'S-004');
  assert.equal(where.open, false);
});

test('a red square: a character on a drafted scene\'s card the prose never names', async () => {
  const index = await demo();
  const book = index.books[0];
  const codex = codexFor(index, book);
  const m = matcher(codex);
  const s1 = index.notes[book.scenes[0]];
  const red = codex.filter((e) => plannedNotNamed(s1, e.type, presence(s1, e, m))).map((e) => e.name);
  assert.deepEqual(red, ['The Warden']);
  // A planned scene's body is card notes, never prose: no red squares there.
  const s3 = book.scenes.map((p) => index.notes[p]).find((n) => n.data.status === 'planned')!;
  assert.deepEqual(codex.filter((e) => plannedNotNamed(s3, e.type, presence(s3, e, m))), []);
});

test('a note view finds its book and reads a series note with its book delta', async () => {
  const index = await demo();
  const mara = index.notes['Series/Ember Road/Characters/Mara Quill.md'];
  const now = nowForNote(index, mara, null)!;
  assert.equal(now.scene, 'S-004');
  assert.equal(now.secrets.length, 1);
  const delta = index.notes['Series/Ember Road/Books/1 Ash Bell/Characters/Mara Quill.md'];
  assert.equal(nowForNote(index, delta, null)!.secrets.length, 1);
  assert.equal(nowForNote(index, index.notes[index.books[0].scenes[0]], null), null);
});
