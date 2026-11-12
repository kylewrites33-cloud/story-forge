// The one way to ask the team (2026-11-12, step 4 of the code structure redesign). An ask is a job note in the vault's
// Jobs folder (src/lib/jobs.ts writes it, the runner answers it). This file is what every team feature reads it with:
// where an ask stands, and which of its answers Kyle has already used. "Used" is written on the job note itself
// (`taken`), through the saving system, so the iPad and the desktop agree; before, each device kept its own list and
// guessed about the other from an answer's age.
import { Frontmatter } from '../lib/frontmatter.js';
import type { NoteRecord } from '../lib/types.ts';
import { propText } from '../lib/props.ts';

/** Where an ask stands. `answered`: the team finished and at least one answer is not used yet. `taken`: finished, and
 * every answer the feature names is used (or Kyle put it away). */
export type AskState = 'requested' | 'running' | 'answered' | 'taken' | 'failed' | 'cancelled';

/** The name that stands for an ask as a whole, for asks with one answer (Options: Kyle picked one, or put them away). */
export const WHOLE = 'all';

type Job = { data: Record<string, unknown> };

/** The team has it and has not finished. */
export function waiting(job: Job): boolean {
  const s = String(job.data.status || 'requested');
  return s === 'requested' || s === 'running';
}

/** The answers of this ask Kyle has used, by name ("B1" for a brace; `WHOLE` for the ask as a whole). */
export function takenNames(job: Job | null | undefined): string[] {
  const v = job ? job.data.taken : null;
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  return list.map((x) => String(x).trim()).filter((x, i, a) => x && a.indexOf(x) === i);
}

export function isTaken(job: Job, name: string = WHOLE): boolean {
  const t = takenNames(job);
  return t.indexOf(name) >= 0 || t.indexOf(WHOLE) >= 0;
}

/** Where the ask stands. `names` are the answers the feature expects from it (a fill job's braces); with none, the ask
 * is one answer. */
export function askState(job: Job, names: string[] = []): AskState {
  const s = String(job.data.status || 'requested');
  if (s === 'running' || s === 'failed' || s === 'cancelled') return s;
  if (s !== 'done') return 'requested';
  return (names.length ? names.every((n) => isTaken(job, n)) : isTaken(job)) ? 'taken' : 'answered';
}

/** A job note's text with these answers marked used as well as the ones it has, every other line as it was. */
export function withTaken(text: string, names: string[]): string {
  const parsed = Frontmatter.parse(text);
  const s = Frontmatter.split(text);
  if (parsed.error || !s.hasFm) throw new Error('The team\'s answer cannot be marked as used, because its note\'s properties cannot be read. Ask the team to fix it.');
  const next = takenNames({ data: (parsed.data || {}) as Record<string, unknown> }).concat(names).map((n) => n.trim()).filter((n, i, a) => /^[A-Za-z0-9_-]+$/.test(n) && a.indexOf(n) === i);
  const eol = s.yaml && s.yaml.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const lines = s.yaml ? s.yaml.split(/\r?\n/) : [];
  let at = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!/^taken[ \t]*:/.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && (/^[ \t]+\S/.test(lines[j]) || /^-([ \t]|$)/.test(lines[j]))) j++;
    lines.splice(i, j - i);
    at = i;
    break;
  }
  if (next.length) lines.splice(at < 0 ? lines.length : at, 0, 'taken: [' + (next.indexOf(WHOLE) >= 0 ? [WHOLE] : next).join(', ') + ']');
  return s.open + lines.join(eol) + s.close + s.body;
}

/** The note as the screens hold it, with these answers marked used. */
export function takenRecord(note: NoteRecord, names: string[]): NoteRecord {
  const next = takenNames(note).concat(names).filter((n, i, a) => /^[A-Za-z0-9_-]+$/.test(n) && a.indexOf(n) === i);
  return next.length ? { ...note, data: { ...note.data, taken: next.indexOf(WHOLE) >= 0 ? [WHOLE] : next } } : note;
}

/** Answers Kyle used, by job note: what a page hands the app to save. */
export interface Take { path: string; names: string[] }
export type OnTake = (takes: Take[]) => void;

// ---- Finding a feature's ask, and what to say when it went wrong ----

/** What a feature asks about: a kind of job, and where it matters the target and the book. */
export interface AskOf { kind: string; target?: string; book?: string }

const num = (j: Job) => { const m = /(\d+)/.exec(propText(j, 'id')); return m ? parseInt(m[1], 10) : 0; };

/** A feature's ask: the one the team still has, or else the newest of that kind about that target in that book. Null
 * when it never asked. Beats, Changes and the workflow steps find theirs with this. */
export function askFor<T extends Job>(jobs: T[], of: AskOf): T | null {
  const mine = jobs.filter((j) => propText(j, 'kind') === of.kind
    && (of.target == null || propText(j, 'target') === of.target)
    && (of.book == null || propText(j, 'book') === of.book));
  const newest = (list: T[]) => list.reduce<T | null>((a, b) => (a && num(a) >= num(b) ? a : b), null);
  return newest(mine.filter(waiting)) || newest(mine);
}

/** The feature's ask while the team still has it, or null. */
export function openAsk<T extends Job>(jobs: T[], of: AskOf): T | null {
  const j = askFor(jobs, of);
  return j && waiting(j) ? j : null;
}

/** The one sentence for an ask the team could not finish, with what the team said about it. */
export function askProblem(job: Job): string {
  const said = propText(job, 'result').trim();
  return 'The team could not finish this.' + (said ? ' ' + said + (/[.!?…]$/.test(said) ? '' : '.') : '') + ' Ask again when you are ready; the Jobs page has the details.';
}

/** How long a page goes on saying that its ask failed, when Kyle has not asked again. */
export const FAILED_SHOWS_FOR = 24 * 60 * 60 * 1000;

/** The sentence for a feature's ask that failed in the last day, or '' (it worked, it is still running, it failed long
 * ago, or there is none). A page shows this where its ask button is. */
export function recentProblem(job: Job | null | undefined, now = Date.now()): string {
  if (!job || propText(job, 'status') !== 'failed') return '';
  // `created` is a day with no time, so an ask with no finish time counts from the end of that day.
  const t = job.data.finished ? Date.parse(String(job.data.finished)) : Date.parse(propText(job, 'created')) + FAILED_SHOWS_FOR;
  return isFinite(t) && now - t < FAILED_SHOWS_FOR ? askProblem(job) : '';
}

// ---- The one watcher ----
// While the team has any ask, the app reads the vault again every 15 seconds, on whatever page Kyle is, so the answer
// shows up where he asked for it. Before, each page said which of its own asks counted, and pages that said nothing
// (Beats, Changes, the workflow steps) waited for the next ordinary read.

/** Seconds between the watcher's looks. */
export const WATCH_EVERY = 15;
/** The one timeout rule: after this long with the same asks open and nothing moving, the watcher slows to once a
 * minute (the team's computer may be off), and speeds up again as soon as any ask starts, finishes or is added. */
export const WATCH_SLOWS_AFTER = 20 * 60 * 1000;

/** What the watcher remembers between looks: which asks were open, and since when nothing about them has changed. */
export interface Watch { open: string; since: number }

export const NO_WATCH: Watch = { open: '', since: 0 };

/** The asks the team still has, as one line: each with where it stands. */
export function openAsks(jobs: Job[]): string {
  return jobs.filter(waiting).map((j) => propText(j, 'id') + ':' + String(j.data.status || 'requested')).sort().join(' ');
}

/** One look of the watcher (called every `WATCH_EVERY` seconds): should the vault be read again now, and what to
 * remember for the next look. */
export function watchStep(w: Watch, jobs: Job[], now: number): { read: boolean; watch: Watch } {
  const open = openAsks(jobs);
  if (!open) return { read: false, watch: NO_WATCH };
  const watch = open === w.open ? w : { open, since: now };
  const waited = now - watch.since;
  return { read: waited < WATCH_SLOWS_AFTER || Math.floor(waited / (WATCH_EVERY * 1000)) % 4 === 0, watch };
}

// ---- The move from the older, per-device way (remove once every device has opened the app after 2026-11-12) ----

/** Asks the team finished before this moment were tracked the older way: a list on each device, and an answer over
 * three hours old counted as used somewhere else. */
export const OLD_WAY_UNTIL = Date.parse('2026-11-12T13:00:00Z');

/** Was this ask finished while "used" was still kept on each device? */
export function fromOldWay(job: Job): boolean {
  const t = Date.parse(String(job.data.finished || job.data.created || ''));
  return isFinite(t) && t < OLD_WAY_UNTIL;
}
