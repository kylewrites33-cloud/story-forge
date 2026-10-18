import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itemAt, makeReader, sayable, speechItems, voiceChoices, type Speaker, type Utterance } from '../src/lib/listen.ts';

test('sentences to say, marks gone, each with its place on the page', () => {
  const page = 'Mara *climbed* the tower. The bell hung **crooked**.\n\n"Tobin," she said. "Get up here."';
  const items = speechItems(page);
  assert.deepEqual(items.map((i) => i.say), ['Mara climbed the tower.', 'The bell hung crooked.', '"Tobin," she said.', '"Get up here."']);
  assert.equal(page.slice(items[1].start, items[1].end), 'The bell hung **crooked**.');
  assert.equal(page.slice(items[2].start, items[2].end), '"Tobin," she said.');
  assert.deepEqual(speechItems('x', 2).map((i) => i.part), [2]);
});

test('headings, comments and callouts are not read; brackets lose their marks', () => {
  const items = speechItems('# Chapter One\n\n%% a note %%\n\n> [!team] Team notes\n> skip me\n\nShe wore [...] and [a red coat].');
  assert.deepEqual(items.map((i) => i.say), ['She wore and a red coat.']);
  assert.equal(sayable('**Bold** ==mark== _it_'), 'Bold mark it');
});

test('a long sentence is said in pieces at its commas', () => {
  const long = 'She walked past the mill, ' + 'past the long row of cottages with their shutters closed against the frost, '.repeat(4) + 'and on to the ford.';
  const items = speechItems(long);
  assert.ok(items.length > 1);
  assert.ok(items.every((i) => i.say.length <= 230));
  assert.equal(items[0].start, 0);
  assert.equal(items[items.length - 1].end, long.length);
});

test('where to start: the sentence at the cursor', () => {
  const items = speechItems('One here. Two here.\n\nThree.', 0).concat(speechItems('Four.', 1));
  assert.equal(itemAt(items, 0, 0), 0);
  assert.equal(itemAt(items, 0, 12), 1);
  assert.equal(itemAt(items, 1, 0), 3);
  assert.equal(itemAt(items, 5, 0), 0);
});

function fake() {
  const said: Utterance[] = [];
  let cancels = 0;
  const sp: Speaker = {
    make: (text) => ({ text, rate: 1, voice: null, onend: null, onerror: null }),
    speak: (u) => { said.push(u); },
    cancel: () => { cancels++; },
    voice: (id) => (id === 'v1' ? { name: 'Voice one' } : null)
  };
  return { sp, said, cancels: () => cancels };
}

test('the reader says one sentence after another, and stops at the end', () => {
  const f = fake();
  const states: string[] = [];
  const r = makeReader(f.sp, (s, i) => states.push(s + i), { rate: 1.2, voice: 'v1' });
  const items = speechItems('One. Two. Three.');
  r.play(items);
  assert.equal(f.said.length, 1);
  assert.equal(f.said[0].text, 'One.');
  assert.equal(f.said[0].rate, 1.2);
  assert.deepEqual(f.said[0].voice, { name: 'Voice one' });
  f.said[0].onend!();
  f.said[1].onend!();
  assert.equal(f.said[2].text, 'Three.');
  f.said[2].onend!();
  assert.deepEqual(r.state().state, 'idle');
  assert.deepEqual(states, ['playing0', 'playing1', 'playing2', 'idle0']);
});

test('pause cancels the sentence; resume says it again; a cancelled sentence\'s end is ignored', () => {
  const f = fake();
  const r = makeReader(f.sp, () => {}, { rate: 1, voice: '' });
  r.play(speechItems('One. Two. Three.'), 1);
  assert.equal(f.said[0].text, 'Two.');
  r.pause();
  f.said[0].onend!();
  assert.equal(r.state().state, 'paused');
  assert.equal(r.state().index, 1);
  r.resume();
  assert.equal(f.said[1].text, 'Two.');
  assert.equal(f.said[1].voice, null);
  r.setRate(1.4);
  assert.equal(f.said[2].rate, 1.4);
  f.said[1].onend!();
  assert.equal(r.state().index, 1, 'the end of the sentence said before the speed changed is ignored');
  r.jump(2);
  assert.equal(f.said[3].text, 'Three.');
  r.stop();
  assert.equal(r.state().state, 'idle');
  assert.ok(f.cancels() >= 4);
});

test('an error from the device stops with a sentence to say so; interruptions are not errors', () => {
  const f = fake();
  let err = '';
  const r = makeReader(f.sp, (_s, _i, e) => { if (e) err = e; }, { rate: 1, voice: '' });
  r.play(speechItems('One. Two.'));
  f.said[0].onerror!({ error: 'interrupted' });
  assert.equal(r.state().state, 'playing');
  f.said[0].onerror!({ error: 'synthesis-failed' });
  assert.equal(r.state().state, 'idle');
  assert.match(err, /synthesis-failed/);
});

test('voices: English first, by name', () => {
  const v = voiceChoices([{ voiceURI: 'b', name: 'Thomas', lang: 'fr-FR' }, { voiceURI: 'a', name: 'Samantha', lang: 'en-US' }, { voiceURI: 'c', name: 'Daniel', lang: 'en_GB' }]);
  assert.deepEqual(v.map((x) => x.id), ['c', 'a', 'b']);
  assert.equal(v[1].label, 'Samantha (en-US)');
});
