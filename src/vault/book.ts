// Saves that take in a whole book and have nothing to do with chapter numbers: the book's draft saved (every scene
// copied to `Drafts/Draft N/`), and a scene brought back from the book's Archive. Each is one save, made on the vault
// as it is at that moment.
import { bodyWords } from '../lib/drafts.ts';
import { DRAFTS_FOLDER, draftNoteText, savedDrafts, workingNumber } from '../lib/bookdrafts.ts';
import { unarchivedText } from '../lib/scenes.ts';
import type { NoteRecord } from '../lib/types.ts';
import { bookNotes } from './chapters.ts';
import type { Tree } from './tree.ts';

const fileName = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/** Save the book's draft (Kyle, 2026-10-24: "i see value in at least labeling and keeping draft 1 accessible"): every
 * scene as the save sees it is copied into `Drafts/Draft N/` with the `Draft N.md` note beside it, N the next number
 * no saved draft has. The copies never change afterwards; the scene files go on as the next draft. Throws a plain
 * sentence when the book has no scenes. */
export async function planDraft(tree: Tree, book: string, at: Date, note = '', known: Record<string, NoteRecord> = {}): Promise<{ message: string; number: number }> {
  const { files, scenes } = await bookNotes(tree, book, known);
  if (!scenes.length) throw new Error('This book has no scenes yet, so there is no draft to save.');
  const number = workingNumber(savedDrafts(files, book));
  const dir = book + '/' + DRAFTS_FOLDER + '/Draft ' + number;
  await tree.readMany(scenes.map((n) => n.path));
  let words = 0, copied = 0;
  for (const s of scenes) {
    const text = await tree.read(s.path);
    if (text == null) continue;
    tree.write(dir + '/' + fileName(s.path), text);
    words += bodyWords(s.body);
    copied++;
  }
  tree.write(book + '/' + DRAFTS_FOLDER + '/Draft ' + number + '.md', draftNoteText(number, copied, words, at, note));
  return {
    number,
    message: 'drafts: save Draft ' + number + ' of ' + fileName(book) + ' (' + copied + ' scenes)\n\nSaved in the Sparrow app; the scene files are now Draft ' + (number + 1) + '.'
  };
}

/** Put an archived scene back in the book's Scenes folder, without the line that said why it was archived, and take
 * its copy out of the Archive: one save, so the scene is never in both places or in neither. Its ID and order are as
 * they were, so it comes back where it stood. Throws a plain sentence when it cannot come back. */
export async function planRestore(tree: Tree, path: string, book: string): Promise<{ message: string; to: string }> {
  const name = fileName(path).replace(/\.md$/, '');
  const text = await tree.read(path);
  if (text == null) throw new Error(name + ' is not in the Archive any more. Press Sync and look again.');
  const to = book + '/Scenes/' + fileName(path);
  if ((await tree.files()).some((f) => f.path.toLowerCase() === to.toLowerCase())) throw new Error('A scene called ' + name + ' is already in Scenes, so this one stays in the Archive.');
  tree.write(to, unarchivedText(text));
  tree.remove(path);
  return { to, message: 'scenes: restore ' + name + '\n\nRestored from the book\'s Archive in the Sparrow app. It is in Scenes again and its archived copy is gone, in one save.' };
}
