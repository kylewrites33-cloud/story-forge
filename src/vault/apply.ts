// What a waiting change does to a note. There are two forms and they must agree (a test holds them to it):
// to the note as the screens hold it (properties and body), so Kyle sees his change at once, and to the note's text as
// the vault has it, changing only the lines the change touches, for the save.
import { applyToData, applyToText, commitMessage } from '../lib/ideas.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { PHASE } from '../lib/sync.ts';
import { assemble, makeNote, resortScenes } from '../lib/vault-index.ts';
import { changeOf } from '../lib/write-queue.ts';
import type { NoteRecord, Schema, VaultIndex } from '../lib/types.ts';
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

/** The index with these notes in it, when some of them are new to it: every list of notes (a book's scenes, the
 * to-dos, the jobs) is worked out again the way a sync does it. What a sync learns from the vault's other files (covers,
 * saved drafts, the archive, Rocket files, the team's files) is carried over as it was. */
export function withNotes(index: VaultIndex, schema: Schema, notes: Record<string, NoteRecord>): VaultIndex {
  const out = assemble(schema, Object.keys(notes).map((p) => notes[p]), PHASE);
  out.series.forEach((s) => { const was = index.series.find((x) => x.folder === s.folder); if (was) s.rocket = was.rocket; });
  out.books.forEach((b) => {
    const was = index.books.find((x) => x.folder === b.folder);
    if (was) { b.cover = was.cover; b.archive = was.archive; b.drafts = was.drafts; b.rewrite = was.rewrite; }
  });
  out.team = index.team;
  // The one warning that comes from the file list and not from the notes.
  out.warnings.unshift(...index.warnings.filter((w) => w.startsWith('The vault has more files')));
  return out;
}

/** The vault as Kyle should see it: every waiting action already applied, in the order he made them. New notes need
 * the schema, to be put where their kind goes. */
export function overlayActions(index: VaultIndex, actions: Action[], schema?: Schema | null): VaultIndex {
  if (!actions.length) return index;
  const notes = { ...index.notes };
  let sort = false, added = false;
  actions.forEach((a) => a.ops.forEach((op) => {
    if (op.kind === 'create') {
      if (!notes[op.path]) { notes[op.path] = makeNote(op.path, '', op.text); added = true; }
      return;
    }
    const n = notes[op.path];
    if (!n) return;
    notes[op.path] = editRecord(n, op.edit);
    if (reorders(op.edit)) sort = true;
  }));
  if (added && schema) return withNotes(index, schema, notes);
  const out = { ...index, notes };
  return sort ? resortScenes(out) : out;
}

/** The saved copy with notes the app just saved put in. A note that is new to it is put where its kind goes. */
export function foldSaved(index: VaultIndex, saved: NoteRecord[], schema?: Schema | null): VaultIndex {
  if (!saved.length) return index;
  const notes = { ...index.notes };
  let added = false;
  saved.forEach((n) => { if (!notes[n.path]) added = true; notes[n.path] = n; });
  return added && schema ? withNotes(index, schema, notes) : resortScenes({ ...index, notes });
}
