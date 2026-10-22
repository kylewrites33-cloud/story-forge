// Decide one at a time (design review, 2026-10-22): every card waiting on Kyle in the book (ideas and the workflow's
// results, beats, conflicts), one at a time, large, with Keep, Later, Rewrite and Drop as big buttons and Undo for ten
// seconds after each choice. Keys are extras: K keep, M later, D drop, U undo.
import { useEffect, useRef, useState } from 'preact/hooks';
import { render } from '../lib/markdown.ts';
import { decideQueue } from '../lib/overview.ts';
import type { Decision } from '../lib/ideas.ts';
import type { BookEntry, VaultIndex } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { Stars } from './IdeasBoard.tsx';
import { href } from './route.ts';

type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;
const KIND: Record<string, string> = { idea: 'Idea', beat: 'Beat', conflict: 'Conflict' };

export function DecideQueue({ index, book, onDecide }: { index: VaultIndex; book: BookEntry; onDecide?: OnDecide }) {
  // The queue is fixed when the page opens, so a card Kyle decides leaves it even before the vault catches up.
  const [done, setDone] = useState<string[]>([]);
  const [last, setLast] = useState<{ path: string; text: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const list = decideQueue(index, book).filter((n) => done.indexOf(n.path) < 0);
  const here = list[0];
  const choose = (decision: Decision, label: string, reason = '') => {
    if (!here || !onDecide) return;
    onDecide(here.path, decision, reason);
    setDone(done.concat(here.path));
    setLast({ path: here.path, text: label + ': ' + String(here.data.title || here.data.id || '') });
    setAsking(false); setWhy('');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLast(null), 10000);
  };
  const undo = () => {
    if (!last || !onDecide) return;
    onDecide(last.path, 'inbox', '');
    setDone(done.filter((p) => p !== last.path));
    setLast(null);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (asking || e.metaKey || e.ctrlKey || (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT'))) return;
      const k = e.key.toLowerCase();
      if (k === 'k') choose('keep', 'Kept');
      else if (k === 'm') choose('later', 'Later');
      else if (k === 'd') choose('drop', 'Dropped');
      else if (k === 'u') undo();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const total = list.length + done.length;
  return (
    <section class="decide">
      <p class="crumb"><a href={href.board('overview', book.folder)}>{book.title}</a> · Decide one at a time</p>
      <h1>Decide one at a time</h1>
      {!here ? (
        <div class="decide-empty"><Icon name="check" size={28} /><p>Nothing is waiting on you in {book.title}.</p><a class="button" href={href.board('overview', book.folder)}>Back to Home</a></div>
      ) : (
        <>
          <p class="meta">{done.length + 1} of {total} · {list.length === 1 ? 'the last one' : list.length - 1 + ' more after this'}</p>
          <article class="decide-card">
            <p class="decide-kind">{KIND[here.type] || here.type}{here.data.step != null && here.data.step !== '' ? ' · workflow step ' + here.data.step : ''}{here.data.kind ? ' · ' + here.data.kind : ''}</p>
            <h2>{String(here.data.title || here.data.id || '')}</h2>
            {here.data.panel_score != null && here.data.panel_score !== '' && <p class="decide-panel">The panel's score: <b>{String(here.data.panel_score)} of 5</b>{here.data.panel_note ? '. ' + String(here.data.panel_note) : ''}</p>}
            {here.data.pitch ? <p class="decide-pitch">{String(here.data.pitch)}</p> : null}
            <div class="prose decide-body" dangerouslySetInnerHTML={{ __html: render(here.body) }} />
            {onDecide && <Stars value={Number(here.data.rating) || 0} onRate={(n) => onDecide(here.path, 'edit', '', { rating: n ? String(n) : '' })} />}
            <p class="meta"><a href={href.note(here.path)}>Open the full note</a></p>
          </article>
          {!onDecide ? <p class="hint">Choosing needs your own vault, not the demo.</p> : asking ? (
            <div class="decide-why">
              <label for="decide-why">What should the team change?</label>
              <textarea id="decide-why" rows={3} value={why} onInput={(e) => setWhy((e.target as HTMLTextAreaElement).value)} />
              <div class="buttons">
                <button type="button" class="primary" disabled={!why.trim()} onClick={() => choose('regenerate', 'Sent back to rewrite', why.trim())}>Send it back</button>
                <button type="button" onClick={() => setAsking(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div class="decide-buttons">
              <button type="button" class="primary" onClick={() => choose('keep', 'Kept')}>Keep</button>
              <button type="button" onClick={() => choose('later', 'Later')}>Later</button>
              <button type="button" onClick={() => setAsking(true)}>Rewrite</button>
              <button type="button" onClick={() => choose('drop', 'Dropped')}>Drop</button>
            </div>
          )}
        </>
      )}
      {last && <p class="decide-toast" role="status">{last.text} <button type="button" class="link" onClick={undo}>Undo</button></p>}
    </section>
  );
}
