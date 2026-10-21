import { useState } from 'preact/hooks';
import { boardNotes, castFor, groupLabel, groupNotes, groupOrder, ideasAbout, type StoryBoard } from '../lib/boards.ts';
import { formatValue, isEmptyValue, label } from '../lib/format.ts';
import { pileOf } from '../lib/ideas.ts';
import { propDef } from '../lib/schema.ts';
import type { BookEntry, Schema, VaultIndex } from '../lib/types.ts';
import { ProposalBoard, type IdeasProps } from './IdeasBoard.tsx';
import { href } from './route.ts';
import { EmptyBox } from './screens.tsx';
import { Icon } from './Icon.tsx';
import { seeingLinks } from './Seeing.tsx';

export interface BoardLink { key: string; title: string; to: string; icon: string }

/** Pages of a book the app draws without a board in the schema: Overview, Notes to the Team, Sessions. */
export const APP_BOARDS = ['overview', 'notes', 'sessions'];

/** The book's boards, in the order the Story Juice chain uses them; boards the schema lacks are left out. */
export function boardLinks(schema: Schema, folder: string): BoardLink[] {
  return [
    { key: 'chapter-grid', title: 'Chapter Grid', to: href.book(folder), icon: 'grid' },
    { key: 'ideas', title: 'Ideas', to: href.ideas(folder), icon: 'idea' },
    { key: 'story-juice', title: 'Story Juice', to: href.board('story-juice', folder), icon: 'juice' },
    { key: 'characters', title: 'Characters', to: href.board('characters', folder), icon: 'people' },
    { key: 'conflict-matrix', title: 'Conflict Matrix', to: href.board('conflict-matrix', folder), icon: 'conflict' },
    { key: 'beat-sheet', title: 'Beat Sheet', to: href.board('beat-sheet', folder), icon: 'beats' },
    { key: 'market', title: 'Market', to: href.board('market', folder), icon: 'market' },
    { key: 'matrix', title: 'Matrix', to: href.board('matrix', folder), icon: 'matrix' },
    { key: 'edit-queue', title: 'Edit Queue', to: href.board('edit-queue', folder), icon: 'queue' },
    { key: 'taste', title: 'Taste', to: href.board('taste', folder), icon: 'taste' },
    { key: 'overview', title: 'Home', to: href.board('overview', folder), icon: 'home' },
    { key: 'notes', title: 'Notes to the Team', to: href.board('notes', folder), icon: 'note' },
    { key: 'sessions', title: 'Sessions', to: href.board('sessions', folder), icon: 'sessions' },
    { key: 'tension', title: 'Tension and Pacing', to: href.board('tension', folder), icon: 'tension' },
    { key: 'arcs', title: 'Character Arcs', to: href.board('arcs', folder), icon: 'arc' }
  ].filter((l) => l.key === 'chapter-grid' || l.key === 'ideas' || l.key === 'matrix' || l.key === 'taste' || l.key === 'tension' || l.key === 'arcs' || APP_BOARDS.indexOf(l.key) >= 0 || schema.boards[l.key])
    .map((l) => ({ ...l, title: (schema.boards[l.key] && schema.boards[l.key].title) || l.title }))
    .concat(seeingLinks(folder));
}

const INTRO: Record<Exclude<StoryBoard, 'characters' | 'market'>, { heading: string; intro: string; empty: string }> = {
  'story-juice': {
    heading: 'Story Juice',
    intro: 'The Story Juice chain for this book: premise, big issue, opinions, Core Drives and Core Needs, theme. Keep tells the team to build on it. Later puts it aside. Rewrite sends it back to the team with what to change. Drop turns it down, and the note stays in the vault.',
    empty: 'No Story Juice proposals for this book yet. Premise, big issue, opinion, character and theme ideas appear here.'
  },
  'beat-sheet': {
    heading: 'Beat Sheet',
    intro: 'The beats of this book, in story order: first the Story Juice act drawers, then the same story on Save the Cat. Keep the beats that are right, send back for a rewrite the ones that are close, and drop the rest, with a reason.',
    empty: 'No beats for this book yet. They appear here when the Plot Specialist files them in the book\'s Beats folder.'
  },
  'conflict-matrix': {
    heading: 'Conflict Matrix',
    intro: 'The pressure system: the collisions that squeeze the hero, by where they come from. Each runs for at least three cause-and-effect steps. Keep the ones the book should use.',
    empty: 'No conflicts for this book yet. They appear here when the Plot Specialist files them in the book\'s Conflicts folder.'
  }
};

/** The Market board's Rocket files: the ones the vault has, and a button to add one from this device. */
function RocketFiles({ book, index, onAdd }: { book: BookEntry; index: VaultIndex; onAdd?: (file: File) => Promise<{ error: boolean; text: string }> }) {
  const series = index.series.find((s) => s.folder === book.seriesFolder);
  const files = (series && series.rocket) || [];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const pick = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file || !onAdd) return;
    setBusy(true);
    setMessage(null);
    setMessage(await onAdd(file));
    setBusy(false);
  };
  return (
    <section class="rocket">
      <h2>Publisher Rocket files <span class="meta">{files.length}</span></h2>
      <p class="meta">
        Exports from Publisher Rocket that the Market Analyst reads. Add one straight from this device: in Rocket, export the search as CSV, then press Add a Rocket file.
      </p>
      {files.length > 0 && (
        <>
          <button type="button" class="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide the files' : 'Show the files'}</button>
          {open && <ul class="file-list">{files.map((f) => <li key={f}>{f}</li>)}</ul>}
        </>
      )}
      {onAdd && (
        <label class={'button' + (busy ? ' disabled' : '')}>
          {busy ? 'Adding…' : 'Add a Rocket file'}
          <input type="file" accept=".csv,text/csv" class="visually-hidden" disabled={busy} onChange={pick} />
        </label>
      )}
      {message && <p class={message.error ? 'error' : 'toast'} role="status">{message.text}</p>}
    </section>
  );
}

export function StoryBoardScreen(props: IdeasProps & { board: StoryBoard; onAddRocket?: (book: BookEntry, file: File) => Promise<{ error: boolean; text: string }> }) {
  const { schema, index, book, board } = props;
  if (board === 'characters') return <CharactersBoard schema={schema} index={index} book={book} />;
  const t = board === 'market' ? {
    heading: 'Market',
    intro: 'The market case, comps, keyword sets and titles for the ' + book.seriesName + ' series. Every book in the series shares them. Keep tells the team to build on it. Later puts it aside. Rewrite sends it back to the team with what to change. Drop turns it down, and the note stays in the vault. Money figures are Publisher Rocket estimates.',
    empty: 'No market notes for this series yet. They appear here when the Market Analyst files them in the series\' Market folder.'
  } : INTRO[board];
  const extra = board === 'market' ? <RocketFiles book={book} index={index} onAdd={props.onAddRocket && ((f) => props.onAddRocket!(book, f))} /> : undefined;
  return <ProposalBoard {...props} extra={extra} boardKey={board} heading={t.heading} intro={t.intro} emptyText={t.empty} notes={boardNotes(index, book, board)} />;
}

/** What a character card shows, when the note has it. The book's own want and arc come before the series ones. */
const CHARACTER_FIELDS = ['core_drive', 'core_need', 'want_this_book', 'want', 'opinion', 'arc_this_book', 'arc_type'];

export function CharactersBoard({ schema, index, book }: { schema: Schema; index: VaultIndex; book: BookEntry }) {
  const cast = castFor(index, book);
  const board = schema.boards.characters;
  const by = (board && board.groupBy) || 'role';
  const groups = groupNotes(cast.map((c) => c.note), by, groupOrder(schema, 'character', by));
  const inBook = new Set(cast.filter((c) => c.delta).map((c) => c.name));
  const withDrive = cast.filter((c) => !isEmptyValue(c.note.data.core_drive)).length;
  return (
    <section>
      <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · {(board && board.title) || 'Characters'}</p>
      <h1>{(board && board.title) || 'Characters'}</h1>
      <p class="meta">
        The cast of {book.seriesName}, as {book.title} has them. {withDrive === 1 ? '1 has' : withDrive + ' have'} a Core Drive on the note so far.
        Core Drives waiting for you are on the <a href={href.board('story-juice', book.folder)}>Story Juice board</a>; once you keep one, the team writes it onto the character.
      </p>
      {!cast.length && (
        <EmptyBox title="Nothing here yet">
          <p>This series has no characters yet. Character notes live in the series' Characters folder. Ask the team in the project chat to build the cast, and they appear here.</p>
        </EmptyBox>
      )}
      {groups.map((g) => (
        <section class="group" key={g.key}>
          <h2>{groupLabel(g.key, 'No role yet')} <span class="meta">{g.notes.length}</span></h2>
          <ul class="cards">
            {g.notes.map((n) => {
              const name = String(n.data.name || '');
              const rows = CHARACTER_FIELDS.filter((k) => !isEmptyValue(n.data[k]));
              const waiting = ideasAbout(index, book, name).filter((i) => pileOf(i.data) === 'decide' || pileOf(i.data) === 'later');
              return (
                <li key={n.path}>
                  <a class="card" href={href.note(n.path)}>
                    <span class="card-top">
                      <span class="card-id">{inBook.has(name) ? 'In this book' : 'Series'}{n.data.pov === true ? ' · POV' : ''}</span>
                      {waiting.length > 0 && <span class="pill pill-plain">{waiting.length === 1 ? '1 to decide' : waiting.length + ' to decide'}</span>}
                    </span>
                    <span class="card-title">{name}</span>
                    {rows.length > 0 && (
                      <dl class="wide">
                        {rows.map((k) => (
                          <div key={k}>
                            <dt>{label(k)}</dt>
                            <dd>{formatValue(k, n.data[k], propDef(schema, 'character', k))}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {n.error && <span class="card-error">Frontmatter problem: {n.error}</span>}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
