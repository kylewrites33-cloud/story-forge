// The Cast web: the book's characters as circles, sized by how many scenes each is on stage in (point of view, on the
// card's cast, or named in the prose: the Matrix's presence), joined by lines from the character notes' `relationships`
// lists (links, "[[Tobin Quill]]"). A line is as wide as the relationship is tense when the text says: words after the
// link in a list item ("tension 8", "7/10", "rival"), or else the sentences of the character's note that name the other
// one ("The Warden is her enemy."); otherwise every line is the same width. The picture shows one character at a time in
// the middle with their ties in two columns (hubFor), so names never pile up however big the cast is.
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

export interface WebNode { name: string; note: NoteRecord; color: string; scenes: number }
export interface WebEdge { a: number; b: number; tension: number | null; texts: string[] }

export interface CastWeb {
  nodes: WebNode[];
  edges: WebEdge[];
  /** Names in a relationships list that have no character note in this book's cast. */
  unknown: { from: string; name: string }[];
  /** True when at least one line's words say how tense it is. */
  anyTension: boolean;
}

/** A line's width for a tension: 3 px when the words do not say, 1.5 (calm) to 9 (open hostility) when they do. */
export function lineWidth(tension: number | null): number {
  return tension == null ? 3 : Math.round((1.5 + (tension / 10) * 7.5) * 10) / 10;
}

/** The character to start on: the one on stage in the most scenes who has a tie, else the one on stage the most. */
export function defaultFocus(web: CastWeb): number {
  if (!web.nodes.length) return -1;
  const tied = new Set<number>();
  web.edges.forEach((e) => { tied.add(e.a); tied.add(e.b); });
  const order = web.nodes.map((_, i) => i).sort((x, y) => web.nodes[y].scenes - web.nodes[x].scenes || x - y);
  return order.find((i) => tied.has(i)) ?? order[0];
}

export interface HubSpoke { node: number; edge: WebEdge; x: number; y: number; r: number; side: 'left' | 'right' }
export interface Hub { focus: number; x: number; y: number; r: number; spokes: HubSpoke[]; width: number; height: number }

const ROW = 64;

/** One character in the middle and everyone tied to them in two columns, left and right, bowed like brackets. Each row is
 *  64 px apart and every name sits on the outside of its column, so no circle or name can cover another. The tensest ties
 *  are at the top. */
export function hubFor(web: CastWeb, focus: number, width = 800): Hub {
  const mine = web.edges.filter((e) => e.a === focus || e.b === focus)
    .map((e) => ({ edge: e, node: e.a === focus ? e.b : e.a }))
    .sort((x, y) => (y.edge.tension ?? -1) - (x.edge.tension ?? -1) || web.nodes[y.node].scenes - web.nodes[x.node].scenes || x.node - y.node);
  const rows = Math.ceil(mine.length / 2);
  const height = Math.max(200, rows * ROW + 80);
  const cx = width / 2, cy = height / 2;
  const most = Math.max(1, ...web.nodes.map((n) => n.scenes));
  const reach = width / 2 - 205;
  const spokes = mine.map((m, i) => {
    const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
    const row = Math.floor(i / 2);
    const y = rows === 1 ? cy : 40 + ROW / 2 + row * ((height - 80 - ROW) / Math.max(1, rows - 1));
    const t = rows === 1 ? 0 : (y - cy) / (height / 2 - 40 - ROW / 2);
    const x = cx + (side === 'left' ? -1 : 1) * (reach - 60 * t * t);
    return { ...m, side, x, y, r: Math.round(10 + 14 * Math.sqrt(web.nodes[m.node].scenes / most)) };
  });
  return { focus, x: cx, y: cy, r: 34, spokes, width, height };
}

export function castWeb(index: VaultIndex, book: BookEntry): CastWeb {
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
  const nodes = cast.map((c, i) => ({
    name: c.name, note: c.series || c.note, color: entries[i] ? entries[i]!.color : 'var(--accent)', scenes: counts[i]
  }));
  return { nodes, edges, unknown, anyTension: edges.some((e) => e.tension != null) };
}
