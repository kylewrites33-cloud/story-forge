// The Character study app's notes: studies of finished stories in the vault's Studies/ folder, read for character and
// for plot, scene by scene. Parsing only (no DOM), so Node tests it. The note shapes are in the vault's schema
// (study, study-character, study-scene, study-lens) and the character-study skill.
import { Frontmatter } from './frontmatter.js';
import type { FileEntry } from './types.ts';

export const ROOT = 'Studies/';
export const LENS_FOLDER = 'Studies/Lenses/';

export type Side = 'character' | 'plot';

export interface Lens {
  name: string;
  side: Side;
  framework: string;
  source: string;
  fields: string[];
  question: string;
  order: number;
  about: string;
}

/** One reading through one lens: its "- Field: value" lines in order. */
export type Reading = [string, string][];

export interface StudyCharacter {
  name: string;
  path: string;
  role: string;
  facts: string[];
  bestLens: string;
  order: number;
  /** The reading across every scene so far, by lens name. */
  readings: Record<string, Reading>;
  notes: string;
  /** The picture Kyle added, Studies/<Study>/Faces/<name>.jpg (or .png), if there is one. */
  face: FileEntry | null;
}

export type Holds = 'yes' | 'partly' | 'no' | 'first' | '';

/** A character's or a force's part in one scene's plot (Kyle, 2026-10-26: "a color explaining their role"). */
export type Role = 'driver' | 'opposes' | 'supports' | 'receives' | '';
export const ROLES: Exclude<Role, ''>[] = ['driver', 'opposes', 'supports', 'receives'];

/** One beat of a scene: who (a character or a force, as The world) causes it, its kind, and whether it turns the scene. */
export interface Beat { who: string; kind: string; turning: boolean; text: string; }

/** Someone in a scene's plot: a carded character (from its ## block) or a force or minor character from "- Others". */
export interface Player { name: string; role: Role; carded: boolean; }

export interface CharacterInScene {
  name: string;
  bestLens: string;
  why: string;
  holds: Holds;
  role: Role;
  moments: string[];
  readings: Record<string, Reading>;
}

export interface PlotInScene {
  driver: string;
  link: string;
  whyNext: string;
  bestLens: string;
  why: string;
  /** Forces and minor characters without a card, with their role: "- Others: The world (opposes)". */
  others: Player[];
  beats: Beat[];
  /** The scene in our words (### Retelling); the story's own text is never saved. */
  retelling: string;
  readings: Record<string, Reading>;
}

export interface StudyScene {
  id: string;
  title: string;
  path: string;
  order: number;
  where: string;
  characters: string[];
  summary: string;
  /** Where Kyle reads the scene in full, on the translator's or publisher's page. */
  sourceUrl: string;
  plot: PlotInScene;
  cast: CharacterInScene[];
}

export interface Study {
  title: string;
  folder: string;
  author: string;
  medium: string;
  status: string;
  about: string;
  /** The body's ## sections by heading (Plot structure, What we are learning). */
  sections: Record<string, string>;
  /** Pictures in the study's Faces/ folder, for cast icons of characters with or without a card. */
  faces: FileEntry[];
  characters: StudyCharacter[];
  scenes: StudyScene[];
}

export interface StudyLibrary {
  studies: Study[];
  lenses: Lens[];
  problems: string[];
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v)).trim();
const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : []);

/** A body cut at its headings of one level: the text before the first, then each heading with its text. */
export function sections(body: string, level: number): { lead: string; parts: { heading: string; text: string }[] } {
  const mark = '#'.repeat(level) + ' ';
  const parts: { heading: string; text: string }[] = [];
  const lead: string[] = [];
  let cur: { heading: string; lines: string[] } | null = null;
  const all: { heading: string; lines: string[] }[] = [];
  for (const line of String(body || '').split(/\r?\n/)) {
    if (line.startsWith(mark)) {
      cur = { heading: line.slice(mark.length).trim(), lines: [] };
      all.push(cur);
    } else if (cur) cur.lines.push(line);
    else lead.push(line);
  }
  for (const a of all) parts.push({ heading: a.heading, text: a.lines.join('\n').trim() });
  return { lead: lead.join('\n').trim(), parts };
}

/** "- Field: value" lines, in order. A line without a colon is kept with an empty field name. */
export function fieldLines(text: string): Reading {
  const out: Reading = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const m = /^\s*[-*]\s+(.*)$/.exec(raw);
    if (!m) continue;
    const item = m[1].trim();
    const c = /^([^:"“]{1,60}):\s*(.*)$/.exec(item);
    if (c) out.push([c[1].trim(), c[2].trim()]);
    else out.push(['', item]);
  }
  return out;
}

/** A list's items, one per "- " line. */
export function items(text: string): string[] {
  return String(text || '').split(/\r?\n/).map((l) => /^\s*[-*]\s+(.*)$/.exec(l)).filter(Boolean).map((m) => (m as RegExpExecArray)[1].trim());
}

function field(r: Reading, name: string): string {
  const want = name.toLowerCase();
  const hit = r.find(([k]) => k.toLowerCase() === want);
  return hit ? hit[1] : '';
}

function cleanHolds(v: string): Holds {
  const w = v.toLowerCase().split(/[\s,.(]/)[0];
  return w === 'yes' || w === 'partly' || w === 'no' || w === 'first' ? w : '';
}

function cleanRole(v: string): Role {
  const w = v.toLowerCase().trim().split(/[\s,.(;]/)[0];
  return (ROLES as string[]).includes(w) ? (w as Role) : '';
}

/** "- Kazuma (choice, turning): Stung, he picks her." A line without the brackets is "- Who: beat", or just the beat. */
export function parseBeat(line: string): Beat {
  const m = /^([^():]{1,60}?)\s*\(([^)]*)\)\s*:\s*(.*)$/.exec(line.trim());
  if (m) {
    const tags = m[2].split(',').map((t) => t.trim()).filter(Boolean);
    const turning = tags.some((t) => /^turning$/i.test(t));
    return { who: m[1].trim(), kind: tags.filter((t) => !/^turning$/i.test(t)).join(', '), turning, text: m[3].trim() };
  }
  const c = /^([^:"“]{1,60}):\s*(.*)$/.exec(line.trim());
  return c ? { who: c[1].trim(), kind: '', turning: false, text: c[2].trim() } : { who: '', kind: '', turning: false, text: line.trim() };
}

/** "The world (opposes), The angel (supports)": names and roles, split at commas outside brackets. */
export function parseOthers(v: string): Player[] {
  const out: Player[] = [];
  let depth = 0, cur = '';
  const flush = () => {
    const t = cur.trim();
    cur = '';
    if (!t || /^none\b/i.test(t)) return;
    const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(t);
    out.push(m ? { name: m[1].trim(), role: cleanRole(m[2]), carded: false } : { name: t, role: '', carded: false });
  };
  for (const ch of String(v || '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) flush();
    else cur += ch;
  }
  flush();
  return out;
}

/** A ## block of a scene: its own "- Key: value" lines, then one reading per ### lens (Moments, Beats and Retelling kept apart). */
function block(text: string): { own: Reading; moments: string[]; beats: Beat[]; retelling: string; readings: Record<string, Reading> } {
  const s = sections(text, 3);
  const readings: Record<string, Reading> = {};
  let moments: string[] = [];
  let beats: Beat[] = [];
  let retelling = '';
  for (const p of s.parts) {
    if (/^moments$/i.test(p.heading)) moments = items(p.text);
    else if (/^beats$/i.test(p.heading)) beats = items(p.text).map(parseBeat);
    else if (/^retelling$/i.test(p.heading)) retelling = p.text;
    else readings[p.heading] = fieldLines(p.text);
  }
  return { own: fieldLines(s.lead), moments, beats, retelling, readings };
}

export function parseScene(path: string, data: Record<string, unknown>, body: string): StudyScene {
  const s = sections(body, 2);
  let plot: PlotInScene = { driver: '', link: '', whyNext: '', bestLens: '', why: '', others: [], beats: [], retelling: '', readings: {} };
  const cast: CharacterInScene[] = [];
  for (const p of s.parts) {
    const b = block(p.text);
    if (/^plot$/i.test(p.heading)) {
      plot = {
        driver: field(b.own, 'Driver'), link: field(b.own, 'Link'), whyNext: field(b.own, 'Why next'),
        bestLens: field(b.own, 'Best lens'), why: field(b.own, 'Why'), others: parseOthers(field(b.own, 'Others')),
        beats: b.beats, retelling: b.retelling, readings: b.readings
      };
    } else {
      cast.push({ name: p.heading, bestLens: field(b.own, 'Best lens'), why: field(b.own, 'Why'), holds: cleanHolds(field(b.own, 'Holds')), role: cleanRole(field(b.own, 'Role')), moments: b.moments, readings: b.readings });
    }
  }
  return {
    id: str(data.id), title: str(data.title), path, order: num(data.order, 0), where: str(data.where),
    characters: list(data.characters), summary: str(data.summary), sourceUrl: str(data.source_url), plot, cast
  };
}

export function parseCharacter(path: string, data: Record<string, unknown>, body: string): StudyCharacter {
  const s = sections(body, 2);
  const readings: Record<string, Reading> = {};
  let notes = '';
  for (const p of s.parts) {
    if (/^notes$/i.test(p.heading)) notes = p.text;
    else readings[p.heading] = fieldLines(p.text);
  }
  return { name: str(data.name), path, role: str(data.role), facts: list(data.facts), bestLens: str(data.best_lens), order: num(data.order, 999), readings, notes, face: null };
}

export function parseLens(data: Record<string, unknown>, body: string): Lens {
  return {
    name: str(data.name), side: str(data.side) === 'plot' ? 'plot' : 'character', framework: str(data.framework), source: str(data.source),
    fields: list(data.fields), question: str(data.question), order: num(data.order, 999), about: String(body || '').trim()
  };
}

/** The study folder a path is in ("Studies/Konosuba"), or '' for the Lenses folder and paths outside Studies. */
export function studyFolder(path: string): string {
  if (!path.startsWith(ROOT) || path.startsWith(LENS_FOLDER)) return '';
  const name = path.slice(ROOT.length).split('/')[0];
  return name && path.slice(ROOT.length).includes('/') ? ROOT + name : '';
}

/** The picture for a character: Faces/<name>.jpg, .jpeg, .png or .webp in its study's folder. */
export function facePath(folder: string, name: string): string {
  return folder + '/Faces/' + name.replace(/[\\/:*?"<>|]/g, '').trim() + '.jpg';
}

export function findFace(files: FileEntry[], folder: string, name: string): FileEntry | null {
  const stem = facePath(folder, name).replace(/\.jpg$/, '').toLowerCase();
  return files.find((f) => /\.(jpe?g|png|webp)$/i.test(f.path) && f.path.toLowerCase().replace(/\.(jpe?g|png|webp)$/i, '') === stem) || null;
}

/** Which files the app reads: every Markdown note under Studies/. */
export function studyFiles(files: FileEntry[]): FileEntry[] {
  return files.filter((f) => f.path.startsWith(ROOT) && f.path.endsWith('.md') && !/\/(Archive|Snapshots)\//.test(f.path));
}

/** Build every study from the notes' texts. `files` is the whole tree (for pictures); `texts` maps a path to its text. */
export function buildLibrary(files: FileEntry[], texts: Map<string, string>): StudyLibrary {
  const problems: string[] = [];
  const lenses: Lens[] = [];
  const studies = new Map<string, Study>();
  const chars: { folder: string; c: StudyCharacter }[] = [];
  const scenes: { folder: string; s: StudyScene }[] = [];
  for (const [path, text] of texts) {
    const p = Frontmatter.parse(text);
    if (p.error) { problems.push(path + ' could not be read: ' + p.error + '.'); continue; }
    const data = (p.data || {}) as Record<string, unknown>;
    const type = str(data.type);
    const folder = studyFolder(path);
    if (type === 'study-lens') lenses.push(parseLens(data, p.body));
    else if (type === 'study' && folder) {
      const sec = sections(p.body, 2);
      const named: Record<string, string> = {};
      for (const part of sec.parts) named[part.heading] = part.text;
      const prior = studies.get(folder);
      studies.set(folder, {
        title: str(data.title) || folder.slice(ROOT.length), folder, author: str(data.author), medium: str(data.medium), status: str(data.status) || 'open',
        about: sec.lead, sections: named, faces: [], characters: prior ? prior.characters : [], scenes: prior ? prior.scenes : []
      });
    } else if (type === 'study-character' && folder) chars.push({ folder, c: parseCharacter(path, data, p.body) });
    else if (type === 'study-scene' && folder) scenes.push({ folder, s: parseScene(path, data, p.body) });
  }
  const get = (folder: string): Study => {
    let s = studies.get(folder);
    if (!s) {
      s = { title: folder.slice(ROOT.length), folder, author: '', medium: '', status: 'open', about: '', sections: {}, faces: [], characters: [], scenes: [] };
      studies.set(folder, s);
      problems.push(folder + ' has no Study.md, so it shows under its folder name.');
    }
    return s;
  };
  for (const { folder, c } of chars) { c.face = findFace(files, folder, c.name); get(folder).characters.push(c); }
  for (const { folder, s } of scenes) get(folder).scenes.push(s);
  for (const s of studies.values()) {
    s.faces = files.filter((f) => f.path.startsWith(s.folder + '/Faces/') && /\.(jpe?g|png|webp)$/i.test(f.path));
    s.characters.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    s.scenes.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }
  lenses.sort((a, b) => (a.side === b.side ? 0 : a.side === 'character' ? -1 : 1) || a.order - b.order || a.name.localeCompare(b.name));
  return { studies: [...studies.values()].sort((a, b) => a.title.localeCompare(b.title)), lenses, problems };
}

/** Lenses of one side that Kyle can read a scene with (a lens with no fields is still waiting for its source). */
export function lensesFor(lib: StudyLibrary, side: Side): Lens[] {
  return lib.lenses.filter((l) => l.side === side);
}

export interface Tally { lens: string; best: number; }

/** How often each lens was the best reading, for one character (by name) or for the plot (name ''), most first. */
export function tally(study: Study, name: string): Tally[] {
  const counts = new Map<string, number>();
  for (const s of study.scenes) {
    const lens = name ? (s.cast.find((c) => c.name === name) || { bestLens: '' }).bestLens : s.plot.bestLens;
    if (lens) counts.set(lens, (counts.get(lens) || 0) + 1);
  }
  return [...counts.entries()].map(([lens, best]) => ({ lens, best })).sort((a, b) => b.best - a.best || a.lens.localeCompare(b.lens));
}

/** The scenes a character is in, in order, with their reading there. */
export function scenesOf(study: Study, name: string): { scene: StudyScene; me: CharacterInScene }[] {
  const out: { scene: StudyScene; me: CharacterInScene }[] = [];
  for (const scene of study.scenes) {
    const me = scene.cast.find((c) => c.name === name);
    if (me) out.push({ scene, me });
  }
  return out;
}

/** A quote and what it shows, from a Moments line: '"Mine." Counts her takings.' gives ['Mine.', 'Counts her takings.']. */
export function splitMoment(line: string): { quote: string; note: string } {
  const m = /^["“](.+?)["”]\s*[-–—:]?\s*(.*)$/.exec(line.trim());
  return m ? { quote: m[1], note: m[2] } : { quote: '', note: line.trim() };
}

/** The picture for anyone in the study, carded or not (Faces/<name>.jpg). */
export function faceFor(study: Study, name: string): FileEntry | null {
  return findFace(study.faces, study.folder, name);
}

/** Everyone in a scene's plot, carded characters first (in the scene's order) and then the others. */
export function players(scene: StudyScene): Player[] {
  const out: Player[] = scene.cast.map((c) => ({ name: c.name, role: c.role, carded: true }));
  for (const o of scene.plot.others) if (!out.some((p) => same(p.name, o.name))) out.push(o);
  return out;
}

/** A force rather than a person (The world, the town, fate): drawn as a square, not a face. */
export function isForce(name: string): boolean {
  return /^the (world|town|city|guild|system|rules|weather|crowd)\b/i.test(name.trim()) || /^(fate|society|nature)$/i.test(name.trim());
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whose beat it is: a beat's Who matched to a player by name, or kept as written. */
export function beatOwner(scene: StudyScene, beat: Beat): string {
  const hit = players(scene).find((p) => same(p.name, beat.who));
  return hit ? hit.name : beat.who;
}

export interface DriveCell { role: Role; beats: number; turning: boolean; present: boolean; }
export interface DriveRow { name: string; carded: boolean; cells: DriveCell[]; beats: number; turning: number; }

/** Who drives the plot: one row per character or force, one cell per scene, with their role and the beats they caused.
 *  Carded characters first in card order, then the others by beats caused. */
export function driveGrid(study: Study): DriveRow[] {
  const rows: DriveRow[] = [];
  const rowFor = (name: string, carded: boolean): DriveRow => {
    let r = rows.find((x) => same(x.name, name));
    if (!r) { r = { name, carded, cells: study.scenes.map(() => ({ role: '', beats: 0, turning: false, present: false })), beats: 0, turning: 0 }; rows.push(r); }
    if (carded) r.carded = true;
    return r;
  };
  for (const c of study.characters) rowFor(c.name, true);
  study.scenes.forEach((scene, i) => {
    for (const p of players(scene)) { const cell = rowFor(p.name, p.carded).cells[i]; cell.present = true; cell.role = p.role; }
    for (const b of scene.plot.beats) {
      if (!b.who) continue;
      const r = rowFor(beatOwner(scene, b), false);
      const cell = r.cells[i];
      cell.present = true;
      cell.beats++;
      r.beats++;
      if (b.turning) { cell.turning = true; r.turning++; }
    }
  });
  const order = (r: DriveRow) => { const k = study.characters.findIndex((c) => same(c.name, r.name)); return k < 0 ? 999 : k; };
  return rows.filter((r) => r.cells.some((c) => c.present)).sort((a, b) => order(a) - order(b) || b.beats - a.beats || a.name.localeCompare(b.name));
}

/** The Value Shift reading's From and To, for the story board's value line ('' when the scene was not read so). */
export function valueShift(scene: StudyScene): { value: string; from: string; to: string } {
  const r = scene.plot.readings['Value Shift'] || [];
  return { value: field(r, 'Value'), from: field(r, 'From'), to: field(r, 'To') };
}

/** Two letters for the placeholder face. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}
