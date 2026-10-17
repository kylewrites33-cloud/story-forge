// Reads the vault through the GitHub REST API: one call for the whole file tree, then one call per changed file.
import type { FileEntry, VaultSource } from './types.ts';
import type { Settings } from './settings.ts';

const API = 'https://api.github.com';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

/** A plain sentence for a failed GitHub response. */
export function explain(res: Response, s: Settings, what: string): string {
  const where = s.owner + '/' + s.repo;
  if (res.status === 401) return 'GitHub did not accept the token. It may be mistyped or expired. Make a new one and paste it in Settings.';
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const at = reset ? new Date(reset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'an hour';
      return 'GitHub\'s hourly limit for this token is used up. Try again after ' + at + '.';
    }
    return 'The token is not allowed to read ' + where + '. Check that it covers that repository with Contents set to read and write.';
  }
  if (res.status === 404) return 'GitHub cannot find ' + what + ' in ' + where + '. Check the owner, repository and branch in Settings, and that the token covers that repository.';
  if (res.status === 409) return where + ' is empty, so there is no vault to read yet.';
  return 'GitHub answered ' + res.status + ' while reading ' + what + '. Try again in a minute.';
}

export class GitHubSource implements VaultSource {
  readonly key: string;
  readonly label: string;
  private s: Settings;
  private fetch: Fetch;

  constructor(settings: Settings, fetchImpl?: Fetch) {
    this.s = settings;
    this.fetch = fetchImpl || ((input, init) => globalThis.fetch(input, init));
    this.key = 'github:' + settings.owner + '/' + settings.repo + '@' + settings.branch + ':' + settings.root;
    this.label = settings.owner + '/' + settings.repo;
  }

  private repoUrl(rest: string): string {
    return API + '/repos/' + encodeURIComponent(this.s.owner) + '/' + encodeURIComponent(this.s.repo) + rest;
  }

  private async get(url: string, what: string, accept = 'application/vnd.github+json', fresh = false): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetch(url, {
        headers: { Accept: accept, Authorization: 'Bearer ' + this.s.token },
        cache: fresh ? 'no-store' : 'default'
      });
    } catch {
      throw new GitHubError('Cannot reach GitHub. Check the connection; the app shows what it saved last time.', 0);
    }
    if (!res.ok) throw new GitHubError(explain(res, this.s, what), res.status);
    return res;
  }

  /** Every file under the vault root on the branch, with its blob sha. */
  async tree(): Promise<{ files: FileEntry[]; truncated: boolean }> {
    const res = await this.get(this.repoUrl('/git/trees/' + encodeURIComponent(this.s.branch) + '?recursive=1'), 'the branch "' + this.s.branch + '"', undefined, true);
    const body = (await res.json()) as { tree?: { path: string; type: string; sha: string }[]; truncated?: boolean };
    const prefix = this.s.root ? this.s.root + '/' : '';
    const files: FileEntry[] = [];
    (body.tree || []).forEach((e) => {
      if (e.type !== 'blob' || !e.path.startsWith(prefix)) return;
      files.push({ path: e.path.slice(prefix.length), sha: e.sha });
    });
    return { files, truncated: Boolean(body.truncated) };
  }

  /** One file's text, by its blob sha. Blobs never change, so a sha the cache holds is never fetched twice. */
  async read(path: string, sha: string): Promise<string> {
    const res = await this.get(this.repoUrl('/git/blobs/' + sha), path, 'application/vnd.github.raw+json');
    return res.text();
  }

  /** Checks the token, the repository and the branch, and says what it found in a plain sentence. */
  async test(): Promise<string> {
    await this.get(this.repoUrl(''), 'the repository', undefined, true);
    const { files } = await this.tree();
    const hasSchema = files.some((f) => f.path === 'System/schema.json');
    if (!hasSchema) {
      return 'Connected to ' + this.label + ', but there is no System/schema.json' + (this.s.root ? ' under "' + this.s.root + '"' : '') + '. Check the vault folder setting.';
    }
    const books = files.filter((f) => /^Series\/[^/]+\/Books\/[^/]+\/Book\.md$/.test(f.path)).length;
    return 'Connected to ' + this.label + ' on ' + this.s.branch + '. Found the schema and ' + books + (books === 1 ? ' book.' : ' books.');
  }
}
