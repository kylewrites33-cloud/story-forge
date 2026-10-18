// A codex card's "now": where a character, place, item or piece of lore stands at the open scene (its latest progression
// note), how many > [!secret] callouts it holds and whether the team may see each yet. Secrets follow the schema's
// conventions.secrets the way sf's packet does (splitSecrets, parseWhen, whenVs in sf.js): a callout titled with a scene
// ("> [!secret] Book 1, S-039") is revealed by that scene; an untitled one stays hidden until a scene's reveal list names
// the note. Also the Matrix's red squares: a character on a scene's card who is never named in its prose.
import { linkName, nameList, toNumber } from './links.ts';
import type { Presence } from './codex.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

export interface SecretPart { title: string; when: { book: number | null; scene: string } | null; text: string }

/** "Book 2, S-004", "B2 S-004" or "S-004": where a secret comes out. */
export function parseWhen(v: unknown): { book: number | null; scene: string } | null {
  const t = String(v == null ? '' : v), sm = t.match(/\bS-\d{3}\b/i);
  if (!sm) return null;
  const bm = t.match(/\b(?:book\s*|b)(\d+)\b/i);
  return { book: bm ? Number(bm[1]) : null, scene: sm[0].toUpperCase() };
}

/** The note's secret callouts, as sf reads them (a "## Draft disagrees" section is not a secret and is left out). */
export function splitSecrets(body: string): SecretPart[] {
  const lines = String(body || '').replace(/\r\n?/g, '\n').replace(/^## Draft disagrees[^\n]*\n[\s\S]*?(?=^## |^\s*>\s*\[!|(?![\s\S]))/gim, '').split('\n');
  const parts: { title: string; when: SecretPart['when']; lines: string[] }[] = [];
  let cur: (typeof parts)[number] | null = null;
  lines.forEach((l) => {
    if (/^\s*>\s*\[!secret\][+-]?/i.test(l)) {
      const t = l.replace(/^\s*>\s*\[!secret\][+-]?\s*/i, '');
      const when = parseWhen(t);
      cur = { title: t, when, lines: [] };
      parts.push(cur);
      if (t && !when) cur.lines.push(t);
      return;
    }
    if (cur) {
      if (/^\s*>/.test(l)) { cur.lines.push(l.replace(/^\s*>\s?/, '')); return; }
      cur = null;
    }
  });
  return parts.map((p) => ({ title: p.title, when: p.when, text: p.lines.join('\n').trim() }));
}

/** Where the team stands in a book: the scene IDs in reading order, the book's number, and the scene it is at
 * (index into ids; ids.length means after the last scene). */
export interface Position { bookNumber: number | null; ids: string[]; at: number; reveals: string[][] }

export type SecretState = 'known' | 'here' | 'held';

/** Each secret's state at a position: known (revealed before it), here (revealed by it) or held (not yet). */
export function secretStates(parts: SecretPart[], names: string[], pos: Position): SecretState[] {
  const lower = names.map((n) => n.toLowerCase());
  const named = (i: number) => (pos.reveals[i] || []).some((r) => lower.indexOf(r.toLowerCase()) >= 0);
  let before = false, here = false;
  pos.reveals.forEach((_, i) => { if (i < pos.at && named(i)) before = true; if (i === pos.at && named(i)) here = true; });
  return parts.map((p) => {
    if (!p.when) return before ? 'known' : here ? 'here' : 'held';
    if (p.when.book != null && pos.bookNumber != null && p.when.book !== pos.bookNumber) return p.when.book < pos.bookNumber ? 'known' : 'held';
    const i = pos.ids.indexOf(p.when.scene);
    if (i < 0) return 'held';
    return i < pos.at ? 'known' : i === pos.at ? 'here' : 'held';
  });
}

/** The names a note goes by, for matching progression subjects and reveal lists: name, aliases and file name. */
export function namesOf(note: NoteRecord, extra: NoteRecord | null = null): string[] {
  const out: string[] = [];
  [note, extra].forEach((n) => {
    if (!n) return;
    const name = String(n.data.name || n.data.title || '').trim();
    if (name) out.push(name);
    nameList(n.data.aliases).forEach((a) => out.push(a));
    out.push(n.path.replace(/^.*\//, '').replace(/\.md$/, ''));
  });
  return out.filter((x, i, a) => x && a.indexOf(x) === i);
}

export interface Progress { note: NoteRecord; book: BookEntry; index: number; change: string; at: string; kind: string }

function scenesOf(index: VaultIndex, book: BookEntry): NoteRecord[] {
  return book.scenes.map((p) => index.notes[p]).filter((n): n is NoteRecord => Boolean(n));
}

/** A position in a book: at a scene, or else where the writing is (the last scene that is not just planned). */
export function positionIn(index: VaultIndex, book: BookEntry, scenePath: string | null): Position {
  const scenes = scenesOf(index, book);
  const ids = scenes.map((s) => String(s.data.id || '').toUpperCase());
  let at = scenePath ? scenes.findIndex((s) => s.path === scenePath) : -1;
  if (at < 0) {
    at = -1;
    scenes.forEach((s, i) => { if (String(s.data.status || 'planned') !== 'planned' && s.data.kind !== 'test') at = i; });
  }
  return { bookNumber: book.number, ids, at, reveals: scenes.map((s) => nameList(s.data.reveal)) };
}

/** Every progression about the note in its series' books up to the position's book, in reading order. */
export function progressionsOf(index: VaultIndex, names: string[], book: BookEntry): Progress[] {
  const lower = names.map((n) => n.toLowerCase());
  const books = index.books.filter((b) => b.seriesFolder === book.seriesFolder && (b === book || (b.number != null && book.number != null && b.number < book.number)))
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const out: Progress[] = [];
  books.forEach((b) => {
    const ids = scenesOf(index, b).map((s) => String(s.data.id || '').toUpperCase());
    Object.values(index.notes).forEach((n) => {
      if (n.type !== 'progression' || !n.path.startsWith(b.folder + '/')) return;
      if (lower.indexOf(linkName(n.data.subject).toLowerCase()) < 0) return;
      const at = String(n.data.at || '').toUpperCase();
      const i = ids.indexOf(at);
      out.push({ note: n, book: b, index: i < 0 ? ids.length : i, change: String(n.data.change || n.data.title || ''), at, kind: String(n.data.kind || '') });
    });
  });
  const bookOrder = (p: Progress) => books.indexOf(p.book);
  return out.sort((a, b) => bookOrder(a) - bookOrder(b) || a.index - b.index || (toNumber(String(a.note.data.id || '').replace(/\D/g, '')) || 0) - (toNumber(String(b.note.data.id || '').replace(/\D/g, '')) || 0));
}

export interface CodexNow {
  /** The scene the state is at ('' when the book has nothing written yet), and whether it is the open scene. */
  scene: string;
  open: boolean;
  /** The latest progression up to and including that scene, and how many came before it. */
  latest: Progress | null;
  earlier: number;
  secrets: { title: string; state: SecretState }[];
  /** The note's own AI setting: never means the team never sees it at all. */
  never: boolean;
}

/** A note's "now" in a book: at the open scene when there is one, or where the writing is. */
export function codexNow(index: VaultIndex, book: BookEntry | null, note: NoteRecord, scenePath: string | null = null, delta: NoteRecord | null = null): CodexNow {
  const names = namesOf(note, delta);
  const parts = splitSecrets(note.body).concat(delta ? splitSecrets(delta.body) : []);
  const never = String((delta && delta.data.ai) || note.data.ai || '') === 'never';
  if (!book) return { scene: '', open: false, latest: null, earlier: 0, secrets: parts.map((p) => ({ title: p.title, state: 'held' as SecretState })), never };
  const pos = positionIn(index, book, scenePath);
  const states = secretStates(parts, names, pos);
  const upTo = progressionsOf(index, names, book).filter((p) => p.book !== book || p.index <= pos.at);
  return {
    scene: pos.at >= 0 ? pos.ids[pos.at] || '' : '', open: Boolean(scenePath) && book.scenes[pos.at] === scenePath,
    latest: upTo.length ? upTo[upTo.length - 1] : null, earlier: Math.max(0, upTo.length - 1),
    secrets: parts.map((p, i) => ({ title: p.title, state: states[i] })), never
  };
}

/** A scene with prose (not a planned card whose body holds card notes). */
export function hasProse(scene: NoteRecord): boolean {
  return String(scene.data.status || 'planned') !== 'planned' && scene.body.trim().length > 0;
}

/** The Matrix's red square: a character planned on the card (point of view or cast) whom the prose never names. */
export function plannedNotNamed(scene: NoteRecord, type: string, p: Presence): boolean {
  return type === 'character' && (p.pov || p.card) && p.named === 0 && hasProse(scene);
}
