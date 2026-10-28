import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyCard, nextStep, nextStepJob } from '../src/lib/nextstep.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import type { VaultIndex } from '../src/lib/types.ts';
import { BOOK, demoIndex, withNote } from './wr-helpers.ts';

const BOOK_MD = (stage: string) => '---\ntype: book\ntitle: Ash Bell\nseries: "[[Ember Road]]"\nnumber: 1\nstage: ' + stage + '\n---\n';

function atStage(index: VaultIndex, bookPath: string, stage: string): VaultIndex {
  return withNote(index, bookPath, BOOK_MD(stage));
}

function withJob(index: VaultIndex, id: string, target: string, status: string): VaultIndex {
  const path = 'Jobs/' + id + ' Next step.md';
  const text = '---\ntype: job\nid: ' + id + '\ntitle: Next step\nkind: next-step\ntarget: ' + target + '\nbook: ' + BOOK + '\nstatus: ' + status + '\n---\n## Ask\nx\n';
  return { ...index, notes: { ...index.notes, [path]: makeNote(path, 'x', text) }, jobs: (index.jobs || []).concat(path) };
}

test('in the draft stage the next step is the first planned scene', async () => {
  const { schema, index, book } = await demoIndex();
  const s = nextStep(schema, index, book);
  assert.equal(s.action, 'job');
  assert.equal(s.label, 'Draft S-002 The Ferry');
  assert.equal(s.target, 'draft S-002');
  assert.equal(s.busy, null);
  assert.match(s.why, /first scene in the book that still has no words/);
  const j = nextStepJob(index, book, s, 'Keep it short.');
  assert.equal(j.kind, 'next-step');
  assert.equal(j.title, 'Next step: Draft S-002 The Ferry');
  assert.equal(j.target, 'draft S-002');
  assert.equal(j.book, BOOK);
  assert.match(j.ask, /^Next step for Ash Bell \(stage: draft\): Draft S-002 The Ferry\./);
  assert.match(j.ask, /skills\/draft\/SKILL\.md/);
  assert.match(j.ask, /Stop at a gate.*wait for his yes/);
  assert.match(j.ask, /Kyle's words: Keep it short\.$/);
});

test('a step the team is already on is shown as busy, and a finished one moves on', async () => {
  const { schema, index, book } = await demoIndex();
  const busy = nextStep(schema, withJob(index, 'J-090', 'draft S-002', 'running'), book);
  assert.equal(busy.busy && busy.busy.data.id, 'J-090');
  const bible = atStage(index, book.path, 'bible');
  // Bible ideas (I-005, a character idea, among them) are waiting, so the step is Kyle's: decide them on the Ideas board.
  const decide = nextStep(schema, bible, book);
  assert.equal(decide.action, 'link');
  assert.equal(decide.href, '#/ideas/' + encodeURIComponent(BOOK));
  assert.match(decide.why, /^\d+ ideas? for the story bible (is|are) waiting/);
  let decided = bible;
  for (const p of Object.keys(bible.notes)) {
    const n = bible.notes[p];
    if (p.startsWith(BOOK + '/Ideas/') && n.data.status === 'inbox') {
      decided = withNote(decided, p, '---\ntype: idea\nid: ' + n.data.id + '\ntitle: ' + n.data.title + '\nkind: ' + n.data.kind + '\nstatus: keep\nsource: ' + n.data.source + '\n---\n');
    }
  }
  const develop = nextStep(schema, decided, book);
  assert.equal(develop.action, 'job');
  assert.equal(develop.target, 'develop');
  assert.match(develop.steps, /develop\/SKILL\.md/);
  const built = nextStep(schema, withJob(decided, 'J-091', 'develop', 'done'), book);
  assert.equal(built.action, 'stage');
  assert.equal(built.stage, 'outline');
  assert.equal(built.label, 'Move the book to outline');
});

test('each stage has its step', async () => {
  const { schema, index, book } = await demoIndex();
  const at = (stage: string) => nextStep(schema, atStage(index, book.path, stage), book);
  assert.equal(at('spark').target, 'premises');
  assert.equal(at('premise').label, 'Pitch premises');
  assert.equal(at('market').action, 'link', 'the demo series has a market case still in the inbox');
  assert.equal(at('outline').target, 'outline-notes', 'every planned card in the demo has something on it');
  const revise = at('revise');
  assert.equal(revise.target, 'notes Chapter 1');
  assert.equal(revise.label, 'Notes on chapter 1');
  assert.equal(at('polish').target, 'polish Chapter 1');
  assert.equal(at('publish').target, 'package');
  assert.equal(at('done').target, 'previously');
  const after = nextStep(schema, withJob(atStage(index, book.path, 'done'), 'J-092', 'previously', 'done'), book);
  assert.equal(after.action, 'link');
  assert.equal(after.href, '#/series/' + encodeURIComponent('Series/Ember Road'));
  assert.equal(at('someday').action, 'link');
});

test('revise asks for notes on each rough chapter, then for the revision of the first', async () => {
  const { schema, index, book } = await demoIndex();
  let idx = atStage(index, book.path, 'revise');
  idx = withJob(idx, 'J-093', 'notes Chapter 1', 'done');
  assert.equal(nextStep(schema, idx, book).target, 'notes Chapter 3', 'chapter 2 is final, so it needs no notes');
  idx = withJob(idx, 'J-094', 'notes Chapter 3', 'done');
  idx = withJob(idx, 'J-095', 'notes Chapter 4', 'done');
  const s = nextStep(schema, idx, book);
  assert.equal(s.target, 'revise Chapter 1');
  assert.match(s.steps, /revise\/SKILL\.md/);
});

test('an outline with empty cards asks the team to fill them', async () => {
  const { schema, index, book } = await demoIndex();
  const empty = '---\ntype: scene\nid: S-002\ntitle: The Ferry\nchapter: 1\norder: 2\nstatus: planned\n---\n';
  const idx = withNote(atStage(index, book.path, 'outline'), book.scenes.find((p) => p.indexOf('S-002') >= 0)!, empty);
  const s = nextStep(schema, idx, book);
  assert.equal(s.target, 'cards');
  assert.match(s.why, /^1 planned scene has an empty card/);
  assert.match(s.steps, /\(S-002\)/);
  assert.ok(emptyCard(idx.notes[book.scenes[1]]));
});

test('forging a specialist is a job with full steps and a gate', async () => {
  const { jobAsk, jobLabel, defaultJobTitle } = await import('../src/lib/jobs.ts');
  assert.equal(jobLabel('forge'), 'Forge a new specialist');
  assert.equal(jobLabel('next-step'), 'The next step');
  assert.equal(defaultJobTitle('forge', 'a beekeeper'), 'Forge a new specialist: a beekeeper');
  const ask = jobAsk('forge', 'a beekeeper', 'a beekeeper');
  assert.match(ask, /new specialist on the team: a beekeeper\./);
  assert.match(ask, /\.claude\/agents\/<name>\.md/);
  assert.match(ask, /source.*unverified/);
  assert.match(ask, /Stop at a gate.*after Kyle says yes/);
});

test('a drafted book with Edit room work points to the Edit room, not to the revise stage', async () => {
  const { schema, index, book } = await demoIndex();
  const notes = { ...index.notes };
  book.scenes.forEach((p) => { const n = notes[p]; if (n && String(n.data.status || 'planned') === 'planned') notes[p] = { ...n, data: { ...n.data, status: 'drafted' } }; });
  const s = nextStep(schema, { ...index, notes }, book);
  assert.equal(s.action, 'link');
  assert.match(s.href, /^#\/board\/(story-calls|changes)\//);
  assert.match(s.why, /Edit room/);
  assert.doesNotMatch(s.label, /Move the book/);
});
