// A chapter by its beats: each beat is a closed row with its number, title and one-line summary; open one to write
// planning notes under it. Since 2026-11-22 the words in a beat are Kyle's notes, never the chapter's prose (Kyle: "the
// text inside each beat is room for my planning thoughts. So when I write on beat mode, the text doesn't go into the
// word processor. It's just brainstorming for me as I prewrite the chapter"). The beats and their notes live in the
// book's `Chapter Beats/` note for the chapter (see lib/beats.ts); the scenes are never changed here. Everything Kyle
// types is kept on the device at once and saves the same way as the writing screen: two quiet minutes, putting the iPad
// down, or back online.
import { Fragment, type ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  BEATS_TYPE, addPlanBeat, introOf, beatsBody, beatsPath, beatsTitle, deletePlanBeat, deletedBeatPath, deletedBeatText,
  movePlanBeat, parseBeats, planBeats, planDefs, type PlanBeat
} from '../lib/beats.ts';
import { chapterHeading, type ChapterGroup } from '../lib/board.ts';
import { matcher, type CodexEntry } from '../lib/codex.ts';
import { bodyWords, isUnsaved, loadDrafts, mergeNotice, openDraft, putDraft, type Draft } from '../lib/drafts.ts';
import { saveDraft } from '../vault/words.ts';
import { sceneHeader } from '../lib/format.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { loadLook } from '../lib/page.ts';
import type { StyleOptions } from '../lib/styled.ts';
import type { DeviceFile, NoteRecord, VaultSource } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { href } from '../app/route.ts';
import { ProseEditor } from '../write/ProseEditor.tsx';
import type { EditorCommands } from '../write/prose.ts';
import { PREF, readPref, writePref } from '../lib/prefs.ts';
import { propText } from '../lib/props.ts';

const QUIET_SAVE_MS = 2 * 60 * 1000;
// While Kyle types without a two-minute pause, the words still go to the vault this often (Kyle, 2026-10-20).
const TYPING_SAVE_MS = 5 * 60 * 1000;
const num = (n: number) => n.toLocaleString('en-US');

interface State {
  beatsDraft: Draft;
  /** Text above the first beat in the note, kept as it is. */
  intro: string;
  beats: PlanBeat[];
}

/** The chapter's last scene: where a beat with no scene of its own sits (as Sparrow Pocket reads it, lib/phone-beats.ts). */
const lastSceneId = (group: ChapterGroup) => { const l = group.scenes[group.scenes.length - 1]; return l ? propText(l, 'id').toUpperCase() : ''; };

function start(source: VaultSource, group: ChapterGroup, bookFolder: string, beatsNote: NoteRecord | null): State {
  const now = new Date();
  const drafts = loadDrafts(source.key);
  const chapter = group.num as number;
  const path = beatsNote ? beatsNote.path : beatsPath(bookFolder, chapter);
  const kept = drafts[path];
  const beatsDraft: Draft = beatsNote ? openDraft(beatsNote, kept, now)
    : kept && kept.create && isUnsaved(kept) ? kept
    : { path, baseSha: '', baseBody: '', body: '', target: null, startWords: 0, updatedAt: now.toISOString(), pending: false,
      create: Frontmatter.join({ type: BEATS_TYPE, title: beatsTitle(chapter), chapter }, '') };
  const last = lastSceneId(group);
  const beats = planBeats(parseBeats(beatsDraft.body).map((d) => ({ ...d, scene: d.scene || last })));
  return { beatsDraft, intro: introOf(beatsDraft.body), beats };
}

const openKey = (bookFolder: string, chapter: number | null) => PREF.beatsOpen + bookFolder + '#' + chapter;
function loadOpen(key: string): number[] {
  try { const v = JSON.parse(readPref(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** A text box that grows with its words, for a beat's summary. */
function Summary({ value, onInput, label }: { value: string; onInput: (v: string) => void; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } };
  useEffect(fit, [value]);
  return (
    <textarea ref={ref} class="beat-summary" rows={1} value={value} placeholder="What happens in this beat" aria-label={label}
      onInput={(e) => { onInput((e.target as HTMLTextAreaElement).value.replace(/\n/g, ' ')); fit(); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }} />
  );
}

/** The chapter by its beats, drawn in the writing screen's page area in place of the page (the chapter list, the
 * right-hand column and the top bar stay). `saver` is filled in with "save everything", which the writing screen calls
 * before it leaves or switches back to the page. */
/** What the writing screen's tool row needs from the beat Kyle is in. */
export interface BeatsApi {
  cmd: () => EditorCommands | null;
}

/** A beat being dragged up or down by its Move handle (finger or mouse). `before` is where it would land:
 * before that beat, at the chapter's end (null), or nowhere yet (undefined). */
interface BeatDrag { key: string; pointer: number; startY: number; startScroll: number; y: number; moved: boolean; before: string | null | undefined }

const beatsScroller = () => document.querySelector<HTMLElement>('.writer-page');

/** Where a beat held at height y would land: before the beat under it (its top half) or the one after (its bottom half). */
function beatDropAt(y: number, dragged: string): string | null | undefined {
  const list = document.querySelector<HTMLElement>('.beats');
  if (!list) return undefined;
  const r = list.getBoundingClientRect();
  const items = [...list.querySelectorAll<HTMLElement>('[data-beat]')].filter((e) => e.dataset.beat !== dragged);
  for (const el of document.elementsFromPoint(r.left + r.width / 2, y)) {
    const item = (el as HTMLElement).closest('[data-beat]') as HTMLElement | null;
    if (!item || item.dataset.beat === dragged) continue;
    const b = item.getBoundingClientRect();
    if (y < b.top + b.height / 2) return item.dataset.beat || null;
    const next = items[items.indexOf(item) + 1];
    return next ? next.dataset.beat || null : null;
  }
  if (items.length && y > items[items.length - 1].getBoundingClientRect().bottom) return null;
  return undefined;
}

export function BeatsView({ source, group, bookFolder, beatsNote, codex, startAt, onSaved, saver, onStatus, onOpen, options, onName, onLook, api, onActive, head, onWords, onFiles, asking, problem }: {
  source: VaultSource; group: ChapterGroup; bookFolder: string;
  /** The chapter's beats note, or null when it has none yet. */
  beatsNote: NoteRecord | null;
  codex: CodexEntry[];
  /** The scene the beats opened from: its beats come into view. */
  startAt: string;
  onSaved: (n: NoteRecord) => void;
  /** Not used here any more: Ask the team lives in the side column (Kyle, 2026-10-22: "redundant" in Beats). */
  /** The team is writing this chapter's beats now. */
  asking?: boolean;
  /** The sentence to show when the team's last try at them failed. */
  problem?: string;
  saver: { current: ((closing: boolean) => Promise<boolean>) | null };
  /** The save state in Kyle's words, for the top bar's chip. */
  onStatus: (text: string, cls: string) => void;
  /** Open a scene in the page (its name above its beats). */
  onOpen: (path: string) => void;
  /** The writing screen's look for the prose (names underlined, Find); its own when left out. */
  options?: StyleOptions;
  /** A name pressed in the prose. */
  onName?: (i: number) => void;
  onLook?: Parameters<typeof ProseEditor>[0]['onLook'];
  /** Filled in so the writing screen's tool row works on the beat Kyle is in. */
  api?: { current: BeatsApi | null };
  /** The words of the beat Kyle is in, whenever they change or he moves to another beat. */
  onActive?: (text: string) => void;
  /** The writing screen's own heading (chapter, scene line, reading time, the chapter strip, the target bar); a plain heading when left out. */
  head?: ComponentChildren;
  /** Each scene's words as Kyle types, for the heading's counts. */
  onWords?: (words: Record<string, number>) => void;
  /** Files saved as they are through the one saving system (a deleted beat's words on their way to the Archive). */
  onFiles: (files: DeviceFile[]) => Promise<void>;
}) {
  const canSave = Boolean(source.readFresh && source.commit);
  const [st, setSt] = useState<State>(() => start(source, group, bookFolder, beatsNote));
  const ref = useRef(st);
  ref.current = st;
  const okey = openKey(bookFolder, group.num);
  const [open, setOpen] = useState<Set<string>>(() => { const at = loadOpen(okey); return new Set(st.beats.filter((_, i) => at.indexOf(i) >= 0).map((b) => b.key)); });
  // Editors take their text once; a heading taken off or a beat added redraws them with the new text.
  const [rev, setRev] = useState(0);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'device'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [focused, setFocused] = useState('');
  const commands = useRef<Record<string, { current: EditorCommands | null }>>({});
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSince = useRef<number | null>(null);
  const saving = useRef(false);
  const look = loadLook();
  const [ownOpts] = useState<StyleOptions>(() => ({ names: look.names === 'on' && codex.length ? matcher(codex) : null }));
  const opts = options || ownOpts;

  // Moving beats: hold the Move handle and drag (Kyle, 2026-10-19). The beat's prose moves with it.
  const [drag, setDrag] = useState<BeatDrag | null>(null);
  const dragRef = useRef<BeatDrag | null>(null);
  const putDrag = (d: BeatDrag | null) => { dragRef.current = d; setDrag(d); };
  useEffect(() => {
    if (!drag) return;
    // Near the top or bottom of the page it scrolls, so a beat can travel far.
    const t = setInterval(() => {
      const d = dragRef.current;
      const sc = beatsScroller();
      if (!d || !d.moved || !sc) return;
      const r = sc.getBoundingClientRect();
      const edge = 70;
      const step = d.y < r.top + edge ? -Math.ceil((r.top + edge - d.y) / 4) : d.y > r.bottom - edge ? Math.ceil((d.y - r.bottom + edge) / 4) : 0;
      if (!step) return;
      sc.scrollBy(0, step);
      const at = beatDropAt(d.y, d.key);
      putDrag({ ...d, before: at === undefined ? d.before : at });
    }, 30);
    return () => clearInterval(t);
  }, [drag && drag.key]);
  const move = (key: string, before: string | null) => {
    const next = movePlanBeat(ref.current.beats, key, before);
    if (next === ref.current.beats) return;
    apply(next);
    keepOpen(new Set(open), next);
  };
  const keepOpen = (next: Set<string>, beats = ref.current.beats) => {
    setOpen(next);
    writePref(okey, JSON.stringify(beats.map((b, i) => (next.has(b.key) ? i : -1)).filter((i) => i >= 0)));
  };

  const unsavedAll = (s: State) => isUnsaved(s.beatsDraft);

  /** Save the beats note. */
  const saveAll = useCallback(async (closing: boolean): Promise<boolean> => {
    const cur = ref.current;
    const todo = isUnsaved(cur.beatsDraft) ? [cur.beatsDraft] : [];
    if (!todo.length) return true;
    if (!canSave) { setState('device'); setMessage('The demo vault keeps your changes until the page reloads.'); return true; }
    if (!navigator.onLine) {
      todo.forEach((d) => putDraft(source.key, d.path, { ...d, pending: true }));
      setState('device');
      return true;
    }
    if (saving.current) return false;
    saving.current = true;
    setState('saving');
    let ok = true;
    const clashes: string[] = [];
    const mergedIn: string[] = [];
    for (const d of todo) {
      try {
        const r = await saveDraft(source, d, new Date());
        onSaved(r.note);
        if (r.clash) clashes.push(String(r.note.data.id || r.note.data.title || d.path));
        else if (r.merged) mergedIn.push(String(r.note.data.id || r.note.data.title || d.path));
        const latest = ref.current.beatsDraft;
        const next: Draft = { ...latest, baseSha: r.merged ? '' : r.note.sha, baseBody: d.body, pending: false, error: undefined, create: undefined };
        if (closing && !isUnsaved(next)) putDraft(source.key, d.path, null);
        else putDraft(source.key, d.path, next);
        ref.current = { ...ref.current, beatsDraft: next };
        setSt(ref.current);
      } catch (e) {
        ok = false;
        const err = e as Error & { status?: number };
        putDraft(source.key, d.path, { ...d, pending: true, error: err.message });
        setMessage(err.status === 0 ? null : err.message);
        setState(err.status === 0 ? 'device' : 'error');
      }
    }
    saving.current = false;
    if (ok) {
      setState('saved');
      setMessage(mergeNotice(mergedIn, clashes));
    }
    return ok;
  }, [source, canSave, onSaved]);

  /** New beats: the beats note follows, kept on the device at once. The scenes are never touched. */
  const apply = (beats: PlanBeat[]) => {
    const cur = ref.current;
    const at = new Date().toISOString();
    let beatsDraft = cur.beatsDraft;
    if (beats.length || beatsDraft.baseSha) {
      const body = (cur.intro ? '\n' + cur.intro + '\n' : '') + beatsBody(planDefs(beats));
      if (body !== beatsDraft.body) {
        beatsDraft = { ...beatsDraft, body, updatedAt: at };
        putDraft(source.key, beatsDraft.path, beatsDraft);
      }
    }
    ref.current = { ...cur, beatsDraft, beats };
    setSt(ref.current);
    if (state !== 'error') setState('idle');
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(() => { typingSince.current = null; saveAll(false); }, QUIET_SAVE_MS);
    if (typingSince.current == null) typingSince.current = Date.now();
    else if (Date.now() - typingSince.current >= TYPING_SAVE_MS) { typingSince.current = null; saveAll(false); }
  };

  const edit = (key: string, change: Partial<PlanBeat>) => {
    apply(ref.current.beats.map((x) => (x.key === key ? { ...x, ...change } : x)));
  };

  // The team wrote new beats (a job finished) while nothing here waits to save: show them.
  const noteSha = beatsNote ? beatsNote.sha : '';
  useEffect(() => {
    const cur = ref.current;
    if (!noteSha || noteSha === cur.beatsDraft.baseSha || unsavedAll(cur)) return;
    const next = start(source, group, bookFolder, beatsNote);
    ref.current = next;
    setSt(next);
    setRev((r) => r + 1);
    setOpen(new Set());
  }, [noteSha]);

  useEffect(() => {
    const away = () => { if (document.visibilityState === 'hidden') saveAll(false); };
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveAll(false); }
    };
    document.addEventListener('visibilitychange', away);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('visibilitychange', away);
      window.removeEventListener('keydown', key);
      if (quiet.current) clearTimeout(quiet.current);
      const d = ref.current.beatsDraft;
      if (isUnsaved(d)) putDraft(source.key, d.path, { ...d, pending: true });
    };
  }, [source, saveAll]);

  saver.current = saveAll;

  const { beats } = st;
  const unsaved = unsavedAll(st);
  const chip = state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved' : unsaved ? (state === 'device' || !navigator.onLine ? 'On this device' : 'Saved on device') : 'Saved';
  useEffect(() => { onStatus(chip, chip === 'Saved' ? 'good' : state === 'error' ? 'bad' : ''); }, [chip]);
  // The scene the beats opened from comes into view.
  useEffect(() => {
    const el = document.querySelector('[data-beats-scene="' + CSS.escape(startAt) + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  }, []);
  const cmd = () => { const c = commands.current[focused]; return c ? c.current : null; };
  const focusedNotes = (beats.find((b) => b.key === focused) || { notes: '' }).notes;
  if (api) api.current = { cmd };
  useEffect(() => { if (onActive) onActive(focusedNotes); }, [focused, focusedNotes]);
  // Add a beat: after the beat Kyle is in, else at the chapter's end; it opens with its name ready to type (Kyle, 2026-10-22).
  const addBeat = () => {
    const cur = ref.current.beats;
    if (!group.scenes.length) return;
    const next = addPlanBeat(cur, focused && cur.some((x) => x.key === focused) ? focused : null, '', lastSceneId(group));
    const k = next.find((x) => !cur.some((y) => y.key === x.key));
    if (!k) return;
    apply(next);
    keepOpen(new Set([...open, k.key]), next);
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('[data-beat="' + k.key + '"] .beat-title');
      if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
    }, 0);
  };

  // Hold a beat's name (or right-click it) for Delete beat and its words (Kyle, 2026-10-22). A short press still types.
  const [menu, setMenu] = useState<{ key: string; confirm: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const hold = useRef<{ t: ReturnType<typeof setTimeout> | null; x: number; y: number; fired: number }>({ t: null, x: 0, y: 0, fired: 0 });
  const stopHold = () => { const h = hold.current; if (h.t) clearTimeout(h.t); h.t = null; };
  const openMenu = (key: string) => {
    hold.current.fired = Date.now();
    const a = document.activeElement as HTMLElement | null;
    if (a && a.blur) a.blur();
    setMenu({ key, confirm: false });
  };
  const holdProps = (key: string) => ({
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      stopHold();
      const h = hold.current;
      h.x = e.clientX; h.y = e.clientY;
      h.t = setTimeout(() => { h.t = null; openMenu(key); }, 500);
    },
    onPointerMove: (e: PointerEvent) => { const h = hold.current; if (h.t && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) stopHold(); },
    onPointerUp: stopHold,
    onPointerCancel: stopHold,
    onContextMenu: (e: MouseEvent) => { e.preventDefault(); if (Date.now() - hold.current.fired > 800) openMenu(key); },
    onFocus: (e: FocusEvent) => { if (Date.now() - hold.current.fired < 800) (e.target as HTMLElement).blur(); }
  });
  /** Delete a beat and its notes: the beat goes to the book's Archive first, so nothing of Kyle's is lost. */
  const remove = async (b: PlanBeat, at: number) => {
    const chapter = group.num as number;
    const keepCopy = Boolean(b.notes || b.summary.trim());
    if (keepCopy && canSave) {
      if (!navigator.onLine) { setMenu(null); setState('error'); setMessage('Deleting a beat needs the internet, so its notes can go to the Archive first. Try again when you are online.'); return; }
      setDeleting(true);
      const now = new Date();
      try {
        const why = 'beats: archive chapter ' + chapter + ' beat ' + at + '\n\nDeleted with its notes in the Sparrow app; the beat as it stood is kept here.';
        const path = deletedBeatPath(bookFolder, chapter, at, b.title, now), words = deletedBeatText(b, chapter, at, now);
        await onFiles([{ path, taken: 'next', text: words, message: why }]);
      } catch (e) {
        setDeleting(false);
        setMenu(null);
        setState('error');
        setMessage('The beat was not deleted, because its notes could not be copied to the Archive: ' + (e as Error).message);
        return;
      }
      setDeleting(false);
    }
    setMenu(null);
    const next = deletePlanBeat(ref.current.beats, b.key);
    const o = new Set(open); o.delete(b.key);
    apply(next);
    keepOpen(o, next);
    setRev((r) => r + 1);
    await saveAll(false);
    setMessage(keepCopy && canSave ? 'Beat ' + at + ' is deleted. A copy is in the book\'s Archive, in Deleted beats.' : 'Beat ' + at + ' is deleted.');
  };

  let n = 0;

  return (
    <>
          <div class="page-head">
            {head || <h1>{chapterHeading(group)}</h1>}
            <p class="meta">Your planning notes for the chapter, beat by beat. What you write in a beat stays with the beat and never goes into the chapter. Press a number to open or close a beat. Hold a beat's name to delete it.</p>
            {message && <p class={state === 'error' ? 'error' : 'note-line'}>{message}</p>}
            {asking ? <p class="tool-said ok" role="status"><span class="job-dot" aria-hidden="true" /> The team is working on this chapter's beats. They show here when it is done.</p>
              : problem && <p class="error" role="status">{problem}</p>}
            <div class="buttons beat-tools">
              <button type="button" onClick={() => keepOpen(new Set(beats.map((b) => b.key)))}>Open all</button>
              <button type="button" onClick={() => keepOpen(new Set())}>Close all</button>
              <button type="button" onClick={addBeat}><Icon name="plus" size={18} />Add a beat</button>
            </div>
          </div>
          <div class={'beats' + (drag && drag.moved && drag.before === null ? ' drop-end' : '')}>
            {beats.map((b, i) => {
              const isOpen = open.has(b.key);
              const newScene = i === 0 || beats[i - 1].scene !== b.scene;
              const note = group.scenes.find((s) => propText(s, 'id').toUpperCase() === b.scene);
              const label = 'Beat ' + (n + 1);
              n++;
              const shown = n;
              const toggle = () => { const next = new Set(open); if (isOpen) next.delete(b.key); else next.add(b.key); keepOpen(next); };
              const c = commands.current[b.key] || (commands.current[b.key] = { current: null });
              const dragging = Boolean(drag && drag.moved && drag.key === b.key);
              return (
                <Fragment key={b.key}>
                  {newScene && (
                    <p class="beat-scene">
                      {i > 0 && <span class="beat-break" aria-hidden="true">~</span>}
                      {note ? <a href={href.write(note.path)} data-beats-scene={note.path} onClick={(e) => { e.preventDefault(); onOpen(note.path); }}>{[b.scene, sceneHeader(note.data)].filter(Boolean).join(' ')}</a> : b.scene}
                    </p>
                  )}
                  <section class={'beat' + (isOpen ? ' open' : '') + (dragging ? ' dragging' : '') + (drag && drag.moved && drag.before === b.key ? ' drop-before' : '')}
                    data-beat={b.key} style={dragging ? { transform: 'translateY(' + (drag!.y - drag!.startY + ((beatsScroller() || { scrollTop: 0 }).scrollTop - drag!.startScroll)) + 'px)' } : undefined}>
                    <div class="beat-row">
                      <div class="beat-left">
                        <button type="button" class="beat-toggle" aria-expanded={isOpen} aria-label={(isOpen ? 'Close ' : 'Open ') + label} onClick={toggle}>
                          <span>{n}</span><Icon name={isOpen ? 'down' : 'right'} size={16} />
                        </button>
                        <button type="button" class="move-handle beat-move icon-button" title="Move: hold and drag up or down" aria-label={'Move ' + label + ': hold and drag'}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                            const sc = beatsScroller();
                            putDrag({ key: b.key, pointer: e.pointerId, startY: e.clientY, startScroll: sc ? sc.scrollTop : 0, y: e.clientY, moved: false, before: undefined });
                          }}
                          onPointerMove={(e) => {
                            const d = dragRef.current;
                            if (!d || d.pointer !== e.pointerId) return;
                            const moved = d.moved || Math.abs(e.clientY - d.startY) > 6;
                            const at = moved ? beatDropAt(e.clientY, d.key) : undefined;
                            putDrag({ ...d, y: e.clientY, moved, before: at === undefined ? d.before : at });
                          }}
                          onPointerUp={(e) => {
                            const d = dragRef.current;
                            putDrag(null);
                            if (!d || d.pointer !== e.pointerId || !d.moved || d.before === undefined) return;
                            move(d.key, d.before);
                          }}
                          onPointerCancel={() => putDrag(null)}>
                          <Icon name="move" />
                        </button>
                      </div>
                      <div class="beat-head">
                        <input class="beat-title" type="text" value={b.title} aria-label={label + ' title'} data-own-hold=""
                          placeholder="Name this beat" {...holdProps(b.key)}
                          onInput={(e) => edit(b.key, { title: (e.target as HTMLInputElement).value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }} />
                        <Summary value={b.summary} label={label + ' summary'} onInput={(v) => edit(b.key, { summary: v })} />
                        {!isOpen && b.notes && <p class="beat-lost">{num(bodyWords(b.notes))} words of notes</p>}
                      </div>
                    </div>
                    {menu && menu.key === b.key && (
                      <div class="side-menu beat-menu" role="menu" aria-label={label}>
                        {menu.confirm ? (
                          <>
                            <p class="beat-menu-ask">{b.notes ? 'Delete ' + label.toLowerCase() + ' and its ' + num(bodyWords(b.notes)) + ' words of notes? A copy goes to the book\'s Archive.' : 'Delete ' + label.toLowerCase() + '?'}</p>
                            <button type="button" role="menuitem" class="beat-menu-delete" disabled={deleting} onClick={() => remove(b, shown)}><Icon name="archive" size={18} />{deleting ? 'Deleting…' : 'Yes, delete it'}</button>
                            <button type="button" role="menuitem" class="side-menu-cancel" onClick={() => setMenu(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button type="button" role="menuitem" class="beat-menu-delete" onClick={() => setMenu({ key: b.key, confirm: true })}><Icon name="archive" size={18} />Delete beat and its notes</button>
                            <button type="button" role="menuitem" class="side-menu-cancel" onClick={() => setMenu(null)}>Cancel</button>
                          </>
                        )}
                      </div>
                    )}
                    {isOpen && (
                      <div class="beat-body" data-active={focused === b.key ? '' : undefined} onFocusCapture={() => setFocused(b.key)}>
                        <p class="beat-notes-label">Your notes{b.notes ? '' : ': type your thoughts for this beat. They stay here and never go into the chapter.'}</p>
                        <ProseEditor key={b.key + ':' + rev} value={b.notes} onChange={(t) => edit(b.key, { notes: t })} onCaret={() => {}}
                          label={'Notes for ' + label} commands={c} options={opts} onName={onName} onLook={onLook} />
                      </div>
                    )}
                  </section>
                </Fragment>
              );
            })}
          </div>
          {!beats.length && <p class="empty">{group.scenes.length ? 'No beats yet. Add a beat to start planning this chapter.' : 'This chapter has no scenes yet.'}</p>}
          <div class="writer-done">
            <span class="meta">{n === 1 ? '1 beat' : n + ' beats'}</span>
            <button type="button" onClick={() => onOpen(startAt)}><Icon name="page" size={18} />Back to the page</button>
          </div>
    </>
  );
}
