import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addPlanBeat, beatStart, beatsBody, blocks, deletedBeatPath, deletedBeatText, deletePlanBeat, movePlanBeat, newBeatsText, parseBeats, planBeats, planDefs,
  type BeatDef
} from '../src/lib/beats.ts';
import { makeNote } from '../src/lib/vault-index.ts';

const A = '\nReed had a theory about videos.\n\n"Nobody watches the first minute," he said.\n\n"Drama!"\n\nGrey had offered to help.\n\nReed zoomed in on his nose.\n';

const NOTE = `## Reed's theory
Reed says the first minute is a promise.

Starts: S-052 · Reed had a theory about videos.

### Notes
Maybe the tuxedo is borrowed.

Open on the table, not the field.

## Regrets
Grey regrets offering to help.

Starts: S-052 · Grey had offered to help.

## Blighted, with an ad
The soil is blighted, plus an ad.

Starts: S-053 · "Okay," Reed said. "The real thing."

## The wait
Starts: S-053
`;

test('a beats note reads back as titles, summaries, scenes, first words and Kyle\'s notes', () => {
  const d = parseBeats(NOTE);
  assert.equal(d.length, 4);
  assert.deepEqual(d[0], { title: "Reed's theory", summary: 'Reed says the first minute is a promise.', scene: 'S-052', words: 'Reed had a theory about videos.', notes: 'Maybe the tuxedo is borrowed.\n\nOpen on the table, not the field.' });
  assert.equal(d[1].notes, '');
  assert.equal(d[2].words, '"Okay," Reed said. "The real thing."');
  assert.deepEqual(d[3], { title: 'The wait', summary: '', scene: 'S-053', words: '', notes: '' });
  assert.deepEqual(parseBeats(beatsBody(d)), d);
});

test('notes that look like headings or Starts lines stay notes (Kyle, 2026-11-22: beats are for planning)', () => {
  const d: BeatDef[] = [{ title: 'One', summary: 'S.', scene: 'S-001', words: '', notes: '## not a beat\n### Notes\nStarts: S-009 · nope\n\\# kept' }, { title: 'Two', summary: '', scene: 'S-001', words: '', notes: '' }];
  const body = beatsBody(d);
  const back = parseBeats(body);
  assert.equal(back.length, 2);
  assert.deepEqual(back, d);
  assert.match(body, /### Notes\n\\## not a beat\n\\### Notes\nStarts: S-009 · nope\n\\\\# kept/);
});

test('notes are kept tidy: no blank lines at the ends, no spaces at line ends', () => {
  const body = beatsBody([{ title: 'T', summary: '', scene: 'S-001', words: '', notes: '\n\n  first  \n\nsecond\n\n' }]);
  assert.equal(parseBeats(body)[0].notes, '  first\n\nsecond');
  assert.equal(beatsBody([{ title: 'T', summary: '', scene: 'S-001', words: '', notes: '  \n ' }]), '\n## T\n\nStarts: S-001\n');
});

test('adding, moving and deleting beats changes only the list, never a scene', () => {
  const beats = planBeats(parseBeats(NOTE));
  const [theory, regrets, blighted, wait] = beats.map((b) => b.key);
  const added = addPlanBeat(beats, theory, 'New beat', 'S-099');
  assert.equal(added[1].title, 'New beat');
  assert.equal(added[1].scene, 'S-052');
  const end = addPlanBeat(beats, null, '', 'S-099');
  assert.equal(end.at(-1)!.scene, 'S-053');
  assert.equal(addPlanBeat([], null, '', 'S-099')[0].scene, 'S-099');
  // Up within its scene: keeps its Starts words.
  const up = movePlanBeat(beats, regrets, theory);
  assert.deepEqual(up.map((b) => b.title), ['Regrets', "Reed's theory", 'Blighted, with an ad', 'The wait']);
  assert.equal(up[0].words, 'Grey had offered to help.');
  // Down into the next scene: takes that scene, and its Starts words go (they name the other scene's prose).
  const down = movePlanBeat(beats, regrets, wait);
  assert.equal(down[2].title, 'Regrets');
  assert.equal(down[2].scene, 'S-053');
  assert.equal(down[2].words, '');
  assert.equal(movePlanBeat(beats, theory, null).at(-1)!.key, theory);
  assert.equal(movePlanBeat(beats, blighted, wait), beats);
  assert.equal(deletePlanBeat(beats, regrets).length, 3);
  // The notes go with the beat wherever it moves.
  assert.equal(parseBeats(beatsBody(planDefs(movePlanBeat(beats, theory, null)))).at(-1)!.notes, 'Maybe the tuxedo is borrowed.\n\nOpen on the table, not the field.');
});

test('beatStart finds the paragraph a beat opens, and -1 when its words are gone', () => {
  const at = beatStart(A, '“Nobody watches the first minute,” he said.');
  assert.equal(A.slice(at, at + 8), '"Nobody ');
  assert.equal(beatStart(A, 'Words that are not here'), -1);
  assert.equal(beatStart(A, ''), -1);
  assert.equal(blocks('\n\na\nb\n\n\nc').length, 2);
});

test('a new beats note follows the schema', () => {
  const n = makeNote('x.md', '', newBeatsText(31, parseBeats(NOTE)));
  assert.equal(n.type, 'chapter-beats');
  assert.equal(n.data.chapter, 31);
  assert.equal(n.data.title, 'Chapter 31 beats');
  assert.equal(parseBeats(n.body).length, 4);
});

test('a deleted beat\'s archived copy keeps its summary and notes', () => {
  const b = parseBeats(NOTE)[0];
  const now = new Date(2026, 9, 22, 9, 5, 7);
  assert.equal(deletedBeatPath('B', 3, 2, 'Reed\'s theory: part #1', now), 'B/Archive/Deleted beats/Chapter 3 beat 2 Reed\'s theory part 1 2026-10-22 090507.md');
  const text = deletedBeatText(b, 3, 2, now);
  assert.match(text, /deleted in the Sparrow app/);
  assert.match(text, /## Reed's theory\nReed says the first minute is a promise\.\n\n### Notes\nMaybe the tuxedo is borrowed\.\n\nOpen on the table/);
});
