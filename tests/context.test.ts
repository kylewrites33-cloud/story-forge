import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatJob } from '../src/lib/chat.ts';
import { askBody, jobText } from '../src/lib/jobs.ts';
import { pageContext } from '../src/lib/context.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import type { BookEntry } from '../src/lib/types.ts';

const book: BookEntry = { path: 'Series/Q/Books/2 B/Book.md', folder: 'Series/Q/Books/2 B', seriesFolder: 'Series/Q', seriesName: 'Quest Declined', title: 'The Village', number: 2, stage: 'drafting', scenes: [] };

test('a chat from a board says where Kyle is and what is on screen', () => {
  const idea = makeNote('Series/Q/Books/2 B/Ideas/I-004 Grey keeps the farm.md', 'x', '---\ntype: idea\nid: I-004\ntitle: Grey keeps the farm\nstatus: inbox\n---\n');
  const page = pageContext({ name: 'the Ideas board', book, notes: [idea] });
  assert.match(page, /^Kyle sent this from the Ideas board in the Story Forge app\./);
  assert.match(page, /Book: The Village \(Quest Declined, Book 2\), `Series\/Q\/Books\/2 B`/);
  assert.match(page, /- I-004 Grey keeps the farm \(inbox\): `Series\/Q\/Books\/2 B\/Ideas\/I-004 Grey keeps the farm.md`/);
  // A long board is cut short, with a count of the rest.
  const many = Array.from({ length: 80 }, (_, i) => makeNote('Series/Q/Books/2 B/Ideas/I-' + (100 + i) + ' A rather long idea title for the test.md', 'x', '---\nid: I-' + (100 + i) + '\ntitle: A rather long idea title for the test\nstatus: inbox\n---\n'));
  const cut = pageContext({ name: 'the Ideas board', book, notes: many });
  assert.ok(cut.length <= 1600);
  assert.match(cut, /…and \d+ more\.$/);
});

test('the page goes into the chat job under its own heading, and Kyle\'s words stay his', () => {
  const j = chatJob('chat-003', 'Which of these should I keep?', book.folder, 'Kyle sent this from the Ideas board in the Story Forge app.');
  const text = jobText('J-020', j, new Date('2026-10-18T12:00:00'));
  assert.match(text, /## Ask\nWhich of these should I keep\?\n\n## Page\nKyle sent this from the Ideas board/);
  assert.equal(askBody(makeNote('Jobs/J-020 x.md', 'x', text).body), 'Which of these should I keep?');
  assert.doesNotMatch(jobText('J-021', chatJob('chat-003', 'Hi', book.folder), new Date()), /## Page/);
});
