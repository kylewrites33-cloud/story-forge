// Connection settings. They live in this browser's localStorage and nowhere else; the token never leaves the browser
// except in requests to api.github.com.

export interface Settings {
  owner: string;
  repo: string;
  branch: string;
  /** Folder inside the repository that holds the vault; empty when the vault is the whole repository. */
  root: string;
  token: string;
}

export const DEFAULTS: Settings = { owner: 'kylewrites33-cloud', repo: 'author-business', branch: 'main', root: '', token: '' };

const KEY = 'story-forge.settings';

export function loadSettings(storage: Storage | null = globalThis.localStorage ?? null): Settings {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return normalise({ ...DEFAULTS, ...JSON.parse(raw) });
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings, storage: Storage | null = globalThis.localStorage ?? null): Settings {
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
