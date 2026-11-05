import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseBuilds, setPicked } from '../src/lib/build.ts';
import { studyFolder } from '../src/lib/study.ts';

const NOTE = path.join(import.meta.dirname, '..', 'demo-vault', 'Studies', 'Builds', 'LitRPG', 'Premises.md');

test('the demo build has four premises and none picked', () => {
  const texts = new Map([['Studies/Builds/LitRPG/Premises.md', fs.readFileSync(NOTE, 'utf8')]]);
  const [b] = parseBuilds(texts);
  assert.equal(b.name, 'LitRPG');
  assert.equal(b.picked, '');
  assert.equal(b.premises.length, 4);
  assert.ok(b.premises.every((p) => p.lines.some(([k]) => k === 'Our turn')));
});

test('picking writes only the picked line, and picking again clears it', () => {
  const text = fs.readFileSync(NOTE, 'utf8');
  const once = setPicked(text, "Kyle's Pick");
  assert.match(once, /^picked: 'Kyle''s Pick'$/m);
  assert.equal(once.split('\n').length, text.split('\n').length);
  assert.equal(parseBuilds(new Map([['Studies/Builds/LitRPG/Premises.md', once]]))[0].picked, "Kyle's Pick");
  assert.equal(setPicked(once, ''), text);
  assert.match(setPicked('---\ntype: build-premises\n---\nbody', 'A'), /^type: build-premises\npicked: 'A'\n---/m);
});

test('a build is not a study', () => {
  assert.equal(studyFolder('Studies/Builds/LitRPG/Premises.md'), '');
});
