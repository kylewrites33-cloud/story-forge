import { chapterGroups, chapterHeading } from '../lib/board.ts';
import { formatValue, isEmptyValue, label } from '../lib/format.ts';
import { basename } from '../lib/links.ts';
import { render } from '../lib/markdown.ts';
import { cardFields, propDef, propertyOrder } from '../lib/schema.ts';
import type { BookEntry, NoteRecord, Schema, VaultIndex } from '../lib/types.ts';
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
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Warnings list={index.warnings} />
    </section>
  );
}

function StatusPill({ value }: { value: string }) {
  return <span class={'pill pill-' + value.replace(/[^a-z-]/gi, '')}>{value}</span>;
}

function SceneCard({ schema, note }: { schema: Schema; note: NoteRecord }) {
  const fields = cardFields(schema, note.type);
  const title = String(note.data.title || basename(note.path));
  const rows = fields.filter((k) => k !== 'title' && k !== 'status' && k !== 'words' && !isEmptyValue(note.data[k]));
  const status = String(note.data.status || '');
  const words = fields.indexOf('words') >= 0 ? formatValue('words', note.data.words, null) : '';
  return (
    <li>
      <a class="card" href={href.note(note.path)}>
        <span class="card-top">
          <span class="card-id">{String(note.data.id || '')}{note.data.kind === 'test' ? ' · test drive' : ''}</span>
          {fields.indexOf('status') >= 0 && status && <StatusPill value={status} />}
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
    </li>
  );
}

export function ChapterGrid({ schema, index, book }: { schema: Schema; index: VaultIndex; book: BookEntry }) {
  const scenes = book.scenes.map((p) => index.notes[p]).filter(Boolean);
  const groups = chapterGroups(schema, scenes);
  const words = groups.reduce((n, g) => n + g.words, 0);
  const counts: Record<string, number> = {};
  scenes.forEach((s) => { const st = String(s.data.status || 'planned'); counts[st] = (counts[st] || 0) + 1; });
  const order = schema.statuses.scene || Object.keys(counts);
  const board = schema.boards['chapter-grid'];
  return (
    <section>
      <p class="crumb">{book.seriesName} · {(board && board.title) || 'Chapter Grid'}</p>
      <h1>{book.title}</h1>
      <p class="meta">
        Stage {book.stage} · {scenes.length === 1 ? '1 scene' : scenes.length + ' scenes'} · {words.toLocaleString('en-US')} words
        {order.filter((s) => counts[s]).map((s) => ' · ' + counts[s] + ' ' + s)}
      </p>
      {!scenes.length && <p class="empty">This book has no scene notes yet. They appear here once they are in the book's Scenes folder.</p>}
      {groups.map((g) => (
        <section class="chapter" key={g.key}>
          <h2>
            {chapterHeading(g)}
            <span class="meta"> {g.scenes.length === 1 ? '1 scene' : g.scenes.length + ' scenes'}{g.words ? ' · ' + g.words.toLocaleString('en-US') + ' words' : ''}</span>
          </h2>
          <ul class="cards">{g.scenes.map((s) => <SceneCard key={s.path} schema={schema} note={s} />)}</ul>
        </section>
      ))}
    </section>
  );
}

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
      <p class="meta">Read only for now. Edit in Obsidian. <span class="path">{path}</span></p>
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
