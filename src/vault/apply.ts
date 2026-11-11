// What a waiting change does to a note. There are two forms and they must agree (a test holds them to it):
// to the note as the screens hold it (properties and body), so Kyle sees his change at once, and to the note's text as
// the vault has it, changing only the lines the change touches, for the save.
import { marksMessage, setStatuses } from '../lib/changes.ts';
import { applyToData, applyToText, commitMessage } from '../lib/ideas.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { PHASE } from '../lib/sync.ts';
import { archiveFiles, assemble, makeNote, resortScenes, selectFiles } from '../lib/vault-index.ts';
import { changeOf } from '../lib/write-queue.ts';
import type { NoteRecord, Schema, VaultIndex } from '../lib/types.ts';
import type { Action, Edit } from './ops.ts';
import { changeMessage, changeRecord, changeText, startsNote } from './text.ts';

/** The note as the screens should show it once this edit is in. */
export function editRecord(note: NoteRecord, edit: Edit): NoteRecord {
  if (edit.type === 'marks') return { ...note, body: setStatuses(note.body, edit.marks) };
  if (edit.type === 'text') return changeRecord(note, edit.change);
  return { ...note, data: applyToData(note.data, changeOf(note.data, edit.choice)) };
}

/** The note's text with this edit made. Every line the edit does not touch stays as it was. */
export function editText(text: string, edit: Edit): string {
  if (edit.type === 'marks') return setStatuses(text, edit.marks);
  if (edit.type === 'text') return changeText(text, edit.change);
  const data = Frontmatter.parse(text).data || {};
  return applyToText(text, changeOf(data, edit.choice));
}

/** The line this edit leaves in the vault's history, from the note as it was before the edit. No Agent trailer: it is Kyle's. */
export function editMessage(text: string, edit: Edit, path: string): string {
  if (edit.type === 'marks') {
    // Only the answers that are new to the note are named: one an earlier save already put there changes nothing.
    const fresh: typeof edit.marks = {};
    Object.keys(edit.marks).forEach((id) => { if (setStatuses(text, { [id]: edit.marks[id] }) !== text) fresh[id] = edit.marks[id]; });
    return marksMessage(path, Object.keys(fresh).length ? fresh : edit.marks);
  }
  if (edit.type === 'text') return changeMessage(text, edit.change, path);
  const data = Frontmatter.parse(text).data || {};
  return commitMessage(data, edit.choice.decision, edit.choice.fields);
}

/** Does this edit change where a scene sits in its book? */
function reorders(edit: Edit): boolean {
  return edit.type === 'choice' && edit.choice.decision === 'move';
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
  let team: VaultIndex['team'] | null = null;
  actions.forEach((a) => a.ops.forEach((op) => {
    if (op.kind === 'create') {
      if (!notes[op.path]) { notes[op.path] = makeNote(op.path, '', op.text); added = true; }
      return;
    }
    if (op.kind === 'retitle') {
      // The new title shows at once; the file keeps its name until the save moves it.
      const n = notes[op.path];
      if (n) notes[op.path] = { ...n, data: { ...n.data, title: op.title } };
      return;
    }
    // A change to chapter numbers and a file from the device never wait (ops.ts), so there is none to show here.
    if (op.kind !== 'edit') return;
    // A file the app holds as text and not as a note (the workflow): the text itself takes the change.
    const held = (team || index.team || {})[op.path];
    if (held) { team = { ...(team || index.team), [op.path]: { sha: held.sha, text: editText(held.text, op.edit) } }; return; }
    const n = notes[op.path];
    if (!n) {
      // A day of the Writing Log that is not there yet starts with its first Pomodoro or its first words.
      if (op.edit.type === 'text' && startsNote(op.edit.change)) { notes[op.path] = makeNote(op.path, '', editText('', op.edit)); added = true; }
      return;
    }
    notes[op.path] = editRecord(n, op.edit);
    if (reorders(op.edit)) sort = true;
  }));
  const base = team ? { ...index, team } : index;
  if (added && schema) return withNotes(base, schema, notes);
  const out = { ...base, notes };
  return sort ? resortScenes(out) : out;
}

/** The saved copy with notes the app just saved put in, and files a save took out (a note that got a new file name
 * leaves its old one) taken out. A note that is new to it is put where its kind goes. A save can also touch files the
 * saved copy holds no note for (a deleted scene's copy in the Archive, the Chapter Titles note): those stay out of the
 * notes, and a scene that went to a book's Archive joins that book's archive list, where Restore finds it. */
export function foldSaved(index: VaultIndex, saved: NoteRecord[], schema?: Schema | null, removed: string[] = [], texts: Record<string, { sha: string; text: string }> = {}): VaultIndex {
  // The files the app holds as text (the team's, the workflow) take the save's text; they are never among the notes.
  const held = Object.keys(texts);
  if (held.length) {
    index = { ...index, team: { ...(index.team || {}), ...texts } };
    saved = saved.filter((n) => !texts[n.path]);
  }
  if (!saved.length && !removed.length) return index;
  const notes = { ...index.notes };
  let reshaped = false;
  removed.forEach((p) => { if (notes[p]) { delete notes[p]; reshaped = true; } });
  const files = saved.map((n) => ({ path: n.path, sha: n.sha }));
  const read = schema ? new Set(selectFiles(schema, files, PHASE).map((f) => f.path)) : null;
  saved.forEach((n) => {
    if (!notes[n.path]) { if (read && !read.has(n.path)) return; reshaped = true; }
    notes[n.path] = n;
  });
  const out = reshaped && schema ? withNotes(index, schema, notes) : resortScenes({ ...index, notes });
  const books = out.books.map((b) => {
    const add = archiveFiles(files, b.folder);
    const had = b.archive || [];
    if (!add.length && !had.some((f) => removed.indexOf(f.path) >= 0)) return b;
    const archive = had.filter((f) => removed.indexOf(f.path) < 0 && !add.some((a) => a.path === f.path)).concat(add).sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
    return { ...b, archive };
  });
  return books.some((b, i) => b !== out.books[i]) ? { ...out, books } : out;
}
