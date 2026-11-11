import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFor, readDraft, savedDrafts, workingNumber } from '../src/lib/bookdrafts.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { draftAction } from '../src/vault/ops.ts';
import { pushAction } from '../src/vault/push.ts';
import { MemSource } from './helpers.ts';

const B = 'Series/S/Books/1 B';

test('saved drafts are read from the file list, and the scene files are the next draft', () => {
  const files = [
    { path: B + '/Drafts/Draft 1.md', sha: 'n1' },
    { path: B + '/Drafts/Draft 1/S-001 Opening.md', sha: 'a' },
    { path: B + '/Drafts/Draft 1/S-002 Barn.md', sha: 'b' },
    { path: B + '/Drafts/Draft 1/deeper/x.md', sha: 'c' },
    { path: B + '/Scenes/S-001 Opening.md', sha: 'd' }
  ];
  const d = savedDrafts(files, B);
  assert.equal(d.length, 1);
  assert.equal(d[0].number, 1);
  assert.equal(d[0].files.length, 2);
  assert.equal(workingNumber(d), 2);
  assert.equal(workingNumber([]), 1);
  assert.equal(copyFor(d[0], { path: B + '/Scenes/S-001 Opening.md', data: { id: 'S-001' } })!.sha, 'a');
  assert.equal(copyFor(d[0], { path: B + '/Scenes/S-002 Barn at night.md', data: { id: 'S-002' } })!.sha, 'b');
  assert.equal(copyFor(d[0], { path: B + '/Scenes/S-003 New.md', data: { id: 'S-003' } }), null);
});

test('saving a draft copies every scene exactly, in one save, with its note', async () => {
  const raw1 = Frontmatter.join({ type: 'scene', id: 'S-001', title: 'Opening' }, '\nHe walked in.\n');
  const raw2 = Frontmatter.join({ type: 'scene', id: 'S-002', title: 'Barn' }, '\nThe cart tipped over.\n');
  const source = new MemSource();
  [[B + '/Book.md', Frontmatter.join({ type: 'book', title: 'B' }, '\n')], [B + '/Scenes/S-001 Opening.md', raw1], [B + '/Scenes/S-002 Barn.md', raw2], [B + '/Drafts/Draft 1/S-001 Opening.md', raw1]]
    .forEach(([p, text]) => source.files.set(p, text));
  const scenes = [makeNote(B + '/Scenes/S-001 Opening.md', 'a', raw1), makeNote(B + '/Scenes/S-002 Barn.md', 'b', raw2)];
  await pushAction(source, draftAction(B, '', new Date('2026-10-24T15:00:00Z')));
  assert.equal(source.commits.length, 1);
  assert.deepEqual(source.commits[0].paths.slice().sort(), [B + '/Drafts/Draft 2/S-001 Opening.md', B + '/Drafts/Draft 2/S-002 Barn.md', B + '/Drafts/Draft 2.md'].sort());
  assert.equal(source.files.get(B + '/Drafts/Draft 2/S-002 Barn.md'), raw2);
  const note = makeNote('n', 'n', source.files.get(B + '/Drafts/Draft 2.md')!);
  assert.equal(note.data.type, 'draft');
  assert.equal(note.data.number, 2);
  assert.equal(note.data.scenes, 2);
  assert.equal(note.data.words, 7);
  assert.match(source.commits[0].message, /^drafts: save Draft 2 of 1 B \(2 scenes\)/);
  const d = savedDrafts((await source.tree()).files, B).find((x) => x.number === 2)!;
  const back = await readDraft(source, d, scenes, makeNote);
  assert.deepEqual(back.map((n) => n.body), scenes.map((n) => n.body));
});
