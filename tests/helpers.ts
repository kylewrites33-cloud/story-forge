// A vault source that reads a folder on disk, so the tests run the same code the app runs against GitHub.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FileEntry, VaultSource } from '../src/lib/types.ts';

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
