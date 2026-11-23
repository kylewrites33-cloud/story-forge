// A book's numbers in a real WebKit (the iPad's engine): prose typed in a planned chapter makes it drafted and counts on
// the Overview, and the Overview's words typed this week are only this book's (Kyle, 2026-11-23).
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DEMO, makeFake } from './fake.mjs';
const APP = 'http://localhost:4173/';
const BOOK = 'Series/Ember Road/Books/1 Ash Bell';
const SCENE = BOOK + '/Scenes/S-005 The Ledger.md';
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

  const day = new Date(); const ymd = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
  const seed = (start) => start.set('Writing Log/' + ymd + '.md', '---\ntype: writing-day\ndate: ' + ymd + '\npomodoros: 0\nminutes: 0\nwords: 0\ntyped: 1020\ntyping_minutes: 50\ntyped_books:\n  - "1 Ash Bell: 120"\n  - "1.5 Bonus: 900"\ntyping_books:\n  - "1 Ash Bell: 10"\n  - "1.5 Bonus: 40"\nupdated: ' + ymd + 'T08:00:00Z\n---\n');
  for (const [w, h] of [[1180, 820], [820, 1180], [1366, 1024]]) {
    await wd('POST', '/session/' + sid + '/window/rect', { width: w, height: h });
    await wd('POST', '/session/' + sid + '/url', { url: APP + '#/settings' });
    await js('localStorage.clear(); return true');
    await wd('POST', '/session/' + sid + '/refresh', {});
    await until("return !!document.querySelector('form.settings input')", 'settings form');
    await js("const real = window.fetch.bind(window); window.fetch = (u, i) => real(String(u).replace('https://api.github.com', 'http://localhost:4488'), i); return true;");
    fake = makeFake(DEMO, seed);
    assert.match(text('Scenes/S-005 The Ledger.md'), /^status: planned$/m);
    await js("const i = document.querySelector('form.settings input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'test-token'); i.dispatchEvent(new Event('input', { bubbles: true })); return true;");
    await press('Save');
    await sleep(300);
    // The Overview before: the week line counts only this book's typing.
    const ov = '#/board/overview/' + encodeURIComponent(BOOK);
    await js("location.hash = arguments[0]; return true", ov);
    await until("return /words you typed/.test(document.body.innerText)", 'the Overview', 30000);
    const weekLine = () => js("return [...document.querySelectorAll('li')].map((l) => l.innerText).find((t) => /words you typed/.test(t)) || ''");
    const bookLine = () => js("return [...document.querySelectorAll('li')].map((l) => l.innerText).find((t) => /words in the book/.test(t)) || ''");
    assert.match(await weekLine(), /^120 words you typed in the last 7 days, in 10 minutes of typing/, 'only Ash Bell, not the bonus book');
    const before = Number((await bookLine()).replace(/[^0-9]/g, ''));
    // Typing in the planned chapter: it becomes drafted and its words count.
    await js("location.hash = arguments[0]; return true", '#/write/' + encodeURIComponent(SCENE));
    await until("return [...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Chapters')", 'the writing page', 30000);
    await sleep(800);
    await write(' Basil stepped out of the guild and into the village.');
    await saveKey();
    await wait(() => /Basil stepped out/.test(text('Scenes/S-005 The Ledger.md')), 'words saved');
    const saved = text('Scenes/S-005 The Ledger.md');
    assert.match(saved, /^status: drafted$/m);
    const words = Number(/^words: (\d+)$/m.exec(saved)[1]);
    assert.ok(words > 10, 'the scene counts its words: ' + words);
    await js("location.hash = arguments[0]; return true", ov);
    await until("return /words in the book/.test(document.body.innerText)", 'the Overview again', 30000);
    await sleep(800);
    const after = Number((await bookLine()).replace(/[^0-9]/g, ''));
    assert.equal(after, before + words, 'the book counts the chapter: ' + before + ' -> ' + after);
    const typedNow = Number((await weekLine()).split(' ')[0].replace(/,/g, ''));
    assert.ok(typedNow > 120 && typedNow < 200, 'the words typed here count for this book only: ' + typedNow);
    assert.equal(await js('return document.documentElement.scrollWidth > window.innerWidth + 1'), false, 'no sideways scroll');
    console.log('ok webkit', w + 'x' + h, 'book', before, '->', after, 'typed', typedNow);
    await js('localStorage.clear(); return true');
  }
  // A first draft (no saved draft): chapters before the last one with writing in it count as done, on the Overview and
  // with a tick in the writing screen's chapter list (Kyle, 2026-11-23).
  await wd('POST', '/session/' + sid + '/window/rect', { width: 1180, height: 820 });
  await wd('POST', '/session/' + sid + '/url', { url: APP + '#/settings' });
  await js('localStorage.clear(); return true');
  await wd('POST', '/session/' + sid + '/refresh', {});
  await until("return !!document.querySelector('form.settings input')", 'settings form');
  await js("const real = window.fetch.bind(window); window.fetch = (u, i) => real(String(u).replace('https://api.github.com', 'http://localhost:4488'), i); return true;");
  fake = makeFake(DEMO, (start) => { for (const k of [...start.keys()]) if (k.startsWith(BOOK + '/Drafts/') || k.startsWith(BOOK + '/Changes/')) start.delete(k); const last = BOOK + '/Scenes/S-008 The Last Ring.md'; start.set(last, start.get(last).replace(/\n---\n[\s\S]*$/, '\n---\n')); });
  await js("const i = document.querySelector('form.settings input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'test-token'); i.dispatchEvent(new Event('input', { bubbles: true })); return true;");
  await press('Save');
  await sleep(300);
  await js("location.hash = arguments[0]; return true", '#/board/overview/' + encodeURIComponent(BOOK));
  await until("return /chapters? done/.test(document.body.innerText)", 'the Overview', 30000).catch(async (e) => { console.log('PAGE', (await js('return location.hash + " " + document.body.innerText.slice(0, 1500)'))); throw e; });
  const doneLine = await js("return (document.body.innerText.match(/(\\d+) of (\\d+) chapters done/) || []).slice(1, 3).join(' of ')");
  // Chapter 3 (S-005) has writing, chapter 4 has none: chapters 1 and 2 are done.
  assert.equal(doneLine, '2 of 4', 'first-draft chapters done: ' + doneLine);
  await js("location.hash = arguments[0]; return true", '#/write/' + encodeURIComponent(SCENE));
  await until("return [...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Chapters')", 'the writing page', 30000);
  if (!(await js("return !!document.querySelector('nav.scene-list')"))) await press('Chapters');
  await until("return !!document.querySelector('nav.scene-list')", 'the chapter list');
  const ticks = await js("return [...document.querySelectorAll('nav.scene-list a.side-chapter-row')].map((a) => !!a.querySelector('.side-done'))");
  assert.deepEqual(ticks.slice(0, 4), [true, true, false, false], 'ticks: ' + JSON.stringify(ticks));
  console.log('ok webkit first draft', doneLine, JSON.stringify(ticks));
  console.log('WEBKIT ALL OK');
  await done(0);
} catch (e) {
  console.log('FAILED', e.stack || e);
  await done(1);
}
