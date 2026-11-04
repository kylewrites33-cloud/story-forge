// The Kindle file (Kyle, 2026-11-04: "Start on step 1" of the vault's Docs/Sparrow/17 Replacing Vellum.md): the book as
// an EPUB 3 made on the device, ready to upload to KDP, so Vellum is no longer needed for the ebook. Same reading order
// and italics as Export to Word (docx.ts). System screens (format C1) are boxed, left-aligned blocks with a bold
// small-caps title, the look Kyle set in Vellum with Inset. Front and back matter come from the book's `Book Matter.md`
// note; the cover is the newest full-size picture in the book's Cover/ folder. The vault tool's `sf compile --epub`
// makes the same file (Epub.build in sf.js); keep the two in step.
import { exportName, isScreen, manuscript, pieces, zip } from './docx.ts';
import type { Manuscript } from './docx.ts';
import type { BookEntry, Schema, VaultIndex, VaultSource } from './types.ts';

const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One page of front or back matter: a `## Front: <name>` or `## Back: <name>` section of Book Matter.md. */
export interface MatterPage { place: 'front' | 'back'; title: string; body: string }

/** The pages of a Book Matter note, in the order written. Text before the first heading is a note to the team and is left out. */
export function matterPages(body: string): MatterPage[] {
  const out: MatterPage[] = [];
  let cur: MatterPage | null = null;
  String(body || '').replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n?/g, '\n').split('\n').forEach((line) => {
    const h = /^##\s+(front|back)\s*:\s*(.+?)\s*$/i.exec(line);
    if (h) { cur = { place: h[1].toLowerCase() as 'front' | 'back', title: h[2], body: '' }; out.push(cur); return; }
    if (cur) cur.body += line + '\n';
  });
  out.forEach((p) => { p.body = p.body.trim(); });
  return out.filter((p) => p.body);
}

/** A line's words as XHTML: italics and bold as the writing screen reads them, highlights dropped (notes to self),
 * wiki links as their words, and web links in back matter (`[the next book](https://...)`) kept as links. */
export function inlineHtml(text: string): string {
  const words = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
  const links: { label: string; url: string }[] = [];
  const marked = words.replace(/\[([^\]]+)\]\(((?:https?:|mailto:)[^)\s]+)\)/gi, (_, label, url) => { links.push({ label, url }); return '\u0000' + (links.length - 1) + '\u0000'; });
  return marked.split(/\u0000(\d+)\u0000/).map((part, i) => {
    if (i % 2) { const l = links[+part]; return '<a href="' + x(l.url) + '">' + inlineHtml(l.label) + '</a>'; }
    return pieces(part).map((p) => {
      let s = x(p.text);
      if (p.i) s = '<em>' + s + '</em>';
      if (p.b) s = '<strong>' + s + '</strong>';
      return s;
    }).join('');
  }).join('');
}

/** A System screen as a boxed block: one line per fact, a lone ">" a gap before the next line, an all-bold line its title. */
export function screenHtml(p: string): string {
  const lines = p.split('\n').map((l) => l.replace(/^\s*> ?/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const out: string[] = [];
  let gap = false;
  lines.forEach((l) => {
    if (!l.trim()) { gap = true; return; }
    const title = /^\*\*[^*].*\*\*$/.test(l.trim());
    const cls = [title ? 't' : '', gap && out.length ? 'sp' : ''].filter(Boolean).join(' ');
    out.push('<p' + (cls ? ' class="' + cls + '"' : '') + '>' + inlineHtml(title ? l.trim().slice(2, -2) : l.trim()) + '</p>');
    gap = false;
  });
  return '<div class="screen">' + out.join('') + '</div>';
}

/** A run of prose (a scene, or a page of matter) as paragraphs; the first has no indent. */
function proseHtml(text: string, firstClass = 'first', flat = false): string {
  let first = true;
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => {
    if (/^(#|\*\s?\*\s?\*)$/.test(p)) { first = true; return '<p class="break">* * *</p>'; }
    if (isScreen(p)) return screenHtml(p);
    const html = '<p' + (first || flat ? ' class="' + firstClass + '"' : '') + '>' + inlineHtml(p.replace(/\n/g, ' ')) + '</p>';
    first = false;
    return html;
  }).join('\n');
}

/** "Chapter 3: The Water Tank" shows as a small "Chapter 3" over the title. */
export function headingHtml(heading: string): string {
  const m = /^Chapter\s+(\S+)\s*:\s*(.+)$/.exec(heading);
  if (!m) return '<h1 class="chapter"><span class="ctitle">' + x(heading) + '</span></h1>';
  return '<h1 class="chapter"><span class="num">Chapter ' + x(m[1]) + '</span> <span class="ctitle">' + inlineHtml(m[2]) + '</span></h1>';
}

/** Pages that carry no heading of their own: they are read as what they are. */
const QUIET = /^(copyright|dedication|epigraph)$/i;

function matterHtml(p: MatterPage): string {
  const kind = p.title.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  // Matter pages are short blocks, so no paragraph is indented.
  if (QUIET.test(p.title)) return '<section class="matter ' + kind + '">' + proseHtml(p.body, 'noindent', true) + '</section>';
  return '<section class="matter"><h2>' + inlineHtml(p.title) + '</h2>' + proseHtml(p.body, 'noindent', true) + '</section>';
}

/** A stable book id from its title and author, so a new file of the same book keeps its id. */
export function bookId(title: string, author: string): string {
  const h = (seed: number) => {
    let v = seed >>> 0;
    for (const c of 'sparrow:' + title + ':' + author) { v ^= c.charCodeAt(0); v = Math.imul(v, 16777619) >>> 0; }
    return v.toString(16).padStart(8, '0');
  };
  const a = h(2166136261) + h(1) + h(2) + h(3);
  return [a.slice(0, 8), a.slice(8, 12), '5' + a.slice(13, 16), '8' + a.slice(17, 20), a.slice(20, 32)].join('-');
}

export const CSS = [
  'p{margin:0;text-indent:1.5em;}',
  'p.first,p.noindent{text-indent:0;}',
  'p.break{text-align:center;text-indent:0;margin:1em 0;}',
  'h1.chapter{text-align:center;font-weight:normal;margin:2em 0 1.5em;page-break-before:always;}',
  'h1.chapter .num{display:block;font-size:0.75em;letter-spacing:0.12em;text-transform:uppercase;}',
  'h1.chapter .ctitle{display:block;font-size:1.3em;margin-top:0.4em;}',
  'div.screen{margin:1em 0.5em;padding:0.5em 0.8em;border:1px solid;page-break-inside:avoid;}',
  'div.screen p{text-indent:0;text-align:left;}',
  'div.screen p.t{font-weight:bold;font-variant:small-caps;}',
  'div.screen p.sp{margin-top:0.8em;}',
  '.titlepage{text-align:center;margin-top:30%;}',
  '.titlepage h1{font-weight:normal;font-size:1.8em;margin-bottom:1em;}',
  '.titlepage p{text-align:center;text-indent:0;}',
  'section.matter h2{text-align:center;font-weight:normal;margin:2em 0 1em;}',
  'section.matter p{margin-bottom:0.6em;}',
  'section.copyright{font-size:0.85em;margin-top:2em;}',
  'section.dedication,section.epigraph{text-align:center;margin-top:30%;}',
  'section.dedication p,section.epigraph p{text-align:center;}',
  'nav ol{list-style-type:none;padding-left:0;}',
  'nav li{margin:0.3em 0;}'
].join('\n') + '\n';

export interface EpubInput {
  title: string;
  author: string;
  manuscript: Manuscript;
  matter?: MatterPage[];
  cover?: { bytes: Uint8Array; type: 'image/jpeg' | 'image/png' };
  series?: { name: string; number: number | null };
}

/** The .epub itself. */
export function buildEpub(input: EpubInput, when: Date = new Date()): Uint8Array {
  const { title, author, manuscript: m } = input;
  const matter = input.matter || [];
  const modified = when.toISOString().replace(/\.\d+Z$/, 'Z');
  const page = (t: string, body: string, type = '') => '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en"><head><meta charset="utf-8"/><title>' + x(t) +
    '</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body' + (type ? ' epub:type="' + type + '"' : '') + '>' + body + '</body></html>\n';
  const files: { name: string; data: string | Uint8Array }[] = [
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n' },
    { name: 'OEBPS/style.css', data: CSS }
  ];
  const items: string[] = ['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>', '<item id="css" href="style.css" media-type="text/css"/>'];
  const spine: string[] = [];
  const toc: { href: string; label: string }[] = [];
  const add = (id: string, label: string, html: string, inToc: boolean, type = '') => {
    files.push({ name: 'OEBPS/' + id + '.xhtml', data: page(label, html, type) });
    items.push('<item id="' + id + '" href="' + id + '.xhtml" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="' + id + '"/>');
    if (inToc) toc.push({ href: id + '.xhtml', label });
  };
  // Kindle wants the cover as an image marked cover-image and no cover page of its own (KDP help G6GTK3T3NUHKLEFX).
  if (input.cover) {
    const ext = input.cover.type === 'image/png' ? 'png' : 'jpg';
    files.push({ name: 'OEBPS/cover.' + ext, data: input.cover.bytes });
    items.push('<item id="cover" href="cover.' + ext + '" media-type="' + input.cover.type + '" properties="cover-image"/>');
  }
  add('title', title, '<section class="titlepage" epub:type="titlepage"><h1>' + x(title) + '</h1>' + (author ? '<p>' + x(author) + '</p>' : '') + '</section>', false);
  matter.filter((p) => p.place === 'front').forEach((p, i) => add('front' + (i + 1), p.title, matterHtml(p), !QUIET.test(p.title)));
  spine.push('<itemref idref="nav"/>');
  let firstChapter = '';
  m.chapters.forEach((c, i) => {
    const id = 'ch' + String(i + 1).padStart(3, '0');
    if (!firstChapter) firstChapter = id + '.xhtml';
    const body = '<section epub:type="chapter">' + headingHtml(c.heading) + '\n' +
      c.parts.map((part) => proseHtml(part)).join('\n<p class="break">* * *</p>\n') + '</section>';
    add(id, c.heading, body, true, 'bodymatter');
  });
  matter.filter((p) => p.place === 'back').forEach((p, i) => add('back' + (i + 1), p.title, matterHtml(p), true));
  const navList = toc.map((t) => '<li><a href="' + t.href + '">' + x(t.label) + '</a></li>').join('');
  const landmarks = '<nav epub:type="landmarks" hidden="hidden"><ol><li><a epub:type="toc" href="nav.xhtml">Contents</a></li>' +
    (firstChapter ? '<li><a epub:type="bodymatter" href="' + firstChapter + '">Start</a></li>' : '') + '</ol></nav>';
  files.push({ name: 'OEBPS/nav.xhtml', data: page('Contents', '<nav epub:type="toc" id="toc"><h2>Contents</h2><ol>' + navList + '</ol></nav>' + landmarks) });
  const id = bookId(title, author);
  files.push({ name: 'OEBPS/toc.ncx', data: '<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:' + id + '"/></head><docTitle><text>' + x(title) + '</text></docTitle><navMap>' +
    toc.map((t, i) => '<navPoint id="n' + (i + 1) + '" playOrder="' + (i + 1) + '"><navLabel><text>' + x(t.label) + '</text></navLabel><content src="' + t.href + '"/></navPoint>').join('') + '</navMap></ncx>\n' });
  const series = input.series && input.series.name
    ? '<meta property="belongs-to-collection" id="series">' + x(input.series.name) + '</meta><meta refines="#series" property="collection-type">series</meta>' +
      (input.series.number != null ? '<meta refines="#series" property="group-position">' + input.series.number + '</meta>' : '')
    : '';
  files.push({ name: 'OEBPS/content.opf', data: '<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<dc:identifier id="bookid">urn:uuid:' + id + '</dc:identifier><dc:title>' + x(title) + '</dc:title><dc:language>en</dc:language>' + (author ? '<dc:creator>' + x(author) + '</dc:creator>' : '') +
    series + '<meta property="dcterms:modified">' + modified + '</meta>' + (input.cover ? '<meta name="cover" content="cover"/>' : '') + '</metadata><manifest>' + items.join('') +
    '</manifest><spine toc="ncx">' + spine.join('') + '</spine></package>\n' });
  return zip(files, when);
}

/** The newest full-size cover in the book's Cover/ folder ("Original cover <time>.jpg", covers.ts), or null. */
export function coverFile(paths: { path: string; sha: string }[], bookFolder: string): { path: string; sha: string; type: 'image/jpeg' | 'image/png' } | null {
  const pre = bookFolder + '/Cover/';
  const found = paths.filter((f) => f.path.startsWith(pre) && /^Original cover .*\.(jpe?g|png)$/i.test(f.path.slice(pre.length)))
    .sort((a, b) => a.path < b.path ? 1 : -1)[0];
  return found ? { path: found.path, sha: found.sha, type: /\.png$/i.test(found.path) ? 'image/png' : 'image/jpeg' } : null;
}

/** Where a book's front and back matter live. */
export const matterPath = (book: BookEntry) => book.folder + '/Book Matter.md';

/** A first Book Matter note: the copyright line filled from the book, the other pages as empty headings (an empty page
 * is left out of the book, so nothing unfinished ever reaches a reader). */
export function starterMatter(author: string, when: Date = new Date()): string {
  const y = when.getFullYear();
  const day = y + '-' + String(when.getMonth() + 1).padStart(2, '0') + '-' + String(when.getDate()).padStart(2, '0');
  return '---\ntype: book-matter\ntitle: "Book matter"\nsource: Sparrow app\ncreated: ' + day + '\n---\n' +
    'The pages before chapter 1 and after the last chapter, in reading order. A page with no words under its heading is left out. ' +
    'The title page and contents are made from the book.\n\n' +
    '## Front: Copyright\nCopyright © ' + y + (author ? ' ' + author : '') + '. All rights reserved.\n\n' +
    'This is a work of fiction. Names, characters, places and incidents are the product of the author\'s imagination or are used fictitiously.\n\n' +
    '## Front: Dedication\n\n' +
    '## Back: Next in the series\n\n' +
    '## Back: About the Author\n';
}

/** Everything the Kindle button needs, gathered from the vault: the book, its matter, its cover. `notes` lets the Edit
 * room pass a saved draft's words instead of the scene files. */
export async function kindleFile(source: VaultSource, schema: Schema, index: VaultIndex, book: BookEntry, when: Date = new Date()):
  Promise<{ bytes: Uint8Array; name: string; chapters: number; words: number; missing: string[] }> {
  const m = manuscript(schema, index, book);
  if (!m.scenes) throw new Error('This book has no written scenes yet, so there is nothing to put in a Kindle file.');
  const data = index.notes[book.path] ? index.notes[book.path].data : {};
  const author = typeof data.author === 'string' ? data.author : '';
  const fresh = await loadMatter(source, index, book);
  const matter = fresh ? matterPages(splitNote(fresh.text).body) : [];
  const missing: string[] = [];
  if (!matter.length) missing.push('front and back matter (no copyright page yet)');
  let cover: EpubInput['cover'];
  if (source.readBytes) {
    try {
      const f = coverFile((await source.tree()).files, book.folder);
      if (f) cover = { bytes: new Uint8Array(await (await source.readBytes(f.path, f.sha)).arrayBuffer()), type: f.type };
    } catch { /* offline: made without the cover, and said so */ }
  }
  if (!cover) missing.push('the cover');
  const bytes = buildEpub({ title: book.title, author, manuscript: m, matter, cover, series: { name: book.seriesName, number: book.number } }, when);
  return { bytes, name: exportName(book, when).replace(/\.docx$/, '.epub'), chapters: m.chapters.length, words: m.words, missing };
}

/** The Book Matter note as the vault has it now (fresh when the source can, so a save made a moment ago counts), or null. */
export async function loadMatter(source: VaultSource, index: VaultIndex, book: BookEntry): Promise<{ text: string; sha: string } | null> {
  const p = matterPath(book);
  if (source.readFresh) {
    try { return await source.readFresh(p); } catch { /* not there yet, or offline: fall back to the saved copy */ }
  }
  const n = index.notes[p];
  if (!n) return null;
  try { return { text: await source.read(p, n.sha), sha: n.sha }; } catch { return null; }
}

/** A note's text split at the end of its properties block. */
export function splitNote(text: string): { head: string; body: string } {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
  return m ? { head: m[0].endsWith('\n') ? m[0] : m[0] + '\n', body: text.slice(m[0].length) } : { head: '', body: text };
}

/** Save Kyle's words as the note's body, keeping its properties. Re-reads first; throws a plain sentence if it changed. */
export async function saveMatterBody(source: VaultSource, book: BookEntry, body: string, sha: string): Promise<string> {
  if (!source.write) throw new Error('Saving needs your own vault, not the demo.');
  const p = matterPath(book);
  const now = source.readFresh ? await source.readFresh(p) : null;
  if (now && now.sha !== sha) throw new Error('The front and back matter changed somewhere else since you opened it. Close it and open it again to see the newest words.');
  const head = splitNote(now ? now.text : '').head;
  try {
    return await source.write(p, head + body.replace(/\s+$/, '') + '\n', sha, 'book matter: ' + book.title);
  } catch (e) {
    if ((e as { conflict?: boolean }).conflict) throw new Error('The front and back matter changed somewhere else since you opened it. Close it and open it again to see the newest words.');
    throw e;
  }
}
