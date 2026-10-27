// The writing screen's smaller parts: the side column's panels (card, codex, find, beats, marks, notes, history, copies,
// archive, chapter forms, scene, team, page look, word target, to-dos, plan and scrap). Moved out of Editor.tsx (audit, 2026-10-23).
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { beatStart, parseBeats } from '../lib/beats.ts';
import {
  bodyWords, isUnsaved, listSnapshots, loadDrafts, openDraft, putDraft, saveDraft, saveSnapshot, splitLead, withBody, type Draft,
  type SnapshotEntry
} from '../lib/drafts.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { archivedWhy, restoreArchived } from '../lib/scenes.ts';
import { formatValue, isEmptyValue, label as fieldLabel, sceneHeader } from '../lib/format.ts';
import { cardFields, propDef, propertyOrder } from '../lib/schema.ts';
import type { FileEntry, NoteRecord, SaveEntry, Schema, VaultSource } from '../lib/types.ts';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';
import { RecipePicker } from './Recipes.tsx';
import { withRecipe } from '../lib/recipes.ts';
import type { EditorCommands } from './StyledEditor.tsx';
import { LOOK_CHOICES, type PageLook } from '../lib/page.ts';
import { defaultJobTitle, jobAsk, type JobKind, type OnJob } from '../lib/jobs.ts';
import { addToScrap, planHead, planPath, scrapHead, scrapPath } from '../lib/plans.ts';
import { isOpen, type NewTodo } from '../lib/todos.ts';
import type { Decision } from '../lib/ideas.ts';
import type { Choice } from '../lib/write-queue.ts';

type OnTodo = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;

import type { CodexEntry } from '../lib/codex.ts';
import type { CodexNow } from '../lib/codexnow.ts';
import { CodexNowBox } from './CodexNow.tsx';
import { findAll, markList } from '../lib/styled.ts';
import { render } from '../lib/markdown.ts';

const num = (n: number) => n.toLocaleString('en-US');

/** A failed save that only means the connection is down: the words wait on the device. */
export function offlineError(e: unknown): boolean {
  return (e as { status?: number }).status === 0 || !navigator.onLine;
}

/** The scene's card beside the page: its turn, hook and the rest, read only. */
export function CardPanel({ schema, note, status, link, named, onPick, notes, onDrafted }: {
  schema: Schema; note: NoteRecord; status: string; onDrafted: () => void; link: (to: string) => { href: string; onClick: (e: MouseEvent) => void };
  named: { entry: CodexEntry; count: number }[]; onPick: (e: CodexEntry) => void; notes: NoteRecord | null;
}) {
  const rows = cardFields(schema, note.type).filter((k) => k !== 'title' && k !== 'words' && k !== 'status' && !isEmptyValue(note.data[k]));
  return (
    <div class="writer-panel">
      {status && <p class="hint">Status: {status}{!isEmptyValue(note.data.accepted) ? ' · card accepted' : ''}</p>}
      {status === 'planned' && <div class="buttons"><button type="button" onClick={onDrafted}>Mark as drafted</button></div>}
      {rows.length ? rows.map((k) => (
        <div class="panel-card" key={k}>
          <span class="panel-key">{fieldLabel(k)}</span>
          {formatValue(k, note.data[k], propDef(schema, note.type, k))}
        </div>
      )) : <p class="hint">This scene's card is empty.</p>}
      {!isEmptyValue(note.data.decision_note) && isEmptyValue(note.data.accepted) && <p class="reason-shown">Needs work: {String(note.data.decision_note)}</p>}
      {notes && notes.body.trim() && (
        <div class="scene-notes">
          <span class="panel-key">Notes for this scene</span>
          <div class="prose small" dangerouslySetInnerHTML={{ __html: render(notes.body) }} />
          <a class="link" {...link(href.note(notes.path))}>Open these notes</a>
        </div>
      )}
      <a class="button" {...link(href.note(note.path))}>Open the whole note</a>
      {named.length > 0 && (
        <div>
          <span class="panel-key">Named in this scene</span>
          <ul class="named-list">
            {named.map(({ entry, count }) => (
              <li key={entry.name}>
                <button type="button" class="link" onClick={() => onPick(entry)}>
                  <span class="name-dot" style={{ background: entry.color }} />{entry.name}
                </button>
                <span class="meta"> {KIND_WORD[entry.type] || entry.type} · {count === 1 ? 'once' : count + ' times'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const KIND_WORD: Record<string, string> = { character: 'character', place: 'place', item: 'item', lore: 'lore' };
/** What a codex card leaves out: bookkeeping, and things the heading already says. */
const CODEX_QUIET = ['aliases', 'type', 'name', 'status', 'ai', 'created', 'updated', 'tags', 'extends', 'color', 'relationships', 'threads_live'];

/** A character, place or item beside the page, opened by pressing its name in the text. */
export function CodexCard({ schema, entry, link, onBack, now }: {
  schema: Schema; entry: CodexEntry; link: (to: string) => { href: string; onClick: (e: MouseEvent) => void }; onBack: () => void; now?: CodexNow | null;
}) {
  const d = entry.note.data;
  const keys = propertyOrder(schema, entry.note.type, d).filter((k) => CODEX_QUIET.indexOf(k) < 0 && !isEmptyValue(d[k]));
  // The note's first paragraph, without the secret callouts that come after it.
  const intro = entry.note.body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('>') && !p.startsWith('#')) || '';
  return (
    <div class="writer-panel">
      <button type="button" class="link" onClick={onBack}><Icon name="left" size={16} />Back to the scene card</button>
      <h3 class="codex-name"><span class="name-dot" style={{ background: entry.color }} />{entry.name}</h3>
      <p class="hint">{KIND_WORD[entry.type] || entry.type}{entry.terms.length > 1 ? ' · also ' + entry.terms.filter((t) => t !== entry.name).join(', ') : ''}</p>
      {intro && <div class="prose small" dangerouslySetInnerHTML={{ __html: render(intro) }} />}
      {now && <CodexNowBox now={now} />}
      {keys.map((k) => (
        <div class="panel-card" key={k}>
          <span class="panel-key">{fieldLabel(k)}</span>
          {formatValue(k, d[k], propDef(schema, entry.note.type, k))}
        </div>
      ))}
      <a class="button" {...link(href.note(entry.note.path))}>Open the whole note</a>
    </div>
  );
}

/** Find and replace in this scene. Matches are marked on the page; the arrows step through them. */
export function FindBar({ text, query, setQuery, repl, setRepl, hit, setHit, cmd, onClose }: {
  text: string; query: string; setQuery: (q: string) => void; repl: string; setRepl: (r: string) => void;
  hit: number; setHit: (n: number) => void; cmd: () => EditorCommands | null; onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (input.current) { input.current.focus(); input.current.select(); } }, []);
  const found = findAll(text, query);
  const at = found.length ? Math.min(hit, found.length - 1) : -1;
  const go = (n: number) => {
    if (!found.length) return;
    const i = (n + found.length) % found.length;
    setHit(i);
    const c = cmd();
    if (c) c.select(found[i], found[i] + query.length);
  };
  const one = () => {
    const c = cmd();
    if (!c || at < 0) return;
    c.replaceRange(found[at], found[at] + query.length, repl);
  };
  const all = () => {
    const c = cmd();
    if (!c || !found.length) return;
    let out = '', from = 0;
    found.forEach((i) => { out += text.slice(from, i) + repl; from = i + query.length; });
    c.setAll(out + text.slice(from));
  };
  return (
    <div class="find-bar" role="search">
      <div class="find-row">
      <label class="search">
        <Icon name="search" size={18} />
        <span class="visually-hidden">Find</span>
        <input ref={input} type="search" value={query} placeholder="Find in this scene"
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); go(at + (e.shiftKey ? -1 : 1)); } if (e.key === 'Escape') onClose(); }} />
      </label>
      <span class="meta find-count">{query ? (found.length ? (at + 1) + ' of ' + found.length : 'None') : ''}</span>
      <button type="button" class="icon-button" aria-label="Previous" disabled={!found.length} onClick={() => go(at - 1)}><Icon name="up" /></button>
      <button type="button" class="icon-button" aria-label="Next" disabled={!found.length} onClick={() => go(at + 1)}><Icon name="down" /></button>
      <button type="button" class="icon-button" aria-label="Close Find" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div class="find-row">
      <label class="search">
        <span class="visually-hidden">Replace with</span>
        <input type="text" value={repl} placeholder="Replace with" onInput={(e) => setRepl((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <button type="button" disabled={at < 0} onClick={one}>Replace</button>
      <button type="button" disabled={!found.length} onClick={all}>Replace all</button>
      </div>
    </div>
  );
}

/** Highlighter marks in this scene, to jump to. */
/** The chapter's beats as a plain list in the right column (Kyle, 2026-10-21): titles and summaries, no prose.
 * A beat in the open scene jumps the page to where it starts. */
export function BeatsList({ note, chapter, sceneId, text, lastId, onGo, beatsLink }: {
  note: NoteRecord | null; chapter: number | null; sceneId: string; text: string | null; lastId: string;
  onGo: (at: number) => void; beatsLink: Record<string, unknown>;
}) {
  if (chapter == null) return <div class="writer-panel"><p class="hint">Beats belong to a chapter; this scene is not in one.</p></div>;
  const list = note ? parseBeats(note.body) : [];
  if (!list.length) return <div class="writer-panel"><p class="hint">Chapter {chapter} has no beats yet. <a {...beatsLink}>Open Beats</a> to make them.</p></div>;
  return (
    <div class="writer-panel">
      <ol class="beat-list">
        {list.map((b, i) => {
          const here = (b.scene || lastId) === sceneId;
          const at = here && text != null ? beatStart(text, b.words) : -1;
          const name = b.title || 'Untitled beat';
          return (
            <li key={i} class={here ? 'here' : undefined}>
              {at >= 0 ? <button type="button" class="link" onClick={() => onGo(at)}><strong>{name}</strong></button> : <strong>{name}</strong>}
              {b.summary && <span class="hint">{b.summary}</span>}
            </li>
          );
        })}
      </ol>
      {text != null && <p class="hint">Press a beat in this scene to go to where it starts.</p>}
    </div>
  );
}

export function MarksPanel({ text, onGo }: { text: string; onGo: (start: number, end: number) => void }) {
  const list = markList(text);
  return (
    <div class="writer-panel">
      <p class="hint">Select words and press the highlighter in the tool row to mark them to come back to. Select marked words and press it again to take the mark off.</p>
      {list.length ? (
        <ul class="mark-list">
          {list.map((m) => (
            <li key={m.at}><button type="button" class="link" onClick={() => onGo(m.at, m.at + m.text.length + 4)}><mark>{m.text.length > 80 ? m.text.slice(0, 77) + '…' : m.text}</mark></button></li>
          ))}
        </ul>
      ) : <p class="hint">No marks in this scene.</p>}
    </div>
  );
}

/** The book's Braindump beside the page: loose notes, research and reminders, saved to Braindump.md in the book's folder. */
export function NotesPanel({ source, bookFolder, note, canSave, onChanged }: {
  source: VaultSource; bookFolder: string | null; note: NoteRecord | null; canSave: boolean; onChanged: () => Promise<void>;
}) {
  const [text, setText] = useState(note ? note.body.replace(/^\n/, '') : '');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const changedText = text !== (note ? note.body.replace(/^\n/, '') : '');
  if (!bookFolder) return <div class="writer-panel"><p class="hint">Notes belong to a book; this scene is not in one.</p></div>;
  const save = async () => {
    if (!source.write || !source.readFresh) return;
    if (!navigator.onLine) { setSaid({ error: true, text: 'Connect to the internet to save your notes.' }); return; }
    setBusy(true);
    setSaid(null);
    try {
      const path = note ? note.path : bookFolder + '/Braindump.md';
      let sha = '', base = Frontmatter.join({ type: 'braindump' }, '\n');
      try { const f = await source.readFresh(path); sha = f.sha; base = f.text; } catch (e) { if ((e as { status?: number }).status !== 404 && !/has no/.test((e as Error).message)) throw e; }
      const next = withBody(base, '\n' + text.replace(/^\n+/, '').replace(/\s*$/, '\n'));
      await source.write(path, next, sha, 'braindump: notes from the writing screen\n\nWritten in the Sparrow app.');
      await onChanged();
      setSaid({ error: false, text: 'Saved in the book\'s Braindump note.' });
    } catch (e) {
      setSaid({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="writer-panel">
      <label class="reason">
        Notes for this book: research, reminders, loose ideas. They stay beside the page while you write.
        <textarea class="notes-box" rows={14} value={text} onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)} placeholder="Anything you want to keep in view" />
      </label>
      {canSave && <div class="buttons"><button type="button" class="primary" disabled={busy || !changedText} onClick={save}>{busy ? 'Saving…' : 'Save notes'}</button></div>}
      {said && <p class={said.error ? 'error' : 'ok'}>{said.text}</p>}
      <p class="hint">Saved in the book's Braindump note, which the team reads too.</p>
    </div>
  );
}

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** Every save of this scene from the vault's history, newest first, with Go back to this version. */
function HistoryList({ source, note, body, canSave, keep, onUse }: {
  source: VaultSource; note: NoteRecord; body: string; canSave: boolean;
  keep: (text: string, name: string) => Promise<boolean>; onUse: (body: string) => void;
}) {
  const [list, setList] = useState<SaveEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ entry: SaveEntry; body: string } | null>(null);
  const [showing, setShowing] = useState(false);
  if (!source.history || !source.readAt) return null;
  const load = async () => {
    setShowing(true);
    if (!navigator.onLine) { setError('Connect to the internet to see the history.'); return; }
    try { setList(await source.history!(note.path)); setError(null); } catch (e) { setError((e as Error).message); }
  };
  const view = async (entry: SaveEntry) => {
    try { setOpen({ entry, body: Frontmatter.parse(await source.readAt!(note.path, entry.commit)).body }); } catch (e) { setError((e as Error).message); }
  };
  const now = bodyWords(body);
  if (!showing) return <div><span class="panel-key">Every save</span><p class="hint">The vault keeps every save of this scene, yours and the team's.</p><button type="button" onClick={load}><Icon name="history" size={18} />Show every save</button></div>;
  return (
    <div>
      <span class="panel-key">Every save</span>
      {error && <p class="error">{error}</p>}
      {open ? (
        <div class="copy-view">
          <p><strong>{when(open.entry.date)}</strong> · {open.entry.agent ? 'by the ' + open.entry.agent : 'by you'} · {num(bodyWords(open.body))} words ({bodyWords(open.body) - now >= 0 ? '+' : ''}{num(bodyWords(open.body) - now)} against now)</p>
          <div class="buttons">
            <button type="button" class="primary" disabled={!canSave} onClick={async () => { if (await keep(body, 'before going back to ' + open.entry.date.slice(0, 10))) { onUse(open.body); setOpen(null); } }}>Go back to this version</button>
            <button type="button" onClick={() => setOpen(null)}>Close</button>
          </div>
          <pre class="copy-text">{splitLead(open.body).text}</pre>
        </div>
      ) : list && (list.length ? (
        <ul class="copy-list history">
          {list.map((e) => (
            <li key={e.commit}>
              <button type="button" class="link" onClick={() => view(e)}>{when(e.date)}</button>
              <span class="meta"> {e.agent ? e.agent : 'You'} · {e.message.replace(/^[a-z-]+: /, '')}</span>
            </li>
          ))}
        </ul>
      ) : <p class="hint">No saves found.</p>)}
    </div>
  );
}

/** Joined or removed scenes in the book's Archive folder, with Restore. */
export function ArchiveList({ source, files, bookFolder, canSave, onChanged }: {
  source: VaultSource; files: FileEntry[]; bookFolder: string; canSave: boolean; onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [sure, setSure] = useState<{ file: FileEntry; why: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (f: FileEntry) => f.path.slice(f.path.lastIndexOf('/') + 1).replace(/\.md$/, '');
  const ask = async (f: FileEntry) => {
    setError(null);
    try { setSure({ file: f, why: archivedWhy(await source.read(f.path, f.sha)) }); } catch (e) { setError((e as Error).message); }
  };
  const restore = async () => {
    if (!sure) return;
    if (!navigator.onLine) { setError('Connect to the internet to restore a scene.'); return; }
    setBusy(true);
    try { await restoreArchived(source, sure.file, bookFolder); setSure(null); await onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div class="side-archive">
      <button type="button" class="side-add" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="archive" size={18} />Archive ({files.length})</button>
      {open && (
        <ul class="archive-list">
          {files.map((f) => (
            <li key={f.path}>
              <span>{name(f)}</span>
              {canSave && <button type="button" class="link" onClick={() => ask(f)}>Restore</button>}
            </li>
          ))}
        </ul>
      )}
      {sure && (
        <div class="side-add-form">
          <p class="hint">{sure.why ? sure.why + ' ' : ''}Restore puts {name(sure.file)} back in its old place.{/^Joined/.test(sure.why) ? ' Its words are still in the scene it joined too, so take them out there if you only want them once.' : ''}</p>
          <div class="buttons">
            <button type="button" class="primary" disabled={busy} onClick={restore}>{busy ? 'Restoring…' : 'Restore'}</button>
            <button type="button" onClick={() => setSure(null)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p class="error">{error}</p>}
    </div>
  );
}

/** "Delete chapter" or "Delete this scene" from the chapter list asks once, saying where the words go (Kyle, 2026-10-27). */
export function DeleteAsk({ what, words, later, onDelete, onCancel }: {
  what: string; words: number; later: boolean; onDelete: () => Promise<string | null>; onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    const err = await onDelete().catch((e) => (e as Error).message);
    setBusy(false);
    if (err) setError(err);
  };
  return (
    <div class="side-add-form">
      <p class="hint">Delete {what}{words ? ' and its ' + words.toLocaleString() + ' words' : ''}? It goes to the book's Archive (Book tools, Archive), where Restore brings it back.{later ? ' The chapters after it move down one.' : ''}</p>
      <div class="buttons">
        <button type="button" class="danger" disabled={busy} onClick={go}>{busy ? 'Deleting…' : 'Delete'}</button>
        <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
      {error && <p class="error">{error}</p>}
    </div>
  );
}

/** The chapter list's last line: "Add a chapter", then a title (or none) and it opens for writing. */
export function AddChapterAtEnd({ onAdd, scene }: { onAdd: (title: string) => Promise<string | null>; scene?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" class="side-add" onClick={() => setOpen(true)}><Icon name="plus" size={18} />{scene ? 'Add a scene' : 'Add a chapter'}</button>;
  return scene
    ? <SideAddForm label="Title of the new scene" button="Add" onAdd={onAdd} onCancel={() => setOpen(false)} />
    : <SideAddForm label="Title of the new chapter (you can leave it empty)" button="Add and start writing" allowEmpty onAdd={onAdd} onCancel={() => setOpen(false)} />;
}

/** Move a chapter: up or down one place, or straight to a number. Stays open so Kyle can press Up again. */
export function MoveChapter({ num, last, onMove, onClose }: { num: number; last: number; onMove: (to: number) => Promise<string | null>; onClose: () => void }) {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async (n: number) => {
    setBusy(true);
    setError(null);
    const err = await onMove(n);
    setBusy(false);
    setError(err);
    if (!err) setTo('');
  };
  const typed = Number(to);
  return (
    <div class="side-add-form side-move">
      <p class="hint">{busy ? 'Moving chapter ' + num + '… every note of the chapters it passes gets its new number.' : 'Move chapter ' + num + ':'}</p>
      <div class="buttons">
        <button type="button" disabled={busy || num <= 1} onClick={() => go(num - 1)}><Icon name="up" size={18} />Up one</button>
        <button type="button" disabled={busy || num >= last} onClick={() => go(num + 1)}><Icon name="down" size={18} />Down one</button>
      </div>
      <label class="reason">
        Or make it chapter number
        <span class="side-move-to">
          <input type="number" inputMode="numeric" min={1} max={last} value={to} enterKeyHint="go" onInput={(e) => setTo((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && to && !busy) { e.preventDefault(); go(typed); } }} />
          <button type="button" class="primary" disabled={busy || !to || typed === num} onClick={() => go(typed)}>Move</button>
        </span>
      </label>
      <div class="buttons"><button type="button" disabled={busy} onClick={onClose}>Done</button></div>
      {error && <p class="error">{error}</p>}
    </div>
  );
}

/** A title box and Add, in the chapter list. */
export function SideAddForm({ label, button, hint, allowEmpty, initial, onAdd, onCancel }: {
  label: string; button: string; hint?: string; allowEmpty?: boolean; initial?: string; onAdd: (title: string) => Promise<string | null>; onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    const err = await onAdd(title.trim());
    setBusy(false);
    setError(err);
  };
  return (
    <div class="side-add-form">
      <label class="reason">
        {label}
        <input type="text" value={title} enterKeyHint="go" autoFocus onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy && (allowEmpty || title.trim())) { e.preventDefault(); go(); } }} />
      </label>
      {hint && <p class="hint">{hint}</p>}
      <div class="buttons">
        <button type="button" class="primary" disabled={busy || (!allowEmpty && !title.trim())} onClick={go}>{busy ? 'Adding…' : button}</button>
        <button type="button" disabled={busy} onClick={() => { setError(null); onCancel(); }}>Cancel</button>
      </div>
      {error && <p class="error">{error}</p>}
    </div>
  );
}

export function ScenePanel({ status, next, alone, onStatus, onSplit, onJoin }: {
  status: string; next: NoteRecord | null; alone: boolean; onStatus: (status: string) => void;
  onSplit: (title: string) => Promise<string | null>; onJoin: () => Promise<string | null>;
}) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const err = await fn();
    setBusy(false);
    setError(err);
    if (!err) { setTitle(''); setSure(false); }
  };
  const nextName = next ? [next.data.id, sceneHeader(next.data)].filter(Boolean).join(' ') : '';
  return (
    <div class="writer-panel">
      {status === 'planned' && (
        <div>
          <p class="hint">This scene is still marked planned, so its words do not count on the Chapter Grid yet.</p>
          <div class="buttons"><button type="button" class="primary" onClick={() => onStatus('drafted')}>Mark as drafted</button></div>
        </div>
      )}
      {status === 'drafted' && (
        <div>
          <p class="hint">{alone ? 'When you have been through this chapter and are happy with it, mark it done. Its words then count toward the book.' : 'When you have been through this scene, mark it done. The chapter counts toward the book once all its scenes are done.'}</p>
          <div class="buttons"><button type="button" class="primary" onClick={() => onStatus('revised')}>{alone ? 'Mark this chapter done' : 'Mark this scene done'}</button></div>
        </div>
      )}
      {status === 'revised' && (
        <div>
          <p class="hint">{alone ? 'This chapter is done and counts toward the book.' : 'This scene is done.'}</p>
          <div class="buttons"><button type="button" onClick={() => onStatus('drafted')}>Not done yet</button></div>
        </div>
      )}
      <label class="reason">
        Split at the cursor. The words after the cursor become a new scene with this title:
        <input type="text" value={title} onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} placeholder="Title of the new scene" />
      </label>
      <div class="buttons">
        <button type="button" class="primary" disabled={busy || !title.trim()} onClick={() => run(() => onSplit(title.trim()))}>Split here</button>
      </div>
      {next && (
        <div>
          <p class="hint">Join {nextName} onto the end of this scene. Its old note moves to the book's Archive folder.</p>
          <div class="buttons">
            {sure ? (
              <>
                <button type="button" class="primary" disabled={busy} onClick={() => run(onJoin)}>Yes, join {String(next.data.id || 'it')}</button>
                <button type="button" onClick={() => setSure(false)}>Cancel</button>
              </>
            ) : <button type="button" disabled={busy} onClick={() => setSure(true)}>Join the next scene</button>}
          </div>
        </div>
      )}
      {busy && <p class="hint">Working…</p>}
      {error && <p class="error">{error}</p>}
    </div>
  );
}

/** Ask the team: each button writes a job note the vault's GitHub workflow runs. Kyle's words never get drafted over. */
export function TeamPanel({ status, id, title, chapter, bookFolder, onJob, link, autoFill, onAutoFill, recipes = [] }: {
  status: string; id: string; title: string; chapter: number | null; bookFolder: string | null; onJob?: OnJob;
  link: (to: string) => { href: string; onClick: (e: MouseEvent) => void };
  autoFill: boolean; onAutoFill: (on: boolean) => void;
  /** Recipes by name: one picked is named in the ask of every job sent from here. */
  recipes?: string[];
}) {
  const [recipe, setRecipe] = useState('');
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState<JobKind | ''>('');
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  // A conversation about this scene: its thread is the scene's ID.
  const talk = id ? <a class="button team-talk" {...link(href.chat(id, bookFolder || ''))}><Icon name="chat" size={18} /> Talk about this scene</a> : null;
  if (!onJob) return <div class="writer-panel team-panel">{talk}<p class="hint">Asking the team needs your own vault, not the demo.</p></div>;
  const send = async (kind: JobKind, target: string, words = '') => {
    setBusy(kind);
    setSaid(null);
    const jobTitle = kind === 'custom' ? (words.trim().length > 60 ? words.trim().slice(0, 57).replace(/\s+\S*$/, '') + '…' : words.trim()) || 'Ask the team' : defaultJobTitle(kind, target, kind === 'notes' || kind === 'table-read' || kind === 'beats' ? '' : title);
    const ask = kind === 'table-read' || kind === 'beats' ? jobAsk(kind, target, words) : words;
    const r = await onJob({ title: jobTitle, kind, target, book: bookFolder || '', ask: recipe ? withRecipe(ask, recipe) : ask });
    setBusy('');
    setSaid(r);
    if (!r.error && kind === 'custom') { setAsk(''); setAsking(false); }
  };
  const chapterTarget = chapter != null ? 'Chapter ' + chapter : '';
  return (
    <div class="writer-panel team-panel">
      {talk}
      <label class="check-row">
        <input type="checkbox" checked={autoFill} onChange={(e) => onAutoFill((e.currentTarget as HTMLInputElement).checked)} />
        <span>Fill {'{braces}'} on their own, 20 seconds after you stop typing (this device)</span>
      </label>
      <RecipePicker names={recipes} value={recipe} onChange={setRecipe} />
      {status === 'planned'
        ? <button type="button" class="primary" disabled={busy !== '' || !id} onClick={() => send('draft', id)}>{busy === 'draft' ? 'Sending…' : 'Draft this scene'}</button>
        : <p class="hint">This scene has words in it, so the team won't draft over it.</p>}
      <button type="button" disabled={busy !== '' || !chapterTarget} onClick={() => send('notes', chapterTarget)}>{busy === 'notes' ? 'Sending…' : 'Notes on this chapter'}</button>
      <button type="button" disabled={busy !== '' || !chapterTarget} onClick={() => send('table-read', chapterTarget, '')}>{busy === 'table-read' ? 'Sending…' : 'Table read of this chapter'}</button>
      {/* Moved here from Beats mode, whose own Ask the team was redundant (Kyle, 2026-10-22). */}
      <button type="button" disabled={busy !== '' || !chapterTarget} onClick={() => send('beats', chapterTarget, '')}>{busy === 'beats' ? 'Sending…' : 'Beats for this chapter (find, plan or redo them)'}</button>
      <button type="button" disabled={busy !== '' || !id} onClick={() => send('check', id)}>{busy === 'check' ? 'Sending…' : 'The team\'s deeper check for AI-sounding phrases'}</button>
      <button type="button" disabled={busy !== ''} onClick={() => send('learn', '')}>{busy === 'learn' ? 'Sending…' : 'Learn from my edits'}</button>
      {asking ? (
        <div class="side-add-form">
          <label class="reason">
            What do you want the team to do?
            <input type="text" value={ask} onInput={(e) => setAsk((e.currentTarget as HTMLInputElement).value)} placeholder="One line" />
          </label>
          <div class="buttons">
            <button type="button" class="primary" disabled={busy !== '' || !ask.trim()} onClick={() => send('custom', '', ask)}>{busy === 'custom' ? 'Sending…' : 'Send'}</button>
            <button type="button" onClick={() => { setAsking(false); setAsk(''); }}>Cancel</button>
          </div>
        </div>
      ) : <button type="button" disabled={busy !== ''} onClick={() => { setAsking(true); setSaid(null); }}>Ask the team…</button>}
      {said && <p class={said.error ? 'error' : 'ok'}>{said.text}</p>}
      <p class="hint">Each press writes a job into the vault. The team picks it up and the answer lands on the <a {...link(href.jobs())}>Jobs</a> screen. A table read is three test readers who only see this chapter's pages.</p>
    </div>
  );
}

/** How the page looks on this device: text size, spacing, width, font and paper. */
export function PagePanel({ look, onLook }: { look: PageLook; onLook: (l: PageLook) => void }) {
  return (
    <div class="writer-panel page-panel">
      {LOOK_CHOICES.map((c) => (
        <div key={c.key} role="group" aria-label={c.label}>
          <span class="panel-key">{c.label}</span>
          <div class="seg small wrap">
            {c.options.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={look[c.key] === v} onClick={() => onLook({ ...look, [c.key]: v })}>{l}</button>
            ))}
          </div>
        </div>
      ))}
      <p class="hint">These choices stay on this device. The iPad and the computer can each have their own.</p>
    </div>
  );
}

export function TargetPanel({ value, onSet }: { value: number | null; onSet: (n: number) => void }) {
  const [v, setV] = useState(value ? String(value) : '');
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
  return (
    <div class="writer-panel">
      <label class="reason">
        Word target for this scene
        <input type="text" inputMode="numeric" value={v} onInput={(e) => setV((e.currentTarget as HTMLInputElement).value)} placeholder="For example 2500" />
      </label>
      <div class="buttons">
        <button type="button" class="primary" disabled={!(n > 0)} onClick={() => onSet(n)}>Set target</button>
      </div>
      <p class="hint">The target is saved with the scene next time it saves.</p>
    </div>
  );
}

export function CopiesPanel({ source, note, body, canSave, onUse }: {
  source: VaultSource; note: NoteRecord; body: string; canSave: boolean; onUse: (body: string) => void;
}) {
  const [list, setList] = useState<SnapshotEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');
  const [open, setOpen] = useState<{ entry: SnapshotEntry; body: string } | null>(null);

  const load = useCallback(async () => {
    if (!navigator.onLine) { setError('Connect to the internet to see or save copies.'); return; }
    try {
      setList(await listSnapshots(source, note));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [source, note]);
  useEffect(() => { load(); }, [load]);

  const keep = async (text: string, name: string) => {
    setBusy(true);
    try {
      await saveSnapshot(source, note, text, name, new Date());
      setLabel('');
      await load();
      return true;
    } catch (e) {
      setError(offlineError(e) ? 'Connect to the internet to save a copy.' : (e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const view = async (entry: SnapshotEntry) => {
    try {
      const text = await source.read(entry.path, entry.sha);
      setOpen({ entry, body: Frontmatter.parse(text).body });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Going back to an older copy saves what is on screen as a copy first, so nothing is lost.
  const use = async () => {
    if (!open) return;
    if (await keep(body, 'before going back to v' + open.entry.version)) { onUse(open.body); setOpen(null); }
  };

  return (
    <div class="writer-panel">
      {canSave && (
        <>
          <label class="reason">
            Save a copy of this version
            <input type="text" value={label} onInput={(e) => setLabel((e.currentTarget as HTMLInputElement).value)} placeholder="Name, for example before cutting the fight" />
          </label>
          <div class="buttons">
            <button type="button" class="primary" disabled={busy} onClick={() => keep(body, label.trim() || 'copy')}>Save a copy</button>
          </div>
        </>
      )}
      {error && <p class="error">{error}</p>}
      {open ? (
        <div class="copy-view">
          <p><strong>Copy {open.entry.version}{open.entry.label ? ' (' + open.entry.label + ')' : ''}</strong>, {num(bodyWords(open.body))} words</p>
          <div class="buttons">
            <button type="button" class="primary" disabled={busy || !canSave} onClick={use}>Go back to this version</button>
            <button type="button" onClick={() => setOpen(null)}>Close</button>
          </div>
          <pre class="copy-text">{splitLead(open.body).text}</pre>
        </div>
      ) : list && (
        list.length ? (
          <ul class="copy-list">
            {list.map((s) => (
              <li key={s.path}><button type="button" class="link" onClick={() => view(s)}>Copy {s.version}{s.label ? ' (' + s.label + ')' : ''}</button></li>
            ))}
          </ul>
        ) : <p class="hint">No copies of this scene yet.</p>
      )}
      {!open && <HistoryList source={source} note={note} body={body} canSave={canSave} keep={keep} onUse={onUse} />}
    </div>
  );
}

/** The chapter's to-dos beside the page: Kyle's and the team's, ticked off here or by the team. */
export function TodosPanel({ todos, chapter, sceneId, onTodo, onAdd, onJob, bookFolder, waiting, link }: {
  todos: NoteRecord[]; chapter: number | null; sceneId: string; onTodo?: OnTodo; onAdd?: (t: NewTodo) => Promise<string | null>;
  onJob?: OnJob; bookFolder: string | null; waiting: Record<string, Choice>;
  link: (to: string) => { href: string; onClick: (e: MouseEvent) => void };
}) {
  const [text, setText] = useState('');
  const [aboutScene, setAboutScene] = useState(true);
  const [busy, setBusy] = useState('');
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const [showDone, setShowDone] = useState(false);
  const open = todos.filter(isOpen);
  const closed = todos.filter((n) => !isOpen(n));
  const where = chapter != null ? 'Chapter ' + chapter : '';
  const add = async () => {
    if (!onAdd || !text.trim()) return;
    setBusy('add');
    setSaid(null);
    const err = await onAdd({ title: text.trim(), chapter, scene: aboutScene ? sceneId : '' });
    setBusy('');
    if (err) setSaid({ error: true, text: err }); else setText('');
  };
  const ask = async (kind: JobKind) => {
    if (!onJob || !where) return;
    setBusy(kind);
    setSaid(null);
    const r = await onJob({ title: defaultJobTitle(kind, where), kind, target: where, book: bookFolder || '', ask: jobAsk(kind, where, '') });
    setBusy('');
    setSaid(r);
  };
  const row = (n: NoteRecord) => {
    const done = !isOpen(n);
    const w = waiting[n.path];
    return (
      <li key={n.path} class={'todo-row' + (done ? ' done' : '')}>
        <button type="button" class="todo-check" role="checkbox" aria-checked={done} disabled={!onTodo || Boolean(n.error)}
          aria-label={(done ? 'Not done: ' : 'Done: ') + String(n.data.title || '')}
          onClick={() => onTodo && onTodo(n.path, 'edit', '', { status: done ? 'open' : 'done' })}>
          {done && <Icon name="check" size={18} />}
        </button>
        <span class="todo-text">
          <a {...link(href.note(n.path))} class="todo-title">{String(n.data.title || n.data.id || '')}</a>
          <span class="todo-meta">
            {n.data.generated === true && <span class="pill pill-plain gen">Generated{n.data.found_by ? ' · ' + String(n.data.found_by) : ''}</span>}
            {n.data.scene ? <span>{String(n.data.scene)}</span> : null}
            {w && <span class={w.error ? 'error' : ''}>{w.error ? 'Not saved' : 'Saving…'}</span>}
          </span>
          {done && n.data.done_note ? <span class="todo-note">{String(n.data.done_note)}</span> : null}
        </span>
      </li>
    );
  };
  return (
    <div class="writer-panel todos-panel">
      <p class="hint">{where ? where + ': ' : ''}{open.length === 1 ? '1 to-do open' : open.length + ' to-dos open'}. Tick one off when it is fixed.</p>
      {open.length > 0 ? <ul class="todo-list">{open.map(row)}</ul> : <p class="hint">Nothing to fix in this chapter yet.</p>}
      {onAdd && (
        <div class="todo-add">
          <label class="reason">
            <span class="visually-hidden">A new to-do for this chapter</span>
            <input type="text" value={text} placeholder="Add a to-do for this chapter" onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          </label>
          <label class="todo-scene"><input type="checkbox" checked={aboutScene} onChange={(e) => setAboutScene((e.currentTarget as HTMLInputElement).checked)} /> About this scene{sceneId ? ' (' + sceneId + ')' : ''}</label>
          <button type="button" class="primary" disabled={busy !== '' || !text.trim()} onClick={add}>{busy === 'add' ? 'Adding…' : 'Add'}</button>
        </div>
      )}
      {onJob && where && (
        <div class="todo-team">
          <button type="button" disabled={busy !== ''} onClick={() => ask('chapter-check')}>{busy === 'chapter-check' ? 'Sending…' : 'Ask the team to check this chapter'}</button>
          {open.length > 0 && <button type="button" disabled={busy !== ''} onClick={() => ask('todo-review')}>{busy === 'todo-review' ? 'Sending…' : 'Ask the team to tick off fixed ones'}</button>}
          <p class="hint">The check reads this chapter for continuity, plot and character problems and adds them here, labelled Generated. Nothing in the scenes changes.</p>
        </div>
      )}
      {said && <p class={said.error ? 'error' : 'ok'}>{said.text}</p>}
      {closed.length > 0 && (
        <>
          <button type="button" class="link" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide' : 'Show'} done ({closed.length})</button>
          {showDone && <ul class="todo-list">{closed.map(row)}</ul>}
        </>
      )}
    </div>
  );
}

/** The chapter's plan beside the page: Kyle's own paragraphs about what the chapter should do, saved in the book's
 * Chapter Plans folder, never in the prose. Kept on the device as he types and saved a few seconds after he stops.
 * With kind "scrap" it is the chapter's scrap instead (Chapter Scraps): cut words and loose notes, with a button that
 * moves the words picked on the page into it. */
export function PlanPanel({ source, bookFolder, chapter, plan, canSave, kind = 'plan', take, keepFocus }: {
  source: VaultSource; bookFolder: string | null; chapter: number | null; plan: NoteRecord | null; canSave: boolean;
  kind?: 'plan' | 'scrap';
  /** Scrap only: cut the words picked on the page and return them (null when nothing is picked). */
  take?: () => string | null;
  keepFocus?: Record<string, (e: Event) => void>;
}) {
  const scrap = kind === 'scrap';
  const [nothing, setNothing] = useState(false);
  const fresh = (): Draft | null => {
    if (!bookFolder || chapter == null) return null;
    const now = new Date();
    const path = plan ? plan.path : scrap ? scrapPath(bookFolder, chapter) : planPath(bookFolder, chapter);
    const kept = loadDrafts(source.key)[path];
    if (plan) return openDraft(plan, kept, now);
    return kept && kept.create && isUnsaved(kept) ? kept
      : { path, baseSha: '', baseBody: '', body: '', target: null, startWords: 0, updatedAt: now.toISOString(), pending: false, create: scrap ? scrapHead(chapter) : planHead(chapter) };
  };
  const [d, setD] = useState<Draft | null>(fresh);
  const ref = useRef(d);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const put = (n: Draft) => { ref.current = n; setD(n); putDraft(source.key, n.path, isUnsaved(n) || n.pending ? n : null); };
  const save = async () => {
    const cur = ref.current;
    if (!cur || !isUnsaved(cur) || !canSave) return;
    if (!navigator.onLine) { put({ ...cur, pending: true }); return; }
    setState('saving');
    try {
      const r = await saveDraft(source, cur, new Date());
      const now = ref.current || cur;
      put({ ...now, baseSha: r.note.sha, baseBody: cur.body, pending: false, error: undefined, create: undefined });
      setState('saved');
      setError('');
    } catch (e) {
      if ((e as { status?: number }).status === 0) { put({ ...(ref.current || cur), pending: true }); setState('idle'); return; }
      setState('error');
      setError((e as Error).message);
    }
  };
  // The plan changed somewhere else (another device, Obsidian) and nothing is waiting here: show the new one.
  useEffect(() => {
    const cur = ref.current;
    if (plan && cur && !isUnsaved(cur) && plan.sha !== cur.baseSha) put(openDraft(plan, undefined, new Date()));
  }, [plan && plan.sha]);
  // Leaving the tab or the page: save what is waiting (it stays on the device until it reaches the vault).
  useEffect(() => () => {
    if (quiet.current) clearTimeout(quiet.current);
    const cur = ref.current;
    if (cur && isUnsaved(cur)) { putDraft(source.key, cur.path, { ...cur, pending: true }); save(); }
  }, []);
  const fit = () => { const el = box.current; if (el) { el.style.height = 'auto'; el.style.height = Math.max(240, el.scrollHeight) + 'px'; } };
  useEffect(fit, [d && d.body]);
  if (!d) return <div class="writer-panel"><p class="hint">{scrap ? 'A scrap' : 'A plan'} belongs to a chapter. Give this scene a chapter on the Chapter Grid first.</p></div>;
  const { lead, text } = splitLead(d.body);
  const onInput = (v: string) => {
    put({ ...(ref.current || d), body: (lead || '\n') + v, updatedAt: new Date().toISOString() });
    setState('idle');
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(() => { save(); }, 3000);
  };
  const said = state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved: ' + error + ' It is safe on this device.'
    : isUnsaved(d) ? (d.pending || !navigator.onLine ? 'Kept on this device; it saves when you are back online.' : 'Kept on this device.')
      : state === 'saved' ? (scrap ? 'Saved in the book\'s Chapter Scraps folder.' : 'Saved in the book\'s Chapter Plans folder.') : '';
  const moveIn = () => {
    const words = take ? take() : null;
    if (words == null) { setNothing(true); return; }
    setNothing(false);
    onInput(addToScrap(splitLead((ref.current || d).body).text, words));
  };
  return (
    <div class="writer-panel plan-panel">
      {scrap
        ? <p class="hint">Words you cut from chapter {chapter} and notes you want to keep, as long as you like. It stays out of the story, and the team leaves it alone unless you ask.</p>
        : <p class="hint">Your plan for chapter {chapter}, as long as you like. It stays out of the story; the team reads it whenever they work on this chapter.</p>}
      {scrap && take && (
        <div class="scrap-move">
          <button type="button" {...(keepFocus || {})} onClick={moveIn}>Move picked words here</button>
          {nothing && <p class="hint" role="status">Pick some words on the page first, then press this again.</p>}
        </div>
      )}
      <textarea ref={box} class="plan-text" value={text} placeholder={scrap ? 'Cut lines, spare ideas, anything you are not ready to throw away…' : 'What this chapter has to do, who wants what, how it ends…'}
        aria-label={(scrap ? 'Scrap for chapter ' : 'Plan for chapter ') + chapter} spellcheck autocapitalize="sentences"
        onInput={(e) => { onInput((e.currentTarget as HTMLTextAreaElement).value); fit(); }} onBlur={() => { if (quiet.current) clearTimeout(quiet.current); save(); }} />
      {said && <p class={state === 'error' ? 'error' : 'hint'} role="status">{said}</p>}
      {!canSave && <p class="hint">The demo vault keeps your {scrap ? 'scrap' : 'plan'} until the page reloads.</p>}
    </div>
  );
}
