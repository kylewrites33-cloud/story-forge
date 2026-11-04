// The Writer's rewrite beside the page (Kyle, 2026-11-04: "i need a whole rewrite of the book in the chamber on the
// right side at all times to pull from ... so i can easily bring in changes to each paragraph where necessary"). The
// column shows the rewrite paragraph by paragraph, each lined up with Kyle's own, and Bring over puts one in place of
// his. His page is the only thing that changes; the rewrite file is read only.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { align, bringOver, paragraphs, rowAt, takeOut, type Row } from '../lib/rewrite.ts';
import { splitLead } from '../lib/drafts.ts';
import { makeNote } from '../lib/vault-index.ts';
import type { FileEntry, VaultSource } from '../lib/types.ts';
import { Quote } from './Changes.tsx';
import { Icon } from './Icon.tsx';
import { offlineError } from './EditorPanels.tsx';

export interface Put {
  /** The whole page after the change. */
  text: string;
  /** The characters of the old page the change replaces, and the words that go in their place. */
  at: number; end: number; words: string;
  /** Where the new words sit afterwards. */
  to: number; toEnd: number;
}

/** The side column's Rewrite tab: the Writer's version of this scene, paragraph by paragraph beside Kyle's. */
export function RewritePanel({ source, file, text, caret, chapter, onPut, onGo }: {
  source: VaultSource;
  /** The scene's copy in `Drafts/Rewrite/`, or null when the Writer has not rewritten it yet. */
  file: FileEntry | null;
  /** Kyle's page as it stands. */
  text: string;
  /** Where his cursor is, so the column follows the page. */
  caret: number | null;
  chapter: number | null;
  onPut: (p: Put) => void;
  /** Show these characters of the page (a tap on a paragraph in the column). */
  onGo: (at: number, end: number) => void;
}) {
  const [theirs, setTheirs] = useState<{ key: string; text: string | null; error?: string }>({ key: '', text: null });
  const key = file ? file.path + '@' + file.sha : '';
  useEffect(() => {
    if (!file) return;
    let live = true;
    setTheirs({ key, text: null });
    source.read(file.path, file.sha)
      .then((raw) => { if (live) setTheirs({ key, text: splitLead(makeNote(file.path, file.sha, raw).body).text }); })
      .catch((e) => { if (live) setTheirs({ key, text: null, error: offlineError(e) ? 'Connect to the internet to see the rewrite of this chapter.' : (e as Error).message }); });
    return () => { live = false; };
  }, [key]);
  const [hideSame, setHideSame] = useState(() => { try { return localStorage.getItem('story-forge.rewrite.hide-same') === '1'; } catch { return false; } });
  const toggleSame = () => { setHideSame(!hideSame); try { localStorage.setItem('story-forge.rewrite.hide-same', hideSame ? '0' : '1'); } catch { /* lasts until reload */ } };

  const mine = useMemo(() => paragraphs(text), [text]);
  const rewrite = theirs.key === key && theirs.text != null ? theirs.text : null;
  const other = useMemo(() => (rewrite == null ? [] : paragraphs(rewrite)), [rewrite]);
  const rows: Row[] = useMemo(() => (rewrite == null ? [] : align(mine.map((p) => p.text), other.map((p) => p.text))), [mine, other]);
  const differ = rows.filter((r) => r.score < 1).length;
  // The row Kyle's cursor is in is marked and brought into view in the column when it changes.
  const cur = caret == null ? -1 : rowAt(rows, mine, caret);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (cur < 0 || !list.current) return;
    const el = list.current.querySelector<HTMLElement>('[data-row="' + cur + '"]');
    if (!el) return;
    const box = list.current.closest('.writer-right') || list.current;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) el.scrollIntoView({ block: 'nearest' });
  }, [cur]);

  if (!file) {
    return (
      <div class="writer-panel rewrite-panel">
        <p class="hint">The Writer has not rewritten {chapter != null ? 'chapter ' + chapter : 'this scene'} yet. When it has, its version sits here, paragraph by paragraph beside yours, and Bring over puts a paragraph in place of yours.</p>
      </div>
    );
  }
  if (theirs.key === key && theirs.error) return <div class="writer-panel rewrite-panel"><p class="error" role="status">{theirs.error}</p></div>;
  if (rewrite == null) return <div class="writer-panel rewrite-panel"><p class="hint">Reading the rewrite…</p></div>;

  const put = (index: number) => {
    const row = rows[index];
    if (row.theirs == null) return;
    const words = other[row.theirs].text;
    const r = bringOver(text, mine, rows, index, words);
    if (row.mine != null) { const p = mine[row.mine]; onPut({ text: r.text, at: p.at, end: p.end, words, to: r.at, toEnd: r.end }); return; }
    // A paragraph put in: the old page's characters it replaces are none, at the spot where it now begins.
    const lead = r.at === 0 ? words + '\n\n' : '\n\n' + words;
    const at = r.at === 0 ? 0 : r.at - 2;
    onPut({ text: r.text, at, end: at, words: lead, to: r.at, toEnd: r.end });
  };
  const cut = (index: number) => {
    const row = rows[index];
    if (row.mine == null) return;
    const p = mine[row.mine];
    const next = takeOut(text, p);
    // Take the paragraph and the blank line before it (or after it, at the start).
    const at = p.at > 0 ? text.slice(0, p.at).replace(/\s+$/, '').length : 0;
    const end = p.at > 0 ? p.end : Math.min(text.length, p.end + (text.slice(p.end).match(/^\s*/) || [''])[0].length);
    onPut({ text: next, at, end, words: '', to: at, toEnd: at });
  };

  return (
    <div class="writer-panel rewrite-panel changes-panel">
      <p class="hint rewrite-head">
        The Writer's rewrite{chapter != null ? ' of chapter ' + chapter : ''}: {differ ? (differ === 1 ? '1 paragraph differs' : differ + ' paragraphs differ') + ' from yours' : 'the same as your page'}.
        {' '}New words are darker. Tap a paragraph to see yours on the page; Bring over puts it in place of yours (Undo takes it back).
      </p>
      {rows.some((r) => r.score === 1) && (
        <label class="rewrite-same-toggle"><input type="checkbox" checked={hideSame} onChange={toggleSame} /> Hide paragraphs that match yours</label>
      )}
      <div class="rewrite-rows" ref={list}>
        {rows.map((row, k) => {
          const same = row.score === 1;
          if (same && hideSame) return <div key={k} data-row={k} class={'rewrite-row same folded' + (k === cur ? ' on' : '')} aria-label="Same as yours" />;
          const words = row.theirs != null ? other[row.theirs].text : '';
          const go = () => { if (row.mine != null) { const p = mine[row.mine]; onGo(p.at, p.end); } };
          return (
            <div key={k} data-row={k} class={'rewrite-row' + (same ? ' same' : '') + (k === cur ? ' on' : '') + (row.mine == null ? ' added' : '') + (row.theirs == null ? ' cut' : '')}>
              {row.theirs == null ? (
                <>
                  <span class="panel-key">The Writer left this out</span>
                  <Quote text={mine[row.mine!].text} cls="was-soft" />
                  <div class="buttons"><button type="button" onClick={go}>Show mine</button><button type="button" onClick={() => cut(k)}>Take it out</button></div>
                </>
              ) : (
                <>
                  {row.mine == null && <span class="panel-key">Added by the Writer</span>}
                  {same && <span class="panel-key">Same as yours</span>}
                  <div class="rewrite-words" role={row.mine != null ? 'button' : undefined} tabIndex={row.mine != null ? 0 : undefined} onClick={go}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}>
                    <Quote text={words} cls={same ? 'same' : 'now'} was={row.mine != null && !same ? mine[row.mine].text : undefined} />
                  </div>
                  {!same && <div class="buttons"><button type="button" class="primary" onClick={() => put(k)}><Icon name="left" size={16} />{row.mine == null ? 'Put it in' : 'Bring over'}</button></div>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
