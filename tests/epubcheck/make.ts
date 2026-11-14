// Makes the Kindle files that EPUBCheck reads in the GitHub tests (tests/epubcheck/run.sh): the demo book as the app makes
// it, and a book of the hard cases (Quest Declined's kinds of System screens, a long screen, every kind of quote mark,
// series pages, a cover, a Book look with a drop cap, small caps and a line for scene breaks). Written to the folder given, default tests/epubcheck/out.
import fs from 'node:fs';
import path from 'node:path';
import { buildEpub, kindleFile, matterPages, type BookLook } from '../../src/lib/epub.ts';
import { Kindle } from '../../src/lib/kindle.js';
import { buildIndex } from '../../src/lib/vault-index.ts';
import { parseSchema } from '../../src/lib/schema.ts';
import { DEMO, FsSource, ROOT } from '../helpers.ts';

const out = path.resolve(process.argv[2] || path.join(ROOT, 'tests', 'epubcheck', 'out'));
fs.mkdirSync(out, { recursive: true });

const src = new FsSource(DEMO);
const schema = parseSchema(fs.readFileSync(path.join(DEMO, 'System/schema.json'), 'utf8'));
const { files } = await src.tree();
const index = await buildIndex({ schema, files, read: (p) => src.read(p), phase: 6 });
fs.writeFileSync(path.join(out, 'demo.epub'), (await kindleFile(src, schema, index, index.books[0])).bytes);

const screen = (n: number) => ['> **Status**', '> Level 12', '>'].concat(Array.from({ length: n }, (_, i) => '> Skill ' + (i + 1) + ': "Mend" [₳ 40]')).join('\n');
const chapter = [
  '"Hello," she said. "It\'s fine. \'Em and \'til, rock \'n\' roll."',
  '"Listen, Madam Freeweight--"\n\n"--Firelight," she said... "He said \'no\' to me." He was 5\'10" and 6\' tall.',
  screen(3),
  'Then *more* text, **bold**, and the ==note== words.',
  screen(14)
].join('\n\n');
// A one-pixel PNG: enough for the file to hold a cover.
const pngCover = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
fs.writeFileSync(path.join(out, 'hard-cases.epub'), buildEpub({
  title: 'Hard Cases: "Quotes" & Screens', author: 'Test Author', subtitle: 'A Test', publisher: 'Demo Press',
  manuscript: { chapters: [{ heading: 'Chapter 1: The \'First\' One', parts: [chapter, chapter] }, { heading: 'Chapter 2: Two', parts: [chapter] }], words: 400, scenes: 3 },
  matter: matterPages('## Front: Copyright\nCopyright © 2026 Test Author.\n\n## Front: Dedication\nFor "you".\n\n## Back: Also by Test Author\n*Ember Road*\n\n[Ash Bell](https://www.amazon.com/dp/B000000000)\n\n## Back: About the Author\nWrites. [Website](https://example.com).'),
  cover: { bytes: pngCover, type: 'image/png' }, series: { name: 'Ember Road', number: 2 },
  look: Kindle.lookOf({ chapter_number: 'word', heading_style: 'rule', first_paragraph: 'dropcap', after_break: 'smallcaps', scene_break: 'line' }) as BookLook
}));
console.log('Made demo.epub and hard-cases.epub in ' + out);
