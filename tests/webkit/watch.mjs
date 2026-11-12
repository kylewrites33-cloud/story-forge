// Step 4, piece 3 in a real WebKit (the iPad's engine): the one watcher and the one failure sentence, on Beats and a workflow step.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DEMO, makeFake } from './fake.mjs';
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const SCENE = BOOK + '/Scenes/S-005 The Ledger.md';
const stamp = (d) => { const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
const job = (id, kind, target, status, more = '') => '---\ntype: job\nid: ' + id + '\ntitle: ' + kind + ' ' + target + '\nkind: ' + kind + '\ntarget: ' + target + '\nbook: ' + BOOK + '\nstatus: ' + status + '\nrequested_by: Kyle\ncreated: ' + stamp(new Date()).slice(0, 10) + '\n' + more + '---\n## Ask\nKyle asked for this from the Sparrow app.\n';
const BEATS = 'Jobs/J-040 Beats for Chapter 3.md', STEP = 'Jobs/J-041 Step 1.md';
const patch = (files) => { files.set(BEATS, job('J-040', 'beats', 'Chapter 3', 'requested')); files.set(STEP, job('J-041', 'workflow-step', 'Step 1', 'running', 'started: ' + stamp(new Date()) + '\n')); };
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
  const until = async (script, what, ms = 15000, ...args) => { const end = Date.now() + ms; for (;;) { const v = await js(script, ...args); if (v) return v; if (Date.now() > end) return false; await sleep(300); } };
  const click = (sel, label) => js("const b = [...document.querySelectorAll(arguments[0])].find((x) => !arguments[1] || x.textContent.trim() === arguments[1]); if (!b) throw new Error('no ' + arguments[0] + ' ' + arguments[1]); b.click(); return true;", sel, label || '');
  const reroute = "const real = window.fetch.bind(window); window.fetch = (u, i) => real(String(u).replace('https://api.github.com', 'http://localhost:4488'), i); return true;";
  const has = "return document.body.innerText.includes(arguments[0])";
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
    await js("location.hash = '#/beats/' + encodeURIComponent(arguments[0]); return true", SCENE);
    ok(await until(has, '', 30000, "The team is working on this chapter's beats."), at + ': Beats says the team is working on the chapter\'s beats');
    fake.commitTo({ [BEATS]: job('J-040', 'beats', 'Chapter 3', 'failed', 'finished: ' + stamp(new Date()) + '\nresult: The spend cap for this month was reached\n') }, 'jobs: J-040 failed\n\nAgent: Jobs Runner', 'team');
    ok(await until(has, '', 25000, 'The team could not finish this. The spend cap for this month was reached. Ask again when you are ready'), at + ': within 25 seconds Beats says it failed, in the one sentence');
    ok(!(await js(has, "The team is working on this chapter's beats.")), at + ': and no longer says the team is working');
    ok(await js('return document.documentElement.scrollWidth <= innerWidth + 1'), at + ': no sideways scroll');
    await js("location.hash = '#/flow/' + encodeURIComponent(arguments[0]) + '/step/1'; return true", BOOK);
    ok(await until(has, '', 30000, 'The team is on this step'), at + ': the step says the team is on it');
    fake.commitTo({ [STEP]: job('J-041', 'workflow-step', 'Step 1', 'failed', 'finished: ' + stamp(new Date()) + '\nresult: It ran out of time.\n') }, 'jobs: J-041 failed\n\nAgent: Jobs Runner', 'team');
    ok(await until(has, '', 25000, 'The team could not finish this. It ran out of time. Ask again when you are ready'), at + ': within 25 seconds the step says it failed');
    ok(!(await js(has, 'The team is on this step')), at + ': and no longer says the team is on it');
    const errs = await js('return window.__errs');
    ok(!errs.length, at + ': no page errors', errs.join(' | '));
  }
} catch (e) { fail++; console.log('FAIL ' + e.message); }
console.log('RESULT fail=' + fail);
await done(fail ? 1 : 0);
