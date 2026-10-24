import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../src/lib/markdown.ts';
import { addWorkflowNote, allSteps, parseWorkflow, stepsFor } from '../src/lib/workflow.ts';
import { buildTeam, modelLabel, toolsLabel } from '../src/lib/team.ts';

const NOTE = `---
type: system-doc
title: "Workflow"
version: "1.1"
updated: 2026-10-19
---
# Workflow 1.1

How a book gets made.

## Market research

| Step | Who | Minds | Needs | Why |
|---|---|---|---|---|
| 1. Study charts | Market Analyst | One | \`market-method\` | Method work. |
| 2. Best opportunities | Market Analyst, then Contrarian | Two | The numbers | A second mind. |

## Writing

Story before sentences.

| Step | Who | Minds | Needs | Why |
|---|---|---|---|---|
| 3. Write the novel | Writer | One hand | The packet | Sequential. |

## Kyle's notes

(None yet.)
`;

const NAMES = ['Writer', 'Market Analyst', 'Contrarian'];

test('the workflow reads its stages, steps and who does each', () => {
  const w = parseWorkflow(NOTE, NAMES)!;
  assert.equal(w.title, 'Workflow 1.1');
  assert.equal(w.version, '1.1');
  assert.equal(w.intro, 'How a book gets made.');
  assert.deepEqual(w.stages.map((s) => s.title), ['Market research', 'Writing']);
  assert.equal(w.stages[1].intro, 'Story before sentences.');
  const steps = allSteps(w);
  assert.deepEqual(steps.map((s) => s.number), [1, 2, 3]);
  assert.equal(steps[0].step, 'Study charts');
  assert.equal(steps[0].needs, '`market-method`');
  assert.deepEqual(steps[1].agents, ['Market Analyst', 'Contrarian']);
  assert.deepEqual(steps.map((s) => s.several), [false, true, false]);
  assert.deepEqual(w.sections.map((s) => s.title), ["Kyle's notes"]);
  assert.deepEqual(stepsFor(w, 'Contrarian').map((x) => x.step.number), [2]);
  assert.equal(parseWorkflow('', NAMES), null);
});

test('a note on the workflow goes under Kyle\'s notes, dated, replacing "None yet"', () => {
  const once = addWorkflowNote(NOTE, 'Try nine outlines.', '2026-10-19');
  assert.match(once, /## Kyle's notes\n\n- 2026-10-19: Try nine outlines\.\n$/);
  assert.doesNotMatch(once, /None yet/);
  const twice = addWorkflowNote(once, 'Step 3: \nmore readers', '2026-10-20');
  assert.match(twice, /- 2026-10-19: Try nine outlines\.\n- 2026-10-20: Step 3: more readers\n$/);
  assert.match(addWorkflowNote('# W\n\nText', 'First', '2026-10-21'), /Text\n\n## Kyle's notes\n\n- 2026-10-21: First\n$/);
  // Everything before the notes is kept as it was.
  assert.equal(twice.slice(0, NOTE.indexOf("## Kyle's notes")), NOTE.slice(0, NOTE.indexOf("## Kyle's notes")));
});

test('tables in notes render as tables, escaped', () => {
  const html = render('| A | B |\n|---|---|\n| <x> | **y** |');
  assert.match(html, /<div class="md-table"><table><thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead>/);
  assert.match(html, /<td>&lt;x&gt;<\/td><td><strong>y<\/strong><\/td>/);
  assert.match(render('| not a table |'), /<p>/);
});

test('agents carry their role, never-sees and model in plain words; the team carries the workflow', () => {
  const agent = '---\nname: writer\ndescription: The drafter. Use to draft.\nrole: "The one hand on the prose"\nnever_sees: "Judges\' reports"\nworkflow_steps: "Steps 13, 32"\nteam: Writing\ntools: Read, Write, Edit, Bash\nmodel: inherit\nskills:\n  - draft\n---\nBody';
  const team = buildTeam({ '.claude/agents/writer.md': { sha: 'a', text: agent }, 'System/Workflow.md': { sha: 'b', text: NOTE } });
  const m = team.members[0];
  assert.equal(m.role, 'The one hand on the prose');
  assert.equal(m.neverSees, "Judges' reports");
  assert.equal(m.workflowSteps, 'Steps 13, 32');
  assert.equal(team.workflow, NOTE);
  assert.equal(modelLabel('inherit', 'claude-opus-5-5'), 'Your pick (jobs: Opus 5.5)');
  assert.equal(modelLabel('opus'), 'Opus 5.5');
  assert.equal(modelLabel('claude-sonnet-5-5'), 'Sonnet 5.5');
  assert.equal(toolsLabel('Read, Grep, Glob, Write, Bash'), 'reads the vault, writes new notes (no editing), runs the vault tool');
  const noRole = buildTeam({ '.claude/agents/x.md': { sha: 'a', text: '---\nname: x\ndescription: First. Second. Third.\n---\n' } });
  assert.equal(noRole.members[0].role, 'First. Second.');
});

test('the vault\'s own workflow, when it is beside this repository, names every step\'s agents (or Kyle, or a script)', () => {
  let text = '';
  try { text = readFileSync(new URL('../../author-business/System/Workflow.md', import.meta.url), 'utf8'); } catch { return; }
  const w = parseWorkflow(text, ['Writer', 'Story Specialist', 'Contrarian', 'Market Analyst', 'Developmental Editor', 'Line Editor', 'Beta Reader', 'Continuity Keeper'])!;
  const steps = allSteps(w);
  assert.ok(steps.length >= 30);
  // Workflow 1.2's editing steps include Kyle's own (decide the story calls, apply the changes) and scripts (check the quotes).
  steps.forEach((s) => assert.ok(s.agents.length || /\b(Kyle|script)\b/i.test(s.who), 'step ' + s.number + ' names no agent'));
  assert.deepEqual(steps.map((s) => s.number), steps.map((_s, i) => i + 1));
});
