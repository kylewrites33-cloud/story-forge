// Find in the top bar (design review, 2026-10-22): press Find (or Ctrl or Cmd+K, an extra) and type. A number finds
// that chapter; words find scenes, codex names and ideas in the book on screen. Picking one opens it.
import { useEffect, useRef, useState } from 'preact/hooks';
import { findIn } from '../lib/find.ts';
import type { BookEntry, VaultIndex } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { href } from './route.ts';

export function FindButton({ index, book }: { index: VaultIndex; book: BookEntry }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    };
    const close = () => setOpen(false);
    window.addEventListener('keydown', key);
    window.addEventListener('hashchange', close);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('hashchange', close); };
  }, []);
  useEffect(() => { if (open && input.current) input.current.focus(); }, [open]);
  const hits = open ? findIn(index, book, q) : [];
  const to = (h: { kind: string; path: string }) => h.kind === 'scene' ? href.write(h.path) : href.note(h.path);
  return (
    <>
      <button type="button" class="top-find" onClick={() => setOpen(true)} aria-label="Find a scene, name or idea">
        <Icon name="search" size={20} /><span class="top-find-label">Find a scene, name or idea</span>
      </button>
      {open && (
        <div class="find-layer">
          <button type="button" class="find-backdrop" aria-label="Close Find" tabIndex={-1} onClick={() => setOpen(false)} />
          <div class="find-box" role="dialog" aria-label="Find">
            <div class="find-row">
              <Icon name="search" size={20} />
              <input ref={input} type="search" value={q} placeholder={'Find in ' + book.title + ': a chapter number, a scene, a name or an idea'}
                onInput={(e) => setQ((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) location.hash = to(hits[0]); }} />
              <button type="button" class="icon-button" aria-label="Close Find" onClick={() => setOpen(false)}><Icon name="close" size={20} /></button>
            </div>
            {q.trim() !== '' && (
              hits.length ? (
                <ul class="find-hits">
                  {hits.map((h) => <li key={h.path}><a href={to(h)}><span class="find-title">{h.title}</span><span class="find-sub">{h.sub}</span></a></li>)}
                </ul>
              ) : <p class="find-none">Nothing in {book.title} matches “{q.trim()}”.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
