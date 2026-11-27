// The Scaffold pane (2026-11-27) in a real WebKit (the iPad's engine), on the demo vault: the button opens the book's
// scaffold on the right half, the page inside opens the chapter being written and scrolls by itself, the Team column
// swaps in at its own 376 px, and typing on the page still works with the scaffold open. iPad sizes and a desktop.
import { spawn } from 'node:child_process';
const APP = process.env.APP || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1700x1300x24'], { stdio: 'ignore' });
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
const done = async (code) => { try { if (sid) await wd('DELETE', '/session/' + sid); } catch {} driver.kill(); xvfb.kill(); process.exit(code); };
try {
  const s = await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'MiniBrowser', 'webkitgtk:browserOptions': { binary: '/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', args: ['--automation'] } } } });
  sid = s.sessionId;
  const js = (script, ...args) => wd('POST', '/session/' + sid + '/execute/sync', { script, args });
  const until = async (script, what, ms = 15000) => { const end = Date.now() + ms; for (;;) { const v = await js(script); if (v) return v; if (Date.now() > end) throw new Error('timed out: ' + what); await sleep(150); } };
  const click = (label) => js("const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === arguments[0] || x.textContent.trim() === arguments[0]); if (!b) throw new Error('no ' + arguments[0]); b.click(); return true;", label);
  const scene = '#/write/' + encodeURIComponent('Series/Ember Road/Books/1 Ash Bell/Scenes/S-005 The Ledger.md');
  for (const [w, h] of [[1366, 1024], [1180, 820], [1600, 1000]]) {
    console.log('== ' + w + 'x' + h);
    await wd('POST', '/session/' + sid + '/window/rect', { width: w, height: h });
    await wd('POST', '/session/' + sid + '/url', { url: APP + scene });
    await js("try { localStorage.setItem('story-forge.theme', 'violet-night'); localStorage.removeItem('sparrow.scaffold-open'); } catch (e) {} return true;");
    await wd('POST', '/session/' + sid + '/refresh', {});
    await until("return document.querySelector('.cm-content') && [...document.querySelectorAll('button')].some((b) => b.getAttribute('aria-label') === 'Outline')", 'the Outline button');
    await click('Outline');
    await until("return document.querySelector('.scaffold-frame')", 'the scaffold frame');
    await sleep(900);
    const g = await js("const v = innerWidth, f = document.querySelector('.writer-scaffold').getBoundingClientRect(), p = document.querySelector('.writer-page').getBoundingClientRect(); return { v, left: f.left, right: f.right, pr: p.right, side: !!document.querySelector('.writer-side'), team: !!document.querySelector('.writer-right') };");
    ok(Math.abs(g.left - g.v / 2) <= 8 && g.v - g.right <= 14, 'the scaffold covers the right half', JSON.stringify(g));
    ok(!g.side && !g.team, 'the chapter list and Team column step aside');
    const frame = await js("return document.querySelector('.scaffold-frame')");
    await wd('POST', '/session/' + sid + '/frame', { id: frame });
    const inside = await until("const b = document.querySelector('.beat.here button'); return b ? { id: b.id, open: b.getAttribute('aria-expanded'), bg: getComputedStyle(document.body).backgroundColor, store: (() => { try { localStorage.length; return 'reachable'; } catch (e) { return 'sealed'; } })() } : null", 'chapter 3 open');
    ok(inside.id === 'c3' && inside.open === 'true', 'the page opened chapter 3', JSON.stringify(inside));
    ok(inside.bg === 'rgb(32, 31, 39)', 'it takes Violet Night\'s colours');
    ok(inside.store === 'sealed', 'the page cannot reach what the app keeps');
    const sc = await js("document.body.style.minHeight = '3000px'; scrollTo(0, 0); scrollBy(0, 400); return scrollY;");
    ok(sc >= 390, 'the scaffold scrolls inside its pane', String(sc));
    await wd('POST', '/session/' + sid + '/frame/parent', {});
    // Typing on the page with the scaffold open.
    await js("const l = [...document.querySelectorAll('.cm-line')].pop(); const r = document.createRange(); r.selectNodeContents(l); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector('.cm-content').focus(); return true;");
    await sleep(200);
    await wd('POST', '/session/' + sid + '/actions', { actions: [{ type: 'key', id: 'kb', actions: [...' zq'].flatMap((ch) => [{ type: 'keyDown', value: ch }, { type: 'keyUp', value: ch }]) }] });
    await sleep(300);
    ok(await js("return document.querySelector('.cm-content').innerText.includes('zq')"), 'typing on the page still works');
    await click('Team');
    await sleep(500);
    const t = await js("const r = document.querySelector('.writer-right'); return { w: r ? Math.round(r.getBoundingClientRect().width) : 0, scaf: !!document.querySelector('.writer-scaffold') };");
    ok(t.w === 376 && !t.scaf, 'Team swaps in at its own 376 px and the scaffold closes', JSON.stringify(t));
    await click('Outline');
    await until("return document.querySelector('.scaffold-frame') && !document.querySelector('.writer-right')", 'scaffold back');
    await wd('POST', '/session/' + sid + '/refresh', {});
    await until("return document.querySelector('.cm-content')", 'page again');
    await sleep(800);
    ok(await js("return !!document.querySelector('.writer-scaffold')"), 'the device remembers the scaffold was open');
  }
  console.log(fail ? 'FAILED ' + fail : 'all good');
  await done(fail ? 1 : 0);
} catch (e) { console.log('ERROR ' + e.message); await done(1); }
