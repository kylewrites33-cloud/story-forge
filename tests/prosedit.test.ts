// What a key does beside hidden marks in the new writing box (src/lib/prosedit.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clip, edit, letters, markdown, restAt } from '../src/lib/prosedit.ts';

const I = { i: true, b: false, h: false };
/** `|` marks the cursor; `[` and `]` a selection. */
function run(src: string, ins: string, o: { back?: boolean; pend?: typeof I | null } = {}) {
  let a = src.indexOf('|'), b = a, old = src.replace('|', '');
  if (a < 0) { a = src.indexOf('['); b = src.indexOf(']') - 1; old = src.replace('[', '').replace(']', ''); }
  const r = edit(old, a, b, ins, o.back !== false, o.pend || null);
  return r.text.slice(0, r.caret) + '|' + r.text.slice(r.caret) + (r.pend ? ' +' + (r.pend.i ? 'i' : '') + (r.pend.b ? 'b' : '') + (r.pend.h ? 'h' : '') : '');
}
/** A delete of the characters between [ and ], as the page reports it. */
const del = (src: string, back = true) => run(src, '', { back });

test('letters and markdown give back what they were given', () => {
  for (const s of ['plain words', 'a *b* c', '**bold** and *it*', '***both***', 'x ==mark== y', '==*a* b==', '* * *', '2*3 and a lone * star', '> **Title**', 'two\n*lines* here\n\nand ==more==', '*a b* c *d*']) {
    assert.equal(markdown(letters(s)), s);
  }
});

test('typing inside, at the end of and after styled words', () => {
  assert.equal(run('a *wor|d* b', 'x'), 'a *worx|d* b');
  assert.equal(run('a *word|* b', 's'), 'a *words|* b');
  assert.equal(run('a *word*| b', 's'), 'a *word*s| b');
  assert.equal(run('a |*word* b', 'x'), 'a x|*word* b');
  assert.equal(run('a *|word* b', 'x'), 'a *x|word* b');
});

test('a space at the end of styled words goes outside, and the next word joins them', () => {
  assert.equal(run('a *word|*', ' '), 'a *word* | +i');
  assert.equal(run('a *word* |', 'n', { pend: I }), 'a *word n|*');
  assert.equal(run('a *word* |', ' ', { pend: I }), 'a *word*  | +i');
  // Without the waiting look (the cursor was moved), the next word is plain.
  assert.equal(run('a *word* |', 'n'), 'a *word* n|');
  assert.equal(run('**bold|** x', ' '), '**bold** | x +b');
});

test('Backspace and Delete beside a hidden mark take the letter beyond it', () => {
  assert.equal(del('ab [*]cd* e'), 'ab|*cd* e');
  assert.equal(del('ab[*]cd* e'), 'a|*cd* e');
  assert.equal(del('a *cd[*] e'), 'a *c|* e');
  assert.equal(del('a *cd[*] e', false), 'a *cd|*e');
  assert.equal(del('[*]cd* e'), '|*cd* e');
});

test('deleting letters keeps marks whole, and empty words lose theirs', () => {
  assert.equal(del('a *[c]* e'), 'a | e');
  assert.equal(del('a *said [it]* e'), 'a *said* | e');
  assert.equal(del('he [*said ]it* now'), 'he |*it* now');
  assert.equal(del('*on[e* and *tw]o* x'), '*on|o* x');
  assert.equal(del('a ==b[c]== d'), 'a ==b|== d');
  assert.equal(del('one[\n]*two*'), 'one|*two*');
});

test('Enter inside styled words closes them and opens them again', () => {
  assert.equal(run('*one| two*', '\n'), '*one*\n| *two*');
  assert.equal(run('*on|e two*', '\n'), '*on*\n*|e two*');
  assert.equal(run('*one two|*', '\n'), '*one two*\n|');
  assert.equal(run('plain| words', '\n'), 'plain\n| words');
});

test('typing over a selection takes the look of the words replaced', () => {
  assert.equal(run('a *[word]* b', 'x'), 'a *x|* b');
  assert.equal(run('a [plain] *b*', 'x'), 'a x| *b*');
});

test('a look that waits: Bold or Italic pressed between words', () => {
  assert.equal(run('foo |bar', 'x', { pend: I }), 'foo *x|*bar');
  assert.equal(run('a *word|*', 'x', { pend: { i: false, b: false, h: false } }), 'a *word*x|');
});

test('lines with marks inside marks fall back to the older rules, marks kept whole', () => {
  assert.equal(run('*a **b|** c*', 'x'), '*a **bx|** c*');
  assert.equal(del('*a **bc[*]* d*'), '*a **b|** d*');
});

test('where the cursor rests', () => {
  assert.equal(restAt('a *b* c', 2), 3);
  assert.equal(restAt('a *b* c', 5), 4);
  assert.equal(restAt('a *b* c', 3), 3);
  assert.equal(restAt('==**x**==', 0), 4);
  assert.equal(restAt('==**x**==', 9), 5);
  assert.equal(restAt('no marks', 4), 4);
});

test('the clipboard gets the words without marks, and their looks as HTML', () => {
  const t = 'a *b* **c**\n==d==';
  const c = clip(t, 0, t.length);
  assert.equal(c.plain, 'a b c\nd');
  assert.equal(c.html, '<span style="white-space: pre-wrap">a <em>b</em> <strong>c</strong><br><mark>d</mark></span>');
  assert.equal(clip('x *abc* y', 4, 6).plain, 'bc');
  assert.equal(clip('x *abc* y', 4, 6).html, '<span style="white-space: pre-wrap"><em>bc</em></span>');
});
