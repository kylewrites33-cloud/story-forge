// Words from elsewhere come into an open page (a line the team or another device adds to the scene Kyle has open),
// with typing going on, in a real WebKit (the iPad's engine), over plain WebDriver.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DEMO, makeFake } from './fake.mjs';
const APP = process.env.APP || 'http://localhost:4173/';
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
  const SERIES = 'Series/Ember Road';
  const day = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  /** Put a file into a file input the way a pick from the device does. */
  const pick = (sel, name, type, b64) => js("const i = document.querySelector(arguments[0]); if (!i) throw new Error('no ' + arguments[0]); const bin = atob(arguments[3]); const bytes = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k); const dt = new DataTransfer(); dt.items.add(new File([bytes], arguments[1], { type: arguments[2] })); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); return true;", sel, name, type, b64);
  const b64 = (s) => Buffer.from(s).toString('base64');
  const reroute = "const real = window.fetch.bind(window); window.fetch = (u, i) => real(String(u).replace('https://api.github.com', 'http://localhost:4488'), i); return true;";

  for (const [w, h] of [[1180, 820], [1366, 1024]]) {
    await wd('POST', '/session/' + sid + '/window/rect', { width: w, height: h });
    await wd('POST', '/session/' + sid + '/url', { url: APP + '#/settings' });
    await js('localStorage.clear(); return true');
    await wd('POST', '/session/' + sid + '/refresh', {});
    await until("return !!document.querySelector('form.settings input')", 'settings form');
    if (w === 1180) console.log('engine:', await js('return navigator.userAgent'));
    await js(reroute);
    fake = makeFake(DEMO);
    await js("const i = document.querySelector('form.settings input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'test-token'); i.dispatchEvent(new Event('input', { bubbles: true })); return true;");
    await press('Save');
    await sleep(300);
    const go = async (hash) => { await js("location.hash = arguments[0]; return true", hash); await sleep(350); };
    const gtext = (file) => fake.headTree().get(file);
    const paths = () => [...fake.headTree().keys()];
    const says = (words, ms) => until("return document.body.textContent.includes(" + JSON.stringify(words) + ")", words, ms);

    const SC = BOOK + '/Scenes/S-005 The Ledger.md';
    const bodyOf = (t) => t.slice(t.indexOf('\n---\n', 4) + 5);
    const count = (hay, needle) => hay.split(needle).length - 1;
    const log = () => fake.st.log.filter((c) => !c.paths.every((p) => p.startsWith('Writing Log/')));
    const mine = () => log().filter((c) => c.via !== 'team');
    const team = (change, message) => { const cur = gtext(SC); const hd = cur.slice(0, cur.indexOf('\n---\n', 4) + 5); fake.commitTo({ [SC]: hd + change(bodyOf(cur)) }, message, 'team'); };
    const sync = () => js("window.dispatchEvent(new Event('online')); return true");
    const onPage = async () => (await js("return document.querySelector('[contenteditable=true]').innerText")).replace(/ /g, ' ');
    const endCaret = () => js("const ed = document.querySelector('[contenteditable=true]'); ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true;");
    // Typed where the cursor is, wherever the page has put it: the cursor is not set again between words.
    const ins = (t) => js("document.execCommand('insertText', false, arguments[0]); return true;", t);
    const newPara = () => js("document.execCommand('insertParagraph'); return true;");
    const pageHas = (line, what, ms = 15000) => until("return document.querySelector('[contenteditable=true]').innerText.includes(" + JSON.stringify(line) + ")", what, ms);
    await go('#/write/' + encodeURIComponent(SC));
    await until("return !!document.querySelector('[contenteditable=true]')", 'the writing page', 30000);
    await sleep(900);

    // ---- (a) nothing typed: the team's line shows, and the app saves nothing because of it ----
    team((b) => '\nTEAM ONE at the top.\n' + b, 'scenes: a line at the top of S-005');
    await sync();
    await pageHas('TEAM ONE at the top.', 'the team\'s line is on the untouched page');
    await sleep(3500);
    assert.equal(mine().length, 0, 'the app saved nothing: ' + JSON.stringify(mine().map((c) => c.message.split('\n')[0])));
    assert.equal(count(await onPage(), 'TEAM ONE at the top.'), 1);

    // ---- (b) typing while a line arrives ----
    await endCaret();
    await newPara();
    const words = 'The ledger smelled of tallow and river mud, and the year she wanted was not in it.'.split(' ');
    const sentence = words.join(' ');
    for (let i = 0; i < words.length; i++) {
      await ins((i ? ' ' : '') + words[i]);
      if (i === 5) { team((b) => b.replace('TEAM ONE at the top.', 'TEAM ONE at the top.\n\nTEAM TWO came while Kyle typed.'), 'scenes: a second line in S-005'); await sync(); }
      await sleep(i >= 5 && i < 10 ? 350 : 60);
    }
    await pageHas('TEAM TWO came while Kyle typed.', 'the second line is on the page');
    let now = await onPage();
    assert.ok(now.indexOf(sentence) >= 0, 'the typed sentence is whole: ' + JSON.stringify(now.slice(-220)));
    assert.ok(now.trimEnd().endsWith(sentence), 'and still at the end: ' + JSON.stringify(now.slice(-220)));
    await ins(' Then she shut it.');
    now = await onPage();
    assert.ok(now.trimEnd().endsWith(sentence + ' Then she shut it.'), 'the cursor kept its place: ' + JSON.stringify(now.slice(-160)));
    await saveKey();
    await wait(() => /Then she shut it\./.test(gtext(SC)), 'Kyle\'s words saved');
    assert.match(gtext(SC), /TEAM ONE at the top\.\n\nTEAM TWO came while Kyle typed\./);
    assert.equal(count(gtext(SC), 'TEAM TWO came while Kyle typed.'), 1);
    assert.equal(count(gtext(SC), sentence), 1);
    assert.equal(paths().filter((p) => p.indexOf('/Snapshots/S-005') >= 0).length, 0, 'no clash, so no copy');

    // ---- nothing goes in again ----
    await sleep(3500);
    const settled = mine().length;
    const vaultNow = gtext(SC);
    for (let i = 0; i < 3; i++) { await sync(); await sleep(1500); }
    assert.equal(mine().length, settled, 'no save follows a read: ' + JSON.stringify(mine().slice(settled).map((c) => c.message.split('\n')[0])));
    assert.equal(gtext(SC), vaultNow);
    now = await onPage();
    assert.equal(count(now, 'TEAM TWO came while Kyle typed.'), 1);
    assert.equal(count(now, sentence), 1);

    // ---- (c) the same line changed in both places ----
    fake.st.down = true;
    await endCaret();
    await ins(' Twice.');
    await sleep(300);
    fake.st.down = false;
    team((b) => b.replace('Then she shut it.', 'Then she shut it and locked the clasp.'), 'scenes: the same line in S-005');
    await sync();
    const copy = BOOK + '/Snapshots/S-005 v1 (changed elsewhere).md';
    await wait(() => gtext(copy) != null, 'their version is kept as a copy', 15000);
    assert.match(gtext(copy), /Then she shut it and locked the clasp\./);
    now = await onPage();
    assert.ok(now.trimEnd().endsWith('Then she shut it. Twice.'), 'Kyle\'s line is the page\'s: ' + JSON.stringify(now.slice(-120)));
    await says('as a copy', 8000);
    await saveKey();
    await wait(() => /Then she shut it\. Twice\./.test(gtext(SC)), 'Kyle\'s line saved');
    assert.doesNotMatch(gtext(SC), /locked the clasp/);
    assert.equal(paths().filter((p) => p.indexOf('/Snapshots/S-005') >= 0).length, 1, 'one copy, not two');

    // ---- (d) words that waited with no connection meet a line from elsewhere ----
    await sleep(1500);
    fake.st.down = true;
    await endCaret();
    await newPara();
    await ins('Outside, the ferry bell rang once.');
    await sleep(200);
    await saveKey();
    await sleep(800);
    team((b) => b.replace('TEAM ONE at the top.', 'TEAM ONE at the top.\n\nTEAM THREE came while the iPad was offline.'), 'scenes: a third line in S-005');
    fake.st.down = false;
    await sync();
    await wait(() => /Outside, the ferry bell rang once\./.test(gtext(SC)), 'the waiting words saved');
    assert.match(gtext(SC), /TEAM THREE came while the iPad was offline\./);
    await pageHas('TEAM THREE came while the iPad was offline.', 'the line the save met is on the page');
    await sleep(3500);
    const settled2 = mine().length;
    for (let i = 0; i < 3; i++) { await sync(); await sleep(1500); }
    assert.equal(mine().length, settled2, 'no save follows: ' + JSON.stringify(mine().slice(settled2).map((c) => c.message.split('\n')[0])));
    now = await onPage();
    for (const line of ['TEAM ONE at the top.', 'TEAM TWO came while Kyle typed.', 'TEAM THREE came while the iPad was offline.', sentence, 'Outside, the ferry bell rang once.']) {
      assert.equal(count(now, line), 1, 'once on the page: ' + line);
      assert.equal(count(gtext(SC), line), 1, 'once in the vault: ' + line);
    }
    assert.equal(bodyOf(gtext(SC)).replace(/\s+/g, ' ').trim(), now.replace(/\s+/g, ' ').trim(), 'the page and the vault read the same');
    assert.equal(paths().filter((p) => p.indexOf('/Snapshots/S-005') >= 0).length, 1);

    assert.equal(await js('return document.documentElement.scrollWidth > window.innerWidth + 1'), false, 'no sideways scroll');
    console.log('ok', w + 'x' + h, log().map((c) => c.via + ':' + c.paths.length).join(' '));
  }
  console.log('WEBKIT ALL OK');
  await done(0);
} catch (e) {
  console.error('FAILED', e);
  await done(1);
}
