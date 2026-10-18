// Sessions (Writers Room, Kyle 2026-10-18): the book's session notes newest first, and one session read speaker by speaker,
// each agent in its own colour, then the ideas it filed.
import { pileOf, PILES } from '../lib/ideas.ts';
import { basename } from '../lib/links.ts';
import { render } from '../lib/markdown.ts';
import { bookSessions, parseSession, sessionIdeas, sessionWhen, speakers, voiceColour, type SessionPart } from '../lib/sessions.ts';
import type { BookEntry, NoteRecord, VaultIndex } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { href } from './route.ts';

/** A session's name without the date and time its file name starts with. */
function sessionName(n: NoteRecord): string {
  const t = String(n.data.title || basename(n.path));
  return t.replace(/^\d{4}-\d{2}-\d{2}\s+\d{4}\s+/, '') || t;
}

function people(n: NoteRecord): string[] {
  const p = n.data.participants;
  const list = Array.isArray(p) ? p.map(String) : p ? String(p).split(/\s*,\s*/) : [];
  return list.length ? list : speakers(parseSession(n.body));
}

function Who({ name }: { name: string }) {
  return <span class="voice-chip" style={{ '--voice': voiceColour(name) }}>{name}</span>;
}

export function SessionsScreen({ index, book }: { index: VaultIndex; book: BookEntry }) {
  const list = bookSessions(index, book);
  return (
    <section class="sessions-screen">
      <p class="crumb"><a href={href.board('overview', book.folder)}>{book.title}</a> · Sessions</p>
      <h1>Sessions</h1>
      <p class="meta">Every brainstorm and working session the team wrote up for this book, newest first. Open one to read it speaker by speaker and jump to the ideas it filed.</p>
      {!list.length && (
        <div class="empty-box">
          <h2>No sessions yet</h2>
          <p>Each substantial thread with the team leaves a session note in the book's Sessions folder. They appear here.</p>
        </div>
      )}
      <ul class="session-list">
        {list.map((n) => {
          const ideas = sessionIdeas(index, book, n).length;
          return (
            <li key={n.path}>
              <a href={href.note(n.path)}>
                <span class="session-row-top">
                  <span class="session-name">{sessionName(n)}</span>
                  <span class="meta">{sessionWhen(n.data.date)}</span>
                </span>
                {n.data.outcome != null && <span class="session-outcome">{String(n.data.outcome)}</span>}
                <span class="session-who">
                  {people(n).map((p) => <Who key={p} name={p} />)}
                  {ideas > 0 && <span class="meta">{ideas === 1 ? '1 idea' : ideas + ' ideas'}</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Part({ part }: { part: SessionPart }) {
  return (
    <section class={'session-part part-' + part.kind}>
      {part.heading && <h2>{part.heading}</h2>}
      {part.turns.map((t, i) => t.speaker ? (
        <div key={i} class="turn" style={{ '--voice': voiceColour(t.speaker) }}>
          <p class="turn-who">{t.speaker}</p>
          <div class="prose" dangerouslySetInnerHTML={{ __html: render(t.text) }} />
        </div>
      ) : <div key={i} class="prose turn-narration" dangerouslySetInnerHTML={{ __html: render(t.text) }} />)}
    </section>
  );
}

/** One session, speaker by speaker. */
export function SessionView({ index, note }: { index: VaultIndex; note: NoteRecord }) {
  const book = index.books.find((b) => note.path.startsWith(b.folder + '/'));
  const parts = parseSession(note.body);
  const ideas = book ? sessionIdeas(index, book, note) : [];
  const label = (n: NoteRecord) => (PILES.find((p) => p.key === pileOf(n.data)) || { label: '' }).label;
  return (
    <article class="session-view">
      <p class="crumb">{book ? <a href={href.board('sessions', book.folder)}><Icon name="left" size={16} /> Sessions of {book.title}</a> : 'Session'}</p>
      <h1>{sessionName(note)}</h1>
      <p class="meta">{[sessionWhen(note.data.date), note.data.protocol ? String(note.data.protocol) : ''].filter(Boolean).join(' · ')}</p>
      <p class="session-who">{people(note).map((p) => <Who key={p} name={p} />)}</p>
      {note.data.topic != null && <p class="session-topic">{String(note.data.topic)}</p>}
      {note.data.outcome != null && <p class="session-outcome-box"><strong>Outcome:</strong> {String(note.data.outcome)}</p>}
      {note.error && <p class="error">The note's properties cannot be read: {note.error}</p>}
      {parts.map((p, i) => <Part key={i} part={p} />)}
      <section class="session-ideas">
        <h2>Ideas it filed <span class="meta">{ideas.length}</span></h2>
        {!ideas.length ? <p class="meta">This session filed no ideas the app can find.</p> : (
          <ul class="ov-list">
            {ideas.map((n) => (
              <li key={n.path}>
                <a href={href.note(n.path)}>
                  <span class="card-id">{String(n.data.id || '')}</span>
                  <span>{String(n.data.title || basename(n.path))}{n.data.source ? <span class="meta"> · {String(n.data.source)}</span> : null}</span>
                  <span class="pill pill-plain">{label(n)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {book && ideas.length > 0 && <p><a href={href.ideas(book.folder)}>Decide them on the Ideas board</a></p>}
      </section>
      <p class="meta path">{note.path}</p>
    </article>
  );
}
