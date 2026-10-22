// The Codex as a list and a detail side by side (design review, 2026-10-22): Characters, Places, Items and Lore each
// have a page. The list on the left has a filter; the entry opens on the right with its "now" and where it appears.
// Narrower than 900 px the list comes first and the entry opens under a back button.
import { useEffect, useState } from 'preact/hooks';
import { codexFor } from '../lib/codex.ts';
import { ideasAbout } from '../lib/boards.ts';
import { pileOf } from '../lib/ideas.ts';
import { CODEX_PAGES } from '../lib/rooms.ts';
import type { BookEntry, Schema, VaultIndex } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { href } from './route.ts';
import { EmptyBox, NoteView } from './screens.tsx';

const TITLES: Record<string, string> = { characters: 'Characters', places: 'Places', items: 'Items', lore: 'Lore' };
const FOLDERS: Record<string, string> = { characters: 'Characters', places: 'Places', items: 'Items', lore: 'Lore' };

export function CodexBoard({ schema, index, book, board }: { schema: Schema; index: VaultIndex; book: BookEntry; board: string }) {
  const type = CODEX_PAGES[board];
  const all = codexFor(index, book).filter((e) => e.type === type).sort((a, b) => a.name.localeCompare(b.name));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string>(() => (all[0] ? all[0].note.path : ''));
  const [picked, setPicked] = useState(false);
  useEffect(() => { setOpen(all[0] ? all[0].note.path : ''); setPicked(false); setQ(''); }, [board, book.folder]);
  const shown = q.trim() ? all.filter((e) => (e.name + ' ' + String(e.note.data.kind || e.note.data.role || '')).toLowerCase().indexOf(q.trim().toLowerCase()) >= 0) : all;
  const title = TITLES[board] || 'Codex';
  if (!all.length) {
    return (
      <section>
        <h1>{title}</h1>
        <EmptyBox title="Nothing here yet">
          <p>{book.seriesName} has no {title.toLowerCase()} yet. They live in the series' {FOLDERS[board]} folder. Ask the team to add them, and they appear here.</p>
        </EmptyBox>
      </section>
    );
  }
  return (
    <section class={'codex' + (picked ? ' picked' : '')}>
      <div class="codex-list">
        <h1>{title} <span class="meta">{all.length}</span></h1>
        <input type="search" class="codex-filter" value={q} placeholder={'Filter ' + title.toLowerCase()} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <ul>
          {shown.map((e) => {
            const waiting = type === 'character' ? ideasAbout(index, book, e.name).filter((i) => pileOf(i.data) === 'decide' || pileOf(i.data) === 'later').length : 0;
            const line = String(e.note.data.summary || e.note.data.role || e.note.data.kind || '');
            return (
              <li key={e.note.path}>
                <button type="button" class="codex-item" aria-current={e.note.path === open ? 'true' : undefined} onClick={() => { setOpen(e.note.path); setPicked(true); }}>
                  <span class="codex-dot" style={{ background: e.color }} aria-hidden="true" />
                  <span class="codex-text"><span class="codex-name">{e.name}</span>{line && <span class="codex-line">{line}</span>}</span>
                  {waiting > 0 && <span class="pill pill-plain">{waiting} to decide</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div class="codex-detail">
        <button type="button" class="codex-back" onClick={() => setPicked(false)}><Icon name="left" size={18} /> All {title.toLowerCase()}</button>
        {open && index.notes[open] ? <NoteView schema={schema} index={index} path={open} /> : <p class="empty">Pick one on the left.</p>}
        {open && <p class="meta"><a href={href.note(open)}>Open the full page</a></p>}
      </div>
    </section>
  );
}
