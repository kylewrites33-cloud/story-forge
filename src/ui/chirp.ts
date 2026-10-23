// The Pomodoro's two sounds (Kyle, 2026-10-22: "chirp at the end of 25, and a different chirp after 5"). Kyle didn't
// hear the first version on the iPad (2026-10-22), so they are short sound files made on the device and played through a
// plain audio player, which the iPad plays even on silent. The first chirps sounded like an alarm and bells weren't
// birds (Kyle, 2026-10-23: "i do kind of still want it to be bird chirps ... a soothing small bird sound"), so they are
// now soft songbird calls, twelve to pick from (see BIRDS). The iPad only lets a page play sound after a touch or key
// press, so each press quietly starts and stops the two picked players; after that the timer can play them on its own. The screen is also kept awake while a timer runs,
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

/** The twelve birds Kyle can pick from in Settings, Timer sound (Kyle, 2026-10-23: "give me 12 different bird options
 * in settings, and then I can choose ... what to select for end of writing and end of break"). The first two are the
 * ones he liked. All are made by the app: real recordings wait on network access to a free sound library. */
export interface Bird { id: string; name: string; line: string; notes: Note[] }

const trill = (start: number, count: number, gap: number, len: number, hi: number, lo: number): Note[] =>
  Array.from({ length: count }, (_, i) => [start + i * gap, len, i % 2 ? lo : hi, i % 2 ? lo - 200 : hi - 200, 0] as Note);

export const BIRDS: Bird[] = [
  { id: 'little-song', name: 'Little song', line: 'Two sweet notes, a soft trill, a falling note', notes: [
    [0, 0.11, 2900, 3500, 0], [0.18, 0.11, 2900, 3500, 0],
    [0.38, 0.05, 3800, 3500, 0], [0.45, 0.05, 3750, 3450, 0], [0.52, 0.05, 3700, 3400, 0], [0.59, 0.05, 3650, 3350, 0],
    [0.7, 0.24, 3500, 2700, 90]] },
  { id: 'tsweet', name: 'Two tsweets', line: 'Two slow, rising calls', notes: [[0, 0.26, 2400, 3300, 70], [0.55, 0.26, 2400, 3300, 70]] },
  { id: 'fee-bee', name: 'Fee-bee', line: 'A clear two-note whistle, high then lower', notes: [[0, 0.34, 3900, 3850, 0], [0.42, 0.38, 3300, 3200, 0]] },
  { id: 'cheer-up', name: 'Cheer-up', line: 'A robin\'s rolling carol', notes: [
    [0, 0.17, 2300, 2900, 110], [0.24, 0.15, 2900, 2450, 110], [0.5, 0.18, 2250, 2800, 110], [0.78, 0.16, 2750, 2350, 110]] },
  { id: 'birdy', name: 'Birdy birdy', line: 'Four bright downward slurs', notes: [0, 0.2, 0.4, 0.6].map((t) => [t, 0.14, 3900, 2100, 0] as Note) },
  { id: 'twitter', name: 'Twitter', line: 'A quick finch-like chatter', notes: trill(0, 10, 0.07, 0.045, 4200, 3700) },
  { id: 'wren', name: 'Wren trill', line: 'A trill that speeds up and rises', notes: [0, 0.13, 0.25, 0.36, 0.46, 0.55, 0.63, 0.7, 0.76, 0.81]
    .map((t, i) => [t, 0.05, 3000 + i * 90, 2700 + i * 90, 0] as Note) },
  { id: 'sweet-sweet', name: 'Sweet sweet', line: 'Three even notes, then a soft buzz', notes: [
    [0, 0.09, 3000, 3050, 0], [0.18, 0.09, 3000, 3050, 0], [0.36, 0.09, 3000, 3050, 0], [0.55, 0.38, 4000, 3500, 260]] },
  { id: 'chips', name: 'Potato chips', line: 'Four quick rising chips', notes: [0, 0.12, 0.24, 0.36].map((t) => [t, 0.07, 2800, 3700, 0] as Note) },
  { id: 'teacher', name: 'Tea-cher', line: 'Three soft two-part calls', notes: [0, 0.4, 0.8]
    .flatMap((t) => [[t, 0.13, 3000, 3600, 0], [t + 0.16, 0.15, 3500, 2800, 0]] as Note[]) },
  { id: 'tur-wee', name: 'Tur-wee', line: 'A low, gentle bluebird call', notes: [[0, 0.24, 1800, 2400, 60], [0.33, 0.3, 2400, 1900, 60]] },
  { id: 'duet', name: 'Morning duet', line: 'A high call and a lower answer', notes: [
    [0, 0.12, 3600, 4000, 0], [0.16, 0.16, 4000, 3400, 0], [0.55, 0.14, 2600, 2900, 50], [0.74, 0.2, 2900, 2300, 50]] },
];

export type Moment = 'work' | 'break';
const PICK_KEY = 'sf-timer-sounds';
const DEFAULT_PICK: Record<Moment, string> = { work: 'little-song', break: 'tsweet' };

/** Which bird plays at the end of writing and at the end of the break, on this device. */
export function loadPick(): Record<Moment, string> {
  try {
    const p = JSON.parse(localStorage.getItem(PICK_KEY) || '{}') as Partial<Record<Moment, string>>;
    const ok = (id?: string) => !!id && BIRDS.some((b) => b.id === id);
    return { work: ok(p.work) ? p.work! : DEFAULT_PICK.work, break: ok(p.break) ? p.break! : DEFAULT_PICK.break };
  } catch { return { ...DEFAULT_PICK }; }
}

export function savePick(moment: Moment, id: string): void {
  const p = { ...loadPick(), [moment]: id };
  try { localStorage.setItem(PICK_KEY, JSON.stringify(p)); } catch { /* kept for this visit only */ }
}

const players = new Map<string, HTMLAudioElement>();
/** Players asked to sing, which the silent start must not stop. */
const real = new Set<HTMLAudioElement>();
const unlocked = new Set<string>();

function player(id: string): HTMLAudioElement | null {
  const known = players.get(id);
  if (known) return known;
  const bird = BIRDS.find((b) => b.id === id);
  if (!bird || typeof Audio === 'undefined' || typeof URL === 'undefined') return null;
  try {
    const end = Math.max(...bird.notes.map(([t, d]) => t + d)) + 0.15;
    const a = new Audio(URL.createObjectURL(wav(bird.notes, end)));
    a.preload = 'auto';
    players.set(id, a);
    return a;
  } catch { return null; }
}

/** On a touch or key press, start and stop the two picked players without a sound, so the iPad lets them play later. */
function unlock(): void {
  const pick = loadPick();
  for (const id of [pick.work, pick.break]) {
    if (unlocked.has(id)) continue;
    const a = player(id);
    if (!a) continue;
    unlocked.add(id);
    a.muted = true;
    a.play().then(() => { if (!real.has(a)) { a.pause(); a.currentTime = 0; } a.muted = false; })
      .catch(() => { a.muted = false; unlocked.delete(id); });
  }
}

if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
}

/** Play one bird by its id (Settings uses this to try them). */
export function playBird(id: string): void {
  const a = player(id);
  if (!a) return;
  try {
    real.add(a);
    unlocked.add(id);
    a.muted = false;
    a.volume = 1;
    a.currentTime = 0;
    a.play().catch(() => undefined);
  } catch { /* no sound */ }
}

/** Play the bird picked for this moment: 'work' when the writing ends, 'break' when the break ends. */
export function chirp(moment: Moment): void {
  playBird(loadPick()[moment]);
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
