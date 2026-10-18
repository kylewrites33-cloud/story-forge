// The demo vault bundled into the app, so the Pages preview shows a board before any token is entered.
// Choices made on the demo vault live in memory until the page reloads; nothing is sent anywhere.
import type { FileEntry, SaveEntry, VaultSource } from './types.ts';

// The team's files sit in a hidden folder, which a ** pattern skips, so they get their own pattern.
const files = {
  ...import.meta.glob('/demo-vault/**/*.{md,json}', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('/demo-vault/.claude/**/*.md', { query: '?raw', import: 'default', eager: true })
} as Record<string, string>;

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
  /** Every save made on the demo vault this visit, so History has something to show. */
  private log = new Map<string, { entry: SaveEntry; text: string }[]>();

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

  async write(path: string, text: string, sha: string, message = ''): Promise<string> {
    const now = !this.removed.has(path) && (this.changed.has(path) || files['/demo-vault/' + path] !== undefined) ? hash(this.text(path)) : '';
    if (now !== sha) throw Object.assign(new Error(path + ' changed while saving.'), { conflict: true });
    const list = this.log.get(path) || [];
    if (!list.length && now) list.push({ entry: { commit: 'demo-0', date: '2026-10-01T09:00:00Z', message: 'demo: the demo vault as it came', agent: '' }, text: this.text(path) });
    list.push({ entry: { commit: 'demo-' + list.length, date: new Date().toISOString(), message: message.split('\n')[0], agent: '' }, text });
    this.log.set(path, list);
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

  async history(path: string): Promise<SaveEntry[]> {
    const list = this.log.get(path);
    if (list) return list.map((x) => x.entry).reverse();
    return files['/demo-vault/' + path] !== undefined ? [{ commit: 'demo-0', date: '2026-10-01T09:00:00Z', message: 'demo: the demo vault as it came', agent: '' }] : [];
  }

  async recent(): Promise<SaveEntry[]> {
    const made = [...this.log.values()].flat().map((x) => x.entry);
    const demo: SaveEntry[] = [
      { commit: 'demo-3', date: '2026-10-02T10:20:00Z', message: 'agents: continuity notes for S-002', agent: 'Continuity Keeper' },
      { commit: 'demo-2', date: '2026-10-02T09:40:00Z', message: 'draft: S-002 The well runs dry', agent: 'Writer' },
      { commit: 'demo-1', date: '2026-10-01T16:05:00Z', message: 'ideas: three premises for the demo book', agent: 'Story Specialist' },
      { commit: 'demo-0', date: '2026-10-01T09:00:00Z', message: 'demo: the demo vault as it came', agent: '' }
    ];
    return made.reverse().concat(demo);
  }

  async readAt(path: string, commit: string): Promise<string> {
    const hit = (this.log.get(path) || []).find((x) => x.entry.commit === commit);
    if (hit) return hit.text;
    if (commit === 'demo-0' && files['/demo-vault/' + path] !== undefined) return files['/demo-vault/' + path];
    throw new Error('The demo vault has no such save.');
  }

  async remove(path: string, sha: string): Promise<void> {
    if (hash(this.text(path)) !== sha) throw Object.assign(new Error(path + ' changed while saving.'), { conflict: true });
    this.removed.add(path);
    this.changed.delete(path);
  }
}
