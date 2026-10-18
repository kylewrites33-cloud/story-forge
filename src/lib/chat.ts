// Chat with the team: each message Kyle sends is one job note of kind chat. Its `thread` names the conversation, either
// a scene ID such as S-012 (a conversation about that scene) or chat-NNN (a general one). The vault's runner answers a
// chat job by reading every earlier chat job in the same thread with a lower ID, then writing ## Result, a one-line
// `result` and status done. So a conversation is just its jobs in ID order: Kyle's words (## Ask) and the team's reply.
import { askBody, costLabel, jobNotes, resultBody, type NewJob } from './jobs.ts';
import { idNumber } from './links.ts';
import type { NoteRecord, VaultIndex } from './types.ts';

export type MessageState = 'waiting' | 'working' | 'done' | 'failed' | 'cancelled';

export interface ChatMessage {
  path: string;
  id: string;
  /** Kyle's words. */
  ask: string;
  /** The team's reply (Markdown), or '' while there is none. */
  reply: string;
  /** The one-line summary the runner writes, shown when a finished job has no ## Result. */
  result: string;
  state: MessageState;
  /** "about $0.42", or ''. */
  cost: string;
  created: string;
  finished: string;
}

export interface Conversation {
  thread: string;
  /** The book the conversation belongs to, from its first message. */
  book: string;
  /** The scene note for a scene thread, when the book has it. */
  scene: NoteRecord | null;
  title: string;
  messages: ChatMessage[];
  /** The latest time anything happened, as the vault writes it ("2026-10-18" or "2026-10-18T09:09"). */
  activity: string;
  /** True while a message still has no reply and the team has not given up on it. */
  pending: boolean;
}

const SCENE_THREAD = /^S-\d{3,}$/;
const CHAT_THREAD = /^chat-(\d+)$/;

export function isSceneThread(thread: string): boolean {
  return SCENE_THREAD.test(thread);
}

/** A thread name the app accepts in a link: a scene ID or chat-NNN. */
export function isThread(thread: string): boolean {
  return SCENE_THREAD.test(thread) || CHAT_THREAD.test(thread);
}

function state(status: unknown): MessageState {
  switch (String(status || 'requested')) {
    case 'running': return 'working';
    case 'done': return 'done';
    case 'failed': return 'failed';
    case 'cancelled': return 'cancelled';
    default: return 'waiting';
  }
}

const str = (v: unknown) => (v == null ? '' : String(v));

/** The first words of Kyle's message, cut at a word, for a title. */
export function firstWords(text: string, max = 48): string {
  const s = String(text || '').replace(/(^|\n)[ \t]*(?:[-+*]|\d+[.)])[ \t]+/g, '$1').replace(/[*_`#>[\]]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[\s,.;:!?-]+$/, '');
  return (cut || s.slice(0, max - 1)) + '…';
}

export function toMessage(n: NoteRecord): ChatMessage {
  const d = n.data;
  return {
    path: n.path,
    id: str(d.id),
    ask: askBody(n.body),
    reply: resultBody(n.body),
    result: str(d.result),
    state: state(d.status),
    cost: costLabel(d.cost_usd),
    created: str(d.created),
    finished: str(d.finished || d.started)
  };
}

/** The scene a scene thread is about: in the given book first, else the first book that has that ID. */
export function sceneFor(index: VaultIndex, thread: string, book: string): NoteRecord | null {
  if (!isSceneThread(thread)) return null;
  const books = index.books.slice().sort((a, b) => (a.folder === book ? -1 : 0) - (b.folder === book ? -1 : 0));
  for (const b of books) {
    for (const p of b.scenes) {
      const n = index.notes[p];
      if (n && str(n.data.id) === thread) return n;
    }
  }
  return null;
}

/** What a conversation is called: "S-012 The Ferry" for a scene, or the first words of Kyle's first message. */
export function conversationTitle(thread: string, scene: NoteRecord | null, firstAsk: string): string {
  if (isSceneThread(thread)) return scene && scene.data.title ? thread + ' ' + str(scene.data.title) : thread;
  return firstWords(firstAsk) || 'New conversation';
}

/** Every chat job in the vault, by thread, each in ID order; newest activity first (see the sort below). */
export function conversations(index: VaultIndex): Conversation[] {
  const by = new Map<string, NoteRecord[]>();
  jobNotes(index).forEach((n) => {
    if (str(n.data.kind) !== 'chat') return;
    const t = str(n.data.thread).trim();
    if (!t) return;
    if (!by.has(t)) by.set(t, []);
    by.get(t)!.push(n);
  });
  const out: Conversation[] = [];
  by.forEach((notes, thread) => {
    notes.sort((a, b) => (idNumber(a.data.id) || 0) - (idNumber(b.data.id) || 0) || a.path.localeCompare(b.path));
    out.push(build(index, thread, notes, ''));
  });
  // Newest day first, then, inside a day, the conversation with the newest message. (A message only has the day it was
  // sent, while a reply has its time, so times alone would put a question sent this afternoon below a reply from 9:00.)
  const last = (c: Conversation) => (c.messages.length ? idNumber(c.messages[c.messages.length - 1].id) || 0 : 0);
  return out.sort((a, b) => b.activity.slice(0, 10).localeCompare(a.activity.slice(0, 10)) || last(b) - last(a) || b.activity.localeCompare(a.activity));
}

function build(index: VaultIndex, thread: string, notes: NoteRecord[], book: string): Conversation {
  const messages = notes.map(toMessage);
  const folder = (notes.length ? str(notes[0].data.book) : '') || book;
  const scene = sceneFor(index, thread, folder);
  const activity = messages.reduce((m, x) => [x.finished, x.created].reduce((a, v) => (v > a ? v : a), m), '');
  return {
    thread,
    book: folder,
    scene,
    title: conversationTitle(thread, scene, messages.length ? messages[0].ask : ''),
    messages,
    activity,
    pending: messages.some((m) => m.state === 'waiting' || m.state === 'working')
  };
}

/** One conversation, or an empty one when nothing has been said in that thread yet (a scene's first talk). */
export function conversation(index: VaultIndex, thread: string, book = ''): Conversation {
  return conversations(index).find((c) => c.thread === thread) || build(index, thread, [], book);
}

/** The next free general conversation: chat-001, chat-002 and so on, after the highest one any job names. */
export function nextChatThread(index: VaultIndex): string {
  let max = 0;
  jobNotes(index).forEach((n) => {
    const m = CHAT_THREAD.exec(str(n.data.thread).trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'chat-' + String(max + 1).padStart(3, '0');
}

/** The job for one message. A message may follow one that has no reply yet: the runner answers them in ID order. */
export function chatJob(thread: string, words: string, book: string): NewJob {
  const ask = String(words || '').trim();
  return {
    title: firstWords(ask, 60) || 'Chat',
    kind: 'chat',
    target: isSceneThread(thread) ? thread : '',
    book,
    ask,
    thread
  };
}
