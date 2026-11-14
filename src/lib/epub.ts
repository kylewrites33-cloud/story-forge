// The Kindle file (Kyle, 2026-11-04: "Start on step 1" of the vault's Docs/Sparrow/17 Replacing Vellum.md): the book as
// an EPUB 3 made on the device, ready to upload to KDP, so Vellum is no longer needed for the ebook. Same reading order
// and italics as Export to Word (docx.ts). System screens (format C1) are boxed, left-aligned blocks with a bold
// small-caps title, the look Kyle set in Vellum with Inset. Front and back matter come from the book's `Book Matter.md`
// note; the cover is the newest full-size picture in the book's Cover/ folder. The vault tool's `sf compile --epub`
// makes the same file (Epub.build in sf.js); keep the two in step. Since 2026-11-14 (Docs/Sparrow/21 Kindle Plan.md,
// Build 1) the parts both need are one copy of sf's Kindle section (kindle.js): curly quotes made as the file is made,
// the stylesheet, the title page, the series' own pages, the cover size and the ready check.
import { exportName, isScreen, manuscript, pieces, zip } from './docx.ts';
import { Frontmatter } from './frontmatter.js';
import { Kindle } from './kindle.js';
import type { KindlePage, KindleSection } from './kindle.js';
import type { Manuscript } from './docx.ts';
import type { BookEntry, Schema, VaultIndex, VaultSource } from './types.ts';

const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One page of front or back matter: a `## Front: <name>` or `## Back: <name>` section of Book Matter.md. */
export interface MatterPage { place: 'front' | 'back'; title: string; body: string }

/** The pages of a Book Matter note, in the order written. Text before the first heading is a note to the team and is left out. */
export function matterPages(body: string): MatterPage[] {
  return Kindle.matterSections(body).filter((p) => p.body);
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
  return '<div class="screen' + (out.length > Kindle.LONG_SCREEN ? ' long' : '') + '">' + out.join('') + '</div>';
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

/** The stylesheet, checked against Amazon's Kindle Publishing Guidelines 2026.3 (kindle.js has the reasons). */
export const CSS: string = Kindle.CSS;

export interface EpubInput {
  title: string;
  author: string;
  manuscript: Manuscript;
  matter?: MatterPage[];
  cover?: { bytes: Uint8Array; type: 'image/jpeg' | 'image/png' };
  series?: { name: string; number: number | null };
  subtitle?: string;
  publisher?: string;
}

/** The files of the .epub in order, and its pages as a reader meets them (for the ready check and Look inside). Quotes,
 * dashes and ellipses are made curly and long here, as the pages are made; the vault keeps its own marks. */
export function epubFiles(input: EpubInput, when: Date = new Date()): { files: { name: string; data: string | Uint8Array }[]; pages: KindlePage[] } {
  const { title, author, manuscript: m } = input;
  const matter = input.matter || [];
  const modified = when.toISOString().replace(/\.\d+Z$/, 'Z');
  const t = (s: string) => Kindle.smart(x(s));
  const page = (label: string, body: string, type = '') => '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en"><head><meta charset="utf-8"/><title>' + t(label) +
    '</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body' + (type ? ' epub:type="' + type + '"' : '') + '>' + body + '</body></html>\n';
  const files: { name: string; data: string | Uint8Array }[] = [
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n' },
    { name: 'OEBPS/style.css', data: CSS }
  ];
  const items: string[] = ['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>', '<item id="css" href="style.css" media-type="text/css"/>'];
  const spine: string[] = [];
  const toc: { href: string; label: string }[] = [];
  const pages: KindlePage[] = [];
  const add = (id: string, label: string, html: string, inToc: boolean, type: string, kind: KindlePage['kind']) => {
    const body = Kindle.smart(html);
    files.push({ name: 'OEBPS/' + id + '.xhtml', data: page(label, body, type) });
    items.push('<item id="' + id + '" href="' + id + '.xhtml" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="' + id + '"/>');
    if (inToc) toc.push({ href: id + '.xhtml', label });
    pages.push({ id, label, html: body, kind });
  };
  // Kindle wants the cover as an image marked cover-image and no cover page of its own (KDP help G6GTK3T3NUHKLEFX).
  if (input.cover) {
    const ext = input.cover.type === 'image/png' ? 'png' : 'jpg';
    files.push({ name: 'OEBPS/cover.' + ext, data: input.cover.bytes });
    items.push('<item id="cover" href="cover.' + ext + '" media-type="' + input.cover.type + '" properties="cover-image"/>');
  }
  const s = input.series;
  add('title', title, Kindle.titlePage({ title, subtitle: input.subtitle, series: s && s.name, number: s ? s.number : null, author, publisher: input.publisher }), false, '', 'title');
  matter.filter((p) => p.place === 'front').forEach((p, i) => add('front' + (i + 1), p.title, matterHtml(p), !QUIET.test(p.title), '', 'matter'));
  spine.push('<itemref idref="nav"/>');
  let firstChapter = '';
  m.chapters.forEach((c, i) => {
    const id = 'ch' + String(i + 1).padStart(3, '0');
    if (!firstChapter) firstChapter = id + '.xhtml';
    const body = '<section epub:type="chapter">' + headingHtml(c.heading) + '\n' +
      c.parts.map((part) => proseHtml(part)).join('\n<p class="break">* * *</p>\n') + '</section>';
    add(id, c.heading, body, true, 'bodymatter', 'chapter');
  });
  matter.filter((p) => p.place === 'back').forEach((p, i) => add('back' + (i + 1), p.title, matterHtml(p), true, '', 'matter'));
  const navList = toc.map((e) => '<li><a href="' + e.href + '">' + t(e.label) + '</a></li>').join('');
  const landmarks = '<nav epub:type="landmarks" hidden="hidden"><ol><li><a epub:type="toc" href="nav.xhtml">Contents</a></li>' +
    (firstChapter ? '<li><a epub:type="bodymatter" href="' + firstChapter + '">Start</a></li>' : '') + '</ol></nav>';
  files.push({ name: 'OEBPS/nav.xhtml', data: page('Contents', '<nav epub:type="toc" id="toc"><h2>Contents</h2><ol>' + navList + '</ol></nav>' + landmarks) });
  const id = bookId(title, author);
  files.push({ name: 'OEBPS/toc.ncx', data: '<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:' + id + '"/></head><docTitle><text>' + t(title) + '</text></docTitle><navMap>' +
    toc.map((e, i) => '<navPoint id="n' + (i + 1) + '" playOrder="' + (i + 1) + '"><navLabel><text>' + t(e.label) + '</text></navLabel><content src="' + e.href + '"/></navPoint>').join('') + '</navMap></ncx>\n' });
  const series = s && s.name
    ? '<meta property="belongs-to-collection" id="series">' + t(s.name) + '</meta><meta refines="#series" property="collection-type">series</meta>' +
      (s.number != null ? '<meta refines="#series" property="group-position">' + s.number + '</meta>' : '')
    : '';
  files.push({ name: 'OEBPS/content.opf', data: '<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<dc:identifier id="bookid">urn:uuid:' + id + '</dc:identifier><dc:title>' + t(title) + '</dc:title><dc:language>en</dc:language>' + (author ? '<dc:creator>' + t(author) + '</dc:creator>' : '') +
    (input.publisher ? '<dc:publisher>' + t(input.publisher) + '</dc:publisher>' : '') +
    series + '<meta property="dcterms:modified">' + modified + '</meta>' + (input.cover ? '<meta name="cover" content="cover"/>' : '') + '</metadata><manifest>' + items.join('') +
    '</manifest><spine toc="ncx">' + spine.join('') + '</spine></package>\n' });
  return { files, pages };
}

/** The .epub itself. */
export function buildEpub(input: EpubInput, when: Date = new Date()): Uint8Array {
  return zip(epubFiles(input, when).files, when);
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

/** What a Kindle file is, made: the download, its pages for Look inside, and the ready check. */
export interface KindleMade {
  bytes: Uint8Array;
  name: string;
  chapters: number;
  words: number;
  /** Plain words for what is not in it yet (the cover, the copyright page). */
  missing: string[];
  /** The ready check: anything that would embarrass the book, and what is right. */
  check: { problems: string[]; good: string[] };
  files: { name: string; data: string | Uint8Array }[];
  pages: KindlePage[];
}

/** The series folder a book sits in ("Series/Quest Declined"). */
export const seriesFolder = (book: BookEntry) => book.folder.replace(/\/Books\/[^/]+$/, '');
/** Where the series' own pages live: About the author, Also by, written once for every book (Kyle, 2026-11-14). */
export const seriesMatterPath = (book: BookEntry) => seriesFolder(book) + '/Book Matter.md';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** A first series Book Matter note: the pages written once for every book in the series, as empty headings. */
export function starterSeriesMatter(author: string, when: Date = new Date()): string {
  const day = when.getFullYear() + '-' + String(when.getMonth() + 1).padStart(2, '0') + '-' + String(when.getDate()).padStart(2, '0');
  return '---\ntype: book-matter\ntitle: "Book matter"\nsource: Sparrow app\ncreated: ' + day + '\n---\n' +
    'Pages written once for every book in the series. A book\'s own page of the same name wins; Also by lists the series\' other books that have a store link, then these words.\n\n' +
    '## Back: About the Author\n\n' +
    '## Back: Also by ' + (author || 'the Author') + '\n';
}

/** Everything the Kindle button needs, gathered from the vault: the book, its matter and the series', its cover. */
export async function kindleFile(source: VaultSource, schema: Schema, index: VaultIndex, book: BookEntry, when: Date = new Date()): Promise<KindleMade> {
  const m = manuscript(schema, index, book);
  if (!m.scenes) throw new Error('This book has no written scenes yet, so there is nothing to put in a Kindle file.');
  const data = index.notes[book.path] ? index.notes[book.path].data : {};
  const author = str(data.author);
  const fresh = await loadMatter(source, index, book);
  const seriesNote = await loadNote(source, index, seriesMatterPath(book));
  const bookBody = fresh ? splitNote(fresh.text).body : '', seriesBody = seriesNote ? splitNote(seriesNote.text).body : '';
  const sf = seriesFolder(book);
  const books = index.books.filter((b) => b.folder.indexOf(sf + '/Books/') === 0)
    .map((b) => ({ title: b.title, number: b.number, url: str(index.notes[b.path] ? index.notes[b.path].data.amazon_url : '') }));
  const matter = Kindle.bookMatter(bookBody, seriesBody, book.seriesName, books, { title: book.title, url: str(data.amazon_url) }) as MatterPage[];
  const sections: KindleSection[] = Kindle.mergeMatter(Kindle.matterSections(bookBody), Kindle.matterSections(seriesBody));
  const missing: string[] = [];
  if (!matter.some((p) => /^copyright$/i.test(p.title))) missing.push('the copyright page');
  let cover: EpubInput['cover'];
  if (source.readBytes) {
    try {
      const f = coverFile((await source.tree()).files, book.folder);
      if (f) cover = { bytes: new Uint8Array(await (await source.readBytes(f.path, f.sha)).arrayBuffer()), type: f.type };
    } catch { /* offline: made without the cover, and said so */ }
  }
  if (!cover) missing.push('the cover');
  const made = epubFiles({ title: book.title, author, manuscript: m, matter, cover, series: { name: book.seriesName, number: book.number },
    subtitle: Kindle.subtitleOf(book.title, data), publisher: str(data.publisher) }, when);
  const check = Kindle.check({ pages: made.pages, matter: sections, cover: cover ? cover.bytes : null, author });
  return { bytes: zip(made.files, when), name: exportName(book, when).replace(/\.docx$/, '.epub'), chapters: m.chapters.length, words: m.words, missing, check, files: made.files, pages: made.pages };
}

/** A note as the vault has it now (fresh when the source can), or as the app shows it, or null. */
async function loadNote(source: VaultSource, index: VaultIndex, p: string): Promise<{ text: string; sha: string } | null> {
  if (source.readFresh) {
    try { return await source.readFresh(p); } catch { /* not there yet, or offline */ }
  }
  const n = index.notes[p];
  return n ? { text: Frontmatter.join(n.data, n.body), sha: n.sha } : null;
}

/** The Book Matter note as the vault has it now (fresh when the source can, so a save made a moment ago counts), or null. */
export async function loadMatter(source: VaultSource, index: VaultIndex, book: BookEntry): Promise<{ text: string; sha: string } | null> {
  const p = matterPath(book);
  if (source.readFresh) {
    try { return await source.readFresh(p); } catch { /* not there yet, or offline: fall back to the saved copy */ }
  }
  // The note as the app shows it, which has words that are still waiting to save.
  const n = index.notes[p];
  return n ? { text: Frontmatter.join(n.data, n.body), sha: n.sha } : null;
}

/** A note's text split at the end of its properties block. */
export function splitNote(text: string): { head: string; body: string } {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
  return m ? { head: m[0].endsWith('\n') ? m[0] : m[0] + '\n', body: text.slice(m[0].length) } : { head: '', body: text };
}
