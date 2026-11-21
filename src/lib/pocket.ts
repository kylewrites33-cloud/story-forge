// Sparrow Pocket (2026-11-20; Kyle: "an easy way for me to make changes to chapters on the phone ... really simplified
// and probably a totally different approach", then "I was more thinking of going through the cards and suggesting new
// cards or tweaks, and maybe rewriting the text"): what the phone page works out from the vault. Its chapters with
// their waiting cards, one chapter's cards in page order, a chapter's text as paragraphs with the cards beside them,
// and one paragraph rewritten. Pure, tested with Node (tests/pocket.test.ts). Reading the cards is src/lib/changes.ts.
// Since 2026-11-21 the phone only records Kyle's choices (src/lib/phone-choices.ts); what is worked out here shows the
// chapter as it will be once the iPad has put them in.
import { applyChange, changesNoteFor, CHANGES_TYPE, parseChanges, placeChanges, type Change } from './changes.ts';
import { beatsNoteFor, beatsPath } from './beats.ts';
import { aliasMap, beatStep, idChangesBetween, layOut, type ChapterText, type Laid } from './phone-beats.ts';
import { byStart, isBeatKind, PHONE_FOLDER, PHONE_TYPE, readChoices, readNote, rewriteInto, type PhoneChoice } from './phone-choices.ts';
import { propNum, propText } from './props.ts';
import { splitLead } from './lead.ts';
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

/** The books Pocket lists: every book with a chapter (Write mode works in any; Edit mode shows the cards), in the
 * order the vault lists them. */
export function pocketBooks(index: VaultIndex): BookEntry[] {
  return index.books.filter((b) => b.scenes.some((p) => index.notes[p] && propNum(index.notes[p], 'chapter') > 0));
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
export function deck(ch: PocketChapter, textOf: (n: NoteRecord) => string, decided: Set<string> = new Set()): DeckCard[] {
  if (!ch.note) return [];
  const open = openCards(ch.note).filter((c) => !decided.has(c.id));
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

// The paragraph rewrite is in the phone-choices format's own file, because the iPad puts it in the same way.
export { replaceParagraph } from './phone-choices.ts';

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

// ---- Choices made on the phone, waiting for the iPad (2026-11-21) ----

/** A choice the vault has not had put in yet: still only on the phone (`id` set), or on a phone note waiting for the
 * iPad (`note` set). */
export interface Waiting extends PhoneChoice {
  book: string;
  id: string;
  note: string;
}

/** The choices on a book's phone notes that the iPad has not put in yet, oldest note first, in the order made. */
export function waitingInVault(index: VaultIndex, bookFolder: string): Waiting[] {
  const dir = bookFolder + '/' + PHONE_FOLDER + '/';
  return Object.values(index.notes)
    .filter((n) => n.type === PHONE_TYPE && n.path.startsWith(dir) && propText(n, 'status') !== 'applied')
    .sort((a, b) => byStart(a.path, b.path))
    .flatMap((n) => readChoices(n.body).filter((c) => !c.result).map((c): Waiting => ({ ...c, book: bookFolder, id: '', note: n.path })));
}

/** A phone note's status read from its whole text (for a note the phone just wrote). */
export const phoneNoteStatus = (text: string) => readNote(text).status;

/** Whether a choice belongs to this chapter: by the chapter's ID when it has one, else by its number. */
export const inChapter = (w: { chapter: number; chapterId: string }, ch: { chapter: number; id: string }): boolean =>
  ch.id ? w.chapterId === ch.id : w.chapter === ch.chapter;

/** The cards of a chapter decided on the phone (used, rejected or tweaked), by card. */
export function decidedOnPhone(list: Waiting[], ch: { chapter: number; id: string }): Map<string, Waiting> {
  const out = new Map<string, Waiting>();
  list.forEach((w) => { if (w.card && w.kind !== 'tell' && inChapter(w, ch)) out.set(w.card, w); });
  return out;
}

/** A scene's page text with one of the phone's choices put in, as the iPad will put it in: the words of a card used or
 * tweaked, or a paragraph rewritten. A choice that does not fit leaves the text as it was, as the iPad skips it. */
export function choiceOnPage(text: string, scene: NoteRecord, chapters: PocketChapter[], w: PhoneChoice): string {
  const sceneId = propText(scene, 'id');
  if (w.kind === 'rewrite') {
    if (w.scene !== sceneId) return text;
    const r = rewriteInto(text, w.was, w.now);
    return r == null ? text : r;
  }
  if (w.kind !== 'use' && w.kind !== 'tweak') return text;
  const ch = chapters.find((c) => inChapter(w, c));
  if (!ch || !ch.note || !ch.scenes.some((s) => s.path === scene.path)) return text;
  const card = parseChanges(ch.note.body).changes.find((c) => c.id === w.card);
  if (!card || card.status !== 'open' || (card.scene && card.scene !== sceneId)) return text;
  const r = applyChange(text, { ...card, now: w.words }, 'now');
  return r ? r.text : text;
}

/** A scene's page text with the phone's card and paragraph choices put in, in order. */
export function phonePage(text: string, scene: NoteRecord, chapters: PocketChapter[], list: Waiting[]): string {
  return list.reduce((t, w) => choiceOnPage(t, scene, chapters, w), text);
}

// ---- Write mode: the chapter by its beats, with the phone's choices in (2026-11-21) ----

/** The beat IDs the iPad changed, from every phone note of the book (phone-choices.ts, withAliases). */
export function phoneAliases(index: VaultIndex, bookFolder: string): Map<string, string> {
  const dir = bookFolder + '/' + PHONE_FOLDER + '/';
  const notes = Object.values(index.notes).filter((n) => n.type === PHONE_TYPE && n.path.startsWith(dir)).sort((a, b) => byStart(a.path, b.path));
  return aliasMap(notes.flatMap((n) => readChoices(n.body).map((c) => c.result)));
}

export interface Replayed {
  /** The chapter's scenes and beats note as they will be once the iPad has put the phone's choices in. */
  text: ChapterText;
  laid: Laid;
  /** Every beat ID change on the way, so a beat is found by an ID it had before. */
  alias: Map<string, string>;
}

/** A chapter as the vault has it, with every phone choice for it put in, in the order made, as the iPad will put them
 * in: cards and paragraphs into the page, and each beat choice as Beats mode makes it (src/lib/phone-beats.ts). */
export function replayChapter(index: VaultIndex, book: BookEntry, ch: PocketChapter, chapters: PocketChapter[], list: PhoneChoice[], alias: Map<string, string>, now: Date): Replayed {
  const note = beatsNoteFor(index.notes, book.folder, ch.chapter);
  let cur: ChapterText = {
    chapter: ch.chapter, beatsPath: note ? note.path : beatsPath(book.folder, ch.chapter), beatsBody: note ? note.body : null,
    scenes: ch.scenes.map((s) => ({ path: s.path, id: propText(s, 'id'), body: s.body }))
  };
  const al = new Map(alias);
  list.filter((w) => inChapter(w, ch)).forEach((w) => {
    if (isBeatKind(w.kind)) {
      const st = beatStep(cur, w, al, book.folder, now);
      st.aliases.forEach(([a, b]) => al.set(a, b));
      if (/^applied/.test(st.result)) cur = st.ch;
      return;
    }
    let done = false;
    const next: ChapterText = {
      ...cur, scenes: cur.scenes.map((s) => {
        const n = ch.scenes.find((x) => x.path === s.path);
        if (!n || done) return s;
        const t = choiceOnPage(pageText(s.body), n, chapters, w);
        if (t === pageText(s.body)) return s;
        if (w.kind === 'use' || w.kind === 'tweak') done = true;
        return { ...s, body: withPageText(s.body, t) };
      })
    };
    if (next.scenes.some((s, i) => s !== cur.scenes[i])) { idChangesBetween(cur, next).forEach(([a, b]) => al.set(a, b)); cur = next; }
  });
  return { text: cur, laid: layOut(cur), alias: al };
}
