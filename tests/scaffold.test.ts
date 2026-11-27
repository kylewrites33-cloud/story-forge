import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaffoldDoc, chapterMessage } from '../src/lib/scaffold.ts';
import { scaffoldFile } from '../src/lib/vault-index.ts';

test('the scaffold page takes the app colours and hides its own colour button', () => {
  const doc = scaffoldDoc('<title>S</title><div>x</div>', { paper: '#201f27', ink: '#efeef3', soft: '#aaa', rule: '#333', fill: '#2a2933' });
  assert.match(doc, /^<!doctype html>/);
  assert.match(doc, /--paper:#201f27;--ink:#efeef3/);
  assert.match(doc, /#invert\{display:none\}/);
});

test('a colour cannot break out of the style', () => {
  const doc = scaffoldDoc('<p>x</p>', { paper: 'red}</style><script>', ink: 'a', soft: 'b', rule: 'c', fill: 'd' });
  assert.ok(!doc.includes('</style><script>'));
});

test('without colours the page keeps its own', () => {
  assert.ok(!scaffoldDoc('<p>x</p>', null).includes('--paper'));
});

test('the chapter message names the chapter', () => {
  assert.deepEqual(chapterMessage(12), { sparrowChapter: 12 });
});

test('a book has a scaffold only when Scaffold page.html is right in its folder', () => {
  const files = [{ path: 'S/B/1 A/Scaffold page.html', sha: '1' }, { path: 'S/B/2 B/Research/Scaffold page.html', sha: '2' }];
  assert.equal(scaffoldFile(files, 'S/B/1 A')?.sha, '1');
  assert.equal(scaffoldFile(files, 'S/B/2 B'), null);
});
