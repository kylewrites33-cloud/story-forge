// The Chapter Grid's search: finds scenes by what Kyle means, not only by the exact letters. "33" or "ch 33" finds
// chapter 33, "51" or "s51" finds S-051, a chapter's title finds its scenes, a nickname finds the character's scenes, and
// one wrong letter in a longer word still matches a title or a name. Matches come back best first.
import { linkName, nameList, toNumber } from './links.ts';
import { labelsOf } from './home.ts';
import type { NoteRecord } from './types.ts';

/** A codex name and the words that also mean it (aliases, first name), as codex.ts lists them. */
export interface SearchName { name: string; terms: string[] }

export interface SceneHit { note: NoteRecord; score: number }

type Token = { kind: 'chapter' | 'scene' | 'number'; n: number } | { kind: 'word'; w: string; also: string[] };

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** The query as tokens: "chapter 33", "ch. 33", "c33" are a chapter; "S-051", "s51", "scene 51" a scene; a bare number either. */
export function readQuery(query: string, names: SearchName[] = []): Token[] {
  let q = ' ' + fold(query) + ' ';
  const out: Token[] = [];
  q = q.replace(/\s(?:chapter|chap|ch|c)\.?\s*#?(\d+)(?=\s)/g, (_, n) => { out.push({ kind: 'chapter', n: Number(n) }); return ' '; });
  q = q.replace(/\s(?:scene\s*#?|s-?\s*)(\d+)(?=\s)/g, (_, n) => { out.push({ kind: 'scene', n: Number(n) }); return ' '; });
  q.split(/[\s,;:!?"“”()]+/).map((w) => w.replace(/^[.'’-]+|[.'’-]+$/g, '')).filter(Boolean).forEach((w) => {
    if (/^#?\d+$/.test(w)) { out.push({ kind: 'number', n: Number(w.replace('#', '')) }); return; }
    // A word that is one of a codex entry's names also matches its other names: "Pip" finds scenes that say "Pipwick".
    const also: string[] = [];
    names.forEach((e) => {
      const all = [e.name].concat(e.terms).map(fold);
      if (all.some((t) => t === w || t.split(/\s+/).indexOf(w) >= 0)) all.forEach((t) => { if (t !== w && also.indexOf(t) < 0) also.push(t); });
    });
    out.push({ kind: 'word', w, also });
  });
  return out;
}

/** True when two words are one letter apart (a letter added, dropped or changed, or two swapped). */
function nearly(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** How well one word fits a field: the whole word, the start of a word, inside a word, or one letter off. */
function fit(w: string, field: string, words: string[]): number {
  if (!field || field.indexOf(w) < 0) {
    return w.length >= 5 && words.some((x) => x.length >= 4 && nearly(w, x)) ? 0.5 : 0;
  }
  if (words.indexOf(w) >= 0) return 1;
  return words.some((x) => x.startsWith(w)) ? 0.8 : 0.4;
}

const wordsOf = (s: string) => s.split(/[^\p{L}\p{N}'’]+/u).filter(Boolean);

/** The scenes that match every part of the query, best first; scenes that score the same keep the book's order. */
export function searchScenes(scenes: NoteRecord[], query: string, names: SearchName[] = []): SceneHit[] {
  const tokens = readQuery(query, names);
  if (!tokens.length) return scenes.map((note) => ({ note, score: 0 }));
  // Only a chapter's first scene carries its title, so every scene of the chapter takes it from there.
  const chapterTitle: Record<string, string> = {};
  scenes.forEach((s) => {
    const c = toNumber(s.data.chapter);
    if (c != null && !chapterTitle[c] && typeof s.data.chapter_title === 'string') chapterTitle[c] = s.data.chapter_title;
  });
  const hits: SceneHit[] = [];
  scenes.forEach((note) => {
    const d = note.data;
    const chapter = toNumber(d.chapter);
    const idNum = (() => { const m = String(d.id || '').match(/(\d+)\s*$/); return m ? Number(m[1]) : null; })();
    const str = (v: unknown) => (v == null ? '' : fold(String(v)));
    const fields: Array<[string, number]> = [
      [str(d.title) + ' ' + str(d.headline), 100],
      [chapter != null ? str(chapterTitle[chapter]) : '', 80],
      [[linkName(d.pov), linkName(d.place)].concat(nameList(d.cast)).map(str).join(' '), 60],
      [[d.subtitle, d.summary, d.turn, d.hook, d.goal, d.status, d.id].map(str).concat(labelsOf(d.labels).map(fold)).join(' '), 30]
    ];
    const split = fields.map(([f, weight]) => ({ f, weight, words: wordsOf(f) }));
    let body: string | null = null;
    let score = 0;
    for (const t of tokens) {
      if (t.kind !== 'word') {
        let s = 0;
        if (t.kind !== 'scene' && chapter === t.n) s = 400;
        else if (t.kind !== 'chapter' && idNum === t.n) s = 300;
        else if (t.kind === 'number') {
          // A number that is neither the chapter nor the scene may still be in the words: "1899", "Room 12".
          body = body == null ? fold(note.body) : body;
          const re = new RegExp('(^|\\D)' + t.n + '(\\D|$)');
          s = split.some((x) => re.test(x.f)) ? 30 : re.test(body) ? 10 : 0;
        }
        if (!s) return;
        score += s;
        continue;
      }
      let best = 0;
      [t.w].concat(t.also).forEach((w, i) => {
        const cut = i ? 0.9 : 1;
        split.forEach((x) => { best = Math.max(best, fit(w, x.f, x.words) * x.weight * cut); });
      });
      body = body == null ? fold(note.body) : body;
      const inBody = [t.w].concat(t.also).some((w) => body!.indexOf(w) >= 0);
      if (!best && !inBody) return;
      score += best + (inBody ? 10 : 0);
    }
    // The whole query as written, in the title, is the likeliest scene of all.
    const whole = fold(query).trim();
    if (whole.indexOf(' ') > 0 && split[0].f.indexOf(whole) >= 0) score += 50;
    hits.push({ note, score });
  });
  return hits.map((h, i) => ({ h, i })).sort((a, b) => b.h.score - a.h.score || a.i - b.i).map((x) => x.h);
}
