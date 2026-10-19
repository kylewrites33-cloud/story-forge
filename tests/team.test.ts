import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSchema } from '../src/lib/schema.ts';
import { PHASE } from '../src/lib/sync.ts';
import {
  agentName, bringsInOf, buildTeam, firstSentence, history, journalEntries, keptLabel, lastUsedLabel, lessonsOf, memberStats,
  saveHistory, skillLabel, sortMembers, teamFiles
} from '../src/lib/team.ts';
import { buildIndex } from '../src/lib/vault-index.ts';
import { DEMO, demoSchemaText, FsSource, hasVault, VAULT } from './helpers.ts';

test('names in plain words', () => {
  assert.equal(agentName('story-specialist'), 'Story Specialist');
  assert.equal(skillLabel('kdp-packaging'), 'KDP packaging');
  assert.equal(skillLabel('save-the-cat'), 'Save the cat');
  assert.equal(firstSentence('Creative lead. Use proactively for premise.'), 'Creative lead.');
});

test('journal entries come from dated headings, whatever their level and separator', () => {
  const text = '# Writer: journal\n\nAppend-only.\n\n## Migrated, 2026-10-17\n\n### 2026-10-12 · Writers Room — Premise\n- Tried: a pitch.\n\n## 2026-10-17 · Draft S-044\n- Tried: three scenes.\n\n### 2026-10-16 (night) — Planning, round four\nline\n';
  const e = journalEntries(text, 'Writer');
  assert.deepEqual(e.map((x) => [x.date, x.title]), [['2026-10-12', 'Writers Room — Premise'], ['2026-10-17', 'Draft S-044'], ['2026-10-16', 'Planning, round four']]);
  assert.equal(e[1].text, '- Tried: three scenes.');
  assert.equal(e[0].who, 'Writer');
});

test('lessons are the list under Lessons, not the Archive', () => {
  assert.deepEqual(lessonsOf('# M\n\nFormat: `- [L-001]`\n\n## Lessons\n- [L-001] one\n- [L-002] two\n\n## Archive\n- [L-000] old\n'), ['[L-001] one', '[L-002] two']);
  assert.equal(bringsInOf('# Draft\n\n- **Agents**: Writer (draft), `beta-reader`.\n'), 'Writer (draft), beta-reader.');
});

test('the demo vault has a team, skills with who loads them, and history', async () => {
  const src = new FsSource(DEMO);
  const { files } = await src.tree();
  assert.ok(teamFiles(files).length > 10);
  const schema = parseSchema(demoSchemaText());
  const index = await buildIndex({ schema, files, read: (p, s) => src.read(p, s), phase: PHASE });
  const team = buildTeam(index.team);
  assert.equal(team.members.length, 8);
  assert.equal(team.members[0].name, 'Story Specialist', 'Leadership comes first');
  const writer = team.members.find((m) => m.slug === 'writer')!;
  assert.equal(writer.team, 'Writing');
  assert.deepEqual(writer.skills, ['anti-slop', 'prose-craft']);
  assert.equal(writer.lessons.length, 2);
  assert.equal(writer.journal[0].date, '2026-10-02');
  const antiSlop = team.skills.find((s) => s.name === 'anti-slop')!;
  assert.deepEqual(antiSlop.agents.sort(), ['Line Editor', 'Writer']);
  assert.equal(team.skills.find((s) => s.name === 'draft')!.agents.length, 0);
  const plot = team.members.find((m) => m.slug === 'plot-specialist')!;
  assert.ok(memberStats(plot, index, schema).ideas >= 1, 'proposals with the agent as source count as its ideas');
  const all = history(team, index, ([{ commit: 'a', date: '2026-12-03T10:00:00Z', message: 'x', agent: 'Writer' }, { commit: 'b', date: '2026-10-04T10:00:00Z', message: 'Kyle', agent: '' }]));
  assert.equal(saveHistory([{ commit: 'b', date: '2026-10-04', message: 'Kyle', agent: '' }]).length, 0);
  assert.equal(all[0].kind, 'save');
  assert.ok(all.every((e) => e.title !== 'Kyle'));
  assert.deepEqual(sortMembers(team.members, {}, 'az').map((m) => m.name)[0], 'Character Specialist');
  // A second sync reuses unchanged team files.
  src.reads = [];
  await buildIndex({ schema, files, read: (p, s) => src.read(p, s), previous: index, phase: PHASE });
  assert.ok(!src.reads.some((p) => p.startsWith('.claude/')));
});

test('kept share and last used read plainly', () => {
  assert.equal(keptLabel({ ideas: 3, kept: 1, decided: 2, lastUsed: '' }), '50%');
  assert.equal(keptLabel({ ideas: 3, kept: 0, decided: 0, lastUsed: '' }), '—');
  const now = new Date(2026, 9, 18, 10);
  assert.equal(lastUsedLabel('2026-10-18', now), 'today');
  assert.equal(lastUsedLabel('2026-10-17T22:00:00Z'.slice(0, 10), now), 'yesterday');
  assert.equal(lastUsedLabel('2026-10-14', now), '4 days ago');
  assert.equal(lastUsedLabel('', now), 'never');
});

test('the vault beside this repository: every agent has a team and every skill an entry', { skip: !hasVault }, async () => {
  const src = new FsSource(VAULT);
  const { files } = await src.tree();
  const texts: Record<string, { sha: string; text: string }> = {};
  for (const f of teamFiles(files)) texts[f.path] = { sha: f.sha, text: await src.read(f.path, f.sha) };
  const team = buildTeam(texts);
  assert.ok(team.members.length >= 8);
  assert.ok(team.skills.length >= 40);
  for (const m of team.members) for (const s of m.skills) assert.ok(team.skills.some((k) => k.name === s), m.name + ' loads a skill the vault does not have: ' + s);
});
