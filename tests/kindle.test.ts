import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Kindle } from '../src/lib/kindle.js';
import { renderKindle } from '../scripts/sync-parser.js';
import { kindleFile } from '../src/lib/epub.ts';
import { buildIndex } from '../src/lib/vault-index.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { DEMO, FsSource, hasVault, ROOT, VAULT } from './helpers.ts';

async function demo() {
  const src = new FsSource(DEMO);
  const schema = parseSchema(fs.readFileSync(path.join(DEMO, 'System/schema.json'), 'utf8'));
  const { files } = await src.tree();
  return { src, schema, index: await buildIndex({ schema, files, read: (p) => src.read(p), phase: 6 }) };
}

function unzip(buf: Uint8Array): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let p = 0; v.getUint32(p, true) === 0x04034b50;) {
    const size = v.getUint32(p + 18, true), nameLen = v.getUint16(p + 26, true);
    out.set(new TextDecoder().decode(buf.subarray(p + 30, p + 30 + nameLen)), buf.subarray(p + 30 + nameLen, p + 30 + nameLen + size));
    p += 30 + nameLen + size;
  }
  return out;
}

test('the Kindle parts copy matches the sf tool in the vault', { skip: !hasVault && 'author-business is not checked out beside this repository' }, () => {
  const sf = fs.readFileSync(path.join(VAULT, 'System', 'Tools', 'sf.js'), 'utf8');
  assert.equal(fs.readFileSync(path.join(ROOT, 'src', 'lib', 'kindle.js'), 'utf8'), renderKindle(sf), 'src/lib/kindle.js differs from sf.js. Run npm run sync-parser.');
});

test('curly quotes: the hard cases by name', () => {
  const s = Kindle.smart;
  assert.equal(s('<p>"Hello," she said. "It\'s fine."</p>'), '<p>“Hello,” she said. “It’s fine.”</p>');
  assert.equal(s("<p>'Em and 'til, 'cause rock 'n' roll</p>"), '<p>’Em and ’til, ’cause rock ’n’ roll</p>', 'dropped letters');
  assert.equal(s('<p>"Listen, Madam Freeweight—"</p><p>"—Firelight," she said.</p>'), '<p>“Listen, Madam Freeweight—”</p><p>“—Firelight,” she said.</p>', 'a quote after a dash');
  assert.equal(s('<p>"He said \'no\' to me."</p>'), '<p>“He said ‘no’ to me.”</p>', 'a quote inside a quote');
  assert.equal(s('<p>He was 5\'10" and 6\' tall.</p>'), '<p>He was 5\'10" and 6\' tall.</p>', 'feet and inches stay straight');
  assert.equal(s('<p>"<em>Hello</em>," he said.</p>'), '<p>“<em>Hello</em>,” he said.</p>', 'italics are see-through');
  assert.equal(s('<p>the \'90s and the Basils\' farm</p>'), '<p>the ’90s and the Basils’ farm</p>');
  assert.equal(s('<div class="screen"><p>HP: 3/10</p><p>"Hi"</p></div>'), '<div class="screen"><p>HP: 3/10</p><p>“Hi”</p></div>', 'each line of a System screen starts afresh');
  assert.equal(s('<p>&quot;Hi,&quot; &amp; it&#39;s</p>'), '<p>“Hi,” &amp; it’s</p>');
  assert.equal(s('<a href="https://x.com/?a=\'b\'">it\'s</a>'), '<a href="https://x.com/?a=\'b\'">it’s</a>', 'never inside a tag');
  assert.equal(s('<w:p><w:r><w:t>"Go</w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>now</w:t></w:r><w:r><w:t>."</w:t></w:r></w:p>'),
    '<w:p><w:r><w:t>“Go</w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>now</w:t></w:r><w:r><w:t>.”</w:t></w:r></w:p>', 'Word runs');
});

test('dashes and ellipses', () => {
  assert.equal(Kindle.smart('<p>bestiary--except... wait. . . no----</p>'), '<p>bestiary—except… wait… no----</p>');
});

test('the title page: title, subtitle, series and book number, author, publisher', () => {
  assert.equal(Kindle.titlePage({ title: 'Quest Declined 2', subtitle: 'A Level 99 Healer', series: 'Quest Declined', number: 2, author: 'Kyle Heath', publisher: 'Kyle Writes' }),
    '<section class="titlepage" epub:type="titlepage"><h1>Quest Declined 2</h1><p class="subtitle">A Level 99 Healer</p><p class="series">Quest Declined, Book Two</p><p class="author">Kyle Heath</p><p class="publisher">Kyle Writes</p></section>');
  assert.equal(Kindle.subtitleOf('Quest Declined', { long_title: 'Quest Declined: A Level 99 Healer Retires to Farm' }), 'A Level 99 Healer Retires to Farm');
  assert.equal(Kindle.subtitleOf('Quest Declined', { long_title: 'Other', subtitle: '' }), '');
  assert.equal(Kindle.subtitleOf('X', { subtitle: 'Own', long_title: 'X: Long' }), 'Own');
});

test('series pages fill in what the book does not have; the book wins where it has words', () => {
  const book = Kindle.matterSections('## Front: Copyright\nC.\n\n## Back: Next in the series\nNext.\n\n## Back: About the Author\n');
  const series = Kindle.matterSections('## Back: About the Author\nSeries bio.\n\n## Back: Also by Kyle Heath\n\n## Front: Copyright\nSeries copyright.');
  assert.deepEqual(Kindle.mergeMatter(book, series).map((p) => p.place + ':' + p.title + ':' + p.body),
    ['front:Copyright:C.', 'back:Next in the series:Next.', 'back:About the Author:Series bio.', 'back:Also by Kyle Heath:']);
});

test('Also by lists the series\' other books with links, then its own words, and never the book it is in', () => {
  const books = [{ title: 'Quest Declined 2', number: 2, url: 'https://www.amazon.com/dp/B2' }, { title: 'Quest Declined', number: 1, url: 'https://www.amazon.com/dp/B1' }, { title: 'Quest Declined 3', number: 3, url: '' }];
  const own = '[Useless Magic](https://www.amazon.com/dp/UM)\n\n[Quest Declined 2](https://www.amazon.com/dp/B2)';
  const p = Kindle.alsoBy({ place: 'back', title: 'Also by Kyle Heath', body: own }, 'Quest Declined', books, { title: 'Quest Declined 2', url: 'https://www.amazon.com/dp/B2' });
  assert.equal(p.body, '*Quest Declined*\n\n[Quest Declined](https://www.amazon.com/dp/B1)\n\n[Useless Magic](https://www.amazon.com/dp/UM)');
  const one = Kindle.bookMatter('', '## Back: Also by Kyle Heath\n', 'Quest Declined', [books[0]], { title: 'Quest Declined 2' });
  assert.deepEqual(one, [], 'nothing to list: the page is left out');
});

function jpeg(w: number, h: number) {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
}
function png(w: number, h: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h);
  return b;
}

test('the cover size check says plainly when the cover is too small or the wrong shape', () => {
  assert.deepEqual(Kindle.imageSize(jpeg(1600, 2560)), { width: 1600, height: 2560 });
  assert.deepEqual(Kindle.imageSize(png(1600, 2560)), { width: 1600, height: 2560 });
  assert.deepEqual(Kindle.coverProblems(jpeg(1600, 2560)), []);
  assert.match(Kindle.coverProblems(jpeg(800, 1280))[0], /800 wide by 1,280 tall\. Amazon asks for 1,600 wide by 2,560 tall/);
  assert.match(Kindle.coverProblems(png(2560, 2560)).join(' '), /not the usual shape/);
  assert.match(Kindle.coverProblems(null)[0], /no cover/);
});

test('the ready check names every leftover and passes a clean book', () => {
  const page = (label: string, html: string, kind = 'chapter') => ({ label, html, kind });
  const words = '<p>' + 'word '.repeat(120) + '</p>';
  const bad = Kindle.check({
    pages: [page('Chapter 1: Start', words + '<p>A {fix this} note and *stars* and "straight"</p>'), page('Chapter 2', words), page('Chapter 3: Short', '<p>Too short.</p>'),
      page('Next', '<p><a href="#">here</a> and [ISBN]</p>', 'matter')],
    matter: [{ place: 'back', title: 'Next', body: 'x' }, { place: 'back', title: 'Newsletter', body: '' }], cover: null, author: ''
  });
  const all = bad.problems.join('\n');
  for (const want of [/Chapter 1: Start still has a \{ \} note/, /stray writing mark/, /straight quote mark/, /Chapter 2 has no chapter title/, /Chapter 3: Short has only 2 words/,
    /link that goes nowhere: #/, /blank to fill in: .*\[ISBN\]/, /no cover/, /no copyright page/, /"Newsletter" has no words/, /no author/]) assert.match(all, want);
  const good = Kindle.check({ pages: [page('Chapter 1: Start', words)], matter: [{ place: 'front', title: 'Copyright', body: 'C.' }], cover: jpeg(1600, 2560), author: 'A' });
  assert.deepEqual(good.problems, []);
  assert.ok(good.good.length >= 5);
});

test('the demo book: series pages, title page, curly quotes and the ready check come through the app', async () => {
  const { src, schema, index } = await demo();
  Object.assign(index.notes[index.books[0].path].data, { subtitle: 'A Test Novel', publisher: 'Demo Press' });
  const k = await kindleFile(src, schema, index, index.books[0], new Date(2026, 10, 14));
  const f = unzip(k.bytes);
  const td = new TextDecoder();
  assert.match(td.decode(f.get('OEBPS/title.xhtml')), /<p class="subtitle">A Test Novel<\/p><p class="series">Ember Road, Book One<\/p><p class="author">Test Author<\/p><p class="publisher">Demo Press<\/p>/);
  const back = [...f.keys()].filter((n) => /back\d+\.xhtml$/.test(n)).map((n) => td.decode(f.get(n)));
  assert.match(back.join(''), /Test Author writes small books for testing/, 'the book\'s own About the Author wins');
  assert.match(back.join(''), /<h2>Also by Test Author<\/h2>[\s\S]*Salt Lantern/, 'the series page fills in Also by');
  assert.match(td.decode(f.get('OEBPS/content.opf')), /<dc:publisher>Demo Press<\/dc:publisher>/);
  assert.ok(k.check.problems.some((p) => /no cover/.test(p)));
  assert.ok(k.check.problems.some((p) => /"Dedication" has no words/.test(p)));
});

test('sf compile --epub and the app make the same pages', { skip: !hasVault && 'author-business is not checked out beside this repository' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-'));
  fs.cpSync(DEMO, dir, { recursive: true });
  execFileSync('node', [path.join(VAULT, 'System', 'Tools', 'sf.js'), 'compile', 'Series/Ember Road/Books/1 Ash Bell', '--epub'], { cwd: dir });
  const sf = unzip(new Uint8Array(fs.readFileSync(path.join(dir, 'Series/Ember Road/Books/1 Ash Bell/Exports/Ash Bell.epub'))));
  fs.rmSync(dir, { recursive: true, force: true });
  const { src, schema, index } = await demo();
  const app = unzip((await kindleFile(src, schema, index, index.books[0])).bytes);
  // sf leaves out scenes whose status is not drafted yet and the app does not, so the demo's chapters differ; every other
  // page must match: the stylesheet, the title page, the front and back pages.
  const td = new TextDecoder();
  assert.ok([...sf.keys()].every((n) => app.has(n)), 'sf made a file the app did not');
  for (const [name, data] of app) {
    if (!sf.has(name) || /(ch\d+\.xhtml|nav\.xhtml|toc\.ncx|content\.opf)$/.test(name)) continue;
    const a = td.decode(data).replace(/<meta property="dcterms:modified">[^<]*<\/meta>/, '');
    const b = td.decode(sf.get(name)).replace(/<meta property="dcterms:modified">[^<]*<\/meta>/, '');
    assert.equal(a, b, name + ' differs between the app and sf');
  }
});

test('Look inside shows the file\'s own pages in reading order, the contents after the front pages, links kept inside', async () => {
  const { previewDoc } = await import('../src/lib/lookinside.ts');
  const { src, schema, index } = await demo();
  const k = await kindleFile(src, schema, index, index.books[0]);
  const doc = previewDoc(k, 'sepia', 'large');
  const at = (s: string) => doc.indexOf(s);
  assert.ok(at('id="title"') < at('id="front1"') && at('id="front1"') < at('id="nav"') && at('id="nav"') < at('id="ch001"') && at('id="ch001"') < at('id="back1"'));
  assert.match(doc, /href="#ch001"/);
  assert.doesNotMatch(doc, /\.xhtml"/);
  assert.match(doc, /#f8ecd4/);
  assert.match(doc, /div\.screen\{/, 'the file\'s own stylesheet');
});
