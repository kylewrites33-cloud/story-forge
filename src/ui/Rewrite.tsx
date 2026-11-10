// The Writer's rewrite beside the page (Kyle, 2026-11-04: "i need a whole rewrite of the book in the chamber on the
// right side at all times to pull from ... so i can easily bring in changes to each paragraph where necessary"). The
// column shows the rewrite paragraph by paragraph, each lined up with Kyle's own, and Bring over puts one in place of
// his. His page is the only thing that changes; the rewrite file is read only.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { align, bringOver, findSpot, paragraphs, rowAt, span, takeOut, theirWords, type Row, type Spot } from '../lib/rewrite.ts';
import { wordDiff } from '../lib/changes.ts';
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

/** Where Kyle left off in draft 2 of a book, kept on this device (Kyle, 2026-11-06: "so we can sort of quickly get a
 * glance at where we're supposed to be when I open it up again on a new session"). */
export function loadLeftOff(book: string): Spot | null {
  try { const raw = localStorage.getItem('story-forge.rewrite-left-off.' + book); const s = raw ? JSON.parse(raw) : null; return s && typeof s.path === 'string' && typeof s.head === 'string' && typeof s.index === 'number' ? s : null; } catch { return null; }
}
export function saveLeftOff(book: string, spot: Spot) {
  try { localStorage.setItem('story-forge.rewrite-left-off.' + book, JSON.stringify(spot)); } catch { /* lasts until reload */ }
}

/** Kyle's tweaks to the Writer's paragraphs before he brings them over (Kyle, 2026-11-05: "can i put my cursor in there
 * on the right and adjust it before i move it over?"), kept per rewrite file until the browser tab closes. */
function loadEdits(key: string): Record<number, string> {
  try { const raw = sessionStorage.getItem('story-forge.rewrite-edits.' + key); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveEdits(key: string, edits: Record<number, string>) {
  try {
    if (Object.keys(edits).length) sessionStorage.setItem('story-forge.rewrite-edits.' + key, JSON.stringify(edits));
    else sessionStorage.removeItem('story-forge.rewrite-edits.' + key);
  } catch { /* lasts while the tab is open */ }
}

/** One of the Writer's paragraphs as a box Kyle can type in straight away (no button): the words he can already see on
 * his page stay greyer behind the text, the Writer's new words and his own typing darker. */
function RewriteBox({ was, words, onInput, onFocus, onBlur }: { was?: string; words: string; onInput: (w: string) => void; onFocus: (top: number) => void; onBlur: () => void }) {
  const back = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const parts = was == null ? [{ kind: 'ins', text: words }] : wordDiff(was, words).filter((d) => d.kind !== 'del');
  // The box grows with its words, so the whole paragraph shows and the column scrolls, never the box.
  useEffect(() => { const el = box.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }, [words]);
  return (
    <div class="chg-tweak-wrap rewrite-box">
      <div class="chg-tweak chg-tweak-back" ref={back} aria-hidden="true">
        {parts.map((d) => d.kind === 'ins' ? <span class="chg-new">{d.text}</span> : d.text)}{'\n'}
      </div>
      <textarea ref={box} class="chg-tweak" rows={2} value={words} aria-label="The Writer's paragraph; change it here before you bring it over"
        onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)} onFocus={(e) => onFocus((e.currentTarget as HTMLElement).getBoundingClientRect().top)} onBlur={onBlur}
        onScroll={(e) => { if (back.current) back.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop; }} />
    </div>
  );
}

/** One scene of the chapter in the Rewrite column: Kyle's page, its rewrite copy, and how to change the page. The
 * whole chapter shows when the page does (Kyle, 2026-11-05: "for chapter 2, i dont see anything rewritten after the
 * first scene divider"). */
export interface RewriteSection {
  key: string;
  /** The scene's name, shown over its rows when the chapter has more than one scene. */
  label: string | null;
  /** The scene's copy in `Drafts/Rewrite/`, or null when the Writer has not rewritten it yet. */
  file: FileEntry | null;
  /** Kyle's page as it stands. */
  text: string;
  /** Kyle's page this moment, read at the time of a Bring over or Take it out, so a change always lands on the words he
   * sees even when he typed in this scene since the column last drew (Kyle, 2026-11-06: a paragraph landed inside
   * Poppy's line). */
  read: () => string;
  /** Where his cursor is, so the column follows the page; null when it is not in this scene. */
  caret: number | null;
  /** Where Kyle left off, when it is in this scene: a small arrow under that row. */
  spot?: Spot | null;
  onPut: (p: Put) => void;
  /** Show these characters of the page (a tap on a paragraph in the column). */
  onGo: (at: number, end: number) => void;
  /** Light these characters of the page without taking the cursor (Kyle's cursor is in the column), and line them up
   * with the box he tapped, whose top is at `top` on the screen. */
  onShow: (at: number, end: number, top?: number) => void;
  /** Take the light off the page (the cursor left the column's box). */
  onHide: () => void;
  /** Where a spot of this scene's page sits on the screen, so the column can follow the page as Kyle scrolls it. */
  rectAt?: (at: number) => DOMRect | null;
}

// ---- The page is the boss (Kyle, 2026-11-10: "i think we want the center text screen to be the boss. so whatever
// paragraph is in the middle of the screen, we want the right-side paragraphs to track with it (probably as soon as the
// scroll stops). then, if i happen to scroll the right side paragraphs, the left side stays put unless i tap a right side
// paragraph. and then the right will stay put until i move the left again"). A moment after Kyle's own scrolling of the
// page stops, the row of the paragraph in the middle of the page comes level with that paragraph. Each scene of the
// chapter offers its paragraph and the one nearest the middle wins. Scrolling the column never moves the page. Tapping a
// box moves the page to it, and that move is hushed so the column stays where Kyle left it.
type Follower = () => { off: number; go: () => void } | null;
const followers = new Set<Follower>();
let followTimer = 0;
let quietUntil = 0;
/** The page is about to move because Kyle tapped a box: the column does not follow that move. */
function hush() { quietUntil = Date.now() + 600; clearTimeout(followTimer); }
function pageScrolled(e: Event) {
  const from = e.target;
  if (!(from instanceof Element) || !from.classList.contains('writer-page')) return;
  clearTimeout(followTimer);
  if (Date.now() < quietUntil) return;
  followTimer = window.setTimeout(() => {
    let best: { off: number; go: () => void } | null = null;
    for (const f of followers) { const c = f(); if (c && (!best || c.off < best.off)) best = c; }
    if (best) best.go();
  }, 200);
}
function follow(f: Follower): () => void {
  if (!followers.size && typeof document !== 'undefined') document.addEventListener('scroll', pageScrolled, true);
  followers.add(f);
  return () => {
    followers.delete(f);
    if (!followers.size && typeof document !== 'undefined') { document.removeEventListener('scroll', pageScrolled, true); clearTimeout(followTimer); }
  };
}

/** The side column's Rewrite tab: the Writer's version of this chapter, scene by scene and paragraph by paragraph beside Kyle's. */
export function RewritePanel({ source, sections, chapter, through = false, openCards = 0, onThrough }: {
  source: VaultSource;
  sections: RewriteSection[];
  chapter: number | null;
  /** Kyle has finished this chapter in the Rewrite tab. */
  through?: boolean;
  /** The chapter's changes still open, which Done with this chapter closes as handled by the rewrite. */
  openCards?: number;
  /** Done with this chapter (or open it again): marks it in the book note and says what else happened. */
  onThrough?: (done: boolean) => Promise<string | null>;
}) {
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const mark = async (done: boolean) => {
    if (!onThrough || busy) return;
    setBusy(true);
    setSaid(null);
    try { const m = await onThrough(done); setSaid(m ? { error: !/saved|through/i.test(m), text: m } : null); } catch (e) { setSaid({ error: true, text: (e as Error).message }); }
    setBusy(false);
  };
  const [hideSame, setHideSame] = useState(() => { try { return localStorage.getItem('story-forge.rewrite.hide-same') === '1'; } catch { return false; } });
  const toggleSame = () => { setHideSame(!hideSame); try { localStorage.setItem('story-forge.rewrite.hide-same', hideSame ? '0' : '1'); } catch { /* lasts until reload */ } };
  const any = sections.some((x) => x.file);
  if (!any) {
    return (
      <div class="writer-panel rewrite-panel">
        <p class="hint">The Writer has not rewritten {chapter != null ? 'chapter ' + chapter : 'this scene'} yet. When it has, its version sits here, paragraph by paragraph beside yours, and Bring over puts a paragraph in place of yours.</p>
      </div>
    );
  }
  return (
    <div class="writer-panel rewrite-panel changes-panel">
      {through && (
        <p class="hint rewrite-through"><Icon name="check" size={16} /> You are through this chapter.{onThrough && <> <button type="button" class="link" disabled={busy} onClick={() => mark(false)}>Open it again</button></>}</p>
      )}
      {said && <p class={said.error ? 'error' : 'hint'} role="status">{said.text}</p>}
      <label class="rewrite-same-toggle"><input type="checkbox" checked={hideSame} onChange={toggleSame} /> Hide paragraphs that match yours</label>
      {sections.map((x) => <RewriteScene key={x.key} source={source} section={x} hideSame={hideSame} named={sections.length > 1} />)}
      {onThrough && !through && (
        <div class="rewrite-done">
          <button type="button" class="primary" disabled={busy} onClick={() => mark(true)}><Icon name="check" size={16} />Done with this chapter</button>
          <p class="hint">{chapter != null ? 'Chapter ' + chapter : 'This chapter'} counts as through on Edit &gt; Changes{openCards ? ', and its ' + (openCards === 1 ? 'one open change closes' : openCards + ' open changes close') + ' as handled by the rewrite' : ''}. When the last chapter is through, Draft 2 is saved by itself.</p>
        </div>
      )}
    </div>
  );
}

/** The small arrow under the paragraph where Kyle left off. */
function LeftOff() {
  return <span class="left-off-mark" role="img" aria-label="You left off here" title="You left off here"><Icon name="down" size={16} /></span>;
}

/** One scene's rewrite, paragraph by paragraph beside Kyle's. */
function RewriteScene({ source, section, hideSame, named }: { source: VaultSource; section: RewriteSection; hideSame: boolean; named: boolean }) {
  const { file, text, caret, onPut, onGo, onShow, onHide, read, spot } = section;
  useEffect(() => () => onHide(), []);
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

  const mine = useMemo(() => paragraphs(text), [text]);
  const rewrite = theirs.key === key && theirs.text != null ? theirs.text : null;
  const other = useMemo(() => (rewrite == null ? [] : paragraphs(rewrite)), [rewrite]);
  const rows: Row[] = useMemo(() => (rewrite == null ? [] : align(mine.map((p) => p.text), other.map((p) => p.text))), [mine, other]);
  const differ = rows.filter((r) => r.score < 1).length;
  // Kyle's tweaks, by the rewrite's paragraph index; they survive a change of tab and a reload of the page.
  const [edits, setEdits] = useState<Record<number, string>>(() => loadEdits(key));
  useEffect(() => { setEdits(loadEdits(key)); }, [key]);
  const plain = (row: Row) => theirWords(other.map((p) => p.text), row);
  const edit = (row: Row, w: string) => { const j = row.theirs!; const next = { ...edits, [j]: w }; if (w === plain(row)) delete next[j]; setEdits(next); saveEdits(key, next); };
  const unedit = (j: number) => { const next = { ...edits }; delete next[j]; setEdits(next); saveEdits(key, next); };
  /** The Writer's paragraph as it stands: with Kyle's tweak when he made one. */
  const wordsOf = (row: Row) => (row.theirs != null && edits[row.theirs] != null ? edits[row.theirs] : plain(row));
  // The row Kyle's cursor is in is marked and brought into view in the column when it changes.
  const cur = caret == null ? -1 : rowAt(rows, mine, caret);
  // The row where Kyle left off: the one that holds his paragraph there.
  const leftAt = useMemo(() => {
    if (!spot) return -1;
    const p = findSpot(text, spot);
    if (!p) return -1;
    const i = mine.findIndex((q) => q.at === p.at);
    return rows.findIndex((r) => r.mine != null && r.mine <= i && i <= (r.mineEnd ?? r.mine));
  }, [spot, text, rows]);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (cur < 0 || !list.current) return;
    const el = list.current.querySelector<HTMLElement>('[data-row="' + cur + '"]');
    if (!el) return;
    const box = list.current.closest('.writer-right') || list.current;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    // Out of sight: bring it to the middle of the column, so the rows around it show too.
    if (r.top >= b.top && r.bottom <= b.bottom) return;
    // Scroll the column only, never the page around it.
    if (box.scrollHeight > box.clientHeight) box.scrollTop += r.top - b.top - Math.max(0, (b.height - r.height) / 2);
    else el.scrollIntoView({ block: 'center' });
  }, [cur, caret]);
  // As Kyle scrolls the page: his paragraph nearest the middle of the page, and how to bring its row level with it.
  const latest = useRef({ rows, mine, rectAt: section.rectAt });
  latest.current = { rows, mine, rectAt: section.rectAt };
  useEffect(() => follow(() => {
    const { rows, mine, rectAt } = latest.current;
    const page = document.querySelector('.writer-page');
    if (!rectAt || !list.current || !page) return null;
    const pb = page.getBoundingClientRect();
    const mid = pb.top + pb.height / 2;
    let best: { off: number; k: number; top: number } | null = null;
    for (let k = 0; k < rows.length; k++) {
      const row = rows[k];
      if (row.mine == null) continue;
      const p0 = mine[row.mine];
      // One character in, so the top is on the paragraph's first line and not the blank line before it.
      const a = rectAt(Math.min(p0.at + 1, p0.end)), z = rectAt(mine[row.mineEnd ?? row.mine].end);
      if (!a || !z) continue;
      const off = mid < a.top ? a.top - mid : mid > z.bottom ? mid - z.bottom : 0;
      if (!best || off < best.off) best = { off, k, top: a.top };
      if (a.top > mid) break;
    }
    if (!best) return null;
    const { off, k, top } = best;
    return {
      off,
      go: () => {
        const el = list.current && list.current.querySelector<HTMLElement>('[data-row="' + k + '"]');
        const box = list.current && list.current.closest('.writer-right');
        if (!el || !box || box.scrollHeight <= box.clientHeight) return;
        const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
        // Level with the paragraph, kept inside the column.
        const want = Math.min(Math.max(top, b.top + 12), b.top + b.height - Math.min(r.height, b.height / 2) - 12);
        box.scrollTop += r.top - want;
      }
    };
  }), []);
  // Opening the column: bring the row where Kyle left off into the middle, once, unless his cursor is already here.
  const placed = useRef(false);
  useEffect(() => {
    if (placed.current || leftAt < 0 || cur >= 0 || !list.current) return;
    const el = list.current.querySelector<HTMLElement>('[data-row="' + leftAt + '"]');
    if (!el) return;
    placed.current = true;
    const box = list.current.closest('.writer-right') || list.current;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top >= b.top && r.bottom <= b.bottom) return;
    if (box.scrollHeight > box.clientHeight) box.scrollTop += r.top - b.top - Math.max(0, (b.height - r.height) / 2);
  }, [leftAt, rows]);

  const name = named && section.label ? <p class="rewrite-scene-name">{section.label}</p> : null;
  if (!file) return <div class="rewrite-scene">{name}<p class="hint">The Writer has not rewritten this scene yet.</p></div>;
  if (theirs.key === key && theirs.error) return <div class="rewrite-scene">{name}<p class="error" role="status">{theirs.error}</p></div>;
  if (rewrite == null) return <div class="rewrite-scene">{name}<p class="hint">Reading the rewrite…</p></div>;

  /** The page, its paragraphs and the rows this moment: the drawn ones when the page is as drawn, else lined up again. */
  const now = () => {
    const t = read();
    if (t === text) return { text, mine, rows };
    const m = paragraphs(t);
    return { text: t, mine: m, rows: align(m.map((p) => p.text), other.map((p) => p.text)) };
  };
  const put = (index: number) => {
    const drawn = rows[index];
    if (drawn.theirs == null) return;
    const words = wordsOf(drawn).replace(/\s+$/, '');
    if (!words.trim()) return;
    const f = now();
    const at = f.rows.findIndex((r) => r.theirs === drawn.theirs);
    if (at < 0) return;
    const row = f.rows[at];
    const r = bringOver(f.text, f.mine, f.rows, at, words);
    if (row.mine != null) { const p = span(f.mine, row)!; onPut({ text: r.text, at: p.at, end: p.end, words, to: r.at, toEnd: r.end }); return; }
    // A paragraph put in: the old page's characters it replaces are none, at the spot where it now begins.
    const lead = r.at === 0 ? words + '\n\n' : '\n\n' + words;
    const from = r.at === 0 ? 0 : r.at - 2;
    onPut({ text: r.text, at: from, end: from, words: lead, to: r.at, toEnd: r.end });
  };
  const cut = (index: number) => {
    const drawn = rows[index];
    if (drawn.mine == null) return;
    const was = mine[drawn.mine].text;
    const f = now();
    // His paragraph as it stands now; if he has changed it since, nothing is taken.
    const p = f.mine.find((q) => q.text === was);
    if (!p) return;
    const next = takeOut(f.text, p);
    // Take the paragraph and the blank line before it (or after it, at the start).
    const at = p.at > 0 ? f.text.slice(0, p.at).replace(/\s+$/, '').length : 0;
    const end = p.at > 0 ? p.end : Math.min(f.text.length, p.end + (f.text.slice(p.end).match(/^\s*/) || [''])[0].length);
    onPut({ text: next, at, end, words: '', to: at, toEnd: at });
  };
  /** Where a row's words of Kyle's sit on the page this moment. */
  const where = (row: Row) => {
    const s = span(mine, row);
    if (!s) return null;
    const f = now();
    if (f.text === text) return s;
    const k = f.text.indexOf(s.text);
    return k < 0 ? null : { at: k, end: k + s.text.length };
  };

  return (
    <div class="rewrite-scene">
      {name}
      <p class="hint rewrite-count">{differ ? (differ === 1 ? '1 paragraph differs' : differ + ' paragraphs differ') + ' from yours' : 'The same as your page'}.</p>
      <div class="rewrite-rows" ref={list}>
        {rows.map((row, k) => {
          const same = row.score === 1;
          if (same && hideSame && k !== cur) return <div key={k} data-row={k} class={'rewrite-row same folded' + (k === cur ? ' on' : '') + (k === leftAt ? ' left-off' : '')} aria-label="Same as yours">{k === leftAt && <LeftOff />}</div>;
          const words = row.theirs != null ? wordsOf(row) : '';
          const edited = row.theirs != null && edits[row.theirs] != null;
          const go = () => { const p = where(row); if (p) onGo(p.at, p.end); };
          const show = (top: number) => { const p = where(row); if (p) { hush(); onShow(p.at, p.end, top); } };
          return (
            <div key={k} data-row={k} class={'rewrite-row' + (same ? ' same' : '') + (k === cur ? ' on' : '') + (k === leftAt ? ' left-off' : '') + (row.mine == null ? ' added' : '') + (row.theirs == null ? ' cut' : '')}>
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
                  {edited && <span class="panel-key">Changed by you</span>}
                  {same ? (
                    <div class="rewrite-words" role="button" tabIndex={0} onClick={go}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}>
                      <Quote text={words} cls="same" />
                    </div>
                  ) : (
                    <RewriteBox words={words} was={row.mine != null ? span(mine, row)!.text : undefined} onInput={(w) => edit(row, w)} onFocus={show} onBlur={onHide} />
                  )}
                  {!same && (
                    <div class="buttons">
                      <button type="button" class="primary" onClick={() => put(k)}><Icon name="left" size={16} />{row.mine == null ? 'Put it in' : 'Bring over'}</button>
                      {edited && <button type="button" onClick={() => unedit(row.theirs!)}>Back to the Writer's words</button>}
                    </div>
                  )}
                </>
              )}
              {k === leftAt && <LeftOff />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
