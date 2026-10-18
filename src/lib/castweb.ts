// The Cast web: the book's characters as circles, sized by how many scenes each is on stage in (point of view, on the
// card's cast, or named in the prose: the Matrix's presence), joined by lines from the character notes' `relationships`
// lists (links, "[[Tobin Quill]]"). A line is as wide as the relationship is tense when the text says: words after the
// link in a list item ("tension 8", "7/10", "rival"), or else the sentences of the character's note that name the other
// one ("The Warden is her enemy."); otherwise every line is the same width. The layout is a small force layout that starts from a
// circle in name order and runs a fixed number of steps, so the same book always draws the same picture.
import { castFor } from './boards.ts';
import { codexFor, matcher, presence, present } from './codex.ts';
import { linkName, nameList } from './links.ts';
import { storyScenes } from './seeing.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

export interface Relationship { name: string; text: string; tension: number | null }

const HIGH = ['hate', 'hates', 'hatred', 'enemy', 'enemies', 'hostile', 'feud', 'nemesis', 'betray', 'betrays', 'betrayed', 'loathe', 'loathes', 'war'];
const MID = ['rival', 'rivals', 'rivalry', 'tense', 'tension', 'distrust', 'distrusts', 'resent', 'resents', 'resentment', 'strained', 'wary',
  'suspicious', 'grudge', 'conflict', 'clash', 'bitter', 'jealous', 'uneasy', 'estranged'];
const LOW = ['friend', 'friends', 'ally', 'allies', 'trust', 'trusts', 'love', 'loves', 'close', 'loyal', 'mentor', 'partner', 'warm'];

/** How tense a relationship's words say it is, 0 to 10, or null when they do not say. */
export function tensionOf(text: string): number | null {
  const t = text.toLowerCase();
  const n = t.match(/(\d+(?:\.\d+)?)\s*\/\s*10\b/) || t.match(/tens(?:e|ion)\s*[:=]?\s*(\d+(?:\.\d+)?)/);
  if (n) return Math.max(0, Math.min(10, parseFloat(n[1])));
  const words = t.split(/[^\p{L}]+/u);
  if (words.some((w) => HIGH.indexOf(w) >= 0)) return 9;
  if (words.some((w) => MID.indexOf(w) >= 0)) return 6;
  if (words.some((w) => LOW.indexOf(w) >= 0)) return 2;
  return null;
}

/** One item of a `relationships` list: who, and any words after the link. */
export function parseRelationship(item: unknown): Relationship | null {
  if (Array.isArray(item)) {
    const name = linkName(item);
    return name ? { name, text: '', tension: null } : null;
  }
  const s = String(item ?? '').trim();
  if (!s) return null;
  let name: string, rest: string;
  const m = s.match(/\[\[([^\]]+)\]\]/);
  if (m) {
    name = linkName('[[' + m[1] + ']]');
    rest = (s.slice(0, m.index) + ' ' + s.slice((m.index || 0) + m[0].length)).trim();
  } else {
    const cut = s.search(/\s*(?::|\(|\s[-–—]\s)/);
    name = (cut < 0 ? s : s.slice(0, cut)).trim();
    rest = cut < 0 ? '' : s.slice(cut);
  }
  const text = rest.replace(/^[\s:,;(\-–—]+|[\s)]+$/g, '').trim();
  return name ? { name, text, tension: text ? tensionOf(text) : null } : null;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The sentences of a note's text that name someone (any of their terms, as whole words), on one line. Callouts are left out. */
export function aboutIn(body: string, terms: string[]): string {
  const words = terms.filter(Boolean);
  if (!body || !words.length) return '';
  const re = new RegExp('(?<![\\p{L}\\p{N}])(?:' + words.map(esc).join('|') + ')(?![\\p{L}\\p{N}])', 'iu');
  return body.replace(/^>.*$/gm, '').split(/(?<=[.!?])\s+|\n+/).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x && re.test(x)).join(' ');
}

export interface WebNode { name: string; note: NoteRecord; color: string; scenes: number; x: number; y: number; r: number }
export interface WebEdge { a: number; b: number; tension: number | null; texts: string[] }

export interface CastWeb {
  nodes: WebNode[];
  edges: WebEdge[];
  /** Names in a relationships list that have no character note in this book's cast. */
  unknown: { from: string; name: string }[];
  /** True when at least one line's words say how tense it is. */
  anyTension: boolean;
  width: number;
  height: number;
}

/** A small force layout over a circle start: the same input always gives the same positions, inside width × height. */
export function layout(count: number, edges: { a: number; b: number }[], width: number, height: number, radii: number[]): { x: number; y: number }[] {
  if (!count) return [];
  const cx = width / 2, cy = height / 2, ring = Math.min(width, height) * 0.38;
  const pos = Array.from({ length: count }, (_, i) => ({
    x: cx + (count === 1 ? 0 : ring * Math.cos((2 * Math.PI * i) / count - Math.PI / 2)),
    y: cy + (count === 1 ? 0 : ring * Math.sin((2 * Math.PI * i) / count - Math.PI / 2))
  }));
  if (count < 3) return pos;
  const k = Math.sqrt((width * height) / count) * 0.75;
  let temp = Math.min(width, height) / 8;
  for (let step = 0; step < 240; step++) {
    const dx = new Array(count).fill(0), dy = new Array(count).fill(0);
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
      let x = pos[i].x - pos[j].x, y = pos[i].y - pos[j].y;
      let d = Math.hypot(x, y);
      if (d < 0.01) { x = 0.01 * (i - j); y = 0.01; d = Math.hypot(x, y); }
      const f = (k * k) / d;
      dx[i] += (x / d) * f; dy[i] += (y / d) * f; dx[j] -= (x / d) * f; dy[j] -= (y / d) * f;
    }
    edges.forEach((e) => {
      const x = pos[e.a].x - pos[e.b].x, y = pos[e.a].y - pos[e.b].y;
      const d = Math.max(0.01, Math.hypot(x, y));
      const f = (d * d) / k;
      dx[e.a] -= (x / d) * f; dy[e.a] -= (y / d) * f; dx[e.b] += (x / d) * f; dy[e.b] += (y / d) * f;
    });
    for (let i = 0; i < count; i++) {
      dx[i] += (cx - pos[i].x) * 0.05 * k / 10; dy[i] += (cy - pos[i].y) * 0.05 * k / 10;
      const d = Math.max(0.01, Math.hypot(dx[i], dy[i]));
      pos[i].x += (dx[i] / d) * Math.min(d, temp);
      pos[i].y += (dy[i] / d) * Math.min(d, temp);
    }
    temp *= 0.985;
  }
  // Fit the picture into the box, leaving room for each circle and its name.
  const pad = 16;
  // A name is wider than its circle: keep 64 px either side, and two lines (name, scenes) under it.
  const half = radii.map((r) => Math.max(r, 64));
  const minX = Math.min(...pos.map((p, i) => p.x - half[i])), maxX = Math.max(...pos.map((p, i) => p.x + half[i]));
  const minY = Math.min(...pos.map((p, i) => p.y - radii[i])), maxY = Math.max(...pos.map((p, i) => p.y + radii[i] + 40));
  const s = Math.min((width - 2 * pad) / Math.max(1, maxX - minX), (height - 2 * pad) / Math.max(1, maxY - minY));
  const ox = pad + ((width - 2 * pad) - (maxX - minX) * s) / 2, oy = pad + ((height - 2 * pad) - (maxY - minY) * s) / 2;
  return pos.map((p) => ({ x: ox + (p.x - minX) * s, y: oy + (p.y - minY) * s }));
}

/** A circle's radius for a number of scenes on stage: 14 px for none, growing with the square root up to 40. */
export function radiusFor(scenes: number, most: number): number {
  if (!most) return 18;
  return Math.round(14 + 26 * Math.sqrt(scenes / most));
}

/** A line's width for a tension: 3 px when the words do not say, 1.5 (calm) to 9 (open hostility) when they do. */
export function lineWidth(tension: number | null): number {
  return tension == null ? 3 : Math.round((1.5 + (tension / 10) * 7.5) * 10) / 10;
}

export function castWeb(index: VaultIndex, book: BookEntry, width = 720, height = 520): CastWeb {
  const cast = castFor(index, book).filter((c) => c.name);
  const scenes = storyScenes(index, book);
  const codex = codexFor(index, book);
  const m = matcher(codex);
  const entries = cast.map((c) => codex.find((e) => e.type === 'character' && e.name === c.name));
  const counts = entries.map((e) => (e ? scenes.filter((s) => present(presence(s, e, m))).length : 0));
  const lower = (s: string) => s.trim().toLowerCase();
  const find = (name: string) => cast.findIndex((c) => lower(c.name) === lower(name) || nameList(c.note.data.aliases).some((a) => lower(a) === lower(name)));

  const edges: WebEdge[] = [];
  const unknown: { from: string; name: string }[] = [];
  cast.forEach((c, i) => {
    const list = Array.isArray(c.note.data.relationships) ? c.note.data.relationships : c.note.data.relationships ? [c.note.data.relationships] : [];
    list.forEach((item) => {
      const r = parseRelationship(item);
      if (!r) return;
      const j = find(r.name);
      if (j < 0) { unknown.push({ from: c.name, name: r.name }); return; }
      if (j === i) return;
      const a = Math.min(i, j), b = Math.max(i, j);
      let e = edges.find((x) => x.a === a && x.b === b);
      if (!e) { e = { a, b, tension: null, texts: [] }; edges.push(e); }
      // The list item's own words first; else the sentences of the character's note that name the other one.
      const said = r.text || aboutIn(c.note.body, entries[j] ? entries[j]!.terms : [cast[j].name]);
      const tension = r.text ? r.tension : said ? tensionOf(said) : null;
      if (tension != null) e.tension = Math.max(e.tension ?? 0, tension);
      if (said) e.texts.push(c.name + ': ' + said);
    });
  });
  const most = Math.max(0, ...counts);
  const radii = counts.map((n) => radiusFor(n, most));
  const pos = layout(cast.length, edges, width, height, radii);
  const nodes = cast.map((c, i) => ({
    name: c.name, note: c.series || c.note, color: entries[i] ? entries[i]!.color : 'var(--accent)', scenes: counts[i], x: pos[i].x, y: pos[i].y, r: radii[i]
  }));
  return { nodes, edges, unknown, anyTension: edges.some((e) => e.tension != null), width, height };
}
