// The microphone for Dictate (2026-11-26): the browser's sound, turned into the speech server's pieces of raw PCM as
// Kyle speaks (`PcmPieces` in src/lib/dictation.ts). Works in WebKit (the iPad's Chrome and Safari) and desktop Chrome.
// The sound context is made in the press itself, before anything waits, because the iPad only starts sound from a press.
import { MAX_SECONDS, PcmPieces } from '../lib/dictation.ts';

export interface Mic {
  /** Stop listening; answers the last, part-full piece (maybe empty). */
  stop: () => Uint8Array;
}

/** A plain sentence for a microphone that would not open. */
export function micProblem(e: unknown): string {
  const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'The microphone is turned off for this browser. On the iPad open Settings, then Chrome (or Safari), and turn Microphone on. Then press the mic again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found on this device.';
  if (name === 'NotReadableError') return 'Another app is using the microphone. Close it and press the mic again.';
  return 'The microphone would not start. Press the mic again.';
}

type Ctx = AudioContext;
/** One sound context for every dictation on this page, made at the first press and put to sleep between: the iPad
 * keeps only a few, and a fresh one each time can stay silent. */
let shared: Ctx | null = null;

/** Start listening. Call it straight from the press. `onPiece` gets each full piece; `onLimit` is called when the
 * longest dictation is reached (the caller stops). Throws a plain sentence when the microphone will not open. */
export async function openMic(onPiece: (p: Uint8Array) => void, onLimit: () => void): Promise<Mic> {
  const w = globalThis as unknown as { AudioContext?: new () => Ctx; webkitAudioContext?: new () => Ctx };
  const AC = w.AudioContext || w.webkitAudioContext;
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  if (!AC || !md || !md.getUserMedia) throw new Error('This browser cannot use the microphone here.');
  if (!shared || shared.state === 'closed') shared = new AC();
  const ctx = shared;
  // In the press: the iPad keeps a context woken outside one silent.
  void ctx.resume();
  let stream: MediaStream;
  try {
    stream = await md.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    void ctx.suspend();
    throw new Error(micProblem(e));
  }
  // Waiting for the permission question can end the press's say-so; ask once more, and never wait on it for long.
  if (ctx.state !== 'running') { try { await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 1500))]); } catch { /* it starts with the sound */ } }
  const pieces = new PcmPieces(ctx.sampleRate);
  const source = ctx.createMediaStreamSource(stream);
  // A script processor rather than a worklet: one file, and every WebKit the iPad runs has it.
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const quiet = ctx.createGain();
  quiet.gain.value = 0;
  let heard = 0, done = false;
  proc.onaudioprocess = (e) => {
    if (done) return;
    const input = e.inputBuffer.getChannelData(0);
    heard += input.length;
    for (const p of pieces.push(input)) onPiece(p);
    if (heard / ctx.sampleRate >= MAX_SECONDS) onLimit();
  };
  // The processor only runs while joined to the speakers; the gain of 0 keeps it silent.
  source.connect(proc); proc.connect(quiet); quiet.connect(ctx.destination);
  return {
    stop: () => {
      if (done) return new Uint8Array(0);
      done = true;
      try { source.disconnect(); proc.disconnect(); quiet.disconnect(); } catch { /* already apart */ }
      for (const t of stream.getTracks()) t.stop();
      void ctx.suspend();
      return pieces.rest();
    }
  };
}
