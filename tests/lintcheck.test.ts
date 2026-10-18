import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { checkOptions, checkText, combine, gradeFor, readingMap, sevWord } from '../src/lib/lintcheck.ts';
import { Lint } from '../src/lib/lint.js';
import { renderLint } from '../scripts/sync-parser.js';
import { hasVault, ROOT, VAULT } from './helpers.ts';

test('the linter copy matches the sf tool in the vault', { skip: !hasVault && 'author-business is not checked out beside this repository' }, () => {
  const sf = fs.readFileSync(path.join(VAULT, 'System', 'Tools', 'sf.js'), 'utf8');
  const copy = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'lint.js'), 'utf8');
  assert.equal(copy, renderLint(sf), 'src/lib/lint.js differs from sf.js. Run npm run sync-parser.');
});

test('renderLint copies the lint section with the helpers it needs', () => {
  const sf = ['const U = (() => {', '  function wordCount(text) {', '    return 1;', '  }', '  const sum = (a) => 0;', '  const mean = (a) => 0;',
    '  function stdev(arr) {', '    return 0;', '  }', '  const escRe = (s) => s;', '})();', 'const Lint = (() => {', '  return {};', '})();', 'const Other = 1;'].join('\n');
  const out = renderLint(sf);
  assert.match(out, /import \{ Prose \} from '\.\/prose\.js';/);
  assert.match(out, /export const Lint = \(\(\) => \{\n  return \{\};\n\}\)\(\);\n$/);
  assert.match(out, /return \{ wordCount, sum, mean, stdev, escRe \};/);
  assert.equal(out.includes('Other'), false);
  assert.throws(() => renderLint('nothing here'), /sf\.js has no/);
});

test('the reading text drops the marks and maps every character back to the page', () => {
  const page = 'She *ran*, **fast**, to [[Cinder Ford|the ford]].\n\n==Mark== it.';
  const { masked, map } = readingMap(page);
  assert.equal(masked, 'She ran, fast, to the ford.\n\nMark it.');
  assert.equal(map.length, masked.length + 1);
  for (let i = 0; i < masked.length; i++) assert.equal(page[map[i]], masked[i], 'character ' + i);
  assert.equal(map[masked.length], page.length);
});

test('a flag points at its words on the page, with its paragraph and line', () => {
  const page = 'Mara climbed the tower.\n\nIt was *a testament to* her nerve, and she let out a breath she didn\'t know she was holding.';
  const r = checkText(page);
  const t = r.issues.find((i) => i.rule === 'vocab.testament')!;
  assert.ok(t);
  assert.equal(page.slice(t.from, t.to), 'a testament to');
  assert.equal(t.para, 2);
  assert.equal(t.line, 3);
  const b = r.issues.find((i) => i.rule.startsWith('stock.breath'))!;
  assert.equal(page.slice(b.from, b.to).startsWith('let out a breath'), true);
  assert.equal(r.stats.tellGrade, gradeFor(r.stats.tellIndex));
  assert.equal(r.stats.words > 10, true);
});

test('the score and grade are the same as the linter run on the reading text', () => {
  const page = 'He *delved* into the tapestry of memories. The silence was palpable.';
  const r = checkText(page);
  const direct = Lint.run(readingMap(page).masked);
  assert.equal(r.stats.tellIndex, direct.stats.tellIndex);
  assert.equal(r.issues.length, direct.issues.length);
});

test('book options: banned phrases, rules turned off, em dash limit and the lowest severity shown', () => {
  const o = checkOptions({ banned: ['suddenly'], lint_disable: 'Rhythm', emdash_max: 6 }, { em_dash_limit_per_1000: 3, lint_min_score: 2 });
  assert.deepEqual(o.lint.extraPhrases, ['suddenly']);
  assert.deepEqual(o.lint.disable, ['Rhythm']);
  assert.equal(o.lint.emdashMax, 6);
  assert.equal(o.minSev, 2);
  assert.deepEqual(checkOptions(null, null), { lint: { extraPhrases: [], disable: [], emdashMax: 4 }, minSev: 1 });
  const r = checkText('Suddenly the door opened. It was quiet.', o);
  const s = r.issues.find((i) => i.rule === 'custom.0')!;
  assert.equal(s.sev, 2);
  assert.ok(r.shown.every((i) => i.sev >= 2));
});

test('grades follow sf lint: under 2 clean, under 5 light, under 10 noticeable, then heavy', () => {
  assert.deepEqual([0, 1.9, 2, 4.9, 5, 9.9, 10].map(gradeFor), ['Clean', 'Clean', 'Light', 'Light', 'Noticeable', 'Noticeable', 'Heavy']);
  assert.equal(sevWord(3), 'Strong tell');
  assert.equal(sevWord(1), 'Worth a look');
});

test('a whole chapter is scored by words, as sf lint scores several files', () => {
  const a = checkText('A testament to grit. ' + 'She walked to the barn and fed the goats. '.repeat(10));
  const b = checkText('The rain came down on the tin roof all night long. '.repeat(10));
  const c = combine([a, b]);
  assert.equal(c.words, a.stats.words + b.stats.words);
  const want = (a.stats.tellIndex * a.stats.words + b.stats.tellIndex * b.stats.words) / c.words;
  assert.ok(Math.abs(c.score - want) < 0.06);
  assert.equal(c.grade, gradeFor(c.score));
  assert.equal(c.sentences, a.stats.sentences + b.stats.sentences);
  assert.deepEqual(combine([]), { words: 0, score: 0, grade: 'Clean', sentences: 0, mean: 0, sd: 0, cv: 0, longest: 0 });
});
