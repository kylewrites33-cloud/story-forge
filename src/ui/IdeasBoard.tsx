import { useState } from 'preact/hooks';
import { formatValue, isEmptyValue, label } from '../lib/format.ts';
import { PILES, piles, type Decision, type Pile } from '../lib/ideas.ts';
import { basename } from '../lib/links.ts';
import { render } from '../lib/markdown.ts';
import { cardFields, propDef } from '../lib/schema.ts';
import type { BookEntry, NoteRecord, Schema, VaultIndex } from '../lib/types.ts';
import type { Choice } from '../lib/write-queue.ts';
import { href } from './route.ts';

export interface IdeasProps {
  schema: Schema;
  index: VaultIndex;
  book: BookEntry;
  /** Choices not yet on GitHub, by note path. */
  waiting: Record<string, Choice>;
  onDecide: (path: string, decision: Decision, reason: string) => void;
}

/** The choice that puts an idea back in the pile it came from. */
const BACK: Record<Exclude<Pile, 'other'>, Decision> = { decide: 'inbox', later: 'later', kept: 'keep', dropped: 'drop' };

const DONE: Record<Decision, string> = { keep: 'Kept', later: 'Saved for later', drop: 'Dropped', inbox: 'Back in To decide' };

/** The buttons a card shows, by the pile it is in. */
function actions(pile: Pile): { decision: Decision; text: string; primary?: boolean }[] {
  if (pile === 'decide') return [{ decision: 'keep', text: 'Keep', primary: true }, { decision: 'later', text: 'Later' }, { decision: 'drop', text: 'Drop' }];
  if (pile === 'later' || pile === 'other') return [{ decision: 'keep', text: 'Keep', primary: true }, { decision: 'drop', text: 'Drop' }, { decision: 'inbox', text: 'To decide' }];
  return [{ decision: 'inbox', text: 'Move back to To decide' }];
}

function IdeaCard(props: { schema: Schema; note: NoteRecord; pile: Pile; waiting?: Choice; onDecide: IdeasProps['onDecide'] }) {
  const { schema, note, pile, waiting } = props;
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const d = note.data;
  const title = String(d.title || basename(note.path));
  const shown = cardFields(schema, note.type).filter((k) => k !== 'title' && k !== 'status' && k !== 'kind' && k !== 'pitch' && !isEmptyValue(d[k]));
  const decided = pile === 'kept' || pile === 'dropped';
  const more = ['reasoning', 'risk', 'target', 'decision_note', 'decided'].filter((k) => !isEmptyValue(d[k]) && shown.indexOf(k) < 0);
  const decide = (decision: Decision) => {
    props.onDecide(note.path, decision, reason);
    setReason('');
    setAsking(false);
  };
  return (
    <li class="idea">
      <span class="card-top">
        <span class="card-id">{String(d.id || '')}{d.kind ? ' · ' + String(d.kind).replace(/-/g, ' ') : ''}</span>
        {waiting && <span class={'pill' + (waiting.error ? ' pill-error' : '')}>{waiting.error ? 'Not saved' : 'Saving'}</span>}
      </span>
      <span class="card-title">{title}</span>
      {!isEmptyValue(d.pitch) && <p class="pitch">{String(d.pitch)}</p>}
      {shown.length > 0 && (
        <p class="meta">{shown.map((k) => label(k) + ': ' + formatValue(k, d[k], propDef(schema, note.type, k))).join(' · ')}</p>
      )}
      {decided && !isEmptyValue(d.decision_note) && <p class="reason-shown">Your reason: {String(d.decision_note)}</p>}
      {waiting && waiting.error && <p class="error">{waiting.error}</p>}
      {note.error && <p class="error">Its properties cannot be read: {note.error}</p>}
      <button type="button" class="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Read more'}</button>
      {open && (
        <div class="idea-more">
          {more.length > 0 && (
            <dl>
              {more.map((k) => (
                <div key={k}>
                  <dt>{label(k)}</dt>
                  <dd>{formatValue(k, d[k], propDef(schema, note.type, k))}</dd>
                </div>
              ))}
            </dl>
          )}
          <div class="prose" dangerouslySetInnerHTML={{ __html: render(note.body) }} />
          <p><a href={href.note(note.path)}>Open the whole note</a></p>
        </div>
      )}
      {decided ? null : asking ? (
        <label class="reason">
          Why? The team learns most from your reasons.
          <input type="text" value={reason} onInput={(e) => setReason((e.currentTarget as HTMLInputElement).value)} placeholder="Optional, one line" />
        </label>
      ) : (
        !note.error && <button type="button" class="link" onClick={() => setAsking(true)}>Add a reason</button>
      )}
      {!note.error && (
        <div class="buttons">
          {actions(pile).map((a) => (
            <button key={a.decision} type="button" class={a.primary ? 'primary' : undefined} onClick={() => decide(a.decision)}>{a.text}</button>
          ))}
        </div>
      )}
    </li>
  );
}

export function IdeasBoard(props: IdeasProps) {
  const { schema, index, book } = props;
  const [pile, setPile] = useState<Pile>('decide');
  const [last, setLast] = useState<{ path: string; title: string; decision: Decision; from: Pile } | null>(null);
  const notes = (book.ideas || []).map((p) => index.notes[p]).filter(Boolean);
  const byPile = piles(notes);
  const board = schema.boards.ideas;
  const tabs = PILES.filter((p) => p.key !== 'other' || byPile.other.length > 0);
  const list = byPile[pile];

  const onDecide = (path: string, decision: Decision, reason: string) => {
    const n = index.notes[path];
    setLast({ path, title: String((n && (n.data.id || n.data.title)) || basename(path)), decision, from: pile });
    props.onDecide(path, decision, reason);
  };
  const undo = () => {
    if (!last) return;
    props.onDecide(last.path, BACK[last.from as Exclude<Pile, 'other'>], '');
    setLast(null);
  };

  return (
    <section>
      <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · {(board && board.title) || 'Ideas'}</p>
      <h1>Ideas</h1>
      <p class="meta">The team's proposals for {book.title}. Keep tells the team to use it. Later puts it aside to come back to. Drop turns it down, and the note stays in the vault.</p>
      <div class="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={pile === t.key} onClick={() => { setPile(t.key); setLast(null); }}>
            {t.label} <span class="count">{byPile[t.key].length}</span>
          </button>
        ))}
      </div>
      {last && last.from !== 'other' && (
        <p class="toast" role="status">
          {DONE[last.decision]}: {last.title}. <button type="button" class="link" onClick={undo}>Undo</button>
        </p>
      )}
      {!notes.length && <p class="empty">This book has no ideas yet. They appear here when an agent files one in the book's Ideas folder.</p>}
      {notes.length > 0 && !list.length && (
        <p class="empty">{pile === 'decide' ? 'Nothing to decide. Every idea for this book has an answer.' : 'Nothing here.'}</p>
      )}
      <ul class="cards ideas">
        {list.map((n) => <IdeaCard key={n.path} schema={schema} note={n} pile={pile} waiting={props.waiting[n.path]} onDecide={onDecide} />)}
      </ul>
    </section>
  );
}
