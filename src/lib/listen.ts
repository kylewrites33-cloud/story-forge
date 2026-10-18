// Listen (Kyle, 2026-10-18, from the Writers Room roadmap): the browser reads the scene or the whole chapter aloud, to
// catch the rhythm by ear. It uses the device's own speech (speechSynthesis, in iPad Chrome and desktop Chrome), so it is
// free and works offline with the device's voices. The prose is read one sentence at a time with the Markdown marks
// taken out; each sentence keeps its place on the page so the page can show the one being read. Pause stops after
// cancelling the sentence and Resume reads it again from its start: the browsers' own pause is unreliable.
import { readingMap } from './lintcheck.ts';
import { Prose } from './prose.js';

/** One piece to say: the words, where they are on the page, and which scene of the page (Whole chapter) they are in. */
export interface SpeechItem { say: string; start: number; end: number; part: number }

// Long sentences are said in pieces at a comma, semicolon or dash: some voices stop part way through a long one.
const LONG = 220;

/** What the words sound like with the page's marks gone: no brackets around asks, no [...] gaps, no stray stars. */
export function sayable(s: string): string {
  return s.replace(/\[(?:\s*(?:\.{2,}|…|_{2,}|-{2,}|\?{1,3})?\s*)\]/g, ' ')
    .replace(/[[\]*_#~=]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:!?])/g, '$1')
    .trim();
}

function pieces(text: string, start: number, end: number): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let a = start;
  while (end - a > LONG) {
    const window = text.slice(a, a + LONG);
    const cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(' — '), window.lastIndexOf(': '));
    if (cut < 40) break;
    out.push({ start: a, end: a + cut + 1 });
    a += cut + 2;
  }
  out.push({ start: a, end });
  return out;
}

/** The page's text as sentences to say, each with its place on the page. */
export function speechItems(text: string, part = 0): SpeechItem[] {
  const { masked, map } = readingMap(text);
  const out: SpeechItem[] = [];
  Prose.sentences(masked).forEach((s) => {
    pieces(masked, s.start, s.end).forEach((p) => {
      const say = sayable(masked.slice(p.start, p.end));
      if (!/[A-Za-z0-9]/.test(say)) return;
      const from = map[p.start], to = map[Math.max(p.start, p.end - 1)] + 1;
      out.push({ say, start: from, end: Math.max(from, to), part });
    });
  });
  return out;
}

/** The item to start from: the first one that ends after this place on the page (in this part). */
export function itemAt(items: SpeechItem[], part: number, at: number): number {
  const i = items.findIndex((it) => it.part > part || (it.part === part && it.end > at));
  return i < 0 ? 0 : i;
}

// ---- The reader: one sentence at a time through whatever speaks (the browser, or a stand-in in tests) ----

export interface Utterance {
  text: string; rate: number; voice: unknown;
  onend: ((e?: unknown) => void) | null;
  onerror: ((e?: { error?: string }) => void) | null;
}

export interface Speaker {
  make: (text: string) => Utterance;
  speak: (u: Utterance) => void;
  cancel: () => void;
  /** The voice object for a stored voice name, or null for the device's default. */
  voice: (id: string) => unknown;
}

export type ReaderState = 'idle' | 'playing' | 'paused';

export interface Reader {
  play: (items: SpeechItem[], from?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setRate: (r: number) => void;
  setVoice: (id: string) => void;
  /** Read from another sentence (the page was tapped, or Back and Next). */
  jump: (i: number) => void;
  state: () => { state: ReaderState; index: number; items: SpeechItem[] };
}

export function makeReader(sp: Speaker, onChange: (state: ReaderState, index: number, error?: string) => void, prefs: { rate: number; voice: string }): Reader {
  let items: SpeechItem[] = [];
  let index = 0;
  let state: ReaderState = 'idle';
  let rate = prefs.rate;
  let voice = prefs.voice;
  // Each sentence spoken gets a number; an end or error from an older one (cancelled) is ignored.
  let token = 0;
  const tell = (error?: string) => onChange(state, index, error);
  const say = () => {
    const it = items[index];
    if (!it) { state = 'idle'; index = 0; tell(); return; }
    const mine = ++token;
    const u = sp.make(it.say);
    u.rate = rate;
    u.voice = voice ? sp.voice(voice) : null;
    u.onend = () => {
      if (mine !== token || state !== 'playing') return;
      index++;
      if (index >= items.length) { state = 'idle'; index = 0; token++; tell(); return; }
      tell();
      say();
    };
    u.onerror = (e) => {
      if (mine !== token || state !== 'playing') return;
      const why = e && e.error;
      if (why === 'interrupted' || why === 'canceled') return;
      state = 'idle';
      token++;
      tell('The device stopped reading (' + (why || 'no reason given') + '). Press Listen to try again.');
    };
    sp.speak(u);
  };
  const restart = () => { token++; sp.cancel(); say(); };
  return {
    play: (list, from = 0) => {
      token++;
      sp.cancel();
      items = list;
      index = Math.max(0, Math.min(from, list.length - 1));
      state = list.length ? 'playing' : 'idle';
      tell();
      if (list.length) say();
    },
    pause: () => { if (state !== 'playing') return; token++; sp.cancel(); state = 'paused'; tell(); },
    resume: () => { if (state !== 'paused') return; state = 'playing'; tell(); say(); },
    stop: () => { token++; sp.cancel(); state = 'idle'; index = 0; tell(); },
    setRate: (r) => { rate = r; if (state === 'playing') restart(); },
    setVoice: (id) => { voice = id; if (state === 'playing') restart(); },
    jump: (i) => {
      if (!items.length) return;
      index = Math.max(0, Math.min(i, items.length - 1));
      if (state === 'playing') { tell(); restart(); } else tell();
    },
    state: () => ({ state, index, items })
  };
}

/** The browser's speech as a Speaker, or null where the browser has none. */
export function browserSpeaker(): Speaker | null {
  const g = globalThis as unknown as { speechSynthesis?: SpeechSynthesis; SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance };
  if (!g.speechSynthesis || !g.SpeechSynthesisUtterance) return null;
  const synth = g.speechSynthesis;
  const U = g.SpeechSynthesisUtterance;
  return {
    make: (text) => new U(text) as unknown as Utterance,
    speak: (u) => synth.speak(u as unknown as SpeechSynthesisUtterance),
    cancel: () => synth.cancel(),
    voice: (id) => synth.getVoices().find((v) => v.voiceURI === id) || null
  };
}

/** The device's voices for the voice list: English first, then the rest, each by name. */
export function voiceChoices(voices: { voiceURI: string; name: string; lang: string; default?: boolean }[]): { id: string; label: string }[] {
  const en = (v: { lang: string }) => /^en\b/i.test(v.lang.replace('_', '-'));
  return voices.slice().sort((a, b) => Number(en(b)) - Number(en(a)) || a.name.localeCompare(b.name))
    .map((v) => ({ id: v.voiceURI, label: v.name + (v.lang ? ' (' + v.lang + ')' : '') }));
}

export const RATES: [number, string][] = [[0.8, 'Slow'], [1, 'Normal'], [1.2, 'Brisk'], [1.4, 'Fast'], [1.7, 'Faster']];

// Speed and voice stay on this device: the iPad and the computer have different voices.
const PREFS = 'story-forge.listen';

export function loadListenPrefs(): { rate: number; voice: string } {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS) || '{}');
    const rate = typeof v.rate === 'number' && v.rate >= 0.5 && v.rate <= 2 ? v.rate : 1;
    return { rate, voice: typeof v.voice === 'string' ? v.voice : '' };
  } catch { return { rate: 1, voice: '' }; }
}

export function saveListenPrefs(p: { rate: number; voice: string }) {
  try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* lasts until reload */ }
}
