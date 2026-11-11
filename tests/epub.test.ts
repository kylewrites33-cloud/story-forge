import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildEpub, coverFile, headingHtml, inlineHtml, kindleFile, matterPages, screenHtml, splitNote, starterMatter } from '../src/lib/epub.ts';
import { manuscript } from '../src/lib/docx.ts';
import { buildIndex } from '../src/lib/vault-index.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { DEMO, FsSource } from './helpers.ts';

async function demo() {
  const src = new FsSource(DEMO);
  const schema = parseSchema(fs.readFileSync(path.join(DEMO, 'System/schema.json'), 'utf8'));
  const { files } = await src.tree();
  return { src, schema, index: await buildIndex({ schema, files, read: (p) => src.read(p), phase: 6 }) };
}

/** The entries of a store-only zip, in order. */
function unzip(buf: Uint8Array): [string, Uint8Array][] {
  const out: [string, Uint8Array][] = [];
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let p = 0; v.getUint32(p, true) === 0x04034b50;) {
    const size = v.getUint32(p + 18, true), nameLen = v.getUint16(p + 26, true);
    out.push([new TextDecoder().decode(buf.subarray(p + 30, p + 30 + nameLen)), buf.subarray(p + 30 + nameLen, p + 30 + nameLen + size)]);
    p += 30 + nameLen + size;
  }
  return out;
}
const text = (files: [string, Uint8Array][], name: string) => new TextDecoder().decode(files.find(([n]) => n === name)![1]);

test('a System screen (format C1) is a box: bold title, one line per fact, a lone ">" a gap, no ">" marks left', () => {
  const html = screenHtml('> **Common Sparrow**\n> Level 1\n>\n> HP: 3/10\n> *Note: fine print.*');
  assert.equal(html, '<div class="screen"><p class="t">Common Sparrow</p><p>Level 1</p><p class="sp">HP: 3/10</p><p><em>Note: fine print.</em></p></div>');
  assert.equal(screenHtml('> MIND: 79.1 [Status Effect -20 pts]'), '<div class="screen"><p>MIND: 79.1 [Status Effect -20 pts]</p></div>');
  assert.equal(screenHtml('> a & b <c>'), '<div class="screen"><p>a &amp; b &lt;c&gt;</p></div>');
});

test('words keep italics and bold, drop highlights, and keep web links', () => {
  assert.equal(inlineHtml('a *b* **c** ==note== [[Basil|him]]'), 'a <em>b</em> <strong>c</strong> note him');
  assert.equal(inlineHtml('[the next book](https://example.com/x?a=1&b=2).'), '<a href="https://example.com/x?a=1&amp;b=2">the next book</a>.');
  assert.equal(headingHtml('Chapter 3: The *Water* Tank'), '<h1 class="chapter"><span class="num">Chapter 3</span> <span class="ctitle">The <em>Water</em> Tank</span></h1>');
});

test('book matter pages: front and back in the order written, empty pages and the note above them left out', () => {
  const pages = matterPages('For the team.\n\n## Front: Copyright\nCopyright 2026.\n\n## Front: Dedication\n\n## Back: About the Author\nWrites.\n<!-- hidden -->');
  assert.deepEqual(pages, [{ place: 'front', title: 'Copyright', body: 'Copyright 2026.' }, { place: 'back', title: 'About the Author', body: 'Writes.' }]);
  const starter = matterPages(splitNote(starterMatter('Kyle Heath', new Date(2026, 10, 4))).body);
  assert.equal(starter.length, 1, 'only the copyright page has words in a new note');
  assert.match(starter[0].body, /Copyright © 2026 Kyle Heath\. All rights reserved\./);
});

test('the Kindle file: mimetype first, cover marked cover-image with no cover page, matter around the chapters, contents', async () => {
  const { schema, index } = await demo();
  const book = index.books[0];
  const m = manuscript(schema, index, book);
  const bytes = buildEpub({ title: 'Ash Bell', author: 'Test Author', manuscript: m, matter: matterPages('## Front: Copyright\nC.\n\n## Back: Also by\nA.'),
    cover: { bytes: new Uint8Array([0xff, 0xd8, 0xff]), type: 'image/jpeg' }, series: { name: 'Ember Road', number: 1 } }, new Date(2026, 10, 4, 12));
  const files = unzip(bytes);
  assert.equal(files[0][0], 'mimetype');
  assert.equal(text(files, 'mimetype'), 'application/epub+zip');
  const opf = text(files, 'OEBPS/content.opf');
  assert.match(opf, /<item id="cover" href="cover\.jpg" media-type="image\/jpeg" properties="cover-image"\/>/);
  assert.match(opf, /belongs-to-collection" id="series">Ember Road<.*group-position">1</);
  const order = [...opf.matchAll(/<itemref idref="([^"]+)"/g)].map((x) => x[1]);
  assert.deepEqual(order.slice(0, 3), ['title', 'front1', 'nav']);
  assert.equal(order[order.length - 1], 'back1');
  assert.equal(order.filter((o) => /^ch\d+$/.test(o)).length, m.chapters.length);
  const nav = text(files, 'OEBPS/nav.xhtml');
  assert.doesNotMatch(nav, /Copyright/, 'the copyright page is not in the contents');
  assert.match(nav, /Also by/);
  assert.match(nav, /epub:type="bodymatter" href="ch001\.xhtml"/);
  for (const [name, data] of files) {
    if (!/\.xhtml$/.test(name)) continue;
    const t = new TextDecoder().decode(data);
    assert.doesNotMatch(t, /<p>&gt;/, name + ' has a screen left as plain text');
  }
});

test('the cover is the newest full-size picture in the Cover folder', () => {
  const f = coverFile([{ path: 'B/Cover/Original cover 2026-10-01 090000.jpg', sha: 'a' }, { path: 'B/Cover/Original cover 2026-10-29 101500.png', sha: 'b' },
    { path: 'B/Cover/Cover Brief.md', sha: 'c' }, { path: 'B/Cover.jpg', sha: 'd' }], 'B');
  assert.deepEqual(f, { path: 'B/Cover/Original cover 2026-10-29 101500.png', sha: 'b', type: 'image/png' });
  assert.equal(coverFile([{ path: 'B/Cover.jpg', sha: 'd' }], 'B'), null);
});

test('the demo book makes a Kindle file with its matter, and says the cover is missing', async () => {
  const { src, schema, index } = await demo();
  const book = index.books[0];
  const k = await kindleFile(src, schema, index, book, new Date(2026, 10, 4));
  assert.match(k.name, /\.epub$/);
  assert.deepEqual(k.missing, ['the cover']);
  assert.match(text(unzip(k.bytes), 'OEBPS/front1.xhtml'), /Copyright © 2026 Test Author/);
});
