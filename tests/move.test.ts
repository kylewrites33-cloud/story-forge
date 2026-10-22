import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { applyToText, moveChange } from '../src/lib/ideas.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { buildIndex } from '../src/lib/vault-index.ts';
import { enqueue, overlay, saveChoice, type Choice } from '../src/lib/write-queue.ts';
import { DEMO, demoSchemaText, FsSource, hasVault, MemSource, VAULT } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const AT = new Date(2026, 9, 17, 22, 40).toISOString();
const schema = parseSchema(demoSchemaText());

const NOTE = '---\ntype: scene\nid: S-006\ntitle: Thaw Market\nstatus: drafted\nchapter: 3\nchapter_title: Ledger\norder: 6\nwords: 12\n---\n\nThe market smelled of wet rope.\n';

test('a move changes only order, chapter and chapter_title', () => {
  const out = applyToText(NOTE, moveChange({ order: 1.5, chapter: 1, chapterTitle: 'Frost' }));
  assert.equal(out, NOTE.replace('chapter: 3', 'chapter: 1').replace('Ledger', 'Frost').replace('order: 6', 'order: 1.5'));
  const untitled = applyToText(NOTE, moveChange({ order: 4.5, chapter: 2, chapterTitle: '' }));
  assert.ok(!/chapter_title/.test(untitled));
  assert.match(untitled, /^chapter: 2$/m);
  const none = applyToText(NOTE, moveChange({ order: 9, chapter: null, chapterTitle: '' }));
  assert.ok(!/^chapter/m.test(none));
  assert.equal(Frontmatter.split(none).body, Frontmatter.split(NOTE).body);
});

test('a move and an accept on the same card both wait; a newer move replaces the older one', () => {
  const p = BOOK + '/Scenes/S-006 Thaw Market.md';
  let q: Choice[] = [];
  q = enqueue(q, { path: p, decision: 'move', reason: '', at: AT, move: { order: 2, chapter: 1, chapterTitle: '' } });
  q = enqueue(q, { path: p, decision: 'accept', reason: '', at: AT });
  q = enqueue(q, { path: p, decision: 'move', reason: '', at: AT, move: { order: 3.5, chapter: 2, chapterTitle: '' } });
  assert.deepEqual(q.map((c) => c.decision), ['accept', 'move']);
  assert.equal(q[1].move!.order, 3.5);
});

test('a waiting move shows the card in its new place at once', async () => {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  const index = await buildIndex({ schema, files, read: (p, sha) => src.read(p, sha) });
  const book = index.books.find((b) => b.folder === BOOK)!;
  const s6 = book.scenes.find((p) => p.includes('S-006'))!;
  const shown = overlay(index, [{ path: s6, decision: 'move', reason: '', at: AT, move: { order: 1.5, chapter: 1, chapterTitle: 'Frost' } }]);
  const ids = shown.books.find((b) => b.folder === BOOK)!.scenes.map((p) => shown.notes[p].data.id);
  assert.deepEqual(ids.slice(0, 3), ['S-001', 'S-006', 'S-002']);
  assert.equal(shown.notes[s6].data.chapter, 1);
  // The saved copy itself is untouched.
  assert.equal(index.notes[s6].data.chapter, 3);
});

test('saving a move writes Kyle\'s commit with no Agent line', async () => {
  const src = new MemSource();
  const p = BOOK + '/Scenes/S-006 Thaw Market.md';
  src.files.set(p, NOTE);
  await saveChoice(src, { path: p, decision: 'move', reason: '', at: AT, move: { order: 1.5, chapter: 1, chapterTitle: 'Frost' } });
  assert.match(src.files.get(p)!, /^order: 1\.5$/m);
  assert.equal(src.writes[0].message, 'scenes: move S-006 Thaw Market\n\nChosen on the Chapter Grid in the Sparrow app.');
  assert.ok(!/Agent:/.test(src.writes[0].message));
});

test('the demo vault still passes sf validate after a move', { skip: !hasVault && 'the vault is not beside this repository' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-move-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  const rel = BOOK + '/Scenes/S-006 Thaw Market.md';
  const file = path.join(dir, rel);
  const src = new MemSource();
  src.files.set(rel, fs.readFileSync(file, 'utf8'));
  await saveChoice(src, { path: rel, decision: 'move', reason: '', at: AT, move: { order: 1.5, chapter: 1, chapterTitle: 'Frost' } });
  fs.writeFileSync(file, src.files.get(rel)!);
  const out = execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'validate'], {
    cwd: dir, env: { ...process.env, SF_VAULT: dir }, encoding: 'utf8'
  });
  assert.match(out, /no errors/);
  fs.rmSync(dir, { recursive: true, force: true });
});
