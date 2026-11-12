// Chapters in a real WebKit (the iPad's engine), driven over plain WebDriver.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DEMO, makeFake } from './fake.mjs';
const APP = 'http://localhost:4173/';
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const SCENE = BOOK + '/Scenes/S-001 The Crack.md';
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

  const boxLen = (key) => js("return JSON.parse(localStorage.getItem('story-forge.outbox.' + arguments[0]) || '[]').length", key);
  const clear = "return !localStorage.getItem('story-forge.outbox." + SKEY + "')";
  const rows = () => js("return [...document.querySelectorAll('nav.scene-list a.side-chapter-row')].map((e) => e.getAttribute('title'))");
  const list = async () => { if (!(await js("return !!document.querySelector('nav.scene-list')"))) await press('Chapters'); await until("return !!document.querySelector('nav.scene-list')", 'the chapter list'); };
  const menu = async (n, item) => {
    await list();
    await js("const r = document.querySelectorAll('nav.scene-list a.side-chapter-row')[arguments[0] - 1]; r.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); return true;", n);
    await until("return [...document.querySelectorAll('[role=menuitem]')].some((x) => x.textContent.trim() === " + JSON.stringify(item) + ")", 'the menu');
    await js("[...document.querySelectorAll('[role=menuitem]')].find((x) => x.textContent.trim() === arguments[0]).click(); return true;", item);
  };
  const addForm = async (title) => { await until("return !!document.querySelector('.side-add-form input')", 'the add form'); await type('.side-add-form input', title); await press('Add and start writing'); };
  const addAtEnd = async (title) => { await list(); await js("document.querySelector('button.side-add').click(); return true;"); await addForm(title); };
  const onScene = (name) => until("return decodeURIComponent(location.hash).endsWith(" + JSON.stringify(name) + ")", 'the page for ' + name);
  const write = async (words) => {
    await until("return !!document.querySelector('[contenteditable=true]')", 'the writing box');
    await js("const ed = document.querySelector('[contenteditable=true]'); ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('insertText', false, arguments[0]); return true;", words);
  };
  const saveKey = () => js("const ed = document.querySelector('[contenteditable=true]'); ed.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); return true;");
  const text = (file) => fake.headTree().get(BOOK + '/' + file);
  const wait = async (fn, what, ms = 12000) => { const end = Date.now() + ms; for (;;) { if (fn()) return; if (Date.now() > end) throw new Error('timed out: ' + what); await sleep(120); } };

  for (const [w, h] of [[1180, 820], [1366, 1024]]) {
    await wd('POST', '/session/' + sid + '/window/rect', { width: w, height: h });
    await wd('POST', '/session/' + sid + '/url', { url: APP + '#/settings' });
    await js('localStorage.clear(); return true');
    await wd('POST', '/session/' + sid + '/refresh', {});
    await until("return !!document.querySelector('form.settings input')", 'settings form');
    if (w === 1180) console.log('engine:', await js('return navigator.userAgent'));
    // The pretend GitHub: send api.github.com calls to it, then connect through Settings as Kyle would.
    await js("const real = window.fetch.bind(window); window.fetch = (u, i) => real(String(u).replace('https://api.github.com', 'http://localhost:4488'), i); return true;");
    fake = makeFake(DEMO);
    await js("const i = document.querySelector('form.settings input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'test-token'); i.dispatchEvent(new Event('input', { bubbles: true })); return true;");
    await press('Save');
    await sleep(300);
    await js("location.hash = arguments[0]; return true", '#/write/' + encodeURIComponent(SCENE));
    await until("return [...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Chapters')", 'the writing page', 30000);
    await sleep(800);
    // A new last chapter: opens at once, one save, takes words.
    await addAtEnd('Harbour');
    await onScene('S-009 Harbour.md');
    await until(clear, 'the new chapter saved');
    assert.equal(fake.st.log.length, 1);
    assert.equal(fake.st.log[0].via, 'git');
    assert.match(fake.st.log[0].message, /^scenes: add S-009 Harbour\n/);
    await write('Rain on the quay.');
    await saveKey();
    await wait(() => /Rain on the quay\./.test(text('Scenes/S-009 Harbour.md')), 'words saved into the new scene');
    // GitHub out of reach: the chapter is there at once, takes words, and waits.
    fake.st.down = true;
    await addAtEnd('Offline six');
    await onScene('S-010 Offline six.md');
    await write('Typed with no connection.');
    await saveKey();
    await sleep(900);
    // The new chapter waits; so may the words typed a moment ago (the typing count), which is not what this checks.
    assert.equal(await js("return JSON.parse(localStorage.getItem('story-forge.outbox.' + arguments[0]) || '[]').filter((a) => !a.ops.every((o) => o.path.startsWith('Writing Log/'))).length", SKEY), 1);
    await list();
    assert.equal((await rows()).pop(), 'Chapter 6: Offline six');
    // Another device takes that number meanwhile.
    fake.commitTo({ [BOOK + '/Scenes/S-010 Elsewhere.md']: '---\ntype: scene\nid: S-010\ntitle: Elsewhere\nstatus: drafted\nchapter: 5\norder: 8.5\nwords: 2\n---\n\nOther words.\n' }, 'scenes: add S-010 Elsewhere', 'team');
    fake.st.down = false;
    await js("window.dispatchEvent(new Event('online')); return true");
    await until(clear, 'the waiting chapter saved');
    await onScene('S-011 Offline six.md');
    await sleep(600);
    assert.match(await js("return document.querySelector('[contenteditable=true]').innerText"), /Typed with no connection\./);
    await saveKey();
    await wait(() => /Typed with no connection\./.test(text('Scenes/S-011 Offline six.md') || ''), 'offline words saved under the new number');
    assert.equal(text('Scenes/S-010 Offline six.md'), undefined);
    // Move chapter 2 up: one save.
    const n = fake.st.log.length;
    await sleep(400);
    await menu(2, 'Move chapter');
    await until("return [...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Up one')", 'the move form');
    await press('Up one');
    await wait(() => fake.st.log.slice(n).some((c) => /^chapters: /.test(c.message)), 'the move saved');
    assert.equal(fake.st.log.slice(n).filter((c) => /^chapters: /.test(c.message)).length, 1);
    await until("return (document.querySelector('nav.scene-list a.side-chapter-row') || {title: ''}).getAttribute('title') === 'Chapter 1: Thaw'", 'the list shows the move');
    assert.match(text('Scenes/S-003 The Warden.md'), /^chapter: 1$/m);
    assert.ok(text('Changes/Chapter 2 changes.md') && !text('Changes/Chapter 1 changes.md'));
    // A chapter in the middle: one save with its scene.
    const m = fake.st.log.length;
    await menu(1, 'Add a chapter below');
    await addForm('Wedge');
    await onScene('S-012 Wedge.md');
    const adds = fake.st.log.slice(m).filter((c) => /^chapters: /.test(c.message));
    assert.equal(adds.length, 1);
    assert.match(adds[0].message, /^chapters: room for a new chapter 2\n\nSaved together with:\n- scenes: add S-012 Wedge\n/);
    await list();
    assert.deepEqual((await rows()).slice(0, 3), ['Chapter 1: Thaw', 'Chapter 2: Wedge', 'Chapter 3: Frost']);
    // Out of reach: a chapter in the middle says so and nothing changes.
    fake.st.down = true;
    const k = fake.st.log.length;
    await menu(1, 'Add a chapter below');
    await addForm('Nope');
    await until("return /Cannot reach GitHub|Connect to the internet/.test(document.querySelector('nav.scene-list').textContent)", 'the plain sentence');
    assert.equal(fake.st.log.length, k);
    assert.equal(await boxLen(SKEY), 0);
    fake.st.down = false;
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
