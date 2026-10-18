// What Kyle is looking at when he chats from the team column beside a board or page (Kyle, 2026-10-18: "when i chat,
// they'll have the context of what page im in to guess the general range of topics to discuss"). The app writes it
// into the chat job's ## Page section: the page's name, the book, and the notes on screen (ID, title, status, path),
// kept short so it never crowds out his words.
import type { BookEntry, NoteRecord } from './types.ts';

export interface PageView {
  /** Where Kyle is, as a sentence ends: "the Ideas board", "the To-do list", "a note". */
  name: string;
  /** The book on screen (or the active one). */
  book?: BookEntry | null;
  /** The notes the page shows, in the order it shows them. */
  notes?: NoteRecord[];
  /** Anything else worth a line: the note open, the team member, the series. */
  lines?: string[];
}

const MAX = 1600;

const one = (v: unknown) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());

/** One note as a line: its ID, title, status and where it is, so the team can open it. */
export function noteLine(n: NoteRecord): string {
  const d = n.data;
  const id = one(d.id), title = one(d.title) || one(d.name) || n.path.split('/').pop()!.replace(/\.md$/, '');
  const bits = [one(d.status), d.chapter != null && d.chapter !== '' ? 'chapter ' + one(d.chapter) : ''].filter(Boolean);
  return '- ' + (id && title.indexOf(id) !== 0 ? id + ' ' : '') + title + (bits.length ? ' (' + bits.join(', ') + ')' : '') + ': `' + n.path + '`';
}

/** The ## Page text for a chat sent from this page. */
export function pageContext(v: PageView): string {
  const L = ['Kyle sent this from ' + v.name + ' in the Story Forge app. Guess from it what he most likely wants to talk about.'];
  if (v.book) L.push('Book: ' + v.book.title + ' (' + v.book.seriesName + (v.book.number != null ? ', Book ' + v.book.number : '') + '), `' + v.book.folder + '`');
  (v.lines || []).filter(Boolean).forEach((l) => L.push(l));
  const notes = v.notes || [];
  if (notes.length) {
    L.push('On screen (' + notes.length + (notes.length === 1 ? ' note' : ' notes') + '):');
    let used = L.join('\n').length;
    let shown = 0;
    for (const n of notes) {
      const line = noteLine(n);
      if (used + line.length + 1 > MAX - 40) break;
      L.push(line);
      used += line.length + 1;
      shown++;
    }
    if (shown < notes.length) L.push('…and ' + (notes.length - shown) + ' more.');
  }
  return L.join('\n');
}
