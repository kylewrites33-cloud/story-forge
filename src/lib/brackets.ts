// [Brackets] in the prose are asks for the team that Kyle leaves without stopping (Kyle, 2026-10-18). A gap such as
// "she was wearing [...]" gets its words right after the marker; a bracket with words in it ("[how was she dressed]",
// "[research: make this farmerly]") is a question, answered as a paragraph right under the paragraph it sits in. Fill
// brackets sends them as a `fill` job; the Writer answers in the job note only, and the app puts the words into the
// page, so the team never races the paragraph Kyle is typing. The bracket itself always stays until Kyle deletes it, so
// he can check the answer against what he asked (Kyle, 2026-10-19).
import { askBody, resultBody, type NewJob } from './jobs.ts';
import type { NoteRecord } from './types.ts';

export interface Bracket {
  /** The marker exactly as on the page, brackets included. */
  marker: string;
  inner: string;
  /** Where the marker starts and ends in the text. */
  at: number;
  end: number;
  kind: 'gap' | 'ask';
  /** The line (paragraph) it sits in, and the words before it on that line. */
  line: string;
  before: string;
}

// [words] that are not [[links]], [!callouts], [^footnotes] or [text](links), on one line.
const RE = /\[(?![[!^])([^[\]\n]{0,400})\](?![([:\]])/g;
const GAP = /^\s*(?:\.{2,}|…|_{2,}|-{2,}|\?{1,3})?\s*$/;

export function findBrackets(text: string): Bracket[] {
  const out: Bracket[] = [];
  let m: RegExpExecArray | null;
  RE.lastIndex = 0;
  while ((m = RE.exec(text))) {
    const at = m.index;
    if (at > 0 && text[at - 1] === '[') continue;
    const lineStart = text.lastIndexOf('\n', at - 1) + 1;
    let lineEnd = text.indexOf('\n', at);
    if (lineEnd < 0) lineEnd = text.length;
    const before = text.slice(lineStart, at);
    // A task box at the start of a list line ("- [ ] milk") is not an ask.
    if (/^\s*[-*+]\s*$/.test(before)) continue;
    out.push({
      marker: m[0], inner: m[1], at, end: at + m[0].length, kind: GAP.test(m[1]) ? 'gap' : 'ask',
      line: text.slice(lineStart, lineEnd), before: before.slice(-80)
    });
  }
  return out;
}

/** Which bracket this is, so one already sent is not sent twice: its words and the words just before it. */
export function bracketKey(b: { marker: string; before: string }): string {
  return b.marker.trim().toLowerCase() + '|' + b.before.replace(/\s+/g, ' ').trimEnd().slice(-24);
}

/** One bracket as a job lists it. */
export interface FillItem { name: string; kind: 'gap' | 'ask'; marker: string; before: string }

/** The ## Ask of a fill job: a line for Kyle, then one ### B<n> block per bracket with the paragraph it sits in. */
export function fillAsk(scene: string, list: Bracket[], text: string): string {
  const L = ['Kyle left ' + (list.length === 1 ? 'this bracket' : 'these ' + list.length + ' brackets') + ' in ' + scene +
    ' while writing. Answer each one; the app puts the words into his page.'];
  list.forEach((b, i) => {
    const lineStart = text.lastIndexOf('\n', b.at - 1) + 1;
    const prev = text.slice(0, Math.max(0, lineStart - 1)).split('\n').filter((l) => l.trim()).pop() || '';
    L.push('', '### B' + (i + 1), 'Kind: ' + b.kind, 'Marker: ' + b.marker, 'Before: ' + b.before.replace(/\s+$/, ''), 'Paragraph: ' + b.line.trim());
    if (prev) L.push('Paragraph before: ' + prev.trim());
  });
  return L.join('\n');
}

export function fillJob(sceneId: string, sceneLabel: string, bookFolder: string, list: Bracket[], text: string): NewJob {
  const n = list.length;
  return { title: 'Fill ' + n + (n === 1 ? ' bracket' : ' brackets') + ' in ' + sceneId, kind: 'fill', target: sceneId, book: bookFolder, ask: fillAsk(sceneLabel, list, text) };
}

/** The brackets a fill job's ask lists. */
export function askItems(body: string): FillItem[] {
  const out: FillItem[] = [];
  body.split(/\n(?=### B\d+\s*\n)/).forEach((part) => {
    const h = /^### (B\d+)\s*\n([\s\S]*)$/.exec(part);
    if (!h) return;
    const get = (k: string) => { const m = new RegExp('^' + k + ': ?(.*)$', 'm').exec(h[2]); return m ? m[1] : ''; };
    const marker = get('Marker');
    if (!marker) return;
    out.push({ name: h[1], kind: get('Kind').trim() === 'gap' ? 'gap' : 'ask', marker, before: get('Before') });
  });
  return out;
}

/** The answers in a fill job's ## Result, by bracket name, as plain text for the page. */
export function fillAnswers(result: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = ('\n' + result).split(/\n### (B\d+)[^\n]*\n/);
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const t = plainAnswer(parts[i + 1]);
    if (t) out[parts[i]] = t;
  }
  return out;
}

/** An answer in the page's own style: no "> " quote arrows (Kyle, 2026-10-19: "I don't like the arrows"). The lines of a
 * quote block become paragraphs of their own, the way his pages set out a status box. */
export function plainAnswer(answer: string): string {
  const lines = answer.replace(/\r\n?/g, '\n').trim().split('\n');
  const out: string[] = [];
  let inQuote = false;
  lines.forEach((l) => {
    const q = /^\s*>\s?(.*)$/.exec(l);
    if (q) {
      if (/^\s*$/.test(q[1])) { inQuote = true; return; }
      if (out.length && out[out.length - 1].trim()) out.push('');
      out.push(q[1].trimEnd());
      inQuote = true;
      return;
    }
    if (inQuote && l.trim() && out.length && out[out.length - 1].trim()) out.push('');
    inQuote = false;
    out.push(l);
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Where a listed bracket is in the text now: the occurrence of its marker with the same words before it, or the only
 * one there is. -1 when it is gone (Kyle deleted it, or it was filled already). */
export function locate(text: string, item: { marker: string; before: string }): number {
  const want = item.before.replace(/\s+/g, ' ').trimEnd().slice(-24);
  const all: number[] = [];
  for (let i = text.indexOf(item.marker); i >= 0; i = text.indexOf(item.marker, i + 1)) all.push(i);
  const hit = all.find((i) => {
    const lineStart = text.lastIndexOf('\n', i - 1) + 1;
    return text.slice(Math.max(lineStart, i - 80), i).replace(/\s+/g, ' ').trimEnd().endsWith(want);
  });
  if (hit != null) return hit;
  return all.length === 1 ? all[0] : -1;
}

/** One change to the text, with how a cursor position moves because of it. */
export interface Placed { text: string; map: (n: number) => number; added: string[] }

function tidy(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Put an answer into the text, keeping the bracket where it is: a gap's words right after its marker; a question's answer
 * as a new paragraph under its paragraph. Null when the bracket is no longer in the text. */
export function placeAnswer(text: string, item: FillItem, answer: string): Placed | null {
  const i = locate(text, item);
  if (i < 0) return null;
  const end = i + item.marker.length;
  const lineStart = text.lastIndexOf('\n', i - 1) + 1;
  // Already in the page (put there on another device and saved, since the bracket stays): leave the text as it is.
  if (placedAlready(text.slice(end), answer)) return { text, added: [], map: (n) => n };
  if (item.kind === 'gap') {
    let s = tidy(answer).replace(/\s*\n+\s*/g, ' ').replace(/^["“]([\s\S]*)["”]$/, '$1');
    const next = text[end];
    if (!/^[,.;:!?)’'"”—-]/.test(s)) s = ' ' + s;
    if (next && /[A-Za-z0-9(“"]/.test(next) && !/\s$/.test(s)) s += ' ';
    const out = text.slice(0, end) + s + text.slice(end);
    let lineEnd = out.indexOf('\n', end);
    if (lineEnd < 0) lineEnd = out.length;
    return { text: out, added: [out.slice(lineStart, lineEnd)], map: (n) => (n <= end ? n : n + s.length) };
  }
  // A question: the answer goes two lines down, after the paragraph.
  let lineEnd = text.indexOf('\n', end);
  if (lineEnd < 0) lineEnd = text.length;
  const s = tidy(answer);
  const ins = '\n\n' + s;
  const out = text.slice(0, lineEnd) + ins + text.slice(lineEnd);
  return {
    text: out,
    added: s.split('\n').filter((l) => l.trim()),
    map: (n) => (n > lineEnd ? n + ins.length : n)
  };
}

function placedAlready(after: string, answer: string): boolean {
  const flat = (t: string) => t.replace(/\s+/g, ' ').trim();
  const first = flat(answer.split('\n').find((l) => l.trim()) || '').slice(0, 40);
  return !!first && flat(after).indexOf(first) >= 0;
}

/** A fill job's state for a scene's brackets: listed in a job the team has not finished, or answered. */
export function fillJobsFor(jobs: NoteRecord[], sceneId: string, bookFolder: string): NoteRecord[] {
  return jobs.filter((j) => String(j.data.kind || '') === 'fill' && String(j.data.target || '') === sceneId && String(j.data.book || '') === bookFolder);
}

export function isOpenJob(j: NoteRecord): boolean {
  const s = String(j.data.status || 'requested');
  return s === 'requested' || s === 'running';
}

/** Keys of brackets the team has answered already. The bracket stays on the page after its answer, so Fill brackets must
 * not send it again; changing its words asks afresh. */
export function answeredKeys(jobs: NoteRecord[]): Set<string> {
  const out = new Set<string>();
  jobs.filter((j) => String(j.data.status || '') === 'done').forEach((j) => {
    const answers = fillAnswers(resultBody(j.body));
    askItems(askBody(j.body)).forEach((it) => { if (answers[it.name]) out.add(bracketKey(it)); });
  });
  return out;
}

/** Keys of brackets the team is working on now, so the page shows them as asked and Fill brackets skips them. */
export function askingKeys(jobs: NoteRecord[]): Set<string> {
  const out = new Set<string>();
  jobs.filter(isOpenJob).forEach((j) => askItems(askBody(j.body)).forEach((it) => out.add(bracketKey(it))));
  return out;
}

// Answers already put into the page on this device (job ID and bracket name), so Undo never brings one back twice.
const FILLED = 'story-forge.filled.';

export function loadFilled(sourceKey: string): Set<string> {
  try { const v = JSON.parse(localStorage.getItem(FILLED + sourceKey) || '[]'); return new Set(Array.isArray(v) ? v : []); } catch { return new Set(); }
}

export function saveFilled(sourceKey: string, done: Set<string>) {
  try { localStorage.setItem(FILLED + sourceKey, JSON.stringify(Array.from(done).slice(-500))); } catch { /* lasts until reload */ }
}

// Fill brackets on their own: after a closed bracket has sat for a while, the app sends it without being asked (per device).
const AUTO = 'story-forge.fill-auto';

export function loadAutoFill(): boolean {
  try { return localStorage.getItem(AUTO) === 'on'; } catch { return false; }
}

export function saveAutoFill(on: boolean) {
  try { if (on) localStorage.setItem(AUTO, 'on'); else localStorage.removeItem(AUTO); } catch { /* lasts until reload */ }
}
