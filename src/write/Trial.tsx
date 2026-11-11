// The trial page for the new writing box (code structure redesign, step 3). Kyle, 2026-11-11, on the card "Start step 3
// with a trial of a new writing box on your iPad?": "Yes, build the trial page". One of his chapters in the new box
// (`prose.ts`), in the writing page's own frame so the iPad keyboard behaves as it does there. NOTHING HERE IS SAVED:
// the page takes no save action and keeps nothing on the device. His real writing page is untouched. He types for a
// few minutes and says how it feels; that decides whether step 3 swaps the box or mends today's.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { href } from '../app/route.ts';
import { chapterGroups } from '../lib/board.ts';
import { loadLook, lookStyle } from '../lib/page.ts';
import { wordCount } from '../lib/prose.js';
import type { BookEntry, Schema, VaultIndex } from '../lib/types.ts';
import { Icon } from '../ui/Icon.tsx';
import { useLockedPage } from '../ui/viewport.ts';
import type { ProseBox } from './prose.ts';

const OUTSIDE = 'This line came from outside your typing, the way the team\'s words or a Bring over arrive. The page should not have moved.';

export function TrialPage({ schema, index, book, path }: { schema: Schema; index: VaultIndex; book: BookEntry | null; path: string }) {
  useLockedPage();
  const [look] = useState(loadLook);
  const groups = useMemo(() => (book ? chapterGroups(schema, book.scenes.map((p) => index.notes[p]).filter(Boolean)).filter((g) => g.scenes.some((n) => n.data.kind !== 'test')) : []), [schema, index, book]);
  const group = groups.find((g) => g.scenes.some((n) => n.path === path)) || groups[0] || null;
  // The chapter as one page: its scenes one after another, as they stood when the trial opened.
  const key = group ? group.key + ':' + group.scenes.map((n) => n.path).join('|') : '';
  const start = useMemo(() => (group ? group.scenes.map((n) => n.body.replace(/^\s+/, '').replace(/\s+$/, '')).join('\n\n') : ''), [key]);
  const host = useRef<HTMLDivElement>(null);
  const box = useRef<ProseBox | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState('');
  const [words, setWords] = useState(() => wordCount(start));
  const times = useRef<number[]>([]);
  const [speed, setSpeed] = useState<{ usual: number; slowest: number; keys: number } | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let gone = false;
    setReady(false);
    times.current = [];
    setSpeed(null);
    setWords(wordCount(start));
    import('./prose.ts').then((m) => {
      if (gone || !host.current) return;
      box.current = m.proseBox(host.current, start, {
        onChange: (t) => setWords(wordCount(t)),
        onKeyTime: (ms) => {
          const all = times.current;
          all.push(ms);
          if (all.length % 5 !== 0) return;
          const sorted = all.slice().sort((a, b) => a - b);
          setSpeed({ usual: Math.round(sorted[Math.floor(sorted.length / 2)]), slowest: Math.round(sorted[sorted.length - 1]), keys: all.length });
        }
      });
      setReady(true);
    }).catch((e) => { if (!gone) setFailed('The trial writing box could not be opened: ' + (e as Error).message + ' Connect to the internet and open this page again.'); });
    return () => { gone = true; if (box.current) { box.current.destroy(); box.current = null; } };
  }, [start, round]);

  const tool = (label: string, inner: ComponentChildren, run: () => void) => (
    // Pressed without taking the cursor out of the page, so the keyboard stays up.
    <button type="button" class="tool" aria-label={label} title={label} disabled={!ready} onMouseDown={(e) => e.preventDefault()} onClick={run}>{inner}</button>
  );
  return (
    <div class={'writer trial paper-' + look.paper} style={lookStyle(look)}>
      <header class="writer-bar">
        <a class="bar-button" href={book ? href.board('overview', book.folder) : href.settings()} aria-label="Leave the trial"><Icon name="left" /><span class="bar-label">Leave</span></a>
        <span class="writer-where">
          <span class="writer-title">Trial: the new writing box</span>
          <span class="writer-book">Nothing you type here is saved</span>
        </span>
        {tool('Bold', <b>B</b>, () => { if (box.current) box.current.style('b'); })}
        {tool('Italic', <i>I</i>, () => { if (box.current) box.current.style('i'); })}
        {tool('Undo', <Icon name="undo" size={20} />, () => { if (box.current) box.current.undo(); })}
        {tool('Redo', <Icon name="redo" size={20} />, () => { if (box.current) box.current.redo(); })}
        {/* In the bar, so it can be pressed from anywhere in the chapter: the test is that the page stays where it is. */}
        <button type="button" class="bar-button trial-outside" disabled={!ready} onMouseDown={(e) => e.preventDefault()} onClick={() => { if (box.current) box.current.addOutside(OUTSIDE); }}>Add a line from outside</button>
      </header>
      <div class="writer-page trial-page">
        <div class="page-head trial-head">
          <p class="trial-note">
            This is a trial of a new writing box, with one of your chapters in it. <strong>Nothing you type here is saved</strong>, and your real writing page is untouched. Type, select, use autocorrect and dictation, and see how it feels beside the page you write in every day. <em>Add a line from outside</em>, at the top, puts a line under the paragraph you are in, the way the team's words arrive: the page should stay where it is.
          </p>
          <div class="trial-row">
            {groups.length > 1 && (
              <label class="trial-pick">Chapter
                <select value={group ? group.scenes[0].path : ''} onChange={(e) => { location.hash = href.trial((e.currentTarget as HTMLSelectElement).value); }}>
                  {groups.map((g) => <option key={g.key} value={g.scenes[0].path}>{(g.num != null ? g.num + ' · ' : '') + (g.title || g.scenes[0].data.title || 'No chapter yet') + ' (' + g.words.toLocaleString('en-US') + ' words)'}</option>)}
                </select>
              </label>
            )}
            <button type="button" class="bar-button" disabled={!ready} onClick={() => setRound(round + 1)}>Start again</button>
          </div>
          <p class="trial-meter" role="status">
            {words.toLocaleString('en-US')} words.{' '}
            {speed ? 'Each key shows in about ' + speed.usual + ' thousandths of a second; the slowest of ' + speed.keys + ' took ' + speed.slowest + '.' : 'Type a little and this line says how quickly each key shows.'}
          </p>
        </div>
        {failed ? <p class="writer-text error">{failed}</p> : !group ? <p class="writer-text hint">This book has no chapters to try the box with yet.</p> : null}
        <div class="writer-text styled trial-text" ref={host} />
      </div>
    </div>
  );
}
