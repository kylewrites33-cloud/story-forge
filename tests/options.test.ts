import assert from 'node:assert/strict';
import { test } from 'node:test';
import { askedPassage, locatePassage, optionAnswers, optionJobsFor, optionsJob, optionsState, passageAt, swapIn } from '../src/lib/options.ts';
import { jobText } from '../src/lib/jobs.ts';
import { makeNote } from '../src/lib/vault-index.ts';

const PAGE = 'Mara climbed the tower at 5:40.\n\nShe ran a thumb along the crack. It was cold enough to sting.\n\n"Tobin," she said.';
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';

test('the passage: the words picked, or the paragraph the cursor is in, without spaces at its edges', () => {
  const at = PAGE.indexOf('thumb');
  const p = passageAt(PAGE, { start: at, end: at })!;
  assert.equal(p.text, 'She ran a thumb along the crack. It was cold enough to sting.');
  assert.equal(PAGE.slice(p.start, p.end), p.text);
  assert.equal(p.before, '');
  const s = passageAt(PAGE, { start: PAGE.indexOf(' It was') , end: PAGE.indexOf('sting.') + 6 })!;
  assert.equal(s.text, 'It was cold enough to sting.');
  assert.equal(s.before.trimEnd(), 'She ran a thumb along the crack.');
  assert.equal(passageAt(PAGE, null), null);
  assert.equal(passageAt('\n\n  \n\n', { start: 2, end: 2 }), null);
});

test('an options job carries the mode, the exact passage and full steps, and reads back', () => {
  const p = passageAt(PAGE, { start: PAGE.indexOf('It was'), end: PAGE.indexOf('sting.') + 6 })!;
  const j = optionsJob('tighten', 'S-001', 'S-001 The Crack', BOOK, p);
  assert.equal(j.kind, 'options');
  assert.equal(j.target, 'S-001');
  assert.equal(j.title, 'Tighten a passage in S-001');
  assert.match(j.ask, /### Option 1/);
  assert.match(j.ask, /20 to 40 percent/);
  assert.match(j.ask, /Never change the scene/);
  const note = makeNote('Jobs/J-009 x.md', 'sha', jobText('J-009', j, new Date('2026-10-18T10:00:00')));
  assert.deepEqual(askedPassage(note.body), { mode: 'tighten', passage: 'It was cold enough to sting.', before: 'She ran a thumb along the crack.' });
  assert.equal(askedPassage('## Ask\nNo passage here.'), null);
});

test('a multi-line passage survives the round trip', () => {
  const p = passageAt(PAGE, { start: 0, end: PAGE.indexOf('crack.') + 6 })!;
  const j = optionsJob('expand', 'S-001', 'S-001', BOOK, p);
  const note = makeNote('Jobs/J-010 x.md', 'sha', jobText('J-010', { ...j, page: 'Writing S-001' }, new Date()));
  assert.equal(askedPassage(note.body)!.passage, 'Mara climbed the tower at 5:40.\n\nShe ran a thumb along the crack.');
});

test('the options in a result, quote marks and quoting taken off, with the notes apart', () => {
  const r = optionAnswers('Here you go.\n\n### Option 1\nCold enough to sting.\n\n### Option 2 (shortest)\n> It stung.\n\n### Option 3\n"The cold bit."\n\n### Notes\n1 cuts 3 words.');
  assert.deepEqual(r.options, ['Cold enough to sting.', 'It stung.', 'The cold bit.']);
  assert.equal(r.notes, '1 cuts 3 words.');
  assert.deepEqual(optionAnswers('').options, []);
  assert.deepEqual(optionAnswers('### Option 1\n\n### Option 2\nTwo.').options, ['Two.']);
});

test('the swap happens only where the passage still is, word for word', () => {
  const passage = 'It was cold enough to sting.';
  const before = 'She ran a thumb along the crack.';
  const r = swapIn(PAGE, passage, before, 'It stung.')!;
  assert.equal(r.text, PAGE.replace(passage, 'It stung.'));
  assert.deepEqual(r.added, ['She ran a thumb along the crack. It stung.']);
  const end = PAGE.indexOf('"Tobin');
  assert.equal(r.text.slice(r.map(end), r.map(end) + 6), '"Tobin');
  assert.equal(r.map(3), 3);
  assert.equal(swapIn(PAGE.replace('cold', 'icy'), passage, before, 'x'), null);
});

test('the same words twice: the one with the same words before it', () => {
  const text = 'He waited. It rained.\n\nShe left. It rained.';
  assert.equal(locatePassage(text, 'It rained.', 'She left.'), text.lastIndexOf('It rained.'));
  assert.equal(locatePassage(text, 'It rained.', 'He waited.'), text.indexOf('It rained.'));
  assert.equal(locatePassage(text, 'It rained.', 'Nobody.'), -1);
  assert.equal(locatePassage(text, '', ''), -1);
});

test('a scene\'s options jobs, newest first, and their state', () => {
  const mk = (id: string, status: string, result = '', target = 'S-001') => makeNote('Jobs/' + id + ' x.md', id,
    '---\ntype: job\nid: ' + id + '\nkind: options\ntarget: ' + target + '\nbook: ' + BOOK + '\nstatus: ' + status + '\n---\n## Ask\nx\n' + (result ? '\n## Result\n' + result + '\n' : ''));
  const jobs = [mk('J-001', 'done', '### Option 1\nA.'), mk('J-003', 'requested'), mk('J-002', 'done', 'Sorry, no.'), mk('J-004', 'done', '### Option 1\nB.', 'S-002')];
  const mine = optionJobsFor(jobs, 'S-001', BOOK);
  assert.deepEqual(mine.map((j) => j.data.id), ['J-003', 'J-002', 'J-001']);
  assert.deepEqual(mine.map(optionsState), ['waiting', 'failed', 'ready']);
});
