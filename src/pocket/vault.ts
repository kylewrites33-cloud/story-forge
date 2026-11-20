// Sparrow Pocket's hold on the vault: the saved copy on the device, what waits to go up, and the saves. It is the main
// app's way of keeping the vault (src/ui/App.tsx), cut down to what Pocket does, and built from the same parts: the
// same saved copy (src/lib/cache.ts), the same outbox (src/vault/outbox.ts, the same names on the device, so what one
// page leaves waiting the other sends), the same saves (src/vault/push.ts pushAll; src/vault/words.ts saveDraft for a
// scene's words, kept on the device by src/lib/drafts.ts until they are in) and the same sync (src/lib/sync.ts). It
// writes nothing the main app would not write for the same press.
import { readSnapshot, writeSnapshot } from '../lib/cache.ts';
import { builtInSchemaText } from '../lib/demo-source.ts';
import { flushDrafts, isUnsaved, loadDrafts, mergeNotice, openDraft, putDraft } from '../lib/drafts.ts';
import { jobNotes } from '../lib/jobs.ts';
import { parseSchema } from '../lib/schema.ts';
import { sync } from '../lib/sync.ts';
import type { NoteRecord, Schema, Snapshot, VaultIndex, VaultSource } from '../lib/types.ts';
import { propText } from '../lib/props.ts';
import { kindsFrom } from '../team/kinds.ts';
import { NO_WATCH, watchStep } from '../team/asks.ts';
import { foldSaved, overlayActions } from '../vault/apply.ts';
import type { Action } from '../vault/ops.ts';
import { add, landedOf, loadLanded, loadOutbox, saveLanded, saveOutbox, settle } from '../vault/outbox.ts';
import { pushAll } from '../vault/push.ts';
import { saveDraft } from '../vault/words.ts';

export interface PocketState {
  snap: Snapshot | null;
  outbox: Action[];
  /** The saved copy has been looked for (there may be none yet). */
  loaded: boolean;
  syncing: boolean;
  /** A plain sentence when something did not load or save. */
  error: string | null;
  /** A plain sentence about words that met changes made elsewhere. */
  notice: string | null;
}

export class PocketVault {
  readonly source: VaultSource;
  state: PocketState;
  private listeners = new Set<() => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private schemaText = '';
  private schemaParsed: Schema | null = null;
  private viewOf: { snap: Snapshot | null; outbox: Action[]; view: VaultIndex | null } = { snap: null, outbox: [], view: null };
  private snapTimer = 0;
  private timers: number[] = [];
  private watch = NO_WATCH;

  constructor(source: VaultSource) {
    this.source = source;
    this.state = { snap: null, outbox: loadOutbox(source.key), loaded: false, syncing: false, error: null, notice: null };
    try { kindsFrom(parseSchema(builtInSchemaText())); } catch { /* the vault's own, once read */ }
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
      kindsFrom(this.schemaParsed);
    }
    return this.schemaParsed;
  }

  /** The vault as Kyle should see it: the saved copy with everything waiting on the device applied. */
  view(): VaultIndex | null {
    const { snap, outbox } = this.state;
    if (this.viewOf.snap !== snap || this.viewOf.outbox !== outbox) {
      this.viewOf = { snap, outbox, view: snap ? overlayActions(snap.index, outbox, this.schema()) : null };
    }
    return this.viewOf.view;
  }

  /** A scene's body as Kyle has it now: words still waiting on this device win over the saved copy's. */
  bodyOf(note: NoteRecord): string {
    return openDraft(note, loadDrafts(this.source.key)[note.path], new Date()).body;
  }

  /** Words of this vault's scenes still waiting on this device. */
  waitingWords(): number {
    return Object.values(loadDrafts(this.source.key)).filter((d) => d.pending || isUnsaved(d)).length;
  }

  /** One thing at a time on the connection: saves and reads never cross. */
  private lane<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job, job);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private writeSoon() {
    clearTimeout(this.snapTimer);
    this.snapTimer = window.setTimeout(() => this.writeNow(), 1500);
  }

  writeNow() {
    if (!this.snapTimer) return;
    clearTimeout(this.snapTimer);
    this.snapTimer = 0;
    const s = this.state.snap;
    if (!s) return;
    const ids = loadLanded(s.key).map((a) => a.id);
    void writeSnapshot(s).then(() => { if (ids.length) saveLanded(s.key, loadLanded(s.key).filter((a) => ids.indexOf(a.id) < 0)); });
  }

  private fold(saved: NoteRecord[], removed: string[] = [], texts: Record<string, { sha: string; text: string }> = {}) {
    const cur = this.state.snap;
    if (!cur || (!saved.length && !removed.length && !Object.keys(texts).length)) return;
    this.set({ snap: { ...cur, index: foldSaved(cur.index, saved, this.schema(), removed, texts) } });
    this.writeSoon();
  }

  /** Show the saved copy at once, then read the vault again; and keep reading it while the team has an ask open. */
  async start(): Promise<void> {
    const read = await readSnapshot(this.source.key);
    const landed = read ? loadLanded(this.source.key) : [];
    let schema: Schema | null = null;
    try { if (read && landed.length) schema = parseSchema(read.schemaText); } catch { schema = null; }
    this.set({ snap: read && landed.length ? { ...read, index: overlayActions(read.index, landed, schema) } : read, loaded: true });
    const again = () => { void this.sync(); };
    window.addEventListener('online', again);
    const visible = () => { if (document.visibilityState === 'visible') again(); else this.writeNow(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('pagehide', () => this.writeNow());
    // The main app's one watcher (src/team/asks.ts): every 15 seconds while the team has an ask open.
    this.timers.push(window.setInterval(() => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      const cur = this.state.snap;
      const step = watchStep(this.watch, cur ? jobNotes(cur.index) : [], Date.now());
      this.watch = step.watch;
      if (step.read) again();
    }, 15000));
    await this.sync();
  }

  stop() {
    this.timers.forEach((t) => clearInterval(t));
    this.writeNow();
  }

  /** Send what waits, then read the vault again (the main app's Sync, in the same order). */
  sync(): Promise<void> {
    return this.lane(async () => {
      if (!navigator.onLine) return;
      this.set({ syncing: true });
      try {
        const pushError = await this.pushNow();
        const written = await flushDrafts(this.source, this.source.key, new Date(), undefined, saveDraft);
        this.fold(written.saved);
        const cur = this.state.snap;
        const next = await sync(this.source, cur && cur.key === this.source.key ? cur : null);
        this.set({ snap: next, error: pushError || written.error, notice: written.notice || this.state.notice });
        clearTimeout(this.snapTimer);
        this.snapTimer = 0;
        await writeSnapshot(next);
      } catch (e) {
        this.set({ error: (e as Error).message });
      } finally {
        this.set({ syncing: false });
      }
    });
  }

  private async pushNow(): Promise<string | null> {
    const sent = this.state.outbox;
    if (!sent.length || !navigator.onLine || !this.source.commit) return null;
    const cur = this.state.snap;
    const res = await pushAll(this.source, sent, { known: cur && cur.key === this.source.key ? cur.index.notes : undefined });
    const left = settle(this.state.outbox, res.done, res.failed, res.renames);
    const landed = landedOf(sent, res.done, res.renames);
    if (landed.length) saveLanded(this.source.key, loadLanded(this.source.key).concat(landed));
    saveOutbox(this.source.key, left);
    this.set({ outbox: left, error: res.error });
    this.fold(res.saved, res.removed, res.texts);
    return res.error;
  }

  /** Put an action in the outbox (it shows at once and waits on the device) and send it when the connection allows. */
  act(action: Action): void {
    const list = add(this.state.outbox, action);
    saveOutbox(this.source.key, list);
    this.set({ outbox: list });
    void this.lane(() => this.pushNow()).catch((e: Error) => this.set({ error: e.message }));
  }

  /** Save a scene's body as the writing page saves it: kept on the device first, then one save that changes only the
   * body and the computed words line, merging what changed elsewhere and keeping a clashing version as a copy. Offline,
   * the words wait on the device and the next sync sends them. Answers a plain sentence when it did not save. */
  saveBody(note: NoteRecord, body: string): Promise<string | null> {
    const key = this.source.key;
    const d = { ...openDraft(note, loadDrafts(key)[note.path], new Date()), body, updatedAt: new Date().toISOString(), pending: true };
    if (!putDraft(key, note.path, d)) return Promise.resolve('This phone would not keep your words, so nothing changed. Check that the browser is not in private mode.');
    this.set({});
    if (!navigator.onLine || !this.source.commit) return Promise.resolve(null);
    return this.lane(async () => {
      try {
        const r = await saveDraft(this.source, d, new Date());
        const still = loadDrafts(key)[note.path];
        if (still && still.body === d.body) putDraft(key, note.path, null);
        this.fold([r.note]);
        const said = mergeNotice(r.merged && !r.clash ? [propText(note, 'id')] : [], r.clash ? [propText(note, 'id')] : []);
        if (said) this.set({ notice: said });
        return null;
      } catch (e) {
        const err = e as Error & { status?: number };
        if (err.status === 0 || !navigator.onLine) { this.set({}); return null; }
        putDraft(key, note.path, { ...d, error: err.message });
        this.set({ error: err.message });
        return err.message;
      }
    });
  }

  clearNotice() { this.set({ notice: null }); }
  clearError() { this.set({ error: null }); }
}
