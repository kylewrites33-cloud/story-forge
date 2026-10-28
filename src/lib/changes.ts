// The team's changes to a chapter, shown on Kyle's page the way Word shows track changes (Workflow 1.2, step 41; Kyle,
// 2026-10-24: "surely word's track changes can be an inspiration for us"). The Writer never rewrites a scene in editing:
// it writes one `chapter-changes` note per chapter in the book's `Changes/` folder, each change quoting Kyle's exact
// words, the new words and the reason. Kyle keeps or refuses each one; a change he keeps goes into the scene as his save.
//
// The note reads plainly in Obsidian:
//
//   ## C-03 · line
//   Scene: S-003
//   Why: Sense: "good time" means a pleasant time; the moment needs timing.
//   Kyle: open
//
//   Was:
//   > He arrived at a good time, just as the cart tipped.
//
//   Now:
//   > He arrived with good timing, just as the cart tipped.
//
// A new passage also has `Or:` with a second version. Paragraphs inside a quote are `> ` lines with a `>` line between.
import type { NoteRecord, VaultSource } from './types.ts';

export const CHANGES_FOLDER = 'Changes';
export const CHANGES_TYPE = 'chapter-changes';

export type ChangeKind = 'small' | 'line' | 'story' | 'new';
/** open: waiting on Kyle. kept: the Now words went in. other: the second version went in. no: refused. mine: Kyle wrote his own. */
export type ChangeStatus = 'open' | 'kept' | 'other' | 'no' | 'mine';
export const KINDS: ChangeKind[] = ['small', 'line', 'story', 'new'];
const STATUSES: ChangeStatus[] = ['open', 'kept', 'other', 'no', 'mine'];

export interface Change {
  id: string;
  kind: ChangeKind;
  /** The scene ID the words are in. */
  scene: string;
  why: string;
  status: ChangeStatus;
  was: string;
  now: string;
  /** A second version (new passages), or null. */
  other: string | null;
}

export const KIND_LABEL: Record<ChangeKind, string> = { small: 'Fix', line: 'Sentence', story: 'Story', new: 'New passage' };

export type DiffPart = { kind: 'same' | 'del' | 'ins'; text: string };

/** Was against now, word by word, so the page marks only the words that differ (Kyle, 2026-10-28: a name change showed
 * as a whole sentence struck out and retyped). Spaces join the word before them, so runs read naturally. */
export function wordDiff(was: string, now: string): DiffPart[] {
  const tok = (s: string) => s.match(/[\p{L}\p{N}'’]+|\s+|[^\p{L}\p{N}'’\s]/gu) || [];
  const a = tok(was), b = tok(now);
  // Long passages (a new scene) are too slow to compare word by word and are mostly new anyway.
  if (a.length * b.length > 250000) return [{ kind: 'del', text: was }, { kind: 'ins', text: now }].filter((x) => x.text) as DiffPart[];
  const n = a.length, m = b.length;
  const L: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const raw: DiffPart[] = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { raw.push({ kind: 'same', text: a[i] }); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { raw.push({ kind: 'ins', text: b[j] }); j++; }
    else { raw.push({ kind: 'del', text: a[i] }); i++; }
  }
  // A space left the same between two changed words joins them into one run, and each run reads as its old words, then
  // its new words.
  const out: DiffPart[] = [];
  let del = '', ins = '';
  const flush = () => { if (del) out.push({ kind: 'del', text: del }); if (ins) out.push({ kind: 'ins', text: ins }); del = ins = ''; };
  raw.forEach((x, k) => {
    const next = raw.slice(k + 1).find((y) => !/^\s+$/.test(y.text));
    if (x.kind === 'same' && /^\s+$/.test(x.text) && (del || ins) && next && next.kind !== 'same') { del += x.text; ins += x.text; return; }
    if (x.kind === 'del') { del += x.text; return; }
    if (x.kind === 'ins') { ins += x.text; return; }
    flush();
    const last = out[out.length - 1];
    if (last && last.kind === 'same') last.text += x.text; else out.push({ kind: 'same', text: x.text });
  });
  flush();
  return out;
}

/** A few words for the margin beside a change, saying what it is: "Name: Grey → Basil", "Typo", "Story call I-089". */
export function shortLabel(c: Change): string {
  let why = c.why.trim();
  const check = /^Proofread \(one reader/i.test(why);
  why = why.replace(/^Proofread \([^)]*\):\s*/i, '');
  const names = /^Name:\s*you renamed (.+?)\s*\(/i.exec(why);
  if (names) {
    const pairs = names[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map((x) => x.replace(/\s+to\s+/, ' → '));
    return (pairs.length > 1 ? 'Names: ' : 'Name: ') + pairs.join(', ');
  }
  const call = /^(Story call I-\d+|To-do T-\d+(?:\s*\/\s*T-\d+)*)/i.exec(why);
  if (call) return call[1];
  const head = /^([^:.]{2,24}):/.exec(why);
  let label = head ? head[1] : KIND_LABEL[c.kind];
  if (c.kind === 'small' || c.kind === 'line') {
    const d = wordDiff(c.was, c.now).filter((x) => x.kind !== 'same');
    const del = d.filter((x) => x.kind === 'del').map((x) => x.text.trim()).join(' ');
    const ins = d.filter((x) => x.kind === 'ins').map((x) => x.text.trim()).join(' ');
    if (d.length <= 2 && del.length + ins.length <= 28) label += ': ' + (del && ins ? del + ' → ' + ins : del ? 'cut ' + del : 'add ' + ins);
  }
  return label + (check ? ' (check)' : '');
}

/** The word swaps a change makes ("Grey" for "Basil"), when it is nothing but short swaps; else null. Accept everywhere
 * works on these (Kyle, 2026-10-28: "apply this identical change in all cases"). */
export function swapsOf(c: Change): [string, string][] | null {
  const d = wordDiff(c.was, c.now);
  const out: [string, string][] = [];
  for (let k = 0; k < d.length; k++) {
    if (d[k].kind === 'same') continue;
    if (d[k].kind !== 'del' || !d[k + 1] || d[k + 1].kind !== 'ins') return null;
    const a = d[k].text.trim(), b = d[k + 1].text.trim();
    if (!a || !b || a.length > 40 || b.length > 40) return null;
    if (!out.some(([x, y]) => x === a && y === b)) out.push([a, b]);
    k++;
  }
  return out.length ? out : null;
}

const RULES = 'story-forge.change-rules.';
/** The swaps Kyle accepted everywhere, kept on this device. */
export function loadRules(sourceKey: string, s: Store | null = store()): [string, string][] {
  try { const v = s && s.getItem(RULES + sourceKey); const o = v ? JSON.parse(v) : []; return Array.isArray(o) ? o : []; } catch { return []; }
}
export function addRules(sourceKey: string, pairs: [string, string][], s: Store | null = store()): [string, string][] {
  const all = loadRules(sourceKey, s);
  pairs.forEach(([a, b]) => { if (!all.some(([x, y]) => x === a && y === b)) all.push([a, b]); });
  try { if (s) s.setItem(RULES + sourceKey, JSON.stringify(all)); } catch { /* lasts until reload */ }
  return all;
}
const SKIPS = 'story-forge.change-rules-skip.';
/** Changes Kyle undid after Accept everywhere took them: the rule leaves them alone from then on. */
export function loadSkips(sourceKey: string, s: Store | null = store()): string[] {
  try { const v = s && s.getItem(SKIPS + sourceKey); const o = v ? JSON.parse(v) : []; return Array.isArray(o) ? o : []; } catch { return []; }
}
export function addSkip(sourceKey: string, key: string, s: Store | null = store()): void {
  const all = loadSkips(sourceKey, s);
  if (all.indexOf(key) < 0) all.push(key);
  try { if (s) s.setItem(SKIPS + sourceKey, JSON.stringify(all)); } catch { /* lasts until reload */ }
}
/** Whether every swap in a change is one Kyle accepted everywhere. */
export function ruleFits(c: Change, rules: [string, string][]): boolean {
  const sw = c.status === 'open' ? swapsOf(c) : null;
  return !!sw && sw.every(([a, b]) => rules.some(([x, y]) => x === a && y === b));
}
/** How many waiting changes in the book make only these swaps (or some of them). Each note's swaps are worked out once
 * per vault read, since a card asks on every draw. */
const swapCache = new WeakMap<NoteRecord, [string, string][][]>();
export function countLike(notes: Record<string, NoteRecord>, bookFolder: string, pairs: [string, string][]): number {
  let n = 0;
  Object.values(notes).forEach((x) => {
    if (x.type !== CHANGES_TYPE || !x.path.startsWith(bookFolder + '/')) return;
    let list = swapCache.get(x);
    if (!list) { list = parseChanges(x.body).changes.map((c) => (c.status === 'open' && swapsOf(c)) || []); swapCache.set(x, list); }
    list.forEach((sw) => { if (sw.length && sw.every(([a, b]) => pairs.some(([p, q]) => p === a && q === b))) n++; });
  });
  return n;
}

export const changesTitle = (chapter: number) => 'Chapter ' + chapter + ' changes';
export const changesPath = (bookFolder: string, chapter: number) => bookFolder + '/' + CHANGES_FOLDER + '/' + changesTitle(chapter) + '.md';

/** The book's changes note for a chapter, if it has one. */
export function changesNoteFor(notes: Record<string, NoteRecord>, bookFolder: string, chapter: number | null): NoteRecord | null {
  if (chapter == null) return null;
  return Object.values(notes).find((n) => n.type === CHANGES_TYPE && n.path.startsWith(bookFolder + '/') && Number(n.data.chapter) === chapter) || null;
}

const HEAD = /^##\s+(C-\d+)\s*(?:·\s*(\w+))?\s*$/i;
const FIELD = /^(Scene|Why|Kyle):\s*(.*)$/i;
const QUOTE = /^(Was|Now|Or):\s*$/i;

/** The lines before the first change (the Writer's report) and the changes, in order. */
export function parseChanges(body: string): { intro: string; changes: Change[] } {
  const lines = body.split(/\r?\n/);
  const intro: string[] = [];
  const out: Change[] = [];
  let cur: (Change & { hasOther: boolean }) | null = null;
  let into: 'was' | 'now' | 'other' | null = null;
  let quote: string[] = [];
  const endQuote = () => {
    if (cur && into) {
      const t = quote.join('\n');
      if (into === 'other') { cur.other = t; cur.hasOther = true; } else cur[into] = t;
    }
    into = null; quote = [];
  };
  const close = () => { endQuote(); if (cur) { const { hasOther, ...c } = cur; out.push(hasOther ? c : { ...c, other: null }); } cur = null; };
  lines.forEach((line) => {
    const h = HEAD.exec(line.trim());
    if (h && /^##\s/.test(line)) {
      close();
      const k = (h[2] || '').toLowerCase() as ChangeKind;
      cur = { id: h[1].toUpperCase(), kind: KINDS.indexOf(k) >= 0 ? k : 'line', scene: '', why: '', status: 'open', was: '', now: '', other: null, hasOther: false };
      return;
    }
    if (!cur) { intro.push(line); return; }
    if (into && /^>/.test(line)) { quote.push(line.replace(/^> ?/, '')); return; }
    if (into) endQuote();
    const q = QUOTE.exec(line.trim());
    if (q) { const w = q[1].toLowerCase(); into = w === 'or' ? 'other' : (w as 'was' | 'now'); return; }
    const f = FIELD.exec(line.trim());
    if (f) {
      const key = f[1].toLowerCase();
      if (key === 'scene') cur.scene = f[2].trim().toUpperCase();
      else if (key === 'why') cur.why = f[2].trim();
      else { const s = f[2].trim().toLowerCase() as ChangeStatus; cur.status = STATUSES.indexOf(s) >= 0 ? s : 'open'; }
    }
  });
  close();
  return { intro: intro.join('\n').trim(), changes: out };
}

/** The body with one change's `Kyle:` line set to `status`, every other line as it was. A change with no Kyle line gets
 * one under its heading's fields. */
export function setStatus(body: string, id: string, status: ChangeStatus): string {
  const lines = body.split('\n');
  let inIt = false, done = false, fieldsEnd = -1;
  for (let i = 0; i < lines.length && !done; i++) {
    const h = HEAD.exec(lines[i].trim());
    if (h && /^##\s/.test(lines[i])) {
      if (inIt) break;
      inIt = h[1].toUpperCase() === id.toUpperCase();
      fieldsEnd = i;
      continue;
    }
    if (!inIt) continue;
    if (/^Kyle:/i.test(lines[i].trim())) { lines[i] = 'Kyle: ' + status; done = true; }
    else if (FIELD.test(lines[i].trim())) fieldsEnd = i;
  }
  if (!done && fieldsEnd >= 0 && inIt) lines.splice(fieldsEnd + 1, 0, 'Kyle: ' + status);
  return lines.join('\n');
}

// ---- Finding the words on the page ----

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Where `words` stand in `text` (from `from` on): exactly, or with any run of spaces and new lines standing for any other. */
export function findWords(text: string, words: string, from = 0): { at: number; end: number } | null {
  if (!words) return null;
  const at = text.indexOf(words, from);
  if (at >= 0) return { at, end: at + words.length };
  const parts = words.trim().split(/\s+/).map(esc);
  if (!parts.length || !parts[0]) return null;
  const re = new RegExp(parts.join('\\s+'), 'g');
  re.lastIndex = from;
  const m = re.exec(text);
  return m ? { at: m.index, end: m.index + m[0].length } : null;
}

export interface Placed { change: Change; at: number; end: number }

/** The open changes of one scene placed on its text, in reading order, none overlapping. `lost` are open changes whose
 * words are no longer there (Kyle changed them, or the change was put in somewhere else). */
export function placeChanges(text: string, changes: Change[], scene: string): { placed: Placed[]; lost: Change[] } {
  const placed: Placed[] = [];
  const lost: Change[] = [];
  changes.filter((c) => c.status === 'open' && (!c.scene || !scene || c.scene === scene)).forEach((c) => {
    const f = findWords(text, c.was);
    if (!f || placed.some((p) => f.at < p.end && p.at < f.end)) lost.push(c);
    else placed.push({ change: c, ...f });
  });
  placed.sort((a, b) => a.at - b.at);
  return { placed, lost };
}

export type Seg = { kind: 'same'; text: string; at: number } | { kind: 'change'; change: Change; was: string; now: string; at: number };

/** The text cut into Kyle's words and the changes between them. */
export function segments(text: string, placed: Placed[]): Seg[] {
  const out: Seg[] = [];
  let i = 0;
  placed.forEach((p) => {
    if (p.at > i) out.push({ kind: 'same', text: text.slice(i, p.at), at: i });
    out.push({ kind: 'change', change: p.change, was: text.slice(p.at, p.end), now: p.change.now, at: p.at });
    i = p.end;
  });
  if (i < text.length || !out.length) out.push({ kind: 'same', text: text.slice(i), at: i });
  return out;
}

/** The text as it would read with every placed change kept. */
export function finalText(text: string, placed: Placed[]): string {
  return segments(text, placed).map((s) => (s.kind === 'same' ? s.text : s.now)).join('');
}

/** Put one change's new words (or its second version) into the text where its old words are. */
export function applyChange(text: string, c: Change, which: 'now' | 'other' = 'now'): { text: string; at: number; end: number } | null {
  const f = findWords(text, c.was);
  if (!f) return null;
  const put = which === 'other' && c.other != null ? c.other : c.now;
  return { text: text.slice(0, f.at) + put + text.slice(f.end), at: f.at, end: f.at + put.length };
}

/** Take a kept change back out: its old words where its new words (or second version) are. */
export function revertChange(text: string, c: Change, which: 'now' | 'other' = 'now'): string | null {
  const put = which === 'other' && c.other != null ? c.other : c.now;
  if (!put) return null;
  const f = findWords(text, put);
  return f ? text.slice(0, f.at) + c.was + text.slice(f.end) : null;
}

/** How many changes are waiting on Kyle in a changes note (for the chapter list). */
export function openCount(note: NoteRecord | null): number {
  return note ? parseChanges(note.body).changes.filter((c) => c.status === 'open').length : 0;
}

// ---- Saving Kyle's choices ----
// A choice saves the one line straight away, re-reading the note first. Offline, it waits on this device and goes up
// with the next sync.

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
const KEY = 'story-forge.change-choices.';
const store = (): Store | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function loadChoices(sourceKey: string, s: Store | null = store()): Record<string, Record<string, ChangeStatus>> {
  try { const v = s && s.getItem(KEY + sourceKey); const o = v ? JSON.parse(v) : {}; return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
function storeChoices(sourceKey: string, all: Record<string, Record<string, ChangeStatus>>, s: Store | null = store()) {
  try { if (!s) return; if (Object.keys(all).length) s.setItem(KEY + sourceKey, JSON.stringify(all)); else s.removeItem(KEY + sourceKey); } catch { /* lasts until reload */ }
}

/** Kyle's choices still waiting on this device, laid over the changes as the vault has them. */
export function withChoices(changes: Change[], path: string, sourceKey: string, s: Store | null = store()): Change[] {
  const mine = loadChoices(sourceKey, s)[path];
  return mine ? changes.map((c) => (mine[c.id] ? { ...c, status: mine[c.id] } : c)) : changes;
}

const SAID: Record<ChangeStatus, string> = { open: 'opened again', kept: 'kept', other: 'kept the other version of', no: 'said no to', mine: 'wrote his own words for' };

/** Save Kyle's choices on one changes note: kept on this device first, then written to the vault as one commit. */
export async function saveChoices(source: VaultSource, path: string, choices: Record<string, ChangeStatus>, s: Store | null = store()): Promise<void> {
  const all = loadChoices(source.key, s);
  all[path] = { ...(all[path] || {}), ...choices };
  storeChoices(source.key, all, s);
  await flushChoices(source, s);
}

/** Send every choice waiting on this device. Throws when the connection is down; the choices stay for next time. */
export async function flushChoices(source: VaultSource, s: Store | null = store()): Promise<number> {
  if (!source.readFresh || !source.write) return 0;
  const all = loadChoices(source.key, s);
  let sent = 0;
  for (const path of Object.keys(all)) {
    const mine = all[path];
    for (let attempt = 0; ; attempt++) {
      const { text, sha } = await source.readFresh(path);
      let next = text;
      Object.keys(mine).forEach((id) => { next = setStatus(next, id, mine[id]); });
      const ids = Object.keys(mine);
      const what = ids.length === 1 ? 'Kyle ' + SAID[mine[ids[0]]] + ' ' + ids[0] : 'Kyle chose on ' + ids.length + ' changes';
      try {
        if (next !== text) await source.write(path, next, sha, 'changes: ' + what + ' in ' + path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '') + '\n\nChosen in the Sparrow app.');
        break;
      } catch (e) {
        if ((e as { conflict?: boolean }).conflict && attempt < 3) continue;
        throw e;
      }
    }
    const now = loadChoices(source.key, s);
    // Choices made while this one was saving stay for the next round.
    const left: Record<string, ChangeStatus> = {};
    Object.keys(now[path] || {}).forEach((id) => { if (now[path][id] !== mine[id]) left[id] = now[path][id]; });
    if (Object.keys(left).length) now[path] = left; else delete now[path];
    storeChoices(source.key, now, s);
    sent++;
  }
  return sent;
}

/** Every chapter of the book with a changes note: how many changes wait in it and the scene to open for them. */
export function chapterChanges(notes: Record<string, NoteRecord>, bookFolder: string, firstScene: (chapter: number) => string | null): { chapter: number; open: number; path: string }[] {
  const out: { chapter: number; open: number; path: string }[] = [];
  Object.values(notes).forEach((n) => {
    if (n.type !== CHANGES_TYPE || !n.path.startsWith(bookFolder + '/')) return;
    const chapter = Number(n.data.chapter);
    if (!isFinite(chapter)) return;
    const changes = parseChanges(n.body).changes.filter((c) => c.status === 'open');
    // The scene the first waiting change is in, else the chapter's first scene.
    const id = changes.length ? changes[0].scene : '';
    const byId = id ? Object.values(notes).find((x) => x.type === 'scene' && x.path.startsWith(bookFolder + '/') && String(x.data.id || '') === id) : null;
    const path = byId ? byId.path : firstScene(chapter);
    if (path) out.push({ chapter, open: changes.length, path });
  });
  return out.sort((a, b) => a.chapter - b.chapter);
}

// ---- Story calls (Workflow 1.2, steps 36 and 38) ----
// The whole-book read files each story call as an idea note with `step: "36"`: a yes-or-no question as its title and two
// or three fixes in its body, each on a line that starts "Fix A:". Kyle answers them one at a time before the Writer
// revises; his fix goes in the idea's decision_note.

export const CALLS_STEP = '36';

export function isStoryCall(n: NoteRecord): boolean {
  return n.type === 'idea' && String(n.data.step == null ? '' : n.data.step).trim() === CALLS_STEP;
}

/** The fixes a story call offers, from its "Fix A: ..." lines. */
/** A story call's body as Kyle reads it on its card: "Fix A" becomes "A", since "fix" reads as a verb (Kyle, 2026-10-27),
 * each answer line starts with its letter in bold and its short version (the first sentence, or up to the first comma
 * when that is long) in bold, and every line is its own paragraph. The note itself keeps "Fix A:". */
export function callBody(body: string): string {
  return body.split(/\r?\n/).map((line) => {
    const m = /^\s*(?:[-*]\s+)?(?:\*\*)?Fix\s+([A-F])(?:\*\*)?\s*[:.)]\s*(?:\*\*)?\s*(.+)$/i.exec(line);
    if (!m) return line.replace(/\bFix(es)? ([A-F])\b/g, (_s, _p, l) => l);
    const text = m[2].replace(/\*\*/g, '').trim().replace(/\bFix(es)? ([A-F])\b/g, (_s, _p, l) => l);
    const end = /^.*?[.!?](?=\s|$)/.exec(text);
    let cut = end ? end[0].length : text.length;
    if (cut > 90) { const c = /^.{12,90}?[,;:](?=\s)/.exec(text); cut = c ? c[0].length : cut; }
    const rest = text.slice(cut).trim();
    return '\n**' + m[1].toUpperCase() + ':** **' + text.slice(0, cut) + '**' + (rest ? ' ' + rest : '') + '\n';
  }).join('\n').replace(/\n{3,}/g, '\n\n');
}

export function fixesOf(body: string): { letter: string; text: string }[] {
  const out: { letter: string; text: string }[] = [];
  body.split(/\r?\n/).forEach((line) => {
    const m = /^\s*(?:[-*]\s+)?(?:\*\*)?Fix\s+([A-F])(?:\*\*)?\s*[:.)]\s*(?:\*\*)?\s*(.+)$/i.exec(line);
    if (m) out.push({ letter: m[1].toUpperCase(), text: m[2].replace(/\*\*/g, '').trim() });
  });
  return out;
}

/** Where Kyle's own words now stand in place of a change's Was: the Was is found in an older copy of the scene (Draft 1),
 * and the words just before and after it there are found on today's page; what lies between is his version. Null when
 * the Was or its neighbours cannot be found exactly once. */
export function rewriteSpan(page: string, was: string, old: string): { at: number; end: number } | null {
  const i = old.indexOf(was);
  if (!was || i < 0 || old.indexOf(was, i + 1) >= 0) return null;
  const once = (s: string, from = 0) => { const a = page.indexOf(s, from); return a >= 0 && page.indexOf(s, a + 1) < 0 ? a : -1; };
  let at = -1;
  const before = old.slice(0, i);
  if (!before) at = 0;
  for (let n = Math.min(80, before.length); at < 0 && n >= 12; n--) { const a = once(before.slice(-n)); if (a >= 0) at = a + n; }
  if (at < 0) return null;
  let end = -1;
  const after = old.slice(i + was.length);
  if (!after) end = page.length;
  for (let n = Math.min(80, after.length); end < 0 && n >= 12; n--) { const a = page.indexOf(after.slice(0, n), at); if (a >= 0 && page.indexOf(after.slice(0, n), a + 1) < 0) end = a; }
  return end >= at ? { at, end } : null;
}
