import assert from 'node:assert/strict';
import { test } from 'node:test';
import { render } from '../src/lib/markdown.ts';

test('escapes HTML in note text', () => {
  assert.equal(render('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(render('[x](javascript:alert(1))'), '<p>[x](javascript:alert(1))</p>');
});

test('renders headings, emphasis, wiki links and lists', () => {
  const html = render('# Notes\n\nMara meets **[[Tobin Quill|Tobin]]** at *dawn*.\n\n- one\n- two');
  assert.equal(html, '<h1>Notes</h1>\n<p>Mara meets <strong><span class="wikilink">Tobin</span></strong> at <em>dawn</em>.</p>\n<ul><li>one</li><li>two</li></ul>');
});

test('renders Obsidian callouts, including secrets', () => {
  assert.equal(render('> [!secret]\n> Mara cracked the bell.'), '<aside class="callout callout-secret"><p class="callout-title">Secret</p><p>Mara cracked the bell.</p></aside>');
});

test('a scene break is a rule', () => {
  assert.equal(render('One.\n\n***\n\nTwo.'), '<p>One.</p>\n<hr>\n<p>Two.</p>');
});
