// Another scene of the open chapter, on the same page as the scene being written (Kyle, 2026-10-22: "within the chapter,
// the default is to present it with all scenes, with a divider between them"). Each scene keeps its own file, its own
// draft on the device (every keystroke) and its own saves: two quiet minutes, five minutes of steady typing, putting
// the iPad down, leaving the page. A draft left unsaved on the device is saved by the next sync, as on the whole-chapter page.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { bodyWords, holdOpen, isUnsaved, loadDrafts, mergeNotice, openDraft, putDraft, saveDraft, splitLead, type Draft } from '../lib/drafts.ts';
import { trackWords } from '../lib/pomodoro.ts';
import type { StyleOptions } from '../lib/styled.ts';
import type { NoteRecord, VaultSource } from '../lib/types.ts';
import { StyledEditor, type EditorCommands } from './StyledEditor.tsx';
import { ChangesPage, type ChangesView } from './Changes.tsx';
import type { Placed } from '../lib/changes.ts';

const QUIET_SAVE_MS = 2 * 60 * 1000;
const TYPING_SAVE_MS = 5 * 60 * 1000;

export interface SectionApi {
  /** Send the draft to the vault; `closing` forgets it on the device once saved. False when it could not be saved. */
  save: (closing: boolean) => Promise<boolean>;
  commands: { current: EditorCommands | null };
  /** The scene's words as they stand on the page. */
  text: () => string;
  /** Put the team's change in (the Edit room): saved like typing, not counted as words typed. */
  put: (text: string) => void;
}

/** The team's changes marked on this scene, when the Edit room shows the whole chapter. */
export interface SectionMarks { placed: Placed[]; view: ChangesView; current: string | null; onPick: (id: string) => void }

export function SceneSection({ source, note, options, onSaved, onFocus, onLook, register, marks }: {
  source: VaultSource; note: NoteRecord; options: StyleOptions;
  onSaved: (n: NoteRecord) => void;
  /** Kyle's cursor went into this scene: the tool row works on it. */
  onFocus: () => void;
  onLook?: (l: { i: boolean; b: boolean; h: boolean }) => void;
  register: (path: string, api: SectionApi | null) => void;
  marks?: SectionMarks | null;
}) {
  const canSave = Boolean(source.readFresh && source.write);
  const [draft, setDraftState] = useState<Draft>(() => openDraft(note, loadDrafts(source.key)[note.path], new Date()));
  const ref = useRef(draft);
  const [error, setError] = useState<string | null>(null);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSince = useRef<number | null>(null);
  const saving = useRef(false);
  const commands = useRef<EditorCommands | null>(null);

  const setDraft = useCallback((d: Draft) => {
    ref.current = d;
    setDraftState(d);
    putDraft(source.key, d.path, d);
  }, [source]);

  const save = useCallback(async (closing: boolean): Promise<boolean> => {
    const d = ref.current;
    if (!isUnsaved(d)) { if (closing) putDraft(source.key, d.path, null); return true; }
    if (!canSave) return true;
    if (!navigator.onLine) { setDraft({ ...d, pending: true }); return true; }
    if (saving.current) return false;
    saving.current = true;
    try {
      const r = await saveDraft(source, d, new Date());
      onSaved(r.note);
      const now = ref.current;
      const next: Draft = { ...now, baseSha: r.merged ? '' : r.note.sha, baseBody: d.body, pending: false, error: undefined };
      if (closing && !isUnsaved(next)) { ref.current = next; putDraft(source.key, d.path, null); }
      else setDraft(next);
      setError(mergeNotice(r.merged && !r.clash ? [String(note.data.id || '')] : [], r.clash ? [String(note.data.id || '')] : []));
      return true;
    } catch (e) {
      const err = e as Error & { status?: number };
      setDraft({ ...ref.current, pending: true, error: err.status === 0 ? undefined : err.message });
      if (err.status === 0 || !navigator.onLine) return true;
      setError(err.message);
      return false;
    } finally {
      saving.current = false;
    }
  }, [source, canSave, onSaved, note, setDraft]);

  const [ver, setVer] = useState(0);
  const later = () => {
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(() => { typingSince.current = null; save(false); }, QUIET_SAVE_MS);
  };
  const put = (text: string) => {
    const d = ref.current;
    setDraft({ ...d, body: splitLead(d.body).lead + text, updatedAt: new Date().toISOString() });
    setVer((v) => v + 1);
    later();
  };
  const putRef = useRef(put);
  putRef.current = put;
  useEffect(() => {
    register(note.path, { save, commands, text: () => splitLead(ref.current.body).text, put: (t) => putRef.current(t) });
    return () => register(note.path, null);
  }, [note.path, save, register]);

  // While it is on the page, only the page saves it (the 30-second sync leaves it alone).
  useEffect(() => holdOpen(note.path), [note.path]);

  useEffect(() => {
    const away = () => {
      if (document.visibilityState !== 'hidden' || !isUnsaved(ref.current)) return;
      setDraft({ ...ref.current, pending: true });
      save(false);
    };
    document.addEventListener('visibilitychange', away);
    return () => {
      document.removeEventListener('visibilitychange', away);
      if (quiet.current) clearTimeout(quiet.current);
      // Unsaved words wait on the device; the next sync saves them.
      if (isUnsaved(ref.current)) putDraft(source.key, ref.current.path, { ...ref.current, pending: true });
    };
  }, [source, save, setDraft]);

  const changed = (text: string) => {
    const d = ref.current;
    const body = splitLead(d.body).lead + text;
    trackWords(note.path, String(note.data.id || ''), bodyWords(d.body), bodyWords(body));
    setDraft({ ...d, body, updatedAt: new Date().toISOString() });
    later();
    if (typingSince.current == null) typingSince.current = Date.now();
    else if (Date.now() - typingSince.current >= TYPING_SAVE_MS) { typingSince.current = null; save(false); }
  };

  return (
    <section class="chapter-section" data-section={note.path} onFocusCapture={onFocus}>
      {marks ? <ChangesPage text={splitLead(draft.body).text} placed={marks.placed} view={marks.view} current={marks.current} onPick={marks.onPick} options={options}
        label={'Text of ' + String(note.data.title || note.data.id || '') + ' with the team\'s changes'} />
      : <StyledEditor key={ver} value={splitLead(draft.body).text} onChange={changed} onCaret={() => {}} onLook={onLook}
        label={'Text of ' + String(note.data.title || note.data.id || '')} commands={commands} options={options} />}
      {error && <p class="note-line section-error">{error}</p>}
    </section>
  );
}
