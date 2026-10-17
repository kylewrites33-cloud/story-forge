import { useState } from 'preact/hooks';
import { chapterGroups, chapterHeading } from '../lib/board.ts';
import { formatValue, isEmptyValue, label } from '../lib/format.ts';
import { basename } from '../lib/links.ts';
import { render } from '../lib/markdown.ts';
import { cardFields, propDef, propertyOrder } from '../lib/schema.ts';
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

type OnDecide = (path: string, decision: Decision, reason: string) => void;

/** Accept a scene card, or say it needs work and why. The card's status (planned, drafted) does not change. */
function CardActions({ note, waiting, onDecide }: { note: NoteRecord; waiting?: Choice; onDecide: OnDecide }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const accepted = !isEmptyValue(note.data.accepted);
  const send = (d: Decision) => { onDecide(note.path, d, reason); setReason(''); setAsking(false); };
  if (note.error) return null;
  return (
    <div class="card-actions">
      {waiting && <p class={'pill' + (waiting.error ? ' pill-error' : '')}>{waiting.error ? 'Not saved: ' + waiting.error : 'Saving'}</p>}
      {!accepted && !isEmptyValue(note.data.decision_note) && <p class="reason-shown">Needs work: {String(note.data.decision_note)}</p>}
      {asking ? (
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
          {!accepted && <button type="button" class="primary" onClick={() => send('accept')}>Accept card</button>}
          <button type="button" onClick={() => setAsking(true)}>Needs work</button>
        </div>
      )}
    </div>
  );
}

function SceneCard({ schema, note, waiting, onDecide }: { schema: Schema; note: NoteRecord; waiting?: Choice; onDecide?: OnDecide }) {
  const fields = cardFields(schema, note.type);
  const title = String(note.data.title || basename(note.path));
  const rows = fields.filter((k) => k !== 'title' && k !== 'status' && k !== 'words' && !isEmptyValue(note.data[k]));
  const status = String(note.data.status || '');
  const words = fields.indexOf('words') >= 0 ? formatValue('words', note.data.words, null) : '';
  const accepted = !isEmptyValue(note.data.accepted);
  return (
    <li class="scene-item">
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
      {onDecide && <CardActions note={note} waiting={waiting} onDecide={onDecide} />}
    </li>
  );
}

export function ChapterGrid({ schema, index, book, waiting, onDecide }: {
  schema: Schema; index: VaultIndex; book: BookEntry; waiting?: Record<string, Choice>; onDecide?: OnDecide;
}) {
  const scenes = book.scenes.map((p) => index.notes[p]).filter(Boolean);
  const groups = chapterGroups(schema, scenes);
  const words = groups.reduce((n, g) => n + g.words, 0);
  const counts: Record<string, number> = {};
  scenes.forEach((s) => { const st = String(s.data.status || 'planned'); counts[st] = (counts[st] || 0) + 1; });
  const order = schema.statuses.scene || Object.keys(counts);
  const board = schema.boards['chapter-grid'];
  const accepted = scenes.filter((s) => !isEmptyValue(s.data.accepted)).length;
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
      {!scenes.length && <p class="empty">This book has no scene notes yet. They appear here once they are in the book's Scenes folder.</p>}
      {groups.map((g) => (
        <section class="chapter" key={g.key}>
          <h2>
            {chapterHeading(g)}
            <span class="meta"> {g.scenes.length === 1 ? '1 scene' : g.scenes.length + ' scenes'}{g.words ? ' · ' + g.words.toLocaleString('en-US') + ' words' : ''}</span>
          </h2>
          <ul class="cards">{g.scenes.map((s) => <SceneCard key={s.path} schema={schema} note={s} waiting={waiting && waiting[s.path]} onDecide={onDecide} />)}</ul>
        </section>
      ))}
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
