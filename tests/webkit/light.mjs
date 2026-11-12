// The soft light on the words a Rewrite box stands for stays inside the page while it scrolls, in a real WebKit (the
// iPad's engine), over plain WebDriver. The measuring is in light-measure.mjs.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DEMO, makeFake } from './fake.mjs';
import { filler, MEASURE, outside } from './light-measure.mjs';
const APP = process.env.APP || 'http://localhost:4173/';
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const SCENE = BOOK + '/Scenes/S-001 The Crack.md';
const REWRITE = BOOK + '/Drafts/Rewrite/S-001 The Crack.md';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const long = () => { const f = makeFake(DEMO); f.commitTo({ [SCENE]: f.headTree().get(SCENE).trimEnd() + '\n\n' + filler + '\n', [REWRITE]: f.headTree().get(REWRITE).trimEnd() + '\n\n' + filler + '\n' }, 'test: a long chapter', 'team'); return f; };

let fake = long();
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
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
  const press = (label) => js("const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === arguments[0]); if (!b) throw new Error('no button ' + arguments[0]); b.click(); return true;", label);
  const reroute = "const real = window.fetch.bind(window); window.fetch = (u, i) => real(String(u).replace('https://api.github.com', 'http://localhost:4488'), i); return true;";
  const measure = () => js('return ' + MEASURE);
  const frame = () => wd('POST', '/session/' + sid + '/execute/async', { script: 'const cb = arguments[arguments.length - 1]; requestAnimationFrame(() => requestAnimationFrame(() => cb(true)));', args: [] });

  for (const [w, h] of [[1180, 820], [1366, 1024]]) {
    await wd('POST', '/session/' + sid + '/window/rect', { width: w, height: h });
    await wd('POST', '/session/' + sid + '/url', { url: APP + '#/settings' });
    await js('localStorage.clear(); return true');
    await wd('POST', '/session/' + sid + '/refresh', {});
    await until("return !!document.querySelector('form.settings input')", 'settings form');
    if (w === 1180) console.log('engine:', await js('return navigator.userAgent'));
    await js(reroute);
    fake = long();
    await js("const i = document.querySelector('form.settings input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'test-token'); i.dispatchEvent(new Event('input', { bubbles: true })); return true;");
    await press('Save');
    await sleep(300);
    await js("location.hash = arguments[0]; return true", '#/write/' + encodeURIComponent(SCENE));
    await until("return !!document.querySelector('[contenteditable=true]')", 'the writing box');
    await sleep(700);
    if (!(await js("return !!document.querySelector('.rewrite-rows')"))) await press('Rewrite');
    await until("return !!document.querySelector('.rewrite-row textarea.chg-tweak')", 'the Rewrite tab');
    await js("const t = document.querySelector('.rewrite-row textarea.chg-tweak'); t.focus(); return true;");
    await until("return document.querySelectorAll('.writer-page .lit-shown').length > 0", 'the words lit');
    let m = await measure();
    assert.ok(m.lit.length > 0 && m.max > 400, 'the words are lit and the page scrolls: ' + JSON.stringify(m));
    assert.deepEqual(outside(m), [], 'lit inside the page before scrolling');
    const firstTop = Math.min(...m.lit.map((q) => q[0])), lastBottom = Math.max(...m.lit.map((q) => q[1]));
    const start = m.scroll;
    let cut = 0, gone = 0;
    for (let y = start; y <= start + lastBottom - m.from + 160; y += 9) {
      await js("document.querySelector('.writer-page').scrollTop = arguments[0]; return true;", y);
      await frame();
      m = await measure();
      assert.deepEqual(outside(m), [], 'at ' + y + ' px nothing is drawn outside the page: ' + JSON.stringify(m));
      if (m.lit.some(([t, bt]) => bt - t < 12)) cut++;
      if (!m.lit.length) gone++;
    }
    assert.ok(gone > 0, 'out of sight, nothing is drawn');
    assert.ok(cut > 0, 'a line half under the top edge is drawn cut');
    await js("document.querySelector('.writer-page').scrollTop = arguments[0]; return true;", start);
    await sleep(250);
    m = await measure();
    assert.ok(m.lit.length > 0 && Math.abs(Math.min(...m.lit.map((q) => q[0])) - firstTop) < 2, 'the light is back on the words: ' + JSON.stringify([m.lit, firstTop]));
    assert.equal(await js('return document.documentElement.scrollWidth > window.innerWidth + 1'), false, 'no sideways scroll');
    console.log('ok', w + 'x' + h);
  }
  console.log('WEBKIT ALL OK');
  await done(0);
} catch (e) {
  console.error('FAILED', e);
  await done(1);
}
