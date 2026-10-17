import { boardNotes, castFor, groupLabel, groupNotes, groupOrder, ideasAbout, type StoryBoard } from '../lib/boards.ts';
import { formatValue, isEmptyValue, label } from '../lib/format.ts';
import { pileOf } from '../lib/ideas.ts';
import { propDef } from '../lib/schema.ts';
import type { BookEntry, Schema, VaultIndex } from '../lib/types.ts';
import { ProposalBoard, type IdeasProps } from './IdeasBoard.tsx';
import { href } from './route.ts';

/** The book's boards as a row of links, in the order the Story Juice chain uses them. */
export function BoardNav({ schema, book, current }: { schema: Schema; book: BookEntry; current: string }) {
  const links: { key: string; title: string; to: string }[] = [
    { key: 'chapter-grid', title: 'Chapter Grid', to: href.book(book.folder) },
    { key: 'ideas', title: 'Ideas', to: href.ideas(book.folder) },
    { key: 'story-juice', title: 'Story Juice', to: href.board('story-juice', book.folder) },
    { key: 'characters', title: 'Characters', to: href.board('characters', book.folder) },
    { key: 'conflict-matrix', title: 'Conflict Matrix', to: href.board('conflict-matrix', book.folder) },
    { key: 'beat-sheet', title: 'Beat Sheet', to: href.board('beat-sheet', book.folder) },
    { key: 'market', title: 'Market', to: href.board('market', book.folder) }
  ].filter((l) => l.key === 'chapter-grid' || l.key === 'ideas' || schema.boards[l.key]);
  return (
    <nav class="board-nav" aria-label="Boards">
      {links.map((l) => (
        <a key={l.key} href={l.to} aria-current={l.key === current ? 'page' : undefined}>
          {(schema.boards[l.key] && schema.boards[l.key].title) || l.title}
        </a>
      ))}
    </nav>
  );
}

const INTRO: Record<Exclude<StoryBoard, 'characters' | 'market'>, { heading: string; intro: string; empty: string }> = {
  'story-juice': {
    heading: 'Story Juice',
    intro: 'The Story Juice chain for this book: premise, big issue, opinions, Core Drives and Core Needs, theme. Keep tells the team to build on it. Later puts it aside. Drop turns it down, and the note stays in the vault.',
    empty: 'No Story Juice proposals for this book yet. Premise, big issue, opinion, character and theme ideas appear here.'
  },
  'beat-sheet': {
    heading: 'Beat Sheet',
    intro: 'The beats of this book, in story order: first the Story Juice act drawers, then the same story on Save the Cat. Keep the beats that are right; drop the ones that are not, with a reason.',
    empty: 'No beats for this book yet. They appear here when the Plot Specialist files them in the book\'s Beats folder.'
  },
  'conflict-matrix': {
    heading: 'Conflict Matrix',
    intro: 'The pressure system: the collisions that squeeze Grey, by where they come from. Each runs for at least three cause-and-effect steps. Keep the ones the book should use.',
    empty: 'No conflicts for this book yet. They appear here when the Plot Specialist files them in the book\'s Conflicts folder.'
  }
};

export function StoryBoardScreen(props: IdeasProps & { board: StoryBoard }) {
  const { schema, index, book, board } = props;
  if (board === 'characters') return <CharactersBoard schema={schema} index={index} book={book} />;
  const t = board === 'market' ? {
    heading: 'Market',
    intro: 'The market case, comps, keyword sets and titles for the ' + book.seriesName + ' series. Every book in the series shares them. Keep tells the team to build on it. Later puts it aside. Drop turns it down, and the note stays in the vault. Money figures are Publisher Rocket estimates.',
    empty: 'No market notes for this series yet. They appear here when the Market Analyst files them in the series\' Market folder.'
  } : INTRO[board];
  return <ProposalBoard {...props} boardKey={board} heading={t.heading} intro={t.intro} emptyText={t.empty} notes={boardNotes(index, book, board)} />;
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
      {!cast.length && <p class="empty">This series has no character notes yet.</p>}
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
