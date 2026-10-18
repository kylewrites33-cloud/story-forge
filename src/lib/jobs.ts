// "Ask the team" jobs: Kyle presses a button, the app writes a small job note into the vault's Jobs folder, and GitHub
// runs an agent on it (the vault's agent-jobs workflow) that fills in started, finished, cost, result and a ## Result
// section. The app only writes job notes with status requested, cancels a requested one, and shows the rest.
import { Frontmatter } from './frontmatter.js';
import { idNumber } from './links.ts';
import { safeTitle } from './scenes.ts';
import { makeNote } from './vault-index.ts';
import type { FileEntry, NoteRecord, VaultIndex, VaultSource } from './types.ts';

export type JobKind = 'draft' | 'notes' | 'check' | 'learn' | 'chat' | 'rewrite' | 'table-read' | 'ideas' | 'import' | 'chapter-check' | 'todo-review' | 'summaries' | 'beats' | 'custom';

export const JOB_GROUPS: { key: string; label: string }[] = [
  { key: 'running', label: 'Working on it' },
  { key: 'requested', label: 'Waiting for GitHub' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Did not finish' },
  { key: 'cancelled', label: 'Cancelled' }
];

/** What each kind of job is called in Kyle's words. Never "lint". */
export function jobLabel(kind: unknown): string {
  switch (String(kind || '')) {
    case 'draft': return 'Draft this scene';
    case 'notes': return 'Notes on this chapter';
    case 'check': return 'Check for AI-sounding phrases';
    case 'learn': return 'Learn from my edits';
    case 'chat': return 'A question for the team';
    case 'rewrite': return 'Rewrite this card';
    case 'table-read': return 'Table read';
    case 'ideas': return 'More ideas';
    case 'import': return 'Bring in a manuscript';
    case 'chapter-check': return 'Check this chapter for to-dos';
    case 'todo-review': return 'Tick off fixed to-dos';
    case 'summaries': return 'Scene summaries';
    case 'beats': return 'Beats for this chapter';
    default: return 'Ask the team';
  }
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
}

/** The ## Ask for the kinds the runner has no fixed steps for: exactly what to do, then Kyle's own words.
 * The runner gives any such job to the coordinator, who follows this. */
export function jobAsk(kind: JobKind, target: string, words: string): string {
  const his = words.trim() ? '\n\nKyle\'s words: ' + words.trim() : '';
  switch (kind) {
    case 'rewrite':
      return 'Kyle pressed Rewrite on ' + target + ' in the app. Rewrite that note now, as the agent that owns its type would, following the schema\'s `regenerate` convention: read what to change in its `decision_note`, rewrite the note\'s words (never its ID), set `status: inbox` again and keep `decision_note` as a record. If the note is not `regenerate` any more (Kyle changed his mind), change nothing and say so.' + his;
    case 'table-read':
      return 'Run a blind table read of ' + target + ' following `.claude/skills/table-read/SKILL.md`: three Beta Readers, one persona each, reading only the compiled pages of that chapter. File the findings as inbox ideas (kind note) and put the summary in the Result.' + his;
    case 'ideas':
      return 'Kyle wants more ideas for this book. Run a small brainstorm following `.claude/skills/room/SKILL.md` (the Contrarian included) and file the best five to nine as inbox ideas in the book\'s Ideas folder.' + (words.trim() ? ' What they should be about, in his words: ' + words.trim() : ' Pick what the book needs most now, from its stage and its open questions.');
    case 'import':
      return 'Kyle added a manuscript from the app: `' + target + '` in this book. Bring it in following `.claude/skills/import/SKILL.md` (use `System/Tools/sf import` with `--dry-run` first, from the .docx when there is one), as drafted scenes after the book\'s last scene. Never overwrite a scene. Say in the Result how many chapters and scenes came in.' + his;
    case 'chapter-check':
      return 'Check ' + target + ' of this book for problems to fix, following `.claude/skills/chapter-todos/SKILL.md` (Check): a continuity pass, a plot pass and a character pass. File each real problem as one of the chapter\'s to-dos (a task note in the book\'s Tasks folder with `chapter`, `generated: true` and `found_by`). Never change the scenes.' + his;
    case 'todo-review':
      return 'Review the open to-dos of ' + target + ' of this book against its current pages, following `.claude/skills/chapter-todos/SKILL.md` (Review). Mark done only the ones the text now plainly fixes, each with a one-line `done_note`. Leave the rest open, and never touch one Kyle marked done or dropped.' + his;
    case 'beats':
      return 'Write the beats of ' + target + ' of this book, following `.claude/skills/chapter-beats/SKILL.md` as the Story Specialist. '
        + 'A beat is one move of the chapter: a short title and a one-line summary. They go in the book\'s `Chapter Beats/` folder as one `chapter-beats` note for the chapter, never in the scenes. '
        + 'If the chapter has prose, find the beats in it as it stands: each beat starts at a paragraph, and its Starts line names the scene and copies the first words of that paragraph exactly. Never change the prose. '
        + 'If the chapter has no prose yet, plan its beats from what Kyle says the chapter should do, each with a Starts line naming the scene it belongs in and no words. '
        + 'If the chapter already has a beats note, move it to the book\'s Archive folder first with a line saying why (never delete it), then write the new one.'
        + (words.trim() ? '\n\nWhat the chapter should do, in Kyle\'s words: ' + words.trim() : '');
    default:
      return words.trim();
  }
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
  const ask = j.ask.trim() || 'Kyle asked for this from the Story Forge app.';
  return Frontmatter.join(data, '## Ask\n' + ask + '\n');
}

/** The title a job gets when Kyle gives no words: "Draft S-045 Grey at the barn", "Notes on Chapter 30", "Learn from Kyle's edits". */
export function defaultJobTitle(kind: JobKind, target: string, targetTitle = ''): string {
  const what = [target, targetTitle].filter(Boolean).join(' ');
  switch (kind) {
    case 'draft': return 'Draft ' + what;
    case 'notes': return 'Notes on ' + what;
    case 'check': return 'Check ' + what + ' for AI-sounding phrases';
    case 'learn': return "Learn from Kyle's edits";
    case 'rewrite': return 'Rewrite ' + what;
    case 'table-read': return 'Table read of ' + what;
    case 'ideas': return 'More ideas' + (what ? ' for ' + what : '');
    case 'import': return 'Bring in ' + what;
    case 'chapter-check': return 'Check ' + what + ' for to-dos';
    case 'todo-review': return 'Tick off fixed to-dos in ' + what;
    case 'beats': return 'Beats for ' + what;
    default: return 'Ask the team';
  }
}

/** A job of the same kind and target that GitHub has not finished yet, if there is one. */
export function openJobFor(notes: NoteRecord[], kind: string, target: string): NoteRecord | null {
  return notes.find((n) => {
    const s = String(n.data.status || 'requested');
    return (s === 'requested' || s === 'running') && String(n.data.kind || '') === kind && String(n.data.target || '') === (target || '');
  }) || null;
}

/** Write a job note into the vault's Jobs folder as Kyle's commit (no Agent trailer: the request is his). */
export async function createJob(source: VaultSource, j: NewJob, now: Date): Promise<NoteRecord> {
  if (!source.write) throw new Error('This vault cannot be changed from the app.');
  const title = safeTitle(j.title);
  if (!title) throw new Error('Give the job a title first.');
  for (let attempt = 0; ; attempt++) {
    const { files } = await source.tree();
    const id = nextJobId(files);
    const path = 'Jobs/' + id + ' ' + title + '.md';
    const text = jobText(id, { ...j, title }, now);
    try {
      const sha = await source.write(path, text, '', 'jobs: add ' + id + ' ' + title + '\n\nAsked for in the Story Forge app.');
      return makeNote(path, sha, text);
    } catch (e) {
      if ((e as { conflict?: boolean }).conflict && attempt < 3) continue;
      throw e;
    }
  }
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
