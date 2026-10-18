// Options for a passage (the old Writers Room /touch, Kyle 2026-10-18): Kyle picks words (or leaves the cursor in a
// paragraph) and asks for Expand, Describe, Tighten or More like my voice. The app writes an `options` job with the exact
// passage; the team answers with two or three checked replacements in the job's ## Result (### Option 1, 2, 3) and never
// touches the scene. The page shows them beside the prose; nothing changes until Kyle picks one. Then the app saves a copy
// of the scene and swaps the passage for the option, only where the passage still is, word for word.
import { askBody, resultBody, type NewJob } from './jobs.ts';
import type { NoteRecord } from './types.ts';

export type OptionMode = 'expand' | 'describe' | 'tighten' | 'voice';

export const OPTION_MODES: { key: OptionMode; label: string; hint: string }[] = [
  { key: 'expand', label: 'Expand', hint: 'Longer: more of the moment, the same events' },
  { key: 'describe', label: 'Describe', hint: 'The same moment with what the point-of-view character sees, hears, smells and feels' },
  { key: 'tighten', label: 'Tighten', hint: 'Shorter by a fifth to two fifths, nothing important lost' },
  { key: 'voice', label: 'More like my voice', hint: 'Rewritten the way you write, from your Style Guide and the edits the team has learned' }
];

export function modeLabel(mode: string): string {
  const m = OPTION_MODES.find((x) => x.key === mode);
  return m ? m.label : 'Options';
}

/** The passage the options are for: the words picked, or the paragraph the cursor is in. Its place in the text, and up
 * to 60 characters before it on its line, so the swap finds it again even if the same words come twice. */
export interface Passage { text: string; start: number; end: number; before: string }

export function passageAt(text: string, sel: { start: number; end: number } | null): Passage | null {
  const t = String(text || '');
  let a: number, b: number;
  if (sel && Math.max(sel.start, sel.end) > Math.min(sel.start, sel.end)) {
    a = Math.max(0, Math.min(sel.start, sel.end));
    b = Math.min(t.length, Math.max(sel.start, sel.end));
  } else {
    const at = sel ? Math.min(Math.max(0, sel.start), t.length) : -1;
    if (at < 0) return null;
    const p = t.lastIndexOf('\n\n', Math.max(0, at - 1));
    const q = t.indexOf('\n\n', at);
    a = p < 0 ? 0 : p + 2;
    b = q < 0 ? t.length : q;
  }
  // Spaces and blank lines at the edges are not part of the passage.
  while (a < b && /\s/.test(t[a])) a++;
  while (b > a && /\s/.test(t[b - 1])) b--;
  if (b <= a || !/[A-Za-z0-9]/.test(t.slice(a, b))) return null;
  const lineStart = t.lastIndexOf('\n', a - 1) + 1;
  return { text: t.slice(a, b), start: a, end: b, before: t.slice(Math.max(lineStart, a - 60), a) };
}

const STEPS: Record<OptionMode, string> = {
  expand: 'Expand it as the Writer: keep every event and line of dialogue in it and give the moment more room (action, the point-of-view character\'s senses and choices, a beat of dialogue if it fits), about one and a half to two times as long.',
  describe: 'Rework it as the Writer so the moment is felt through the point-of-view character\'s senses (sight, sound, smell, touch, taste where it fits), keeping its events and dialogue. One figurative image at most, from that character\'s world.',
  tighten: 'Tighten it as the Line Editor: cut 20 to 40 percent of its words, keeping its meaning, events, dialogue and voice. Cut filler, doubled beats, filter words and hedges first. Say each option\'s cut in the Notes.',
  voice: 'Rewrite it as the Writer, as close to Kyle\'s own voice as you can: load the style-fingerprint skill (Taste/Style Fingerprint.md), the book\'s Style Guide and your MEMORY.md lessons from his edits. Keep its events and dialogue.'
};

/** The job's ## Ask: what to do, step by step (the runner's coordinator follows it), then the mode and the passage. */
export function optionsAsk(mode: OptionMode, scene: string, p: Passage): string {
  return [
    'Kyle picked a passage in ' + scene + ' in the Story Forge app and asked for options: ' + modeLabel(mode) + '.',
    '',
    '1. Read the scene for context, the book\'s Style Guide and the prose rules in CLAUDE.md. Never change the scene or any other note: the app swaps in the option Kyle picks.',
    '2. ' + STEPS[mode],
    '3. Write three options (two if a third would only repeat one), each a different take. Each replaces the passage exactly, so it starts and ends where the passage does, in the same tense and point of view, with *italics* kept as Markdown.',
    '4. Check each one before writing it down: run `System/Tools/sf lint` on it (or the anti-slop skill\'s rules) and fix every strong or likely tell.',
    '5. Put them in this job\'s ## Result, each under its own heading, `### Option 1`, `### Option 2`, `### Option 3`, holding only the replacement text: no quote marks around it, no labels, no comments. Anything to say about them goes last, under `### Notes`, one short line per option.',
    '',
    'Mode: ' + mode,
    'Before: ' + p.before.replace(/\s+$/, ''),
    '',
    '### Passage',
    p.text
  ].join('\n');
}

export function optionsJob(mode: OptionMode, sceneId: string, sceneLabel: string, bookFolder: string, p: Passage): NewJob {
  return { title: 'Options for ' + sceneId + ': ' + modeLabel(mode), kind: 'options', target: sceneId, book: bookFolder, ask: optionsAsk(mode, sceneLabel, p) };
}

/** What an options job asked for: its mode, the exact passage and the words before it. Null for a job that is not one. */
export function askedPassage(body: string): { mode: string; passage: string; before: string } | null {
  const ask = askBody(body);
  const i = ask.search(/(?:^|\n)### Passage[^\S\n]*\n/);
  if (i < 0) return null;
  const head = ask.slice(0, i);
  const passage = ask.slice(i).replace(/^\n?### Passage[^\S\n]*\n/, '').replace(/\s+$/, '');
  const mode = (/^Mode: ?(\S*)/m.exec(head) || ['', ''])[1];
  const before = (/^Before: ?(.*)$/m.exec(head) || ['', ''])[1];
  return passage ? { mode, passage, before } : null;
}

/** The options in a job's ## Result, in order, and its notes. A reply that quotes each option ("> ...") or wraps it in
 * quote marks is read without them. */
export function optionAnswers(result: string): { options: string[]; notes: string } {
  const parts = ('\n' + String(result || '').replace(/\r\n?/g, '\n')).split(/\n###[^\S\n]+/);
  const options: string[] = [];
  let notes = '';
  parts.slice(1).forEach((part) => {
    const nl = part.indexOf('\n');
    const head = (nl < 0 ? part : part.slice(0, nl)).trim();
    let body = nl < 0 ? '' : part.slice(nl + 1).trim();
    if (/^notes?\b/i.test(head)) { notes = body; return; }
    if (!/^option\b/i.test(head) || !body) return;
    const lines = body.split('\n');
    if (lines.every((l) => !l.trim() || /^>/.test(l))) body = lines.map((l) => l.replace(/^>\s?/, '')).join('\n').trim();
    body = body.replace(/^["“]([^"“”]*)["”]$/, '$1');
    options.push(body);
  });
  return { options, notes };
}

/** Where the passage is in the text now: the occurrence with the same words before it, or the only one. -1 when Kyle
 * has changed or removed it since he asked. */
export function locatePassage(text: string, passage: string, before: string): number {
  if (!passage) return -1;
  const all: number[] = [];
  for (let i = text.indexOf(passage); i >= 0; i = text.indexOf(passage, i + 1)) all.push(i);
  if (all.length <= 1) return all.length ? all[0] : -1;
  const want = before.replace(/\s+/g, ' ').trimEnd().slice(-24);
  const hit = all.find((i) => {
    const lineStart = text.lastIndexOf('\n', i - 1) + 1;
    return text.slice(Math.max(lineStart, i - 60), i).replace(/\s+/g, ' ').trimEnd().endsWith(want);
  });
  return hit != null ? hit : -1;
}

/** The text with the passage swapped for the option, how the cursor moves, and the lines that changed (for their dots).
 * Null when the passage is not in the text word for word any more. */
export function swapIn(text: string, passage: string, before: string, option: string): { text: string; map: (n: number) => number; added: string[] } | null {
  const at = locatePassage(text, passage, before);
  if (at < 0) return null;
  const end = at + passage.length;
  const put = option.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const out = text.slice(0, at) + put + text.slice(end);
  const d = put.length - passage.length;
  const lineStart = out.lastIndexOf('\n', at - 1) + 1;
  let lineEnd = out.indexOf('\n', at + put.length);
  if (lineEnd < 0) lineEnd = out.length;
  return {
    text: out,
    added: out.slice(lineStart, lineEnd).split('\n').filter((l) => l.trim()),
    map: (n) => (n <= at ? n : n >= end ? n + d : at + put.length)
  };
}

/** This scene's options jobs, newest first. */
export function optionJobsFor(jobs: NoteRecord[], sceneId: string, bookFolder: string): NoteRecord[] {
  return jobs.filter((j) => String(j.data.kind || '') === 'options' && String(j.data.target || '') === sceneId && String(j.data.book || '') === bookFolder)
    .sort((a, b) => String(b.data.id || b.path).localeCompare(String(a.data.id || a.path)));
}

/** An options job's state for the panel: waiting for the team, ready with options, or finished without any. */
export function optionsState(j: NoteRecord): 'waiting' | 'ready' | 'failed' {
  const s = String(j.data.status || 'requested');
  if (s === 'requested' || s === 'running') return 'waiting';
  if (s === 'done' && optionAnswers(resultBody(j.body)).options.length) return 'ready';
  return 'failed';
}

// Options jobs Kyle has dealt with on this device (picked one, or put them away), so they stop showing.
const DONE = 'story-forge.options-done.';

export function loadOptionsDone(sourceKey: string): Set<string> {
  try { const v = JSON.parse(localStorage.getItem(DONE + sourceKey) || '[]'); return new Set(Array.isArray(v) ? v : []); } catch { return new Set(); }
}

export function saveOptionsDone(sourceKey: string, done: Set<string>) {
  try { localStorage.setItem(DONE + sourceKey, JSON.stringify(Array.from(done).slice(-300))); } catch { /* lasts until reload */ }
}
