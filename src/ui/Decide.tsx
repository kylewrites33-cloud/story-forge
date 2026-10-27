// Decide one at a time (design review, 2026-10-22): every card waiting on Kyle in the book (ideas and the workflow's
// results, beats, conflicts), one at a time, large, with Keep, Later, Rewrite and Drop as big buttons and Undo for ten
// seconds after each choice. Keys are extras: K keep, M later, D drop, U undo.
import { useEffect, useRef, useState } from 'preact/hooks';
import { render } from '../lib/markdown.ts';
import { decideQueue } from '../lib/overview.ts';
import { fixesOf, isStoryCall } from '../lib/changes.ts';
import type { Decision } from '../lib/ideas.ts';
import type { BookEntry, VaultIndex } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { Stars } from './IdeasBoard.tsx';
import { href } from './route.ts';

type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;
const KIND: Record<string, string> = { idea: 'Idea', beat: 'Beat', conflict: 'Conflict' };

/** `calls`: only the whole-book read's story calls (Workflow 1.2, step 38), answered Yes with a fix, or No. */
export function DecideQueue({ index, book, onDecide, calls }: { index: VaultIndex; book: BookEntry; onDecide?: OnDecide; calls?: boolean }) {
  // The queue is fixed when the page opens, so a card Kyle decides leaves it even before the vault catches up.
  const [done, setDone] = useState<string[]>([]);
  const [last, setLast] = useState<{ path: string; text: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const list = decideQueue(index, book).filter((n) => done.indexOf(n.path) < 0 && (!calls || isStoryCall(n)));
  // A story call's box for Kyle's own fix is always open above its buttons, so typing never hangs on a button that
  // first has to open it (Kyle, 2026-10-27: "When I say yes, my choice, it just goes on to the next one"). Rewrite's box
  // opens in the buttons' place and takes the cursor.
  const box = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (!asking || !box.current) return;
    box.current.focus({ preventScroll: true });
    box.current.scrollIntoView({ block: 'nearest' });
  }, [asking]);
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
      if (calls || asking || e.metaKey || e.ctrlKey || (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT'))) return;
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
  const fixes = here && calls ? fixesOf(here.body) : [];
  const name = calls ? 'Story calls' : 'Decide one at a time';
  return (
    <section class="decide">
      <p class="crumb"><a href={href.board('overview', book.folder)}>{book.title}</a> · {name}</p>
      <h1>{name}</h1>
      {calls && <p class="hint">The editor's questions about the whole book, most important first. Say yes with the fix you want, or no. The Writer follows only your yes answers when it revises (workflow steps 38 and 39).</p>}
      {!here ? (
        <div class="decide-empty"><Icon name="check" size={28} /><p>{calls ? 'No story calls are waiting in ' + book.title + '.' : 'Nothing is waiting on you in ' + book.title + '.'}</p><a class="button" href={href.board(calls ? 'changes' : 'overview', book.folder)}>{calls ? 'Back to Changes' : 'Back to Home'}</a></div>
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
          {!onDecide ? <p class="hint">Choosing needs your own vault, not the demo.</p> : calls ? (
            <div class="decide-calls">
              <div class="decide-mine">
                <label for="decide-fix">Or your own fix, in your words</label>
                <textarea id="decide-fix" rows={2} value={why} onInput={(e) => setWhy((e.target as HTMLTextAreaElement).value)} />
                <button type="button" class="primary" disabled={!why.trim()} onClick={() => choose('keep', 'Yes, your way', 'My fix: ' + why.trim())}>Yes, my way</button>
              </div>
              <div class="decide-buttons calls">
                {fixes.map((f) => <button key={f.letter} type="button" class="primary" title={f.text} onClick={() => choose('keep', 'Yes, fix ' + f.letter, 'Fix ' + f.letter + ': ' + f.text)}>Yes, fix {f.letter}</button>)}
                {!fixes.length && <button type="button" class="primary" onClick={() => choose('keep', 'Yes')}>Yes</button>}
                <button type="button" onClick={() => choose('later', 'Later')}>Later</button>
                <button type="button" onClick={() => choose('drop', 'No', 'No')}>No</button>
              </div>
            </div>
          ) : asking ? (
            <div class="decide-why">
              <label for="decide-why">What should the team change?</label>
              <textarea id="decide-why" ref={box} rows={3} value={why} onInput={(e) => setWhy((e.target as HTMLTextAreaElement).value)} />
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
