// The kinds of job (step 4 of the code structure redesign): the app's label, default title and fixed ask for each kind
// come from the one list in the vault's schema (types.job.kinds), which the runner reads too. They are held to what
// the app's own tables said on the day those were taken out (tests/golden/job-kinds.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { defaultJobTitle, jobAsk, jobLabel, type JobKind } from '../src/lib/jobs.ts';
import { kindsFrom } from '../src/team/kinds.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'demo-vault/System/schema.json'), 'utf8'));
kindsFrom(schema);
const KINDS: string[] = schema.types.job.properties.kind.enum.concat(['a-kind-nobody-defined']);

test('labels, titles and asks for every kind are what the app said before the one list', () => {
  const got: Record<string, unknown> = {};
  for (const k of KINDS) {
    const kind = k as JobKind;
    got[k] = {
      label: jobLabel(kind),
      title: defaultJobTitle(kind, 'Chapter 2'), titleNamed: defaultJobTitle(kind, 'S-045', 'Grey at the barn'), titleBare: defaultJobTitle(kind, ''),
      ask: jobAsk(kind, 'Chapter 2', ''), askWords: jobAsk(kind, 'Chapter 2', '  make it funnier  '), askSame: jobAsk(kind, 'a falconer', 'a falconer')
    };
  }
  const file = path.join(ROOT, 'tests/golden/job-kinds.json');
  if (process.env.GOLDEN === 'write') { fs.writeFileSync(file, JSON.stringify(got, null, 1) + '\n'); return; }
  assert.deepEqual(got, JSON.parse(fs.readFileSync(file, 'utf8')));
});
