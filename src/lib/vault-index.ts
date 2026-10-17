// Builds the app's index of the vault: series, books and each book's scenes, with their parsed frontmatter.
// Paths follow the layout the sf tool reads (Series/<Series>/Books/<N Title>/...), and skip the same folders.
import { Frontmatter } from './frontmatter.js';
import { basename, dirname, idNumber, toNumber } from './links.ts';
import { CONFIG_PATH, indexedTypes } from './schema.ts';
import type { BookEntry, FileEntry, NoteRecord, Schema, SeriesEntry, TypeDef, VaultIndex } from './types.ts';

// The same folders sf skips (SKIP_ANYWHERE and SKIP_PATHS in sf.js), plus hidden folders.
const SKIP_ANYWHERE = new Set(['Exports', 'Snapshots', 'Archive', 'node_modules']);
const SKIP_PATHS = ['Templates/', 'System/Tools/'];

export function skipped(path: string): boolean {
  if (SKIP_PATHS.some((p) => path.startsWith(p))) return true;
  const parts = path.split('/');
  parts.pop();
  return parts.some((p) => p.charAt(0) === '.' || SKIP_ANYWHERE.has(p));
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A pattern for the files where notes of this type live, from the type's scope, folder and file name,
 * and from the scope and folder of each variant (a character's book delta lives in the book's Characters folder). */
export function pathPattern(def: TypeDef): RegExp {
  const forms: { scope: string | string[]; folder?: string }[] = [def];
  Object.values(def.variants || {}).forEach((v) => { if (v && v.scope) forms.push({ scope: v.scope, folder: v.folder ?? def.folder }); });
  return new RegExp(forms.map((f) => formPattern(f, def.filename)).join('|'));
}

function formPattern(def: { scope: string | string[]; folder?: string }, filename?: string): string {
  const scopes = Array.isArray(def.scope) ? def.scope : [def.scope];
  const prefixes = scopes.map((s) => (s === 'book' ? 'Series/[^/]+/Books/[^/]+/' : s === 'series' ? 'Series/[^/]+/' : ''));
  const folder = (def.folder || '').replace(/^\/+|\/+$/g, '');
  const fixedName = filename && filename.indexOf('{') < 0 ? esc(filename) : null;
  // A folder holds any number of notes (in subfolders too); no folder means one note with a fixed name.
  const inner = folder ? esc(folder) + '/(?:[^/]+/)*[^/]+' : fixedName || '[^/]+';
  return '^(?:' + prefixes.join('|') + ')' + inner + '\\.md$';
}

export interface BuildOptions {
  schema: Schema;
  files: FileEntry[];
  read: (path: string, sha: string) => Promise<string>;
  /** The last index for this source; notes whose sha has not changed are reused, not fetched again. */
  previous?: VaultIndex | null;
  /** Board phase whose types to index. */
  phase?: number;
  /** How many files to fetch at once. */
  concurrency?: number;
}

/** The files the index needs, given the whole tree. */
export function selectFiles(schema: Schema, files: FileEntry[], phase = 1): FileEntry[] {
  const patterns = indexedTypes(schema, phase).map((t) => pathPattern(schema.types[t]));
  return files.filter((f) => f.path === CONFIG_PATH || (!skipped(f.path) && patterns.some((re) => re.test(f.path))));
}

export function makeNote(path: string, sha: string, text: string): NoteRecord {
  const p = Frontmatter.parse(text);
  const data = (p.data || {}) as Record<string, unknown>;
  const type = data.type == null ? '' : String(data.type).trim();
  return { path, sha, type, data, body: p.body, error: p.error };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function buildIndex(opts: BuildOptions): Promise<VaultIndex> {
  const { schema, read } = opts;
  const prev = (opts.previous && opts.previous.notes) || {};
  const wanted = selectFiles(schema, opts.files, opts.phase ?? 1);
  const records = await mapLimit(wanted, opts.concurrency ?? 6, async (f) => {
    const old = prev[f.path];
    if (old && old.sha === f.sha) return old;
    return makeNote(f.path, f.sha, await read(f.path, f.sha));
  });
  return assemble(schema, records, opts.phase ?? 1);
}

/** Sort scenes the way sf does: by order, then chapter, then ID number. */
export function compareScenes(a: NoteRecord, b: NoteRecord): number {
  const num = (v: unknown) => toNumber(v) ?? Infinity;
  const ao = num(a.data.order), bo = num(b.data.order);
  if (ao !== bo) return ao - bo;
  const ac = num(a.data.chapter), bc = num(b.data.chapter);
  if (ac !== bc) return ac - bc;
  return (idNumber(a.data.id) || 0) - (idNumber(b.data.id) || 0);
}

export function assemble(schema: Schema, records: NoteRecord[], phase = 1): VaultIndex {
  const notes: Record<string, NoteRecord> = {};
  const warnings: string[] = [];
  records.forEach((n) => { notes[n.path] = n; });

  const config = notes[CONFIG_PATH] ? notes[CONFIG_PATH].data : {};
  const types = indexedTypes(schema, phase);
  const patterns: Record<string, RegExp> = {};
  types.forEach((t) => { patterns[t] = pathPattern(schema.types[t]); });

  const series: SeriesEntry[] = [];
  const books: BookEntry[] = [];
  const byBook: Record<string, NoteRecord[]> = {};
  const seriesChars: NoteRecord[] = [];

  records.forEach((n) => {
    if (n.path === CONFIG_PATH) return;
    if (n.error) warnings.push(n.path + ' has frontmatter the app cannot read: ' + n.error);
    // The folder decides what a file should be; its type property must agree.
    const expected = types.filter((t) => patterns[t].test(n.path));
    if (n.type && expected.indexOf(n.type) < 0) {
      if (!n.error) warnings.push(n.path + ' says it is ' + (/^[aeiou]/i.test(n.type) ? 'an ' : 'a ') + n.type + ' note, but it sits where ' + expected.join(' or ') + ' notes go.');
      return;
    }
    if (!n.type) {
      if (!n.error) warnings.push(n.path + ' has no type property.');
      return;
    }
    if (n.type === 'series') {
      series.push({ path: n.path, folder: dirname(n.path), name: String(n.data.name || basename(dirname(n.path))), characters: [] });
    } else if (n.type === 'book') {
      const folder = dirname(n.path);
      const seriesFolder = folder.replace(/\/Books\/[^/]+$/, '');
      books.push({
        path: n.path, folder, seriesFolder, seriesName: basename(seriesFolder),
        title: String(n.data.title || basename(folder)),
        number: toNumber(n.data.number),
        stage: String(n.data.stage || 'spark'),
        scenes: [],
        ideas: [], beats: [], conflicts: [], characters: []
      });
    } else {
      const m = n.path.match(/^(Series\/[^/]+\/Books\/[^/]+)\//);
      if (m) (byBook[m[1]] = byBook[m[1]] || []).push(n);
      else if (n.type === 'character') seriesChars.push(n);
    }
  });

  seriesChars.forEach((n) => {
    const s = series.find((x) => n.path.startsWith(x.folder + '/'));
    if (s) s.characters!.push(n.path);
  });
  series.forEach((s) => s.characters!.sort());

  books.forEach((b) => {
    const list = (byBook[b.folder] || []).filter((n) => n.type === 'scene').sort(compareScenes);
    b.scenes = list.map((n) => n.path);
    const of = (type: string) => (byBook[b.folder] || []).filter((n) => n.type === type).map((n) => n.path).sort();
    b.ideas = of('idea');
    b.beats = of('beat');
    b.conflicts = of('conflict');
    b.characters = of('character');
    delete byBook[b.folder];
  });
  Object.keys(byBook).forEach((folder) => warnings.push(folder + ' has notes but no Book.md, so the app cannot show them.'));

  series.sort((a, b) => a.name.localeCompare(b.name));
  books.sort((a, b) => a.seriesName.localeCompare(b.seriesName) || (a.number ?? Infinity) - (b.number ?? Infinity) || a.title.localeCompare(b.title));
  return { config, series, books, notes, warnings };
}

/** The book System/Config.md names as active, if the vault has it. */
export function activeBook(index: VaultIndex): BookEntry | null {
  const want = String(index.config.active_book || '').trim().replace(/\/+$/, '');
  return index.books.find((b) => b.folder === want) || null;
}
