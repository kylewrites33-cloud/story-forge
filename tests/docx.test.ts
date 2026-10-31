import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { backupFolder, buildDocx, exportName, makeBackupFolder, manuscript, pieces, saveBackup, screen, isScreen } from '../src/lib/docx.ts';
import { buildIndex } from '../src/lib/vault-index.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { DEMO, FsSource, MemSource } from './helpers.ts';

async function demo() {
  const src = new FsSource(DEMO);
  const schema = parseSchema(fs.readFileSync(path.join(DEMO, 'System/schema.json'), 'utf8'));
  const { files } = await src.tree();
  return { schema, index: await buildIndex({ schema, files, read: (p) => src.read(p), phase: 6 }) };
}

/** The entries of a store-only zip. */
function unzip(buf: Uint8Array): Map<string, string> {
  const out = new Map<string, string>();
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let p = 0; v.getUint32(p, true) === 0x04034b50;) {
    const size = v.getUint32(p + 18, true), nameLen = v.getUint16(p + 26, true);
    const name = new TextDecoder().decode(buf.subarray(p + 30, p + 30 + nameLen));
    out.set(name, new TextDecoder().decode(buf.subarray(p + 30 + nameLen, p + 30 + nameLen + size)));
    p += 30 + nameLen + size;
  }
  return out;
}

test('the export is named series_book_date', async () => {
  const { index } = await demo();
  assert.equal(exportName(index.books[0], new Date(2026, 9, 18, 15, 4)), index.books[0].seriesName + '_' + index.books[0].title + '_2026-10-18.docx');
});

test('italics and bold come through the way the writing screen reads them, nested and inside words too', () => {
  assert.deepEqual(pieces('a *b **c** d* e'), [
    { text: 'a ', b: false, i: false }, { text: 'b ', b: false, i: true }, { text: 'c', b: true, i: true },
    { text: ' d', b: false, i: true }, { text: ' e', b: false, i: false }]);
  assert.deepEqual(pieces('un*believ*able ==note=='), [
    { text: 'un', b: false, i: false }, { text: 'believ', b: false, i: true }, { text: 'able ', b: false, i: false }, { text: 'note', b: false, i: false }]);
});

test('the Word file holds every written scene in reading order, chapters as headings', async () => {
  const { schema, index } = await demo();
  const book = index.books[0];
  const m = manuscript(schema, index, book);
  assert.ok(m.scenes > 0 && m.words > 0);
  const files = unzip(buildDocx(book.title, '', m));
  assert.deepEqual([...files.keys()].sort(), ['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/styles.xml']);
  const doc = files.get('word/document.xml')!;
  assert.equal((doc.match(/w:val="Heading1"/g) || []).length, m.chapters.length);
  const at = m.chapters.map((c) => doc.indexOf('>' + c.heading.replace(/&/g, '&amp;') + '<'));
  assert.ok(at.every((n, i) => n > 0 && (i === 0 || n > at[i - 1])));
});

test('each export is backed up in Book Backups/series/book; the same day replaces that day\'s file', async () => {
  const { index } = await demo();
  const book = index.books[0];
  const src = new MemSource();
  (src as unknown as { writeBytes: typeof src.write }).writeBytes = (p, b64, sha, msg) => src.write(p, b64, sha, msg);
  const name = exportName(book, new Date(2026, 9, 18));
  const where = await saveBackup(src, book, new Uint8Array([1, 2, 3]), name);
  assert.equal(where, 'Book Backups/' + book.seriesName + '/' + book.title + '/' + name);
  await saveBackup(src, book, new Uint8Array([4, 5]), name);
  assert.equal(src.writes.filter((w) => w.path === where).length, 2);
  assert.equal(src.files.get(where), Buffer.from([4, 5]).toString('base64'));
  assert.equal(backupFolder('A/B: C', 'Book?'), 'Book Backups/AB C/Book');
});

test('a new series and a new book get their backup folders', async () => {
  const src = new MemSource();
  await makeBackupFolder(src, 'Ember Road');
  await makeBackupFolder(src, 'Ember Road', 'Ash Bell');
  await makeBackupFolder(src, 'Ember Road', 'Ash Bell');
  assert.deepEqual([...src.files.keys()], ['Book Backups/Ember Road/.gitkeep', 'Book Backups/Ember Road/Ash Bell/.gitkeep']);
});

test('a System screen (lines starting "> ") is one block paragraph with line breaks, its bold title in small caps', () => {
  const p = '> **Argo Brand Natural Spring Water**\n>\n> Freshness: 4/5 (Fresh)\n> *Collected from the springs.*';
  assert.ok(isScreen(p));
  assert.ok(!isScreen('He said.\n> not all'));
  const out = screen(p);
  assert.equal(out.length, 1);
  assert.match(out[0], /VellumFlushLeft.*<w:b\/><w:smallCaps\/>.*Argo Brand Natural Spring Water</);
  assert.match(out[0], /Water<\/w:t><\/w:r><w:r><w:br\/><\/w:r><w:r><w:br\/><\/w:r><w:r><w:t[^>]*>Freshness/);
  assert.match(out[0], /<w:i\/>.*Collected/);
  assert.doesNotMatch(out[0], /&gt;/);
});
