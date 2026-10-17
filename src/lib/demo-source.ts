// The demo vault bundled into the app, so the Pages preview shows a board before any token is entered.
// Choices made on the demo vault live in memory until the page reloads; nothing is sent anywhere.
import type { FileEntry, VaultSource } from './types.ts';

const files = import.meta.glob('/demo-vault/**/*.{md,json}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// A short content hash stands in for git's blob sha, so the cache treats demo files like real ones.
function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export class DemoSource implements VaultSource {
  readonly key = 'demo';
  readonly label = 'the demo vault';
  private changed = new Map<string, string>();

  private text(path: string): string {
    const text = this.changed.has(path) ? this.changed.get(path) : files['/demo-vault/' + path];
    if (text === undefined) throw new Error('The demo vault has no ' + path + '.');
    return text;
  }

  async tree(): Promise<{ files: FileEntry[]; truncated: boolean }> {
    const paths = new Set(Object.keys(files).map((k) => k.replace(/^\/demo-vault\//, '')).concat([...this.changed.keys()]));
    const list = [...paths].map((path) => ({ path, sha: hash(this.text(path)) }));
    return { files: list.sort((a, b) => a.path.localeCompare(b.path)), truncated: false };
  }

  async read(path: string): Promise<string> {
    return this.text(path);
  }

  async readFresh(path: string): Promise<{ text: string; sha: string }> {
    const text = this.text(path);
    return { text, sha: hash(text) };
  }

  async write(path: string, text: string, sha: string): Promise<string> {
    const now = this.changed.has(path) || files['/demo-vault/' + path] !== undefined ? hash(this.text(path)) : '';
    if (now !== sha) throw Object.assign(new Error(path + ' changed while saving.'), { conflict: true });
    this.changed.set(path, text);
    return hash(text);
  }
}
