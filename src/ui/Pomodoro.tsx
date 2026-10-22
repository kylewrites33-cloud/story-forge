// The Pomodoro timer. Outside the writing screen it floats at the bottom right; in the writing screen it sits in the top
// bar (and beside Leave focus in Focus mode), so it never covers the words being typed or the toolbar. Pressing it when
// nothing runs starts a Pomodoro at once (Kyle, 2026-10-22); pressing it while one runs, or holding it at any time, opens
// a small panel: start, pause, stop, and today's Pomodoros and words typed. It also sends the words typed,
// counted with or without a Pomodoro, to the day's Writing Log note.
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  advance, clock, flushLog, flushTyped, loadLog, loadTimer, loadTyped, msLeft, pause, resume, saveLog, saveTimer, typedDue,
  pomodoroCount, startWork, stop, stoppedRecord, today, wordsSoFar, type TimerState
} from '../lib/pomodoro.ts';
import type { NoteRecord, VaultIndex, VaultSource } from '../lib/types.ts';
import { Icon } from './Icon.tsx';

let flushing = false;
let sendingTyped = false;

// Two bird-like chirps, made on the device (Kyle, 2026-10-22: "chirp at the end of 25, and a different chirp after 5"):
// two quick rising chirps when the writing ends, three falling ones when the break ends. iPad browsers only let a page
// play sound after a touch or key press, so the first one anywhere unlocks one shared sound player; silent where the
// browser has no sound.
type Ctx = AudioContext;
let audio: Ctx | null = null;

function player(): Ctx | null {
  if (audio) return audio;
  const w = window as unknown as { AudioContext?: { new(): Ctx }; webkitAudioContext?: { new(): Ctx } };
  const C = w.AudioContext || w.webkitAudioContext;
  if (!C) return null;
  try { audio = new C(); } catch { return null; }
  return audio;
}

function unlockSound(): void {
  const ctx = player();
  if (!ctx) return;
  try {
    if (ctx.state !== 'running') ctx.resume().catch(() => undefined);
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch { /* no sound */ }
}

if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlockSound, { capture: true, passive: true });
}

/** Play chirps: each is [start s, from Hz, to Hz]. */
function chirps(notes: [number, number, number][]): void {
  const ctx = player();
  if (!ctx) return;
  try {
    if (ctx.state !== 'running') ctx.resume().catch(() => undefined);
    const at = ctx.currentTime + 0.05;
    for (const [t, from, to] of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(from, at + t);
      o.frequency.exponentialRampToValueAtTime(to, at + t + 0.09);
      g.gain.setValueAtTime(0.0001, at + t);
      g.gain.exponentialRampToValueAtTime(0.3, at + t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + t + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(at + t);
      o.stop(at + t + 0.14);
    }
  } catch { /* no sound */ }
}

/** The writing block is over: two quick rising chirps. */
const workDoneChirp = () => chirps([[0, 2200, 3600], [0.16, 2200, 3600]]);
/** The break is over: three falling chirps, lower. */
const breakDoneChirp = () => chirps([[0, 2600, 1500], [0.2, 2400, 1400], [0.4, 2200, 1300]]);

const num = (n: number) => n.toLocaleString('en-US');

export function PomodoroTimer({ source, index, variant, onLogged }: {
  source: VaultSource;
  index: VaultIndex | null;
  /** float: bottom right of the page; bar: in the writing screen's top bar; focus: beside Leave focus. */
  variant: 'float' | 'bar' | 'focus' | 'rail';
  onLogged?: (notes: NoteRecord[]) => void;
}) {
  const [s, setS] = useState<TimerState>(loadTimer);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(() => loadLog(source.key));
  const box = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const onLoggedRef = useRef(onLogged);
  onLoggedRef.current = onLogged;

  const flush = async () => {
    if (flushing || !source.write || !navigator.onLine || !loadLog(source.key).length) return;
    flushing = true;
    try {
      const saved = await flushLog(source, new Date());
      setError('');
      if (saved.length && onLoggedRef.current) onLoggedRef.current(saved);
    } catch (e) {
      setError('A finished Pomodoro is saved on this device and goes to the vault later. ' + (e as Error).message);
    } finally {
      flushing = false;
      setWaiting(loadLog(source.key));
    }
  };

  /** Send the words typed to the day's note when they are due (or now, when the page is put away). */
  const sendTyped = async (force = false) => {
    if (sendingTyped || !source.write || !navigator.onLine) return;
    const t = loadTyped();
    if (!Object.keys(t.days).length || (!force && !typedDue(t, Date.now()))) return;
    sendingTyped = true;
    try {
      const saved = await flushTyped(source, new Date());
      if (saved.length && onLoggedRef.current) onLoggedRef.current(saved);
    } catch { /* they stay on this device and go next time */ }
    finally { sendingTyped = false; }
  };

  /** Read the stored timer, move it on if its time is up, and show it. */
  const refresh = () => {
    const t = Date.now();
    const cur = loadTimer();
    const { state, record } = advance(cur, t);
    if (state !== cur) {
      saveTimer(state);
      if (record) {
        saveLog(source.key, loadLog(source.key).concat(record));
        setWaiting(loadLog(source.key));
        flush();
      }
      // Only when the time ran out just now, not when the app is opened long after.
      if (cur.endsAt != null && t - cur.endsAt < 60000) (cur.phase === 'work' ? workDoneChirp : breakDoneChirp)();
    }
    setS(state);
    setNow(t);
  };

  useEffect(() => {
    refresh();
    flush();
    const sync = () => { setS(loadTimer()); setNow(Date.now()); };
    const back = () => { flush(); sendTyped(true); };
    const away = () => { if (document.visibilityState === 'hidden') sendTyped(true); };
    const tick = setInterval(() => { sendTyped(); }, 30000);
    sendTyped(true);
    window.addEventListener('sf-pomodoro', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('online', back);
    document.addEventListener('visibilitychange', away);
    return () => {
      clearInterval(tick);
      window.removeEventListener('sf-pomodoro', sync); window.removeEventListener('storage', sync); window.removeEventListener('online', back);
      document.removeEventListener('visibilitychange', away);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const running = s.phase !== 'idle' && s.endsAt != null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, source]);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);

  /** Stop a work Pomodoro early: its minutes and words still go to the Writing Log. */
  const stopWork = () => {
    const record = stoppedRecord(loadTimer(), Date.now());
    act((c) => stop(c));
    if (record) {
      saveLog(source.key, loadLog(source.key).concat(record));
      setWaiting(loadLog(source.key));
      flush();
    }
  };

  const act = (fn: (cur: TimerState, t: number) => TimerState) => {
    const t = Date.now();
    const next = fn(loadTimer(), t);
    saveTimer(next);
    setS(next);
    setNow(t);
  };

  // A hold (finger or mouse) or a right-click opens the panel without starting anything.
  const endHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); holdTimer.current = null; };
  const onDown = () => {
    held.current = false;
    endHold();
    holdTimer.current = setTimeout(() => { holdTimer.current = null; held.current = true; setOpen(true); }, 450);
  };
  const onPress = () => {
    endHold();
    if (held.current) { held.current = false; return; }
    if (open) { setOpen(false); return; }
    if (s.phase === 'idle') act((c, t) => startWork(c, t));
    else setOpen(true);
  };

  const left = msLeft(s, now);
  const paused = s.pausedLeft != null;
  const day = today(index, waiting, new Date(now), loadTyped());
  const done = pomodoroCount(day.minutes);
  const words = s.phase === 'work' ? wordsSoFar(s) : 0;
  // While it runs the button only changes colour; the time shows when Kyle opens the panel (Kyle, 2026-10-20).
  const chipText = s.phase === 'idle' && day.minutes ? done : '';
  const label = s.phase === 'work' ? 'Pomodoro: ' + clock(left) + ' left' + (paused ? ', paused' : '')
    : s.phase === 'break' ? 'Break: ' + clock(left) + ' left' : 'Start a Pomodoro (' + done + ' today). Hold for more.';

  return (
    <div ref={box} class={'pomodoro pomodoro-' + variant + (s.phase !== 'idle' ? ' is-' + s.phase : '') + (paused ? ' is-paused' : '')}>
      <button type="button" class={variant === 'float' ? 'pomodoro-chip' : variant === 'rail' ? 'rail-item pomodoro-chip' : 'bar-button pomodoro-chip'} aria-expanded={open} aria-label={label} title={label}
        data-own-hold onClick={onPress} onPointerDown={onDown} onPointerUp={endHold} onPointerCancel={endHold} onPointerLeave={endHold}
        onContextMenu={(e) => { e.preventDefault(); endHold(); held.current = false; setOpen(true); }}>
        <Icon name="timer" size={variant === 'float' ? 22 : 20} />
        {variant === 'rail' && <span class="rail-label">{s.phase === 'work' ? (paused ? 'Paused' : 'Writing') : s.phase === 'break' ? 'Break' : 'Timer'}</span>}
        {chipText && <span class="pomodoro-time rail-count">{chipText}</span>}
      </button>
      {open && (
        <div class="pomodoro-panel" role="dialog" aria-label="Pomodoro timer">
          <p class="pomodoro-now">
            {s.phase === 'work' ? (paused ? 'Paused. ' : 'Writing. ') + clock(left) + ' left.'
              : s.phase === 'break' ? 'Break. ' + clock(left) + ' left.'
              : s.justDone && now - s.justDone.at < 30 * 60000 ? 'Break over. Ready for the next one?' : 'Ready when you are.'}
          </p>
          {s.phase === 'work' && <p class="hint">{num(words)} {words === 1 ? 'word' : 'words'} so far in this one.</p>}
          {s.phase === 'break' && s.justDone && <p class="hint">That one: {num(s.justDone.words)} {s.justDone.words === 1 ? 'word' : 'words'}.</p>}
          <div class="pomodoro-actions">
            {s.phase === 'idle' && <button type="button" class="primary" onClick={() => { act((c, t) => startWork(c, t)); setOpen(false); }}>Start {s.workMin} minutes</button>}
            {s.phase === 'work' && (paused
              ? <button type="button" class="primary" onClick={() => { act(resume); setOpen(false); }}>Carry on</button>
              : <button type="button" onClick={() => act(pause)}>Pause</button>)}
            {s.phase === 'work' && <button type="button" onClick={stopWork} title="Stops now and keeps the minutes and words so far">Stop</button>}
            {s.phase === 'break' && <button type="button" class="primary" onClick={() => { act((c, t) => startWork(c, t)); setOpen(false); }}>Skip the break</button>}
            {s.phase === 'break' && <button type="button" onClick={() => act((c) => stop(c))}>Stop</button>}
          </div>
          <p class="pomodoro-today"><strong>Today:</strong> {num(day.typed)} {day.typed === 1 ? 'word' : 'words'} typed, {done} {done === '1' ? 'Pomodoro' : 'Pomodoros'} ({num(day.minutes)} {day.minutes === 1 ? 'minute' : 'minutes'}).</p>
          {waiting.length > 0 && <p class="hint">{waiting.length === 1 ? '1 Pomodoro is' : waiting.length + ' Pomodoros are'} saved on this device and go to the vault's Writing Log when you are online.</p>}
          {error && <p class="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
