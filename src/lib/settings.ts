// Connection settings. They live in this browser's localStorage and nowhere else; the token never leaves the browser
// except in requests to api.github.com.
import { PREF, storeOf } from './prefs.ts';

export interface Settings {
  owner: string;
  repo: string;
  branch: string;
  /** Folder inside the repository that holds the vault; empty when the vault is the whole repository. */
  root: string;
  token: string;
}

export const DEFAULTS: Settings = { owner: 'kylewrites33-cloud', repo: 'author-business', branch: 'main', root: '', token: '' };

const KEY = PREF.settings;

export function loadSettings(storage: Storage | null = storeOf()): Settings {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return normalise({ ...DEFAULTS, ...JSON.parse(raw) });
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings, storage: Storage | null = storeOf()): Settings {
  const clean = normalise(s);
  if (storage) storage.setItem(KEY, JSON.stringify(clean));
  return clean;
}

export function normalise(s: Settings): Settings {
  return {
    owner: String(s.owner || '').trim(),
    repo: String(s.repo || '').trim(),
    branch: String(s.branch || '').trim() || 'main',
    root: String(s.root || '').trim().replace(/^\/+|\/+$/g, ''),
    token: String(s.token || '').trim()
  };
}

export function isConnected(s: Settings): boolean {
  return Boolean(s.token && s.owner && s.repo);
}

// ---- Add my phone (2026-11-20): Sparrow Pocket's address with the key in it, for the square code in Settings ----
// The key rides in the part after `#`, which a browser never sends to a server; Pocket reads it on open, keeps it on
// the phone like any key pasted in Settings, and wipes it from the address bar at once.

/** Pocket's address carrying these settings: the key, and the vault's owner, repository, branch and folder only where
 * they differ from the usual ones (so the code stays small). `page` is Pocket's own address. */
export function phoneLink(s: Settings, page: string): string {
  const c = normalise(s);
  const q = new URLSearchParams();
  q.set('key', c.token);
  (['owner', 'repo', 'branch', 'root'] as const).forEach((k) => { if (c[k] !== DEFAULTS[k]) q.set(k, c[k]); });
  return page.replace(/#.*$/, '') + '#' + q.toString();
}

/** The settings an address made by phoneLink carries, or null when it carries no key. `hash` is the part after `#`
 * (with or without the `#`). */
export function fromPhoneLink(hash: string): Settings | null {
  const h = hash.replace(/^#/, '');
  if (!/^(?:[^&]*&)*key=/.test(h)) return null;
  const q = new URLSearchParams(h);
  const token = (q.get('key') || '').trim();
  if (!token) return null;
  return normalise({
    owner: q.get('owner') ?? DEFAULTS.owner, repo: q.get('repo') ?? DEFAULTS.repo,
    branch: q.get('branch') ?? DEFAULTS.branch, root: q.get('root') ?? DEFAULTS.root, token
  });
}
