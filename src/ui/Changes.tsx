// The team's changes on Kyle's page, as Word shows track changes (Workflow 1.2, step 41; Kyle, 2026-10-24). Four views,
// as in Word: All changes (old words struck through, new words underlined), Simple (the page as it would read, with a bar
// beside each changed paragraph), Final (the page as it would read, no marks) and Original (his own page, where he types).
// Each change has a card in the side column with its reason and Keep, No, the other version or Edit it myself.
import type { Change, ChangeStatus, Placed } from '../lib/changes.ts';
import type { BookEntry } from '../lib/types.ts';
import { KIND_LABEL, segments, shortLabel, swapsOf, wordDiff } from '../lib/changes.ts';
import { styledHtml, type StyleOptions } from '../lib/styled.ts';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.tsx';
import { href } from './route.ts';

export type ChangesView = 'all' | 'simple' | 'final' | 'original';
export const VIEWS: [ChangesView, string][] = [['all', 'All changes'], ['simple', 'Simple'], ['final', 'Final'], ['original', 'Self-Edit']];
const VIEW_KEY = 'story-forge.changes-view';
export function loadView(): ChangesView {
  try { const v = localStorage.getItem(VIEW_KEY) as ChangesView | null; return v && VIEWS.some(([k]) => k === v) ? v : 'all'; } catch { return 'all'; }
}
export function saveView(v: ChangesView) { try { localStorage.setItem(VIEW_KEY, v); } catch { /* lasts until reload */ } }

type Piece = { text: string; cls: '' | 'del' | 'ins' | 'tag'; id: string };

/** The page's lines, each a list of pieces: Kyle's words, and for each change its old words, its new words or both. */
function linesOf(text: string, placed: Placed[], view: ChangesView): Piece[][] {
  const lines: Piece[][] = [[]];
  const add = (t: string, cls: Piece['cls'], id: string) => {
    t.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, cls, id });
      else if (id && i === 0) lines[lines.length - 1].push({ text: '', cls, id });
    });
  };
  segments(text, placed).forEach((s) => {
    if (s.kind === 'same') { add(s.text, '', ''); return; }
    const id = s.change.id;
    // A few words in the margin say what the change is; only the words that differ are marked (Kyle, 2026-10-28).
    if (view !== 'final') lines[lines.length - 1].push({ text: shortLabel(s.change), cls: 'tag', id });
    // A struck-out line break shows nothing, and on a book page it would only split a line in two.
    if (view === 'all') wordDiff(s.was, s.now).forEach((d) => { if (!(d.kind === 'del' && !d.text.trim())) add(d.text, d.kind === 'same' ? '' : d.kind, id); });
    else add(s.now, view === 'simple' ? 'ins' : '', view === 'simple' ? id : '');
  });
  return lines;
}

const escAttr = (s: string) => s.replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c] as string));

// A change that only adds or moves italics cuts a *thought* in pieces, so each piece alone shows raw stars (Kyle,
// 2026-10-28). Such a line is drawn by carrying the italic and bold state across its pieces: Kyle's words and the new
// words follow the new text's state, the struck words the old text's.
type Marks = { i: boolean; b: boolean };
const loneStars = (t: string) => (t.replace(/\*\*/g, '').match(/\*/g) || []).length % 2 === 1 || (t.match(/\*\*/g) || []).length % 2 === 1;
const htmlEsc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
function markHtml(text: string, st: Marks): string {
  return text.split(/(\*\*|\*)/).map((part) => {
    if (part === '**') { st.b = !st.b; return ''; }
    if (part === '*') { st.i = !st.i; return ''; }
    if (!part) return '';
    let h = htmlEsc(part);
    if (st.i) h = '<em>' + h + '</em>';
    if (st.b) h = '<strong>' + h + '</strong>';
    return h;
  }).join('');
}

/** Kyle's page with the changes marked, for reading. Pressing a change opens its card. */
export function ChangesPage({ text, placed, view, current, onPick, options, label }: {
  text: string; placed: Placed[]; view: ChangesView; current: string | null; onPick: (id: string) => void; options: StyleOptions; label: string;
}) {
  const kinds = new Map(placed.map((p) => [p.change.id, p.change.kind]));
  let prev = '';
  const html = linesOf(text, placed, view).map((line) => {
    let pieces = line;
    // The line as it will read, and whether it is a System screen line: its "> " is taken off the pieces that carry it.
    const reads = (ps: Piece[]) => ps.filter((p) => p.cls !== 'tag' && p.cls !== 'del').map((p) => p.text).join('');
    const full = reads(pieces);
    const before = pieces.filter((p) => p.cls !== 'tag' && p.cls !== 'ins').map((p) => p.text).join('');
    const q = QUOTE.exec(full);
    if (q) {
      let cut = q[0].length;
      pieces = pieces.map((p) => {
        if (!cut || p.cls === 'tag' || p.cls === 'del') return p;
        const n = Math.min(cut, p.text.length);
        cut -= n;
        return { ...p, text: p.text.slice(n) };
      });
    }
    const rest = q ? full.slice(q[0].length) : full;
    const kind = q ? (rest.trim() ? 'q' : 'gap') : full.trim() || before.trim() ? 'p' : 'blank';
    const lineCls = kind === 'blank' ? (pieces.some((p) => p.cls === 'tag') ? ' bk-blank-tag' : ' bk-blank')
      : kind === 'gap' ? ' bk-gap' : kind === 'q' ? ' bk-q' + (TITLE.test(rest.trim()) ? ' bk-qt' : '') + (prev === 'p' || prev === '' ? ' bk-qstart' : '')
      : ' bk-p' + (prev === 'q' || prev === 'gap' ? ' bk-after' : prev === '' ? ' bk-first' : '');
    if (kind !== 'blank') prev = kind;
    const ids = pieces.filter((p) => p.id).map((p) => p.id);
    // Margin notes go first in the line so they float level with its top.
    pieces = pieces.filter((p) => p.cls === 'tag').concat(pieces.filter((p) => p.cls !== 'tag'));
    const carry = pieces.some((p) => p.cls !== 'tag' && loneStars(p.text));
    const now: Marks = { i: false, b: false };
    const was: Marks = { i: false, b: false };
    const inner = pieces.map((p) => {
      if (p.cls === 'tag') return '<span class="chg-tag' + (p.id === current ? ' on' : '') + '" data-chg="' + escAttr(p.id) + '">' + escAttr(p.text) + '</span>';
      let words = '';
      if (!carry) words = p.text ? styledHtml(p.text, options) : '';
      else if (p.cls === 'del') words = markHtml(p.text, was);
      else if (p.cls === 'ins') words = markHtml(p.text, now);
      else { markHtml(p.text, was); words = markHtml(p.text, now); }
      if (!p.id) return words;
      const tag = p.cls === 'del' ? 'del' : p.cls === 'ins' ? 'ins' : 'span';
      const cls = 'chg chg-' + (kinds.get(p.id) || 'line') + (p.id === current ? ' on' : '') + (view === 'simple' ? ' simple' : '');
      return '<' + tag + ' class="' + cls + '" data-chg="' + escAttr(p.id) + '">' + (words || (p.cls === 'del' ? '' : '')) + '</' + tag + '>';
    }).join('');
    const marked = ids.length > 0 && view !== 'final';
    return '<div class="chg-line' + lineCls + (marked ? ' has-chg' : '') + (marked && ids.indexOf(current || '') >= 0 ? ' on' : '') + '">' + (inner || '<br>') + '</div>';
  }).join('');
  return (
    <div class={'writer-text styled changes-page book view-' + view} role="document" aria-label={label}
      onClick={(e) => {
        const el = (e.target as HTMLElement).closest('[data-chg]') as HTMLElement | null;
        if (el && el.dataset.chg) onPick(el.dataset.chg);
      }}
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** The bar over the page while the chapter has changes: the four views, where Kyle is and the arrows. Accept all is in
 * the side column with the cards (Kyle, 2026-10-28: "in the right section would be where the accept or accept all buttons would be"). */
export function ChangesBar({ view, onView, open, total, place, onPrev, onNext }: {
  view: ChangesView; onView: (v: ChangesView) => void;
  /** Changes waiting in this scene, and in the whole book. */
  open: number; total: number;
  /** "3 of 12" when a change is picked. */
  place: string;
  onPrev: (() => void) | null; onNext: (() => void) | null;
}) {
  return (
    <div class="changes-bar" role="toolbar" aria-label="The team's changes">
      <div class="view-seg" role="group" aria-label="How to show the changes">
        {VIEWS.map(([k, name]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => onView(k)}>{name}</button>)}
      </div>
      <span class="changes-count">
        {open ? (place || open + (open === 1 ? ' change' : ' changes') + ' here') : 'No changes left here'}
        {total > open ? <span class="meta"> · {total} in the book</span> : null}
      </span>
      <span class="changes-go">
        <button type="button" class="icon-button" aria-label="Previous change" title="Previous change" disabled={!onPrev} onClick={() => onPrev && onPrev()}><Icon name="up" /></button>
        <button type="button" class="icon-button" aria-label="Next change" title="Next change, into the next chapter at the end" disabled={!onNext} onClick={() => onNext && onNext()}><Icon name="down" /></button>
      </span>
    </div>
  );
}

// Accept and Reject, as in Word (Kyle, 2026-10-28: "keep this change is throwing me off. why not the language accept this change").
const STATUS_SAID: Record<ChangeStatus, string> = { open: '', kept: 'Accepted', other: 'Accepted the other version', no: 'Rejected', mine: 'Your own words' };

// The page as a Kindle shows it (Kyle, 2026-10-28: "when we're in editing mode, the document automatically converts to
// the form that it's going to show up as in Kindle"): paragraphs indented with no blank lines between them, System
// screens (format C1) indented with their "> " marks hidden, a lone ">" a small gap, the bold title in small caps.
const QUOTE = /^\s*> ?/;
const TITLE = /^\*\*[^*].*\*\*$/;
function bookHtml(text: string): string {
  return text.split('\n').map((line) => {
    if (!line.trim()) return '';
    if (!QUOTE.test(line)) return '<div class="bk-p">' + styledHtml(line, {}) + '</div>';
    const rest = line.replace(QUOTE, '');
    if (!rest.trim()) return '<div class="bk-gap"></div>';
    return '<div class="bk-q' + (TITLE.test(rest.trim()) ? ' bk-qt' : '') + '">' + styledHtml(rest, {}) + '</div>';
  }).join('');
}

// Kyle's own words in the team's version show a little greyer than the team's new words, so he can tell them apart
// (Kyle, 2026-10-30: "anything that's my original text to be slightly grayer than your proposed text"). The new words
// are marked with two private characters before the page look is worked out, then turned into spans.
const NEW_ON = '\uE000', NEW_OFF = '\uE001';
function markNew(was: string, now: string): string {
  return wordDiff(was, now).filter((d) => d.kind !== 'del')
    .map((d) => d.kind === 'ins' ? d.text.split('\n').map((t) => t ? NEW_ON + t + NEW_OFF : t).join('\n') : d.text).join('')
    // A mark must not sit in front of a System screen's "> ", or the line would lose its look.
    .split('\n').map((line) => line.replace(/^([\uE000\uE001]+)(\s*> ?)/, '$2$1')).join('\n');
}

function Quote({ text, cls, was }: { text: string; cls: string; /** Draft 1's words, to show which words are new. */ was?: string }) {
  if (!text) return <p class={'chg-quote empty ' + cls}>(cut)</p>;
  const html = was == null ? bookHtml(text) : bookHtml(markNew(was, text)).replace(/\uE000/g, '<span class="chg-new">').replace(/\uE001/g, '</span>');
  return <blockquote class={'chg-quote book ' + cls} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** The edit box over a copy of its words, so Kyle's own words show greyer there too while he types. */
function TweakBox({ id, was, words, onInput }: { id: string; was: string; words: string; onInput: (w: string) => void }) {
  const back = useRef<HTMLDivElement>(null);
  const parts = wordDiff(was, words).filter((d) => d.kind !== 'del');
  return (
    <div class="chg-tweak-wrap">
      <div class="chg-tweak chg-tweak-back" ref={back} aria-hidden="true">
        {parts.map((d) => d.kind === 'ins' ? <span class="chg-new">{d.text}</span> : d.text)}{'\n'}
      </div>
      <textarea id={id} class="chg-tweak" rows={Math.min(14, Math.max(3, Math.ceil(words.length / 34) + words.split('\n').length))} value={words}
        onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)}
        onScroll={(e) => { if (back.current) back.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop; }} />
    </div>
  );
}

/** Scroll the side column (only it, not the page) so this change's card shows, the way Word's margin follows the text. */
export function showCard(id: string, gentle = false) {
  const card = document.querySelector('.changes-panel [data-card="' + id.replace(/"/g, '') + '"]') as HTMLElement | null;
  if (!card) return;
  let box = card.parentElement;
  while (box && !(box.scrollHeight > box.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
  if (!box) return;
  const c = card.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  // Following the page, a card already in sight is left alone, so a long card can be read to its buttons.
  if (gentle && c.bottom > b.top + 40 && c.top < b.bottom - 40) return;
  const top = c.top - b.top + box.scrollTop;
  box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: 'smooth' });
}

/** The side column's Changes tab: one card per change in this scene, waiting ones in page order (like Word's margin), then the ones no longer on the page. */
export function ChangesPanel({ intro, changes, placedIds, current, onAcceptAll, onPick, onChoose, onUndo, onMine, onTweak, editing, onDoneMine, onStopMine, onRevert, onEverywhere, like, chapter, bookOpen, notePath, link, elsewhere = 0, onElsewhere }: {
  intro: string; changes: Change[]; /** The placed changes' ids in page order. */ placedIds: string[]; current: string | null;
  /** Word's Accept All: every waiting change still on the page. */ onAcceptAll: () => void; onPick: (id: string) => void;
  onChoose: (c: Change, status: ChangeStatus) => void; onUndo: (c: Change) => void; onMine: (c: Change) => void;
  /** Kyle's own version of the team's words, edited on the card, goes in as his own words (Kyle, 2026-10-28). */
  onTweak: (c: Change, words: string) => void;
  /** The change Kyle is rewriting himself: its card stays open until he says he is done. */
  editing: string | null; onDoneMine: (c: Change) => void; onStopMine: () => void;
  /** Accept this change's word swaps in every chapter; `like` counts the waiting changes in the book that make them. */
  /** Put the change's Was (Draft 1's words) back in place of what Kyle wrote there; null when there is no Draft 1. */
  onRevert: ((c: Change) => void) | null;
  /** Waiting changes in this chapter's other scenes, which the chapter list counts too. */
  elsewhere?: number;
  /** Open the chapter's next scene that has waiting changes. */
  onElsewhere?: () => void;
  onEverywhere: (c: Change) => void; like: ((pairs: [string, string][]) => number) | null;
  chapter: number | null; bookOpen: number; notePath: string | null; link: (to: string) => Record<string, unknown>;
}) {
  const at = (c: Change) => { const i = placedIds.indexOf(c.id); return i < 0 ? placedIds.length : i; };
  const open = changes.filter((c) => c.status === 'open').sort((a, b) => (b.id === editing ? 1 : 0) - (a.id === editing ? 1 : 0) || at(a) - at(b));
  useEffect(() => { if (current) showCard(current); }, [current]);
  const decided = changes.filter((c) => c.status !== 'open');
  const [tweak, setTweak] = useState<{ id: string; words: string; other: boolean } | null>(null);
  const card = (c: Change) => {
    const here = placedIds.includes(c.id);
    const sw = c.status === 'open' ? swapsOf(c) : null;
    const many = sw && like ? like(sw) : 0;
    return (
      <article key={c.id} data-card={c.id} class={'chg-card chg-' + c.kind + (c.id === current ? ' on' : '') + (c.status !== 'open' ? ' decided' : '')}
        onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a')) onPick(c.id); }}>
        <p class="chg-head"><b>{shortLabel(c)}</b><span class="meta">{shortLabel(c).startsWith(KIND_LABEL[c.kind]) ? '' : KIND_LABEL[c.kind] + ' · '}{c.id}</span></p>
        {c.asked || c.does ? (
          <div class="chg-parts">
            {c.asked && <p class="chg-why"><span class="chg-label">You asked</span>{c.asked}</p>}
            {c.does && <p class="chg-why"><span class="chg-label">The change</span>{c.does}</p>}
            {c.check && <details class="chg-check"><summary>The team's check</summary><p class="chg-why">{c.check}</p></details>}
          </div>
        ) : c.why && <p class="chg-why">{c.why}</p>}
        {c.status === 'open' ? (
          <>
            <Quote text={c.was} cls="was" />
            <Quote text={c.now} cls="now" was={c.was} />
            {c.other != null && <><p class="panel-key">Or the other version</p><Quote text={c.other} cls="now other" was={c.was} /></>}
            {c.id === editing ? (
              <>
                <p class="chg-mine"><Icon name="pen" size={16} />You are writing this one yourself on the page. The team's version stays here while you work.</p>
                <div class="chg-buttons">
                  <button type="button" class="primary" onClick={() => onDoneMine(c)}>Mark my changes as done</button>
                  <button type="button" onClick={onStopMine}>Back to the choices</button>
                </div>
              </>
            ) : tweak && tweak.id === c.id && here ? (
              <>
                <label class="panel-key" for={'tweak-' + c.id}>{c.other != null ? (tweak.other ? 'Your edit of the other version' : 'Your edit of the first version') : 'Your edit of the team\'s words'}</label>
                <TweakBox id={'tweak-' + c.id} was={c.was} words={tweak.words} onInput={(w) => setTweak({ ...tweak, words: w })} />
                <div class="chg-buttons">
                  <button type="button" class="primary" onClick={() => { onTweak(c, tweak.words); setTweak(null); }}>Accept my version</button>
                  <button type="button" onClick={() => setTweak(null)}>Back to the choices</button>
                </div>
              </>
            ) : <>
            {!here ? <>
            <p class="hint">These words are no longer on the page, so there is nothing to show there (you have probably changed them yourself). I wrote my own keeps your words. Back to Draft 1 puts Draft 1's words back in their place.</p>
            <div class="chg-buttons">
              <button type="button" class="primary" onClick={() => onDoneMine(c)}>I wrote my own</button>
              {onRevert ? <button type="button" onClick={() => onRevert(c)}>Back to Draft 1</button> : <button type="button" onClick={() => onChoose(c, 'no')}>Reject</button>}
            </div>
            </> : <div class="chg-buttons">
              <button type="button" class="primary" onClick={() => onChoose(c, 'kept')}>Accept</button>
              {c.other != null && <button type="button" onClick={() => onChoose(c, 'other')}>Accept the other</button>}
              <button type="button" onClick={() => setTweak({ id: c.id, words: c.now, other: false })}>{c.other != null ? 'Edit the first, then accept' : 'Edit, then accept'}</button>
              {c.other != null && <button type="button" onClick={() => setTweak({ id: c.id, words: c.other || '', other: true })}>Edit the other, then accept</button>}
              <button type="button" onClick={() => onChoose(c, 'no')}>Reject</button>
              <button type="button" onClick={() => onMine(c)}>Edit it myself</button>
              {sw && many > 1 && <button type="button" class="chg-everywhere" onClick={() => onEverywhere(c)}>Accept everywhere: {sw.map(([a, b]) => a + ' → ' + b).join(', ')} ({many} in the book)</button>}
            </div>}
            </>}
          </>
        ) : (
          <p class="chg-done"><Icon name="check" size={16} />{STATUS_SAID[c.status]} <button type="button" class="link" onClick={() => onUndo(c)}>Undo</button></p>
        )}
      </article>
    );
  };
  return (
    <div class="panel-body changes-panel">
      {!changes.length ? (
        <p class="hint">The team has no changes for this scene{chapter != null ? ' in chapter ' + chapter : ''}. When the Writer revises a chapter (workflow step 39), its changes show here and on the page, for you to keep or not.{bookOpen ? ' ' + bookOpen + ' changes are waiting elsewhere in the book.' : ''}</p>
      ) : null}
      {!changes.length && elsewhere > 0 ? (
        <button type="button" class="chg-all" onClick={() => onElsewhere && onElsewhere()}>{elsewhere + (elsewhere === 1 ? ' change is' : ' changes are') + ' waiting in this chapter\'s other ' + (elsewhere === 1 ? 'scene' : 'scenes')}: show</button>
      ) : null}
      {!changes.length ? null : (
        <>
          {intro && <p class="chg-intro">{intro}</p>}
          <div class="chg-top">
            <p class="meta">{open.length ? open.length + ' waiting' : 'All decided'}{decided.length ? ' · ' + decided.length + ' decided' : ''}</p>
            {elsewhere > 0 && <button type="button" class="chg-all" onClick={() => onElsewhere && onElsewhere()}>{elsewhere + (elsewhere === 1 ? ' more change' : ' more changes') + ' in this chapter\'s other ' + (elsewhere === 1 ? 'scene' : 'scenes')}: show</button>}
            {placedIds.length > 1 && <button type="button" class="chg-all" onClick={onAcceptAll}><Icon name="check" size={18} />Accept all ({placedIds.length})</button>}
          </div>
          {open.map(card)}
          {decided.length > 0 && (
            <details class="chg-decided">
              <summary>Decided ({decided.length})</summary>
              {decided.map(card)}
            </details>
          )}
        </>
      )}
      {notePath && <p class="meta"><a {...link(href.note(notePath))}>Open the changes note</a></p>}
    </div>
  );
}

/** Which draft the page shows (Kyle, 2026-10-24: draft 1 labelled and kept accessible): the working draft, or a saved
 * one read only. The menu also exports any draft to Word and saves the working draft to start the next. */
export function DraftMenu({ working, saved, viewing, onView, onSave, onExport, canSave }: {
  working: number; saved: number[]; viewing: number | null; onView: (n: number | null) => void;
  onSave: () => Promise<string | null>; onExport: (n: number | null) => Promise<string | null>; canSave: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const run = async (f: () => Promise<string | null>, ok: string) => {
    setBusy(true); setSaid(null);
    const err = await f();
    setBusy(false); setAsking(false);
    setSaid(err ? { error: true, text: err } : { error: false, text: ok });
  };
  const shown = viewing == null ? working : viewing;
  return (
    <div class="more-wrap draft-wrap">
      <button type="button" class={'draft-button' + (viewing != null ? ' old' : '')} aria-expanded={open} onClick={() => { setOpen(!open); setSaid(null); }}
        title="Which draft you are looking at">
        Draft {shown}{viewing != null ? ' · read only' : ''}<Icon name={open ? 'up' : 'down'} size={16} />
      </button>
      {open && (
        <>
          <button type="button" class="more-backdrop" aria-label="Close" tabIndex={-1} onClick={() => setOpen(false)} />
          <div class="more-menu draft-menu" role="menu">
            <button type="button" role="menuitemradio" aria-checked={viewing == null} onClick={() => { onView(null); setOpen(false); }}>
              <Icon name={viewing == null ? 'check' : 'pen'} size={18} /><span>Draft {working} <span class="meta">· the one you write in</span></span>
            </button>
            {saved.slice().reverse().map((n) => (
              <button key={n} type="button" role="menuitemradio" aria-checked={viewing === n} onClick={() => { onView(n); setOpen(false); }}>
                <Icon name={viewing === n ? 'check' : 'archive'} size={18} /><span>Draft {n} <span class="meta">· saved, read only</span></span>
              </button>
            ))}
            <span class="menu-sep" aria-hidden="true" />
            <button type="button" role="menuitem" disabled={busy} onClick={() => run(() => onExport(viewing), 'Made the Word file of Draft ' + shown + '. Look for it in your downloads.')}>
              <Icon name="download" size={18} /><span>Export Draft {shown} to Word</span>
            </button>
            {canSave && !asking && (
              <button type="button" role="menuitem" disabled={busy} onClick={() => setAsking(true)}>
                <Icon name="plus" size={18} /><span>{working === 1 ? 'Save Draft 1 before editing' : 'Save Draft ' + working + ' and start Draft ' + (working + 1)}</span>
              </button>
            )}
            {asking && (
              <div class="draft-ask">
                <p>{working === 1
                  ? 'This keeps a copy of every scene exactly as it is now, labelled Draft 1, that never changes. Your scenes then become Draft 2, where you and the team make the changes.'
                  : 'This keeps a copy of every scene as it is now, labelled Draft ' + working + '. You go on writing in Draft ' + (working + 1) + '.'}</p>
                <div class="buttons">
                  <button type="button" class="primary" disabled={busy} onClick={() => run(onSave, 'Saved Draft ' + working + '. You are now writing Draft ' + (working + 1) + '.')}>{busy ? 'Saving…' : 'Save Draft ' + working}</button>
                  <button type="button" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
                </div>
              </div>
            )}
            {said && <p class={said.error ? 'error' : 'hint'} role="status">{said.text}</p>}
          </div>
        </>
      )}
    </div>
  );
}

/** The Edit room's first page: the story calls waiting, and each chapter with changes from the team to keep or not. */
export function ChangesOverview({ book, chapters, calls, firstScene }: {
  book: BookEntry; chapters: { chapter: number; open: number; path: string }[]; calls: number; firstScene: string | null;
}) {
  const waiting = chapters.filter((c) => c.open > 0);
  const total = waiting.reduce((t, c) => t + c.open, 0);
  const drafts = book.drafts || [];
  return (
    <section class="changes-overview">
      <p class="crumb"><a href={href.board('overview', book.folder)}>{book.title}</a> · Changes</p>
      <h1>Changes</h1>
      <p class="hint">Turning draft 1 into the final draft (workflow steps 35 to 42). The editor's story calls come first; then the Writer revises one chapter at a time, and its changes wait on your page for Keep or No, as track changes do in Word.</p>
      <div class="changes-steps">
        <a class="changes-step" href={href.board('story-calls', book.folder)}>
          <Icon name="cards" size={22} /><span><b>Story calls</b><span class="meta">{calls ? calls + ' waiting for your yes or no' : 'None waiting'}</span></span>
        </a>
        <a class="changes-step" href={waiting.length ? href.write(waiting[0].path) : firstScene ? href.write(firstScene) : href.board('overview', book.folder)}>
          <Icon name="swap" size={22} /><span><b>{waiting.length ? 'Go through the changes' : 'Open the writing screen'}</b><span class="meta">{total ? total + ' changes in ' + waiting.length + (waiting.length === 1 ? ' chapter' : ' chapters') : 'No changes waiting'}</span></span>
        </a>
      </div>
      {chapters.length > 0 && (
        <ul class="changes-chapters">
          {chapters.map((c) => (
            <li key={c.chapter}><a href={href.write(c.path)}><span>Chapter {c.chapter}</span><span class={'meta' + (c.open ? ' waiting' : '')}>{c.open ? c.open + ' waiting' : 'All decided'}</span></a></li>
          ))}
        </ul>
      )}
      <h2>Drafts</h2>
      <p class="hint">{drafts.length
        ? 'Saved: ' + drafts.map((d) => 'Draft ' + d.number).join(', ') + '. Your scenes are Draft ' + (drafts[drafts.length - 1].number + 1) + '. In the writing screen, the Draft button over the page shows a saved draft or exports any draft to Word.'
        : 'Draft 1 is not saved yet. Before the team changes anything, open the writing screen and use the Draft button over the page: Save Draft 1 before editing keeps a copy of every scene that never changes.'}</p>
    </section>
  );
}

/** Ask the Writer to revise this chapter as changes (workflow step 39), from the Changes tab. */
export function AskForChanges({ chapter, onAsk, asking }: { chapter: number | null; onAsk: (() => Promise<{ error: boolean; text: string }>) | null; asking: boolean }) {
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (chapter == null) return null;
  return (
    <div class="ask-changes">
      {asking ? <p class="tool-said ok"><span class="job-dot" aria-hidden="true" /> The Writer is revising chapter {chapter}. Its changes appear here when it is done.</p>
        : onAsk && <button type="button" disabled={busy} onClick={async () => { setBusy(true); setSaid(await onAsk()); setBusy(false); }}>
          <Icon name="spark" size={18} />{busy ? 'Asking…' : 'Ask the Writer for changes on chapter ' + chapter}
        </button>}
      <p class="hint">The Writer reads this chapter, the story calls you said yes to and the Style Guide, and writes its changes for you to keep or not. It never rewrites your page. A paid team job; the Jobs page shows what it cost.</p>
      {said && <p class={said.error ? 'error' : 'hint'} role="status">{said.text}</p>}
    </div>
  );
}
