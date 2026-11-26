// Dictate (Kyle, 2026-11-26, order C-006: "Also for the dictation inside the Sparrow app, yes, let's definitely make a
// button within the app."): the writing screen's mic button sends what Kyle says to his own speech server on the Mac
// mini and puts the words at the cursor. This file is the part with no browser in it, tested with Node: the server's
// address and password on this device, the sound turned into the server's raw PCM, the upload and the finish, and how
// the words sit next to the text already there. The microphone itself is `src/write/mic.ts`.
//
// The server's protocol (the order, 2026-11-26): each piece of sound is PUT to /v1/dictation/{id}/chunk/{seq}, counted
// from 0; then POST /v1/dictation/{id}/finish?chunks=N&bytes=B answers with the text. The password goes with every
// request as `Authorization: Bearer <password>`. The sound is 16-bit signed little-endian mono at 16,000 a second.
// If the server's notes say otherwise, the constants and `headers` below are the only places to change.
import { PREF, readJson, writeJson } from './prefs.ts';

/** The sound the server takes: samples a second. */
export const RATE = 16000;
/** About how much sound goes up in one piece, in seconds. */
export const CHUNK_SECONDS = 1;
/** The longest one dictation runs before it stops by itself, in seconds. */
export const MAX_SECONDS = 5 * 60;

/** The speech server on this device. Never in the vault or a repository: Kyle types it into Settings on each device. */
export interface DictationSettings { address: string; password: string }

export function loadDictation(): DictationSettings {
  const d = readJson(PREF.dictation) as Partial<DictationSettings> | null;
  return { address: typeof d?.address === 'string' ? d.address : '', password: typeof d?.password === 'string' ? d.password : '' };
}

export function saveDictation(s: DictationSettings): void {
  const address = cleanAddress(s.address), password = s.password.trim();
  writeJson(PREF.dictation, address || password ? { address, password } : null);
}

/** Whether there is an address to send to. */
export function dictationReady(s: DictationSettings): boolean { return cleanAddress(s.address) !== ''; }

/** The address as typed, tidied: https:// added when there is no start, no slash at the end. */
export function cleanAddress(a: string): string {
  let s = a.trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^[a-z]+:\/\//i.test(s)) s = 'https://' + s;
  return s;
}

/** A plain sentence when this address cannot work from this page, else null. Safari will not let an https page (the
 * app) call a plain http address. */
export function addressProblem(address: string, pageProtocol: string): string | null {
  const a = cleanAddress(address);
  if (!a) return 'Type the speech server\'s address in Settings, under Dictation.';
  let u: URL;
  try { u = new URL(a); } catch { return 'The speech server\'s address does not look right. It should look like https://mac-mini.example.net.'; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'The speech server\'s address should start with https://.';
  if (u.protocol === 'http:' && pageProtocol === 'https:') return 'The speech server\'s address starts with http://, which the iPad blocks from this page. Use its https:// address.';
  return null;
}

/** A fresh name for one dictation. */
export function dictationId(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 16; i++) s += Math.floor(rand() * 16).toString(16);
  return s;
}

// ---- the sound ----

/** Turn the microphone's samples (any rate, -1 to 1) into the server's rate by averaging each stretch. */
export function downsample(input: Float32Array, from: number, to = RATE): Float32Array {
  if (from === to) return input.slice();
  if (from < to) {
    // Rare (a slow microphone): stretch by repeating the nearest sample.
    const out = new Float32Array(Math.floor(input.length * to / from));
    for (let i = 0; i < out.length; i++) out[i] = input[Math.min(input.length - 1, Math.floor(i * from / to))];
    return out;
  }
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b; j++) sum += input[j];
    out[i] = b > a ? sum / (b - a) : 0;
  }
  return out;
}

/** Samples (-1 to 1) as 16-bit signed little-endian bytes. */
export function toPcm16(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
  }
  return out;
}

/** Keeps the samples resampled so far and hands out full pieces of about CHUNK_SECONDS. */
export class PcmPieces {
  private parts: Float32Array[] = [];
  private held = 0;
  private carry: Float32Array = new Float32Array(0);
  readonly size: number;
  private from: number;
  constructor(from: number, seconds = CHUNK_SECONDS) { this.from = from; this.size = Math.round(RATE * seconds); }
  /** Add the microphone's samples; answers the pieces now full, as PCM bytes. */
  push(samples: Float32Array): Uint8Array[] {
    // Resample with the leftover few samples in front so the stretches line up across calls.
    const joined = new Float32Array(this.carry.length + samples.length);
    joined.set(this.carry); joined.set(samples, this.carry.length);
    const ratio = this.from / RATE;
    const usable = ratio > 1 ? Math.floor(Math.floor(joined.length / ratio) * ratio) : joined.length;
    this.carry = joined.slice(usable);
    const down = downsample(joined.subarray(0, usable), this.from);
    this.parts.push(down); this.held += down.length;
    const out: Uint8Array[] = [];
    while (this.held >= this.size) out.push(toPcm16(this.take(this.size)));
    return out;
  }
  /** What is left, as PCM bytes (empty when nothing is). */
  rest(): Uint8Array { return this.held ? toPcm16(this.take(this.held)) : new Uint8Array(0); }
  private take(n: number): Float32Array {
    const out = new Float32Array(n);
    let at = 0;
    while (at < n) {
      const p = this.parts[0];
      const k = Math.min(p.length, n - at);
      out.set(p.subarray(0, k), at); at += k;
      if (k === p.length) this.parts.shift(); else this.parts[0] = p.subarray(k);
    }
    this.held -= n;
    return out;
  }
}

// ---- the server ----

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body?: Uint8Array; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

function headers(s: DictationSettings, body: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (s.password.trim()) h.Authorization = 'Bearer ' + s.password.trim();
  if (body) h['Content-Type'] = 'application/octet-stream';
  return h;
}

/** A plain sentence for a failed request. */
export function serverProblem(status: number | null): string {
  if (status === null) return 'Could not reach the speech server. Check the Mac mini is on and the address in Settings, under Dictation.';
  if (status === 401 || status === 403) return 'The speech server did not take the password. Check it in Settings, under Dictation.';
  if (status === 413) return 'That was too long for the speech server in one go. Try a shorter stretch.';
  return 'The speech server had a problem (' + status + '). Try again in a moment.';
}

/** The words in the server's answer: JSON with `text`, or the text itself. */
export function answerText(body: string): string {
  const t = body.trim();
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t) as { text?: unknown; transcript?: unknown };
      const w = typeof j.text === 'string' ? j.text : typeof j.transcript === 'string' ? j.transcript : '';
      return w.trim();
    } catch { /* not JSON after all */ }
  }
  return t;
}

/** One dictation going up to the server: pieces go up in order as they come, one at a time, and finish waits for them. */
export class Upload {
  readonly id: string;
  private seq = 0;
  private bytes = 0;
  private chain: Promise<void> = Promise.resolve();
  private failed: string | null = null;
  private base: string;
  private s: DictationSettings;
  private fetcher: Fetch;
  constructor(s: DictationSettings, fetcher: Fetch, id = dictationId()) {
    this.s = s; this.fetcher = fetcher;
    this.id = id;
    this.base = cleanAddress(s.address) + '/v1/dictation/' + encodeURIComponent(id);
  }
  /** The first problem, once a piece has failed. */
  problem(): string | null { return this.failed; }
  send(piece: Uint8Array): void {
    if (!piece.length || this.failed) return;
    const seq = this.seq++;
    this.bytes += piece.length;
    this.chain = this.chain.then(() => this.put(seq, piece));
  }
  private async put(seq: number, piece: Uint8Array): Promise<void> {
    if (this.failed) return;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await this.fetcher(this.base + '/chunk/' + seq, { method: 'PUT', headers: headers(this.s, true), body: piece });
        if (r.ok) return;
        if (r.status < 500) { this.failed = serverProblem(r.status); return; }
        if (attempt === 1) this.failed = serverProblem(r.status);
      } catch {
        if (attempt === 1) this.failed = serverProblem(null);
      }
    }
  }
  /** Wait for every piece, then ask for the words. Throws a plain sentence when something failed. */
  async finish(signal?: AbortSignal): Promise<string> {
    await this.chain;
    if (this.failed) throw new Error(this.failed);
    if (!this.seq) return '';
    let r;
    try {
      r = await this.fetcher(this.base + '/finish?chunks=' + this.seq + '&bytes=' + this.bytes, { method: 'POST', headers: headers(this.s, false), signal });
    } catch {
      throw new Error(serverProblem(null));
    }
    if (!r.ok) throw new Error(serverProblem(r.status));
    return answerText(await r.text());
  }
}

/** Settings' Try it: half a second of quiet up and back. Answers a plain sentence; throws one when it fails. */
export async function tryServer(s: DictationSettings, fetcher: Fetch, pageProtocol: string): Promise<string> {
  const p = addressProblem(s.address, pageProtocol);
  if (p) throw new Error(p);
  const up = new Upload(s, fetcher);
  up.send(toPcm16(new Float32Array(RATE / 2)));
  await up.finish();
  return 'The speech server answered. The mic button in the writing screen is ready.';
}

// ---- the words on the page ----

/** The dictated words as they should go in between `before` and `after` (the text either side of the cursor): a space
 * where one is needed, a capital at the start of a sentence, and a space after when a word follows straight on. */
export function fitWords(before: string, words: string, after: string): string {
  let w = words.replace(/\s+/g, ' ').trim();
  if (!w) return '';
  const prev = before.replace(/[*=]+$/, '');
  const last = prev.slice(-1);
  const sentenceStart = prev.trim() === '' || /[.!?]["'”’)]?\s*$/.test(prev) || /\n\s*$/.test(before);
  if (sentenceStart) w = w.charAt(0).toUpperCase() + w.slice(1);
  // No space after a space, an opening bracket or quote, or a dash; a straight quote opens when nothing is before it.
  const opens = /[(“‘\-—]/.test(last) || (/["']/.test(last) && /(^|\s)["']$/.test(prev));
  if (last && !/\s/.test(last) && !opens) w = ' ' + w;
  if (after && /^[A-Za-z0-9“(]/.test(after)) w += ' ';
  return w;
}
