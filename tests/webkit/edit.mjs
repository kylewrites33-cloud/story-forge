// The Edit room's Accept, Reject and Undo in a real WebKit (the iPad's engine), driven over plain WebDriver.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DEMO, makeFake } from './fake.mjs';
const APP = 'http://localhost:4173/';
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const SCENE = BOOK + '/Scenes/S-001 The Crack.md';
const CH1 = BOOK + '/Changes/Chapter 1 changes.md';
const T1 = BOOK + '/Tasks/T-001 Say why Mara hides the crack.md';
const patch = (files) => { files.set(CH1, files.get(CH1).replace('Why: Style Guide: times to the minute', 'Why: To-do T-001. Style Guide: times to the minute')); };
const kyle = (text, id) => { const m = new RegExp('## ' + id + ' [^\\n]*\\n(?:[^\\n#][^\\n]*\\n)*?Kyle: (\\w+)').exec(text); return m ? m[1] : null; };
const SKEY = 'github:kylewrites33-cloud/author-business@main:';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fake = makeFake(DEMO);
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (fake.st.down) { req.socket.destroy(); return; }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => { const r = fake.handle(req.method, 'http://x' + req.url, body); res.writeHead(r.status, { ...r.headers, ...cors }); res.end(r.body); });
}).listen(4488);

const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1600x1200x24'], { stdio: 'ignore' });
await sleep(800);
const driver = spawn('WebKitWebDriver', ['--port=4477'], { env: { ...process.env, DISPLAY: ':99' }, stdio: 'ignore' });
await sleep(1200);
const wd = async (method, path, body) => {
  const r = await fetch('http://127.0.0.1:4477' + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (j.value && j.value.error) throw new Error(j.value.error + ': ' + j.value.message);
  return j.value;
};
let sid = '';
const done = async (code) => { try { if (sid) await wd('DELETE', '/session/' + sid); } catch {} driver.kill(); xvfb.kill(); server.close(); process.exit(code); };
try {
  const s = await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'MiniBrowser', 'webkitgtk:browserOptions': { binary: '/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', args: ['--automation'] } } } });
  sid = s.sessionId;
  const js = (script, ...args) => wd('POST', '/session/' + sid + '/execute/sync', { script, args });
  const until = async (script, what, ms = 15000) => { const end = Date.now() + ms; for (;;) { const v = await js(script); if (v) return v; if (Date.now() > end) throw new Error('timed out: ' + what); await sleep(150); } };
  const press = (label, within = 'document') => js("const b = [..." + within + ".querySelectorAll('button')].find((x) => x.textContent.trim() === arguments[0]); if (!b) throw new Error('no button ' + arguments[0]); b.click(); return true;", label);
  const type = (sel, value) => js("const i = document.querySelector(arguments[0]); if (!i) throw new Error('no ' + arguments[0]); const proto = i.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, arguments[1]); i.dispatchEvent(new Event('input', { bubbles: true })); return true;", sel, value);
  const cards = (title) => js("return [...document.querySelectorAll('li.task')].filter((x) => x.textContent.includes(arguments[0])).map((x) => x.textContent)", title);
  const boxOps = (key) => js("return JSON.parse(localStorage.getItem('story-forge.outbox.' + arguments[0]) || '[]').reduce((n, a) => n + a.ops.length, 0)", key);
  const clear = "return !localStorage.getItem('story-forge.outbox." + SKEY + "')";
  const sync = () => js("const b = [...document.querySelectorAll('button')].find((x) => /^(Synced|Sync|Offline|Saving.*|\\d+ waiting)$/.test(x.textContent.trim())); b.click(); return b.textContent;");
  const addTask = async (title) => {
    await press('Add a to-do');
    await until("return !!document.querySelector('.add-task textarea')", 'the add form');
    await type('.add-task textarea', title);
    await press('Add');
    await until("return [...document.querySelectorAll('li.task')].some((x) => x.textContent.includes(" + JSON.stringify(title) + "))", 'the new to-do shows: ' + title, 2000);
  };

  const cardBtn = (id, label) => js("const a = document.querySelector('article[data-card=\"' + arguments[0] + '\"]'); if (!a) throw new Error('no card ' + arguments[0]); const b = [...a.querySelectorAll('button')].find((x) => x.textContent.trim() === arguments[1]); if (!b) throw new Error('no ' + arguments[1] + ' on ' + arguments[0]); b.click(); return true;", id, label);
  const decided = (id) => js("const a = document.querySelector('article[data-card=\"' + arguments[0] + '\"]'); return Boolean(a && a.classList.contains('decided'))", id);
  const toChanges = async () => {
    await js("location.hash = arguments[0]; return true", '#/write/' + encodeURIComponent(SCENE));
    await until("return !!document.querySelector('button.side-more')", 'the writing page', 20000);
    await sleep(1200);
    for (let i = 0; i < 6 && !(await js("return !!document.querySelector('article[data-card]')")); i++) {
      await js("const t = [...document.querySelectorAll('[role=tab]')].find((x) => /^Changes/.test(x.textContent.trim())); if (t) t.click(); return true;");
      await sleep(400);
    }
    await until("return !!document.querySelector('article[data-card=\"C-01\"]')", 'the change cards');
  };
  for (const [w, h] of [[1180, 820], [1366, 1024]]) {
    await wd('POST', '/session/' + sid + '/window/rect', { width: w, height: h });
    await wd('POST', '/session/' + sid + '/url', { url: APP + '#/todo' });
    await js("localStorage.clear(); return true");
    await wd('POST', '/session/' + sid + '/refresh', {});
    await until("return /To-do/.test(document.body.textContent)", 'the app');
    if (w === 1180) console.log('engine:', await js('return navigator.userAgent'));
    await js("const real = window.fetch.bind(window); window.fetch = (u, i) => real(String(u).replace('https://api.github.com', 'http://localhost:4488'), i); return true;");
    fake = makeFake(DEMO, patch);
    await js("location.hash = '#/settings'; return true");
    await until("return !!document.querySelector('form.settings input')", 'settings form');
    await type('form.settings input', 'test-token');
    await press('Save');
    await sleep(300);
    await js("location.hash = '#/todo'; return true");
    await until("return /Synced/.test(document.body.textContent)", 'github sync', 30000);
    await toChanges();
    const git = () => fake.st.log.filter((c) => c.via === 'git');
    assert.equal(await js("return document.querySelector('.writer').textContent.includes('a tin lantern')"), true);
    await cardBtn('C-01', 'Accept');
    await until("return document.querySelector('article[data-card=\"C-01\"]').classList.contains('decided')", 'C-01 shows as accepted', 2000);
    assert.equal(await js("return document.querySelector('.writer').textContent.includes('a brass lantern')"), true);
    await until(clear, 'the answer saves');
    assert.equal(git().length, 1);
    assert.deepEqual([...git()[0].paths].sort(), [CH1, T1].sort());
    assert.equal(kyle(fake.headTree().get(CH1), 'C-01'), 'kept');
    assert.match(fake.headTree().get(T1), /^status: done$/m);
    await sleep(900);
    assert.equal(await decided('C-01'), true, 'still accepted once the save has landed');
    // GitHub out of reach: Reject and Undo wait as one change for the note, then go up as one save.
    fake.st.down = true;
    await cardBtn('C-02', 'Reject');
    await sleep(300);
    await cardBtn('C-01', 'Undo');
    await sleep(900);
    assert.equal(await decided('C-02'), true);
    assert.equal(await decided('C-01'), false);
    assert.equal(await js("return document.querySelector('.writer').textContent.includes('a tin lantern')"), true, 'Undo takes the words back out');
    const waiting = await js("return JSON.parse(localStorage.getItem('story-forge.outbox.' + arguments[0]) || '[]').flatMap((a) => a.ops).filter((op) => op.path === arguments[1]).map((op) => op.edit.marks)", SKEY, CH1);
    assert.deepEqual(waiting, [{ 'C-02': 'no', 'C-01': 'open' }]);
    const n = git().length;
    fake.st.down = false;
    await js("window.dispatchEvent(new Event('online')); return true");
    await until(clear, 'the waiting answers go up', 30000);
    assert.equal(git().length, n + 1);
    assert.equal(kyle(fake.headTree().get(CH1), 'C-01'), 'open');
    assert.equal(kyle(fake.headTree().get(CH1), 'C-02'), 'no');
    assert.match(fake.headTree().get(T1), /^status: open$/m);
    assert.equal(await js('return document.documentElement.scrollWidth > window.innerWidth + 1'), false, 'no sideways scroll');
    console.log('ok webkit', w + 'x' + h, fake.st.log.map((c) => c.via + ':' + c.paths.length).join(' '));
    await js('localStorage.clear(); return true');
  }
  console.log('WEBKIT ALL OK');
  await done(0);
} catch (e) {
  console.log('FAILED', e.stack || e);
  await done(1);
}
