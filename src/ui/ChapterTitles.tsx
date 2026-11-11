// Chapter titles (Edit room, Kyle 2026-10-29): the team's four options per chapter with a tick for the one Kyle likes,
// None of these to ask for four more next round, and Write my own. A pick also renames the chapter; unticking puts its
// old name back. Each chapter shows its scenes' headlines for context (Kyle, 2026-10-29: "a short summary ... beside
// each chapter"). Choices change only the tick lines of `Chapter Titles.md` and go through the one saving system.
import { useState } from 'preact/hooks';
import { NONE, parseTitles, pickedTitle, TITLES_FILE } from '../lib/titles.ts';
import type { BookEntry, NoteRecord, VaultIndex } from '../lib/types.ts';
import type { TextChange } from '../vault/text.ts';
import { Icon } from './Icon.tsx';
import { href } from './route.ts';

export function ChapterTitlesPage({ index, book, groups, onRename, onChange }: {
  index: VaultIndex; book: BookEntry;
  /** The one saving system: a choice goes to the outbox, shows at once and works with no connection. */
  onChange: (path: string, change: TextChange) => void;
  /** The book's chapters and their scenes, to rename a chapter when Kyle picks its title. */
  groups: { num: number | null; title: string; scenes: NoteRecord[] }[];
  onRename?: (scenes: NoteRecord[], title: string) => void;
}) {
  const path = book.folder + '/' + TITLES_FILE;
  const note = index.notes[path];
  const [own, setOwn] = useState<{ chapter: number; text: string } | null>(null);
  const chapters = parseTitles(note ? note.body : '');
  const rename = (chapter: number, title: string) => {
    const g = groups.find((x) => x.num === chapter);
    if (g && onRename && title && title !== g.title) onRename(g.scenes, title);
  };
  const pick = (chapter: number, was: string, title: string, on: boolean) => {
    onChange(path, { what: 'title-pick', chapter, title, on });
    if (title === NONE) { if (on) rename(chapter, was); return; }
    rename(chapter, on ? title : was);
  };
  const writeOwn = (chapter: number, words: string) => {
    const clean = words.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    onChange(path, { what: 'title-own', chapter, title: clean });
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
                  <button type="button" class="titles-option" aria-pressed={o.picked} onClick={() => pick(c.chapter, c.was, o.text, !o.picked)}>
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
                  <button type="button" class="titles-option titles-write" onClick={() => setOwn({ chapter: c.chapter, text: '' })}>
                    <span class="titles-tick" aria-hidden="true"><Icon name="pen" size={16} /></span>Write my own
                  </button>
                )}
              </li>
              <li>
                <button type="button" class="titles-option titles-none" aria-pressed={c.none} onClick={() => pick(c.chapter, c.was, NONE, !c.none)}>
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
