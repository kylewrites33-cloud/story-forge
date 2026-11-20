// Sparrow Pocket (2026-11-20; Kyle: "an easy way for me to make changes to chapters on the phone ... really simplified
// and probably a totally different approach", then "I was more thinking of going through the cards and suggesting new
// cards or tweaks, and maybe rewriting the text"): what the phone page works out from the vault. Its chapters with
// their waiting cards, one chapter's cards in page order, a chapter's text as paragraphs with the cards beside them,
// and one paragraph rewritten. Pure, tested with Node (tests/pocket.test.ts). Reading the cards is src/lib/changes.ts;
// saving is src/vault/; Pocket adds no parsing or saving of its own.
import { changesNoteFor, CHANGES_TYPE, parseChanges, placeChanges, type Change } from './changes.ts';
import { splitLead } from './drafts.ts';
import { propNum, propText } from './props.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

export interface PocketChapter {
  chapter: number;
  /** The chapter's own ID (CH-007), or '' for a chapter whose scenes have none yet. */
  id: string;
  title: string;
  /** The scenes of the chapter in reading order. */
  scenes: NoteRecord[];
  /** The chapter's changes note, if it has one. */
  note: NoteRecord | null;
  /** Cards waiting on Kyle in it. */
  open: number;
}

/** A chapter's key in Pocket's addresses: its ID, or "n" and its number when it has no ID. */
export const chapterKey = (c: { chapter: number; id: string }): string => c.id || 'n' + c.chapter;

/** Every chapter of the book in order, with its scenes, its changes note and how many cards wait in it. */
export function bookChapters(index: VaultIndex, book: BookEntry): PocketChapter[] {
  const out: PocketChapter[] = [];
  book.scenes.forEach((p) => {
    const n = index.notes[p];
    // A scene with no chapter yet (a test drive) belongs to none.
    const ch = n && propNum(n, 'chapter') > 0 ? propNum(n, 'chapter') : null;
    if (!n || ch == null) return;
    let c = out.find((x) => x.chapter === ch);
    if (!c) {
      const note = changesNoteFor(index.notes, book.folder, ch);
      c = { chapter: ch, id: '', title: '', scenes: [], note, open: note ? openCards(note).length : 0 };
      out.push(c);
    }
    c.scenes.push(n);
    if (!c.id) c.id = propText(n, 'chapter_id');
    if (!c.title) c.title = propText(n, 'chapter_title');
  });
  return out.sort((a, b) => a.chapter - b.chapter);
}

/** The chapters Pocket lists: the ones with a changes note. */
export function cardChapters(index: VaultIndex, book: BookEntry): PocketChapter[] {
  return bookChapters(index, book).filter((c) => c.note);
}

/** The books that have any changes note, in the order the vault lists them. */
export function cardBooks(index: VaultIndex): BookEntry[] {
  return index.books.filter((b) => Object.values(index.notes).some((n) => n.type === CHANGES_TYPE && n.path.startsWith(b.folder + '/')));
}

/** The open cards of a changes note, in the note's order. */
export function openCards(note: NoteRecord): Change[] {
  return parseChanges(note.body).changes.filter((c) => c.status === 'open');
}

export interface DeckCard {
  change: Change;
  /** The scene its words are in, and where; null when its words are no longer on the page. */
  scene: NoteRecord | null;
  at: number;
  end: number;
}

/** A scene's text as the page shows it: its body without the blank line after the properties. */
export const pageText = (body: string): string => splitLead(body).text;

/** The chapter's open cards in page order, as the Edit room lists them: scene by scene, each scene's cards where their
 * words stand, then the cards whose words are no longer on the page. `textOf` gives a scene's body as Kyle has it now
 * (with words still waiting on the device). */
export function deck(ch: PocketChapter, textOf: (n: NoteRecord) => string): DeckCard[] {
  if (!ch.note) return [];
  const open = openCards(ch.note);
  const placedCards: DeckCard[] = [];
  const done = new Set<string>();
  ch.scenes.forEach((s) => {
    const id = propText(s, 'id');
    const left = open.filter((c) => !done.has(c.id));
    placeChanges(pageText(textOf(s)), left, id).placed.forEach((p) => {
      done.add(p.change.id);
      placedCards.push({ change: p.change, scene: s, at: p.at, end: p.end });
    });
  });
  const lost = open.filter((c) => !done.has(c.id)).map((c): DeckCard => ({ change: c, scene: null, at: -1, end: -1 }));
  return placedCards.concat(lost);
}

export interface Paragraph {
  /** Where it starts and ends in the scene's page text. */
  at: number;
  end: number;
  text: string;
  /** The waiting cards whose words lie in it, in page order. */
  cards: Change[];
}

/** A scene's page text cut into paragraphs (runs of lines between blank lines; a System screen's `>` lines stay one
 * paragraph), each with the waiting cards whose words lie in it. */
export function paragraphs(text: string, cards: DeckCard[] = []): Paragraph[] {
  const out: Paragraph[] = [];
  const re = /[^\n]*\S[^\n]*(?:\n(?![ \t]*\n)[^\n]*)*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const at = m.index;
    const body = m[0].replace(/\s+$/, '');
    const end = at + body.length;
    out.push({ at, end, text: body, cards: cards.filter((c) => c.at < end && at < c.end).map((c) => c.change) });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

/** The page text with one paragraph's words replaced by `words`. Empty words take the paragraph out with the blank
 * line after it (or before it, at the end), so no double gap is left. Throws a plain sentence when the paragraph is not
 * where it was (the scene changed while Kyle typed). */
export function replaceParagraph(text: string, p: { at: number; end: number; text: string }, words: string): string {
  if (text.slice(p.at, p.end) !== p.text) throw new Error('This paragraph changed while you were typing. Your words are still in the box: copy them, go back and open the paragraph again.');
  const put = words.replace(/\r\n?/g, '\n').replace(/^(?:[ \t]*\n)+/, '').trimEnd();
  if (put.trim()) return text.slice(0, p.at) + put + text.slice(p.end);
  const after = /^\n[ \t]*\n+/.exec(text.slice(p.end));
  if (after) return text.slice(0, p.at) + text.slice(p.end + after[0].length);
  const before = /\n[ \t]*\n+$/.exec(text.slice(0, p.at));
  return before ? text.slice(0, p.at - before[0].length) + text.slice(p.end) : text.slice(0, p.at) + text.slice(p.end);
}

/** The body with a new page text: the blank line after the properties kept as it was. */
export function withPageText(body: string, text: string): string {
  return splitLead(body).lead + text;
}

/** The scene a card's words belong to: its Scene line's scene in the chapter, else the first scene holding its Was. */
export function sceneFor(ch: PocketChapter, c: Change, textOf: (n: NoteRecord) => string): NoteRecord | null {
  const byId = c.scene ? ch.scenes.find((s) => propText(s, 'id') === c.scene) : null;
  if (byId) return byId;
  return ch.scenes.find((s) => pageText(textOf(s)).indexOf(c.was) >= 0) || null;
}

/** Where Kyle left off, kept on the phone: the book, the chapter and the card he was on. */
export interface Place { book: string; chapter: string; card: string }

export function readPlace(v: unknown): Place | null {
  const o = v as Place | null;
  return o && typeof o.book === 'string' && typeof o.chapter === 'string' && typeof o.card === 'string' ? o : null;
}
