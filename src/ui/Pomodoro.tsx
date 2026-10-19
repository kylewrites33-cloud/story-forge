// The Pomodoro timer. Outside the writing screen it floats at the bottom right; in the writing screen it sits in the top
// bar (and beside Leave focus in Focus mode), so it never covers the words being typed or the toolbar. Pressing it opens
// a small panel: start, pause, stop, the lengths, and today's Pomodoros and words.
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  advance, clock, flushLog, loadLog, loadTimer, msLeft, pause, resume, saveLog, saveTimer,
  startWork, stop, stoppedRecord, today, wordsSoFar, type TimerState
} from '../lib/pomodoro.ts';
import type { NoteRecord, VaultIndex, VaultSource } from '../lib/types.ts';
import { Icon } from './Icon.tsx';

let flushing = false;

/** A short two-note chime, made on the device; silent where the browser has no sound. */
function chime(): void {
  try {
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.25].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 880 : 660;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.7);
    });
    setTimeout(() => { ctx.close().catch(() => undefined); }, 1500);
  } catch { /* no sound */ }
}

const num = (n: number) => n.toLocaleString('en-US');

export function PomodoroTimer({ source, index, variant, onLogged }: {
  source: VaultSource;
  index: VaultIndex | null;
  /** float: bottom right of the page; bar: in the writing screen's top bar; focus: beside Leave focus. */
  variant: 'float' | 'bar' | 'focus';
  onLogged?: (notes: NoteRecord[]) => void;
}) {
  const [s, setS] = useState<TimerState>(loadTimer);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(() => loadLog(source.key));
  const box = useRef<HTMLDivElement>(null);
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
      chime();
    }
    setS(state);
    setNow(t);
  };

  useEffect(() => {
    refresh();
    flush();
    const sync = () => { setS(loadTimer()); setNow(Date.now()); };
    const back = () => { flush(); };
    window.addEventListener('sf-pomodoro', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('online', back);
    return () => { window.removeEventListener('sf-pomodoro', sync); window.removeEventListener('storage', sync); window.removeEventListener('online', back); };
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

  const left = msLeft(s, now);
  const paused = s.pausedLeft != null;
  const day = today(index, waiting, new Date(now));
  const words = s.phase === 'work' ? wordsSoFar(s) : 0;
  const chipText = s.phase === 'work' ? clock(left) : s.phase === 'break' ? 'Break ' + clock(left) : day.pomodoros ? String(day.pomodoros) : '';
  const label = s.phase === 'work' ? 'Pomodoro: ' + clock(left) + ' left' + (paused ? ', paused' : '')
    : s.phase === 'break' ? 'Break: ' + clock(left) + ' left' : 'Pomodoro timer. ' + day.pomodoros + ' today.';

  return (
    <div ref={box} class={'pomodoro pomodoro-' + variant + (s.phase !== 'idle' ? ' is-' + s.phase : '') + (paused ? ' is-paused' : '')}>
      <button type="button" class={variant === 'float' ? 'pomodoro-chip' : 'bar-button pomodoro-chip'} aria-expanded={open} aria-label={label} title={label}
        onClick={() => setOpen(!open)}>
        <Icon name="timer" size={variant === 'float' ? 22 : 20} />
        {chipText && <span class="pomodoro-time">{chipText}</span>}
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
            {s.phase === 'idle' && <button type="button" class="primary" onClick={() => act((c, t) => startWork(c, t))}>Start {s.workMin} minutes</button>}
            {s.phase === 'work' && (paused
              ? <button type="button" class="primary" onClick={() => act(resume)}>Carry on</button>
              : <button type="button" onClick={() => act(pause)}>Pause</button>)}
            {s.phase === 'work' && <button type="button" onClick={stopWork} title="Stops now and keeps the minutes and words so far">Stop</button>}
            {s.phase === 'break' && <button type="button" class="primary" onClick={() => act((c, t) => startWork(c, t))}>Skip the break</button>}
            {s.phase === 'break' && <button type="button" onClick={() => act((c) => stop(c))}>Stop</button>}
          </div>
          {s.phase === 'idle' && <p class="hint">{s.workMin} minutes of writing, then a {s.breakMin} minute break.</p>}
          <p class="pomodoro-today"><strong>Today:</strong> {day.pomodoros} {day.pomodoros === 1 ? 'Pomodoro' : 'Pomodoros'}, {num(day.minutes)} {day.minutes === 1 ? 'minute' : 'minutes'}, {num(day.words)} words.</p>
          {waiting.length > 0 && <p class="hint">{waiting.length === 1 ? '1 Pomodoro is' : waiting.length + ' Pomodoros are'} saved on this device and go to the vault's Writing Log when you are online.</p>}
          <p class="hint">A Pomodoro counts when its time runs out. If you stop early, its minutes and words still go in today's log.</p>
          {error && <p class="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
