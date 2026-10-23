// The Pomodoro's two sounds (Kyle, 2026-10-22: "chirp at the end of 25, and a different chirp after 5"). Kyle didn't
// hear the first version on the iPad (2026-10-22), so they are short sound files made on the device and played through a
// plain audio player, which the iPad plays even on silent. The chirps then sounded like an alarm, so they are now soft
// bell chimes (Kyle, 2026-10-23: "more bright and cheerful"): a rising four-note major arpeggio when the writing ends,
// a gentle two-note ding-ding, played twice, when the break ends. The iPad only lets a page play sound after a touch or
// key press, so the first one anywhere quietly starts and stops each player; after that the timer can play them on its
// own. The screen is also kept awake while a timer runs, because a sleeping iPad stops the page and nothing can play.

/** [start s, pitch Hz]. */
type Note = [number, number];
const RATE = 22050;

/** A WAV file of soft bell notes: a quick attack, a long fading ring and a faint overtone. */
function wav(notes: Note[], length: number): Blob {
  const n = Math.round(length * RATE);
  const data = new Float32Array(n);
  const ring = 1.1;
  for (const [start, f] of notes) {
    const s0 = Math.round(start * RATE);
    const len = Math.round(ring * RATE);
    for (let i = 0; i < len && s0 + i < n; i++) {
      const t = i / RATE;
      const env = Math.min(1, t / 0.006) * Math.exp(-t * 4.5);
      const w = 2 * Math.PI * f * t;
      data[s0 + i] += env * (0.75 * Math.sin(w) + 0.18 * Math.sin(2 * w) * Math.exp(-t * 6) + 0.07 * Math.sin(3 * w) * Math.exp(-t * 9));
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
  const gain = peak ? 0.8 / peak : 1;
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

// C, E, G, high C: a bright "well done" rising run.
const WORK: Note[] = [[0, 1046.5], [0.13, 1318.5], [0.26, 1568], [0.39, 2093]];
// G then C, twice: a friendly "back to it".
const BREAK: Note[] = [[0, 1568], [0.22, 2093], [0.7, 1568], [0.92, 2093]];

const players: Record<'work' | 'break', HTMLAudioElement | null> = { work: null, break: null };
let unlocked = false;
/** Players asked to chirp, which the silent start must not stop. */
const real = new Set<HTMLAudioElement>();

function player(kind: 'work' | 'break'): HTMLAudioElement | null {
  if (players[kind]) return players[kind];
  if (typeof Audio === 'undefined' || typeof URL === 'undefined') return null;
  try {
    const a = new Audio(URL.createObjectURL(kind === 'work' ? wav(WORK, 1.6) : wav(BREAK, 2.1)));
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
