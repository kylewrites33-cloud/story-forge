import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildLibrary, driveGrid, fieldLines, findFace, parseBeat, parseOthers, players, scenesOf, splitMoment, studyFolder, tally, initials, valueShift } from '../src/lib/study.ts';
import type { FileEntry } from '../src/lib/types.ts';

const DEMO = path.join(import.meta.dirname, '..', 'demo-vault');

function demoStudies() {
  const files: FileEntry[] = [];
  const texts = new Map<string, string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(DEMO, dir), { withFileTypes: true })) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) walk(rel);
      else { files.push({ path: rel, sha: rel }); if (rel.endsWith('.md')) texts.set(rel, fs.readFileSync(path.join(DEMO, rel), 'utf8')); }
    }
  };
  walk('Studies');
  return { files, texts };
}

test('the demo study reads into cards, scenes and lenses', () => {
  const { files, texts } = demoStudies();
  const lib = buildLibrary(files, texts);
  assert.deepEqual(lib.problems, []);
  const s = lib.studies[0];
  assert.equal(s.title, 'The Lantern Fair');
  assert.deepEqual(s.characters.map((c) => c.name), ['Wren', 'Oskar']);
  assert.deepEqual(s.scenes.map((x) => x.id), ['SC-001', 'SC-002']);
  const wren = s.characters[0];
  assert.equal(wren.facts.length, 5);
  assert.deepEqual(wren.readings['Save the Cat'][1], ['Want', 'one score big enough to leave the city']);
  assert.match(wren.notes, /Save the Cat best/);
  const two = s.scenes[1];
  assert.equal(two.plot.link, 'therefore');
  assert.equal(two.plot.bestLens, 'Therefore or But');
  assert.deepEqual(two.plot.readings['Value Shift'].map(([k]) => k), ['Value', 'From', 'To']);
  assert.equal(two.cast[1].holds, 'partly');
  assert.ok(s.sections['Plot structure'].includes('therefore'));
  assert.ok(lib.lenses.some((l) => l.side === 'plot') && lib.lenses[0].side === 'character');
});

test('tallies count the best lens per scene', () => {
  const { files, texts } = demoStudies();
  const s = buildLibrary(files, texts).studies[0];
  assert.deepEqual(tally(s, 'Wren'), [{ lens: 'Save the Cat', best: 2 }]);
  assert.deepEqual(tally(s, '').map((t) => t.lens), ['Therefore or But', 'Value Shift']);
  assert.equal(scenesOf(s, 'Oskar').length, 2);
});

test('field lines, moments and faces', () => {
  assert.deepEqual(fieldLines('- Flaw: proud\n- "Mine." no field\nnot a line'), [['Flaw', 'proud'], ['', '"Mine." no field']]);
  assert.deepEqual(splitMoment('"Mine, mine." Counts her takings.'), { quote: 'Mine, mine.', note: 'Counts her takings.' });
  assert.deepEqual(splitMoment('Skips a purse.'), { quote: '', note: 'Skips a purse.' });
  assert.equal(studyFolder('Studies/Konosuba/Scenes/SC-001 A.md'), 'Studies/Konosuba');
  assert.equal(studyFolder('Studies/Lenses/Value Shift.md'), '');
  const face = findFace([{ path: 'Studies/K/Faces/Aqua.PNG', sha: 'x' }], 'Studies/K', 'Aqua');
  assert.equal(face && face.sha, 'x');
  assert.equal(initials('Kazuma Satou'), 'KS');
});

test('beats, retelling, roles and others stay out of the lens readings', () => {
  const { files, texts } = demoStudies();
  const s = buildLibrary(files, texts).studies[0];
  const one = s.scenes[0];
  assert.equal(one.plot.readings['Beats'], undefined);
  assert.equal(one.plot.readings['Retelling'], undefined);
  assert.equal(one.plot.beats.length, 5);
  assert.deepEqual(one.plot.beats[2], { who: 'Wren', kind: 'choice', turning: true, text: "She lifts a merchant's purse and hides it in her hollow lantern." });
  assert.match(one.plot.retelling, /^Wren walks the lantern fair/);
  assert.deepEqual(players(one).map((p) => p.name + ':' + p.role), ['Wren:driver', 'Oskar:receives', 'The crowd:supports', 'The guard:opposes']);
  assert.deepEqual(valueShift(one), { value: 'safety', from: 'unseen', to: 'seen by a guard' });
  const grid = driveGrid(s);
  assert.deepEqual(grid.slice(0, 2).map((r) => [r.name, r.beats, r.turning]), [['Wren', 4, 1], ['Oskar', 2, 1]]);
  assert.deepEqual(grid[1].cells.map((c) => c.role), ['receives', 'supports']);
});

test('beat and others lines', () => {
  assert.deepEqual(parseBeat('The angel (world rule): An angel takes over.'), { who: 'The angel', kind: 'world rule', turning: false, text: 'An angel takes over.' });
  assert.deepEqual(parseBeat('Kazuma (choice, turning): He picks her.'), { who: 'Kazuma', kind: 'choice', turning: true, text: 'He picks her.' });
  assert.deepEqual(parseBeat('Aqua: She laughs.'), { who: 'Aqua', kind: '', turning: false, text: 'She laughs.' });
  assert.deepEqual(parseOthers('The world (opposes), Luna (supports, at the desk)'), [
    { name: 'The world', role: 'opposes', carded: false }, { name: 'Luna', role: 'supports', carded: false }
  ]);
  assert.deepEqual(parseOthers('none'), []);
});
