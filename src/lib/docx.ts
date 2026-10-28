// Export to Word: the book's scenes in reading order as one .docx, made on the device (no server, nothing saved in the
// vault). The layout follows the vault tool's `sf compile --docx` (Docx.build in sf.js): title, then each chapter as a
// Heading 1 on a new page, scenes split by "* * *", first-line-indented paragraphs. Italics and bold are read with the
// writing screen's own rules (styled.ts), so what is slanted on the page is slanted in Word.
import { chapterGroups, chapterHeading } from './board.ts';
import { Prose, wordCount } from './prose.js';
import { marks, runs } from './styled.ts';
import type { BookEntry, NoteRecord, Schema, VaultIndex, VaultSource } from './types.ts';

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The file name Kyle chose (2026-10-18): series_book_date, for example "Quest Declined_Book Two_2026-10-18.docx". */
export function exportName(book: BookEntry, when: Date = new Date()): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = when.getFullYear() + '-' + pad(when.getMonth() + 1) + '-' + pad(when.getDate());
  return [safe(book.seriesName), safe(book.title), date].filter(Boolean).join('_') + '.docx';
}

interface Piece { text: string; b: boolean; i: boolean }

/** One paragraph's words with their bold and italics; highlighter marks drop away (they are notes to self). */
export function pieces(line: string, b = false, i = false): Piece[] {
  const out: Piece[] = [];
  const hs = marks(line);
  if (hs.length) {
    let at = 0;
    hs.forEach((h) => { out.push(...pieces(line.slice(at, h.from), b, i), ...pieces(line.slice(h.from + 2, h.to - 2), b, i)); at = h.to; });
    out.push(...pieces(line.slice(at), b, i));
    return out;
  }
  let at = 0;
  runs(line).forEach((r) => {
    if (r.from > at) out.push({ text: line.slice(at, r.from), b, i });
    out.push(...pieces(line.slice(r.from + r.open, r.to - r.close), b || r.cls !== 'i', i || r.cls !== 'b'));
    at = r.to;
  });
  if (at < line.length) out.push({ text: line.slice(at), b, i });
  return out.filter((p) => p.text);
}

/** `caps`: bold small caps, for a System screen's title. */
function para(text: string, style: string, ppr = '', caps = false): string {
  const words = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
  return '<w:p><w:pPr><w:pStyle w:val="' + style + '"/>' + ppr + '</w:pPr>' + pieces(words).map((p) =>
    '<w:r>' + (p.b || p.i || caps ? '<w:rPr>' + (p.b || caps ? '<w:b/>' : '') + (p.i ? '<w:i/>' : '') + (caps ? '<w:smallCaps/>' : '') + '</w:rPr>' : '') +
    '<w:t xml:space="preserve">' + xmlEsc(p.text) + '</w:t></w:r>').join('') + '</w:p>';
}

/** A System screen (Kyle, 2026-10-28: format C1) is a block of "> " lines: indented, one paragraph per line, a lone ">"
 * a blank line between its parts, an all-bold line its title in bold small caps, two blank lines before the story goes on. */
export const isScreen = (p: string) => p.split('\n').every((l) => /^\s*>/.test(l));
export function screen(p: string): string[] {
  const lines = p.split('\n').map((l) => l.replace(/^\s*> ?/, ''));
  const out: string[] = [];
  let gap = true;
  lines.forEach((l, i) => {
    if (!l.trim()) { gap = true; return; }
    const last = !lines.slice(i + 1).some((x) => x.trim());
    const title = /^\*\*[^*].*\*\*$/.test(l.trim());
    const sp = '<w:spacing w:before="' + (gap ? 240 : 0) + '" w:after="' + (last ? 480 : 0) + '"/>';
    out.push(para(title ? l.trim().slice(2, -2) : l, 'SystemScreen', sp, title));
    gap = false;
  });
  return out;
}

export interface Manuscript { chapters: { heading: string; parts: string[] }[]; words: number; scenes: number }

/** The book in reading order: every scene with prose (test drives left out), its notes and headings taken away. */
export function manuscript(schema: Schema, index: VaultIndex, book: BookEntry): Manuscript {
  const notes = book.scenes.map((p) => index.notes[p]).filter(Boolean) as NoteRecord[];
  let words = 0, scenes = 0;
  const chapters = chapterGroups(schema, notes).map((g) => {
    const parts: string[] = [];
    g.scenes.forEach((s) => {
      if (s.data.kind === 'test') return;
      const prose = Prose.cleanProse(s.body) as string;
      if (!prose) return;
      parts.push(prose);
      scenes++;
      words += wordCount(Prose.proseText(prose));
    });
    return { heading: g.num == null ? 'Unnumbered' : chapterHeading(g), parts };
  }).filter((c) => c.parts.length);
  return { chapters, words, scenes };
}

const enc = new TextEncoder();
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** A store-only zip, like sf's Zip.store: enough for a .docx. */
export function zip(files: { name: string; data: string }[], when: Date = new Date()): Uint8Array {
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2);
  const date = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  files.forEach((f) => {
    const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 10, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 10, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  });
  const cdLen = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdLen, true); end.setUint32(16, offset, true);
  const all = parts.concat(central, [new Uint8Array(end.buffer)]);
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  all.forEach((p) => { out.set(p, at); at += p.length; });
  return out;
}

/** The .docx itself. */
export function buildDocx(title: string, author: string, m: Manuscript, when: Date = new Date()): Uint8Array {
  const body = [para(title, 'Title')];
  if (author) body.push(para(author, 'Subtitle'));
  m.chapters.forEach((c) => {
    body.push(para(c.heading, 'Heading1'));
    c.parts.forEach((part, pi) => {
      if (pi > 0) body.push(para('* * *', 'SceneBreak'));
      part.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
        .forEach((p, i) => { if (isScreen(p)) body.push(...screen(p)); else body.push(para(p.replace(/\n/g, ' '), i === 0 ? 'FirstParagraph' : 'BodyText')); });
    });
  });
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const document = head + '<w:document ' + W + '><w:body>' + body.join('') +
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const style = (id: string, name: string, ppr: string, rpr: string) => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
    (ppr ? '<w:pPr>' + ppr + '</w:pPr>' : '') + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '</w:style>';
  const styles = head + '<w:styles ' + W + '>' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    style('Title', 'Title', '<w:jc w:val="center"/><w:spacing w:before="2880" w:after="240"/>', '<w:sz w:val="48"/>') +
    style('Subtitle', 'Subtitle', '<w:jc w:val="center"/>', '') +
    style('Heading1', 'heading 1', '<w:pageBreakBefore/><w:keepNext/><w:jc w:val="center"/><w:spacing w:before="1440" w:after="480"/><w:outlineLvl w:val="0"/>', '<w:sz w:val="32"/>') +
    style('FirstParagraph', 'First Paragraph', '', '') +
    style('BodyText', 'Body Text', '<w:ind w:firstLine="360"/>', '') +
    style('SystemScreen', 'System Screen', '<w:ind w:left="720"/>', '') +
    style('SceneBreak', 'Scene Break', '<w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/>', '') +
    '</w:styles>';
  const rels = (r: string) => head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + r + '</Relationships>';
  return zip([
    { name: '[Content_Types].xml', data: head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
    { name: '_rels/.rels', data: rels('<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>') },
    { name: 'word/_rels/document.xml.rels', data: rels('<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>') },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: styles }
  ], when);
}

/** Where a book's Word backups live in the vault (Kyle, 2026-10-18): Book Backups/<series>/<book>/. */
export function backupFolder(seriesName: string, bookTitle: string): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
  return 'Book Backups/' + safe(seriesName) + '/' + safe(bookTitle);
}

function base64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Save the Word file in the book's backup folder. A second export on the same day replaces that day's file (the
 * vault's history keeps the earlier one). Returns where it went. */
export async function saveBackup(source: VaultSource, book: BookEntry, bytes: Uint8Array, name: string): Promise<string> {
  if (!source.writeBytes) throw new Error('Backups need your own vault, not the demo.');
  const path = backupFolder(book.seriesName, book.title) + '/' + name;
  const message = 'backups: ' + name;
  try {
    await source.writeBytes(path, base64(bytes), '', message);
  } catch (e) {
    if (!(e as { conflict?: boolean }).conflict) throw e;
    const { files } = await source.tree();
    const old = files.find((f) => f.path === path);
    await source.writeBytes(path, base64(bytes), old ? old.sha : '', message);
  }
  return path;
}

/** An empty backup folder for a new series or book, so the vault shows where its backups will go. */
export async function makeBackupFolder(source: VaultSource, seriesName: string, bookTitle?: string): Promise<void> {
  const folder = bookTitle ? backupFolder(seriesName, bookTitle) : backupFolder(seriesName, '').replace(/\/$/, '');
  if (!source.write) return;
  try {
    await source.write(folder + '/.gitkeep', 'Word backups from Export to Word on Book details.\n', '', 'backups: folder for ' + (bookTitle || seriesName));
  } catch { /* already there, or offline: the first export makes it */ }
}
