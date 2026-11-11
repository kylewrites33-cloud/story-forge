// What a waiting change does to a note. There are two forms and they must agree (a test holds them to it):
// to the note as the screens hold it (properties and body), so Kyle sees his change at once, and to the note's text as
// the vault has it, changing only the lines the change touches, for the save.
import { applyToData, applyToText, commitMessage } from '../lib/ideas.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { resortScenes } from '../lib/vault-index.ts';
import { changeOf } from '../lib/write-queue.ts';
import type { NoteRecord, VaultIndex } from '../lib/types.ts';
import type { Action, Edit } from './ops.ts';

/** The note as the screens should show it once this edit is in. */
export function editRecord(note: NoteRecord, edit: Edit): NoteRecord {
  return { ...note, data: applyToData(note.data, changeOf(note.data, edit.choice)) };
}

/** The note's text with this edit made. Every line the edit does not touch stays as it was. */
export function editText(text: string, edit: Edit): string {
  const data = Frontmatter.parse(text).data || {};
  return applyToText(text, changeOf(data, edit.choice));
}

/** The line this edit leaves in the vault's history, from the note as it was before the edit. No Agent trailer: it is Kyle's. */
export function editMessage(text: string, edit: Edit): string {
  const data = Frontmatter.parse(text).data || {};
  return commitMessage(data, edit.choice.decision, edit.choice.fields);
}

/** Does this edit change where a scene sits in its book? */
function reorders(edit: Edit): boolean {
  return edit.choice.decision === 'move';
}

/** The vault as Kyle should see it: every waiting action already applied, in the order he made them. */
export function overlayActions(index: VaultIndex, actions: Action[]): VaultIndex {
  if (!actions.length) return index;
  const notes = { ...index.notes };
  let sort = false;
  actions.forEach((a) => a.ops.forEach((op) => {
    const n = notes[op.path];
    if (!n) return;
    notes[op.path] = editRecord(n, op.edit);
    if (reorders(op.edit)) sort = true;
  }));
  const out = { ...index, notes };
  return sort ? resortScenes(out) : out;
}
