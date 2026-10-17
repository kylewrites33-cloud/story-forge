import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { chapterGroups, chapterHeading } from '../lib/board.ts';
import { formatValue, isEmptyValue, label } from '../lib/format.ts';
import { basename } from '../lib/links.ts';
import { render } from '../lib/markdown.ts';
import { cardFields, editableFields, propDef, propertyOrder } from '../lib/schema.ts';
import { EditFields } from './EditFields.tsx';
import { piles, type Decision } from '../lib/ideas.ts';
import type { BookEntry, NoteRecord, Schema, VaultIndex } from '../lib/types.ts';
import type { Choice } from '../lib/write-queue.ts';
import { activeBook } from '../lib/vault-index.ts';
import { href } from './route.ts';

function Warnings({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <details class="warnings">
      <summary>{list.length === 1 ? '1 note needs a look' : list.length + ' notes need a look'}</summary>
      <ul>{list.map((w) => <li key={w}>{w}</li>)}</ul>
    </details>
  );
}

export function BookList({ index }: { index: VaultIndex }) {
  const active = activeBook(index);
  if (!index.books.length) {
    return (
      <section>
        <h1>Books</h1>
        <p class="empty">The vault has no books yet. A book appears here once it has a Book.md.</p>
        <Warnings list={index.warnings} />
      </section>
    );
  }
  const bySeries = new Map<string, BookEntry[]>();
  index.books.forEach((b) => bySeries.set(b.seriesName, (bySeries.get(b.seriesName) || []).concat(b)));
  return (
    <section>
      <h1>Books</h1>
      {[...bySeries.entries()].map(([series, books]) => (
        <div class="series" key={series}>
          <h2>{series}</h2>
          <ul class="book-list">
            {books.map((b) => (
              <li key={b.folder}>
                <a class="book-link" href={href.book(b.folder)}>
                  <span class="book-title">{b.number != null ? b.number + '. ' : ''}{b.title}</span>
                  <span class="meta">
                    {b.scenes.length === 1 ? '1 scene' : b.scenes.length + ' scenes'} · stage {b.stage}
                    {active && active.folder === b.folder ? ' · active book' : ''}
                  </span>
                </a>
                <IdeasLink index={index} book={b} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Warnings list={index.warnings} />
    </section>
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

function StatusPill({ value }: { value: string }) {
  return <span class={'pill pill-' + value.replace(/[^a-z-]/gi, '')}>{value}</span>;
}

type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;

/** Accept a scene card, or say it needs work and why. The card's status (planned, drafted) does not change. */
function CardActions({ schema, note, waiting, onDecide, handle }: { schema: Schema; note: NoteRecord; waiting?: Choice; onDecide: OnDecide; handle?: ComponentChildren }) {
  const [asking, setAsking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const accepted = !isEmptyValue(note.data.accepted);
  const send = (d: Decision) => { onDecide(note.path, d, reason); setReason(''); setAsking(false); };
  if (note.error) return null;
  return (
    <div class="card-actions">
      {waiting && <p class={'pill' + (waiting.error ? ' pill-error' : '')}>{waiting.error ? 'Not saved: ' + waiting.error : 'Saving'}</p>}
      {!accepted && !isEmptyValue(note.data.decision_note) && <p class="reason-shown">Needs work: {String(note.data.decision_note)}</p>}
      {editing ? (
        <EditFields schema={schema} note={note} fields={editableFields(schema, note.type)} onClose={() => setEditing(false)}
          onSave={(f) => onDecide(note.path, 'edit', '', f)} />
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
        <div class="buttons">
          {handle}
          {!accepted && <button type="button" class="primary" onClick={() => send('accept')}>Accept card</button>}
          <button type="button" onClick={() => setAsking(true)}>Needs work</button>
          <a class="button" href={href.write(note.path)}>Write</a>
          <button type="button" onClick={() => setEditing(true)}>Edit card</button>
        </div>
      )}
    </div>
  );
}

function SceneCard({ schema, note, waiting, onDecide, handle, cls, shift }: {
  schema: Schema; note: NoteRecord; waiting?: Choice; onDecide?: OnDecide; handle?: ComponentChildren; cls?: string; shift?: number[] | null;
}) {
  const fields = cardFields(schema, note.type);
  const title = String(note.data.title || basename(note.path));
  const rows = fields.filter((k) => k !== 'title' && k !== 'status' && k !== 'words' && !isEmptyValue(note.data[k]));
  const status = String(note.data.status || '');
  const words = fields.indexOf('words') >= 0 ? formatValue('words', note.data.words, null) : '';
  const accepted = !isEmptyValue(note.data.accepted);
  return (
    <li class={'scene-item' + (cls ? ' ' + cls : '')} data-scene={note.path} style={shift ? { transform: 'translate(' + shift[0] + 'px, ' + shift[1] + 'px)' } : undefined}>
      <a class="card" href={href.note(note.path)}>
        <span class="card-top">
          <span class="card-id">{String(note.data.id || '')}{note.data.kind === 'test' ? ' · test drive' : ''}</span>
          <span class="pills">
            {accepted && <span class="pill pill-accepted">Accepted</span>}
            {fields.indexOf('status') >= 0 && status && <StatusPill value={status} />}
          </span>
        </span>
        <span class="card-title">{title}</span>
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
      {onDecide && <CardActions schema={schema} note={note} waiting={waiting} onDecide={onDecide} handle={handle} />}
    </li>
  );
}

type OnAdd = (book: BookEntry, chapter: number | null, chapterTitle: string, title: string) => Promise<string | null>;

/** "Add a scene" under a chapter (or "Start chapter N" at the end): asks for a title, then opens the new scene for writing. */
function AddScene({ book, chapter, chapterTitle, label, onAdd }: {
  book: BookEntry; chapter: number | null; chapterTitle: string; label: string; onAdd: OnAdd;
}) {
  const [open, setOpen] = useState(false);
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
        <button type="button" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
      </div>
      {error && <p class="error">{error}</p>}
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

export function ChapterGrid({ schema, index, book, waiting, onDecide, onAdd, onMove }: {
  schema: Schema; index: VaultIndex; book: BookEntry; waiting?: Record<string, Choice>; onDecide?: OnDecide; onAdd?: OnAdd; onMove?: OnMove;
}) {
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
  const groups = chapterGroups(schema, scenes);
  const words = groups.reduce((n, g) => n + g.words, 0);
  const counts: Record<string, number> = {};
  scenes.forEach((s) => { const st = String(s.data.status || 'planned'); counts[st] = (counts[st] || 0) + 1; });
  const order = schema.statuses.scene || Object.keys(counts);
  const board = schema.boards['chapter-grid'];
  const accepted = scenes.filter((s) => !isEmptyValue(s.data.accepted)).length;

  const handle = (path: string) => onMove && (
    <button type="button" class="move-handle" aria-label="Move this card: hold and drag"
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
      Move
    </button>
  );
  const shiftOf = (path: string) => (drag && drag.moved && drag.path === path ? [drag.x - drag.startX, drag.y + scrollY - drag.startY - drag.startScroll] : null);
  const clsOf = (g: { key: string }, path: string) =>
    drag && drag.moved && drag.path === path ? 'dragging' : drag && drag.at && drag.at.key === g.key && drag.at.before === path ? 'drop-before' + (drag.at.side ? ' side' : '') : '';
  return (
    <section>
      <p class="crumb">{book.seriesName} · {(board && board.title) || 'Chapter Grid'}</p>
      <h1>{book.title}</h1>
      <p class="meta">
        Stage {book.stage} · {scenes.length === 1 ? '1 scene' : scenes.length + ' scenes'} · {words.toLocaleString('en-US')} words
        {order.filter((s) => counts[s]).map((s) => ' · ' + counts[s] + ' ' + s)}
        {onDecide && scenes.length > 0 ? ' · ' + accepted + ' of ' + scenes.length + ' cards accepted' : ''}
      </p>
      <IdeasLink index={index} book={book} />
      {onMove && scenes.length > 1 && (
        <p class={'meta move-hint' + (hint ? ' shown' : '')}>
          {hint ? 'Hold Move down and drag the card to where it goes, then let go.' : 'To change the order, hold a card\'s Move button and drag the card.'}
        </p>
      )}
      {!scenes.length && <p class="empty">This book has no scene notes yet. They appear here once they are in the book's Scenes folder.</p>}
      {groups.map((g) => (
        <section class="chapter" key={g.key} data-chapter={g.key}>
          <h2>
            {chapterHeading(g)}
            <span class="meta"> {g.scenes.length === 1 ? '1 scene' : g.scenes.length + ' scenes'}{g.words ? ' · ' + g.words.toLocaleString('en-US') + ' words' : ''}</span>
          </h2>
          <ul class={'cards' + (drag && drag.moved && drag.at && drag.at.key === g.key && drag.at.before === null ? ' drop-end' : '')}>
            {g.scenes.map((s) => (
              <SceneCard key={s.path} schema={schema} note={s} waiting={waiting && waiting[s.path]} onDecide={onDecide}
                handle={handle(s.path)} cls={clsOf(g, s.path)} shift={shiftOf(s.path)} />
            ))}
          </ul>
          {onAdd && g.num != null && <AddScene book={book} chapter={g.num} chapterTitle={g.title} label={'Add a scene to chapter ' + g.num} onAdd={onAdd} />}
        </section>
      ))}
      {onAdd && (() => {
        const last = groups.filter((g) => g.num != null).reduce((m, g) => Math.max(m, g.num as number), 0);
        return <AddScene book={book} chapter={last + 1} chapterTitle="" label={'Start chapter ' + (last + 1)} onAdd={onAdd} />;
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
  if (!note) return <p class="empty">That note is not in the saved copy. <a href={href.books()}>Back to books</a>.</p>;
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
      <div class="prose" dangerouslySetInnerHTML={{ __html: render(note.body) }} />
    </article>
  );
}
