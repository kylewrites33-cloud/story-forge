import { useEffect, useRef, useState } from 'preact/hooks';
import { conversation, conversations, firstWords, isSceneThread, isThread, loadSideThread, saveSideThread, type ChatMessage, type Conversation } from '../lib/chat.ts';
import type { Decision } from '../lib/ideas.ts';
import { render } from '../lib/markdown.ts';
import type { VaultIndex } from '../lib/types.ts';
import type { Choice } from '../lib/write-queue.ts';
import { Icon } from './Icon.tsx';
import { when } from './Jobs.tsx';
import { href } from './route.ts';
import { takeChatPrefill } from './Team.tsx';

/** Send Kyle's words in a conversation. Answers the thread the message went into (a new conversation gets its name here), or a plain-sentence error. */
export type OnChat = (thread: string, words: string, book: string, page?: string) => Promise<{ thread: string; book: string } | { error: string }>;
type OnDecide = (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;

/** The last thing said in a conversation, for its row in the list. */
function preview(c: Conversation): string {
  const m = c.messages[c.messages.length - 1];
  if (!m) return '';
  if (m.state === 'waiting' || m.state === 'working') return 'You: ' + firstWords(m.ask, 70);
  if (m.state === 'failed') return 'The team could not answer.';
  if (m.state === 'cancelled') return 'You: ' + firstWords(m.ask, 70) + ' (cancelled)';
  return firstWords(m.reply || m.result, 90);
}

function ConversationList({ list }: { list: Conversation[] }) {
  return (
    <section class="chat-list-screen">
      <div class="chat-head">
        <h1>Chat with the team</h1>
        <a class="button primary" href={href.chat('new')}><Icon name="plus" size={18} /> New conversation</a>
      </div>
      <p class="meta">Ask the team anything about the book. Each scene can have its own conversation: open it from the scene's Team tab.</p>
      {!list.length && (
        <div class="empty-box">
          <h2>No conversations yet</h2>
          <p>Start one with a question about the book, a scene or a character.</p>
          <div class="buttons"><a class="button primary" href={href.chat('new')}>New conversation</a></div>
        </div>
      )}
      {list.length > 0 && (
        <ul class="chat-list">
          {list.map((c) => (
            <li key={c.thread}>
              <a href={href.chat(c.thread, c.book)}>
                <span class="chat-row-top">
                  <span class="chat-row-title">{c.title}</span>
                  <span class="meta">{when(c.activity)}</span>
                </span>
                <span class="chat-row-preview">{preview(c)}</span>
                {c.pending && <span class="chat-row-wait"><span class="job-dot" aria-hidden="true" /> The team is working on it</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Reply({ m, first, onCancel }: { m: ChatMessage; first: boolean; onCancel?: () => void }) {
  if (m.state === 'waiting' || m.state === 'working') {
    if (!first) {
      return (
        <p class="chat-queued">
          Next in line: the team answers in order.
          {m.state === 'waiting' && onCancel && <> <button type="button" class="link" onClick={onCancel}>Cancel</button></>}
        </p>
      );
    }
    return (
      <div class="chat-msg team">
        <p class="chat-working"><span class="job-dot" aria-hidden="true" /> The team is working on it…</p>
        <p class="chat-meta">Replies usually take one to three minutes.{m.state === 'waiting' && onCancel && <> <button type="button" class="link" onClick={onCancel}>Cancel</button></>}</p>
      </div>
    );
  }
  if (m.state === 'cancelled') return <p class="chat-queued">Cancelled. The team will not answer this one.</p>;
  const text = m.reply || (m.state === 'failed' ? '' : m.result);
  return (
    <div class={'chat-msg team' + (m.state === 'failed' ? ' failed' : '')}>
      {m.state === 'failed' && <p class="error">The team could not answer this one.{m.result ? ' ' + m.result : ''}</p>}
      {text ? <div class="prose" dangerouslySetInnerHTML={{ __html: render(text) }} /> : m.state !== 'failed' && <p class="meta">The team finished without a reply.</p>}
      <p class="chat-meta">{[m.finished ? when(m.finished) : '', m.cost].filter(Boolean).join(' · ')}</p>
    </div>
  );
}

function ConversationView({ index, thread, book, onChat, onDecide, waiting, demo }: {
  index: VaultIndex; thread: string; book: string; onChat?: OnChat; onDecide?: OnDecide; waiting: Record<string, Choice>; demo: boolean;
}) {
  const isNew = thread === 'new';
  const c = conversation(index, isNew ? '' : thread, book);
  const [words, setWords] = useState(() => takeChatPrefill(isNew ? '' : thread));
  const box = useRef<HTMLTextAreaElement>(null);
  // A first line filled in for Kyle (Ask the team about this scene): the cursor waits at its end.
  useEffect(() => { const b = box.current; if (b && words) { b.focus(); b.setSelectionRange(words.length, words.length); } }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const count = c.messages.length + c.messages.filter((m) => m.reply).length;
  useEffect(() => { if (end.current && count) end.current.scrollIntoView({ block: 'end' }); }, [count, thread]);

  const send = async () => {
    const w = words.trim();
    if (!w || !onChat || busy) return;
    setBusy(true);
    setError('');
    const r = await onChat(isNew ? 'new' : thread, w, c.book || book);
    setBusy(false);
    if ('error' in r) { setError(r.error); return; }
    setWords('');
    if (r.thread !== thread) location.replace(href.chat(r.thread, r.book));
  };
  const firstPending = c.messages.findIndex((m) => m.state === 'waiting' || m.state === 'working');
  const title = isNew ? 'New conversation' : c.title;

  return (
    <section class="chat-screen">
      <p class="crumb"><a href={href.chat()}><Icon name="left" size={16} /> All conversations</a></p>
      <div class="chat-head">
        <h1>{title}</h1>
        {c.scene && <a class="button" href={href.write(c.scene.path)}><Icon name="pen" size={18} /> Open the scene</a>}
      </div>
      {isSceneThread(thread) && !c.scene && <p class="meta">This conversation is about {thread}, which is not in the saved copy of the book.</p>}
      <div class="chat-log" aria-live="polite">
        {!c.messages.length && (
          <p class="chat-start">{isSceneThread(thread) ? 'Ask the team about this scene: what to cut, who knows what, how it should end.' : 'Ask the team anything about the book.'}</p>
        )}
        {c.messages.map((m, i) => (
          <div class="chat-pair" key={m.path}>
            <div class="chat-msg kyle">
              <div class="prose" dangerouslySetInnerHTML={{ __html: render(m.ask) }} />
              <p class="chat-meta">{when(m.created)}{waiting[m.path] ? (waiting[m.path].error ? ' · Not saved' : ' · Saving') : ''}</p>
            </div>
            <Reply m={m} first={i === firstPending} onCancel={onDecide ? () => onDecide(m.path, 'edit', '', { status: 'cancelled' }) : undefined} />
          </div>
        ))}
        <div ref={end} />
      </div>
      {onChat ? (
        <form class="chat-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label class="sr-only" for="chat-words">Your message</label>
          <textarea id="chat-words" ref={box} rows={3} value={words} disabled={busy} placeholder={c.messages.length ? 'Reply to the team' : 'Your question'}
            onInput={(e) => setWords((e.currentTarget as HTMLTextAreaElement).value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
          <button type="submit" class="primary" disabled={busy || !words.trim()}><Icon name="send" size={18} /> {busy ? 'Sending…' : 'Send'}</button>
        </form>
      ) : <p class="hint">Chatting with the team needs your own vault. Add it in <a href={href.settings()}>Settings</a>.</p>}
      {error && <p class="error">{error}</p>}
      {demo && onChat && <p class="hint">This is the demo vault: your message shows here, but nobody answers it.</p>}
      {c.pending && <p class="hint">This page checks for a reply every 15 seconds while it is open.</p>}
    </section>
  );
}

/** Chat with the team: conversations made of chat job notes. The vault's runner writes each reply into the note. */
export function ChatScreen({ index, thread, book, onChat, onDecide, waiting, demo }: {
  index: VaultIndex; thread: string; book: string; onChat?: OnChat; onDecide?: OnDecide; waiting: Record<string, Choice>; demo: boolean;
}) {
  if (!thread) return <ConversationList list={conversations(index)} />;
  if (thread !== 'new' && !isThread(thread)) {
    return <p class="empty">There is no conversation called {thread}. <a href={href.chat()}>See all conversations</a>.</p>;
  }
  return <ConversationView key={thread} index={index} thread={thread} book={book} onChat={onChat} onDecide={onDecide} waiting={waiting} demo={demo} />;
}

/** A scene's conversation in the writing screen's right-hand column: the same messages as the Chat screen, narrower,
 * with the newest at the bottom and the box to write in under them. */
export function SceneChat({ convo, thread, book, onChat, fullHref, page = '', onSent, intro }: {
  convo: Conversation | null; thread: string; book: string; onChat?: OnChat;
  /** The Chat screen's page for this conversation, opened with the page saved first. */
  fullHref?: { href: string; onClick?: (e: MouseEvent) => void };
  /** What Kyle is looking at, sent with each message (## Page). */
  page?: string;
  /** Told the thread a message went into (a new conversation gets its name when the first message is sent). */
  onSent?: (thread: string) => void;
  /** The line shown before the first message. */
  intro?: string;
}) {
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const messages = convo ? convo.messages : [];
  const count = messages.length + messages.filter((m) => m.reply).length;
  useEffect(() => { if (end.current && count) end.current.scrollIntoView({ block: 'nearest' }); }, [count]);
  const send = async () => {
    const w = words.trim();
    if (!w || !onChat || busy) return;
    setBusy(true);
    setError('');
    const r = await onChat(thread, w, book, page);
    setBusy(false);
    if ('error' in r) { setError(r.error); return; }
    setWords('');
    if (onSent) onSent(r.thread);
  };
  const firstPending = messages.findIndex((m) => m.state === 'waiting' || m.state === 'working');
  return (
    <div class="writer-panel side-chat">
      <div class="chat-log" aria-live="polite">
        {!messages.length && <p class="hint">{intro || 'Ask the team about this scene while you write: what she would wear, how a squash vine looks after a storm, what to cut. The answer comes here.'}</p>}
        {messages.map((m, i) => (
          <div class="chat-pair" key={m.path}>
            <div class="chat-msg kyle"><div class="prose" dangerouslySetInnerHTML={{ __html: render(m.ask) }} /></div>
            <Reply m={m} first={i === firstPending} />
          </div>
        ))}
        <div ref={end} />
      </div>
      {onChat ? (
        <form class="chat-compose side" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label class="sr-only" for="side-chat-words">Your message</label>
          <textarea id="side-chat-words" rows={3} value={words} disabled={busy} placeholder={messages.length ? 'Reply to the team' : 'Ask the team'}
            onInput={(e) => setWords((e.currentTarget as HTMLTextAreaElement).value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
          <button type="submit" class="primary" disabled={busy || !words.trim()} aria-label="Send"><Icon name="send" size={18} /><span class="bar-label">{busy ? 'Sending…' : 'Send'}</span></button>
        </form>
      ) : <p class="hint">Chatting with the team needs your own vault.</p>}
      {error && <p class="error">{error}</p>}
      {messages.length > 0 && fullHref && <a class="link" {...fullHref}>Open this conversation full size</a>}
    </div>
  );
}

/** The team column beside a board or page: one conversation per book on this device, with what is on screen sent along
 * with each message so the team can guess what Kyle means. New conversation starts another; the Chat screen shows it full size. */
export function TeamSide({ index, sourceKey, book, page, where, onChat, onClose }: {
  index: VaultIndex; sourceKey: string;
  /** The book's folder, or '' when no book is on screen (the active book is used). */
  book: string;
  /** The ## Page text for each message. */
  page: string;
  /** The page's name, for the line under the heading. */
  where: string;
  onChat?: OnChat;
  onClose: () => void;
}) {
  const [thread, setThread] = useState(() => loadSideThread(sourceKey, book));
  useEffect(() => { setThread(loadSideThread(sourceKey, book)); }, [sourceKey, book]);
  const c = thread === 'new' ? null : conversation(index, thread, book);
  const pick = (t: string) => { saveSideThread(sourceKey, book, t); setThread(t); };
  return (
    <aside class="team-side" aria-label="Chat with the team">
      <div class="team-side-head">
        <div class="team-side-title">
          <h2>{c && c.messages.length ? c.title : 'Chat with the team'}</h2>
          <p class="meta">The team sees you are on {where}.</p>
        </div>
        {thread !== 'new' && (
          <button type="button" class="icon-button" title="New conversation" aria-label="New conversation" onClick={() => pick('new')}><Icon name="plus" size={20} /></button>
        )}
        <button type="button" class="icon-button" title="Hide the chat" aria-label="Hide the chat" onClick={onClose}><Icon name="right" size={20} /></button>
      </div>
      <SceneChat key={thread} convo={c} thread={thread} book={book} onChat={onChat} page={page}
        onSent={(t) => { if (t !== thread) pick(t); }}
        fullHref={thread !== 'new' ? { href: href.chat(thread, c ? c.book : book) } : undefined}
        intro="Ask the team about what is on this page: which ideas to keep, what a character wants, what the next chapter needs. The answer comes here, and the conversation follows you from page to page." />
    </aside>
  );
}
