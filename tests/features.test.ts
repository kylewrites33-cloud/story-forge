import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookText, manuscriptPath, manuscriptProblem, nextBookNumber } from '../src/lib/books.ts';
import { archivedWhy, renameScene, restoreArchived, unarchivedText } from '../src/lib/scenes.ts';
import { longestGap } from '../src/lib/codex.ts';
import { saveEntry } from '../src/lib/github.ts';
import { jobAsk } from '../src/lib/jobs.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import type { FileEntry, VaultSource } from '../src/lib/types.ts';

class Mem implements VaultSource {
  key = 'mem'; label = 'mem';
  files = new Map<string, string>();
  async tree() { return { files: [...this.files.keys()].map((path) => ({ path, sha: this.sha(path) })), truncated: false }; }
  sha(p: string) { return String(this.files.get(p)!.length) + ':' + p; }
  async read(p: string) { return this.files.get(p)!; }
  async readFresh(p: string) { return { text: this.files.get(p)!, sha: this.sha(p) }; }
  async write(p: string, t: string, sha: string) {
    if ((this.files.has(p) ? this.sha(p) : '') !== sha) throw Object.assign(new Error('changed'), { conflict: true });
    this.files.set(p, t); return this.sha(p);
  }
  async remove(p: string, sha: string) { if (this.sha(p) !== sha) throw new Error('changed'); this.files.delete(p); }
}

test('books and manuscripts', () => {
  assert.equal(nextBookNumber([1, 2, null]), 3);
  assert.match(bookText('A', 'S', 1, new Date()), /series: "\[\[S\]\]"/);
  assert.match(bookText('A', 'S', 1, new Date()), /\ntarget_words: 60000\n/, 'a new book starts at 60,000 words');
  assert.equal(manuscriptProblem('a.pdf', 1) !== null, true);
  assert.equal(manuscriptProblem('a.docx', 1), null);
  assert.equal(manuscriptPath('B', 'Draft: one.docx', ['B/Research/Draft one.docx']), 'B/Research/Draft one (2).docx');
});

test('rename a scene moves the file and changes only the title line', async () => {
  const m = new Mem();
  const p = 'Series/S/Books/1 B/Scenes/S-001 Old.md';
  m.files.set(p, '---\ntype: scene\nid: S-001\ntitle: Old\nstatus: drafted\n---\n\nWords here.\n');
  const n = await renameScene(m, makeNote(p, m.sha(p), m.files.get(p)!), 'Grey says no');
  assert.equal(n.path, 'Series/S/Books/1 B/Scenes/S-001 Grey says no.md');
  assert.ok(!m.files.has(p));
  assert.equal(m.files.get(n.path), '---\ntype: scene\nid: S-001\ntitle: Grey says no\nstatus: drafted\n---\n\nWords here.\n');
});

test('restore from the archive', async () => {
  const m = new Mem();
  const a = 'Series/S/Books/1 B/Archive/S-009 X.md';
  const text = '---\ntype: scene\nid: S-009\n---\n\n> [!note] Archived\n> Joined onto the end of S-008 in the app.\n\nThe words.\n';
  m.files.set(a, text);
  assert.equal(archivedWhy(text), 'Joined onto the end of S-008 in the app.');
  assert.equal(unarchivedText(text), '---\ntype: scene\nid: S-009\n---\n\nThe words.\n');
  const entry: FileEntry = { path: a, sha: m.sha(a) };
  const n = await restoreArchived(m, entry, 'Series/S/Books/1 B');
  assert.equal(n.path, 'Series/S/Books/1 B/Scenes/S-009 X.md');
  assert.ok(!m.files.has(a));
});

test('longest absence and saves', () => {
  assert.deepEqual(longestGap([1, 2, 3, 4, 5, 6], [true, false, false, false, true, false]), { from: 2, to: 4, length: 3 });
  assert.equal(longestGap([1, 2], [false, false]), null);
  assert.deepEqual(saveEntry('abc', 'scenes: edit S-001\n\nbody\nAgent: Writer\nCo-Authored-By: x', 'd'), { commit: 'abc', date: 'd', message: 'scenes: edit S-001', agent: 'Writer' });
  assert.match(jobAsk('rewrite', 'I-004', 'shorter'), /regenerate[\s\S]*shorter/);
});
