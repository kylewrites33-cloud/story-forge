import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { groupLabel, groupNotes, groupOrder } from '../lib/boards.ts';
import { formatValue, isEmptyValue, label } from '../lib/format.ts';
import { filterIdeas, ideaTarget, PILES, piles, ratingOf, reasonLabel, reasonsFor, reasonsOf, toggleReason, valueCounts, type Decision, type IdeaFilter, type Pile } from '../lib/ideas.ts';
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
const QUIET = ['type', 'id', 'title', 'status', 'kind', 'pitch', 'created', 'updated', 'tags', 'source', 'rating', 'reasons'];

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

/** What a card on the Ideas board adds: a tick box, the card the keys act on, and the large one-at-a-time look. */
export interface CardExtras {
  ticked?: boolean;
  onTick?: (on: boolean) => void;
  /** The card the keyboard keys act on, outlined once a key has been pressed. */
  current?: boolean;
  /** Pressing anywhere on the card makes it the current one. */
  onPick?: () => void;
  /** One at a time: the card shown large, its idea open. */
  large?: boolean;
}

/** A card for any note Kyle keeps, puts aside or drops: an idea, a beat or a conflict. */
export function ProposalCard(props: { schema: Schema; note: NoteRecord; pile: Pile; waiting?: Choice; onDecide: IdeasProps['onDecide']; onRewrite?: IdeasProps['onRewrite'] } & CardExtras) {
  const { schema, note, pile, waiting } = props;
  const [open, setOpen] = useState(Boolean(props.large));
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const d = note.data;
  const title = String(d.title || basename(note.path));
  const shown = cardFields(schema, note.type).filter((k) => k !== 'title' && k !== 'status' && k !== 'kind' && k !== 'pitch' && k !== 'summary' && k !== 'proves' && !isEmptyValue(d[k]));
  // Stars and one-press reasons belong to notes whose type has them (ideas).
  const hasStars = Boolean(propDef(schema, note.type, 'rating'));
  const reasons = propDef(schema, note.type, 'reasons') ? reasonsOf(d) : [];
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
    <li class={'idea' + (props.current ? ' current' : '') + (props.ticked ? ' ticked' : '') + (props.large ? ' idea-large' : '')} onPointerDown={props.onPick}>
      <span class="card-top">
        {props.onTick && !note.error && (
          <label class="tick" title="Tick to keep, drop or combine several at once">
            <input type="checkbox" checked={Boolean(props.ticked)} onChange={(e) => props.onTick!((e.currentTarget as HTMLInputElement).checked)}
              aria-label={'Tick ' + String(d.id || title)} />
          </label>
        )}
        <span class="card-id">{String(d.id || '')}{d.kind ? ' · ' + String(d.kind).replace(/-/g, ' ') : ''}</span>
        {waiting && <span class={'pill' + (waiting.error ? ' pill-error' : '')}>{waiting.error ? 'Not saved' : 'Saving'}</span>}
      </span>
      <span class="card-title">{title}</span>
      {!isEmptyValue(blurb) && <p class="pitch">{String(blurb)}</p>}
      {shown.length > 0 && (
        <p class="meta">{shown.map((k) => label(k) + ': ' + formatValue(k, d[k], propDef(schema, note.type, k))).join(' · ')}</p>
      )}
      {hasStars && !note.error && <Stars value={ratingOf(d)} onRate={(n) => props.onDecide(note.path, 'edit', '', { rating: n ? String(n) : '' })} />}
      {reasons.length > 0 && <p class="reason-chips-shown">{reasons.map((r) => <span key={r} class="pill pill-plain">{reasonLabel(r)}</span>)}</p>}
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

/** One to five stars. Pressing the stars an idea already has takes them off. */
export function Stars({ value, onRate }: { value: number; onRate: (n: number) => void }) {
  return (
    <span class="stars" role="group" aria-label={value ? value + ' of 5 stars' : 'No stars yet'}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" class={'star' + (n <= value ? ' on' : '')} aria-pressed={n === value}
          aria-label={n === value ? 'Take off the stars' : n + (n === 1 ? ' star' : ' stars')} onClick={() => onRate(n === value ? 0 : n)}>
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </span>
  );
}

/** The last choice on a board, for its toast: Undo, and the one-press reasons that go with it. */
interface Last {
  paths: string[];
  title: string;
  decision: Decision;
  from: Pile;
  /** Each note's reasons before, so Undo or unpressing every reason puts them back. */
  before: Record<string, string[]>;
  /** The reasons pressed in this toast. */
  chosen: string[];
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
  /** The Ideas board's ways to decide faster: filters, tick boxes, keys, one at a time, combine and variations. */
  fast?: boolean;
}

export function IdeasBoard(props: IdeasProps) {
  const notes = (props.book.ideas || []).map((p) => props.index.notes[p]).filter(Boolean);
  return (
    <ProposalBoard {...props} boardKey="ideas" heading="Ideas" notes={notes} fast
      intro={'The team\'s proposals for ' + props.book.title + '. Keep tells the team to use it. Later puts it aside to come back to. Rewrite sends it back to the team with what to change. Drop turns it down, and the note stays in the vault.'}
      emptyText="This book has no ideas yet. They appear here when an agent files one in the book's Ideas folder."
      extra={props.onJob ? <MoreIdeas book={props.book} onJob={props.onJob} /> : undefined} />
  );
}

/** Piles (to decide, later, kept, dropped) of one kind of proposal, grouped the way the schema's board says. After Keep,
 * Later or Drop the toast offers one-press reasons. The Ideas board (`fast`) adds a filter by agent and kind, tick boxes
 * with Keep all, Later all and Drop all, Combine and Variations, keys, and one card at a time. */
export function ProposalBoard(props: ProposalBoardProps) {
  const { schema, index, book, fast } = props;
  const [pile, setPile] = useState<Pile>('decide');
  const [last, setLast] = useState<Last | null>(null);
  const [filter, setFilter] = useState<IdeaFilter>({ source: '', kind: '' });
  const [ticked, setTicked] = useState<string[]>([]);
  const [cur, setCur] = useState(0);
  const [keyed, setKeyed] = useState(false);
  const [one, setOne] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const notes = fast ? filterIdeas(props.notes, filter) : props.notes;
  const byPile = piles(notes);
  const board = schema.boards[props.boardKey];
  const by = props.boardKey === 'ideas' ? '' : (board && board.groupBy) || '';
  const tabs = PILES.filter((p) => p.key !== 'other' || byPile.other.length > 0);
  const list = byPile[pile];
  const type = (board && board.types[0]) || 'idea';
  const groups = by ? groupNotes(list, by, groupOrder(schema, type, by)) : [{ key: '', notes: list }];
  const at = Math.max(0, Math.min(cur, list.length - 1));
  const here: NoteRecord | undefined = list[at];
  const tickedNotes = list.filter((n) => ticked.indexOf(n.path) >= 0);

  const nameOf = (paths: string[]) => {
    if (paths.length !== 1) return paths.length + ' cards';
    const n = index.notes[paths[0]];
    return String((n && (n.data.id || n.data.title)) || basename(paths[0]));
  };
  const decideMany = (paths: string[], decision: Decision, reason = '', fields?: Record<string, string>) => {
    if (!paths.length) return;
    // An edit leaves the card in its pile, so there is nothing to undo.
    if (decision !== 'edit') {
      const before: Record<string, string[]> = {};
      paths.forEach((p) => { before[p] = index.notes[p] ? reasonsOf(index.notes[p].data) : []; });
      setLast({ paths, title: nameOf(paths), decision, from: pile, before, chosen: [] });
      setSaid(null);
    }
    paths.forEach((p) => props.onDecide(p, decision, reason, fields));
  };
  const onDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => decideMany([path], decision, reason, fields);
  const undo = () => {
    if (!last || last.from === 'other') return;
    last.paths.forEach((p) => {
      props.onDecide(p, BACK[last.from as Exclude<Pile, 'other'>], '');
      if (last.chosen.length) props.onDecide(p, 'edit', '', { reasons: last.before[p].join(', ') });
    });
    setLast(null);
  };
  /** A one-press reason, on or off, written to every card the last choice moved. With none pressed, they get back what they had. */
  const pressReason = (key: string) => {
    if (!last) return;
    const chosen = toggleReason(last.chosen, key);
    last.paths.forEach((p) => props.onDecide(p, 'edit', '', { reasons: (chosen.length ? chosen : last.before[p]).join(', ') }));
    setLast({ ...last, chosen });
  };
  const rate = (n: NoteRecord, stars: number) => props.onDecide(n.path, 'edit', '', { rating: stars ? String(stars) : '' });
  const tick = (path: string, on: boolean) => setTicked((t) => on ? t.filter((p) => p !== path).concat(path) : t.filter((p) => p !== path));
  const switchPile = (k: Pile) => { setPile(k); setLast(null); setTicked([]); setCur(0); };
  const changeFilter = (f: IdeaFilter) => { setFilter(f); setCur(0); setTicked([]); };

  // The keys, on the Ideas board only. They are extras: each one has a button too.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], .team-side')) return;
    const k = e.key.toLowerCase();
    const can = (d: Decision) => actions(pile).some((a) => a.decision === d);
    let done = true;
    if (k === 'f') setOne(!one);
    else if (k === 'escape' && one) setOne(false);
    else if (k === 'u') undo();
    else if (k === 'arrowdown' || k === 'arrowright') setCur(Math.min(at + 1, Math.max(list.length - 1, 0)));
    else if (k === 'arrowup' || k === 'arrowleft') setCur(Math.max(at - 1, 0));
    else if (!here) done = false;
    else if (k === 'k' && can('keep')) onDecide(here.path, 'keep', '');
    else if (k === 'm' && can('later')) onDecide(here.path, 'later', '');
    else if (k === 'd' && can('drop')) onDecide(here.path, 'drop', '');
    else if (k === 'x') tick(here.path, ticked.indexOf(here.path) < 0);
    else if (/^[1-5]$/.test(k) && propDef(schema, here.type, 'rating')) rate(here, ratingOf(here.data) === Number(k) ? 0 : Number(k));
    else done = false;
    if (done) { e.preventDefault(); setKeyed(true); }
  };
  useEffect(() => {
    if (!fast) return;
    const on = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [fast]);
  // Keep the card the keys act on in view.
  useEffect(() => {
    if (!keyed || one) return;
    const el = document.querySelector('.idea.current') as HTMLElement | null;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [at, keyed, one, pile]);

  /** Combine (two or more ticked) or Variations (one ticked): a team job; the results come back as new inbox ideas. */
  const ask = async (kind: 'combine' | 'variations') => {
    if (!props.onJob) return;
    const target = ideaTarget(tickedNotes);
    const single = tickedNotes.length === 1 ? String(tickedNotes[0].data.title || '') : '';
    setBusy(true);
    const r = await props.onJob({ title: defaultJobTitle(kind, target, single), kind, target, book: book.folder, ask: jobAsk(kind, target, '') });
    setBusy(false);
    setLast(null);
    setSaid(r.error ? r : { error: false, text: r.text + (kind === 'combine' ? ' The combined ideas come back to To decide.' : ' Three takes come back to To decide.') });
    if (!r.error) setTicked([]);
  };

  const card = (n: NoteRecord, i: number, large = false) => (
    <ProposalCard key={n.path + (large ? ':one' : '')} schema={schema} note={n} pile={pile} waiting={props.waiting[n.path]} onDecide={onDecide} onRewrite={props.onRewrite}
      {...(fast ? { ticked: ticked.indexOf(n.path) >= 0, onTick: large ? undefined : (on: boolean) => tick(n.path, on), current: keyed && i === at && !large, onPick: () => setCur(i), large } : {})} />
  );
  const sources = fast ? valueCounts(props.notes, 'source') : [];
  const kinds = fast ? valueCounts(props.notes, 'kind') : [];
  const filtered = Boolean(filter.source || filter.kind);
  const bulk = actions(pile).filter((a) => a.decision !== 'regenerate');
  const BULK: Partial<Record<Decision, string>> = { keep: 'Keep all', later: 'Later all', drop: 'Drop all', inbox: 'All back to To decide' };
  const chips = last && last.from !== 'other' ? reasonsFor(last.decision) : [];

  return (
    <section class={fast ? 'fast-board' : undefined}>
      <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · {(board && board.title) || props.heading}</p>
      <h1>{(board && board.title) || props.heading}</h1>
      <p class="meta">{props.intro}</p>
      {props.extra}
      {fast && props.notes.length > 0 && (
        <div class="idea-tools">
          {sources.length > 1 && (
            <label class="idea-filter"><span>Proposed by</span>
              <select value={filter.source} onChange={(e) => changeFilter({ ...filter, source: (e.currentTarget as HTMLSelectElement).value })}>
                <option value="">Anyone</option>
                {sources.map((v) => <option key={v.value} value={v.value}>{v.value} ({v.count})</option>)}
              </select>
            </label>
          )}
          {kinds.length > 1 && (
            <label class="idea-filter"><span>Kind</span>
              <select value={filter.kind} onChange={(e) => changeFilter({ ...filter, kind: (e.currentTarget as HTMLSelectElement).value })}>
                <option value="">Any kind</option>
                {kinds.map((v) => <option key={v.value} value={v.value}>{v.value.replace(/-/g, ' ')} ({v.count})</option>)}
              </select>
            </label>
          )}
          {filtered && <button type="button" class="link" onClick={() => changeFilter({ source: '', kind: '' })}>Show every idea</button>}
          <button type="button" class={'one-button' + (one ? ' soft' : '')} aria-pressed={one} onClick={() => { setOne(!one); setKeyed(false); }}>
            <Icon name={one ? 'cards' : 'focus'} size={18} />{one ? 'Show them all' : 'One at a time'}
          </button>
        </div>
      )}
      {fast && props.notes.length > 0 && (
        <p class="keys-hint">Keys: K keep · M later · D drop · 1 to 5 stars · U undo · X tick · F one at a time · arrows move.</p>
      )}
      <div class="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={pile === t.key} onClick={() => switchPile(t.key)}>
            {t.label} <span class="count">{byPile[t.key].length}</span>
          </button>
        ))}
      </div>
      {last && last.from !== 'other' && (
        <div class="toast decide-toast" role="status">
          <span>{DONE[last.decision]}: {last.title}.</span>
          {chips.length > 0 && (
            <span class="reason-chips" role="group" aria-label="Why? Press any that fit, or carry on">
              <span class="meta">Why?</span>
              {chips.map((c) => (
                <button key={c.key} type="button" class={'chip' + (last.chosen.indexOf(c.key) >= 0 ? ' on' : '')} aria-pressed={last.chosen.indexOf(c.key) >= 0} onClick={() => pressReason(c.key)}>{c.label}</button>
              ))}
            </span>
          )}
          <button type="button" class="link" onClick={undo}>Undo</button>
        </div>
      )}
      {said && <p class={said.error ? 'error' : 'ok'} role="status">{said.text}</p>}
      {fast && !one && tickedNotes.length > 0 && (
        <div class="bulk-bar" role="group" aria-label="Ticked cards">
          <span class="bulk-count">{tickedNotes.length} ticked</span>
          {bulk.map((a) => (
            <button key={a.decision} type="button" class={a.primary ? 'primary' : undefined} onClick={() => { decideMany(tickedNotes.map((n) => n.path), a.decision); setTicked([]); }}>{BULK[a.decision] || a.text}</button>
          ))}
          {props.onJob && tickedNotes.length >= 2 && <button type="button" disabled={busy} onClick={() => ask('combine')}><Icon name="join" size={18} />Ask the team to combine</button>}
          {props.onJob && tickedNotes.length === 1 && <button type="button" disabled={busy} onClick={() => ask('variations')}><Icon name="split" size={18} />Ask for variations</button>}
          {tickedNotes.length < list.length && <button type="button" class="link" onClick={() => setTicked(list.map((n) => n.path))}>Tick all {list.length}</button>}
          <button type="button" class="link" onClick={() => setTicked([])}>Clear ticks</button>
        </div>
      )}
      {!props.notes.length && <EmptyBox title="Nothing here yet"><p>{props.emptyText}</p></EmptyBox>}
      {props.notes.length > 0 && !list.length && (
        <p class="empty">{filtered ? 'No ideas in this pile match the filter. ' : ''}{pile === 'decide' ? 'Nothing to decide. Everything on this board has an answer.' : pile === 'rewrite' ? 'Nothing waiting for a rewrite. Rewrite sends a card back to the team with what to change.' : 'Nothing here.'}</p>
      )}
      {fast && one
        ? (here && (
          <div class="one-at-a-time">
            <div class="one-nav">
              <button type="button" disabled={at === 0} onClick={() => setCur(at - 1)} aria-label="Previous idea"><Icon name="left" size={18} /></button>
              <span class="meta">{at + 1} of {list.length}</span>
              <button type="button" disabled={at >= list.length - 1} onClick={() => setCur(at + 1)} aria-label="Next idea"><Icon name="right" size={18} /></button>
            </div>
            <ul class="cards ideas one">{card(here, at, true)}</ul>
          </div>
        ))
        : by
          ? groups.map((g) => (
            <section class="group" key={g.key}>
              <h2>{groupLabel(g.key)} <span class="meta">{g.notes.length}</span></h2>
              <ul class="cards ideas">{g.notes.map((n) => card(n, list.indexOf(n)))}</ul>
            </section>
          ))
          : <ul class="cards ideas">{list.map((n, i) => card(n, i))}</ul>}
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
