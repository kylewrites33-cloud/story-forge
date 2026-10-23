import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AUTO, THEMES, cleanTheme, resolveTheme } from '../src/lib/theme.ts';

test('eight light themes and seven dark ones, Violet first', () => {
  assert.equal(THEMES.filter((t) => t.mode === 'light').length, 8);
  assert.equal(THEMES.filter((t) => t.mode === 'dark').length, 7);
  assert.equal(THEMES[0].id, 'violet');
});

test('an unknown choice falls back to Match this device', () => {
  assert.equal(cleanTheme('neon'), AUTO);
  assert.equal(cleanTheme(null), AUTO);
  assert.equal(cleanTheme('forest'), 'forest');
});

test('Match this device follows light and dark', () => {
  assert.equal(resolveTheme(AUTO, false).id, 'violet');
  assert.equal(resolveTheme(AUTO, true).id, 'violet-night');
  assert.equal(resolveTheme('sage', true).id, 'sage');
});

test('every theme has its colours in styles.css, and index.html knows the dark ones', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  THEMES.forEach((t) => {
    assert.ok(css.includes(':root[data-theme="' + t.id + '"]'), t.id + ' has no colours');
    assert.equal(html.includes("'" + t.id + "'"), t.mode === 'dark', t.id + ' in index.html');
  });
});
