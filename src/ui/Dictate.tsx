// Dictate (Kyle, 2026-11-26, order C-006): the mic button in the writing screen's tool row and in the row above the
// iPad's keyboard. Press it and speak; press it again and the words go to Kyle's speech server on the Mac mini and come
// back at the cursor. While it listens the button is red; while the server writes the words down a line says so. The
// server's address and password are in Settings, on each device (src/lib/dictation.ts).
import { useEffect, useRef, useState } from 'preact/hooks';
import { addresses, dictationId, lastPlace, loadDictation, saveLastPlace, setupProblem, Upload } from '../lib/dictation.ts';
import { openMic, type Mic } from '../write/mic.ts';
import type { EditorCommands } from '../write/prose.ts';
import { href } from '../app/route.ts';
import { Icon } from './Icon.tsx';

export type DictateState = 'idle' | 'starting' | 'listening' | 'writing';

export interface Dictation {
  state: DictateState;
  said: { text: string; error: boolean; settings?: boolean } | null;
  setSaid: (s: Dictation['said']) => void;
  press: () => void;
}

/** The mic for a page. `box` gives the writing box the words go into when they come back. */
export function useDictate(box: () => EditorCommands | null): Dictation {
  const [state, setState] = useState<DictateState>('idle');
  const [said, setSaid] = useState<Dictation['said']>(null);
  const mic = useRef<Mic | null>(null);
  const up = useRef<Upload | null>(null);
  const live = useRef(true);
  const stateRef = useRef<DictateState>('idle');
  const set = (s: DictateState) => { stateRef.current = s; if (live.current) setState(s); };

  const finish = async () => {
    const m = mic.current, u = up.current;
    mic.current = null;
    if (!m || !u) { set('idle'); return; }
    u.send(m.stop());
    set('writing');
    try {
      const words = await u.finish();
      // The address that answered is tried first next time (home, or away through the VPN).
      const place = u.place();
      if (place) saveLastPlace(place);
      if (!live.current) return;
      if (!words) { setSaid({ text: 'Nothing was heard. Press the mic and speak, then press it again.', error: true }); return; }
      const c = box();
      const at = c ? c.dictate(words) : null;
      if (!at) {
        // No page to put them in (a saved draft on screen): keep them where Kyle can copy them.
        setSaid({ text: 'Your words: ' + words, error: false });
      } else setSaid(null);
    } catch (e) {
      if (live.current) setSaid({ text: (e as Error).message, error: true });
    } finally {
      up.current = null;
      set('idle');
    }
  };

  const start = async () => {
    const s = loadDictation();
    const p = setupProblem(s, location.protocol);
    if (p) { setSaid({ text: p, error: true, settings: true }); return; }
    setSaid(null);
    set('starting');
    const u = new Upload(s, (url, init) => fetch(url, init as RequestInit), dictationId(), addresses(s, lastPlace()));
    up.current = u;
    try {
      mic.current = await openMic((piece) => u.send(piece), () => { if (stateRef.current === 'listening') void finish(); });
      if (!live.current) { mic.current.stop(); mic.current = null; return; }
      set('listening');
    } catch (e) {
      up.current = null;
      set('idle');
      setSaid({ text: (e as Error).message, error: true });
    }
  };

  const press = () => {
    const now = stateRef.current;
    if (now === 'idle') void start();
    else if (now === 'listening') void finish();
  };

  // Leaving the page while listening lets go of the microphone; words not yet written down are dropped.
  useEffect(() => () => { live.current = false; if (mic.current) { mic.current.stop(); mic.current = null; } }, []);

  return { state, said, setSaid, press };
}

/** The mic button for a tool row. */
export function DictateButton({ d, keep }: { d: Dictation; keep: Record<string, (e: Event) => void> }) {
  const label = d.state === 'listening' ? 'Stop and put the words in' : d.state === 'writing' ? 'Writing your words down' : d.state === 'starting' ? 'Starting the microphone' : 'Dictate';
  return (
    <button type="button" class={'tool dictate-button ' + d.state} aria-label={label} title={d.state === 'idle' ? 'Dictate: press, speak, press again' : label}
      aria-pressed={d.state === 'listening'} disabled={d.state === 'writing' || d.state === 'starting'} {...keep} onClick={d.press}>
      <Icon name="mic" />
    </button>
  );
}

/** The line under the tool row while the server writes the words down, or with what went wrong. */
export function DictateLine({ d }: { d: Dictation }) {
  if (d.state === 'listening') return <p class="tool-said dictate-said" role="status"><span class="dictate-dot" aria-hidden="true" /> Listening. Press the mic again when you are done.</p>;
  if (d.state === 'writing') return <p class="tool-said dictate-said" role="status"><span class="job-dot" aria-hidden="true" /> Writing your words down…</p>;
  if (!d.said) return null;
  return (
    <p class={'tool-said ' + (d.said.error ? 'error' : 'ok')} role="status">
      {d.said.text}
      {d.said.settings && <a class="link" href={href.settings()}>Open Settings</a>}
      <button type="button" class="icon-button" aria-label="Close" onClick={() => d.setSaid(null)}><Icon name="close" size={16} /></button>
    </p>
  );
}
