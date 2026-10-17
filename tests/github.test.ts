import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitHubSource } from '../src/lib/github.ts';
import { DEFAULTS, normalise } from '../src/lib/settings.ts';

const settings = { ...DEFAULTS, token: 'test-token', root: 'vault' };

function fakeFetch(routes: Record<string, () => Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const hit = Object.keys(routes).find((k) => url.endsWith(k));
    return hit ? routes[hit]() : new Response('{}', { status: 404 });
  };
  return { fn, calls };
}

test('lists the tree under the vault folder and drops folders', async () => {
  const { fn, calls } = fakeFetch({
    '/git/trees/main?recursive=1': () => Response.json({
      truncated: false,
      tree: [
        { path: 'README.md', type: 'blob', sha: 'r' },
        { path: 'vault', type: 'tree', sha: 't' },
        { path: 'vault/System/schema.json', type: 'blob', sha: 'a' },
        { path: 'vault/Series/Ember Road/Series.md', type: 'blob', sha: 'b' }
      ]
    })
  });
  const src = new GitHubSource(settings, fn);
  const { files } = await src.tree();
  assert.deepEqual(files, [{ path: 'System/schema.json', sha: 'a' }, { path: 'Series/Ember Road/Series.md', sha: 'b' }]);
  assert.equal(calls[0].url, 'https://api.github.com/repos/kylewrites33-cloud/author-business/git/trees/main?recursive=1');
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer test-token');
  assert.equal(calls[0].init?.cache, 'no-store', 'the tree is always fresh');
});

test('reads a file as raw text by its blob sha', async () => {
  const { fn, calls } = fakeFetch({ '/git/blobs/abc123': () => new Response('---\ntype: scene\n---\n') });
  const text = await new GitHubSource(settings, fn).read('Series/x.md', 'abc123');
  assert.equal(text, '---\ntype: scene\n---\n');
  assert.equal((calls[0].init?.headers as Record<string, string>).Accept, 'application/vnd.github.raw+json');
});

test('turns GitHub errors into plain sentences', async () => {
  const cases: [Response, RegExp][] = [
    [new Response('', { status: 401 }), /did not accept the token/],
    [new Response('', { status: 404 }), /cannot find the branch "main" in kylewrites33-cloud\/author-business/],
    [new Response('', { status: 403 }), /not allowed to read/],
    [new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' } }), /hourly limit/],
    [new Response('', { status: 409 }), /is empty/]
  ];
  for (const [res, re] of cases) {
    const src = new GitHubSource(settings, async () => res);
    await assert.rejects(src.tree(), re);
  }
  const offline = new GitHubSource(settings, async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(offline.tree(), /Cannot reach GitHub/);
});

test('the connection test reports what it found', async () => {
  const { fn } = fakeFetch({
    '/repos/kylewrites33-cloud/author-business': () => Response.json({}),
    '/git/trees/main?recursive=1': () => Response.json({
      tree: [
        { path: 'System/schema.json', type: 'blob', sha: 'a' },
        { path: 'Series/Quest Declined/Books/1 Quest Declined/Book.md', type: 'blob', sha: 'b' }
      ]
    })
  });
  const msg = await new GitHubSource({ ...settings, root: '' }, fn).test();
  assert.equal(msg, 'Connected to kylewrites33-cloud/author-business on main. Found the schema and 1 book.');
});

test('settings are trimmed and the vault folder loses its slashes', () => {
  assert.deepEqual(normalise({ owner: ' kyle ', repo: 'vault ', branch: '', root: '/notes/', token: ' t ' }), { owner: 'kyle', repo: 'vault', branch: 'main', root: 'notes', token: 't' });
});
