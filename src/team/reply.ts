// Reply to the Writer on a change card (Kyle, 2026-11-12: "i need to be able to reply within the changes, to explain to
// the writer why i made a choice, and for the writer to create a new card based on my reply"), as one action: the
// `Reply:` line under the card in the chapter's changes note, and the ask for a new card (job kind `reply`, target
// "Chapter N"). One ask a chapter answers every reply in it, so a reply sent while the chapter's ask still waits for the
// team adds no second ask. Moved here from the app's frame (src/ui/App.tsx) on 2026-11-20 so the writing page and
// Sparrow Pocket save exactly the same thing.
import { defaultJobTitle, jobAsk, jobNotes } from '../lib/jobs.ts';
import type { VaultIndex } from '../lib/types.ts';
import { overlayActions } from '../vault/apply.ts';
import { createAction, knownFiles, textAction, type Action } from '../vault/ops.ts';
import type { Schema } from '../lib/types.ts';
import { openAsk } from './asks.ts';

/** The ask a reply on a card in this chapter goes with: the chapter's reply ask the team has not started yet. */
export function replyTarget(chapter: number): string {
  return 'Chapter ' + chapter;
}

/** Kyle's reply on card `id` of the changes note at `path` (chapter `chapter` of `book`), as one action. `index` is the
 * saved copy and `waiting` the outbox, as the device has them. Throws a plain sentence when there is nothing to send. */
export function replyAction(index: VaultIndex, waiting: Action[], schema: Schema | null, path: string, id: string, words: string, book: string, chapter: number, now: Date = new Date()): Action {
  const said = words.trim();
  if (!said) throw new Error('Write your reply first.');
  const target = replyTarget(chapter);
  const open = openAsk(jobNotes(overlayActions(index, waiting, schema)), { kind: 'reply', target, book });
  const waits = open && String(open.data.status || 'requested') === 'requested';
  const also = waits ? [] : createAction('job', {
    j: { title: defaultJobTitle('reply', target), kind: 'reply', target, book, ask: jobAsk('reply', target, id + ': "' + said.replace(/\s+/g, ' ') + '"') },
    at: now.toISOString()
  }, knownFiles(index, waiting), now).ops;
  return textAction([{ path, change: { what: 'change-reply', id, words: said } }], also, now);
}
