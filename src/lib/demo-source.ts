// The demo vault bundled into the app, so the Pages preview shows a board before any token is entered.
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

  async tree(): Promise<{ files: FileEntry[]; truncated: boolean }> {
    const list = Object.keys(files).map((k) => ({ path: k.replace(/^\/demo-vault\//, ''), sha: hash(files[k]) }));
    return { files: list.sort((a, b) => a.path.localeCompare(b.path)), truncated: false };
  }

  async read(path: string): Promise<string> {
    const text = files['/demo-vault/' + path];
    if (text === undefined) throw new Error('The demo vault has no ' + path + '.');
    return text;
  }
}
