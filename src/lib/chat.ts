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
    // A scene ID is only unique inside its book (Book 1 and Book 2 both have an S-012), so a scene's talk is per book.
    const key = isSceneThread(t) ? str(n.data.book) + '\n' + t : t;
    if (!by.has(key)) by.set(key, []);
    by.get(key)!.push(n);
  });
  const out: Conversation[] = [];
  by.forEach((notes, key) => {
    const thread = key.slice(key.indexOf('\n') + 1);
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
  const same = (c: Conversation) => c.thread === thread && (!isSceneThread(thread) || !book || c.book === book);
  return conversations(index).find(same) || build(index, thread, [], book);
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

/** The writing screen's team tools, like Sudowrite's: each sends one message about the words on the page to the
 * scene's conversation. The team answers there and never changes the scene; Kyle copies what he likes. */
export type PassageTool = 'rewrite' | 'describe' | 'brainstorm' | 'write-on';

export const PASSAGE_TOOLS: { key: PassageTool; label: string; hint: string }[] = [
  { key: 'rewrite', label: 'Rewrite', hint: 'Three other ways to write the words you picked' },
  { key: 'describe', label: 'Describe', hint: 'Sights, sounds, smells, touch and taste for the words you picked' },
  { key: 'brainstorm', label: 'Brainstorm', hint: 'Ideas for what could happen next, from where the cursor is' },
  { key: 'write-on', label: 'Write on', hint: 'A suggestion for the next few paragraphs, from where the cursor is' }
];

/** The words a tool works on: the selection, or else the paragraph around the cursor (Rewrite, Describe), or the
 * text up to the cursor (Brainstorm, Write on). Long text keeps its end, the part nearest the cursor. */
export function passageFor(tool: PassageTool, text: string, sel: { start: number; end: number } | null): string {
  const t = String(text || '');
  const s = sel ? { start: Math.max(0, Math.min(sel.start, sel.end, t.length)), end: Math.min(t.length, Math.max(sel.start, sel.end)) } : null;
  if (s && s.end > s.start) return t.slice(s.start, s.end).trim();
  const at = s ? s.start : t.length;
  if (tool === 'rewrite' || tool === 'describe') {
    const a = t.lastIndexOf('\n\n', Math.max(0, at - 1));
    const b = t.indexOf('\n\n', at);
    const para = t.slice(a < 0 ? 0 : a + 2, b < 0 ? t.length : b).trim();
    if (para) return para;
  }
  const before = t.slice(0, at).trim();
  return before.length > 1500 ? '…' + before.slice(-1500).replace(/^\S*\s/, '') : before;
}

/** Kyle's message for a tool, in his voice, with the passage quoted. */
export function passageMessage(tool: PassageTool, scene: string, passage: string): string {
  const quoted = passage.trim() ? '\n\n' + passage.trim().split('\n').map((l) => '> ' + l).join('\n') : '';
  const keep = ' Follow the book\'s Style Guide and my style. Don\'t change the scene; I\'ll copy what I like.';
  switch (tool) {
    case 'rewrite':
      return 'Rewrite this passage from ' + scene + ' three different ways, each one short and labelled.' + keep + quoted;
    case 'describe':
      return 'Give me sensory details for this moment in ' + scene + ': what the point-of-view character sees, hears, smells, touches and tastes, two or three short lines each.' + keep + quoted;
    case 'brainstorm':
      return 'Brainstorm eight ideas for what could happen next in ' + scene + ', from where this passage ends. Make one of them the Contrarian\'s pick, and say which.' + keep + quoted;
    default:
      return 'Write a suggestion for the next 150 to 250 words of ' + scene + ', carrying on from where this passage ends.' + keep + quoted;
  }
}
