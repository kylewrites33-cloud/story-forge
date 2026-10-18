import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addBeatAfter, anchorOf, beatDefs, beatsBody, blocks, layoutChapter, newBeatsText, parseBeats, removeBeat, sceneBody, type BeatDef
} from '../src/lib/beats.ts';
import { makeNote } from '../src/lib/vault-index.ts';

const A = '\nReed had a theory about videos.\n\n"Nobody watches the first minute," he said.\n\n"Drama!"\n\nGrey had offered to help.\n\nReed zoomed in on his nose.\n';
const B = '\n"Okay," Reed said. "The real thing."\n\n> **[Inspect: Soil]**\n> Condition: Blighted\n\n"Is that an ad?"\n';
const scenes = [{ path: 'S/S-052 A.md', id: 'S-052', body: A }, { path: 'S/S-053 B.md', id: 'S-053', body: B }];

const NOTE = `## Reed's theory
Reed says the first minute is a promise.

Starts: S-052 · Reed had a theory about videos.

## Regrets
Grey regrets offering to help.

Starts: S-052 · Grey had offered to help.

## Blighted, with an ad
The soil is blighted, plus an ad.

Starts: S-053 · "Okay," Reed said. "The real thing."

## The wait
Starts: S-053
`;

test('a beats note reads back as titles, summaries, scenes and first words', () => {
  const d = parseBeats(NOTE);
  assert.equal(d.length, 4);
  assert.deepEqual(d[0], { title: "Reed's theory", summary: 'Reed says the first minute is a promise.', scene: 'S-052', words: 'Reed had a theory about videos.' });
  assert.equal(d[2].words, '"Okay," Reed said. "The real thing."');
  assert.deepEqual(d[3], { title: 'The wait', summary: '', scene: 'S-053', words: '' });
  assert.deepEqual(parseBeats(beatsBody(d)), d);
});

test('the chapter lays out under its beats and every paragraph lands once, in order', () => {
  const { beats, scenes: shapes } = layoutChapter(scenes, parseBeats(NOTE));
  assert.deepEqual(beats.map((b) => b.title), ["Reed's theory", 'Regrets', 'Blighted, with an ad', 'The wait']);
  assert.equal(beats[0].prose, 'Reed had a theory about videos.\n\n"Nobody watches the first minute," he said.\n\n"Drama!"');
  assert.equal(beats[1].prose, 'Grey had offered to help.\n\nReed zoomed in on his nose.');
  assert.ok(beats[2].prose.endsWith('"Is that an ad?"'));
  assert.equal(beats[3].prose, '');
  // Nothing changed: each scene goes back together exactly.
  assert.equal(sceneBody(shapes[0], beats), A);
  assert.equal(sceneBody(shapes[1], beats), B);
});

test('prose before a scene\'s first beat shows without a heading, and a chapter with no beats is one piece per scene', () => {
  const none = layoutChapter(scenes, []);
  assert.equal(none.beats.length, 2);
  assert.ok(none.beats.every((b) => b.loose));
  const late = layoutChapter(scenes, [{ title: 'Regrets', summary: '', scene: 'S-052', words: 'Grey had offered' }]);
  assert.equal(late.beats[0].loose, true);
  assert.ok(late.beats[0].prose.endsWith('"Drama!"'));
  assert.equal(late.beats[1].title, 'Regrets');
  assert.equal(beatDefs(late.beats).length, 1);
});

test('editing a beat\'s first words moves its anchor; the scene is rebuilt from the beats', () => {
  const { beats, scenes: shapes } = layoutChapter(scenes, parseBeats(NOTE));
  const edited = beats.map((b, i) => (i === 1 ? { ...b, prose: 'Grey regretted it at once.\n\nReed zoomed in on his nose.' } : b));
  const body = sceneBody(shapes[0], edited);
  assert.ok(body.includes('"Drama!"\n\nGrey regretted it at once.\n\nReed zoomed'));
  const defs = beatDefs(edited);
  assert.equal(defs[1].words, 'Grey regretted it at once.');
  // Laid out again from the new body and anchors, the beats come out the same.
  const again = layoutChapter([{ ...scenes[0], body }, scenes[1]], defs);
  assert.equal(again.beats[1].prose, 'Grey regretted it at once.\n\nReed zoomed in on his nose.');
});

test('a beat whose first words changed elsewhere is lost, and its prose stays in the beat above', () => {
  const changed = A.replace('Grey had offered to help.', 'Grey wished he had not offered.');
  const { beats, scenes: shapes } = layoutChapter([{ ...scenes[0], body: changed }, scenes[1]], parseBeats(NOTE));
  assert.equal(beats[1].lost, true);
  assert.equal(beats[1].prose, '');
  assert.ok(beats[0].prose.includes('Grey wished'));
  assert.equal(sceneBody(shapes[0], beats), changed);
  assert.equal(beatDefs(beats)[1].words, 'Grey had offered to help.');
});

test('typing into an empty beat puts its prose there; removing a heading joins the beat above', () => {
  const { beats, scenes: shapes } = layoutChapter(scenes, parseBeats(NOTE));
  const typed = beats.map((b, i) => (i === 3 ? { ...b, prose: 'They waited.' } : b));
  assert.ok(sceneBody(shapes[1], typed).endsWith('"Is that an ad?"\n\nThey waited.\n'));
  const joined = removeBeat(beats, beats[1].key);
  assert.equal(joined.length, 3);
  assert.ok(joined[0].prose.endsWith('Reed zoomed in on his nose.'));
  assert.equal(sceneBody(shapes[0], joined), A);
  const first = removeBeat(beats, beats[2].key);
  assert.equal(first[2].loose, true);
  const added = addBeatAfter(beats, beats[0].key, 'New beat');
  assert.equal(added[1].title, 'New beat');
  assert.equal(added[1].scene, 'S-052');
});

test('a planned scene with no prose takes a beat\'s first words', () => {
  const shapes = layoutChapter([{ path: 'p.md', id: 'S-060', body: '' }], [{ title: 'Open', summary: 'x', scene: 'S-060', words: '' }]);
  const typed = shapes.beats.map((b) => ({ ...b, prose: 'First line.' }));
  assert.equal(sceneBody(shapes.scenes[0], typed), '\nFirst line.\n');
});

test('anchors skip Markdown marks and match curly or straight quotes', () => {
  assert.equal(anchorOf('> **[Inspect: Soil]**\n> It\'s dirt.'), "[Inspect: Soil] It's dirt.");
  const d: BeatDef[] = [{ title: 'x', summary: '', scene: 'S-001', words: '“Hello,” she said' }];
  const r = layoutChapter([{ path: 'a', id: 'S-001', body: '\nFirst.\n\n"Hello," she *said*.\n' }], d);
  assert.equal(r.beats[1].prose, '"Hello," she *said*.');
  assert.equal(blocks('\n\na\nb\n\n\nc').length, 2);
});

test('a new beats note follows the schema', () => {
  const n = makeNote('x.md', '', newBeatsText(31, parseBeats(NOTE)));
  assert.equal(n.type, 'chapter-beats');
  assert.equal(n.data.chapter, 31);
  assert.equal(n.data.title, 'Chapter 31 beats');
  assert.equal(parseBeats(n.body).length, 4);
});
