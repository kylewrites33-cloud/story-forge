// The Edit Queue: the team's notes on the draft (Keep, Later, Rewrite, Drop) and the to-dos that come from them
// (Start, Done), on one page. The same notes are on the Ideas board and the same to-dos on the To-do list.
import { useState } from 'preact/hooks';
import { piles, type Decision } from '../lib/ideas.ts';
import { taskNotes } from '../lib/tasks.ts';
import type { BookEntry, Schema, VaultIndex } from '../lib/types.ts';
import type { Choice } from '../lib/write-queue.ts';
import { ProposalCard } from './IdeasBoard.tsx';
import { TaskCard } from './TodoList.tsx';
import { href } from './route.ts';
import { EmptyBox } from './screens.tsx';

/** Idea kinds that are notes on written pages rather than story proposals. */
export const EDIT_KINDS = ['note', 'line', 'scene', 'structure'];

export function EditQueue({ schema, index, book, waiting, onDecide, onRewrite }: {
  schema: Schema; index: VaultIndex; book: BookEntry; waiting: Record<string, Choice>;
  onDecide: (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;
  onRewrite?: (path: string, reason: string) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const notes = (book.ideas || []).map((p) => index.notes[p]).filter((n) => n && EDIT_KINDS.indexOf(String(n.data.kind || '')) >= 0);
  const byPile = piles(notes);
  const open = byPile.decide.concat(byPile.rewrite, byPile.later);
  const tasks = taskNotes(index).filter((n) => !n.path.startsWith('Series/') || n.path.startsWith(book.folder + '/'));
  const live = tasks.filter((n) => ['open', 'doing'].indexOf(String(n.data.status || 'open')) >= 0);
  const done = tasks.filter((n) => ['done', 'dropped'].indexOf(String(n.data.status || '')) >= 0);
  return (
    <section>
      <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · Edit Queue</p>
      <h1>Edit Queue</h1>
      <p class="meta">Everything waiting on the draft in one place: the team's notes on the pages, and the to-dos. Keep a note to have the team act on it; Done closes a to-do.</p>
      <h2>Notes on the draft <span class="meta">{open.length}</span></h2>
      {open.length
        ? <ul class="cards ideas">{open.map((n) => <ProposalCard key={n.path} schema={schema} note={n} pile={byPile.rewrite.indexOf(n) >= 0 ? 'rewrite' : byPile.later.indexOf(n) >= 0 ? 'later' : 'decide'} waiting={waiting[n.path]} onDecide={onDecide} onRewrite={onRewrite} />)}</ul>
        : <EmptyBox title="No notes waiting"><p>Notes appear here when the team reads the draft: press Notes on this chapter in the writing screen's Team tab.</p></EmptyBox>}
      <h2>To-dos <span class="meta">{live.length}</span></h2>
      {live.length
        ? <ul class="cards ideas">{live.map((n) => <TaskCard key={n.path} index={index} note={n} waiting={waiting[n.path]} onDecide={onDecide} />)}</ul>
        : <p class="empty">Nothing to do. Add to-dos on the <a href={href.todo()}>To-do</a> page.</p>}
      {done.length > 0 && <button type="button" class="link" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide finished to-dos' : 'Show ' + done.length + ' finished to-dos'}</button>}
      {showDone && <ul class="cards ideas">{done.map((n) => <TaskCard key={n.path} index={index} note={n} waiting={waiting[n.path]} onDecide={onDecide} />)}</ul>}
    </section>
  );
}
