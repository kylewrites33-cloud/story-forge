// Small changes to one note's text, kept as what Kyle meant so they can wait on the device and be made again on a
// newer version of the note: a tick on the Chapter titles page, a chapter marked through in the Rewrite tab, a
// recipe's words. Like every edit there are two forms that must agree (a test holds them to it): to the note as the
// screens hold it, and to the note's text as the vault has it, changing only the lines the change touches.
import { editRecipeText } from '../lib/recipes.ts';
import { rewriteDone, withRewriteDone } from '../lib/rewrite.ts';
import { addOwn, NONE, setPick } from '../lib/titles.ts';
import { addWorkflowNote } from '../lib/workflow.ts';
import type { NoteRecord } from '../lib/types.ts';

export type TextChange =
  /** The Chapter titles page: a title option ticked or unticked for a chapter (`title` can be "None of these"). */
  | { what: 'title-pick'; chapter: number; title: string; on: boolean }
  /** The Chapter titles page: a title Kyle wrote himself for a chapter. */
  | { what: 'title-own'; chapter: number; title: string }
  /** The Rewrite tab: Kyle is through with a chapter, or opened it again (the book note's `rewrite_done`). */
  | { what: 'through'; chapter: number; done: boolean }
  /** A recipe's "use for" line and its instruction. */
  | { what: 'recipe'; use_for: string; body: string }
  /** One more dated line under "Kyle's notes" at the end of the workflow (`day` is the day he wrote it, his time). */
  | { what: 'workflow-note'; note: string; day: string };

export function validChange(c: unknown): c is TextChange {
  const x = c as TextChange;
  if (!x || typeof x !== 'object') return false;
  if (x.what === 'title-pick') return Number.isInteger(x.chapter) && typeof x.title === 'string' && typeof x.on === 'boolean';
  if (x.what === 'title-own') return Number.isInteger(x.chapter) && typeof x.title === 'string';
  if (x.what === 'through') return Number.isInteger(x.chapter) && typeof x.done === 'boolean';
  if (x.what === 'workflow-note') return typeof x.note === 'string' && typeof x.day === 'string';
  return x.what === 'recipe' && typeof x.use_for === 'string' && typeof x.body === 'string';
}

/** The note's text with the change made. Every line the change does not touch stays as it was. */
export function changeText(text: string, c: TextChange): string {
  if (c.what === 'title-pick') return setPick(text, c.chapter, c.title, c.on);
  if (c.what === 'title-own') return addOwn(text, c.chapter, c.title);
  if (c.what === 'through') return withRewriteDone(text, c.chapter, c.done);
  if (c.what === 'workflow-note') return addWorkflowNote(text, c.note, c.day);
  return editRecipeText(text, c.use_for, c.body);
}

/** The note as the screens should show it once the change is in. */
export function changeRecord(note: NoteRecord, c: TextChange): NoteRecord {
  if (c.what === 'title-pick') return { ...note, body: setPick(note.body, c.chapter, c.title, c.on) };
  if (c.what === 'title-own') return { ...note, body: addOwn(note.body, c.chapter, c.title) };
  // The workflow is held as text, not as a note (apply.ts changes that text); this form is here for completeness.
  if (c.what === 'workflow-note') return { ...note, body: addWorkflowNote(note.body, c.note, c.day) };
  if (c.what === 'through') {
    const now = rewriteDone(note);
    const next = (c.done ? now.concat(now.indexOf(c.chapter) < 0 ? [c.chapter] : []) : now.filter((n) => n !== c.chapter)).sort((a, b) => a - b);
    const data = { ...note.data };
    if (next.length) data.rewrite_done = next; else delete data.rewrite_done;
    return { ...note, data };
  }
  const data = { ...note.data };
  const u = c.use_for.trim().replace(/\s+/g, ' ');
  if (u) data.use_for = u; else delete data.use_for;
  return { ...note, data, body: c.body.trim() === note.body.trim() ? note.body : '\n' + c.body.trim() + '\n' };
}

/** The line the change leaves in the vault's history. No Agent trailer: it is Kyle's. */
export function changeMessage(text: string, c: TextChange, path: string): string {
  if (c.what === 'title-pick') return 'titles: Kyle ' + (c.on ? 'picked ' : 'unticked ') + (c.title === NONE ? 'None of these' : '"' + c.title + '"') + ' for chapter ' + c.chapter + '\n\nChosen in the Sparrow app.';
  if (c.what === 'title-own') return 'titles: Kyle wrote "' + c.title + '" for chapter ' + c.chapter + '\n\nChosen in the Sparrow app.';
  if (c.what === 'through') return 'rewrite: chapter ' + c.chapter + (c.done ? ' through' : ' opened again') + ' in the Rewrite tab';
  if (c.what === 'workflow-note') return 'workflow: Kyle\'s note';
  const m = /^title:[ \t]*(.*)$/m.exec(text);
  const name = (m ? m[1].trim().replace(/^["']|["']$/g, '') : '') || path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
  return 'recipes: edit ' + name + '\n\nEdited in the Sparrow app.';
}
