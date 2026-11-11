// A vault source that reads a folder on disk, so the tests run the same code the app runs against GitHub.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommitPlan, CommitResult, FileEntry, Head, VaultSource } from '../src/lib/types.ts';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEMO = path.join(ROOT, 'demo-vault');
/** The vault checked out beside this repository, when there is one (it is not, in CI). */
export const VAULT = path.resolve(ROOT, '..', 'author-business');
export const hasVault = fs.existsSync(path.join(VAULT, 'System', 'Tools', 'sf.js'));

export class FsSource implements VaultSource {
  readonly key: string;
  readonly label: string;
  reads: string[] = [];
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
    this.key = 'fs:' + dir;
    this.label = dir;
  }

  async tree(): Promise<{ files: FileEntry[]; truncated: boolean }> {
    const files: FileEntry[] = [];
    const walk = (rel: string) => {
      for (const e of fs.readdirSync(path.join(this.dir, rel), { withFileTypes: true })) {
        const r = rel ? rel + '/' + e.name : e.name;
        if (e.isDirectory()) walk(r);
        else files.push({ path: r, sha: crypto.createHash('sha1').update(fs.readFileSync(path.join(this.dir, r))).digest('hex') });
      }
    };
    walk('');
    return { files: files.sort((a, b) => a.path.localeCompare(b.path)), truncated: false };
  }

  async read(p: string, _sha?: string): Promise<string> {
    this.reads.push(p);
    return fs.readFileSync(path.join(this.dir, p), 'utf8');
  }
}

export const demoSchemaText = () => fs.readFileSync(path.join(DEMO, 'System', 'schema.json'), 'utf8');

/** A vault in memory that saves the way GitHub does: every save is one step, planned again if the vault moved meanwhile. */
export class MemSource implements VaultSource {
  readonly key = 'mem';
  readonly label = 'memory';
  files = new Map<string, string>();
  writes: { path: string; message: string }[] = [];
  offline = false;
  /** Goes up with every save, as a branch moves. */
  head = 0;
  /** Set by a test to change the vault between a save's read and its landing, once: the save must start again. */
  race: (() => void) | null = null;
  /** How many times commit asked for a plan. */
  builds = 0;
  sha(text: string) { let h = 7; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0; return h.toString(16); }
  async tree(): Promise<{ files: FileEntry[]; truncated: boolean }> {
    return { files: [...this.files].map(([p, t]) => ({ path: p, sha: this.sha(t) })), truncated: false };
  }
  async read(p: string) { return this.files.get(p) as string; }
  async readFresh(p: string) {
    if (this.offline) throw Object.assign(new Error('Cannot reach GitHub.'), { status: 0 });
    const t = this.files.get(p);
    if (t === undefined) throw Object.assign(new Error('gone'), { status: 404 });
    return { text: t, sha: this.sha(t) };
  }
  /** Every save as one step, the way GitHubSource.commit does it: if the vault moved since the read, plan again. */
  commits: { message: string; paths: string[] }[] = [];
  async commit(build: (head: Head) => Promise<CommitPlan | null>): Promise<CommitResult | null> {
    for (let attempt = 0; ; attempt++) {
      if (this.offline) throw Object.assign(new Error('Cannot reach GitHub.'), { status: 0 });
      const at = this.head;
      const seen = new Map(this.files);
      this.builds++;
      const plan = await build({
        read: async (p) => {
          if (this.offline) throw Object.assign(new Error('Cannot reach GitHub.'), { status: 0 });
          const t = seen.get(p);
          return t === undefined ? null : { text: t, sha: this.sha(t) };
        },
        files: async () => [...seen].map(([p, t]) => ({ path: p, sha: this.sha(t) }))
      });
      const removes = (plan && plan.removes) || [];
      const blobs = (plan && plan.blobs) || [];
      if (!plan || (!plan.writes.length && !removes.length && !blobs.length)) return null;
      if (this.race) { const r = this.race; this.race = null; r(); this.head++; }
      if (this.head !== at) {
        if (attempt < 4) continue;
        throw Object.assign(new Error('The vault kept changing.'), { status: 422 });
      }
      const shas: Record<string, string> = {};
      plan.writes.forEach((f) => { this.files.set(f.path, f.text); shas[f.path] = this.sha(f.text); this.writes.push({ path: f.path, message: plan.message }); });
      // A file that is not text is kept as its base64, as the tests' writeBytes stand-in does.
      blobs.forEach((b) => { this.files.set(b.path, b.base64); shas[b.path] = this.sha(b.base64); this.writes.push({ path: b.path, message: plan.message }); });
      removes.forEach((p) => { this.files.delete(p); this.writes.push({ path: p, message: 'REMOVE ' + plan.message }); });
      this.head++;
      this.commits.push({ message: plan.message, paths: plan.writes.map((f) => f.path).concat(blobs.map((b) => b.path), removes) });
      return { commit: 'c' + this.head, shas };
    }
  }
}


/** What a save did to a vault: the files it added or rewrote, and the ones it took away. */
export function changeOf(before: Map<string, string>, after: Map<string, string>): { set: Record<string, string>; gone: string[] } {
  const set: Record<string, string> = {};
  [...after.keys()].sort().forEach((p) => { if (before.get(p) !== after.get(p)) set[p] = after.get(p)!; });
  return { set, gone: [...before.keys()].filter((p) => !after.has(p)).sort() };
}

const GOLDEN = path.join(ROOT, 'tests', 'golden');

/** Holds a save to exactly what it must leave in the vault, file for file. What is expected is written down in
 * tests/golden/<name>.json: the files added or rewritten (`set`), the files gone (`gone`), and anything else the test
 * hands over (`also`). These were first written from the older note-by-note saving code, just before it was taken out
 * (2026-11-11), so the one saving system is still held to what that code did. For a change that is meant,
 * `GOLDEN=write npm test` writes them again; read the diff before committing it. */
export function leaves(name: string, before: Map<string, string>, after: Map<string, string>, also?: unknown): void {
  const got = JSON.parse(JSON.stringify({ ...changeOf(before, after), ...(also === undefined ? {} : { also }) }));
  const file = path.join(GOLDEN, name + '.json');
  if (process.env.GOLDEN === 'write') {
    fs.mkdirSync(GOLDEN, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(got, null, 1) + '\n');
    return;
  }
  if (!fs.existsSync(file)) throw new Error('No expected result is written down for "' + name + '" (tests/golden). Run GOLDEN=write npm test once and read what it wrote.');
  const want = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(got, want, name);
}
