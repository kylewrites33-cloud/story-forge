// The one place Sparrow Pocket writes to the vault (2026-11-21): its own phone note in the book's Phone/ folder, and
// nothing else. A test holds this (tests/pocket-wall.test.ts): no other file of Pocket's saves, and every save from here
// writes one file under Phone/. The format is src/lib/phone-choices.ts; the iPad puts the choices in (src/vault/phone.ts).
//
// The phone adds to its note only while the note still says `sent` and no choice on it has a result. Once an iPad has
// started on it (`applying`) or written any result, the phone starts a new note, so the two never write the same
// choice. Each save reads the note as the vault has it at that moment, and runs again if the vault moved meanwhile.
import { appendChoices, newNoteText, notePath, noteTitle, PHONE_FOLDER, PHONE_TYPE, readNote, removeChoice, type PhoneChoice } from '../lib/phone-choices.ts';
import type { CommitPlan, Head, VaultSource } from '../lib/types.ts';

/** Every path Pocket writes must be a phone note of a book. */
function phoneOnly(plan: CommitPlan): CommitPlan {
  plan.writes.forEach((w) => {
    if (!/\/Phone\/[^/]+\.md$/.test(w.path) || w.path.indexOf('/' + PHONE_FOLDER + '/') < 0) throw new Error('Sparrow Pocket only writes its own phone notes.');
  });
  if ((plan.removes && plan.removes.length) || (plan.blobs && plan.blobs.length)) throw new Error('Sparrow Pocket only writes its own phone notes.');
  return plan;
}

const countOf = (n: number) => n + (n === 1 ? ' choice' : ' choices');

/** Put these choices on the book's phone note: the one the phone is adding to, while it may, else a new one. Answers
 * the note's path, each choice's number on it, and the note's text as written. */
export async function sendChoices(source: VaultSource, bookFolder: string, bookTitle: string, own: string, choices: PhoneChoice[], now: Date): Promise<{ path: string; numbers: number[]; text: string }> {
  if (!source.commit) throw new Error('This vault cannot be changed from here.');
  let path = '', numbers: number[] = [], written = '';
  await source.commit(async (head: Head) => {
    // Only a phone note of this book is ever added to.
    const mine = own && own.startsWith(bookFolder + '/' + PHONE_FOLDER + '/') ? await head.read(own) : null;
    const open = mine ? readNote(mine.text) : null;
    if (mine && open && open.type === PHONE_TYPE && open.status === 'sent' && open.choices.every((c) => !c.result)) {
      const start = open.choices.reduce((m, c) => Math.max(m, c.n), 0) + 1;
      numbers = choices.map((_, i) => start + i);
      path = own;
      const text = written = appendChoices(mine.text, choices.map((c, i) => ({ ...c, n: numbers[i], result: '' })));
      return phoneOnly({ message: 'phone: ' + countOf(choices.length) + ' from Kyle\'s phone' + (bookTitle ? ' for ' + bookTitle : '') + '\n\nRecorded in Sparrow Pocket. Sparrow puts them in when the book is opened.', writes: [{ path, text }] });
    }
    let title = noteTitle(now);
    path = notePath(bookFolder, title);
    for (let k = 2; await head.read(path); k++) { title = noteTitle(now) + ' (' + k + ')'; path = notePath(bookFolder, title); }
    numbers = choices.map((_, i) => i + 1);
    const text = written = newNoteText(title, now.toISOString(), choices.map((c, i) => ({ ...c, n: numbers[i], result: '' })));
    return phoneOnly({ message: 'phone: ' + countOf(choices.length) + ' from Kyle\'s phone' + (bookTitle ? ' for ' + bookTitle : '') + '\n\nRecorded in Sparrow Pocket. Sparrow puts them in when the book is opened.', writes: [{ path, text }] });
  });
  return { path, numbers, text: written };
}

/** Take one choice off a phone note (Undo on the phone), only while the note still says `sent` and that choice has no
 * result. Answers false when it is too late: an iPad has started on the note. */
export async function withdrawChoice(source: VaultSource, path: string, n: number): Promise<boolean> {
  if (!source.commit) return false;
  let ok = false;
  await source.commit(async (head: Head) => {
    ok = false;
    const now = await head.read(path);
    if (!now) return null;
    const note = readNote(now.text);
    const c = note.choices.find((x) => x.n === n);
    if (!c) { ok = true; return null; }
    if (note.status !== 'sent' || c.result) return null;
    ok = true;
    return phoneOnly({ message: 'phone: Kyle took back a choice on his phone\n\nTaken off in Sparrow Pocket before the iPad put it in.', writes: [{ path, text: removeChoice(now.text, n) }] });
  });
  return ok;
}
