// The one way to ask the team (2026-11-12, step 4 of the code structure redesign). An ask is a job note in the vault's
// Jobs folder (src/lib/jobs.ts writes it, the runner answers it). This file is what every team feature reads it with:
// where an ask stands, and which of its answers Kyle has already used. "Used" is written on the job note itself
// (`taken`), through the saving system, so the iPad and the desktop agree; before, each device kept its own list and
// guessed about the other from an answer's age.
import { Frontmatter } from '../lib/frontmatter.js';
import type { NoteRecord } from '../lib/types.ts';

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

// ---- The move from the older, per-device way (remove once every device has opened the app after 2026-11-12) ----

/** Asks the team finished before this moment were tracked the older way: a list on each device, and an answer over
 * three hours old counted as used somewhere else. */
export const OLD_WAY_UNTIL = Date.parse('2026-11-12T13:00:00Z');

/** Was this ask finished while "used" was still kept on each device? */
export function fromOldWay(job: Job): boolean {
  const t = Date.parse(String(job.data.finished || job.data.created || ''));
  return isFinite(t) && t < OLD_WAY_UNTIL;
}
