import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookNumbers, chaptersDone, bookStage, bookStages, finishedJobs, loadSeenJobs, markJobsSeen, openQuestions, runway, waitingOnKyle } from '../src/lib/overview.ts';
import { BOOK, demoIndex, MemStorage, withNote } from './wr-helpers.ts';

test('the demo book\'s numbers: words against its target and scenes per status', async () => {
  const { schema, index, book } = await demoIndex();
  const n = bookNumbers(schema, index, book);
  assert.equal(n.target, 3000);
  assert.equal(n.words, 61);
  assert.equal(n.chapters, 4);
  assert.equal(n.chaptersDone, 1, 'chapter 2 has both scenes final; chapter 1 still has a planned scene');
  assert.equal(n.doneWords, 0, 'chapter 1\'s 61 words wait until the whole chapter is done');
  assert.equal(n.percent, 0);
  assert.equal(n.scenes, 7, 'the test drive is left out');
  assert.deepEqual(n.counts, [{ status: 'planned', count: 4 }, { status: 'drafted', count: 0 }, { status: 'revised', count: 0 }, { status: 'final', count: 3 }]);
  assert.equal(bookStage(index, book), 'draft');
  assert.deepEqual(bookStages(schema), ['spark', 'market', 'premise', 'bible', 'outline', 'draft', 'revise', 'polish', 'publish', 'done']);
});

test('questions are the bullets of a scene note\'s question callouts', () => {
  assert.equal(openQuestions('> [!question] Open for Kyle\n> - One?\n> - Two?\n\nText'), 2);
  assert.equal(openQuestions('> [!question] Open for Kyle\n> Is Tobin awake?'), 1);
  assert.equal(openQuestions('> [!question] Open for Kyle\n>\n\n> [!plan] Team notes\n> - not a question'), 0);
  assert.equal(openQuestions('No callouts here.'), 0);
});

test('what is waiting on Kyle: ideas, to-dos, notes, questions and unseen jobs, each with its page', async () => {
  const { index, book } = await demoIndex();
  const items = waitingOnKyle(index, book);
  const by = Object.fromEntries(items.map((i) => [i.key, i]));
  assert.equal(by.ideas.count, 7);
  assert.equal(by.ideas.label, '7 ideas to decide');
  assert.equal(by.todos.count, 2);
  assert.equal(by.notes.count, 1);
  assert.equal(by.notes.href, '#/board/notes/' + encodeURIComponent(BOOK));
  assert.equal(by.questions.count, 1);
  assert.match(decodeURIComponent(by.questions.href), /^#\/write\/.*S-001/);
  assert.equal(by.jobs.label, '2 finished jobs you have not seen');
  const jobs = finishedJobs(index, book);
  assert.deepEqual(jobs.map((j) => j.data.id).sort(), ['J-001', 'J-021']);
  assert.ok(!waitingOnKyle(index, book, jobs.map((j) => j.path)).some((i) => i.key === 'jobs'));
});

test('jobs Kyle has seen are kept per vault on the device', () => {
  const st = new MemStorage() as unknown as Storage;
  assert.deepEqual(loadSeenJobs('demo', st), []);
  markJobsSeen('demo', ['Jobs/J-001 A.md'], st);
  markJobsSeen('demo', ['Jobs/J-002 B.md', 'Jobs/J-001 A.md'], st);
  assert.deepEqual(loadSeenJobs('demo', st), ['Jobs/J-002 B.md', 'Jobs/J-001 A.md']);
  assert.deepEqual(loadSeenJobs('other', st), []);
});

test('the release runway: chapters posted, chapters ready, weeks of buffer at the cadence', async () => {
  const { index, book } = await demoIndex();
  const r = runway(index, book);
  assert.equal(r.posted, 1);
  assert.equal(r.ready, 1);
  assert.equal(r.cadence, 2);
  assert.equal(r.weeks, 0.5);
  assert.equal(r.low, true);
  assert.equal(r.lastPosted, '2026-10-11');
  assert.equal(r.nextReady, 'Chapter 2');
  // Without a cadence there are no weeks to count.
  const plain = withNote(index, book.path, '---\ntype: book\ntitle: Ash Bell\nseries: "[[Ember Road]]"\nnumber: 1\nstage: draft\n---\n');
  const p = runway(plain, book);
  assert.equal(p.cadence, null);
  assert.equal(p.weeks, null);
  assert.equal(p.low, false);
  // One chapter ready at one a week is one week.
  const many = withNote(plain, book.path, '---\ntype: book\ntitle: Ash Bell\nstage: draft\ncadence: 1\n---\n');
  assert.equal(runway(many, book).weeks, 1);
});

test('the word target and the posting pace are written as numbers', async () => {
  const { applyToText, applyToData, editChange } = await import('../src/lib/ideas.ts');
  const text = '---\ntype: book\ntitle: Ash Bell\nstage: draft\ntarget_words: 3000\n---\n';
  assert.equal(applyToText(text, editChange({ cadence: '3', target_words: '80000' })), '---\ntype: book\ntitle: Ash Bell\nstage: draft\ntarget_words: 80000\ncadence: 3\n---\n');
  assert.equal(applyToText(text, editChange({ stage: 'revise' })), text.replace('stage: draft', 'stage: revise'));
  assert.deepEqual(applyToData({ cadence: 2 }, editChange({ cadence: '4' })), { cadence: 4 });
});

test('book progress counts only chapters whose scenes are all revised or final, whoever wrote them first', () => {
  const sc = (path: string, chapter: number | null, status: string, words: number) =>
    ({ path, type: 'scene', sha: '', body: '', data: { chapter, status, words } }) as unknown as Parameters<typeof chaptersDone>[0][number];
  const r = chaptersDone([
    sc('a', 1, 'revised', 2000), sc('b', 2, 'drafted', 5000), sc('c', 3, 'final', 1500), sc('d', 3, 'revised', 500), sc('e', 4, 'final', 900), sc('f', 4, 'drafted', 100), sc('g', null, 'revised', 300)
  ]);
  assert.deepEqual(r, { chapters: 5, done: 3, words: 4300 });
});
