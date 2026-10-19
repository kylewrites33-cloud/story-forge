// A chapter by its beats: each beat is a closed row with its number, title and one-line summary; open one to read and
// edit its prose right under a slim title row. The scenes keep only the story; the beats live in the book's
// `Chapter Beats/` note for the chapter (see lib/beats.ts). Everything Kyle types is kept on the device at once and saves
// the same way as the writing screen: Done, two quiet minutes, putting the iPad down, or back online.
import { Fragment, type ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  BEATS_TYPE, addBeatAfter, beatDefs, beatsBody, beatsPath, beatsTitle, layoutChapter, moveBeat, nameLoose, parseBeats, removeBeat, sceneBody,
  type BeatView, type SceneShape
} from '../lib/beats.ts';
import { chapterHeading, type ChapterGroup } from '../lib/board.ts';
import { matcher, type CodexEntry } from '../lib/codex.ts';
import { bodyWords, isUnsaved, loadDrafts, openDraft, putDraft, saveDraft, type Draft } from '../lib/drafts.ts';
import { sceneHeader } from '../lib/format.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { jobAsk, defaultJobTitle, type OnJob } from '../lib/jobs.ts';
import { loadLook, lookStyle } from '../lib/page.ts';
import { trackWords } from '../lib/pomodoro.ts';
import type { StyleOptions } from '../lib/styled.ts';
import type { NoteRecord, VaultSource } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { href } from './route.ts';
import { StyledEditor, type EditorCommands } from './StyledEditor.tsx';

const QUIET_SAVE_MS = 2 * 60 * 1000;
const num = (n: number) => n.toLocaleString('en-US');

interface State {
  scenes: Record<string, Draft>;
  beatsDraft: Draft;
  /** Text above the first beat in the note, kept as it is. */
  intro: string;
  shapes: SceneShape[];
  beats: BeatView[];
}

function introOf(body: string): string {
  const m = /(^|\n)## /.exec(body);
  return (m ? body.slice(0, m.index) : body).trim();
}

function start(source: VaultSource, group: ChapterGroup, bookFolder: string, beatsNote: NoteRecord | null): State {
  const now = new Date();
  const drafts = loadDrafts(source.key);
  const scenes: Record<string, Draft> = {};
  group.scenes.forEach((n) => { scenes[n.path] = openDraft(n, drafts[n.path], now); });
  const chapter = group.num as number;
  const path = beatsNote ? beatsNote.path : beatsPath(bookFolder, chapter);
  const kept = drafts[path];
  const beatsDraft: Draft = beatsNote ? openDraft(beatsNote, kept, now)
    : kept && kept.create && isUnsaved(kept) ? kept
    : { path, baseSha: '', baseBody: '', body: '', target: null, startWords: 0, updatedAt: now.toISOString(), pending: false,
      create: Frontmatter.join({ type: BEATS_TYPE, title: beatsTitle(chapter), chapter }, '') };
  const laid = layoutChapter(group.scenes.map((n) => ({ path: n.path, id: String(n.data.id || ''), body: scenes[n.path].body })), parseBeats(beatsDraft.body));
  return { scenes, beatsDraft, intro: introOf(beatsDraft.body), shapes: laid.scenes, beats: laid.beats };
}

const openKey = (bookFolder: string, chapter: number | null) => 'story-forge.beats-open.' + bookFolder + '#' + chapter;
function loadOpen(key: string): number[] {
  try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
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
  root: () => HTMLElement | null;
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

export function BeatsView({ source, group, bookFolder, beatsNote, codex, startAt, onSaved, onJob, asking, saver, onStatus, onOpen, options, onName, onLook, api, onActive, head, onWords }: {
  source: VaultSource; group: ChapterGroup; bookFolder: string;
  /** The chapter's beats note, or null when it has none yet. */
  beatsNote: NoteRecord | null;
  codex: CodexEntry[];
  /** The scene the beats opened from: its beats come into view. */
  startAt: string;
  onSaved: (n: NoteRecord) => void;
  onJob?: OnJob;
  /** A beats job for this chapter the team has not finished, if there is one. */
  asking: NoteRecord | null;
  saver: { current: ((closing: boolean) => Promise<boolean>) | null };
  /** The save state in Kyle's words, for the top bar's chip. */
  onStatus: (text: string, cls: string) => void;
  /** Open a scene in the page (its name above its beats). */
  onOpen: (path: string) => void;
  /** The writing screen's look for the prose (names underlined, Find); its own when left out. */
  options?: StyleOptions;
  /** A name pressed in the prose. */
  onName?: (i: number) => void;
  onLook?: Parameters<typeof StyledEditor>[0]['onLook'];
  /** Filled in so the writing screen's tool row works on the beat Kyle is in. */
  api?: { current: BeatsApi | null };
  /** The words of the beat Kyle is in, whenever they change or he moves to another beat. */
  onActive?: (text: string) => void;
  /** The writing screen's own heading (chapter, scene line, reading time, the chapter strip, the target bar); a plain heading when left out. */
  head?: ComponentChildren;
  /** Each scene's words as Kyle types, for the heading's counts. */
  onWords?: (words: Record<string, number>) => void;
}) {
  const canSave = Boolean(source.readFresh && source.write);
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
    const r = moveBeat(ref.current.beats, key, before);
    if (!r.touched.length) return;
    apply(r.beats, r.touched);
    keepOpen(new Set(open), r.beats);
  };
  const keepOpen = (next: Set<string>, beats = ref.current.beats) => {
    setOpen(next);
    try { localStorage.setItem(okey, JSON.stringify(beats.map((b, i) => (next.has(b.key) ? i : -1)).filter((i) => i >= 0))); } catch { /* the device would not keep it */ }
  };

  const unsavedAll = (s: State) => Object.values(s.scenes).some(isUnsaved) || isUnsaved(s.beatsDraft);

  /** Save every scene with unsaved words, then the beats. */
  const saveAll = useCallback(async (closing: boolean): Promise<boolean> => {
    const cur = ref.current;
    const todo = Object.values(cur.scenes).filter(isUnsaved).concat(isUnsaved(cur.beatsDraft) ? [cur.beatsDraft] : []);
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
    for (const d of todo) {
      try {
        const r = await saveDraft(source, d, new Date());
        onSaved(r.note);
        if (r.clash) clashes.push(String(r.note.data.id || r.note.data.title || d.path));
        const now = ref.current;
        const isBeats = d.path === now.beatsDraft.path;
        const latest = isBeats ? now.beatsDraft : now.scenes[d.path];
        const next: Draft = { ...latest, baseSha: r.note.sha, baseBody: d.body, pending: false, error: undefined, create: undefined };
        if (closing && !isUnsaved(next)) putDraft(source.key, d.path, null);
        else putDraft(source.key, d.path, next);
        const s2 = ref.current;
        ref.current = isBeats ? { ...s2, beatsDraft: next } : { ...s2, scenes: { ...s2.scenes, [d.path]: next } };
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
      setMessage(clashes.length ? clashes.join(', ') + ' had also changed somewhere else. Your version is saved; the other one is kept as a copy.' : null);
    }
    return ok;
  }, [source, canSave, onSaved]);

  /** New beats: the scenes they touch and the beats note follow, and everything is kept on the device. */
  const apply = (beats: BeatView[], touched: string[]) => {
    const cur = ref.current;
    const scenes = { ...cur.scenes };
    const at = new Date().toISOString();
    touched.forEach((path) => {
      const shape = cur.shapes.find((s) => s.path === path);
      const d = scenes[path];
      if (!shape || !d) return;
      const body = sceneBody(shape, beats);
      if (body === d.body) return;
      const note = group.scenes.find((n) => n.path === path);
      trackWords(path, String((note && note.data.id) || ''), bodyWords(d.body), bodyWords(body));
      scenes[path] = { ...d, body, updatedAt: at };
      putDraft(source.key, path, scenes[path]);
    });
    const defs = beatDefs(beats);
    let beatsDraft = cur.beatsDraft;
    if (defs.length || beatsDraft.baseSha) {
      const body = (cur.intro ? '\n' + cur.intro + '\n' : '') + beatsBody(defs);
      if (body !== beatsDraft.body) {
        beatsDraft = { ...beatsDraft, body, updatedAt: at };
        putDraft(source.key, beatsDraft.path, beatsDraft);
      }
    }
    ref.current = { ...cur, scenes, beatsDraft, beats };
    setSt(ref.current);
    if (state !== 'error') setState('idle');
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(() => { saveAll(false); }, QUIET_SAVE_MS);
  };

  const edit = (key: string, change: Partial<BeatView>, structural = false) => {
    const cur = ref.current;
    const b = cur.beats.find((x) => x.key === key);
    if (!b) return;
    let beats = cur.beats.map((x) => (x.key === key ? { ...x, ...change } : x));
    if (b.loose && (change.title || change.summary)) beats = nameLoose(beats, key, change.title ?? b.title).map((x) => (x.key === key ? { ...x, ...change } : x));
    apply(beats, change.prose != null ? [b.path] : []);
    if (structural) setRev((r) => r + 1);
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
      const cur = ref.current;
      Object.values(cur.scenes).concat([cur.beatsDraft]).forEach((d) => { if (isUnsaved(d)) putDraft(source.key, d.path, { ...d, pending: true }); });
    };
  }, [source, saveAll]);

  saver.current = saveAll;

  // Ask the team for beats.
  const [asked, setAsked] = useState<{ error: boolean; text: string } | null>(null);
  const [words, setWords] = useState('');
  const [sending, setSending] = useState(false);
  const target = 'Chapter ' + group.num;
  const askTeam = async () => {
    if (!onJob) return;
    setSending(true);
    const r = await onJob({ title: defaultJobTitle('beats', target), kind: 'beats', target, book: bookFolder, ask: jobAsk('beats', target, words) });
    setSending(false);
    setAsked(r);
    if (!r.error) setWords('');
  };

  const { beats } = st;
  const hasBeats = beats.some((b) => !b.loose);
  const hasProse = beats.some((b) => b.prose.trim());
  const [askOpen, setAskOpen] = useState(!hasBeats);
  const unsaved = unsavedAll(st);
  const chip = state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved' : unsaved ? (state === 'device' || !navigator.onLine ? 'On this device' : 'Saved on device') : 'Saved';
  useEffect(() => { onStatus(chip, chip === 'Saved' ? 'good' : state === 'error' ? 'bad' : ''); }, [chip]);
  // The scene the beats opened from comes into view.
  useEffect(() => {
    const el = document.querySelector('[data-beats-scene="' + CSS.escape(startAt) + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  }, []);
  const cmd = () => { const c = commands.current[focused]; return c ? c.current : null; };
  const focusedProse = (beats.find((b) => b.key === focused) || { prose: '' }).prose;
  if (api) api.current = { cmd, root: () => document.querySelector<HTMLElement>('.beat-body[data-active] .writer-text.styled') };
  useEffect(() => { if (onActive) onActive(focusedProse); }, [focused, focusedProse]);
  useEffect(() => {
    if (!onWords) return;
    const w: Record<string, number> = {};
    Object.values(st.scenes).forEach((d) => { w[d.path] = bodyWords(d.body); });
    onWords(w);
  }, [st.scenes]);
  let n = 0;

  return (
    <>
          <div class="page-head">
            {head || <h1>{chapterHeading(group)}</h1>}
            <p class="meta">The chapter by its beats. Press a number to open or close a beat. Change any words in place; they save like the page. Press Page at the top to go back.</p>
            {message && <p class={state === 'error' ? 'error' : 'note-line'}>{message}</p>}
            <div class="buttons beat-tools">
              <button type="button" onClick={() => keepOpen(new Set(beats.map((b) => b.key)))}>Open all</button>
              <button type="button" onClick={() => keepOpen(new Set())}>Close all</button>
              {onJob && <button type="button" aria-expanded={askOpen} onClick={() => setAskOpen(!askOpen)}><Icon name="team" size={18} />Ask the team</button>}
            </div>
            {onJob && askOpen && (
              <div class="beat-ask">
                {asking ? (
                  <p class="note-line"><span class="job-dot" aria-hidden="true" /> The team is working on this chapter's beats ({String(asking.data.id || '')}). They show here when they are done.</p>
                ) : (
                  <>
                    <p class="meta">{hasBeats ? 'The team can redo these beats. The old ones go to the book\'s archive.'
                      : hasProse ? 'This chapter has no beats yet. The team can find them in the prose without changing a word.'
                      : 'This chapter has no beats yet. Say what the chapter should do, and the team plans its beats.'}</p>
                    <textarea rows={2} value={words} placeholder="What should this chapter do? (optional)" aria-label="What the chapter should do"
                      onInput={(e) => setWords((e.target as HTMLTextAreaElement).value)} />
                    <button type="button" class="primary" disabled={sending || (!hasProse && !words.trim())} onClick={askTeam}>
                      {hasBeats ? 'Ask the team to redo the beats' : hasProse ? 'Ask the team to find the beats' : 'Ask the team to plan the beats'}
                    </button>
                  </>
                )}
                {asked && <p class={asked.error ? 'error' : 'ok'}>{asked.text}</p>}
              </div>
            )}
          </div>
          <div class={'beats' + (drag && drag.moved && drag.before === null ? ' drop-end' : '')}>
            {beats.map((b, i) => {
              const isOpen = open.has(b.key);
              const newScene = i === 0 || beats[i - 1].path !== b.path;
              const note = group.scenes.find((s) => s.path === b.path);
              // Every part of a scene is a beat, named or not (Kyle, 2026-10-19).
              const label = 'Beat ' + (n + 1);
              n++;
              const toggle = () => { const next = new Set(open); if (isOpen) next.delete(b.key); else next.add(b.key); keepOpen(next); };
              const c = commands.current[b.key] || (commands.current[b.key] = { current: null });
              const dragging = Boolean(drag && drag.moved && drag.key === b.key);
              // Move down: in front of the beat after next (or to the end).
              const after = beats[i + 2] ? beats[i + 2].key : null;
              return (
                <Fragment key={b.key}>
                  {newScene && (
                    <p class="beat-scene">
                      {i > 0 && <span class="beat-break" aria-hidden="true">~</span>}
                      <a href={href.write(b.path)} data-beats-scene={b.path} onClick={(e) => { e.preventDefault(); onOpen(b.path); }}>{[b.scene, note ? sceneHeader(note.data) : ''].filter(Boolean).join(' ')}</a>
                    </p>
                  )}
                  <section class={'beat' + (isOpen ? ' open' : '') + (b.loose ? ' loose' : '') + (dragging ? ' dragging' : '') + (drag && drag.moved && drag.before === b.key ? ' drop-before' : '')}
                    data-beat={b.key} style={dragging ? { transform: 'translateY(' + (drag!.y - drag!.startY + ((beatsScroller() || { scrollTop: 0 }).scrollTop - drag!.startScroll)) + 'px)' } : undefined}>
                    <div class="beat-row">
                      <button type="button" class="beat-toggle" aria-expanded={isOpen} aria-label={(isOpen ? 'Close ' : 'Open ') + label} onClick={toggle}>
                        <span>{n}</span><Icon name={isOpen ? 'down' : 'right'} size={16} />
                      </button>
                      <div class="beat-head">
                        <input class="beat-title" type="text" value={b.title} aria-label={label + ' title'}
                          placeholder="Name this beat"
                          onInput={(e) => edit(b.key, { title: (e.target as HTMLInputElement).value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }} />
                        {!isOpen && <Summary value={b.summary} label={label + ' summary'} onInput={(v) => edit(b.key, { summary: v })} />}
                        {!isOpen && b.lost && <p class="beat-lost">Its first words changed in the page, so its prose now sits in the beat above.</p>}
                        {!isOpen && !b.prose.trim() && !b.lost && <p class="beat-lost">No prose yet.</p>}
                      </div>
                      {(
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
                      )}
                    </div>
                    {isOpen && (
                      <div class="beat-body" data-active={focused === b.key ? '' : undefined} onFocusCapture={() => setFocused(b.key)}>
                        <StyledEditor key={b.key + ':' + rev} value={b.prose} onChange={(t) => edit(b.key, { prose: t, lost: false })} onCaret={() => {}}
                          label={'Prose of ' + label} commands={c} options={opts} onName={onName} onLook={onLook} />
                        <div class="beat-actions">
                          <button type="button" onClick={() => { const next = addBeatAfter(ref.current.beats, b.key, ''); apply(next, []); const k = next[next.indexOf(next.find((x) => x.key === b.key)!) + 1].key; keepOpen(new Set([...open, k]), next); }}>
                            <Icon name="plus" size={16} />Add a beat after
                          </button>
                          {i > 0 && (
                            <button type="button" onClick={() => move(b.key, beats[i - 1].key)}><Icon name="up" size={16} />Move up</button>
                          )}
                          {i < beats.length - 1 && (
                            <button type="button" onClick={() => move(b.key, after)}><Icon name="down" size={16} />Move down</button>
                          )}
                          {!b.loose && (
                            <button type="button" onClick={() => { apply(removeBeat(ref.current.beats, b.key), [b.path]); setRev((r) => r + 1); }}>
                              Take off this heading
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                </Fragment>
              );
            })}
          </div>
          {!beats.length && <p class="empty">This chapter has no scenes yet.</p>}
          <div class="writer-done">
            <span class="meta">{n === 1 ? '1 beat' : n + ' beats'}</span>
            <button type="button" onClick={() => onOpen(startAt)}><Icon name="page" size={18} />Back to the page</button>
          </div>
    </>
  );
}
