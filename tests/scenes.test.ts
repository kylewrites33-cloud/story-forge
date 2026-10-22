import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { saveDraft, openDraft } from '../src/lib/drafts.ts';
import { Frontmatter } from '../src/lib/frontmatter.js';
import {
  archiveForJoin, archivePath, createScene, joinedBody, mentionsOf, nextSceneId, noteJoinForTeam, orderBetween, removeJoined, sceneNotesFor, splitAt, splitOff
} from '../src/lib/scenes.ts';
import type { FileEntry, NoteRecord } from '../src/lib/types.ts';
import { makeNote } from '../src/lib/vault-index.ts';
import { DEMO, FsSource, hasVault, VAULT } from './helpers.ts';

const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const NOW = new Date(2026, 9, 17, 22, 5);

/** The demo vault copied to a temporary folder, written and removed the way the app does it on GitHub. */
class DiskSource extends FsSource {
  root: string;
  messages: string[] = [];
  constructor(dir: string) { super(dir); this.root = dir; }
  private sha(text: string) { return 'sha-' + [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7); }
  async readFresh(p: string) {
    const f = path.join(this.root, p);
    if (!fs.existsSync(f)) throw Object.assign(new Error('gone'), { status: 404 });
    const text = fs.readFileSync(f, 'utf8');
    return { text, sha: this.sha(text) };
  }
  async write(p: string, text: string, sha: string, message: string) {
    const f = path.join(this.root, p);
    const cur = fs.existsSync(f) ? this.sha(fs.readFileSync(f, 'utf8')) : '';
    if (cur !== sha) throw Object.assign(new Error('changed'), { conflict: true });
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
    this.messages.push(message);
    return this.sha(text);
  }
  async remove(p: string, sha: string, message: string) {
    const f = path.join(this.root, p);
    if (this.sha(fs.readFileSync(f, 'utf8')) !== sha) throw Object.assign(new Error('changed'), { conflict: true });
    fs.rmSync(f);
    this.messages.push(message);
  }
  note(p: string): NoteRecord {
    const text = fs.readFileSync(path.join(this.root, p), 'utf8');
    return makeNote(p, this.sha(text), text);
  }
}

function demoCopy(): DiskSource {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-scenes-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  return new DiskSource(dir);
}

function scenePath(src: DiskSource, id: string): string {
  const dir = path.join(src.root, BOOK, 'Scenes');
  const name = fs.readdirSync(dir).find((f) => f.startsWith(id + ' '));
  assert.ok(name, 'no ' + id);
  return BOOK + '/Scenes/' + name;
}

function validate(dir: string) {
  return execFileSync(process.execPath, [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'validate'], {
    cwd: dir, env: { ...process.env, SF_VAULT: dir }, encoding: 'utf8'
  });
}

test('the next scene ID skips Snapshots, Exports and Archive, as sf next-id does', () => {
  const f = (p: string): FileEntry => ({ path: BOOK + '/' + p, sha: 'x' });
  assert.equal(nextSceneId([f('Scenes/S-001 A.md'), f('Scenes/S-009 B.md'), f('Archive/S-020 C.md'), f('Snapshots/S-030 v1 (agent).md')], BOOK), 'S-010');
  assert.equal(nextSceneId([], BOOK), 'S-001');
});

test('a new scene goes between its neighbours in reading order', () => {
  const n = (order: unknown) => makeNote('x.md', 'x', Frontmatter.join({ type: 'scene', order }, ''));
  assert.equal(orderBetween(n(54), n(55)), 54.5);
  assert.equal(orderBetween(n(54), n(54.5)), 54.25);
  assert.equal(orderBetween(n(58), null), 59);
  assert.equal(orderBetween(null, n(1)), 0.5);
  assert.equal(orderBetween(null, null), 1);
});

test('split and join keep every word: text helpers', () => {
  assert.deepEqual(splitAt('One.\n\nTwo.\n', 6), { before: 'One.\n', after: 'Two.\n' });
  assert.equal(joinedBody('\nOne.\n\n', '\n\nTwo.\n'), '\nOne.\n\nTwo.\n');
  assert.equal(archivePath(BOOK + '/Scenes/S-002 The Ferry.md'), BOOK + '/Archive/S-002 The Ferry.md');
});

test('add, split and join scenes in the demo vault; it still passes sf validate', { skip: !hasVault && 'author-business is not checked out beside this repository' }, async () => {
  const src = demoCopy();
  // Add a scene at the end of chapter 1.
  const made = await createScene(src, { bookFolder: BOOK, title: 'Night: the bell / rope', chapter: 1, chapterTitle: 'Frost', order: 2.5, status: 'drafted', body: '' }, NOW, 'Added in the Sparrow app.');
  assert.match(made.path, /\/Scenes\/S-009 Night the bell rope\.md$/);
  assert.equal(made.data.id, 'S-009');
  assert.equal(made.data.order, 2.5);
  assert.equal(made.data.created, '2026-10-17');

  // Split S-001 after its first paragraph.
  const s1 = src.note(scenePath(src, 'S-001'));
  const s2 = src.note(scenePath(src, 'S-002'));
  const text = s1.body.replace(/^\n/, '');
  const at = text.indexOf('\n\n') + 2;
  const parts = splitAt(text, at);
  const rest = await splitOff(src, s1, s2, s1.body, parts.after, 'The thumb', BOOK, NOW);
  assert.equal(rest.data.id, 'S-010');
  assert.equal(rest.data.chapter, 1);
  assert.equal(rest.data.pov, s1.data.pov);
  assert.ok(Number(rest.data.order) > Number(s1.data.order) && Number(rest.data.order) < Number(s2.data.order));
  assert.ok(fs.existsSync(path.join(src.root, BOOK, 'Snapshots', 'S-001 v1 (before split).md')));
  const d = { ...openDraft(s1, undefined, NOW), body: '\n' + parts.before };
  await saveDraft(src, d, NOW);
  const after1 = src.note(s1.path);
  assert.equal(after1.body.trim() + '\n\n' + rest.body.trim(), s1.body.trim());

  // Join S-010 back onto S-001.
  const taken = await archiveForJoin(src, after1, rest, NOW);
  await saveDraft(src, { ...openDraft(after1, undefined, NOW), body: joinedBody(after1.body, taken.body) }, NOW);
  await removeJoined(src, rest, taken.sha, 'S-001 The Crack');
  assert.equal(src.note(s1.path).body.trim(), s1.body.trim());
  assert.equal(fs.existsSync(path.join(src.root, rest.path)), false);
  const archived = fs.readFileSync(path.join(src.root, BOOK, 'Archive', 'S-010 The thumb.md'), 'utf8');
  assert.match(archived, /> \[!note\] Archived\n> Joined onto the end of S-001 The Crack/);
  const told = await noteJoinForTeam(src, BOOK, rest, after1, mentionsOf([src.note(s1.path), rest], 'S-010'), NOW);
  assert.equal(told, BOOK + '/Notes to the Team/Joined S-010 into S-001 2026-10-17.md');
  const team = Frontmatter.parse(fs.readFileSync(path.join(src.root, told!), 'utf8'));
  assert.equal(team.data.status, 'open');
  assert.match(team.body, /Point every note that still names S-010/);
  assert.ok(src.messages.every((m) => !/Agent:/.test(m)));

  assert.match(validate(src.root), /no errors/);
});

test('a scene\'s notes are found by its ID in its own book, and only there', () => {
  const n = (p: string, data: Record<string, unknown>): NoteRecord => ({ path: p, sha: '', type: String(data.type), data, body: '> [!plan] Team notes', error: null });
  const notes: Record<string, NoteRecord> = {};
  [n(BOOK + '/Scene Notes/S-001 The Crack.md', { type: 'scene-notes', scene: 'S-001' }),
    n('Series/Ember Road/Books/2 Other/Scene Notes/S-002 X.md', { type: 'scene-notes', scene: 'S-002' }),
    n(BOOK + '/Scenes/S-002 The Ferry.md', { type: 'scene', id: 'S-002' })].forEach((x) => { notes[x.path] = x; });
  assert.equal(sceneNotesFor(notes, BOOK, 's-001')!.path, BOOK + '/Scene Notes/S-001 The Crack.md');
  assert.equal(sceneNotesFor(notes, BOOK, 'S-002'), null);
  assert.equal(sceneNotesFor(notes, BOOK, ''), null);
});
