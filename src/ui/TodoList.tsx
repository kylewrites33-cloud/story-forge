import { useState } from 'preact/hooks';
import type { Decision } from '../lib/ideas.ts';
import { basename } from '../lib/links.ts';
import { render } from '../lib/markdown.ts';
import { dueLabel, taskBook, taskGroups, taskNotes, type NewTask } from '../lib/tasks.ts';
import type { NoteRecord, VaultIndex } from '../lib/types.ts';
import type { Choice } from '../lib/write-queue.ts';
import { isBookTodo, todoPlace } from '../lib/todos.ts';
import { href } from './route.ts';

type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;

/** The buttons a to-do shows, by its status. */
const MOVES: Record<string, { to: string; text: string; primary?: boolean }[]> = {
  open: [{ to: 'doing', text: 'Start' }, { to: 'done', text: 'Done', primary: true }, { to: 'dropped', text: 'Drop' }],
  doing: [{ to: 'done', text: 'Done', primary: true }, { to: 'open', text: 'Not started' }],
  done: [{ to: 'open', text: 'Reopen' }],
  dropped: [{ to: 'open', text: 'Reopen' }]
};

export function TaskCard({ index, note, waiting, onDecide }: { index: VaultIndex; note: NoteRecord; waiting?: Choice; onDecide: OnDecide }) {
  const [open, setOpen] = useState(false);
  const d = note.data;
  const status = String(d.status || 'open');
  const due = status === 'done' || status === 'dropped' ? null : dueLabel(d.due, new Date());
  const book = taskBook(index, note.path);
  const place = todoPlace(note);
  // A book's to-do about one scene opens that scene's page.
  const owner = index.books.find((b) => note.path.startsWith(b.folder + '/'));
  const scenePath = owner && d.scene ? owner.scenes.find((p) => index.notes[p] && String(index.notes[p].data.id || '') === String(d.scene)) : undefined;
  return (
    <li class="idea task">
      <span class="card-top">
        <span class="card-id">{String(d.id || '')}{d.owner ? ' · for ' + String(d.owner) : ''}{book ? ' · ' + book : ''}</span>
        {waiting && <span class={'pill' + (waiting.error ? ' pill-error' : '')}>{waiting.error ? 'Not saved' : 'Saving'}</span>}
      </span>
      <span class="card-title">{String(d.title || basename(note.path))}</span>
      {(place || d.generated === true) && (
        <span class="todo-meta">
          {d.generated === true && <span class="pill pill-plain gen">Generated{d.found_by ? ' · ' + String(d.found_by) : ''}</span>}
          {place && <span>{place}</span>}
          {scenePath && <a href={href.write(scenePath)}>Open the page</a>}
        </span>
      )}
      {(status === 'done') && d.done_note ? <p class="todo-note">{String(d.done_note)}</p> : null}
      {due && <p class={'due' + (due.late ? ' late' : '')}>{due.text}</p>}
      {waiting && waiting.error && <p class="error">{waiting.error}</p>}
      <button type="button" class="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Read more'}</button>
      {open && (
        <div class="idea-more">
          <div class="prose" dangerouslySetInnerHTML={{ __html: render(note.body) }} />
          <p><a href={href.note(note.path)}>Open the whole note</a></p>
        </div>
      )}
      {!note.error && (
        <div class="buttons">
          {(MOVES[status] || MOVES.open).map((m) => (
            <button key={m.to} type="button" class={m.primary ? 'primary' : undefined} onClick={() => onDecide(note.path, 'edit', '', { status: m.to })}>{m.text}</button>
          ))}
        </div>
      )}
    </li>
  );
}

function AddTask({ onAdd }: { onAdd: (t: NewTask) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState<NewTask>({ title: '', owner: 'Kyle', due: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return <button type="button" onClick={() => setOpen(true)}>Add a to-do</button>;
  const save = async () => {
    setBusy(true);
    setError(null);
    const err = await onAdd(t);
    setBusy(false);
    if (err) { setError(err); return; }
    setT({ title: '', owner: 'Kyle', due: '', body: '' });
    setOpen(false);
  };
  return (
    <div class="edit-fields add-task">
      <label>What needs doing?<textarea rows={2} value={t.title} onInput={(e) => setT({ ...t, title: (e.currentTarget as HTMLTextAreaElement).value })} /></label>
      <label>Who does it?
        <select value={t.owner} onChange={(e) => setT({ ...t, owner: (e.currentTarget as HTMLSelectElement).value })}>
          <option value="Kyle">Kyle</option>
          <option value="Claude">Claude</option>
        </select>
      </label>
      <label>Due (optional)<input type="date" value={t.due} onInput={(e) => setT({ ...t, due: (e.currentTarget as HTMLInputElement).value })} /></label>
      <label>Details (optional)<textarea rows={3} value={t.body} onInput={(e) => setT({ ...t, body: (e.currentTarget as HTMLTextAreaElement).value })} /></label>
      {error && <p class="error">{error}</p>}
      <div class="buttons">
        <button type="button" class="primary" disabled={busy || !t.title.trim()} onClick={save}>{busy ? 'Adding…' : 'Add'}</button>
        <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

/** Kyle's and the team's to-dos, from the vault's Tasks folders. */
export function TodoList({ index, waiting, onDecide, onAdd }: {
  index: VaultIndex; waiting: Record<string, Choice>; onDecide: OnDecide; onAdd?: (t: NewTask) => Promise<string | null>;
}) {
  const all = taskNotes(index);
  const owners = ['Kyle', 'Claude'].filter((o) => all.some((n) => String(n.data.owner || '') === o));
  const [who, setWho] = useState('');
  const [kind, setKind] = useState('');
  const hasBook = all.some((n) => isBookTodo(index, n));
  const hasStudio = all.some((n) => !isBookTodo(index, n));
  const shown = all.filter((n) => (!who || String(n.data.owner || '') === who)
    && (!kind || (kind === 'book') === isBookTodo(index, n)));
  const groups = taskGroups(shown);
  const openCount = all.filter((n) => ['open', 'doing'].indexOf(String(n.data.status || 'open')) >= 0).length;
  return (
    <section>
      <h1>To-do</h1>
      <p class="meta">
        {openCount === 1 ? '1 to-do is' : openCount + ' to-dos are'} open. Press Start when you begin one and Done when it is finished; the team reads the same list.
      </p>
      {onAdd && <div class="add-row"><AddTask onAdd={onAdd} /></div>}
      {owners.length > 1 && (
        <div class="tabs" role="tablist">
          {[{ key: '', label: 'Everyone' }].concat(owners.map((o) => ({ key: o, label: o === 'Kyle' ? 'Yours' : 'The team\'s' }))).map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={who === t.key} onClick={() => setWho(t.key)}>{t.label}</button>
          ))}
        </div>
      )}
      {hasBook && hasStudio && (
        <div class="tabs" role="tablist" aria-label="Which list">
          {[{ key: '', label: 'Both lists' }, { key: 'book', label: 'Book to-dos' }, { key: 'studio', label: 'Story Forge to-dos' }].map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={kind === t.key} onClick={() => setKind(t.key)}>{t.label}</button>
          ))}
        </div>
      )}
      {hasBook && <p class="hint">Book to-dos are fixes to the pages, one list per chapter beside the writing page. Story Forge to-dos are jobs about the app and the setup.</p>}
      {!all.length && <p class="empty">No to-dos yet. They live in the vault's Tasks folder.</p>}
      {groups.map((g) => {
        if (!g.notes.length) return null;
        const list = <ul class="cards ideas">{g.notes.map((n) => <TaskCard key={n.path} index={index} note={n} waiting={waiting[n.path]} onDecide={onDecide} />)}</ul>;
        const head = <>{g.label} <span class="meta">{g.notes.length}</span></>;
        // Finished and dropped to-dos stay folded away until asked for.
        return g.key === 'done' || g.key === 'dropped'
          ? <details class="group" key={g.key}><summary><h2>{head}</h2></summary>{list}</details>
          : <section class="group" key={g.key}><h2>{head}</h2>{list}</section>;
      })}
    </section>
  );
}
