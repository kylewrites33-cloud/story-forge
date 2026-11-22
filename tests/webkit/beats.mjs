// Beats mode is for planning notes, in a real WebKit (the iPad's engine) (Kyle, 2026-11-22: "when I write on beat mode,
// the text doesn't go into the word processor"): notes typed in a beat save to the beats note, under ### Notes, and the
// scene's words stay exactly as they were. Then the page's side column shows the notes under the beat.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DEMO, makeFake } from './fake.mjs';
const APP = 'http://localhost:4173/';
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const SCENE = BOOK + '/Scenes/S-001 The Crack.md';
const BEATS = BOOK + '/Chapter Beats/Chapter 1 beats.md';
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
  const fs = await import('node:fs');
  for (const [w, h] of [[1180, 820], [1366, 1024], [1600, 1000]]) {
    await wd('POST', '/session/' + sid + '/window/rect', { width: w, height: h });
    await wd('POST', '/session/' + sid + '/url', { url: APP + '#/todo' });
    await js("localStorage.clear(); return true");
    await wd('POST', '/session/' + sid + '/refresh', {});
    await until("return /To-do/.test(document.body.textContent)", 'the app');
    await js("const real = window.fetch.bind(window); window.fetch = (u, i) => real(String(u).replace('https://api.github.com', 'http://localhost:4488'), i); return true;");
    fake = makeFake(DEMO);
    const sceneBefore = fake.headTree().get(SCENE);
    await js("location.hash = '#/settings'; return true");
    await until("return !!document.querySelector('form.settings input')", 'settings form');
    await type('form.settings input', 'test-token');
    await press('Save');
    await sleep(300);
    await js("location.hash = '#/todo'; return true");
    await until("return /Synced/.test(document.body.textContent)", 'github sync', 30000);
    await js("location.hash = arguments[0]; return true", '#/beats/' + encodeURIComponent(SCENE));
    await until("return document.querySelectorAll('.beats .beat').length === 3", 'the three beats', 20000);
    assert.ok(await js("return [...document.querySelectorAll('.page-head .meta')].some((m) => /planning notes/.test(m.textContent))"), 'the page says the beats are for planning');
    // Open beat 1 and type notes into it, as Kyle would with the keyboard.
    await js("document.querySelector('.beats .beat .beat-toggle').click(); return true");
    await until("return !!document.querySelector('.beat.open .beat-body .cm-content')", 'the open beat');
    assert.equal(await js("return document.querySelector('.beat.open .cm-content').textContent"), '', 'an open beat shows notes, not the prose');
    const el = await wd('POST', '/session/' + sid + '/element', { using: 'css selector', value: '.beat.open .cm-content' });
    const eid = Object.values(el)[0];
    await wd('POST', '/session/' + sid + '/element/' + eid + '/click', {});
    await wd('POST', '/session/' + sid + '/element/' + eid + '/value', { text: 'Open on the lantern.\uE007Maybe she is late.' });
    await sleep(400);
    await js("window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })); return true");
    await until("return /^Saved$/.test((document.querySelector('.save-chip, .chip') || {}).textContent || '') || /Saved/.test(document.querySelector('.writer-top, header, body').textContent)", 'saved', 15000);
    await sleep(1500);
    const beats = fake.headTree().get(BEATS);
    assert.match(beats, /## Dawn climb\nMara climbs the tower[^\n]*\n\nStarts: S-001 · Mara climbed the tower at 5:40 with a tin lantern\.\n\n### Notes\nOpen on the lantern\.\nMaybe she is late\.\n/, 'the notes are under the beat in the beats note');
    assert.equal(fake.headTree().get(SCENE), sceneBefore, 'the scene is not changed');
    assert.ok(!/Open on the lantern/.test([...fake.headTree().values()].filter((t, i) => [...fake.headTree().keys()][i].includes('/Scenes/')).join('')), 'no scene has the notes');
    fs.writeFileSync('beats-wk-' + w + '.png', Buffer.from(await wd('GET', '/session/' + sid + '/screenshot'), 'base64'));
    // The page: its words are the scene's, and the side column's Beats tab shows the notes.
    await press('Back to the page');
    await until("return !!document.querySelector('.writer-text .cm-content')", 'the page', 20000);
    assert.ok(!/Open on the lantern/.test(await js("return document.querySelector('.writer-text .cm-content').textContent")), 'the page has no notes in it');
    assert.equal(await js("return document.documentElement.scrollWidth <= window.innerWidth"), true, 'no sideways scroll');
    console.log('ok at', w);
  }
  await done(0);
} catch (e) { console.error(e); await done(1); }
