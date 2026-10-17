import { useState } from 'preact/hooks';
import { groupLabel, groupNotes, groupOrder } from '../lib/boards.ts';
import { formatValue, isEmptyValue, label } from '../lib/format.ts';
import { PILES, piles, type Decision, type Pile } from '../lib/ideas.ts';
import { basename } from '../lib/links.ts';
import { render } from '../lib/markdown.ts';
import { cardFields, propDef, propertyOrder } from '../lib/schema.ts';
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

const DONE: Record<Decision, string> = {
  keep: 'Kept', later: 'Saved for later', drop: 'Dropped', inbox: 'Back in To decide', accept: 'Card accepted', rework: 'Marked as needing work'
};

/** Properties a card never repeats in Read more: the card already shows them, or they are bookkeeping. */
const QUIET = ['type', 'id', 'title', 'status', 'kind', 'pitch', 'created', 'updated', 'tags', 'source'];

/** The buttons a card shows, by the pile it is in. */
function actions(pile: Pile): { decision: Decision; text: string; primary?: boolean }[] {
  if (pile === 'decide') return [{ decision: 'keep', text: 'Keep', primary: true }, { decision: 'later', text: 'Later' }, { decision: 'drop', text: 'Drop' }];
  if (pile === 'later' || pile === 'other') return [{ decision: 'keep', text: 'Keep', primary: true }, { decision: 'drop', text: 'Drop' }, { decision: 'inbox', text: 'To decide' }];
  return [{ decision: 'inbox', text: 'Move back to To decide' }];
}

/** A card for any note Kyle keeps, puts aside or drops: an idea, a beat or a conflict. */
export function ProposalCard(props: { schema: Schema; note: NoteRecord; pile: Pile; waiting?: Choice; onDecide: IdeasProps['onDecide'] }) {
  const { schema, note, pile, waiting } = props;
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const d = note.data;
  const title = String(d.title || basename(note.path));
  const shown = cardFields(schema, note.type).filter((k) => k !== 'title' && k !== 'status' && k !== 'kind' && k !== 'pitch' && k !== 'summary' && !isEmptyValue(d[k]));
  const decided = pile === 'kept' || pile === 'dropped';
  const more = propertyOrder(schema, note.type, d).filter((k) => QUIET.indexOf(k) < 0 && shown.indexOf(k) < 0 && k !== 'summary' && !isEmptyValue(d[k]));
  const blurb = !isEmptyValue(d.pitch) ? d.pitch : d.summary;
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
      {!isEmptyValue(blurb) && <p class="pitch">{String(blurb)}</p>}
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

export interface ProposalBoardProps extends IdeasProps {
  /** The schema board this screen draws: its title, and the property its groups come from. */
  boardKey: string;
  heading: string;
  intro: string;
  notes: NoteRecord[];
  /** What the board calls an empty book. */
  emptyText: string;
}

export function IdeasBoard(props: IdeasProps) {
  const notes = (props.book.ideas || []).map((p) => props.index.notes[p]).filter(Boolean);
  return (
    <ProposalBoard {...props} boardKey="ideas" heading="Ideas" notes={notes}
      intro={'The team\'s proposals for ' + props.book.title + '. Keep tells the team to use it. Later puts it aside to come back to. Drop turns it down, and the note stays in the vault.'}
      emptyText="This book has no ideas yet. They appear here when an agent files one in the book's Ideas folder." />
  );
}

/** Piles (to decide, later, kept, dropped) of one kind of proposal, grouped the way the schema's board says. */
export function ProposalBoard(props: ProposalBoardProps) {
  const { schema, index, book, notes } = props;
  const [pile, setPile] = useState<Pile>('decide');
  const [last, setLast] = useState<{ path: string; title: string; decision: Decision; from: Pile } | null>(null);
  const byPile = piles(notes);
  const board = schema.boards[props.boardKey];
  const by = props.boardKey === 'ideas' ? '' : (board && board.groupBy) || '';
  const tabs = PILES.filter((p) => p.key !== 'other' || byPile.other.length > 0);
  const list = byPile[pile];
  const type = (board && board.types[0]) || 'idea';
  const groups = by ? groupNotes(list, by, groupOrder(schema, type, by)) : [{ key: '', notes: list }];

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
  const card = (n: NoteRecord) => <ProposalCard key={n.path} schema={schema} note={n} pile={pile} waiting={props.waiting[n.path]} onDecide={onDecide} />;

  return (
    <section>
      <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · {(board && board.title) || props.heading}</p>
      <h1>{(board && board.title) || props.heading}</h1>
      <p class="meta">{props.intro}</p>
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
      {!notes.length && <p class="empty">{props.emptyText}</p>}
      {notes.length > 0 && !list.length && (
        <p class="empty">{pile === 'decide' ? 'Nothing to decide. Everything on this board has an answer.' : 'Nothing here.'}</p>
      )}
      {by
        ? groups.map((g) => (
          <section class="group" key={g.key}>
            <h2>{groupLabel(g.key)} <span class="meta">{g.notes.length}</span></h2>
            <ul class="cards ideas">{g.notes.map(card)}</ul>
          </section>
        ))
        : <ul class="cards ideas">{list.map(card)}</ul>}
    </section>
  );
}
