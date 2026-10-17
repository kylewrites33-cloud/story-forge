import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { runs, styledHtml, textOf } from '../src/lib/styled.ts';
import { DEMO } from './helpers.ts';

const VAULT = path.resolve(DEMO, '..', '..', 'author-business');

test('italics and bold are styled, stars kept, nesting allowed', () => {
  const mark = (h: string) => h.replace(/<span class="md-mark">(\**)<\/span>/g, '[$1]');
  assert.equal(mark(styledHtml('He was *very* tired.')), 'He was <span class="md-i">[*]very[*]</span> tired.');
  assert.equal(mark(styledHtml('a *b **c** d* e')), 'a <span class="md-i">[*]b <span class="md-b">[**]c[**]</span> d[*]</span> e');
  assert.equal(mark(styledHtml('***both***')), '<span class="md-bi">[***]both[***]</span>');
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
