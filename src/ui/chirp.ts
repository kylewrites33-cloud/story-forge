// The Pomodoro's two sounds (Kyle, 2026-10-22: "chirp at the end of 25, and a different chirp after 5"). Kyle didn't
// hear the first version on the iPad (2026-10-22), so they are short sound files made on the device and played through a
// plain audio player, which the iPad plays even on silent. The first chirps sounded like an alarm and bells weren't
// birds (Kyle, 2026-10-23: "i do kind of still want it to be bird chirps ... a soothing small bird sound"), so they are
// now soft songbird calls: a little warbled song when the writing ends, two slow rising "tsweet" calls when the break
// ends. The iPad only lets a page play sound after a touch or key press, so the first one anywhere quietly starts and
// stops each player; after that the timer can play them on its own. The screen is also kept awake while a timer runs,
// because a sleeping iPad stops the page and nothing can play.

/** One bird syllable: [start s, length s, from Hz, to Hz, warble Hz]. */
type Note = [number, number, number, number, number];
const RATE = 22050;

/** A WAV file of soft bird syllables: a smooth swell and fade, a glide, a gentle warble, a faint overtone. */
function wav(notes: Note[], length: number): Blob {
  const n = Math.round(length * RATE);
  const data = new Float32Array(n);
  for (const [start, dur, from, to, warble] of notes) {
    const s0 = Math.round(start * RATE);
    const len = Math.round(dur * RATE);
    let phase = 0;
    for (let i = 0; i < len && s0 + i < n; i++) {
      const x = i / len;
      const t = i / RATE;
      const f = from + (to - from) * x + warble * Math.sin(2 * Math.PI * 28 * t);
      phase += (2 * Math.PI * f) / RATE;
      const env = Math.pow(Math.sin(Math.PI * x), 2);
      data[s0 + i] += env * (0.9 * Math.sin(phase) + 0.1 * Math.sin(2 * phase));
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
  const gain = peak ? 0.55 / peak : 1;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i] * gain)) * 32767, true);
  return new Blob([buf], { type: 'audio/wav' });
}

// A small songbird's phrase: two sweet notes, a short soft trill, a falling last note.
const WORK: Note[] = [
  [0, 0.11, 2900, 3500, 0], [0.18, 0.11, 2900, 3500, 0],
  [0.38, 0.05, 3800, 3500, 0], [0.45, 0.05, 3750, 3450, 0], [0.52, 0.05, 3700, 3400, 0], [0.59, 0.05, 3650, 3350, 0],
  [0.7, 0.24, 3500, 2700, 90],
];
// Two slow, rising "tsweet" calls.
const BREAK: Note[] = [[0, 0.26, 2400, 3300, 70], [0.55, 0.26, 2400, 3300, 70]];

const players: Record<'work' | 'break', HTMLAudioElement | null> = { work: null, break: null };
let unlocked = false;
/** Players asked to chirp, which the silent start must not stop. */
const real = new Set<HTMLAudioElement>();

function player(kind: 'work' | 'break'): HTMLAudioElement | null {
  if (players[kind]) return players[kind];
  if (typeof Audio === 'undefined' || typeof URL === 'undefined') return null;
  try {
    const a = new Audio(URL.createObjectURL(kind === 'work' ? wav(WORK, 1.1) : wav(BREAK, 1.0)));
    a.preload = 'auto';
    players[kind] = a;
    return a;
  } catch { return null; }
}

/** On the first touch or key press, start and stop each player without a sound, so the iPad lets them play later. */
function unlock(): void {
  if (unlocked) return;
  unlocked = true;
  for (const kind of ['work', 'break'] as const) {
    const a = player(kind);
    if (!a) continue;
    a.muted = true;
    a.play().then(() => { if (!real.has(a)) { a.pause(); a.currentTime = 0; } a.muted = false; }).catch(() => { a.muted = false; unlocked = false; });
  }
}

if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
}

/** Play a chirp: 'work' when the writing ends, 'break' when the break ends. */
export function chirp(kind: 'work' | 'break'): void {
  const a = player(kind);
  if (!a) return;
  try {
    real.add(a);
    a.muted = false;
    a.volume = 1;
    a.currentTime = 0;
    a.play().catch(() => undefined);
  } catch { /* no sound */ }
}

// ------------------------------------------------------------------ keep the screen awake

type Lock = { release: () => Promise<void>; released?: boolean };
let lock: Lock | null = null;
let wanted = false;

async function takeLock(): Promise<void> {
  const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Lock> } };
  if (!nav.wakeLock || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
  try { lock = await nav.wakeLock.request('screen'); } catch { lock = null; }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (wanted) takeLock(); });
}

/** Keep the screen on while a timer runs (where the browser allows it), and let it sleep again after. */
export function keepAwake(on: boolean): void {
  wanted = on;
  if (on) { takeLock(); return; }
  if (lock) { const l = lock; lock = null; l.release().catch(() => undefined); }
}
