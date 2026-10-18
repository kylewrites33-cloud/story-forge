import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { insertText, piecesToMarkdown, runs, stylesAt, styledHtml, textOf, toggleStyle } from '../src/lib/styled.ts';
import { DEMO } from './helpers.ts';

const VAULT = path.resolve(DEMO, '..', '..', 'author-business');

test('italics and bold are styled with no stars on the page, nesting allowed', () => {
  assert.equal(styledHtml('He was *very* tired.'), 'He was <span class="md-i" data-m="*">very</span> tired.');
  assert.equal(styledHtml('a *b **c** d* e'), 'a <span class="md-i" data-m="*">b <span class="md-b" data-m="**">c</span> d</span> e');
  assert.equal(styledHtml('***both***'), '<span class="md-bi" data-m="***">both</span>');
  assert.equal(styledHtml('==look== here'), '<span class="md-hl" data-m="==">look</span> here');
  assert.equal(styledHtml('un*believ*able'), 'un<span class="md-i" data-m="*">believ</span>able');
  for (const plain of ['2*3*4 = 24', '*not closed', 'x ** y ** z', 'line one *a\nb* line two']) assert.equal(styledHtml(plain).indexOf('md-'), -1, plain);
  assert.match(styledHtml('> [!plan] Team notes'), /^<span class="md-quote">&gt; \[!plan\] Team notes<\/span>$/);
});

test('the styled view holds exactly the characters of the file', () => {
  for (const t of ['<b>&amp;</b> *a*', '', '\n\n*x*\n', 'tabs\tand  spaces *ok*']) assert.equal(textOf(styledHtml(t)), t);
});

test('every starred line in the vault scenes is styled and keeps its text', { skip: !fs.existsSync(path.join(VAULT, 'Series')) && 'the vault is not beside this repository' }, () => {
  let lines = 0;
  const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((f) => {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!/^(Snapshots|Archive|Exports)$/.test(f.name)) walk(p); return; }
    if (!/\/Scenes\/.*\.md$/.test(p)) return;
    const text = fs.readFileSync(p, 'utf8');
    assert.equal(textOf(styledHtml(text)), text, p);
    text.split('\n').filter((l) => l.includes('*')).forEach((l) => { lines++; assert.ok(runs(l).length > 0, p + ': ' + l.slice(0, 80)); });
  });
  walk(path.join(VAULT, 'Series'));
  assert.ok(lines > 100);
});

test('Bold and Italic work like a word processor: style a selection or a word, or take the style off', () => {
  const t = (text: string, a: number, b: number, k: 'i' | 'b' | 'h') => toggleStyle(text, a, b, k);
  assert.deepEqual(t('He was very tired.', 7, 11, 'i'), { text: 'He was *very* tired.', start: 8, end: 12 });
  assert.deepEqual(t('He was *very* tired.', 8, 12, 'i'), { text: 'He was very tired.', start: 7, end: 11 });
  // Part of a styled run: the run splits, and the rest keeps its style.
  assert.equal(t('He was *very tired*.', 8, 12, 'i')!.text, 'He was very *tired*.');
  assert.equal(t('He was *very tired*.', 13, 18, 'i')!.text, 'He was *very* tired.');
  // A cursor in a word styles or unstyles the word; between words it waits for the next letters (null).
  assert.equal(t('He was very tired.', 9, 9, 'b')!.text, 'He was **very** tired.');
  assert.equal(t('He was *very* tired.', 10, 10, 'i')!.text, 'He was very tired.');
  assert.equal(t('He was very tired.', 6, 6, 'b'), null);
  // Spaces at the edges stay outside; styled runs inside join the new one.
  assert.equal(t('a *b* c *d* e', 0, 13, 'i')!.text, '*a b c d e*');
  assert.equal(t('He was very ', 7, 12, 'i')!.text, 'He was *very* ');
  // Italic added to bold makes ***, and taken off it leaves bold.
  assert.equal(t('**bold** x', 2, 6, 'i')!.text, '***bold*** x');
  assert.equal(t('***bi*** x', 3, 5, 'i')!.text, '**bi** x');
  assert.equal(t('one\ntwo three', 1, 9, 'b')!.text, 'o**ne**\n**two t**hree');
  assert.equal(t('mark me', 0, 7, 'h')!.text, '==mark me==');
});

test('the cursor takes the style of the words it is in', () => {
  assert.deepEqual(stylesAt('a *bc* d', 3), { i: true, b: false, h: false });
  assert.deepEqual(stylesAt('a *bc* d', 5), { i: true, b: false, h: false });
  assert.deepEqual(stylesAt('a *bc* d', 6), { i: false, b: false, h: false });
  assert.deepEqual(stylesAt('***x***', 4), { i: true, b: true, h: false });
});

test('a paste with italics and bold becomes Markdown, spaces and lines outside the marks', () => {
  assert.equal(piecesToMarkdown([{ text: 'Hi ' }, { text: 'there ', i: true }, { text: 'you', i: true, b: true }, { text: '\n\nnext' }]), 'Hi *there* ***you***\n\nnext');
  assert.equal(piecesToMarkdown([{ text: 'one\ntwo', i: true }]), '*one*\n*two*');
  assert.equal(piecesToMarkdown([{ text: 'a', b: true }, { text: 'b', b: true }]), '**ab**');
});

test('a new line inside styled words closes and reopens their marks; deleting keeps marks that go on', () => {
  assert.deepEqual(insertText('a *slanted words* end', 6, 6, '\n'), { text: 'a *sla*\n*nted words* end', caret: 9 });
  // At the edge of styled words, the line breaks outside them.
  assert.equal(insertText('a *slanted words* end', 3, 3, '\n').text, 'a \n*slanted words* end');
  assert.equal(insertText('a *slanted words* end', 16, 16, '\n').text, 'a *slanted words*\n end');
  assert.equal(insertText('x *ab* y', 4, 4, 'one\ntwo').text, 'x *aone*\n*twob* y');
  // A selection from inside styled words to outside them keeps the closing mark's partner.
  assert.equal(insertText('a *bc* d', 4, 8, '').text, 'a *b*');
  // Typing over all of a styled word keeps its style; deleting it all takes its marks away.
  assert.equal(insertText('a *bc* d', 3, 5, 'X').text, 'a *X* d');
  assert.equal(insertText('a *bc* d', 3, 5, '').text, 'a  d');
  assert.equal(insertText('plain text', 5, 5, '\n').text, 'plain\n text');
});
