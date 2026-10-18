import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { chapterGroups, chapterHeading } from '../lib/board.ts';
import { formatValue, isEmptyValue, label, sceneHeader } from '../lib/format.ts';
import { basename } from '../lib/links.ts';
import { render } from '../lib/markdown.ts';
import { cardFields, editableFields, propDef, propertyOrder } from '../lib/schema.ts';
import { EditFields } from './EditFields.tsx';
import { piles, type Decision } from '../lib/ideas.ts';
import type { BookEntry, NoteRecord, Schema, VaultIndex, VaultSource } from '../lib/types.ts';
import { bookProgress, labelHue, labelsOf, loadRates, parseOutline, readingLine, readingTime, sceneMatches, type OutlineScene, type ReadRates } from '../lib/home.ts';
import { Cover } from './Home.tsx';
import type { Choice } from '../lib/write-queue.ts';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';
import { defaultJobTitle, type JobKind, type OnJob } from '../lib/jobs.ts';
import { appearances, codexFor, matcher } from '../lib/codex.ts';
import { nowForNote } from '../lib/codexnow.ts';
import { activeBook } from '../lib/vault-index.ts';
import { BeatRuler } from './BeatRuler.tsx';
import { CodexNowBox } from './CodexNow.tsx';

export function Warnings({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <details class="warnings">
      <summary>{list.length === 1 ? '1 note needs a look' : list.length + ' notes need a look'}</summary>
      <ul>{list.map((w) => <li key={w}>{w}</li>)}</ul>
    </details>
  );
}

/** "12 ideas to decide", linking to the book's Ideas board. */
export function IdeasLink({ index, book }: { index: VaultIndex; book: BookEntry }) {
  const notes = (book.ideas || []).map((p) => index.notes[p]).filter(Boolean);
  if (!notes.length) return null;
  const n = piles(notes).decide.length;
  return (
    <a class="ideas-link" href={href.ideas(book.folder)}>
      {n ? (n === 1 ? '1 idea to decide' : n + ' ideas to decide') : 'Ideas: nothing to decide'}
    </a>
  );
}

type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;
/** A scene card's new title: the file is renamed to match. Returns a plain sentence when it did not work. */
export type OnRename = (note: NoteRecord, title: string) => Promise<string | null>;

/** Accept a scene card, or say it needs work and why. The card's status (planned, drafted) does not change. */
function CardActions({ schema, note, waiting, onDecide, handle, onJob, bookFolder, onRename }: {
  schema: Schema; note: NoteRecord; waiting?: Choice; onDecide: OnDecide; handle?: ComponentChildren; onJob?: OnJob; bookFolder?: string; onRename?: OnRename;
}) {
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const status = String(note.data.status || '');
  const sceneId = String(note.data.id || '');
  const ask = async (kind: JobKind) => {
    if (!onJob) return;
    setMenu(false);
    setSending(true);
    setSaid(null);
    const r = await onJob({ title: defaultJobTitle(kind, sceneId, String(note.data.title || '')), kind, target: sceneId, book: bookFolder || '', ask: '' });
    setSending(false);
    setSaid(r);
  };
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reason, setReason] = useState('');
  const accepted = !isEmptyValue(note.data.accepted);
  const send = (d: Decision) => { onDecide(note.path, d, reason); setReason(''); setAsking(false); };
  if (note.error) return null;
  return (
    <div class="card-actions">
      {waiting && <p class={'pill' + (waiting.error ? ' pill-error' : '')}>{waiting.error ? 'Not saved: ' + waiting.error : 'Saving'}</p>}
      {sending && <p class="hint">Sending to the team…</p>}
      {renaming && <p class="hint">Changing the title…</p>}
      {renameError && <p class="error">{renameError}</p>}
      {said && <p class={said.error ? 'error' : 'ok'}>{said.text}</p>}
      {!accepted && !isEmptyValue(note.data.decision_note) && <p class="reason-shown">Needs work: {String(note.data.decision_note)}</p>}
      {editing ? (
        <EditFields schema={schema} note={note} fields={(onRename ? ['title'] : []).concat(editableFields(schema, note.type))} onClose={() => setEditing(false)}
          onSave={async (f) => {
            const { title: newTitle, ...rest } = f;
            if (Object.keys(rest).length) onDecide(note.path, 'edit', '', rest);
            if (newTitle != null && onRename) {
              setRenaming(true);
              setRenameError(await onRename(note, newTitle));
              setRenaming(false);
            }
          }} />
      ) : asking ? (
        <>
          <label class="reason">
            What should change?
            <input type="text" value={reason} onInput={(e) => setReason((e.currentTarget as HTMLInputElement).value)} placeholder="One line" />
          </label>
          <div class="buttons">
            <button type="button" class="primary" onClick={() => send('rework')}>Send back</button>
            <button type="button" onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div class="buttons card-row">
            {handle}
            {!accepted && <button type="button" class="soft" onClick={() => send('accept')}><Icon name="check" size={18} />Accept</button>}
            <a class="button" href={href.write(note.path)}><Icon name="pen" size={18} />Write</a>
            <button type="button" class="icon-button" aria-label="More for this card" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name="more" /></button>
          </div>
          {menu && (
            <div class="card-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setAsking(true); }}>Needs work</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setEditing(true); }}>Edit card</button>
              {onJob && sceneId && status === 'planned' && <button type="button" role="menuitem" disabled={sending} onClick={() => ask('draft')}>Draft this scene</button>}
              {onJob && sceneId && <button type="button" role="menuitem" disabled={sending} onClick={() => ask('check')}>Check for AI-sounding phrases</button>}
              <a class="button" role="menuitem" href={href.note(note.path)}>Open the note</a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SceneCard({ schema, note, waiting, onDecide, handle, cls, shift, onJob, bookFolder, onRename }: {
  schema: Schema; note: NoteRecord; waiting?: Choice; onDecide?: OnDecide; handle?: ComponentChildren; cls?: string; shift?: number[] | null; onJob?: OnJob; bookFolder?: string; onRename?: OnRename;
}) {
  const fields = cardFields(schema, note.type);
  const title = sceneHeader(note.data, basename(note.path));
  const rows = fields.filter((k) => k !== 'title' && k !== 'headline' && k !== 'subtitle' && k !== 'labels' && k !== 'status' && k !== 'words' && !isEmptyValue(note.data[k]));
  const subtitle = fields.indexOf('subtitle') >= 0 && !isEmptyValue(note.data.subtitle) ? String(note.data.subtitle) : '';
  const labels = fields.indexOf('labels') >= 0 ? labelsOf(note.data.labels) : [];
  const status = String(note.data.status || '');
  const words = fields.indexOf('words') >= 0 ? formatValue('words', note.data.words, null) : '';
  const accepted = !isEmptyValue(note.data.accepted);
  return (
    <li class={'scene-item' + (cls ? ' ' + cls : '')} data-scene={note.path} style={shift ? { transform: 'translate(' + shift[0] + 'px, ' + shift[1] + 'px)' } : undefined}>
      <a class={'card status-' + (status || 'none').replace(/[^a-z-]/gi, '')} href={onDecide ? href.write(note.path) : href.note(note.path)}>
        <span class="card-top">
          {/* No scene ID or status word on the grid; the coloured edge shows the status (Kyle, 2026-10-18, an experiment). */}
          <span class="card-id">{note.data.kind === 'test' ? 'Test drive' : ''}</span>
          <span class="pills">
            {accepted && <span class="pill pill-accepted">Accepted</span>}
          </span>
        </span>
        <span class="card-title">{title}</span>
        {subtitle && <span class="card-subtitle">{subtitle}</span>}
        {labels.length > 0 && <span class="labels">{labels.map((l) => <Label key={l} name={l} />)}</span>}
        {rows.length > 0 && (
          <dl>
            {rows.map((k) => (
              <div key={k}>
                <dt>{label(k)}</dt>
                <dd>{formatValue(k, note.data[k], propDef(schema, note.type, k))}</dd>
              </div>
            ))}
          </dl>
        )}
        {words && <span class="card-words">{words}</span>}
        {note.error && <span class="card-error">Frontmatter problem: {note.error}</span>}
      </a>
      {onDecide && <CardActions schema={schema} note={note} waiting={waiting} onDecide={onDecide} handle={handle} onJob={onJob} bookFolder={bookFolder} onRename={onRename} />}
    </li>
  );
}

/** A scene label as a small coloured chip; the same label always has the same colour. */
export function Label({ name }: { name: string }) {
  return <span class="label" style={{ '--hue': String(labelHue(name)) }}>{name}</span>;
}

type OnAdd = (book: BookEntry, chapter: number | null, chapterTitle: string, title: string) => Promise<string | null>;

/** "Add a scene" under a chapter (or "Start chapter N" at the end): asks for a title, then opens the new scene for writing. */
function AddScene({ book, chapter, chapterTitle, label, onAdd, startOpen, onCancel }: {
  book: BookEntry; chapter: number | null; chapterTitle: string; label: string; onAdd: OnAdd; startOpen?: boolean; onCancel?: () => void;
}) {
  const [open, setOpen] = useState(Boolean(startOpen));
  const [title, setTitle] = useState('');
  const [chTitle, setChTitle] = useState(chapterTitle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newChapter = !chapterTitle && label.startsWith('Start');
  if (!open) return <div class="buttons add-scene"><button type="button" onClick={() => setOpen(true)}>{label}</button></div>;
  const go = async () => {
    setBusy(true);
    const err = await onAdd(book, chapter, newChapter ? chTitle.trim() : chapterTitle, title.trim());
    setBusy(false);
    setError(err);
  };
  return (
    <div class="add-scene">
      {newChapter && (
        <label class="reason">
          Chapter title (you can leave it empty)
          <input type="text" value={chTitle} onInput={(e) => setChTitle((e.currentTarget as HTMLInputElement).value)} />
        </label>
      )}
      <label class="reason">
        Title of the new scene
        <input type="text" value={title} onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} placeholder="For example Grey lies to Rue" />
      </label>
      <div class="buttons">
        <button type="button" class="primary" disabled={busy || !title.trim()} onClick={go}>{busy ? 'Adding…' : 'Add and start writing'}</button>
        <button type="button" onClick={() => { setOpen(false); setError(null); if (onCancel) onCancel(); }}>Cancel</button>
      </div>
      {error && <p class="error">{error}</p>}
    </div>
  );
}

type OnAddMany = (book: BookEntry, list: OutlineScene[]) => Promise<string | null>;

/** Paste an outline: "Chapter 1: Title" lines start chapters, every other line becomes a planned scene. */
function OutlineForm({ book, firstChapter, onAddMany, onCancel }: { book: BookEntry; firstChapter: number; onAddMany: OnAddMany; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = parseOutline(text, firstChapter);
  const chapters = new Set(list.map((s) => s.chapter)).size;
  const go = async () => {
    setBusy(true);
    const err = await onAddMany(book, list);
    setBusy(false);
    setError(err);
    if (!err) { setText(''); onCancel(); }
  };
  return (
    <div class="add-scene outline-form">
      <label class="reason">
        Paste or type an outline. A line like "Chapter 1: The Frost" starts a chapter; every other line becomes a planned scene with that title.
        <textarea rows={8} value={text} onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
          placeholder={'Chapter 1: The Frost\nGrey finds the dead field\nRue brings the letter\nChapter 2: The Offer\nThe buyer arrives'} />
      </label>
      {list.length > 0 && <p class="hint">{list.length === 1 ? '1 scene' : list.length + ' scenes'} in {chapters === 1 ? '1 chapter' : chapters + ' chapters'}, added as planned scenes after the book's last scene.</p>}
      <div class="buttons">
        <button type="button" class="primary" disabled={busy || !list.length} onClick={go}>{busy ? 'Adding…' : 'Add these scenes'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
      {error && <p class="error">{error}</p>}
    </div>
  );
}

/** Bring in a manuscript: pick a Word or text file on this device; it is saved in the book's Research folder as it is,
 * and the team splits it into scenes (a job). */
function ImportButton({ book, onImport }: { book: BookEntry; onImport: (book: BookEntry, file: File) => Promise<{ error: boolean; text: string }> }) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  return (
    <>
      <label class={'button' + (busy ? ' disabled' : '')}>
        <Icon name="upload" size={18} />{busy ? 'Sending…' : 'Bring in a manuscript'}
        <input type="file" accept=".docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" class="visually-hidden" disabled={busy}
          onChange={async (e) => {
            const input = e.currentTarget as HTMLInputElement;
            const file = input.files && input.files[0];
            input.value = '';
            if (!file) return;
            setBusy(true);
            setSaid(await onImport(book, file));
            setBusy(false);
          }} />
      </label>
      {said && <p class={said.error ? 'error' : 'ok'}>{said.text}</p>}
    </>
  );
}

/** A friendly empty page: what is missing and the buttons that fill it. */
export function EmptyBox({ title, children }: { title: string; children?: ComponentChildren }) {
  return <div class="empty-box"><h2>{title}</h2>{children}</div>;
}

/** The book's cover beside its title. Adding or changing it lives on the Book details page (Kyle, 2026-10-18). */
function GridCover({ source, book }: { source: VaultSource; book: BookEntry }) {
  return <a class="grid-cover" href={href.board('details', book.folder)} title="Book details"><Cover source={source} book={book} small /></a>;
}

type GridView = 'cards' | 'outline';
// Outline first and by default (Kyle, 2026-10-18); a new key so every device starts on Outline once.
function loadGridView(): GridView {
  try { return localStorage.getItem('story-forge.grid-view-2') === 'cards' ? 'cards' : 'outline'; } catch { return 'outline'; }
}

const STEP_NAME = { drafting: 'Drafting', revising: 'Revising', finishing: 'Finishing', done: 'Done' };

/** The numbers at the top of the Chapter Grid, and a ring for how far the book is through the step it is in (Kyle, 2026-10-18). */
function BookSummary({ stage, chapters, scenes, words, rates, order, counts }: {
  stage: string; chapters: number; scenes: NoteRecord[]; words: number; rates: ReadRates; order: string[]; counts: Record<string, number>;
}) {
  const p = bookProgress(scenes.map((s) => String(s.data.status || 'planned')), order);
  const r = 22, c = 2 * Math.PI * r;
  const pages = words > 0 ? Math.max(1, Math.round(words / rates.wordsPerPage)) : 0;
  const stat = (n: string | number, label: string, key?: string) => (
    <div class={'stat' + (key ? ' stat-' + key : '')}><span class="stat-n">{n}</span><span class="stat-l">{label}</span></div>
  );
  return (
    <div class="book-summary">
      {scenes.length > 0 && (
        <div class={'ring ring-' + p.colour} title={p.done + ' of ' + p.total + ' scenes'}>
          <svg viewBox="0 0 56 56" width="64" height="64" aria-hidden="true">
            <circle cx="28" cy="28" r={r} class="ring-back" />
            <circle cx="28" cy="28" r={r} class="ring-fill" stroke-dasharray={c} stroke-dashoffset={c * (1 - p.percent / 100)} transform="rotate(-90 28 28)" />
          </svg>
          <span class="ring-text"><span class="stat-n">{p.percent}%</span><span class="stat-l">{STEP_NAME[p.step]}</span></span>
        </div>
      )}
      <div class="stats">
        {stat(stage ? stage[0].toUpperCase() + stage.slice(1) : '—', 'Stage')}
        {stat(chapters, chapters === 1 ? 'Chapter' : 'Chapters')}
        {stat(scenes.length, scenes.length === 1 ? 'Scene' : 'Scenes')}
        {stat(words.toLocaleString('en-US'), 'Words')}
        {stat('~' + pages, pages === 1 ? 'Page' : 'Pages')}
        {order.map((k) => stat(counts[k] || 0, k[0].toUpperCase() + k.slice(1), k))}
      </div>
    </div>
  );
}

/** The Outline view: chapter headings with one line per scene, nothing else. */
function OutlineView({ groups }: { groups: ReturnType<typeof chapterGroups> }) {
  return (
    <div class="outline-view">
      {groups.map((g) => (
        <section key={g.key}>
          <h2>{chapterHeading(g)}<span class="meta"> {g.words ? g.words.toLocaleString('en-US') + ' words' : ''}</span></h2>
          <ol>
            {g.scenes.map((s) => {
              const st = String(s.data.status || 'planned');
              const line = String(s.data.summary || s.data.turn || '');
              return (
                <li key={s.path} class={'status-' + st.replace(/[^a-z-]/gi, '')}>
                  <a href={href.write(s.path)}>
                    <span class="outline-title">{sceneHeader(s.data, basename(s.path))}</span>
                    {!isEmptyValue(s.data.subtitle) && <span class="card-subtitle">{String(s.data.subtitle)}</span>}
                    {line && <span class="outline-line">{line}</span>}
                  </a>
                  <span class="labels">
                    {labelsOf(s.data.labels).map((l) => <Label key={l} name={l} />)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** A card dropped on the Chapter Grid: the scene, the chapter it goes into, and the scene it now comes before (null: the chapter's end). */
export type OnMove = (book: BookEntry, path: string, chapter: number | null, chapterTitle: string, before: string | null) => void;

interface DropAt { key: string; before: string | null; /** Cards sit side by side here, so the line goes beside the card. */ side: boolean }
interface Dragging { path: string; pointer: number; startX: number; startY: number; startScroll: number; x: number; y: number; moved: boolean; at: DropAt | null }

/** Where a card held at (x, y) would land: before the card under it (its top or left half) or after it, or at a chapter's start or end.
 * On a wide screen cards sit side by side and read left to right, so there the left and right halves decide. */
function dropAt(x: number, y: number, dragged: string): DropAt | null {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    const item = (el as HTMLElement).closest('[data-scene]') as HTMLElement | null;
    const ch = (el as HTMLElement).closest('[data-chapter]') as HTMLElement | null;
    if (!ch) continue;
    const key = ch.dataset.chapter || '';
    const others = [...ch.querySelectorAll<HTMLElement>('[data-scene]')].filter((e) => e.dataset.scene !== dragged);
    const list = ch.querySelector('.cards');
    const side = !!list && getComputedStyle(list).gridTemplateColumns.trim().split(/\s+/).length > 1;
    if (item && item.dataset.scene !== dragged) {
      const r = item.getBoundingClientRect();
      if (side ? x < r.left + r.width / 2 : y < r.top + r.height / 2) return { key, before: item.dataset.scene || null, side };
      const after = others[others.indexOf(item) + 1];
      return { key, before: after ? after.dataset.scene || null : null, side };
    }
    if (item) continue;
    if ((el as HTMLElement).closest('h2')) return { key, before: others[0] ? others[0].dataset.scene || null : null, side };
    return { key, before: null, side };
  }
  return null;
}

export function ChapterGrid({ schema, index, book, waiting, onDecide, onAdd, onAddMany, onMove, source, onJob, onRename, onImport }: {
  schema: Schema; index: VaultIndex; book: BookEntry; waiting?: Record<string, Choice>; onDecide?: OnDecide; onAdd?: OnAdd; onAddMany?: OnAddMany; onMove?: OnMove;
  source?: VaultSource;
  /** Ask the team to draft or check a scene, from a card's ••• menu. */
  onJob?: OnJob;
  onRename?: OnRename;
  /** Bring in a manuscript: the file goes to the book's Research folder and the team splits it into scenes. */
  onImport?: (book: BookEntry, file: File) => Promise<{ error: boolean; text: string }>;
}) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<GridView>(loadGridView);
  const [starting, setStarting] = useState<'' | 'scene' | 'outline'>('');
  const [drag, setDrag] = useState<Dragging | null>(null);
  const [hint, setHint] = useState(false);
  const dragRef = useRef<Dragging | null>(null);
  const put = (d: Dragging | null) => { dragRef.current = d; setDrag(d); };
  // Near the top or bottom of the screen the page scrolls, so a card can travel to a far chapter.
  useEffect(() => {
    if (!drag) return;
    const t = setInterval(() => {
      const d = dragRef.current;
      if (!d || !d.moved) return;
      const edge = 80;
      const step = d.y < edge ? -Math.ceil((edge - d.y) / 4) : d.y > innerHeight - edge ? Math.ceil((d.y - innerHeight + edge) / 4) : 0;
      if (!step) return;
      scrollBy(0, step);
      put({ ...d, at: dropAt(d.x, d.y, d.path) || d.at });
    }, 30);
    return () => clearInterval(t);
  }, [drag && drag.path]);

  const scenes = book.scenes.map((p) => index.notes[p]).filter(Boolean);
  const allGroups = chapterGroups(schema, scenes);
  const words = allGroups.reduce((n, g) => n + g.words, 0);
  const filtering = query.trim() !== '';
  const shown = filtering ? scenes.filter((s) => sceneMatches(s, query)) : scenes;
  const groups = filtering ? chapterGroups(schema, shown) : allGroups;
  const rates = loadRates();
  const counts: Record<string, number> = {};
  scenes.forEach((s) => { const st = String(s.data.status || 'planned'); counts[st] = (counts[st] || 0) + 1; });
  const order = schema.statuses.scene || Object.keys(counts);
  const board = schema.boards['chapter-grid'];
  const accepted = scenes.filter((s) => !isEmptyValue(s.data.accepted)).length;

  const handle = (path: string) => onMove && !filtering && (
    <button type="button" class="move-handle icon-button" title="Move" aria-label="Move this card: hold and drag"
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setHint(false);
        put({ path, pointer: e.pointerId, startX: e.clientX, startY: e.clientY, startScroll: scrollY, x: e.clientX, y: e.clientY, moved: false, at: null });
      }}
      onPointerMove={(e) => {
        const d = dragRef.current;
        if (!d || d.pointer !== e.pointerId) return;
        const moved = d.moved || Math.abs(e.clientY - d.startY) > 6 || Math.abs(e.clientX - d.startX) > 6;
        put({ ...d, x: e.clientX, y: e.clientY, moved, at: moved ? dropAt(e.clientX, e.clientY, d.path) || d.at : null });
      }}
      onPointerUp={(e) => {
        const d = dragRef.current;
        put(null);
        if (!d || d.pointer !== e.pointerId) return;
        if (!d.moved) { setHint(true); return; }
        if (!d.at) return;
        const g = groups.find((x) => x.key === d.at!.key);
        if (!g) return;
        // Dropped where it already was: nothing to save.
        const inG = g.scenes.map((n) => n.path);
        const was = inG.indexOf(d.path);
        if (was >= 0 && (d.at.before === d.path || d.at.before === (inG[was + 1] || null))) return;
        onMove(book, d.path, g.num, g.title, d.at.before);
      }}
      onPointerCancel={() => put(null)}>
      <Icon name="move" />
    </button>
  );
  const shiftOf = (path: string) => (drag && drag.moved && drag.path === path ? [drag.x - drag.startX, drag.y + scrollY - drag.startY - drag.startScroll] : null);
  const clsOf = (g: { key: string }, path: string) =>
    drag && drag.moved && drag.path === path ? 'dragging' : drag && drag.at && drag.at.key === g.key && drag.at.before === path ? 'drop-before' + (drag.at.side ? ' side' : '') : '';
  return (
    <section>
      <div class="grid-head">
        {source && <GridCover source={source} book={book} />}
        <div>
          <p class="crumb"><a href={href.series(book.seriesFolder)}>{book.seriesName}</a> · {(board && board.title) || 'Chapter Grid'}</p>
          <h1>{book.title}</h1>
          <BookSummary stage={book.stage} chapters={allGroups.filter((g) => g.num != null).length} scenes={scenes} words={words} rates={rates} order={order} counts={counts} />
          {(words > 0 || (onDecide && scenes.length > 0)) && (
            <p class="meta">
              {words ? readingTime(words, rates) : ''}
              {onDecide && scenes.length > 0 ? (words ? ' · ' : '') + accepted + ' of ' + scenes.length + ' cards accepted' : ''}
            </p>
          )}
          <IdeasLink index={index} book={book} />
        </div>
      </div>
      <BeatRuler index={index} book={book} />
      {scenes.length > 0 && (
        <div class="grid-tools">
          <label class="search">
            <Icon name="search" size={18} />
            <span class="visually-hidden">Filter scenes</span>
            <input type="search" value={query} placeholder="Filter: a name, a word, a label…" onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <div class="seg small" role="group" aria-label="View as">
            {(['outline', 'cards'] as GridView[]).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); try { localStorage.setItem('story-forge.grid-view-2', v); } catch { /* lasts until reload */ } }}>
                <Icon name={v} size={18} />{v === 'cards' ? 'Cards' : 'Outline'}
              </button>
            ))}
          </div>
          <p class="status-key" aria-label="What the colours mean">
            {(['planned', 'drafted', 'revised', 'final'] as const).map((k) => <span key={k}><i class={'key-' + k} />{k[0].toUpperCase() + k.slice(1)}</span>)}
          </p>
        </div>
      )}
      {filtering && <p class="meta">{shown.length === 1 ? '1 scene matches' : shown.length + ' scenes match'} "{query.trim()}".{shown.length ? '' : ' Try a shorter word.'}</p>}
      {view === 'outline' && scenes.length > 0 && <OutlineView groups={groups} />}
      {view === 'cards' && onMove && !filtering && scenes.length > 1 && (
        <p class={'meta move-hint' + (hint ? ' shown' : '')}>
          {hint ? 'Hold the dotted Move button down and drag the card to where it goes, then let go.' : 'Press a card to write it. To change the order, hold a card\'s dotted Move button and drag the card.'}
        </p>
      )}
      {!scenes.length && (
        <EmptyBox title="Nothing here yet">
          <p>Start the book with its first scene, or paste an outline and get every scene at once.{onAdd ? '' : ' Add your key in Settings to add scenes from here.'}
            {' '}{onImport ? 'Or bring in a manuscript you already wrote, as a Word or text file.' : ''}</p>
          {onAdd && !starting && (
            <div class="buttons">
              <button type="button" class="primary" onClick={() => setStarting('scene')}><Icon name="plus" size={18} />Create first scene</button>
              {onAddMany && <button type="button" onClick={() => setStarting('outline')}><Icon name="outline" size={18} />Start from an outline</button>}
              {onImport && <ImportButton book={book} onImport={onImport} />}
            </div>
          )}
          {onAdd && starting === 'scene' && <AddScene book={book} chapter={1} chapterTitle="" label="Start chapter 1" onAdd={onAdd} startOpen onCancel={() => setStarting('')} />}
          {onAddMany && starting === 'outline' && <OutlineForm book={book} firstChapter={1} onAddMany={onAddMany} onCancel={() => setStarting('')} />}
        </EmptyBox>
      )}
      {view === 'cards' && groups.map((g) => (
        <section class="chapter" key={g.key} data-chapter={g.key}>
          <h2>
            {chapterHeading(g)}
            <span class="meta"> {g.scenes.length === 1 ? '1 scene' : g.scenes.length + ' scenes'}{g.words ? ' · ' + g.words.toLocaleString('en-US') + ' words · ' + readingLine(g.words, rates).replace(/^about /, '') : ''}</span>
            {g.num != null && g.scenes.length > 0 && <a class="chapter-beats-link" href={href.beats(g.scenes[0].path)}><Icon name="beats" size={16} />Beats</a>}
          </h2>
          <ul class={'cards' + (drag && drag.moved && drag.at && drag.at.key === g.key && drag.at.before === null ? ' drop-end' : '')}>
            {g.scenes.map((s) => (
              <SceneCard key={s.path} schema={schema} note={s} waiting={waiting && waiting[s.path]} onDecide={onDecide}
                handle={handle(s.path)} cls={clsOf(g, s.path)} shift={shiftOf(s.path)} onJob={onJob} bookFolder={book.folder} onRename={onRename} />
            ))}
          </ul>
          {onAdd && !filtering && g.num != null && <AddScene book={book} chapter={g.num} chapterTitle={g.title} label={'Add a scene to chapter ' + g.num} onAdd={onAdd} />}
        </section>
      ))}
      {onAdd && !filtering && scenes.length > 0 && (() => {
        const last = allGroups.filter((g) => g.num != null).reduce((m, g) => Math.max(m, g.num as number), 0);
        return (
          <>
            <AddScene book={book} chapter={last + 1} chapterTitle="" label={'Start chapter ' + (last + 1)} onAdd={onAdd} />
            {onAddMany && (starting === 'outline'
              ? <OutlineForm book={book} firstChapter={last + 1} onAddMany={onAddMany} onCancel={() => setStarting('')} />
              : <div class="buttons add-scene"><button type="button" onClick={() => setStarting('outline')}>Add scenes from an outline</button>{onImport && <ImportButton book={book} onImport={onImport} />}</div>)}
          </>
        );
      })()}
    </section>
  );
}

/** Where a note of each type is decided. */
const DECIDED_ON: Record<string, { name: string; to: (folder: string) => string }> = {
  idea: { name: 'Ideas board', to: href.ideas },
  beat: { name: 'Beat Sheet', to: (f) => href.board('beat-sheet', f) },
  conflict: { name: 'Conflict Matrix', to: (f) => href.board('conflict-matrix', f) },
  scene: { name: 'Chapter Grid', to: href.book }
};

export function NoteView({ schema, index, path }: { schema: Schema; index: VaultIndex; path: string }) {
  const note = index.notes[path];
  if (!note) return <p class="empty">That note is not in the saved copy. <a href={href.home()}>Back to books</a>.</p>;
  const book = index.books.find((b) => path.startsWith(b.folder + '/'));
  const title = String(note.data.title || note.data.name || basename(path));
  const keys = propertyOrder(schema, note.type, note.data).filter((k) => !isEmptyValue(note.data[k]) && k !== 'title');
  return (
    <article class="note">
      {book && <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a></p>}
      <h1>{title}</h1>
      <p class="meta">
        {book && DECIDED_ON[note.type] ? <><a href={DECIDED_ON[note.type].to(book.folder)}>Decide it on the {DECIDED_ON[note.type].name}</a>, or edit it in Obsidian. </> : 'Read only here. Edit in Obsidian. '}
        <span class="path">{path}</span>
      </p>
      {note.error && <p class="error">The frontmatter cannot be read: {note.error}</p>}
      {note.type === 'scene' && !note.error && (
        <p class="buttons"><a class="button primary" href={href.write(path)}>Write this scene</a></p>
      )}
      {keys.length > 0 && (
        <table class="props">
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <th scope="row">{label(k)}</th>
                <td>{formatValue(k, note.data[k], propDef(schema, note.type, k))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(() => { const now = nowForNote(index, note, activeBook(index)); return now && <CodexNowBox now={now} />; })()}
      {['character', 'place', 'item', 'lore'].indexOf(note.type) >= 0 && <AppearsIn index={index} note={note} />}
      <div class="prose" dangerouslySetInnerHTML={{ __html: render(note.body) }} />
    </article>
  );
}

/** Every scene a character (or place, item, lore) appears in, book by book, with the line that first names them. */
function AppearsIn({ index, note }: { index: VaultIndex; note: NoteRecord }) {
  const books = index.books.filter((b) => note.path.startsWith(b.seriesFolder + '/'));
  const found = books.map((b) => {
    const codex = codexFor(index, b);
    const e = codex.find((x) => x.note.path === note.path) || codex.find((x) => x.name === String(note.data.name || ''));
    if (!e) return null;
    const scenes = b.scenes.map((p) => index.notes[p]).filter((n) => n && n.data.kind !== 'test');
    return { book: b, list: appearances(scenes, e, matcher(codex)) };
  }).filter((x): x is NonNullable<typeof x> => Boolean(x && x.list.length));
  if (!found.length) return <p class="meta">Not seen in any scene yet.</p>;
  return (
    <section class="appears">
      <h2>Appears in</h2>
      {found.map(({ book, list }) => {
        const first = list[0].scene, last = list[list.length - 1].scene;
        return (
          <details key={book.folder} open={found.length === 1}>
            <summary>{book.title}: {list.length === 1 ? '1 scene' : list.length + ' scenes'} · first {String(first.data.id || '')}, last {String(last.data.id || '')}</summary>
            <ul class="appears-list">
              {list.map(({ scene, presence: p, line }) => (
                <li key={scene.path}>
                  <a href={href.write(scene.path)}><span class="card-id">{String(scene.data.id || '')}</span> {sceneHeader(scene.data)}</a>
                  <span class="meta"> {[p.pov ? 'point of view' : '', p.card ? 'on the card' : '', p.named ? 'named ' + (p.named === 1 ? 'once' : p.named + ' times') : ''].filter(Boolean).join(' · ')}</span>
                  {line && <span class="appears-line">“{line}”</span>}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
