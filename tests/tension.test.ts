import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildIndex } from '../src/lib/vault-index.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { applyToText, editChange } from '../src/lib/ideas.ts';
import { confirmFields, referenceAt, scenePoints, scenePositions, smooth, storyScenes, storyShape, tensionIssues, tensionWarnings, type ScenePoint } from '../src/lib/tension.ts';
import type { NoteRecord } from '../src/lib/types.ts';
import { DEMO, FsSource } from './helpers.ts';

async function demo() {
  const src = new FsSource(DEMO);
  const schema = parseSchema(fs.readFileSync(path.join(DEMO, 'System/schema.json'), 'utf8'));
  const { files } = await src.tree();
  return buildIndex({ schema, files, read: (p) => src.read(p), phase: 6 });
}

const scene = (id: string, data: Record<string, unknown>, words = 0): NoteRecord =>
  ({ path: id + '.md', sha: '', type: 'scene', data: { type: 'scene', id, ...(words ? { words } : {}), ...data }, body: '', error: null });

const pts = (tensions: (number | null)[], outcomes: (string | null)[] = []): ScenePoint[] =>
  scenePoints(tensions.map((t, i) => scene('S-' + String(i + 1).padStart(3, '0'), { ...(t == null ? {} : { tension: t }), ...(outcomes[i] ? { outcome: outcomes[i] } : {}) })));

test('scenes sit by their words, and planned scenes count as the average drafted scene', () => {
  const s = scenePositions([scene('S-001', {}, 100), scene('S-002', {}, 300), scene('S-003', {})]);
  // S-003 counts as 200 words: 100 + 300 + 200 = 600.
  assert.deepEqual(s.map((x) => Math.round(x.start)), [0, 17, 67]);
  assert.equal(Math.round(s[2].end), 100);
  assert.deepEqual(scenePositions([scene('S-001', {}), scene('S-002', {})]).map((x) => x.mid), [25, 75]);
});

test('the reference curve rises, dips near 75% and peaks near 88%', () => {
  assert.ok(referenceAt(50) > referenceAt(10));
  assert.ok(referenceAt(75) < referenceAt(65));
  const peak = [...Array(101).keys()].reduce((b, x) => (referenceAt(x) > referenceAt(b) ? x : b), 0);
  assert.ok(peak >= 85 && peak <= 90, String(peak));
});

test('three scenes in a row that do not rise are flagged once, as one run', () => {
  const issues = tensionIssues(pts([2, 5, 5, 4, 3, 6, 9, 4]));
  const flat = issues.filter((i) => i.kind === 'flat');
  assert.equal(flat.length, 1);
  assert.deepEqual(flat[0].scenes, ['S-002', 'S-003', 'S-004', 'S-005']);
  assert.ok(!tensionIssues(pts([2, 3, 2, 4, 3, 5, 9, 4])).some((i) => i.kind === 'flat'));
});

test('a peak before 70% of the book is flagged; scenes with no tension are skipped', () => {
  const early = tensionIssues(pts([3, 9, 4, 5, 6, null, 7, 6, 5, 4]));
  assert.ok(early.some((i) => i.kind === 'early-peak' && i.scenes[0] === 'S-002'));
  assert.ok(!tensionIssues(pts([2, 3, 4, 5, 6, 7, 8, 9, 10, 4])).some((i) => i.kind === 'early-peak'));
});

test('more than 30% clean wins is flagged', () => {
  const wins = tensionIssues(pts([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ['yes', 'no', 'yes', 'no-and', 'yes', 'yes-but', 'yes', null, null, null]));
  const w = wins.find((i) => i.kind === 'wins');
  assert.ok(w);
  assert.match(w!.text, /^4 of 7 scenes \(57%\)/);
  assert.ok(!tensionIssues(pts([1, 2, 3, 4], ['yes', 'no', 'no', 'no-and'])).some((i) => i.kind === 'wins'));
});

test('the demo book: points with the team\'s guesses, and its warnings for the Overview', async () => {
  const index = await demo();
  const book = index.books[0];
  const points = scenePoints(storyScenes(index, book));
  assert.deepEqual(points.map((p) => p.tension), [3, 5, 4, 7, 6, 6, 9]);
  assert.equal(points[1].guess.tension, true);
  assert.equal(points[0].guess.tension, false);
  assert.equal(points[5].guess.outcome, true);
  const w = tensionWarnings(index, book.folder);
  assert.ok(w.some((x) => x.check === 'tension' && /do not rise/.test(x.text)));
  assert.ok(w.some((x) => /clean win/.test(x.text)));
  assert.ok(w.every((x) => x.href === '#/board/tension/' + encodeURIComponent(book.folder)));
  assert.deepEqual(tensionWarnings(index, 'nowhere'), []);
});

test('setting a value Kyle confirms takes it off card_draft, and numbers are written as numbers', () => {
  assert.deepEqual(confirmFields({ card_draft: ['tension', 'outcome'] }, { tension: '7' }), { tension: '7', card_draft: 'outcome' });
  assert.deepEqual(confirmFields({ card_draft: ['tension'] }, { tension: '7' }), { tension: '7', card_draft: '' });
  assert.deepEqual(confirmFields({}, { outcome: 'no' }), { outcome: 'no' });
  const text = '---\ntype: scene\nid: S-002\ntension: 5\noutcome: no-and\ncard_draft:\n  - tension\n  - outcome\nstatus: planned\n---\nBody\n';
  const out = applyToText(text, editChange(confirmFields({ card_draft: ['tension', 'outcome'] }, { tension: '8' })));
  assert.equal(out, '---\ntype: scene\nid: S-002\ntension: 8\noutcome: no-and\ncard_draft:\n  - outcome\nstatus: planned\n---\nBody\n');
  const both = applyToText(out, editChange(confirmFields({ card_draft: ['outcome'] }, { outcome: 'yes-but', mood: '-3' })));
  assert.equal(both, '---\ntype: scene\nid: S-002\ntension: 8\noutcome: yes-but\nstatus: planned\nmood: -3\n---\nBody\n');
});

test('story shape: a fall then a rise is a man in a hole; too few moods say nothing', () => {
  const moods = [3, 1, -2, -4, -3, 0, 2, 4];
  const points = scenePoints(moods.map((m, i) => scene('S-' + String(i + 1).padStart(3, '0'), { mood: m })));
  const shape = storyShape(points);
  assert.equal(shape[0].key, 'man-in-a-hole');
  assert.equal(shape.length, 6);
  const rise = storyShape(scenePoints([-4, -3, -1, 0, 2, 4].map((m, i) => scene('S-00' + (i + 1), { mood: m }))));
  assert.equal(rise[0].key, 'rags-to-riches');
  assert.deepEqual(storyShape(scenePoints([scene('S-001', { mood: 2 }), scene('S-002', { mood: -2 })])), []);
  assert.deepEqual(smooth([0, 3, 0]), [1.5, 1, 1.5]);
});
