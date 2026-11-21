// The wall between Sparrow Pocket and the main app (2026-11-21). Kyle: "im a little worried about messing up the main
// app with this pocket app ... i feel comfident in the integrity of the main app, and just dont want to mess things up
// with a buggy entry point into it". These tests fail if the wall is broken:
// 1. nothing outside Pocket (src/pocket/, src/lib/pocket*.ts) imports Pocket's code;
// 2. Pocket's code cannot change the vault but by writing its own phone note: none of the main app's saving system,
//    outbox, waiting words or saved copy is in what it loads, and its one save (src/pocket/send.ts) writes one phone note;
// 3. the main app's page loads none of Pocket's code, so it is the same app with Pocket's folder gone.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { sendChoices } from '../src/pocket/send.ts';
import type { CommitPlan, Head, VaultSource } from '../src/lib/types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const rel = (p: string) => relative(ROOT, p).split('\\').join('/');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|js)$/.test(f) ? [p] : [];
  });
}
const isPocket = (p: string) => /^src\/pocket\//.test(rel(p)) || /^src\/lib\/pocket[^/]*\.ts$/.test(rel(p));

/** The files a file imports (static, re-exports and dynamic), resolved to paths. */
function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const out: string[] = [];
  const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const spec = m[1] || m[2] || m[3];
    if (!spec.startsWith('.')) continue;
    const p = resolve(dirname(file), spec);
    out.push(p);
  }
  return out.filter((p) => existsSync(p) && /\.(ts|tsx|js)$/.test(p));
}

/** Every file a page loads, from its entry. */
function graph(entry: string): Set<string> {
  const seen = new Set<string>();
  const todo = [entry];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    importsOf(f).forEach((p) => todo.push(p));
  }
  return seen;
}

test('nothing outside Sparrow Pocket imports its code', () => {
  const bad = walk(SRC).filter((f) => !isPocket(f)).flatMap((f) => importsOf(f).filter(isPocket).map((p) => rel(f) + ' imports ' + rel(p)));
  assert.deepEqual(bad, []);
});

test('the main app\'s page loads none of Pocket\'s code', () => {
  const main = graph(join(SRC, 'main.tsx'));
  assert.ok(main.has(join(SRC, 'ui', 'App.tsx')), 'the walk reaches the app');
  assert.deepEqual([...main].filter(isPocket).map(rel), []);
  // And the page itself names only the main app's entry.
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /pocket/i);
});

test('Pocket loads nothing that saves to the vault, and only its own phone note is written', () => {
  const files = [...graph(join(SRC, 'pocket', 'main.tsx'))];
  const names = files.map(rel);
  assert.ok(names.includes('src/pocket/send.ts') && names.includes('src/pocket/Pocket.tsx'), 'the walk reaches Pocket\'s screens');
  // The main app's saving system, its outbox and waiting words, its screens and its reply: none of them.
  const forbidden = names.filter((n) => /^src\/(vault|ui|app)\//.test(n) || ['src/team/reply.ts', 'src/lib/drafts.ts'].includes(n));
  assert.deepEqual(forbidden, []);
  // The one call that saves is in send.ts; the sources only define it.
  const commits = files.filter((f) => /\.commit\s*\(/.test(readFileSync(f, 'utf8'))).map(rel).filter((n) => n !== 'src/lib/github.ts' && n !== 'src/lib/demo-source.ts');
  assert.deepEqual(commits, ['src/pocket/send.ts']);
  // None of the main app's waiting work is named (its outbox, what landed, words typed, the sync's notice), and the saved
  // copy it writes is its own. (src/lib/changes.ts, which reads the cards, also holds the reader of the list choices
  // waited in before 2026-11-11; only the main app's outbox calls it, and Pocket's own files never do.)
  const shared = files.filter((f) => rel(f) !== 'src/lib/prefs.ts' && /PREF\.(outbox|landed|drafts|syncNotice)\b|story-forge\.(outbox|landed|drafts|sync-notice)/.test(readFileSync(f, 'utf8'))).map(rel);
  assert.deepEqual(shared, []);
  assert.deepEqual(files.filter((f) => isPocket(f) && /\b(loadChoices|clearChoices)\(/.test(readFileSync(f, 'utf8'))).map(rel), []);
  const snaps = files.filter((f) => rel(f) !== 'src/lib/cache.ts' && /writeSnapshot\(/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(snaps.map(rel), ['src/pocket/vault.ts']);
  snaps.forEach((f) => (readFileSync(f, 'utf8').match(/writeSnapshot\([^)]*\)/g) || []).forEach((call) => assert.match(call, /SNAP \+/, call)));
});

test('Pocket\'s one save writes one phone note and refuses anything else', async () => {
  const plans: CommitPlan[] = [];
  const files = new Map<string, string>();
  const fake = (patch?: (p: CommitPlan) => void): VaultSource => ({
    key: 'wall', label: 'wall',
    tree: async () => ({ files: [], truncated: false }),
    read: async () => '',
    commit: async (build) => {
      const head: Head = { read: async (p) => (files.has(p) ? { text: files.get(p)!, sha: 'x' } : null), files: async () => [] };
      const plan = await build(head);
      if (plan && patch) patch(plan);
      if (plan) plans.push(plan);
      return null;
    }
  });
  const choice = { n: 0, kind: 'reject' as const, version: 0, card: 'C-01', chapter: 1, chapterId: '', scene: '', words: '', was: '', now: '', made: '', result: '' };
  await sendChoices(fake(), 'Series/S/Books/1 B', 'B', '', [choice], new Date('2026-11-21T15:00:00Z'));
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].writes.map((w) => w.path), ['Series/S/Books/1 B/Phone/Phone choices 2026-11-21 1500.md']);
  assert.ok(!plans[0].removes && !plans[0].blobs);
  // Pointed at any other note as "its own", it still writes only a phone note.
  files.set('Series/S/Books/1 B/Changes/Chapter 1 changes.md', '---\ntype: chapter-changes\nstatus: sent\n---\n');
  await sendChoices(fake(), 'Series/S/Books/1 B', 'B', 'Series/S/Books/1 B/Changes/Chapter 1 changes.md', [choice], new Date('2026-11-21T15:00:00Z'));
  assert.ok(plans[1].writes.every((w) => /\/Phone\/[^/]+\.md$/.test(w.path)), plans[1].writes.map((w) => w.path).join(', '));
});
