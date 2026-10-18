import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Frontmatter } from '../src/lib/frontmatter.js';
import { answeredIn, bookNotesToTeam, createNote, freePath, noteTitle, noteTo } from '../src/lib/notes.ts';
import { bookSessions, parseSession, sessionIdeas, sessionWhen, speakers, voiceColour } from '../src/lib/sessions.ts';
import { createRecipe, editRecipeText, recipeName, recipeNotes, saveRecipe, withRecipe } from '../src/lib/recipes.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import { MemSource } from './helpers.ts';
import { BOOK, demoIndex } from './wr-helpers.ts';

const NOW = new Date('2026-10-18T09:00:00');

test('Notes to the Team: open first, who each is for, and the session that answered it', async () => {
  const { index, book } = await demoIndex();
  const notes = bookNotesToTeam(index, book);
  assert.deepEqual(notes.map((n) => n.data.title), ['Check the Ferry', 'End chapters on an open question']);
  assert.equal(noteTo(notes[0]), 'Plot Specialist');
  assert.equal(noteTo(notes[1]), 'the whole team');
  assert.equal(answeredIn(index, book, notes[0]), null);
  const a = answeredIn(index, book, notes[1]);
  assert.equal(a && a.path, BOOK + '/Sessions/2026-10-17 0930 Ferry brainstorm.md');
});

test('a new Note to the Team is Kyle\'s commit in the book\'s folder, never over another note', async () => {
  const src = new MemSource();
  src.files.set(BOOK + '/Notes to the Team/Keep Tobin young.md', '---\ntype: note\ntitle: Keep Tobin young\nstatus: open\n---\nx\n');
  const n = await createNote(src, BOOK, { title: 'Keep Tobin young', to: 'Writer', body: 'Tobin talks like a seventeen-year-old.' }, NOW);
  assert.equal(n.path, BOOK + '/Notes to the Team/Keep Tobin young 2.md');
  assert.deepEqual(n.data, { type: 'note', title: 'Keep Tobin young', to: 'Writer', status: 'open', created: '2026-10-18' });
  assert.equal(n.body.trim(), 'Tobin talks like a seventeen-year-old.');
  assert.match(src.writes[0].message, /^notes: add Keep Tobin young/);
  assert.doesNotMatch(src.writes[0].message, /Agent:/);
  const auto = await createNote(src, BOOK, { title: '', to: '', body: 'Never let Mara cry on the page. She works instead, and the work goes wrong.' }, NOW);
  assert.equal(auto.data.title, 'Never let Mara cry on the page. She works instead, and the');
  assert.equal(auto.data.to, 'Team');
  await assert.rejects(createNote(src, BOOK, { title: 'x', to: 'Team', body: '  ' }, NOW), /Write the instruction first/);
  assert.equal(noteTitle('', 'Short one.'), 'Short one');
  assert.equal(freePath('F', 'A', ['F/a.md', 'F/A 2.md']), 'F/A 3.md');
});

test('a session reads speaker by speaker, in callouts or bold names', () => {
  const body = [
    '## Round 1: pitches', '', '> [!voice] Plot Specialist', '> Tobin lies.', '> About the rope.', '',
    '> [!voice] Kyle', '> Keep it.', '', 'Narration between turns.', '',
    '## What was asked', '**Writer:** Flat, a half step low.', 'Still the Writer.', '', '**Kyle**: Flat it is.', '',
    "## Kyle's decisions", '- The bell rings flat.', '', '## Reflection', '- A sound needs a source.'
  ].join('\n');
  const parts = parseSession(body);
  assert.deepEqual(parts.map((p) => [p.heading, p.kind]), [['Round 1: pitches', 'talk'], ['What was asked', 'talk'], ["Kyle's decisions", 'decisions'], ['Reflection', 'reflection']]);
  assert.deepEqual(parts[0].turns, [
    { speaker: 'Plot Specialist', text: 'Tobin lies.\nAbout the rope.' },
    { speaker: 'Kyle', text: 'Keep it.' },
    { speaker: '', text: 'Narration between turns.' }
  ]);
  assert.deepEqual(parts[1].turns, [{ speaker: 'Writer', text: 'Flat, a half step low.\nStill the Writer.' }, { speaker: 'Kyle', text: 'Flat it is.' }]);
  assert.deepEqual(parts[2].turns, [{ speaker: '', text: '- The bell rings flat.' }]);
  assert.deepEqual(speakers(parts), ['Plot Specialist', 'Kyle', 'Writer']);
  assert.equal(voiceColour('Kyle'), 'var(--accent)');
  assert.equal(voiceColour('Story Specialist'), 'var(--voice-1)');
  assert.equal(voiceColour('Contrarian'), 'var(--voice-11)', 'every agent on the roster has its own colour');
  assert.match(voiceColour('A Beekeeper'), /^var\(--voice-(1[0-2]|[1-9])\)$/);
  assert.equal(sessionWhen('2026-10-17T09:30'), '17 Oct 2026, 09:30');
});

test('the demo\'s sessions, newest first, with the ideas each filed', async () => {
  const { index, book } = await demoIndex();
  const list = bookSessions(index, book);
  assert.deepEqual(list.map((n) => n.data.title), ["2026-10-18 1015 The bell's sound", '2026-10-17 0930 Ferry brainstorm']);
  assert.deepEqual(sessionIdeas(index, book, list[1]).map((n) => n.data.id), ['I-001', 'I-002'], 'from its ideas list');
  assert.deepEqual(sessionIdeas(index, book, list[0]).map((n) => n.data.id), ['I-003'], 'from the idea\'s session link');
  const brainstorm = parseSession(list[1].body);
  assert.deepEqual(speakers(brainstorm), ['Plot Specialist', 'Character Specialist', 'Story Specialist', 'Contrarian', 'Kyle']);
});

test('recipes: listed A to Z, named in a job\'s ask once, added and edited as Kyle', async () => {
  const { index } = await demoIndex();
  assert.deepEqual(recipeNotes(index).map(recipeName), ['Chapter-End Hook', 'Ledger Entry']);
  const ask = withRecipe('Draft it.', 'Chapter-End Hook');
  assert.equal(ask, 'Draft it.\n\nUse the recipe [[Chapter-End Hook]] (in the vault\'s Recipes folder) on top of your usual rules.');
  assert.equal(withRecipe(ask, 'Chapter-End Hook'), ask);
  assert.equal(withRecipe('', 'Stat Block'), 'Use the recipe [[Stat Block]] (in the vault\'s Recipes folder) on top of your usual rules.');
  assert.equal(withRecipe('Draft it.', ''), 'Draft it.');

  const src = new MemSource();
  const made = await createRecipe(src, { title: 'Stat Block', use_for: 'a LitRPG status screen', body: 'Four lines at most.' }, NOW);
  assert.equal(made.path, 'Recipes/Stat Block.md');
  assert.deepEqual(made.data, { type: 'recipe', title: 'Stat Block', use_for: 'a LitRPG status screen', created: '2026-10-18' });
  assert.doesNotMatch(src.writes[0].message, /Agent:/);

  const text = src.files.get('Recipes/Stat Block.md')!;
  assert.equal(editRecipeText(text, 'a LitRPG status screen', 'Four lines at most.'), text, 'nothing new, nothing written');
  const edited = editRecipeText(text + '', 'a status screen', 'Five lines at most.');
  assert.equal(Frontmatter.parse(edited).data.use_for, 'a status screen');
  assert.equal(Frontmatter.parse(edited).body.trim(), 'Five lines at most.');
  assert.equal(Frontmatter.parse(editRecipeText(text, '', 'x')).data.use_for, undefined);

  const saved = await saveRecipe(src, makeNote(made.path, src.sha(text), text), { title: 'Stat Block', use_for: 'a status screen', body: 'Five lines.' });
  assert.equal(saved.path, 'Recipes/Stat Block.md');
  assert.match(src.writes[1].message, /^recipes: edit Stat Block/);
  const cur = src.files.get('Recipes/Stat Block.md')!;
  const renamed = await saveRecipe(src, makeNote(saved.path, src.sha(cur), cur), { title: 'Status Screen', use_for: 'a status screen', body: 'Five lines.' });
  assert.equal(renamed.path, 'Recipes/Status Screen.md');
  assert.equal(renamed.data.title, 'Status Screen');
  assert.ok(!src.files.has('Recipes/Stat Block.md'));
  await assert.rejects(createRecipe(src, { title: '', use_for: '', body: 'x' }, NOW), /name/);
});
