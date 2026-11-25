// The writing page with a { } note in the left margin, in a real WebKit (the iPad's engine): the text stays in the middle
// of the page with the note beside it, not pushed to the right edge (Kyle, 2026-11-25: "what is up with this view").
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DEMO, makeFake } from './fake.mjs';
import { patch, SCENE } from './trial-text.mjs';
const APP = process.env.APP || 'http://localhost:4173/';
const SHOTS = process.env.SHOTS || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fake = makeFake(DEMO, patch);
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
const wd = async (method, p, body) => {
  const r = await fetch('http://127.0.0.1:4477' + p, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (j.value && j.value.error) throw new Error(j.value.error + ': ' + j.value.message);
  return j.value;
};
let sid = '', fail = 0;
const ok = (c, what, more = '') => { if (!c) fail++; console.log((c ? 'ok   ' : 'FAIL ') + what + (more ? ' ' + more : '')); };
const done = async (code) => { try { if (sid) await wd('DELETE', '/session/' + sid); } catch {} driver.kill(); xvfb.kill(); server.close(); process.exit(code); };
try {
  const s = await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'MiniBrowser', 'webkitgtk:browserOptions': { binary: '/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', args: ['--automation'] } } } });
  sid = s.sessionId;
  const js = (script, ...args) => wd('POST', '/session/' + sid + '/execute/sync', { script, args });
  const until = async (script, what, ms = 15000) => { const end = Date.now() + ms; for (;;) { const v = await js(script); if (v) return v; if (Date.now() > end) throw new Error('timed out: ' + what); await sleep(150); } };
  const reroute = "const real = window.fetch.bind(window); window.fetch = (u, i) => real(String(u).replace('https://api.github.com', 'http://localhost:4488'), i); return true;";
  // iPad landscape, iPad portrait, a desktop window.
  for (const [w, h] of [[1366, 1024], [1024, 1366], [1180, 820], [1600, 1000]]) {
    const at = w + 'x' + h;
    fake = makeFake(DEMO, patch);
    await wd('POST', '/session/' + sid + '/window/rect', { width: w, height: h });
    await wd('POST', '/session/' + sid + '/url', { url: APP + '#/settings' });
    await wd('POST', '/session/' + sid + '/execute/async', { script: "const done = arguments[arguments.length - 1]; localStorage.clear(); indexedDB.databases().then((l) => Promise.all(l.map((d) => new Promise((r) => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; })))).then(() => done(true), () => done(true));", args: [] });
    await wd('POST', '/session/' + sid + '/refresh', {});
    await until("return !!document.querySelector('form.settings input')", 'settings form');
    await js(reroute);
    await js("const i = document.querySelector('form.settings input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'test-token'); i.dispatchEvent(new Event('input', { bubbles: true })); return true;");
    await js("const b = [...document.querySelectorAll('form.settings button')].find((x) => x.textContent.trim() === 'Save'); b.click(); return true");
    await sleep(1500);
    await js("location.hash = '#/write/' + encodeURIComponent(arguments[0]); return true", SCENE);
    await until("return document.querySelectorAll('.writer-page .cm-line').length > 8", 'the writing page', 30000);
    await sleep(600);
    // Kyle types a { } note at the end of the first paragraph, as he does.
    await js("const c = document.querySelector('.writer-page .cm-content'); const l = c.querySelector('.cm-line'); c.focus(); const r = document.createRange(); r.selectNodeContents(l); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('insertText', false, ' {with __, __ ___}'); return true");
    await until("return !!document.querySelector('.writer-page .md-ask')", 'the note in the margin');
    await sleep(800);
    // Both side columns closed, as on Kyle's iPad.
    await js("const w = document.querySelector('.writer'); if (w.classList.contains('right-open')) [...document.querySelectorAll('button[aria-expanded=\\'true\\']')].filter((b) => !/Chapters/.test(b.getAttribute('aria-label') || '')).forEach((b) => b.click()); return true");
    await sleep(300);
    await js("const w = document.querySelector('.writer'); if (w.classList.contains('left-open')) { const b = document.querySelector('button[aria-label=\\'Chapters\\'], button[aria-label=\\'Hide the chapter list\\']'); if (b) b.click(); } return true");
    await sleep(500);
    const measure = () => js(`
      const page = document.querySelector('.writer-page').getBoundingClientRect();
      const line = [...document.querySelectorAll('.writer-page .cm-line')].find((l) => l.textContent.length > 120).getBoundingClientRect();
      const ask = document.querySelector('.writer-page .md-ask').getBoundingClientRect();
      return { cls: document.querySelector('.writer').className, page: [page.left, page.right], line: [line.left, line.right], ask: [ask.left, ask.right], sw: document.documentElement.scrollWidth, vw: innerWidth };`);
    const m = await measure();
    console.log(at, JSON.stringify(m));
    const pageW = m.page[1] - m.page[0], lineW = m.line[1] - m.line[0];
    const leftGap = m.line[0] - m.page[0], rightGap = m.page[1] - m.line[1];
    ok(/asks-left/.test(m.cls) && !/(left|right)-open/.test(m.cls), at + ': notes in the left margin, both side columns closed', m.cls);
    ok(lineW >= Math.min(560, pageW - 2 * 48 - 208 - 2), at + ': the text keeps its width', String(Math.round(lineW)));
    ok(m.ask[1] <= m.line[0] + 1 && m.ask[0] >= m.page[0] && m.line[0] - m.ask[1] < 40, at + ': the note sits just left of the text, inside the page', JSON.stringify(m.ask));
    ok(Math.abs(leftGap - rightGap) < 4 || (m.ask[0] - m.page[0]) < 60, at + ': the text is in the middle unless the note needs the room', 'left ' + Math.round(leftGap) + ' right ' + Math.round(rightGap));
    ok(m.sw <= m.vw, at + ': no sideways scroll');
    if (SHOTS) {
      await js("document.querySelector('.writer-page .md-ask').scrollIntoView({ block: 'center' }); return true"); await sleep(400);
      (await import('node:fs')).writeFileSync(SHOTS + '/centre-' + at + '.png', Buffer.from(await wd('GET', '/session/' + sid + '/screenshot'), 'base64'));
    }
    if (w >= 1366) {
      // With the Team column open beside it, the text sits against the right, next to it (Kyle, 2026-11-06).
      await js("const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Team'); b.click(); return true");
      await sleep(600);
      const r = await measure();
      ok(/right-open/.test(r.cls) && r.page[1] - r.line[1] < 60 && r.ask[1] <= r.line[0] + 1, at + ': with the Team column open the text sits against the right', JSON.stringify(r));
    }
  }
} catch (e) { fail++; console.log('FAIL', e.message); }
console.log(fail ? fail + ' failed' : 'all ok');
await done(fail ? 1 : 0);
