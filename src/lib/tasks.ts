// The to-do list: task notes from the vault's Tasks folder and each book's Tasks folder, by status, and new to-dos Kyle
// adds from the app. A status change is an ordinary card edit (the write queue's "edit" choice).
import { Frontmatter } from './frontmatter.js';
import { idNumber } from './links.ts';
import { safeTitle } from './scenes.ts';
import { makeNote } from './vault-index.ts';
import type { FileEntry, NoteRecord, VaultIndex, VaultSource } from './types.ts';

export const TASK_GROUPS: { key: string; label: string }[] = [
  { key: 'doing', label: 'Doing' },
  { key: 'open', label: 'To do' },
  { key: 'done', label: 'Done' },
  { key: 'dropped', label: 'Dropped' }
];

export function taskNotes(index: VaultIndex): NoteRecord[] {
  return (index.tasks || []).map((p) => index.notes[p]).filter(Boolean);
}

/** Tasks by status, each group with due dates first (soonest first), then by ID. */
export function taskGroups(notes: NoteRecord[]): { key: string; label: string; notes: NoteRecord[] }[] {
  const due = (n: NoteRecord) => (n.data.due ? String(n.data.due) : '9999');
  const sorted = notes.slice().sort((a, b) => due(a).localeCompare(due(b)) || (idNumber(a.data.id) || 0) - (idNumber(b.data.id) || 0) || a.path.localeCompare(b.path));
  return TASK_GROUPS.map((g) => ({ ...g, notes: sorted.filter((n) => (String(n.data.status || 'open')) === g.key || (g.key === 'open' && TASK_GROUPS.every((x) => x.key !== String(n.data.status || 'open')))) }));
}

/** The book a task belongs to, from its path, or '' for a vault task. */
export function taskBook(index: VaultIndex, path: string): string {
  const b = index.books.find((x) => path.startsWith(x.folder + '/'));
  return b ? b.title : '';
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** "Due 27 Oct", "Due today", or "Overdue since 20 Oct", from a YYYY-MM-DD date. */
export function dueLabel(due: unknown, now: Date): { text: string; late: boolean } | null {
  const s = due == null ? '' : String(due).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T12:00:00');
  const nice = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const today = ymd(now);
  if (s === today) return { text: 'Due today', late: false };
  return s < today ? { text: 'Overdue since ' + nice, late: true } : { text: 'Due ' + nice, late: false };
}

/** The next free vault task ID, the way `sf next-id task` counts the Tasks folder. */
export function nextTaskId(files: FileEntry[]): string {
  let max = 0;
  files.forEach((f) => {
    if (!f.path.startsWith('Tasks/')) return;
    const m = /^T-(\d+)/.exec(f.path.slice(f.path.lastIndexOf('/') + 1));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'T-' + String(max + 1).padStart(3, '0');
}

export interface NewTask {
  title: string;
  owner: string;
  due: string;
  body: string;
}

export function taskText(id: string, t: NewTask, now: Date): string {
  const data: Record<string, unknown> = { type: 'task', id, title: t.title, owner: t.owner || 'Kyle' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(t.due)) data.due = t.due;
  data.status = 'open';
  data.created = ymd(now);
  const body = t.body.trim() || 'Kyle added this to-do in the Story Forge app.';
  return Frontmatter.join(data, '\n' + body + '\n');
}

/** Add a to-do to the vault's Tasks folder as Kyle's commit. */
export async function createTask(source: VaultSource, t: NewTask, now: Date): Promise<NoteRecord> {
  if (!source.write) throw new Error('This vault cannot be changed from the app.');
  const title = safeTitle(t.title);
  if (!title) throw new Error('Give the to-do a title first.');
  for (let attempt = 0; ; attempt++) {
    const { files } = await source.tree();
    const id = nextTaskId(files);
    const path = 'Tasks/' + id + ' ' + title + '.md';
    const text = taskText(id, { ...t, title }, now);
    try {
      const sha = await source.write(path, text, '', 'tasks: add ' + id + ' ' + title + '\n\nAdded on the To-do list in the Story Forge app.');
      return makeNote(path, sha, text);
    } catch (e) {
      if ((e as { conflict?: boolean }).conflict && attempt < 3) continue;
      throw e;
    }
  }
}
