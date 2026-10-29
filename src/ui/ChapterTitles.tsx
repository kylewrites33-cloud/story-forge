// Chapter titles (Edit room, Kyle 2026-10-29): the team's four options per chapter with a tick for the one Kyle likes,
// None of these to ask for four more next round, and Write my own. A pick also renames the chapter; unticking puts its
// old name back. Each chapter shows its scenes' headlines for context (Kyle, 2026-10-29: "a short summary ... beside
// each chapter"). Choices change only the tick lines of `Chapter Titles.md` and commit with Kyle's key.
import { useEffect, useState } from 'preact/hooks';
import { addOwn, NONE, parseTitles, pickedTitle, setPick, TITLES_FILE } from '../lib/titles.ts';
import type { BookEntry, NoteRecord, VaultIndex, VaultSource } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { href } from './route.ts';

export function ChapterTitlesPage({ source, index, book, groups, onRename }: {
  source: VaultSource; index: VaultIndex; book: BookEntry;
  /** The book's chapters and their scenes, to rename a chapter when Kyle picks its title. */
  groups: { num: number | null; title: string; scenes: NoteRecord[] }[];
  onRename?: (scenes: NoteRecord[], title: string) => void;
}) {
  const path = book.folder + '/' + TITLES_FILE;
  const note = index.notes[path];
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [own, setOwn] = useState<{ chapter: number; text: string } | null>(null);
  // The vault's copy, until Kyle's own choices on this page are newer.
  useEffect(() => { setBody(null); }, [note ? note.sha : '']);
  const text = body != null ? body : note ? note.body : '';
  const chapters = parseTitles(text);
  const canWrite = Boolean(source.readFresh && source.write);

  const save = async (change: (t: string) => string, what: string) => {
    setBody(change(text));
    setError(null);
    if (!source.readFresh || !source.write) return;
    try {
      for (let attempt = 0; ; attempt++) {
        const fresh = await source.readFresh(path);
        const next = change(fresh.text);
        try {
          if (next !== fresh.text) await source.write(path, next, fresh.sha, 'titles: Kyle ' + what + '\n\nChosen in the Sparrow app.');
          break;
        } catch (e) {
          if ((e as { conflict?: boolean }).conflict && attempt < 3) continue;
          throw e;
        }
      }
    } catch (e) {
      setError('Your choice could not be saved: ' + (e as Error).message + ' Try again when you are back online.');
    }
  };
  const rename = (chapter: number, title: string) => {
    const g = groups.find((x) => x.num === chapter);
    if (g && onRename && title && title !== g.title) onRename(g.scenes, title);
  };
  const pick = (chapter: number, was: string, title: string, on: boolean) => {
    save((t) => setPick(t, chapter, title, on), (on ? 'picked ' : 'unticked ') + (title === NONE ? 'None of these' : '"' + title + '"') + ' for chapter ' + chapter);
    if (title === NONE) { if (on) rename(chapter, was); return; }
    rename(chapter, on ? title : was);
  };
  const writeOwn = (chapter: number, words: string) => {
    const clean = words.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    save((t) => addOwn(t, chapter, clean), 'wrote "' + clean + '" for chapter ' + chapter);
    rename(chapter, clean);
    setOwn(null);
  };

  if (!note) {
    return (
      <section class="titles-page">
        <p class="crumb"><a href={href.board('overview', book.folder)}>{book.title}</a> · Chapter titles</p>
        <h1>Chapter titles</h1>
        <p class="hint">No title options yet. Ask the team in Chat for four chapter titles for each chapter, and they appear here for you to pick.</p>
      </section>
    );
  }
  const decided = chapters.filter((c) => pickedTitle(c)).length;
  const more = chapters.filter((c) => c.none).length;
  return (
    <section class="titles-page">
      <p class="crumb"><a href={href.board('overview', book.folder)}>{book.title}</a> · Chapter titles</p>
      <h1>Chapter titles</h1>
      <p class="hint">Tick the title you like for each chapter, write your own, or tick None of these and the team brings four more next round. Your pick becomes the chapter's name.</p>
      <p class="meta">{decided} of {chapters.length} chapters picked{more ? ' · ' + more + ' waiting for more options' : ''}</p>
      {error && <p class="note-line error" role="alert">{error}</p>}
      {chapters.map((c) => {
        const chosen = pickedTitle(c);
        const g = groups.find((x) => x.num === c.chapter);
        return (
          <article key={c.chapter} class={'titles-chapter' + (chosen ? ' done' : c.none ? ' more' : '')}>
            <h2>Chapter {c.chapter}<span class="meta">{chosen ? chosen : c.was ? 'Now: ' + (g && g.title ? g.title : c.was) : ''}</span></h2>
            {g && g.scenes.some((n) => String(n.data.headline || '').trim()) && (
              <p class="titles-about">{g.scenes.map((n) => String(n.data.headline || '').trim()).filter(Boolean).join(' ')}</p>
            )}
            <ul class="titles-options" role="group" aria-label={'Titles for chapter ' + c.chapter}>
              {c.options.map((o) => (
                <li key={o.text}>
                  <button type="button" class="titles-option" aria-pressed={o.picked} disabled={!canWrite} onClick={() => pick(c.chapter, c.was, o.text, !o.picked)}>
                    <span class="titles-tick" aria-hidden="true">{o.picked && <Icon name="check" size={18} />}</span>{o.text}
                  </button>
                </li>
              ))}
              <li>
                {own && own.chapter === c.chapter ? (
                  <form class="titles-own" onSubmit={(e) => { e.preventDefault(); writeOwn(c.chapter, own.text); }}>
                    <label class="sr-only" for={'own-' + c.chapter}>Your title for chapter {c.chapter}</label>
                    <input id={'own-' + c.chapter} type="text" value={own.text} placeholder="Your title" autoFocus
                      onInput={(e) => setOwn({ chapter: c.chapter, text: (e.target as HTMLInputElement).value })} />
                    <button type="submit" class="primary" disabled={!own.text.trim()}>Use it</button>
                    <button type="button" onClick={() => setOwn(null)}>Cancel</button>
                  </form>
                ) : (
                  <button type="button" class="titles-option titles-write" disabled={!canWrite} onClick={() => setOwn({ chapter: c.chapter, text: '' })}>
                    <span class="titles-tick" aria-hidden="true"><Icon name="pen" size={16} /></span>Write my own
                  </button>
                )}
              </li>
              <li>
                <button type="button" class="titles-option titles-none" aria-pressed={c.none} disabled={!canWrite} onClick={() => pick(c.chapter, c.was, NONE, !c.none)}>
                  <span class="titles-tick" aria-hidden="true">{c.none && <Icon name="check" size={18} />}</span>None of these, four more next round
                </button>
              </li>
            </ul>
          </article>
        );
      })}
    </section>
  );
}
