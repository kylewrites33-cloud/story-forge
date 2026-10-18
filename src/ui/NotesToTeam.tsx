// Notes to the Team (Writers Room, Kyle 2026-10-18): Kyle's standing instructions to the whole team or one agent. Open ones
// first; Mark done and Reopen go through the write queue; a new note is written straight into the book's folder.
import { useState } from 'preact/hooks';
import type { Decision } from '../lib/ideas.ts';
import { render } from '../lib/markdown.ts';
import { answeredIn, bookNotesToTeam, isOpenNote, noteTo, WHOLE_TEAM, type NewNote } from '../lib/notes.ts';
import type { BookEntry, NoteRecord, VaultIndex } from '../lib/types.ts';
import type { Choice } from '../lib/write-queue.ts';
import { Icon } from './Icon.tsx';
import { href } from './route.ts';
import { useTeam } from './Team.tsx';

type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;
export type OnAddNote = (book: BookEntry, n: NewNote) => Promise<string | null>;

function NoteForm({ agents, onAdd, onDone }: { agents: string[]; onAdd: (n: NewNote) => Promise<string | null>; onDone: () => void }) {
  const [to, setTo] = useState(WHOLE_TEAM);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    const err = await onAdd({ title, to, body });
    setBusy(false);
    setError(err);
    if (!err) { setTitle(''); setBody(''); onDone(); }
  };
  return (
    <form class="note-form" onSubmit={(e) => { e.preventDefault(); if (body.trim() && !busy) go(); }}>
      <label class="reason">Who is it for?
        <select value={to} onChange={(e) => setTo((e.currentTarget as HTMLSelectElement).value)}>
          <option value={WHOLE_TEAM}>The whole team</option>
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label class="reason">What should they always do (or never do)?
        <textarea rows={4} value={body} placeholder="For example: Tobin never says sorry. He changes the subject instead."
          onInput={(e) => setBody((e.currentTarget as HTMLTextAreaElement).value)} />
      </label>
      <label class="reason">A short name for it (you can leave it empty)
        <input type="text" value={title} placeholder="The first words become its name" onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <div class="buttons">
        <button type="submit" class="primary" disabled={busy || !body.trim()}>{busy ? 'Saving…' : 'Add the note'}</button>
        <button type="button" onClick={onDone}>Cancel</button>
      </div>
      {error && <p class="error">{error}</p>}
    </form>
  );
}

function NoteCard({ index, book, note, waiting, onDecide }: { index: VaultIndex; book: BookEntry; note: NoteRecord; waiting?: Choice; onDecide?: OnDecide }) {
  const open = isOpenNote(note);
  const where = answeredIn(index, book, note);
  return (
    <li class={'note-card' + (open ? '' : ' done')}>
      <div class="note-card-top">
        <span class={'pill' + (open ? '' : ' pill-final')}>{open ? 'Open' : 'Done'}</span>
        <span class="meta">To {noteTo(note)}</span>
      </div>
      <h3>{String(note.data.title || '')}</h3>
      <div class="prose" dangerouslySetInnerHTML={{ __html: render(note.body) }} />
      {where && (
        <p class="meta">Answered in {where.path ? <a href={href.note(where.path)}>{where.name}</a> : where.name}</p>
      )}
      {waiting && <p class={'pill' + (waiting.error ? ' pill-error' : '')}>{waiting.error ? 'Not saved: ' + waiting.error : 'Saving'}</p>}
      {onDecide && !note.error && (
        <div class="buttons">
          {open
            ? <button type="button" class="soft" onClick={() => onDecide(note.path, 'edit', '', { status: 'done' })}><Icon name="check" size={18} /> Mark done</button>
            : <button type="button" onClick={() => onDecide(note.path, 'edit', '', { status: 'open' })}>Reopen</button>}
        </div>
      )}
    </li>
  );
}

export function NotesScreen({ index, book, waiting, onDecide, onAdd }: {
  index: VaultIndex; book: BookEntry; waiting: Record<string, Choice>; onDecide?: OnDecide; onAdd?: OnAddNote;
}) {
  const team = useTeam(index);
  const [writing, setWriting] = useState(false);
  const notes = bookNotesToTeam(index, book);
  const open = notes.filter(isOpenNote);
  const done = notes.filter((n) => !isOpenNote(n));
  return (
    <section class="notes-screen">
      <p class="crumb"><a href={href.board('overview', book.folder)}>{book.title}</a> · Notes to the Team</p>
      <div class="chat-head">
        <h1>Notes to the Team</h1>
        {onAdd && !writing && <button type="button" class="primary" onClick={() => setWriting(true)}><Icon name="plus" size={18} /> New note</button>}
      </div>
      <p class="meta">Standing instructions for this book, to the whole team or one agent. The team reads open notes before any work on the book, and marks where it answered one.</p>
      {writing && onAdd && <NoteForm agents={team.members.map((m) => m.name)} onAdd={(n) => onAdd(book, n)} onDone={() => setWriting(false)} />}
      {!notes.length && !writing && (
        <div class="empty-box">
          <h2>No notes yet</h2>
          <p>Write one when you want the team to always do something in this book, like keeping chapter ends open or never naming the villain.</p>
          {onAdd && <div class="buttons"><button type="button" class="primary" onClick={() => setWriting(true)}>Write the first note</button></div>}
        </div>
      )}
      {open.length > 0 && (
        <>
          <h2>Open <span class="meta">{open.length}</span></h2>
          <ul class="note-list">{open.map((n) => <NoteCard key={n.path} index={index} book={book} note={n} waiting={waiting[n.path]} onDecide={onDecide} />)}</ul>
        </>
      )}
      {done.length > 0 && (
        <>
          <h2>Done <span class="meta">{done.length}</span></h2>
          <ul class="note-list">{done.map((n) => <NoteCard key={n.path} index={index} book={book} note={n} waiting={waiting[n.path]} onDecide={onDecide} />)}</ul>
        </>
      )}
    </section>
  );
}
