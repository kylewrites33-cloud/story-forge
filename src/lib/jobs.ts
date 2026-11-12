// "Ask the team" jobs: Kyle presses a button, the app writes a small job note into the vault's Jobs folder, and the
// always-on runner (the vault's System/Tools/runner.mjs, on the server) runs an agent on it that fills in started,
// finished, cost, result and a ## Result section. The app only writes job notes with status requested, cancels a requested one, and shows the rest.
import { Frontmatter } from './frontmatter.js';
import { idNumber } from './links.ts';
import { safeTitle } from './scenes.ts';
import { kindAsk, kindLabel, kindTitle } from '../team/kinds.ts';
import type { FileEntry, Made, NoteRecord, VaultIndex } from './types.ts';

/** A kind of job: a name from the one list of kinds in the vault's schema (`types.job.kinds`). */
export type JobKind = string;

export const JOB_GROUPS: { key: string; label: string }[] = [
  { key: 'running', label: 'Working on it' },
  { key: 'requested', label: 'Waiting for the team' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Did not finish' },
  { key: 'cancelled', label: 'Cancelled' }
];

/** What each kind of job is called in Kyle's words. Never "lint". From the one list of kinds (src/team/kinds.ts). */
export function jobLabel(kind: unknown): string {
  return kindLabel(kind);
}

/** A status in Kyle's words, for the badge on a job. */
export function jobStatusLabel(status: unknown): string {
  switch (String(status || 'requested')) {
    case 'running': return 'Working';
    case 'done': return 'Done';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
    default: return 'Waiting';
  }
}

export function jobNotes(index: VaultIndex): NoteRecord[] {
  return (index.jobs || []).map((p) => index.notes[p]).filter(Boolean);
}

/** Jobs by status: running, requested, done, failed, cancelled; newest first inside a group (by created, then ID). */
export function jobGroups(notes: NoteRecord[]): { key: string; label: string; notes: NoteRecord[] }[] {
  const created = (n: NoteRecord) => (n.data.created == null ? '' : String(n.data.created));
  const sorted = notes.slice().sort((a, b) => created(b).localeCompare(created(a)) || (idNumber(b.data.id) || 0) - (idNumber(a.data.id) || 0) || b.path.localeCompare(a.path));
  const known = JOB_GROUPS.map((g) => g.key);
  const status = (n: NoteRecord) => { const s = String(n.data.status || 'requested'); return known.indexOf(s) >= 0 ? s : 'requested'; };
  return JOB_GROUPS.map((g) => ({ ...g, notes: sorted.filter((n) => status(n) === g.key) }));
}

/** The next free job ID, the way `sf next-id job` counts the Jobs folder. */
export function nextJobId(files: FileEntry[]): string {
  let max = 0;
  files.forEach((f) => {
    if (!f.path.startsWith('Jobs/')) return;
    const m = /^J-(\d+)/.exec(f.path.slice(f.path.lastIndexOf('/') + 1));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'J-' + String(max + 1).padStart(3, '0');
}

/** What a screen calls to ask the team: the answer is a plain sentence for Kyle, flagged when it is a failure. */
export type OnJob = (j: NewJob) => Promise<{ error: boolean; text: string }>;

export interface NewJob {
  title: string;
  kind: JobKind;
  /** A scene ID for draft and check, "Chapter N" for notes, '' for learn and custom. */
  target: string;
  /** The book's folder, as index.books[].folder. */
  book: string;
  /** Kyle's words for the ## Ask section, or '' for the default sentence. */
  ask: string;
  /** For kind chat: the conversation, a scene ID or chat-NNN (see chat.ts). */
  thread?: string;
  /** Where in the app Kyle was and what was on the screen, for the team to guess what he means (## Page). */
  page?: string;
}

/** The ## Ask for the kinds with fixed instructions: exactly what to do, then Kyle's own words. From the one list of
 * kinds in the vault's schema (src/team/kinds.ts). */
export function jobAsk(kind: JobKind, target: string, words: string): string {
  return kindAsk(kind, target, words);
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function jobText(id: string, j: NewJob, now: Date): string {
  const data: Record<string, unknown> = { type: 'job', id, title: j.title, kind: j.kind };
  if (j.target) data.target = j.target;
  if (j.book) data.book = j.book;
  if (j.thread) data.thread = j.thread;
  data.status = 'requested';
  data.requested_by = 'Kyle';
  data.created = ymd(now);
  const ask = j.ask.trim() || 'Kyle asked for this from the Sparrow app.';
  const page = (j.page || '').trim();
  return Frontmatter.join(data, '## Ask\n' + ask + '\n' + (page ? '\n## Page\n' + page + '\n' : ''));
}

/** The title a job gets when Kyle gives no words: "Draft S-045 Grey at the barn", "Notes on Chapter 30", "Learn from Kyle's edits". */
export function defaultJobTitle(kind: JobKind, target: string, targetTitle = ''): string {
  return kindTitle(kind, target, targetTitle);
}

/** A job of the same kind and target that the team has not finished yet, if there is one. */
export function openJobFor(notes: NoteRecord[], kind: string, target: string): NoteRecord | null {
  return notes.find((n) => {
    const s = String(n.data.status || 'requested');
    return (s === 'requested' || s === 'running') && String(n.data.kind || '') === kind && String(n.data.target || '') === (target || '');
  }) || null;
}

/** A new job note for the vault's Jobs folder, worked out from the files the vault has. It keeps the ID it was first
 * shown with (`keep`) unless another job took that ID meanwhile. It is Kyle's commit (no Agent trailer: the request is his). */
export function planJob(files: FileEntry[], j: NewJob, now: Date, keep = ''): Made {
  const title = safeTitle(j.title);
  if (!title) throw new Error('Give the job a title first.');
  const taken = keep && files.some((f) => {
    const m = f.path.startsWith('Jobs/') ? /^J-(\d+)/.exec(f.path.slice(f.path.lastIndexOf('/') + 1)) : null;
    return Boolean(m) && parseInt(m![1], 10) === idNumber(keep);
  });
  const id = keep && !taken ? keep : nextJobId(files);
  return { id, path: 'Jobs/' + id + ' ' + title + '.md', text: jobText(id, { ...j, title }, now), message: 'jobs: add ' + id + ' ' + title + '\n\nAsked for in the Sparrow app.' };
}

/** "about $0.42", or '' when the runner has not said. */
export function costLabel(v: unknown): string {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  if (!isFinite(n)) return '';
  return n < 0.005 ? 'less than a cent' : 'about $' + n.toFixed(2);
}

/** The ## Result section of a job's body, or '' before the runner has written one. */
export function resultBody(body: string): string {
  const m = /(?:^|\n)## Result\s*\n([\s\S]*)$/.exec(body);
  return m ? m[1].trim() : '';
}

/** The ## Ask section of a job's body: Kyle's words. */
export function askBody(body: string): string {
  const m = /(?:^|\n)## Ask\s*\n([\s\S]*?)(?=\n## |$)/.exec(body);
  return m ? m[1].trim() : body.trim();
}
