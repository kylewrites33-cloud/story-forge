import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addOwn, parseTitles, pickedTitle, setPick, NONE } from '../src/lib/titles.ts';

const BODY = `Four title options per chapter.

## Chapter 1
Was: The Glitched Stat

- [ ] Level 99, Retired
- [x] Quest Declined
- [ ] The Last Ding
- [ ] Farm Fresh
- [ ] None of these

## Chapter 2
Was: Sparrow and Sage

- [ ] One
- [ ] Two
- [X] None of these
`;

test('parseTitles reads each chapter, its old name, options and None', () => {
  const t = parseTitles(BODY);
  assert.equal(t.length, 2);
  assert.equal(t[0].was, 'The Glitched Stat');
  assert.equal(t[0].options.length, 4);
  assert.equal(pickedTitle(t[0]), 'Quest Declined');
  assert.equal(t[1].none, true);
  assert.equal(pickedTitle(t[1]), '');
});

test('setPick ticks one line per chapter and leaves other chapters alone', () => {
  const a = setPick(BODY, 1, 'Farm Fresh', true);
  const t = parseTitles(a);
  assert.equal(pickedTitle(t[0]), 'Farm Fresh');
  assert.equal(t[0].options.filter((o) => o.picked).length, 1);
  assert.equal(t[1].none, true);
  const b = setPick(a, 1, NONE, true);
  assert.equal(pickedTitle(parseTitles(b)[0]), '');
  assert.equal(parseTitles(b)[0].none, true);
  const c = setPick(b, 1, NONE, false);
  assert.equal(parseTitles(c)[0].none, false);
  assert.equal(setPick(BODY, 1, 'Quest Declined', true), BODY);
});

test('addOwn adds Kyle\'s title ticked above None of these', () => {
  const a = addOwn(BODY, 2, '  Sparrow  Sings ');
  const t = parseTitles(a)[1];
  assert.equal(pickedTitle(t), 'Sparrow Sings');
  assert.equal(t.none, false);
  assert.ok(a.indexOf('- [x] Sparrow Sings\n- [ ] None of these') > 0);
  assert.equal(pickedTitle(parseTitles(a)[0]), 'Quest Declined');
  assert.equal(addOwn(a, 2, 'Sparrow Sings'), a);
});
