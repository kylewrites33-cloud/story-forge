// Sparrow Pocket's hold on the vault (2026-11-21). Kyle: "im a little worried about messing up the main app with this
// pocket app ... let the phone record my choices, and the ipad apply it when i next open it", then "no send button
// necessary if its automatic". So the phone reads the vault and changes nothing in it but its own phone note: each choice
// Kyle makes is kept on the phone (src/lib/prefs.ts, its own names), and goes up by itself, a few at a time, to the
// book's phone note (src/pocket/send.ts). Sparrow on the iPad puts them in.
//
// Kept apart from the main app on the same device: its own saved copy (under "pocket:" and the vault's name), its own
// waiting list and no drafts or outbox at all, so neither page ever sends the other's waiting work. What it shares is
// the reading: the same sync (src/lib/sync.ts) and the key in Settings.
import { readSnapshot, writeSnapshot } from '../lib/cache.ts';
import { parseSchema } from '../lib/schema.ts';
import { sync } from '../lib/sync.ts';
import { PREF, readJson, writeJson } from '../lib/prefs.ts';
import { propText } from '../lib/props.ts';
import type { PhoneChoice } from '../lib/phone-choices.ts';
import type { Schema, Snapshot, VaultIndex, VaultSource } from '../lib/types.ts';
import { makeNote } from '../lib/vault-index.ts';
import { sendChoices, withdrawChoice } from './send.ts';

/** A choice kept on the phone until it is sent. */
export interface Kept extends PhoneChoice {
  /** Its own name on the phone, for Undo. */
  id: string;
  book: string;
}

/** Where a sent choice went: its phone note and its number there. */
export interface SentAs { note: string; n: number }

interface NotesKept {
  /** The phone note each book adds to while it is waiting. */
  own: Record<string, string>;
  /** Where each sent choice went, by its id on the phone (for Undo). */
  sent: Record<string, SentAs>;
}

export interface PocketState {
  snap: Snapshot | null;
  /** Choices on the phone, not sent yet. */
  kept: Kept[];
  loaded: boolean;
  syncing: boolean;
  sending: boolean;
  /** A plain sentence when something did not load or send. */
  error: string | null;
}

const SNAP = 'pocket:';
/** A quiet minute after the last choice, and the choices go up. */
const QUIET_MS = 60 * 1000;

export class PocketVault {
  readonly source: VaultSource;
  state: PocketState;
  private listeners = new Set<() => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private schemaText = '';
  private schemaParsed: Schema | null = null;
  private quiet = 0;
  private timers: number[] = [];
  private offs: (() => void)[] = [];

  constructor(source: VaultSource) {
    this.source = source;
    this.state = { snap: null, kept: this.loadKept(), loaded: false, syncing: false, sending: false, error: null };
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private set(part: Partial<PocketState>) {
    this.state = { ...this.state, ...part };
    this.listeners.forEach((f) => f());
  }

  schema(): Schema | null {
    const s = this.state.snap;
    if (!s) return null;
    if (s.schemaText !== this.schemaText) {
      this.schemaText = s.schemaText;
      try { this.schemaParsed = parseSchema(s.schemaText); } catch { this.schemaParsed = null; }
    }
    return this.schemaParsed;
  }

  view(): VaultIndex | null {
    return this.state.snap ? this.state.snap.index : null;
  }

  /** Whether the phone can send: the demo cannot, and nothing is sent from it. */
  get canSend(): boolean { return Boolean(this.source.commit); }

  // ---- What the phone keeps ----

  private loadKept(): Kept[] {
    const v = readJson(PREF.pocketChoices + this.source.key);
    return Array.isArray(v) ? (v as Kept[]) : [];
  }
  private saveKept(list: Kept[]) {
    writeJson(PREF.pocketChoices + this.source.key, list.length ? list : null);
    this.set({ kept: list });
  }
  notes(): NotesKept {
    const v = readJson(PREF.pocketNotes + this.source.key) as NotesKept | null;
    return v && typeof v === 'object' && v.own && v.sent ? v : { own: {}, sent: {} };
  }
  private saveNotes(n: NotesKept) { writeJson(PREF.pocketNotes + this.source.key, n); }

  /** Keep one more choice on the phone. It goes up after a quiet minute, or sooner (leaving the chapter, putting the
   * phone away, coming back online). */
  record(c: Omit<Kept, 'id' | 'n' | 'result'>): Kept {
    const k: Kept = { ...c, n: 0, result: '', id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
    this.saveKept(this.state.kept.concat(k));
    clearTimeout(this.quiet);
    this.quiet = window.setTimeout(() => { void this.send(); }, QUIET_MS);
    return k;
  }

  /** Take a choice back. Still on the phone: it is simply dropped. Sent: it is taken off the phone note while no iPad
   * has started putting that note in; after that it cannot be, and the answer says so in a plain sentence. */
  async undo(id: string): Promise<string | null> {
    if (this.state.kept.some((k) => k.id === id)) { this.saveKept(this.state.kept.filter((k) => k.id !== id)); return null; }
    const at = this.notes().sent[id];
    if (!at) return null;
    if (!navigator.onLine) return 'This choice has gone to your iPad already. Connect to the internet to take it back.';
    return this.lane(async () => {
      try {
        const ok = await withdrawChoice(this.source, at.note, at.n);
        if (!ok) return 'Your iPad has already put this choice in. Change it in Sparrow on the iPad.';
        const n = this.notes();
        delete n.sent[id];
        this.saveNotes(n);
        await this.read();
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });
  }

  // ---- Reading and sending ----

  private lane<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job, job);
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** Show the phone's own saved copy at once, then send what waits and read the vault again. */
  async start(): Promise<void> {
    const read = await readSnapshot(SNAP + this.source.key);
    this.set({ snap: read ? { ...read, key: this.source.key } : null, loaded: true });
    const again = () => { void this.sync(); };
    const away = () => { void this.send(); };
    const visible = () => { if (document.visibilityState === 'visible') again(); else away(); };
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('pagehide', away);
    this.offs.push(() => window.removeEventListener('online', again), () => document.removeEventListener('visibilitychange', visible), () => window.removeEventListener('pagehide', away));
    // Every two minutes while it is on screen, so cards the iPad has put in show as decided.
    this.timers.push(window.setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) again(); }, 120000));
    await this.sync();
  }

  stop() {
    this.timers.forEach((t) => clearInterval(t));
    this.offs.forEach((f) => f());
    clearTimeout(this.quiet);
  }

  /** Send what waits, then read the vault. */
  sync(): Promise<void> {
    return this.lane(async () => {
      if (!navigator.onLine) return;
      this.set({ syncing: true });
      try {
        await this.sendNow();
        await this.read();
      } catch (e) {
        this.set({ error: (e as Error).message });
      } finally {
        this.set({ syncing: false });
      }
    });
  }

  private async read(): Promise<void> {
    const cur = this.state.snap;
    const next = await sync(this.source, cur && cur.key === this.source.key ? cur : null);
    this.set({ snap: next });
    await writeSnapshot({ ...next, key: SNAP + this.source.key });
    // Choices the iPad has put in can no longer be taken back from here: forget where they went.
    const n = this.notes();
    const gone = Object.keys(n.sent).filter((id) => { const x = next.index.notes[n.sent[id].note]; return !x || propText(x, 'status') === 'applied'; });
    if (gone.length) { gone.forEach((id) => delete n.sent[id]); this.saveNotes(n); }
  }

  /** Send the choices kept on the phone now (when it is online), then read the vault so they show as sent. */
  send(): Promise<void> {
    clearTimeout(this.quiet);
    if (!this.state.kept.length || !navigator.onLine || !this.canSend) return Promise.resolve();
    return this.lane(async () => {
      try {
        if (await this.sendNow()) await this.read();
      } catch (e) {
        this.set({ error: (e as Error).message });
      }
    });
  }

  /** One save per book with choices waiting: they go on the book's phone note. Answers whether anything went. */
  private async sendNow(): Promise<boolean> {
    const kept = this.state.kept;
    if (!kept.length || !navigator.onLine || !this.canSend) return false;
    this.set({ sending: true });
    let went = false;
    try {
      const books = [...new Set(kept.map((k) => k.book))];
      for (const book of books) {
        const these = kept.filter((k) => k.book === book);
        const notes = this.notes();
        const title = (this.state.snap && (this.state.snap.index.books.find((b) => b.folder === book) || { title: '' }).title) || '';
        const r = await sendChoices(this.source, book, title, notes.own[book] || '', these, new Date());
        const n = this.notes();
        n.own[book] = r.path;
        these.forEach((k, i) => { n.sent[k.id] = { note: r.path, n: r.numbers[i] }; });
        this.saveNotes(n);
        // The note goes into the phone's copy at once, so the cards stay decided until the vault is read again.
        const cur = this.state.snap;
        if (cur) this.set({ snap: { ...cur, index: { ...cur.index, notes: { ...cur.index.notes, [r.path]: makeNote(r.path, '', r.text) } } } });
        // Only the ones that went leave the phone: a choice made while this was sending waits for the next send.
        this.saveKept(this.state.kept.filter((k) => these.indexOf(k) < 0));
        went = true;
      }
      this.set({ error: null });
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status !== 0 && navigator.onLine) this.set({ error: 'Your choices are kept on this phone; sending them did not work yet: ' + err.message });
    } finally {
      this.set({ sending: false });
    }
    return went;
  }

  clearError() { this.set({ error: null }); }
}
