import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { groupLabel, groupNotes, groupOrder } from '../lib/boards.ts';
import { formatValue, isEmptyValue, label } from '../lib/format.ts';
import { PILES, piles, type Decision, type Pile } from '../lib/ideas.ts';
import { basename } from '../lib/links.ts';
import { render } from '../lib/markdown.ts';
import { cardFields, editableFields, propDef, propertyOrder } from '../lib/schema.ts';
import { EditFields } from './EditFields.tsx';
import type { BookEntry, NoteRecord, Schema, VaultIndex } from '../lib/types.ts';
import type { Choice } from '../lib/write-queue.ts';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';
import { EmptyBox } from './screens.tsx';
import { defaultJobTitle, jobAsk, type OnJob } from '../lib/jobs.ts';

export interface IdeasProps {
  schema: Schema;
  index: VaultIndex;
  book: BookEntry;
  /** Choices not yet on GitHub, by note path. */
  waiting: Record<string, Choice>;
  onDecide: (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;
  /** Ask the team to do a rewrite now, after Rewrite is saved. */
  onRewrite?: (path: string, reason: string) => void;
  /** Ask the team for work from this board (More ideas). */
  onJob?: OnJob;
}

/** The choice that puts an idea back in the pile it came from. */
const BACK: Record<Exclude<Pile, 'other'>, Decision> = { decide: 'inbox', later: 'later', rewrite: 'regenerate', kept: 'keep', dropped: 'drop' };

const DONE: Record<Decision, string> = {
  keep: 'Kept', later: 'Saved for later', drop: 'Dropped', inbox: 'Back in To decide', regenerate: 'Sent back to rewrite', edit: 'Saved your edit', accept: 'Card accepted', rework: 'Marked as needing work', move: 'Moved'
};

/** Properties a card never repeats in Read more: the card already shows them, or they are bookkeeping. */
const QUIET = ['type', 'id', 'title', 'status', 'kind', 'pitch', 'created', 'updated', 'tags', 'source'];

/** The buttons a card shows, by the pile it is in. */
function actions(pile: Pile): { decision: Decision; text: string; primary?: boolean }[] {
  const keep = { decision: 'keep' as Decision, text: 'Keep', primary: true };
  const rewrite = { decision: 'regenerate' as Decision, text: 'Rewrite' };
  const drop = { decision: 'drop' as Decision, text: 'Drop' };
  const back = { decision: 'inbox' as Decision, text: 'To decide' };
  if (pile === 'decide') return [keep, { decision: 'later', text: 'Later' }, rewrite, drop];
  if (pile === 'later' || pile === 'other') return [keep, rewrite, drop, back];
  if (pile === 'rewrite') return [keep, drop, back];
  return [{ decision: 'inbox', text: 'Move back to To decide' }];
}

/** A card for any note Kyle keeps, puts aside or drops: an idea, a beat or a conflict. */
export function ProposalCard(props: { schema: Schema; note: NoteRecord; pile: Pile; waiting?: Choice; onDecide: IdeasProps['onDecide']; onRewrite?: IdeasProps['onRewrite'] }) {
  const { schema, note, pile, waiting } = props;
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const d = note.data;
  const title = String(d.title || basename(note.path));
  const shown = cardFields(schema, note.type).filter((k) => k !== 'title' && k !== 'status' && k !== 'kind' && k !== 'pitch' && k !== 'summary' && k !== 'proves' && !isEmptyValue(d[k]));
  const decided = pile === 'kept' || pile === 'dropped';
  const more = propertyOrder(schema, note.type, d).filter((k) => QUIET.indexOf(k) < 0 && shown.indexOf(k) < 0 && k !== 'summary' && k !== 'proves' && !isEmptyValue(d[k]));
  // The line that says what the card is for: an idea's pitch, a beat's summary, what a comp proves.
  const blurb = [d.pitch, d.summary, d.proves].find((v) => !isEmptyValue(v));
  const [rewriting, setRewriting] = useState(false);
  const [now, setNow] = useState(true);
  const [editing, setEditing] = useState(false);
  const editable = editableFields(schema, note.type);
  const decide = (decision: Decision) => {
    // Rewrite needs to say what should change, so the first press opens the box and the second sends it.
    if (decision === 'regenerate' && !rewriting) { setRewriting(true); setAsking(true); return; }
    props.onDecide(note.path, decision, reason);
    if (decision === 'regenerate' && now && props.onRewrite) props.onRewrite(note.path, reason);
    setReason('');
    setAsking(false);
    setRewriting(false);
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
      {pile === 'rewrite' && !isEmptyValue(d.decision_note) && <p class="reason-shown">What to change: {String(d.decision_note)}</p>}
      {waiting && waiting.error && <p class="error">{waiting.error}</p>}
      {note.error && <p class="error">Its properties cannot be read: {note.error}</p>}
      {editing
        ? <EditFields schema={schema} note={note} fields={editable} onClose={() => setEditing(false)} onSave={(f) => props.onDecide(note.path, 'edit', '', f)} />
        : <span class="card-links">
          <button type="button" class="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Read more'}</button>
          {editable.length > 0 && !note.error && <button type="button" class="link" onClick={() => setEditing(true)}>Edit</button>}
        </span>}
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
          {rewriting ? 'What should the team change? Then press Send to rewrite.' : 'Why? The team learns most from your reasons.'}
          <input type="text" value={reason} onInput={(e) => setReason((e.currentTarget as HTMLInputElement).value)} placeholder="Optional, one line" />
        </label>
      ) : (
        !note.error && <button type="button" class="link" onClick={() => setAsking(true)}>Add a reason</button>
      )}
      {rewriting && props.onRewrite && (
        <label class="check">
          <input type="checkbox" checked={now} onChange={(e) => setNow((e.currentTarget as HTMLInputElement).checked)} />
          Ask the team to rewrite it now. The new version comes back to To decide.
        </label>
      )}
      {!note.error && (
        <div class="buttons">
          {rewriting
            ? <>
              <button type="button" class="primary" onClick={() => decide('regenerate')}>Send to rewrite</button>
              <button type="button" onClick={() => { setRewriting(false); setAsking(false); }}>Cancel</button>
            </>
            : actions(pile).map((a) => (
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
  /** Anything the board shows under its introduction, such as the Market board's Rocket files. */
  extra?: ComponentChildren;
}

export function IdeasBoard(props: IdeasProps) {
  const notes = (props.book.ideas || []).map((p) => props.index.notes[p]).filter(Boolean);
  return (
    <ProposalBoard {...props} boardKey="ideas" heading="Ideas" notes={notes}
      intro={'The team\'s proposals for ' + props.book.title + '. Keep tells the team to use it. Later puts it aside to come back to. Rewrite sends it back to the team with what to change. Drop turns it down, and the note stays in the vault.'}
      emptyText="This book has no ideas yet. They appear here when an agent files one in the book's Ideas folder."
      extra={props.onJob ? <MoreIdeas book={props.book} onJob={props.onJob} /> : undefined} />
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

  const onDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => {
    const n = index.notes[path];
    // An edit leaves the card in its pile, so there is nothing to undo.
    if (decision !== 'edit') setLast({ path, title: String((n && (n.data.id || n.data.title)) || basename(path)), decision, from: pile });
    props.onDecide(path, decision, reason, fields);
  };
  const undo = () => {
    if (!last) return;
    props.onDecide(last.path, BACK[last.from as Exclude<Pile, 'other'>], '');
    setLast(null);
  };
  const card = (n: NoteRecord) => <ProposalCard key={n.path} schema={schema} note={n} pile={pile} waiting={props.waiting[n.path]} onDecide={onDecide} onRewrite={props.onRewrite} />;

  return (
    <section>
      <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · {(board && board.title) || props.heading}</p>
      <h1>{(board && board.title) || props.heading}</h1>
      <p class="meta">{props.intro}</p>
      {props.extra}
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
      {!notes.length && <EmptyBox title="Nothing here yet"><p>{props.emptyText}</p></EmptyBox>}
      {notes.length > 0 && !list.length && (
        <p class="empty">{pile === 'decide' ? 'Nothing to decide. Everything on this board has an answer.' : pile === 'rewrite' ? 'Nothing waiting for a rewrite. Rewrite sends a card back to the team with what to change.' : 'Nothing here.'}</p>
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

/** Ask the team for more ideas, with a line saying what about. */
function MoreIdeas({ book, onJob }: { book: BookEntry; onJob: OnJob }) {
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const send = async () => {
    setBusy(true);
    const r = await onJob({ title: defaultJobTitle('ideas', '', words.trim().slice(0, 50)), kind: 'ideas', target: '', book: book.folder, ask: jobAsk('ideas', '', words) });
    setBusy(false);
    setSaid(r);
    if (!r.error) { setOpen(false); setWords(''); }
  };
  return (
    <div class="more-ideas">
      {open ? (
        <div class="side-add-form">
          <label class="reason">
            What should the ideas be about? Leave it empty and the team picks what the book needs most.
            <input type="text" value={words} onInput={(e) => setWords((e.currentTarget as HTMLInputElement).value)} placeholder="For example a twist for chapter 12" />
          </label>
          <div class="buttons">
            <button type="button" class="primary" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Ask for ideas'}</button>
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : <div class="buttons"><button type="button" onClick={() => { setOpen(true); setSaid(null); }}><Icon name="idea" size={18} />Ask the team for more ideas</button></div>}
      {said && <p class={said.error ? 'error' : 'ok'}>{said.text}</p>}
    </div>
  );
}
