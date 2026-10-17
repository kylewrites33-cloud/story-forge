// Full-screen writing: one scene's prose in a plain text box. Each change is kept on this device straight away; it goes
// to the vault when Kyle presses Done, after two quiet minutes, or (if he is offline) when the connection is back.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  bodyWords, isUnsaved, listSnapshots, loadDrafts, openDraft, putDraft, saveDraft, saveSnapshot, splitLead,
  type Draft, type SnapshotEntry
} from '../lib/drafts.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { toNumber } from '../lib/links.ts';
import type { NoteRecord, VaultSource } from '../lib/types.ts';

const QUIET_SAVE_MS = 2 * 60 * 1000;
const num = (n: number) => n.toLocaleString('en-US');

type Saving = 'idle' | 'saving' | 'saved' | 'device' | 'error';

function offlineError(e: unknown): boolean {
  return (e as { status?: number }).status === 0 || !navigator.onLine;
}

export function Editor({ source, note, backTo, onSaved }: {
  source: VaultSource; note: NoteRecord; backTo: string; onSaved: (n: NoteRecord) => void;
}) {
  const canSave = Boolean(source.readFresh && source.write);
  const [draft, setDraftState] = useState<Draft>(() => openDraft(note, loadDrafts(source.key)[note.path], new Date()));
  const draftRef = useRef(draft);
  const [state, setState] = useState<Saving>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | 'target' | 'copies'>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const saving = useRef(false);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kept = useRef(true);

  const setDraft = useCallback((d: Draft) => {
    draftRef.current = d;
    setDraftState(d);
    kept.current = putDraft(source.key, d.path, d);
  }, [source]);

  const grow = () => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  useEffect(grow, []);

  /** Send the draft to the vault. `closing` keeps it waiting on the device if the connection is down. */
  const save = useCallback(async (closing: boolean): Promise<boolean> => {
    const d = draftRef.current;
    if (!isUnsaved(d)) { if (closing) putDraft(source.key, d.path, null); return true; }
    if (!canSave) { setState('device'); setMessage('The demo vault keeps your writing until the page reloads.'); return true; }
    if (!navigator.onLine) {
      setDraft({ ...d, pending: true });
      setState('device');
      return true;
    }
    if (saving.current) return false;
    saving.current = true;
    setState('saving');
    try {
      const r = await saveDraft(source, d, new Date());
      onSaved(r.note);
      const now = draftRef.current;
      // Words typed while it was saving stay in the draft for the next save.
      const next: Draft = { ...now, baseSha: r.note.sha, baseBody: d.body, target: now.target === d.target ? null : now.target, pending: false, error: undefined };
      if (closing && !isUnsaved(next)) { draftRef.current = next; putDraft(source.key, d.path, null); }
      else setDraft(next);
      setState('saved');
      setMessage(r.clash ? 'This scene had also changed somewhere else. Your version is saved; the other one is kept as a copy (' + r.clash.slice(r.clash.lastIndexOf('/') + 1).replace(/\.md$/, '') + ').' : null);
      return true;
    } catch (e) {
      if (offlineError(e)) {
        setDraft({ ...draftRef.current, pending: true });
        setState('device');
        return true;
      }
      const msg = (e as Error).message;
      setDraft({ ...draftRef.current, pending: closing, error: msg });
      setState('error');
      setMessage(msg);
      return false;
    } finally {
      saving.current = false;
    }
  }, [source, canSave, onSaved, setDraft]);

  const onInput = (e: Event) => {
    const text = (e.currentTarget as HTMLTextAreaElement).value;
    setDraft({ ...draftRef.current, body: splitLead(draftRef.current.body).lead + text, updatedAt: new Date().toISOString() });
    if (state !== 'error') setState('idle');
    grow();
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(() => { save(false); }, QUIET_SAVE_MS);
  };

  // Leaving the page or putting the iPad down: try to save, and keep it waiting on the device either way.
  useEffect(() => {
    const away = () => {
      if (document.visibilityState !== 'hidden' || !isUnsaved(draftRef.current)) return;
      setDraft({ ...draftRef.current, pending: true });
      save(false);
    };
    document.addEventListener('visibilitychange', away);
    return () => {
      document.removeEventListener('visibilitychange', away);
      if (quiet.current) clearTimeout(quiet.current);
      if (isUnsaved(draftRef.current)) putDraft(source.key, draftRef.current.path, { ...draftRef.current, pending: true });
    };
  }, [source, save, setDraft]);

  const done = async () => {
    if (quiet.current) clearTimeout(quiet.current);
    const ok = await save(true);
    if (ok) location.hash = backTo;
  };

  const { text } = splitLead(draft.body);
  const words = bodyWords(draft.body);
  const target = draft.target != null ? draft.target : toNumber(note.data.target_words);
  const sitting = words - draft.startWords;
  const title = [note.data.id, note.data.title].filter(Boolean).join(' ') || note.path;
  const unsaved = isUnsaved(draft);
  const status =
    state === 'saving' ? 'Saving to the vault…'
      : state === 'error' ? 'Not saved to the vault. It is safe on this device.'
        : !kept.current ? 'This device would not keep a copy. Press Done to save.'
          : unsaved ? (draft.pending || !navigator.onLine ? 'Saved on this device. It goes to the vault when you are back online.' : 'Saved on this device.')
            : state === 'saved' ? 'Saved to the vault.' : 'Nothing changed yet.';

  return (
    <div class="writer">
      <header class="writer-bar">
        <button type="button" class="primary" onClick={done}>Done</button>
        <span class="writer-title">{title}</span>
        <span class="buttons">
          <button type="button" onClick={() => setPanel(panel === 'target' ? null : 'target')} aria-expanded={panel === 'target'}>Target</button>
          <button type="button" onClick={() => setPanel(panel === 'copies' ? null : 'copies')} aria-expanded={panel === 'copies'}>Copies</button>
        </span>
      </header>
      <div class="writer-status" role="status">
        <span class="writer-words">
          {num(words)} words{target ? ' of ' + num(target) : ''}{sitting ? ' · ' + (sitting > 0 ? '+' : '') + num(sitting) + ' this sitting' : ''}
        </span>
        <span class={state === 'error' ? 'error' : ''}>{status}</span>
        {target ? <span class="writer-progress" aria-hidden="true"><span style={{ width: Math.min(100, Math.round(words * 100 / target)) + '%' }} /></span> : null}
        {message && <p class={state === 'error' ? 'error' : 'note-line'}>{message}</p>}
      </div>
      {panel === 'target' && <TargetPanel value={target || null} onSet={(n) => { setDraft({ ...draftRef.current, target: n }); setPanel(null); }} />}
      {panel === 'copies' && (
        <CopiesPanel source={source} note={note} body={draft.body} canSave={canSave}
          onUse={(body) => { setDraft({ ...draftRef.current, body }); setPanel(null); setTimeout(grow, 0); }} />
      )}
      <textarea
        ref={box}
        class="writer-text"
        value={text}
        onInput={onInput}
        spellcheck
        autocapitalize="sentences"
        aria-label={'Text of ' + title}
      />
    </div>
  );
}

function TargetPanel({ value, onSet }: { value: number | null; onSet: (n: number) => void }) {
  const [v, setV] = useState(value ? String(value) : '');
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
  return (
    <div class="writer-panel">
      <label class="reason">
        Word target for this scene
        <input type="text" inputMode="numeric" value={v} onInput={(e) => setV((e.currentTarget as HTMLInputElement).value)} placeholder="For example 2500" />
      </label>
      <div class="buttons">
        <button type="button" class="primary" disabled={!(n > 0)} onClick={() => onSet(n)}>Set target</button>
      </div>
      <p class="hint">The target is saved with the scene next time it saves.</p>
    </div>
  );
}

function CopiesPanel({ source, note, body, canSave, onUse }: {
  source: VaultSource; note: NoteRecord; body: string; canSave: boolean; onUse: (body: string) => void;
}) {
  const [list, setList] = useState<SnapshotEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');
  const [open, setOpen] = useState<{ entry: SnapshotEntry; body: string } | null>(null);

  const load = useCallback(async () => {
    if (!navigator.onLine) { setError('Connect to the internet to see or save copies.'); return; }
    try {
      setList(await listSnapshots(source, note));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [source, note]);
  useEffect(() => { load(); }, [load]);

  const keep = async (text: string, name: string) => {
    setBusy(true);
    try {
      await saveSnapshot(source, note, text, name, new Date());
      setLabel('');
      await load();
      return true;
    } catch (e) {
      setError(offlineError(e) ? 'Connect to the internet to save a copy.' : (e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const view = async (entry: SnapshotEntry) => {
    try {
      const text = await source.read(entry.path, entry.sha);
      setOpen({ entry, body: Frontmatter.parse(text).body });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Going back to an older copy saves what is on screen as a copy first, so nothing is lost.
  const use = async () => {
    if (!open) return;
    if (await keep(body, 'before going back to v' + open.entry.version)) { onUse(open.body); setOpen(null); }
  };

  return (
    <div class="writer-panel">
      {canSave && (
        <>
          <label class="reason">
            Save a copy of this version
            <input type="text" value={label} onInput={(e) => setLabel((e.currentTarget as HTMLInputElement).value)} placeholder="Name, for example before cutting the fight" />
          </label>
          <div class="buttons">
            <button type="button" class="primary" disabled={busy} onClick={() => keep(body, label.trim() || 'copy')}>Save a copy</button>
          </div>
        </>
      )}
      {error && <p class="error">{error}</p>}
      {open ? (
        <div class="copy-view">
          <p><strong>Copy {open.entry.version}{open.entry.label ? ' (' + open.entry.label + ')' : ''}</strong>, {num(bodyWords(open.body))} words</p>
          <div class="buttons">
            <button type="button" class="primary" disabled={busy || !canSave} onClick={use}>Go back to this version</button>
            <button type="button" onClick={() => setOpen(null)}>Close</button>
          </div>
          <pre class="copy-text">{splitLead(open.body).text}</pre>
        </div>
      ) : list && (
        list.length ? (
          <ul class="copy-list">
            {list.map((s) => (
              <li key={s.path}><button type="button" class="link" onClick={() => view(s)}>Copy {s.version}{s.label ? ' (' + s.label + ')' : ''}</button></li>
            ))}
          </ul>
        ) : <p class="hint">No copies of this scene yet.</p>
      )}
    </div>
  );
}
