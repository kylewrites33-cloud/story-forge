import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { render } from '../scripts/sync-parser.js';
import { hasVault, ROOT, VAULT } from './helpers.ts';

test('reads a scene card the way the vault writes it', () => {
  const p = Frontmatter.parse([
    '---',
    'type: scene',
    'id: S-002',
    'title: The Ferry',
    'chapter: 1',
    'order: 2.5',
    'pov: "[[Mara Quill]]"',
    'cast:',
    '  - "[[Mara Quill]]"',
    '  - "[[Tobin Quill]]"',
    'lore: [[Bell Law]], [[Ash Bell]]',
    'goal: Get Tobin across before the guards arrive.',
    'turn: >-',
    '  The ferry rope',
    '  has been cut.',
    'published:',
    '---',
    '',
    'Card notes.'
  ].join('\n'));
  assert.equal(p.error, null);
  assert.equal(p.data.type, 'scene');
  assert.equal(p.data.chapter, 1);
  assert.equal(p.data.order, 2.5);
  assert.equal(p.data.pov, '[[Mara Quill]]');
  assert.deepEqual(p.data.cast, ['[[Mara Quill]]', '[[Tobin Quill]]']);
  assert.deepEqual(p.data.lore, ['[[Bell Law]]', '[[Ash Bell]]']);
  assert.equal(p.data.turn, 'The ferry rope has been cut.');
  assert.equal(p.data.published, null);
  assert.equal(p.body, '\nCard notes.');
});

test('keeps dates as text and reads booleans', () => {
  const p = Frontmatter.parse('---\ncreated: 2026-10-17\nku: true\n---\nBody');
  assert.equal(p.data.created, '2026-10-17');
  assert.equal(p.data.ku, true);
});

test('a note without frontmatter is all body', () => {
  const p = Frontmatter.parse('Just prose.\n');
  assert.equal(p.hasFm, false);
  assert.deepEqual(p.data, {});
  assert.equal(p.body, 'Just prose.\n');
});

test('broken frontmatter gives a plain error and no properties', () => {
  const p = Frontmatter.parse('---\ntitle: "unclosed\nstatus: planned\n---\nBody');
  assert.ok(p.error && /Unterminated/.test(p.error));
  assert.deepEqual(p.data, {});
});

test('the copy matches the sf tool in the vault', { skip: !hasVault && 'author-business is not checked out beside this repository' }, () => {
  const sf = fs.readFileSync(path.join(VAULT, 'System', 'Tools', 'sf.js'), 'utf8');
  const copy = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'frontmatter.js'), 'utf8');
  assert.equal(copy, render(sf), 'src/lib/frontmatter.js differs from sf.js. Run npm run sync-parser.');
});
