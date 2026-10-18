import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildDocx, exportName, manuscript, pieces } from '../src/lib/docx.ts';
import { buildIndex } from '../src/lib/vault-index.ts';
import { parseSchema } from '../src/lib/schema.ts';
import { DEMO, FsSource } from './helpers.ts';

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
