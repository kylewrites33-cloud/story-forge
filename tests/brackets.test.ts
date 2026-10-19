import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answeredKeys, askItems, askingKeys, bracketKey, fillAnswers, fillJob, fillJobsFor, findBrackets, locate, placeAnswer } from '../src/lib/brackets.ts';
import { jobText } from '../src/lib/jobs.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import { hunks, mapFor, merge3 } from '../src/lib/live.ts';
import { styledHtml, textOf } from '../src/lib/styled.ts';

const PAGE = 'Mara stood at the gate. She was wearing [...] and her hands were cold.\n\n' +
  'The squash leaves were trampled [research: what would they look like, farmer words] along the fence.\n\n' +
  'See [[Mara]], the [!plan] callout, a [link](x), a note[^1] and\n- [ ] a task box.';

test('brackets: gaps and asks, never links, callouts, footnotes or task boxes', () => {
  const b = findBrackets(PAGE);
  assert.deepEqual(b.map((x) => x.kind + ':' + x.marker), ['gap:[...]', 'ask:[research: what would they look like, farmer words]']);
  assert.equal(b[0].before, 'Mara stood at the gate. She was wearing ');
  assert.equal(b[1].line.startsWith('The squash leaves'), true);
  assert.deepEqual(findBrackets('[ ] and [?] and […]').map((x) => x.kind), ['gap', 'gap', 'gap']);
});

test('a fill job lists each bracket, and its answers come back by name', () => {
  const j = fillJob('S-031', 'S-031 The Field', 'Series/Q/Books/2 B', findBrackets(PAGE), PAGE);
  assert.equal(j.title, 'Fill 2 brackets in S-031');
  assert.equal(j.kind, 'fill');
  const items = askItems(j.ask);
  assert.deepEqual(items.map((i) => i.name + ' ' + i.kind + ' ' + i.marker), ['B1 gap [...]', 'B2 ask [research: what would they look like, farmer words]']);
  assert.match(j.ask, /Paragraph before: Mara stood at the gate/);
  const note = makeNote('Jobs/J-010 Fill 2 brackets in S-031.md', 'x', jobText('J-010', j, new Date('2026-10-18T12:00:00')));
  assert.equal(fillJobsFor([note], 'S-031', 'Series/Q/Books/2 B').length, 1);
  assert.equal(askingKeys([note]).has(bracketKey(findBrackets(PAGE)[0])), true);
  assert.deepEqual(fillAnswers('### B1\na grey wool coat\n\n### B2\nThe vines lay flat.\n\nLeaves split like old canvas.\n'),
    { B1: 'a grey wool coat', B2: 'The vines lay flat.\n\nLeaves split like old canvas.' });
});

test('a gap gets its words after the marker; a question is answered two lines down; both brackets stay', () => {
  const [gap, ask] = askItems(fillJob('S-1', 'S-1', 'b', findBrackets(PAGE), PAGE).ask);
  const g = placeAnswer(PAGE, gap, 'a grey wool coat')!;
  assert.equal(g.text.split('\n')[0], 'Mara stood at the gate. She was wearing [...] a grey wool coat and her hands were cold.');
  assert.deepEqual(g.added, ['Mara stood at the gate. She was wearing [...] a grey wool coat and her hands were cold.']);
  // A cursor after the gap moves with the words; one before it stays.
  assert.equal(g.map(5), 5);
  assert.equal(g.map(PAGE.indexOf('and her')), g.text.indexOf('and her'));
  const a = placeAnswer(g.text, ask, 'The vines lay flat, leaves split and muddied.')!;
  const lines = a.text.split('\n');
  assert.equal(lines[2], 'The squash leaves were trampled [research: what would they look like, farmer words] along the fence.');
  assert.equal(lines[3], '');
  assert.equal(lines[4], 'The vines lay flat, leaves split and muddied.');
  assert.equal(lines[5], '');
  assert.equal(a.map(g.text.indexOf('See [[')), a.text.indexOf('See [['));
  // Already there (another device put it in and saved): nothing changes.
  const again = placeAnswer(a.text, ask, 'The vines lay flat, leaves split and muddied.')!;
  assert.equal(again.text, a.text);
  assert.deepEqual(again.added, []);
  // Gone from the page: nowhere to put it.
  assert.equal(placeAnswer('No brackets here.', gap, 'x'), null);
});

test('answers lose their quote arrows and keep the lines apart', () => {
  // J-010, 2026-10-19: Kyle did not want the "> " arrows in his page.
  const r = fillAnswers('### B1\n> **Dirt**\n> *It\'s dirt. What else do you want? Suitability for farming: 1/10*\n> Status Effect: Demon Lord\'s Blight (11%)\n');
  assert.equal(r.B1, '**Dirt**\n\n*It\'s dirt. What else do you want? Suitability for farming: 1/10*\n\nStatus Effect: Demon Lord\'s Blight (11%)');
  assert.equal(fillAnswers('### B1\nPlain words.\n').B1, 'Plain words.');
});

test('an answered bracket is not sent again', () => {
  const job = makeNote('Jobs/J-1 Fill.md', 'x', jobText('J-1', fillJob('S-1', 'S-1', 'b', findBrackets(PAGE), PAGE), new Date()).replace('status: requested', 'status: done') + '\n## Result\n\n### B1\na coat\n');
  const keys = answeredKeys([job]);
  const [gap, q] = findBrackets(PAGE);
  assert.ok(keys.has(bracketKey(gap)));
  assert.ok(!keys.has(bracketKey(q)), 'B2 has no answer, so it can be sent again');
});

test('two identical gaps: the one with the same words before it', () => {
  const t = 'He wore [...] to the barn.\nShe wore [...] to the dance.';
  const [, second] = findBrackets(t);
  assert.equal(locate(t, { marker: '[...]', before: second.before }), t.lastIndexOf('[...]'));
  assert.equal(locate(t, { marker: '[...]', before: 'nothing like it ' }), -1);
});

test('brackets and added lines are shown without changing a character', () => {
  const opts = { asks: true, asking: new Set(['[...]']), added: new Set(['The squash leaves were trampled [research: what would they look like, farmer words] along the fence.']) };
  const html = styledHtml(PAGE, opts);
  assert.equal(textOf(html), PAGE);
  assert.match(html, /<span class="md-ask asking">\[\.\.\.\]<\/span>/);
  assert.match(html, /<span class="md-added">The squash/);
  assert.equal(html.indexOf('md-ask">[[Mara'), -1);
});

test('words pushed from elsewhere merge into the page line by line', () => {
  const base = 'One.\n\nTwo.\n\nThree.';
  // Kyle typed at the end; a session added a paragraph after "One."
  const mine = 'One.\n\nTwo.\n\nThree. And four';
  const theirs = 'One.\n\nA new line.\n\nTwo.\n\nThree.';
  const m = merge3(base, mine, theirs);
  assert.equal(m.text, 'One.\n\nA new line.\n\nTwo.\n\nThree. And four');
  assert.deepEqual(m.added, ['A new line.']);
  assert.equal(m.clash, false);
  // They changed a line Kyle left alone: theirs comes in.
  assert.equal(merge3(base, mine, 'One!\n\nTwo.\n\nThree.').text, 'One!\n\nTwo.\n\nThree. And four');
  // Both changed the same line: Kyle's stays, and it is a clash.
  const c = merge3(base, mine, 'One.\n\nTwo.\n\nThree, said the other.');
  assert.equal(c.text, mine);
  assert.equal(c.clash, true);
  // Nothing typed here: the other version as it is.
  assert.deepEqual(merge3(base, base, theirs), { text: theirs, added: ['A new line.'], clash: false });
  assert.deepEqual(hunks(['a', 'b'], ['a', 'x', 'b']), [{ a0: 1, a1: 1, b0: 1, b1: 2 }]);
});

test('the cursor keeps its place when words come in before or after it', () => {
  const before = 'abc def';
  const map = mapFor(before, 'abc NEW def');
  assert.equal(map(2), 2);
  assert.equal(map(5), 9);
});
