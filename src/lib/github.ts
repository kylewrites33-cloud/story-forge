// Reads the vault through the GitHub REST API: one call for the whole file tree, then one call per changed file.
import type { FileEntry, SaveEntry, VaultSource } from './types.ts';
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
export function explain(res: Response, s: Settings, what: string, doing = 'read'): string {
  const where = s.owner + '/' + s.repo;
  if (res.status === 401) return 'GitHub did not accept the token. It may be mistyped or expired. Make a new one and paste it in Settings.';
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const at = reset ? new Date(reset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'an hour';
      return 'GitHub\'s hourly limit for this token is used up. Try again after ' + at + '.';
    }
    return 'The token is not allowed to ' + doing + ' ' + where + '. Check that it covers that repository with Contents set to read and write.';
  }
  if (res.status === 404) return 'GitHub cannot find ' + what + ' in ' + where + '. Check the owner, repository and branch in Settings, and that the token covers that repository.';
  if (res.status === 409) return where + ' is empty, so there is no vault to read yet.';
  return 'GitHub answered ' + res.status + ' while ' + (doing === 'read' ? 'reading ' : 'saving ') + what + '. Try again in a minute.';
}

/** Text to base64 as UTF-8, for the contents API. */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** A commit as a save: its first line, and the agent from its Agent: line (none means Kyle made it). */
export function saveEntry(commit: string, message: string, date: string): SaveEntry {
  const m = /^Agent:\s*(.+)$/m.exec(message);
  return { commit, date, message: message.split('\n')[0].trim(), agent: m ? m[1].trim() : '' };
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

  private contentsUrl(path: string): string {
    const full = (this.s.root ? this.s.root + '/' : '') + path;
    return this.repoUrl('/contents/' + full.split('/').map(encodeURIComponent).join('/'));
  }

  /** A note as the branch has it this moment, with its blob sha. */
  async readFresh(path: string): Promise<{ text: string; sha: string }> {
    const res = await this.get(this.contentsUrl(path) + '?ref=' + encodeURIComponent(this.s.branch), path, undefined, true);
    const body = (await res.json()) as { sha?: string; content?: string; encoding?: string };
    if (!body.sha || body.encoding !== 'base64' || typeof body.content !== 'string') {
      throw new GitHubError(path + ' is too large for the app to change. Ask the team to change it.', 413);
    }
    return { text: fromBase64(body.content), sha: body.sha };
  }

  /** Replace one file as one commit on the branch, or add a new one when `sha` is empty.
   * The commit is made with Kyle's token, so it counts as his. */
  async write(path: string, text: string, sha: string, message: string): Promise<string> {
    return this.put(path, toBase64(text), sha, message);
  }

  /** Several new files as one commit, through git's own objects: the branch's commit, a tree with the files added, a
   * commit on it, and the branch moved to it (never forced: if the branch moved meanwhile, it starts again). */
  async writeMany(files: { path: string; text: string }[], message: string): Promise<void> {
    const prefix = this.s.root ? this.s.root + '/' : '';
    const ref = this.repoUrl('/git/refs/heads/' + this.s.branch.split('/').map(encodeURIComponent).join('/'));
    for (let attempt = 0; ; attempt++) {
      const head = (await (await this.get(this.repoUrl('/git/ref/heads/' + this.s.branch.split('/').map(encodeURIComponent).join('/')), 'the branch "' + this.s.branch + '"', undefined, true)).json()) as { object: { sha: string } };
      const parent = head.object.sha;
      const commit = (await (await this.get(this.repoUrl('/git/commits/' + parent), 'the branch "' + this.s.branch + '"')).json()) as { tree: { sha: string } };
      const tree = (await this.send('POST', this.repoUrl('/git/trees'), { base_tree: commit.tree.sha, tree: files.map((f) => ({ path: prefix + f.path, mode: '100644', type: 'blob', content: f.text })) }, 'the new files')) as { sha: string };
      const made = (await this.send('POST', this.repoUrl('/git/commits'), { message, tree: tree.sha, parents: [parent] }, 'the save')) as { sha: string };
      try {
        await this.send('PATCH', ref, { sha: made.sha, force: false }, 'the branch "' + this.s.branch + '"');
        return;
      } catch (e) {
        if (e instanceof GitHubError && e.status === 422 && attempt < 3) continue;
        throw e;
      }
    }
  }

  private async send(method: string, url: string, body: unknown, what: string): Promise<unknown> {
    let res: Response;
    try {
      res = await this.fetch(url, {
        method,
        headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + this.s.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch {
      throw new GitHubError('Cannot reach GitHub. Check the connection and try again.', 0);
    }
    if (!res.ok) throw new GitHubError(explain(res, this.s, what, 'change'), res.status);
    return res.json();
  }

  /** A picture (a book cover) as base64, saved the same way as a note. */
  async writeBytes(path: string, base64: string, sha: string, message: string): Promise<string> {
    return this.put(path, base64, sha, message);
  }

  /** A picture's bytes, by its blob sha. */
  async readBytes(path: string, sha: string): Promise<Blob> {
    const res = await this.get(this.repoUrl('/git/blobs/' + sha), path, 'application/vnd.github.raw+json');
    return res.blob();
  }

  private async put(path: string, content: string, sha: string, message: string): Promise<string> {
    let res: Response;
    try {
      res = await this.fetch(this.contentsUrl(path), {
        method: 'PUT',
        headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + this.s.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(sha ? { message, content, sha, branch: this.s.branch } : { message, content, branch: this.s.branch })
      });
    } catch {
      throw new GitHubError('Cannot reach GitHub. Your choice is saved on this device and goes up when the connection is back.', 0);
    }
    // 409: the file changed since `sha`. 422 without a sha: a file of that name is already there.
    if (res.status === 409 || (res.status === 422 && !sha)) {
      const err = new GitHubError(path + ' changed on GitHub while the app was saving it. Sync and try again.', res.status) as GitHubError & { conflict: boolean };
      err.conflict = true;
      throw err;
    }
    if (!res.ok) throw new GitHubError(explain(res, this.s, path, 'change'), res.status);
    const body = (await res.json()) as { content?: { sha?: string } };
    if (!body.content || !body.content.sha) throw new GitHubError('GitHub saved ' + path + ' but did not say how. Press Sync to check.', 500);
    return body.content.sha;
  }

  /** Every commit on the branch that changed this file, newest first (up to 100). */
  async history(path: string): Promise<SaveEntry[]> {
    const full = (this.s.root ? this.s.root + '/' : '') + path;
    const res = await this.get(this.repoUrl('/commits?sha=' + encodeURIComponent(this.s.branch) + '&path=' + encodeURIComponent(full) + '&per_page=100'), 'the history of ' + path, undefined, true);
    const list = (await res.json()) as { sha: string; commit: { message: string; author?: { date?: string }; committer?: { date?: string } } }[];
    return list.map((c) => saveEntry(c.sha, c.commit.message, (c.commit.author && c.commit.author.date) || (c.commit.committer && c.commit.committer.date) || ''));
  }

  /** The newest commits on the branch (up to 100), for the team's history. */
  async recent(): Promise<SaveEntry[]> {
    const path = this.s.root ? '&path=' + encodeURIComponent(this.s.root) : '';
    const res = await this.get(this.repoUrl('/commits?sha=' + encodeURIComponent(this.s.branch) + path + '&per_page=100'), 'the vault\'s recent saves', undefined, true);
    const list = (await res.json()) as { sha: string; commit: { message: string; author?: { date?: string }; committer?: { date?: string } } }[];
    return list.map((c) => saveEntry(c.sha, c.commit.message, (c.commit.author && c.commit.author.date) || (c.commit.committer && c.commit.committer.date) || ''));
  }

  /** A file's text at one commit. */
  async readAt(path: string, commit: string): Promise<string> {
    const res = await this.get(this.contentsUrl(path) + '?ref=' + encodeURIComponent(commit), path);
    const body = (await res.json()) as { content?: string; encoding?: string };
    if (body.encoding !== 'base64' || typeof body.content !== 'string') throw new GitHubError(path + ' is too large for the app to show.', 413);
    return fromBase64(body.content);
  }

  /** Remove one file as one commit on the branch. A stale sha is a conflict, as for write. */
  async remove(path: string, sha: string, message: string): Promise<void> {
    let res: Response;
    try {
      res = await this.fetch(this.contentsUrl(path), {
        method: 'DELETE',
        headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + this.s.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sha, branch: this.s.branch })
      });
    } catch {
      throw new GitHubError('Cannot reach GitHub. Check the connection and try again.', 0);
    }
    if (res.status === 409) {
      const err = new GitHubError(path + ' changed on GitHub while the app was working on it. Sync and try again.', res.status) as GitHubError & { conflict: boolean };
      err.conflict = true;
      throw err;
    }
    if (!res.ok) throw new GitHubError(explain(res, this.s, path, 'change'), res.status);
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
