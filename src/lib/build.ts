// Crow's story builds (Kyle, 2026-11-05: "slowly build out a story step by step"). A build is a folder under
// Studies/Builds/. Its first step is Premises.md (type build-premises): one ## section per premise, and `picked`, the
// title of the premise Kyle ticked in Crow. The next step reads `picked`.
import { Frontmatter } from './frontmatter.js';
import { BUILDS_FOLDER as BUILD_FOLDER, fieldLines, sections, type Reading } from './study.ts';

export interface Premise { title: string; lines: Reading; }
export interface Build { folder: string; name: string; path: string; title: string; lane: string; about: string; picked: string; premises: Premise[]; }

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v)).trim();

/** Every build with a Premises.md, in folder order. */
export function parseBuilds(texts: Map<string, string>): Build[] {
  const out: Build[] = [];
  for (const [path, text] of texts) {
    if (!path.startsWith(BUILD_FOLDER)) continue;
    const p = Frontmatter.parse(text);
    if (p.error) continue;
    const data = (p.data || {}) as Record<string, unknown>;
    if (str(data.type) !== 'build-premises') continue;
    const name = path.slice(BUILD_FOLDER.length).split('/')[0];
    const sec = sections(p.body, 2);
    out.push({
      folder: BUILD_FOLDER + name, name: str(data.build) || name, path, title: str(data.title) || name, lane: str(data.lane), about: sec.lead, picked: str(data.picked),
      premises: sec.parts.map((s) => ({ title: s.heading, lines: fieldLines(s.text) }))
    });
  }
  return out.sort((a, b) => a.folder.localeCompare(b.folder));
}

/** The note with `picked` set to `title` ('' clears it). Only that line changes; it is added at the end of the
 *  properties when the note has none. */
export function setPicked(text: string, title: string): string {
  const value = "'" + title.replace(/'/g, "''") + "'";
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') throw new Error('The premises note has no properties block.');
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) throw new Error('The premises note has no properties block.');
  const at = lines.findIndex((l, i) => i > 0 && i < end && /^picked:/.test(l));
  if (at >= 0) lines[at] = 'picked: ' + value;
  else lines.splice(end, 0, 'picked: ' + value);
  return lines.join('\n');
}

/** The Premise Bank (Kyle, 2026-11-05: "create some kind of place where you can store these permanently so that we can
 *  always go back to them"): Studies/Builds/Premise Bank.md, type premise-bank, one ## section per premise. */
export const BANK_PATH = BUILD_FOLDER + 'Premise Bank.md';
export function parseBank(texts: Map<string, string>): Premise[] {
  const text = texts.get(BANK_PATH);
  if (!text) return [];
  const p = Frontmatter.parse(text);
  if (p.error || str(((p.data || {}) as Record<string, unknown>).type) !== 'premise-bank') return [];
  return sections(p.body, 2).parts.map((s) => ({ title: s.heading, lines: fieldLines(s.text) }));
}
