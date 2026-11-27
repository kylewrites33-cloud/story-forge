// Dictate (2026-11-26, order C-006) in a real WebKit (the iPad's engine): the mic button records (a pretend microphone
// playing a tone), sends raw PCM pieces to a pretend speech server with the password, and the words it answers land at
// the cursor, spaced to fit, as one step to undo. Also: no speech server set says so with a way to Settings, and a refused
// password says so plainly. The browser runs with sound allowed without a press (--autoplay-policy=allow): WebDriver's
// pretend presses do not count as a hand on the screen, so sound would never start. On the iPad the mic is a real press.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DEMO, makeFake } from './fake.mjs';
import { patch, SCENE } from './trial-text.mjs';
const APP = process.env.APP || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fake = makeFake(DEMO, patch);
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => { const r = fake.handle(req.method, 'http://x' + req.url, body); res.writeHead(r.status, { ...r.headers, ...cors }); res.end(r.body); });
}).listen(4488);
// The pretend speech server: keeps each piece, answers the finish with the words.
let speech = { pieces: [], finish: null, auth: [], refuse: false };
const scors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'PUT, POST, OPTIONS' };
const speechServer = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, scors); res.end(); return; }
  const bits = [];
  req.on('data', (c) => bits.push(c));
  req.on('end', () => {
    speech.auth.push(req.headers.authorization || '');
    if (speech.refuse) { res.writeHead(401, scors); res.end('no'); return; }
    if (req.method === 'PUT') { speech.pieces.push({ url: req.url, size: Buffer.concat(bits).length }); res.writeHead(204, scors); res.end(); return; }
    speech.finish = req.url;
    res.writeHead(200, { ...scors, 'content-type': 'application/json' }); res.end(JSON.stringify({ text: 'and then the slime sneezed.' }));
  });
}).listen(4499);
// A home address that never answers (away from home): it takes the request and says nothing.
let silentHits = 0;
const silent = http.createServer((req) => { silentHits++; req.resume(); }).listen(4497);
const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1600x1200x24'], { stdio: 'ignore' });
await sleep(800);
const driver = spawn('WebKitWebDriver', ['--port=4477'], { env: { ...process.env, DISPLAY: ':99' }, stdio: 'ignore' });
await sleep(1200);
const wd = async (method, p, body) => {
  const r = await fetch('http://127.0.0.1:4477' + p, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (j.value && j.value.error) throw new Error(j.value.error + ': ' + j.value.message);
  return j.value;
};
let sid = '', fail = 0;
const ok = (c, what, more = '') => { if (!c) fail++; console.log((c ? 'ok   ' : 'FAIL ') + what + (more ? ' ' + more : '')); };
const done = async (code) => { try { if (sid) await wd('DELETE', '/session/' + sid); } catch {} driver.kill(); xvfb.kill(); server.close(); speechServer.close(); silent.close(); process.exit(code); };
try {
  const s = await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'MiniBrowser', 'webkitgtk:browserOptions': { binary: '/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', args: ['--automation', '--autoplay-policy=allow'] } } } });
  sid = s.sessionId;
  const js = (script, ...args) => wd('POST', '/session/' + sid + '/execute/sync', { script, args });
  const until = async (script, what, ms = 15000) => { const end = Date.now() + ms; for (;;) { const v = await js(script); if (v) return v; if (Date.now() > end) throw new Error('timed out: ' + what); await sleep(150); } };
  const keys = (text) => wd('POST', '/session/' + sid + '/actions', { actions: [{ type: 'key', id: 'kb', actions: [...text].flatMap((ch) => [{ type: 'keyDown', value: ch }, { type: 'keyUp', value: ch }]) }] });
  const click = (sel, label) => js("const b = [...document.querySelectorAll(arguments[0])].find((x) => !arguments[1] || x.textContent.trim() === arguments[1] || x.getAttribute('aria-label') === arguments[1]); if (!b) throw new Error('no ' + arguments[0] + ' ' + arguments[1]); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); b.click(); return true;", sel, label || '');
  const text = () => js("return [...document.querySelectorAll('.cm-line')].map((l) => l.innerText).join('\\n')");
  const reroute = "const real = window.fetch.bind(window); window.fetch = (u, i) => real(String(u).replace('https://api.github.com', 'http://localhost:4488'), i); return true;";
  const K = { enter: '', back: '', left: '', right: '', shift: '', end: '' };
  const press = async (key, n = 1) => { for (let i = 0; i < n; i++) { await wd('POST', '/session/' + sid + '/actions', { actions: [{ type: 'key', id: 'kb', actions: [{ type: 'keyDown', value: key }, { type: 'keyUp', value: key }] }] }); } await sleep(120); };
  const shiftPress = async (key, n) => { await wd('POST', '/session/' + sid + '/actions', { actions: [{ type: 'key', id: 'kb', actions: [{ type: 'keyDown', value: K.shift }].concat(Array.from({ length: n }, () => [{ type: 'keyDown', value: key }, { type: 'keyUp', value: key }]).flat(), [{ type: 'keyUp', value: K.shift }]) }] }); await sleep(200); };
  const caretIn = async (sel, at) => { await js("const el = document.querySelector('.writer-page .cm-content ' + arguments[0]); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const nodes = []; for (let n = w.nextNode(); n; n = w.nextNode()) nodes.push(n); const at = arguments[1]; const node = at < 0 ? nodes[nodes.length - 1] : nodes[0]; const off = at < 0 ? node.data.length + at + 1 : at; document.querySelector('.writer-page .cm-content').focus(); const r = document.createRange(); r.setStart(node, off); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true;", sel, at); await sleep(250); };
  const txt = (sel) => js("return [...document.querySelectorAll('.writer-page .cm-content ' + arguments[0])].map((x) => x.innerText)", sel);
  const shown = () => js("return document.querySelector('.writer-page .cm-content').innerText");
  const bodyOf = (t) => t.slice(t.indexOf('\n---\n', 4) + 5);
  for (const [w, h] of [[1180, 820], [1366, 1024]]) {
    const at = w + 'x' + h;
    fake = makeFake(DEMO, patch);
    await wd('POST', '/session/' + sid + '/window/rect', { width: w, height: h });
    await wd('POST', '/session/' + sid + '/url', { url: APP + '#/settings' });
    await js('localStorage.clear(); return true');
    await wd('POST', '/session/' + sid + '/refresh', {});
    await until("return !!document.querySelector('form.settings input')", 'settings form');
    if (w === 1180) console.log('engine:', await js('return navigator.userAgent'));
    await js(reroute);
    await js("window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(e.message)); window.addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason))); return true;");
    await js("const i = document.querySelector('form.settings input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'test-token'); i.dispatchEvent(new Event('input', { bubbles: true })); return true;");
    await click('form.settings button', 'Save');
    await sleep(1500);
    // A pretend microphone: a tone through the browser's own sound, in place of the iPad's mic.
    const state = () => js("return [document.querySelector('.writer-bar .dictate-button').className, window.__micUses, window.__fakeCtx && window.__fakeCtx.state, [...document.querySelectorAll('.writer-page .tool-said')].map((p) => p.innerText).join('|'), (window.__errs||[]).join('|')]");
    const listening = async (what) => { try { await until("return document.querySelector('.writer-bar .dictate-button.listening')", what, 8000); } catch (e) { console.log('state', JSON.stringify(await state())); throw e; } };
    const fakeMic = "navigator.mediaDevices = navigator.mediaDevices || {}; navigator.mediaDevices.getUserMedia = async () => { const c = new AudioContext(); const o = c.createOscillator(); const d = c.createMediaStreamDestination(); o.connect(d); o.start(); c.resume(); window.__micUses = (window.__micUses || 0) + 1; if (window.__fakeCtx) window.__fakeCtx.close(); window.__fakeCtx = c; return d.stream; }; return true;";
    await js("location.hash = '#/write/' + encodeURIComponent(arguments[0]); return true", SCENE);
    await until("return document.querySelectorAll('.writer-page .cm-line').length > 8", 'the writing page', 30000);
    await sleep(700);
    await js(fakeMic);
    // No speech server yet: the mic says where to set one up.
    await click('.writer-bar .dictate-button', 'Dictate');
    await sleep(300);
    const none = await js("const p = document.querySelector('.writer-page .tool-said'); return p ? p.innerText : ''");
    ok(/Settings/.test(none) && !!(await js("return !!document.querySelector('.writer-page .tool-said a[href=\"#/settings\"]')")), at + ': with no speech server the mic says to set one up in Settings', JSON.stringify(none));
    await js("localStorage.setItem('sparrow.dictation', JSON.stringify({ address: 'http://localhost:4499', away: 'http://localhost:4497', password: 'secret-pw' })); return true");
    // Put the cursor at the end of the first paragraph, then dictate.
    await js("const l = document.querySelector('.writer-page .cm-content .cm-line'); document.querySelector('.writer-page .cm-content').focus(); const r = document.createRange(); r.selectNodeContents(l); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true");
    await sleep(300);
    const before = await text();
    const firstLine = before.split('\n')[0];
    speech = { pieces: [], finish: null, auth: [], refuse: false };
    await js(fakeMic);
    await click('.writer-bar .dictate-button.' + 'tool');
    await listening('the mic listening');
    ok(true, at + ': the mic button turns to listening');
    ok(/Listening/.test(await js("const p = document.querySelector('.dictate-said'); return p ? p.innerText : ''")), at + ': a line says it is listening');
    await sleep(2600);
    await click('.writer-bar .dictate-button.' + 'tool');
    await until("return !document.querySelector('.writer-bar .dictate-button.writing') && !document.querySelector('.writer-bar .dictate-button.listening')", 'the words back', 15000);
    await sleep(400);
    const after = await text();
    ok(speech.pieces.length >= 2, at + ': pieces of sound went up while listening', String(speech.pieces.length));
    ok(speech.pieces.every((p, k) => p.url === speech.pieces[0].url.replace(/\/\d+$/, '/' + k)), at + ': pieces are numbered in order from 0', speech.pieces.map((p) => p.url).join(' '));
    ok(speech.pieces.slice(0, -1).every((p) => p.size === 32000), at + ': each full piece is one second of 16-bit sound at 16,000 a second', speech.pieces.map((p) => p.size).join(','));
    const total = speech.pieces.reduce((n, p) => n + p.size, 0);
    ok(speech.finish && speech.finish.endsWith('/finish?chunks=' + speech.pieces.length + '&bytes=' + total), at + ': finish names the count and the bytes', String(speech.finish));
    ok(speech.auth.every((a) => a === 'Bearer secret-pw'), at + ': the password goes with every request');
    ok(after.split('\n')[0] === firstLine + ' And then the slime sneezed.', at + ': the words land at the cursor, spaced and capitalised', JSON.stringify(after.split('\n')[0].slice(-60)));
    ok(after.split('\n').slice(1).join('\n') === before.split('\n').slice(1).join('\n'), at + ': nothing else on the page changed');
    await click('.writer-bar .tool', 'Undo');
    await sleep(300);
    ok((await text()) === before, at + ': one Undo takes the dictated words out');
    // Away from home: home does not answer, so the dictation moves to the away address by itself and remembers it.
    await js("localStorage.setItem('sparrow.dictation', JSON.stringify({ address: 'http://localhost:4497', away: 'http://localhost:4499', password: 'secret-pw' })); localStorage.removeItem('sparrow.dictation-last'); return true");
    await js("const l = document.querySelector('.writer-page .cm-content .cm-line'); document.querySelector('.writer-page .cm-content').focus(); const r = document.createRange(); r.selectNodeContents(l); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true");
    speech = { pieces: [], finish: null, auth: [], refuse: false };
    silentHits = 0;
    await js(fakeMic);
    await click('.writer-bar .dictate-button.' + 'tool');
    await listening('the mic listening, away');
    await sleep(2200);
    await click('.writer-bar .dictate-button.' + 'tool');
    await until("return !document.querySelector('.writer-bar .dictate-button.writing') && !document.querySelector('.writer-bar .dictate-button.listening')", 'the words back, away', 15000);
    await sleep(300);
    ok(silentHits === 1 && speech.pieces.length >= 2 && speech.pieces[0].url.endsWith('/chunk/0'), at + ': home did not answer, so every piece went to the away address', silentHits + ' ' + speech.pieces.length);
    ok((await text()).split('\n')[0] === firstLine + ' And then the slime sneezed.', at + ': the words came back from away');
    ok((await js("return localStorage.getItem('sparrow.dictation-last')")) === 'away', at + ': away is remembered');
    await click('.writer-bar .tool', 'Undo');
    await sleep(300);
    speech = { pieces: [], finish: null, auth: [], refuse: false };
    silentHits = 0;
    await js(fakeMic);
    await click('.writer-bar .dictate-button.' + 'tool');
    await listening('the mic listening, away again');
    await sleep(1400);
    await click('.writer-bar .dictate-button.' + 'tool');
    await until("return !document.querySelector('.writer-bar .dictate-button.writing') && !document.querySelector('.writer-bar .dictate-button.listening')", 'the words back, away again', 15000);
    ok(silentHits === 0 && speech.finish, at + ': the next dictation goes straight to away', String(silentHits));
    await click('.writer-bar .tool', 'Undo');
    await sleep(300);
    ok((await text()) === before, at + ': Undo, page back as it was');
    await js("localStorage.setItem('sparrow.dictation', JSON.stringify({ address: 'http://localhost:4499', away: 'http://localhost:4497', password: 'secret-pw' })); localStorage.removeItem('sparrow.dictation-last'); return true");
    // A refused password.
    speech = { pieces: [], finish: null, auth: [], refuse: true };
    await js(fakeMic);
    await click('.writer-bar .dictate-button.' + 'tool');
    await listening('the mic listening again');
    await sleep(1400);
    await click('.writer-bar .dictate-button.' + 'tool');
    await until("const p = document.querySelector('.writer-page .tool-said.error'); return p && p.innerText", 'the refusal', 15000);
    const refused = await js("return document.querySelector('.writer-page .tool-said.error').innerText");
    ok(/dictation key/.test(refused), at + ': a refused password says so plainly', JSON.stringify(refused));
    ok((await text()) === before, at + ': and the page is unchanged');
    ok(!(await js("return document.documentElement.scrollWidth > window.innerWidth + 1")), at + ': no sideways scroll');
    await wd('GET', '/session/' + sid + '/screenshot').then((b64) => import('node:fs').then((fs) => fs.writeFileSync('dictate-wk-' + w + '.png', Buffer.from(b64, 'base64'))));
    const errs = await js('return window.__errs || []');
    ok(!errs.length, at + ': no page errors', errs.join(' | '));
  }
  console.log('RESULT fail=' + fail);
  await done(fail ? 1 : 0);
} catch (e) {
  console.error('FAILED', e);
  await done(1);
}
