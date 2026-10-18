// The Pomodoro timer: work for 25 (or 50) minutes, rest for 5 (or 10). The timer lives on this device (localStorage), so
// it keeps time across screens and a reload. Each finished work Pomodoro is written to the vault's Writing Log, one
// `writing-day` note per day (`Writing Log/YYYY-MM-DD.md`), with the words written in it: the scenes' word counts at the
// end minus where they stood when Kyle first typed in them during that Pomodoro. A Pomodoro stopped early is not counted.
import { Frontmatter } from './frontmatter.js';
import { toNumber } from './links.ts';
import type { NoteRecord, VaultIndex, VaultSource } from './types.ts';
import { makeNote } from './vault-index.ts';

export type Phase = 'idle' | 'work' | 'break';

export interface TimerState {
  phase: Phase;
  /** When the running phase ends (ms), or null when paused or idle. */
  endsAt: number | null;
  /** Milliseconds left while paused, or null. */
  pausedLeft: number | null;
  /** When the work phase began (ms). */
  startedAt: number | null;
  workMin: number;
  breakMin: number;
  /** Per scene path: the word count when Kyle first typed in it this Pomodoro, and the latest one. */
  base: Record<string, number>;
  latest: Record<string, number>;
  ids: Record<string, string>;
  /** Set when a work phase just finished, for the "Time for a break" line. */
  justDone: { words: number; at: number } | null;
}

/** A finished Pomodoro, waiting to be written to the vault or already written. */
export interface PomodoroRecord {
  date: string;
  time: string;
  minutes: number;
  words: number;
  scenes: string[];
}

export const WORK_CHOICES = [25, 50];
export const BREAK_CHOICES = [5, 10];
export const LOG_FOLDER = 'Writing Log';

const STATE_KEY = 'sf-pomodoro';
const logKey = (sourceKey: string) => 'sf-pomodoro-log:' + sourceKey;

export function idleState(workMin = 25, breakMin = 5): TimerState {
  return { phase: 'idle', endsAt: null, pausedLeft: null, startedAt: null, workMin, breakMin, base: {}, latest: {}, ids: {}, justDone: null };
}

export function loadTimer(): TimerState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as TimerState;
      if (s && (s.phase === 'idle' || s.phase === 'work' || s.phase === 'break')) return { ...idleState(), ...s };
    }
  } catch { /* a private window or cleared storage: start idle */ }
  return idleState();
}

export function saveTimer(s: TimerState): void {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* the timer still runs for this page */ }
  try { window.dispatchEvent(new Event('sf-pomodoro')); } catch { /* Node tests */ }
}

/** Start a work Pomodoro now. */
export function startWork(s: TimerState, now: number, workMin = s.workMin): TimerState {
  return { ...s, phase: 'work', workMin, startedAt: now, endsAt: now + workMin * 60000, pausedLeft: null, base: {}, latest: {}, ids: {}, justDone: null };
}

export function startBreak(s: TimerState, now: number): TimerState {
  return { ...s, phase: 'break', endsAt: now + s.breakMin * 60000, pausedLeft: null, startedAt: null, base: {}, latest: {}, ids: {} };
}

export function pause(s: TimerState, now: number): TimerState {
  if (s.endsAt == null) return s;
  return { ...s, endsAt: null, pausedLeft: Math.max(0, s.endsAt - now) };
}

export function resume(s: TimerState, now: number): TimerState {
  if (s.pausedLeft == null) return s;
  return { ...s, endsAt: now + s.pausedLeft, pausedLeft: null };
}

/** Stop without counting: back to idle, keeping the chosen lengths. */
export function stop(s: TimerState): TimerState {
  return idleState(s.workMin, s.breakMin);
}

/** Milliseconds left in the phase. */
export function msLeft(s: TimerState, now: number): number {
  if (s.pausedLeft != null) return s.pausedLeft;
  if (s.endsAt == null) return 0;
  return Math.max(0, s.endsAt - now);
}

/** "24:59". */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m + ':' + String(sec).padStart(2, '0');
}

/** Words written this Pomodoro, never below nothing. */
export function wordsSoFar(s: TimerState): number {
  let n = 0;
  Object.keys(s.latest).forEach((p) => { n += s.latest[p] - (s.base[p] ?? s.latest[p]); });
  return Math.max(0, n);
}

/** The writing screen reports each change of a scene's word count. Only counts during a running work Pomodoro. */
export function noteWords(s: TimerState, path: string, id: string, before: number, after: number): TimerState {
  if (s.phase !== 'work' || s.endsAt == null || before === after) return s;
  const base = s.base[path] == null ? { ...s.base, [path]: before } : s.base;
  return { ...s, base, latest: { ...s.latest, [path]: after }, ids: id ? { ...s.ids, [path]: id } : s.ids };
}

/** Call from the writing screen: records a word-count change in the stored timer. */
export function trackWords(path: string, id: string, before: number, after: number): void {
  const s = loadTimer();
  const next = noteWords(s, path, id, before, after);
  if (next !== s) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(next)); } catch { /* fine */ }
  }
}

function pad(n: number): string { return String(n).padStart(2, '0'); }
export function ymd(d: Date): string { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function hm(d: Date): string { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

/** What happens when time runs out: a finished work phase gives a record and starts the break; a finished break goes idle. */
export function advance(s: TimerState, now: number): { state: TimerState; record: PomodoroRecord | null } {
  if (s.endsAt == null || now < s.endsAt) return { state: s, record: null };
  if (s.phase === 'work') {
    const start = new Date(s.startedAt ?? s.endsAt - s.workMin * 60000);
    const words = wordsSoFar(s);
    const scenes = Object.keys(s.latest).map((p) => s.ids[p]).filter((x, i, a) => Boolean(x) && a.indexOf(x) === i).sort();
    const record: PomodoroRecord = { date: ymd(start), time: hm(start), minutes: s.workMin, words, scenes };
    return { state: { ...startBreak(s, s.endsAt), justDone: { words, at: s.endsAt } }, record };
  }
  return { state: { ...idleState(s.workMin, s.breakMin), justDone: s.justDone }, record: null };
}

// ------------------------------------------------------------------ the log

export function loadLog(sourceKey: string): PomodoroRecord[] {
  try { return JSON.parse(localStorage.getItem(logKey(sourceKey)) || '[]') as PomodoroRecord[]; } catch { return []; }
}

export function saveLog(sourceKey: string, list: PomodoroRecord[]): void {
  try { localStorage.setItem(logKey(sourceKey), JSON.stringify(list)); } catch { /* kept in memory only */ }
}

export function logPath(date: string): string {
  return LOG_FOLDER + '/' + date + '.md';
}

/** One line of the day's ## Pomodoros list: "- 09:30, 25 minutes, 412 words (S-012, S-013)". */
export function recordLine(r: PomodoroRecord): string {
  return '- ' + r.time + ', ' + r.minutes + ' minutes, ' + r.words + (r.words === 1 ? ' word' : ' words') + (r.scenes.length ? ' (' + r.scenes.join(', ') + ')' : '');
}

/** The day's note with one more Pomodoro: the counts go up, the line goes at the end of ## Pomodoros, nothing else changes. */
export function addToDay(text: string, r: PomodoroRecord, now: Date): string {
  if (!text.trim()) {
    const data = { type: 'writing-day', date: r.date, pomodoros: 1, minutes: r.minutes, words: r.words, updated: now.toISOString().slice(0, 19) + 'Z' };
    return Frontmatter.join(data, '## Pomodoros\n' + recordLine(r) + '\n');
  }
  const p = Frontmatter.parse(text);
  const data = { ...((p.data || {}) as Record<string, unknown>) };
  data.pomodoros = (toNumber(data.pomodoros) || 0) + 1;
  data.minutes = (toNumber(data.minutes) || 0) + r.minutes;
  data.words = (toNumber(data.words) || 0) + r.words;
  data.updated = now.toISOString().slice(0, 19) + 'Z';
  let body = p.body || '';
  const head = /(^|\n)## Pomodoros[^\n]*\n/.exec(body);
  if (!head) {
    body = body.replace(/\s*$/, '') + (body.trim() ? '\n\n' : '') + '## Pomodoros\n' + recordLine(r) + '\n';
  } else {
    const start = head.index + head[0].length;
    const rest = body.slice(start);
    const nextHead = /\n## /.exec(rest);
    const end = nextHead ? start + nextHead.index : body.length;
    const section = body.slice(start, end).replace(/\s*$/, '');
    body = body.slice(0, start) + (section ? section + '\n' : '') + recordLine(r) + '\n' + (nextHead ? body.slice(end) : '');
  }
  return Frontmatter.join(data, body);
}

/** Write the waiting Pomodoros to the vault, oldest first, as Kyle's commits. Returns the notes written. */
export async function flushLog(source: VaultSource, now: Date): Promise<NoteRecord[]> {
  const list = loadLog(source.key);
  if (!list.length || !source.write) return [];
  const saved: NoteRecord[] = [];
  while (list.length) {
    const r = list[0];
    const path = logPath(r.date);
    for (let attempt = 0; ; attempt++) {
      const { files } = await source.tree();
      const exists = files.some((f) => f.path === path);
      const cur = exists && source.readFresh ? await source.readFresh(path) : { text: '', sha: '' };
      const text = addToDay(cur.text, r, now);
      try {
        const sha = await source.write(path, text, cur.sha, 'log: Pomodoro at ' + r.time + ' on ' + r.date + ', ' + r.words + ' words\n\nKept by the Story Forge app\'s timer.');
        saved.push(makeNote(path, sha, text));
        break;
      } catch (e) {
        if ((e as { conflict?: boolean }).conflict && attempt < 3) continue;
        saveLog(source.key, list);
        throw e;
      }
    }
    list.shift();
    saveLog(source.key, list);
  }
  return saved;
}

/** Today's Pomodoros and words: the day's note in the vault plus the ones still waiting on this device. */
export function today(index: VaultIndex | null, waiting: PomodoroRecord[], now: Date): { pomodoros: number; words: number } {
  const date = ymd(now);
  const n = index ? index.notes[logPath(date)] : undefined;
  let pomodoros = n ? toNumber(n.data.pomodoros) || 0 : 0;
  let words = n ? toNumber(n.data.words) || 0 : 0;
  waiting.filter((r) => r.date === date).forEach((r) => { pomodoros++; words += r.words; });
  return { pomodoros, words };
}
