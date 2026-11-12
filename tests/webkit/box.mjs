// The writing page on the new writing box (step 3) in a real WebKit (the iPad's engine), over plain WebDriver: what real
// keys do beside hidden marks, the tool row, and that what is saved is the Markdown the page shows.
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
    const noStars = async (what) => { const t = await shown(); const m = /.{0,25}(\*\*|==|\*\w|\w\*).{0,25}/.exec(t); ok(!m, at + ': ' + what + ', no stars show', m ? m[0] : ''); };
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
    await js("location.hash = '#/write/' + encodeURIComponent(arguments[0]); return true", SCENE);
    await until("return document.querySelectorAll('.writer-page .cm-line').length > 8", 'the writing page', 30000);
    await sleep(700);
    ok(!/\*\*|==|\*\w/.test(await shown()), at + ': the chapter shows with no stars');
    await caretIn('.md-i', -1);
    await keys('s');
    await sleep(200);
    ok((await txt('.md-i'))[0] === 'toll desks', at + ': a letter typed at the end of italic words is italic', JSON.stringify((await txt('.md-i'))[0]));
    await keys(' now');
    await sleep(250);
    ok((await txt('.md-i'))[0] === 'toll desks now', at + ': a space and a word typed there stay italic', JSON.stringify((await txt('.md-i'))[0]));
    await noStars('after typing at the end of italics');
    await press(K.back, 5);
    ok((await txt('.md-i'))[0] === 'toll desk', at + ': Backspace takes them out again', JSON.stringify((await txt('.md-i'))[0]));
    // The way the iPad's autocorrect and dictation put words in: as an insert, not as keys.
    await js("document.execCommand('insertText', false, 's'); return true"); await sleep(250);
    ok((await txt('.md-i'))[0] === 'toll desks', at + ': words put in as an insert (autocorrect, dictation) at the end of italics are italic', JSON.stringify((await txt('.md-i'))[0]));
    await js("document.execCommand('delete'); return true"); await sleep(250);
    ok((await txt('.md-i'))[0] === 'toll desk', at + ': and a delete that is not a key press takes one letter', JSON.stringify((await txt('.md-i'))[0]));
    await caretIn('.md-b', 0);
    await press(K.back);
    ok((await txt('.md-b'))[0] === 'forgotten' && /thisforgotten/.test(await shown()), at + ': Backspace before bold words deletes the letter before, the bold stays');
    await keys(' ');
    await sleep(200);
    ok(/this forgotten/.test(await shown()) && (await txt('.md-b'))[0] === 'forgotten', at + ': and a space typed there goes back in front of them');
    await noStars('after deleting beside bold');
    await caretIn('.md-b', -1);
    await press(K.back, 9);
    await noStars('after deleting a whole bold word');
    await keys('gone');
    await caretIn('.md-i', 4);
    await press(K.enter);
    { const it = await txt('.md-i'); ok(it[0] === 'toll' && it[1].trim() === 'desk', at + ': Enter inside italic words leaves both halves italic', JSON.stringify(it.slice(0, 2))); }
    await noStars('after Enter inside italics');
    await press(K.back);
    await noStars('after joining the lines');
    // Arrow keys: every press moves the cursor, across hidden marks too.
    await caretIn('.md-hl', 0);
    await press(K.left, 4);
    const spots = [];
    for (let i = 0; i < 16; i++) { await press(K.right); spots.push(await js("const r = getSelection().getRangeAt(0).getBoundingClientRect(); const c = document.querySelector('.writer-page .cm-cursor'); const q = c ? c.getBoundingClientRect() : r; return Math.round(q.left) + ',' + Math.round(q.top);")); }
    ok(spots.every((s, i) => i === 0 || s !== spots[i - 1]), at + ': every arrow key press moves the cursor, across hidden marks too', spots.join(' '));
    // The tool row.
    await caretIn('.cm-line:nth-child(3)', 0);
    await shiftPress(K.right, 9);
    await click('.writer button', 'Bold'); await sleep(300);
    ok((await txt('.md-b')).includes('Paragraph'), at + ': Bold styles the words picked', JSON.stringify(await txt('.md-b')));
    await click('.writer button', 'Highlight'); await sleep(300);
    ok((await txt('.md-hl')).includes('Paragraph'), at + ': Highlight on top of it');
    await noStars('after Bold and Highlight');
    await click('.writer button', 'Undo'); await click('.writer button', 'Undo'); await sleep(300);
    ok(!(await txt('.md-b')).includes('Paragraph') && !(await txt('.md-hl')).includes('Paragraph'), at + ': Undo twice takes both off');
    await caretIn('.cm-line:nth-child(3)', 0);
    await press(K.end);
    await keys(' ');
    await click('.writer button', 'Bold'); await sleep(200);
    await keys('Loud words');
    await click('.writer button', 'Bold'); await sleep(200);
    await keys(' quiet.');
    await sleep(300);
    ok((await txt('.md-b')).includes('Loud words') && /Loud words quiet\./.test(await shown()), at + ': Bold pressed between words makes the next words bold, pressed again ends it', JSON.stringify(await txt('.md-b')));
    await noStars('after bold between words');
    ok(await js("return document.activeElement && document.activeElement.classList.contains('cm-content')"), at + ': the cursor is still in the page after the buttons');
    console.log('     ' + (await js("const a = getComputedStyle(document.querySelector('.writer-page .cm-line')); return 'the page type: ' + a.fontFamily + ' ' + a.fontSize + ' ' + a.lineHeight")));
    // Saved: the Markdown the page shows.
    await js("document.querySelector('.writer-page .cm-content').dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); return true;");
    { const end = Date.now() + 12000; while (Date.now() < end && !/Loud words/.test(fake.headTree().get(SCENE))) await sleep(150); }
    const saved = bodyOf(fake.headTree().get(SCENE));
    ok(/\*\*Loud words\*\* quiet\./.test(saved), at + ': saved: the bold words keep their stars', (/.{0,20}Loud words.{0,20}/.exec(saved) || ['(not saved)'])[0]);
    ok(/\*toll\* ?\*desk\*|\*toll desk\*/.test(saved), at + ': saved: the italics are whole', (/.{0,10}toll[\s\S]{0,14}/.exec(saved) || [''])[0]);
    ok(!/\*\*\*\*|==\s*==/.test(saved), at + ': saved: no empty or broken marks');
    ok(!(await js("return document.documentElement.scrollWidth > window.innerWidth + 1")), at + ': no sideways scroll');
    await wd('GET', '/session/' + sid + '/screenshot').then((b64) => import('node:fs').then((fs) => fs.writeFileSync('box-wk-' + w + '.png', Buffer.from(b64, 'base64'))));
    const errs = await js('return window.__errs || []');
    ok(!errs.length, at + ': no page errors', errs.join(' | '));
  }
  console.log('RESULT fail=' + fail);
  await done(fail ? 1 : 0);
} catch (e) {
  console.error('FAILED', e);
  await done(1);
}
