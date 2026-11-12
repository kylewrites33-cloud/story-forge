// Reads the vault through the GitHub REST API: one call for the whole file tree, then one call per changed file.
import type { CommitPlan, CommitResult, FileEntry, Head, SaveEntry, VaultSource } from './types.ts';
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

/** Did GitHub refuse because the app asked too much too fast (its hourly limit, or "slow down")? Nothing is wrong with
 * the save itself: it waits and goes up later. */
export function limited(res: Response): boolean {
  return res.status === 429 || (res.status === 403 && (res.headers.get('x-ratelimit-remaining') === '0' || res.headers.get('retry-after') != null));
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
    if (res.headers.get('retry-after') != null || res.status === 429) return 'GitHub asked the app to slow down. ' + (doing === 'read' ? 'Try again in a few minutes.' : 'What you did is kept on this device. Press Sync in a few minutes to send it.');
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

/** The sha git gives a file with this text (its blob sha), worked out here so a save does not need a call to ask for it. */
export async function blobSha(text: string): Promise<string> {
  const body = new TextEncoder().encode(text);
  const head = new TextEncoder().encode('blob ' + body.length + '\0');
  const all = new Uint8Array(head.length + body.length);
  all.set(head, 0);
  all.set(body, head.length);
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-1', all));
  let out = '';
  for (let i = 0; i < hash.length; i++) out += hash[i].toString(16).padStart(2, '0');
  return out;
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
  /** The branch as this app's own last save left it, so the next save within two minutes need not ask where the branch is.
   * If anything else saved meanwhile, GitHub refuses the save and it starts again from a fresh look. */
  private last: { commit: string; tree: string; at: number } | null = null;

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
    if (!res.ok) throw new GitHubError(explain(res, this.s, what), limited(res) ? 429 : res.status);
    return res;
  }

  /** Every file under the vault root on the branch, with its blob sha. */
  async tree(): Promise<{ files: FileEntry[]; truncated: boolean }> {
    return this.treeAt(encodeURIComponent(this.s.branch), true);
  }

  /** Every file under the vault root in one tree (a branch name, or a tree's sha, which never changes). */
  private async treeAt(tree: string, fresh: boolean): Promise<{ files: FileEntry[]; truncated: boolean }> {
    const res = await this.get(this.repoUrl('/git/trees/' + tree + '?recursive=1'), 'the branch "' + this.s.branch + '"', undefined, fresh);
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

  /** One save of any number of files as one commit, all or nothing: read at the branch's commit, build a tree on it, commit,
   * and move the branch (never forced). If the branch moved meanwhile, read and build again on the newer commit. */
  async commit(build: (head: Head) => Promise<CommitPlan | null>): Promise<CommitResult | null> {
    const prefix = this.s.root ? this.s.root + '/' : '';
    const branch = this.s.branch.split('/').map(encodeURIComponent).join('/');
    const what = 'the branch "' + this.s.branch + '"';
    // A picture or a Word file is sent once, even when the save has to be planned again.
    const sent = new Map<string, string>();
    let checked: typeof this.last = null;
    for (let attempt = 0; ; attempt++) {
      const hint = this.last && Date.now() - this.last.at < 120000 ? this.last : null;
      this.last = null;
      let parent: string, base: string;
      if (hint) { parent = hint.commit; base = hint.tree; }
      else {
        const head = (await (await this.get(this.repoUrl('/git/ref/heads/' + branch), what, undefined, true)).json()) as { object: { sha: string } };
        parent = head.object.sha;
        base = '';
      }
      const baseTree = async (): Promise<string> => {
        if (!base) base = ((await (await this.get(this.repoUrl('/git/commits/' + parent), what)).json()) as { tree: { sha: string } }).tree.sha;
        return base;
      };
      const read: Head['read'] = async (path) => {
        try {
          const res = await this.get(this.contentsUrl(path) + '?ref=' + parent, path);
          const body = (await res.json()) as { sha?: string; content?: string; encoding?: string };
          if (!body.sha || body.encoding !== 'base64' || typeof body.content !== 'string') {
            throw new GitHubError(path + ' is too large for the app to change. Ask the team to change it.', 413);
          }
          return { text: fromBase64(body.content), sha: body.sha };
        } catch (e) {
          if (e instanceof GitHubError && e.status === 404) return null;
          throw e;
        }
      };
      const plan = await build({ read, files: async () => (await this.treeAt(await baseTree(), false)).files });
      const removes = (plan && plan.removes) || [];
      const blobs = (plan && plan.blobs) || [];
      if (!plan || (!plan.writes.length && !removes.length && !blobs.length)) {
        // Nothing to do on the version this device last saved may only mean the team has saved since (a card the Writer
        // just made, which Kyle chose on): plan again on the branch as it is now before saying there was nothing.
        if (hint) { checked = hint; continue; }
        // The branch was where this device left it: keep the shortcut for the next save.
        if (checked && checked.commit === parent) this.last = checked;
        return null;
      }
      await baseTree();
      const shas: Record<string, string> = {};
      for (const b of blobs) {
        let sha = sent.get(b.base64);
        if (!sha) {
          sha = ((await this.send('POST', this.repoUrl('/git/blobs'), { content: b.base64, encoding: 'base64' }, b.path)) as { sha: string }).sha;
          sent.set(b.base64, sha);
        }
        shas[b.path] = sha;
      }
      const entries = plan.writes.map((f) => ({ path: prefix + f.path, mode: '100644', type: 'blob', content: f.text } as Record<string, unknown>))
        .concat(blobs.map((b) => ({ path: prefix + b.path, mode: '100644', type: 'blob', sha: shas[b.path] })))
        .concat(removes.map((p) => ({ path: prefix + p, mode: '100644', type: 'blob', sha: null })));
      const tree = (await this.send('POST', this.repoUrl('/git/trees'), { base_tree: base, tree: entries }, 'the save')) as { sha: string };
      const made = (await this.send('POST', this.repoUrl('/git/commits'), { message: plan.message, tree: tree.sha, parents: [parent] }, 'the save')) as { sha: string };
      try {
        await this.send('PATCH', this.repoUrl('/git/refs/heads/' + branch), { sha: made.sha, force: false }, what);
      } catch (e) {
        // 422: the branch is no longer where this save started (the team, another device). Start again from where it is now.
        if (e instanceof GitHubError && e.status === 422 && attempt < 4) continue;
        throw e;
      }
      this.last = { commit: made.sha, tree: tree.sha, at: Date.now() };
      for (const f of plan.writes) {
        // Worked out here; asked for only where the browser cannot (no crypto on a page that is not https).
        try { shas[f.path] = await blobSha(f.text); } catch { shas[f.path] = (await this.readFresh(f.path)).sha; }
      }
      return { commit: made.sha, shas };
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
    if (!res.ok) throw new GitHubError(explain(res, this.s, what, 'change'), limited(res) ? 429 : res.status);
    return res.json();
  }

  /** A picture's bytes, by its blob sha. */
  async readBytes(path: string, sha: string): Promise<Blob> {
    const res = await this.get(this.repoUrl('/git/blobs/' + sha), path, 'application/vnd.github.raw+json');
    return res.blob();
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
