import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { AUTO, THEMES, cleanTheme, resolveTheme } from '../src/lib/theme.ts';

test('eight light themes and ten dark ones, Violet first', () => {
  assert.equal(THEMES.filter((t) => t.mode === 'light').length, 8);
  assert.equal(THEMES.filter((t) => t.mode === 'dark').length, 10);
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

const STYLES = new URL('../src/styles/', import.meta.url);
const sheet = (name: string) => readFileSync(new URL(name, STYLES), 'utf8');
/** The files the stylesheet brings in, in order (src/styles/index.css). */
const imported = () => [...sheet('index.css').matchAll(/^@import '\.\/([^']+)';$/gm)].map((m) => m[1]);

test('every theme has its colours in the stylesheet, and index.html knows the dark ones', () => {
  const css = imported().filter((f) => f.startsWith('themes/')).map(sheet).join('\n');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const VALUES = ['--bg', '--surface', '--rail', '--hover', '--text', '--muted', '--line', '--accent', '--accent-soft', '--on-accent'];
  THEMES.forEach((t) => {
    const at = css.indexOf(':root[data-theme="' + t.id + '"], .theme-card[data-theme="' + t.id + '"] {');
    assert.ok(at >= 0, t.id + ' has no colours');
    const block = css.slice(at, css.indexOf('}', at));
    VALUES.forEach((v) => assert.ok(block.includes(v + ':'), t.id + ' has no ' + v));
    assert.equal(html.includes("'" + t.id + "'"), t.mode === 'dark', t.id + ' in index.html');
  });
});

test('the stylesheet is its parts in order: the app, the colour themes, each skin in its own file, the rest', () => {
  const files = imported();
  assert.equal(files[0], 'app.css');
  assert.equal(files[1], 'themes/colours.css');
  assert.equal(files[files.length - 1], 'app-after-themes.css');
  const skins = files.slice(2, -1);
  assert.ok(skins.every((f) => f.startsWith('themes/')));
  assert.ok(skins.indexOf('themes/square-skins.css') < skins.indexOf('themes/marigold.css'), 'what the square themes share comes before them');
  // A skin's file styles only its own theme (the progress ring's font is the one rule Marigold and Typewriter share).
  skins.filter((f) => f !== 'themes/square-skins.css').forEach((f) => {
    const own = f.slice('themes/'.length, -'.css'.length);
    const others = [...new Set([...sheet(f).matchAll(/data-theme="([a-z-]+)"/g)].map((m) => m[1]))].filter((id) => id !== own);
    assert.deepEqual(others, f === 'themes/typewriter.css' ? ['marigold'] : [], f);
    assert.ok(THEMES.some((t) => t.id === own), f + ' is not a theme in theme.ts');
  });
  // Nothing outside the theme files styles a named theme, and every part on disk is brought in.
  ['app.css', 'app-after-themes.css'].forEach((f) => assert.ok(!/data-theme="/.test(sheet(f)), f + ' names a theme'));
  const onDisk = readdirSync(STYLES).filter((n) => n.endsWith('.css') && n !== 'index.css').concat(readdirSync(new URL('themes/', STYLES)).map((n) => 'themes/' + n));
  assert.deepEqual(onDisk.sort(), files.slice().sort());
});
