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
  private removed = new Set<string>();
  /** Pictures added on the demo vault (a cover), as base64, until the page reloads. */
  private pictures = new Map<string, string>();

  private text(path: string): string {
    if (this.removed.has(path)) throw new Error('The demo vault has no ' + path + '.');
    const text = this.changed.has(path) ? this.changed.get(path) : files['/demo-vault/' + path];
    if (text === undefined) throw new Error('The demo vault has no ' + path + '.');
    return text;
  }

  async tree(): Promise<{ files: FileEntry[]; truncated: boolean }> {
    const paths = new Set(Object.keys(files).map((k) => k.replace(/^\/demo-vault\//, '')).concat([...this.changed.keys()]));
    const list = [...paths].filter((p) => !this.removed.has(p)).map((path) => ({ path, sha: hash(this.text(path)) }))
      .concat([...this.pictures.entries()].map(([path, b64]) => ({ path, sha: hash(b64) })));
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
    const now = !this.removed.has(path) && (this.changed.has(path) || files['/demo-vault/' + path] !== undefined) ? hash(this.text(path)) : '';
    if (now !== sha) throw Object.assign(new Error(path + ' changed while saving.'), { conflict: true });
    this.changed.set(path, text);
    this.removed.delete(path);
    return hash(text);
  }

  async writeBytes(path: string, base64: string, sha: string): Promise<string> {
    const had = this.pictures.get(path);
    if ((had ? hash(had) : '') !== sha) throw Object.assign(new Error(path + ' changed while saving.'), { conflict: true });
    this.pictures.set(path, base64);
    return hash(base64);
  }

  async readBytes(path: string): Promise<Blob> {
    const b64 = this.pictures.get(path);
    if (b64 == null) throw new Error('The demo vault has no ' + path + '.');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: path.endsWith('.png') ? 'image/png' : 'image/jpeg' });
  }

  async remove(path: string, sha: string): Promise<void> {
    if (hash(this.text(path)) !== sha) throw Object.assign(new Error(path + ' changed while saving.'), { conflict: true });
    this.removed.add(path);
    this.changed.delete(path);
  }
}
