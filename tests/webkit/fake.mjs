// A pretend GitHub for browser checks: serves the demo vault and takes saves both ways (contents API and git data API).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function blobSha(t) { const b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); }

export function makeFake(dir, patch) {
  const start = new Map();
  const walk = (rel) => { for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) { const r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) walk(r); else if (/\.(md|json)$/.test(r)) start.set(r, fs.readFileSync(path.join(dir, r), 'utf8')); } };
  walk('');
  if (patch) patch(start);
  const trees = new Map([['t0', start]]);
  const commits = new Map([['c0', { tree: 't0', parent: null, message: 'start' }]]);
  const st = { head: 'c0', calls: [], log: [], blobs: 0, fail: null, sent: new Map() };
  const headTree = () => trees.get(commits.get(st.head).tree);
  const commitTo = (files, message, via) => {
    const tree = new Map(headTree());
    Object.entries(files).forEach(([p, t]) => (t == null ? tree.delete(p) : tree.set(p, t)));
    const id = String(commits.size + 1);
    trees.set('t' + id, tree); commits.set('c' + id, { tree: 't' + id, parent: st.head, message });
    st.head = 'c' + id; st.log.push({ via, message, paths: Object.keys(files) });
  };
  const json = (body, status = 200) => ({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  const handle = (method, url, bodyText) => {
    const u = new URL(url);
    const p = decodeURIComponent(u.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, ''));
    const body = bodyText ? JSON.parse(bodyText) : null;
    st.calls.push(method + ' ' + p);
    if (st.fail) { const f = st.fail(method, p); if (f) return f; }
    if (method === 'GET' && p === '') return json({ full_name: 'x/y' });
    if (method === 'GET' && p.startsWith('/git/trees/')) {
      const id = p.slice(11);
      const tr = id === 'main' ? headTree() : trees.get(id);
      return tr ? json({ truncated: false, tree: [...tr].map(([path, t]) => ({ path, type: 'blob', sha: blobSha(t) })) }) : json({}, 404);
    }
    if (method === 'GET' && p.startsWith('/git/blobs/')) {
      st.blobs++;
      for (const t of trees.values()) for (const text of t.values()) if (blobSha(text) === p.slice(11)) {
        if (text.startsWith('BYTES:')) return { status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/octet-stream' }, body: Buffer.from(text.slice(6), 'base64') };
        return { status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/plain; charset=utf-8' }, body: text };
      }
      return json({}, 404);
    }
    if (method === 'GET' && p === '/git/ref/heads/main') return json({ object: { sha: st.head } });
    if (method === 'GET' && p.startsWith('/git/commits/')) return json({ tree: { sha: commits.get(p.slice(13)).tree } });
    if (p.startsWith('/contents/')) {
      const file = p.slice(10);
      if (method === 'GET') {
        const ref = u.searchParams.get('ref');
        const c = commits.get(ref === 'main' || !ref ? st.head : ref);
        const text = c && trees.get(c.tree).get(file);
        return text == null ? json({}, 404) : json({ sha: blobSha(text), encoding: 'base64', content: Buffer.from(text, 'utf8').toString('base64') });
      }
      if (method === 'DELETE') {
        const cur = headTree().get(file);
        if (cur == null || blobSha(cur) !== body.sha) return json({}, 409);
        commitTo({ [file]: null }, body.message, 'contents');
        return json({ commit: {} });
      }
      if (method === 'PUT') {
        const cur = headTree().get(file);
        if ((cur == null ? undefined : blobSha(cur)) !== body.sha) return json({}, 409);
        const text = Buffer.from(body.content, 'base64').toString('utf8');
        commitTo({ [file]: text }, body.message, 'contents');
        return json({ content: { sha: blobSha(text) } });
      }
    }
    if (method === 'POST' && p === '/git/blobs') {
      if (body.encoding !== 'base64' || typeof body.content !== 'string') return json({}, 422);
      const id = 'bx' + (st.sent.size + 1); st.sent.set(id, body.content);
      return json({ sha: id }, 201);
    }
    if (method === 'POST' && p === '/git/trees') {
      const tree = new Map(trees.get(body.base_tree));
      for (const e of body.tree) {
        if (e.sha === null) { if (!tree.has(e.path)) return json({}, 422); tree.delete(e.path); }
        else if (e.sha) { if (!st.sent.has(e.sha)) return json({}, 422); tree.set(e.path, 'BYTES:' + st.sent.get(e.sha)); }
        else tree.set(e.path, e.content);
      }
      const id = 'tx' + trees.size; trees.set(id, tree); st.pending = { ...(st.pending || {}), [id]: body.tree.map((e) => e.path) };
      return json({ sha: id }, 201);
    }
    if (method === 'POST' && p === '/git/commits') {
      const id = 'cx' + commits.size; commits.set(id, { tree: body.tree, parent: body.parents[0], message: body.message });
      return json({ sha: id }, 201);
    }
    if (method === 'PATCH' && p === '/git/refs/heads/main') {
      const c = commits.get(body.sha);
      if (body.force !== false || c.parent !== st.head) return json({ message: 'Update is not a fast forward' }, 422);
      st.head = body.sha; st.log.push({ via: 'git', message: c.message, paths: st.pending[c.tree] });
      return json({ object: { sha: body.sha } });
    }
    if (method === 'GET' && p === '/commits') return json([]);
    return json({}, 404);
  };
  return { st, handle, headTree, commitTo };
}

export async function install(context, fake) {
  await context.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (fake.st.down) return route.abort('internetdisconnected');
    const r = fake.handle(req.method(), req.url(), req.postData());
    return route.fulfill(r);
  });
}

/** The demo vault beside the tests: what the pretend GitHub starts from. */
export const DEMO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'demo-vault');
