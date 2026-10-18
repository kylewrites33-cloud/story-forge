import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildIndex } from '../src/lib/vault-index.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { applyToText, commitMessage, editChange } from '../src/lib/ideas.ts';
import { arcEdit, arcIssue, arcWarnings, bookArcs, parseArcPoints, pointsLine, removePoint, setPoint, type Arc } from '../src/lib/arcs.ts';
import { DEMO, FsSource } from './helpers.ts';

async function demo() {
  const src = new FsSource(DEMO);
  const schema = parseSchema(fs.readFileSync(path.join(DEMO, 'System/schema.json'), 'utf8'));
  const { files } = await src.tree();
  return buildIndex({ schema, files, read: (p) => src.read(p), phase: 6 });
}

test('arc points read "S-012: 4" lines, clamp to 0..10 and skip anything else', () => {
  assert.deepEqual(parseArcPoints(['S-001: 2', 's-003:12', 'nonsense', 'S-005: -1', 'S-001: 4']), [{ id: 'S-001', value: 4 }, { id: 'S-003', value: 10 }, { id: 'S-005', value: 0 }]);
  assert.deepEqual(parseArcPoints('S-001: 2, S-002: 3'), [{ id: 'S-001', value: 2 }, { id: 'S-002', value: 3 }]);
  assert.deepEqual(parseArcPoints(null), []);
});

test('setting and removing points keeps reading order', () => {
  const ids = ['S-001', 'S-002', 'S-003'];
  let p = setPoint([{ id: 'S-003', value: 5 }], 'S-001', 2.4, ids);
  assert.equal(pointsLine(p), 'S-001: 2, S-003: 5');
  p = setPoint(p, 'S-003', 11, ids);
  assert.equal(pointsLine(p), 'S-001: 2, S-003: 10');
  assert.equal(pointsLine(removePoint(p, 'S-001')), 'S-003: 10');
});

const arc = (type: Arc['type'], values: number[]): Arc => ({
  name: 'Mara', type, lie: '', truth: '', points: values.map((v, i) => ({ id: 'S-00' + (i + 1), value: v })), draft: false, color: '',
  holder: null as never, draftNote: null, note: null as never
});

test('an arc that runs the wrong way for its type is flagged', () => {
  assert.match(arcIssue(arc('positive', [3, 6, 2])), /positive but ends lower \(2\) than it began \(3\)/);
  assert.equal(arcIssue(arc('positive', [3, 1, 8])), '');
  assert.match(arcIssue(arc('negative', [6, 2, 7])), /fall but ends higher/);
  assert.match(arcIssue(arc('flat', [5, 1, 6])), /flat but moves 5 points/);
  assert.equal(arcIssue(arc('flat', [5, 4, 7])), '');
  assert.equal(arcIssue(arc('positive', [5])), '');
});

test('the demo book: Mara\'s points come from her book delta and are the team\'s guess; Tobin\'s flat arc moves too much', async () => {
  const index = await demo();
  const book = index.books[0];
  const arcs = bookArcs(index, book);
  assert.deepEqual(arcs.map((a) => a.name), ['Mara Quill', 'Tobin Quill']);
  const mara = arcs[0];
  assert.equal(mara.type, 'positive');
  assert.equal(mara.draft, true);
  assert.match(mara.holder.path, /Books\/1 Ash Bell\/Characters\/Mara Quill\.md$/);
  assert.match(mara.lie, /cracked the bell/);
  assert.deepEqual(mara.points.map((p) => p.value), [2, 3, 1, 8]);
  const w = arcWarnings(index, book.folder);
  assert.equal(w.length, 1);
  assert.match(w[0].text, /^Tobin Quill's arc is flat/);
  // Kyle drags a point: the points change and arc_draft goes.
  const edits = arcEdit(mara, setPoint(mara.points, 'S-005', 4, book.scenes.map((p) => String(index.notes[p].data.id))));
  assert.deepEqual(edits, [{ path: mara.holder.path, fields: { arc_points: 'S-001: 2, S-003: 3, S-005: 4, S-008: 8', arc_draft: '' } }]);
  const text = fs.readFileSync(path.join(DEMO, mara.holder.path), 'utf8');
  const out = applyToText(text, editChange(edits[0].fields));
  assert.match(out, /arc_points:\n {2}- "S-001: 2"\n {2}- "S-003: 3"\n {2}- "S-005: 4"\n {2}- "S-008: 8"\n/);
  assert.ok(!/arc_draft/.test(out));
  assert.match(commitMessage({ type: 'character', name: 'Mara Quill' }, 'edit'), /^characters: edit /);
});
