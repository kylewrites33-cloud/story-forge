// The "seeing the book" pages, after Writers Room's Story Dashboard: Promises, Plot Grid and Timeline (the sidebar's
// Plan group), Themes and Cast web (its Review group). Each is a board of the open book at #/board/<key>/<book>.
import type { Decision } from '../lib/ideas.ts';
import type { BookEntry, Schema, VaultIndex } from '../lib/types.ts';
import { PromisesBoard } from './Promises.tsx';
import { PlotGridBoard } from './PlotGrid.tsx';
import { TimelineBoard } from './Timeline.tsx';
import { ThemesBoard } from './Themes.tsx';
import { CastWebBoard } from './CastWeb.tsx';

export const SEEING_BOARDS = ['promises', 'plot-grid', 'timeline', 'themes', 'cast-web'];

export function SeeingBoard({ board, schema, index, book, onDecide }: {
  board: string; schema: Schema; index: VaultIndex; book: BookEntry;
  /** Saves a card edit through the write queue; missing when the vault cannot be changed from here. */
  onDecide?: (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;
}) {
  if (board === 'promises') return <PromisesBoard index={index} book={book} />;
  if (board === 'plot-grid') return <PlotGridBoard schema={schema} index={index} book={book} onDecide={onDecide} />;
  if (board === 'timeline') return <TimelineBoard index={index} book={book} />;
  if (board === 'themes') return <ThemesBoard index={index} book={book} />;
  return <CastWebBoard index={index} book={book} />;
}
