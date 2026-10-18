// Listen: the writing screen's read-aloud button and the slim bar under the tool row while it reads (Pause or Resume,
// Back a sentence, Stop, speed, voice). The sentence being read is highlighted in the page where the browser can, and
// always scrolled into view. Speed and voice stay on this device.
import { useEffect, useRef, useState } from 'preact/hooks';
import { browserSpeaker, itemAt, loadListenPrefs, makeReader, RATES, saveListenPrefs, speechItems, voiceChoices, type Reader, type ReaderState, type SpeechItem } from '../lib/listen.ts';
import { rangesIn } from './StyledEditor.tsx';
import { bringIntoView, paintHighlight } from './highlight.ts';
import { Icon } from './Icon.tsx';

/** One scene on the page: its words and the writing box it is in (null for the plain text box). */
export interface ListenPart { text: string; root: () => HTMLElement | null }

export interface Listening {
  supported: boolean;
  state: ReaderState;
  error: string;
  start: () => void;
  reader: Reader | null;
  rate: number;
  setRate: (r: number) => void;
  voice: string;
  setVoice: (v: string) => void;
  voices: { id: string; label: string }[];
}

/** The reader for a page. `parts` gives the page's scenes when Listen is pressed; `from` where to start (the start of the
 * words picked), or null for the top. */
export function useListen(parts: () => ListenPart[], from: () => { part: number; at: number } | null): Listening {
  const prefs = useRef(loadListenPrefs());
  const [rate, setRateState] = useState(prefs.current.rate);
  const [voice, setVoiceState] = useState(prefs.current.voice);
  const [state, setState] = useState<ReaderState>('idle');
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [voices, setVoices] = useState<{ id: string; label: string }[]>([]);
  const items = useRef<SpeechItem[]>([]);
  const roots = useRef<(() => HTMLElement | null)[]>([]);
  const reader = useRef<Reader | null>(null);
  const speaker = useRef(browserSpeaker());

  if (!reader.current && speaker.current) {
    reader.current = makeReader(speaker.current, (s, i, err) => { setState(s); setIndex(i); if (err) setError(err); }, prefs.current);
  }

  // The device's voices arrive a moment after the page loads.
  useEffect(() => {
    const synth = (globalThis as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    if (!synth) return;
    const load = () => setVoices(voiceChoices(synth.getVoices()));
    load();
    synth.addEventListener('voiceschanged', load);
    return () => { synth.removeEventListener('voiceschanged', load); if (reader.current) reader.current.stop(); };
  }, []);

  // The sentence being read: highlighted and in view.
  useEffect(() => {
    const it = state === 'idle' ? null : items.current[index];
    const root = it ? roots.current[it.part] && roots.current[it.part]() : null;
    if (!it || !root) { paintHighlight('sf-listen', []); return; }
    const [r] = rangesIn(root, [{ start: it.start, end: it.end }]);
    paintHighlight('sf-listen', r ? [r] : []);
    if (r && state === 'playing') bringIntoView(r);
  }, [state, index]);
  useEffect(() => () => paintHighlight('sf-listen', []), []);

  const save = (p: { rate: number; voice: string }) => { prefs.current = p; saveListenPrefs(p); };
  return {
    supported: Boolean(speaker.current),
    state, error, reader: reader.current, rate, voice, voices,
    start: () => {
      const r = reader.current;
      if (!r) return;
      setError('');
      const ps = parts();
      roots.current = ps.map((p) => p.root);
      items.current = ps.flatMap((p, i) => speechItems(p.text, i));
      if (!items.current.length) { setError('There are no words to read yet.'); return; }
      const f = from();
      r.play(items.current, f ? itemAt(items.current, f.part, f.at) : 0);
    },
    setRate: (v) => { setRateState(v); save({ rate: v, voice }); if (reader.current) reader.current.setRate(v); },
    setVoice: (v) => { setVoiceState(v); save({ rate, voice: v }); if (reader.current) reader.current.setVoice(v); }
  };
}

/** The tool row's Listen button: starts reading, or stops it. */
export function ListenButton({ l, keep }: { l: Listening; keep?: Record<string, (e: Event) => void> }) {
  const on = l.state !== 'idle';
  return (
    <button type="button" class="tool wide listen-tool" aria-pressed={on} disabled={!l.supported} {...(keep || {})}
      title={!l.supported ? 'This browser cannot read aloud.' : on ? 'Stop reading aloud' : 'Read aloud from the top, or from the words you picked'}
      onClick={() => (on && l.reader ? l.reader.stop() : l.start())}>
      <Icon name="speaker" /><span class="tool-label">{on ? 'Stop' : 'Listen'}</span>
    </button>
  );
}

/** The bar under the tool row while reading: Pause or Resume, Back a sentence, Stop, speed and voice. */
export function ListenBar({ l }: { l: Listening }) {
  const r = l.reader;
  if (l.error && l.state === 'idle') return <p class="tool-said error listen-said" role="status">{l.error}</p>;
  if (!r || l.state === 'idle') return null;
  const at = r.state().index;
  return (
    <div class="listen-bar" role="group" aria-label="Reading aloud">
      {l.state === 'playing'
        ? <button type="button" class="tool" aria-label="Pause" title="Pause" onClick={() => r.pause()}><Icon name="pause" /></button>
        : <button type="button" class="tool" aria-label="Resume" title="Resume from this sentence" onClick={() => r.resume()}><Icon name="play" /></button>}
      <button type="button" class="tool" aria-label="Back a sentence" title="Back a sentence" onClick={() => r.jump(at - 1)}><Icon name="left" /></button>
      <button type="button" class="tool" aria-label="Next sentence" title="Next sentence" onClick={() => r.jump(at + 1)}><Icon name="right" /></button>
      <button type="button" class="tool" aria-label="Stop" title="Stop reading" onClick={() => r.stop()}><Icon name="stop" /></button>
      <span class="listen-where">{l.state === 'paused' ? 'Paused' : 'Reading'} · {at + 1} of {r.state().items.length}</span>
      <label class="listen-pick">
        <span class="visually-hidden">Speed</span>
        <select value={String(l.rate)} onChange={(e) => l.setRate(Number((e.currentTarget as HTMLSelectElement).value))} aria-label="Speed">
          {RATES.map(([v, name]) => <option key={v} value={String(v)}>{name}</option>)}
        </select>
      </label>
      {l.voices.length > 0 && (
        <label class="listen-pick voice">
          <span class="visually-hidden">Voice</span>
          <select value={l.voice} onChange={(e) => l.setVoice((e.currentTarget as HTMLSelectElement).value)} aria-label="Voice">
            <option value="">This device's voice</option>
            {l.voices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
