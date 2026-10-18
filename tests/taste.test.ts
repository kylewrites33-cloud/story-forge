import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { applyToData, applyToText, commitMessage, editChange, filterIdeas, ideaTarget, ratingOf, reasonsFor, reasonsOf, toggleReason, valueCounts } from '../src/lib/ideas.ts';
import { defaultJobTitle, jobAsk, jobLabel, jobText } from '../src/lib/jobs.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { PHASE } from '../src/lib/sync.ts';
import { percent, tasteIdeas, tasteStats, withoutProperties } from '../src/lib/taste.ts';
import { buildIndex, makeNote } from '../src/lib/vault-index.ts';
import { enqueue, overlay, type Choice } from '../src/lib/write-queue.ts';
import { DEMO, demoSchemaText, FsSource } from './helpers.ts';

const schema = parseSchema(demoSchemaText());
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';

const IDEA = [
  '---',
  'type: idea',
  'id: I-020',
  'title: The Bell Sleeps',
  'kind: world',
  'status: keep',
  'source: Genre Specialist',
  'created: 2026-10-17',
  '---',
  '',
  '## The idea',
  ''
].join('\n');

async function demo() {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  const index = await buildIndex({ schema, files, read: (p, sha) => src.read(p, sha), phase: PHASE });
  return { index, book: index.books.find((b) => b.folder === BOOK)! };
}

test('the reasons offered follow the choice, and none for a rewrite', () => {
  assert.deepEqual(reasonsFor('keep').map((r) => r.label), ['Love it', 'Surprising', 'Specific', 'Raises the stakes']);
  assert.deepEqual(reasonsFor('later').map((r) => r.key), ['not-now', 'needs-work', 'could-combine']);
  assert.deepEqual(reasonsFor('drop').map((r) => r.key), ['cliche', 'wrong-tone', 'already-have', 'too-clever']);
  assert.deepEqual(reasonsFor('regenerate'), []);
  // Every reason is a value the schema allows.
  const allowed = schema.types.idea.properties!.reasons.items!.enum as string[];
  ['keep', 'later', 'drop'].forEach((d) => reasonsFor(d as 'keep').forEach((r) => assert.ok(allowed.includes(r.key), r.key)));
});

test('pressing a reason turns it on or off, in the order the buttons show', () => {
  assert.deepEqual(toggleReason([], 'specific'), ['specific']);
  assert.deepEqual(toggleReason(['specific'], 'love-it'), ['love-it', 'specific']);
  assert.deepEqual(toggleReason(['love-it', 'specific'], 'love-it'), ['specific']);
});

test('reasons are written as a list and stars as a number, touching only their own lines', () => {
  const withReasons = applyToText(IDEA, editChange({ reasons: 'love-it, raises-stakes' }));
  assert.match(withReasons, /\nreasons:\n {2}- love-it\n {2}- raises-stakes\n---/);
  const rated = applyToText(withReasons, editChange({ rating: '4' }));
  assert.match(rated, /\nrating: 4\n/);
  const data = Frontmatter.parse(rated).data;
  assert.equal(data.rating, 4);
  assert.deepEqual(data.reasons, ['love-it', 'raises-stakes']);
  assert.equal(rated.replace(/reasons:\n(?: {2}- .*\n)+/, '').replace('rating: 4\n', ''), IDEA);
  // Taking them all off removes the lines.
  const cleared = applyToText(applyToText(rated, editChange({ reasons: '' })), editChange({ rating: '' }));
  assert.equal(cleared, IDEA);
  // Shown before GitHub has it, the same way.
  const shown = applyToData(Frontmatter.parse(IDEA).data, editChange({ rating: '5', reasons: 'specific' }));
  assert.equal(shown.rating, 5);
  assert.deepEqual(shown.reasons, ['specific']);
  assert.equal(ratingOf(shown), 5);
  assert.deepEqual(reasonsOf(shown), ['specific']);
});

test('a keep and then its reasons wait side by side in the queue', () => {
  const note = makeNote(BOOK + '/Ideas/I-020 The Bell Sleeps.md', 'abc', IDEA.replace('status: keep', 'status: inbox'));
  const index = { notes: { [note.path]: note } } as never;
  let q: Choice[] = enqueue([], { path: note.path, decision: 'keep', reason: '', at: '2026-10-18T10:00:00Z' });
  q = enqueue(q, { path: note.path, decision: 'edit', reason: '', at: '2026-10-18T10:00:01Z', fields: { reasons: 'love-it' } });
  q = enqueue(q, { path: note.path, decision: 'edit', reason: '', at: '2026-10-18T10:00:02Z', fields: { rating: '3' } });
  assert.equal(q.length, 2);
  const shown = (overlay(index, q) as { notes: Record<string, { data: Record<string, unknown> }> }).notes[note.path].data;
  assert.equal(shown.status, 'keep');
  assert.deepEqual(shown.reasons, ['love-it']);
  assert.equal(shown.rating, 3);
});

test('reasons and stars commit with plain messages and no Agent trailer', () => {
  const d = Frontmatter.parse(IDEA).data;
  assert.equal(commitMessage(d, 'edit', { reasons: 'love-it' }).split('\n')[0], 'ideas: reasons I-020 The Bell Sleeps');
  assert.equal(commitMessage(d, 'edit', { rating: '4' }).split('\n')[0], 'ideas: rate 4 stars I-020 The Bell Sleeps');
  assert.equal(commitMessage(d, 'edit', { rating: '' }).split('\n')[0], 'ideas: clear stars I-020 The Bell Sleeps');
  assert.doesNotMatch(commitMessage(d, 'edit', { rating: '4' }), /Agent:/);
});

test('ideas filter by who proposed them and by kind', async () => {
  const { index, book } = await demo();
  const notes = book.ideas!.map((p) => index.notes[p]);
  const sources = valueCounts(notes, 'source');
  assert.ok(sources.length > 3);
  assert.ok(sources[0].count >= sources[sources.length - 1].count);
  const contrarian = filterIdeas(notes, { source: 'Contrarian', kind: '' });
  assert.ok(contrarian.length > 0 && contrarian.every((n) => n.data.source === 'Contrarian'));
  const worlds = filterIdeas(notes, { source: '', kind: 'world' });
  assert.ok(worlds.length > 0 && worlds.every((n) => n.data.kind === 'world'));
  assert.equal(filterIdeas(notes, { source: '', kind: '' }).length, notes.length);
  assert.equal(filterIdeas(notes, { source: 'Contrarian', kind: 'title' }).length, 0);
});

test('combine and variations jobs name the ticked ideas in ID order', () => {
  const a = makeNote('a.md', '1', IDEA.replace('I-020', 'I-012'));
  const b = makeNote('b.md', '2', IDEA.replace('I-020', 'I-003'));
  const target = ideaTarget([a, b]);
  assert.equal(target, 'I-003, I-012');
  assert.equal(defaultJobTitle('combine', target), 'Combine I-003, I-012');
  assert.equal(defaultJobTitle('variations', 'I-004', 'A Title Without Ash'), 'Variations on I-004 A Title Without Ash');
  assert.match(jobAsk('combine', target, ''), /I-003, I-012.*inbox idea.*Never change the ideas it came from/s);
  assert.match(jobAsk('variations', 'I-004', ''), /three takes.*Never change the original/s);
  assert.match(jobAsk('learn-taste', '', ''), /Taste Profile\.md.*learn-taste\/SKILL\.md.*reasons/s);
  assert.equal(jobLabel('learn-taste'), 'Update my taste');
  const text = jobText('J-009', { title: 'Combine I-003, I-012', kind: 'combine', target, book: BOOK, ask: jobAsk('combine', target, '') }, new Date('2026-10-18T12:00:00'));
  const data = Frontmatter.parse(text).data;
  assert.equal(data.kind, 'combine');
  assert.equal(data.target, 'I-003, I-012');
  const kinds = schema.types.job.properties!.kind.enum as string[];
  ['combine', 'variations', 'learn-taste'].forEach((k) => assert.ok(kinds.includes(k), k));
});

test('the Taste page counts keeps and drops by kind, agent and round, and the top reasons', async () => {
  const { index, book } = await demo();
  const s = tasteStats(tasteIdeas(index, [book]));
  assert.equal(s.ideas, book.ideas!.length);
  assert.equal(s.kept + s.later + s.dropped <= s.ideas, true);
  const contrarian = s.bySource.find((r) => r.key === 'Contrarian')!;
  assert.equal(contrarian.kept, 0);
  assert.ok(contrarian.dropped >= 3);
  assert.equal(contrarian.keepRate, 0);
  assert.deepEqual(s.byRound.map((r) => r.key), ['1', '2', '3']);
  assert.equal(s.byRound[0].keepRate, 1);
  assert.ok(s.reasons.length <= 12);
  assert.equal(s.reasons[0].key, 'love-it');
  assert.equal(s.reasons[0].label, 'Love it');
  assert.ok(s.byKind.some((r) => r.key === 'twist' && r.dropped === 2));
  assert.equal(percent(2 / 3), '67%');
  assert.equal(percent(null), '–');
  assert.equal(tasteStats([]).byKind.length, 0);
});

test('a taste note shows without its properties', () => {
  assert.equal(withoutProperties('---\ntype: system-doc\ntitle: Taste Profile\n---\n# Taste Profile\n'), '# Taste Profile\n');
  assert.equal(withoutProperties('# No properties\n'), '# No properties\n');
});
