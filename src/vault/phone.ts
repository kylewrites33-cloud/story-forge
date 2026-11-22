// Kyle's choices from his phone, put in by Sparrow itself (2026-11-21). Kyle: "let the phone record my choices, and the
// ipad apply it when i next open it", then "no send button necessary if its automatic". Sparrow Pocket writes the choices
// to a phone note in the book's Phone/ folder (src/lib/phone-choices.ts has the format). When a book is opened here,
// and on each sync while it is open, its waiting phone notes are put in through the Edit room's own actions, in the
// order Kyle made them, as if he had pressed them here: Accept or a version (the card's words into the scene, the
// answer on the changes note with the to-dos it ticks), Reject, a tweak (Edit, then accept), Reply to the Writer, and a
// paragraph rewritten (the writing page's scene save). A choice that no longer fits is skipped, never forced.
// Write mode's choices on beats (2026-11-21; Kyle: "can you make a writing mode, too? ... i can open each beat and write
// in it, rewrite beat titles, and add, delete, or move beats arond") go in as Beats mode makes them
// (src/lib/phone-beats.ts). Since 2026-11-22 a beat's words are Kyle's planning notes, never prose (Kyle: "when I write
// on beat mode, the text doesn't go into the word processor"), so they change the beats note only: a deleted beat's
// notes go to the book's Archive first, and notes whose same lines changed here too keep both, the phone's under these.
//
// Safe twice over: a note is claimed first (one save; another device leaves it for ten minutes), each choice that is
// already so counts as put in rather than being made again, and the result of each choice is written on the note by
// its number, so nothing is put in twice and a choice the phone added meanwhile waits for the next run.
import { applyChange, CHANGES_TYPE, changesNoteFor, parseChanges, todoEdits, tweakStatus, type Change, type ChangeStatus } from '../lib/changes.ts';
import { BEATS_TYPE, beatsNoteFor, beatsPath, beatsTitle } from '../lib/beats.ts';
import { loadDrafts, mergeNotice, openDraft, putDraft, splitLead, type Draft } from '../lib/drafts.ts';
import { Frontmatter } from '../lib/frontmatter.js';
import { aliasMap, beatStep, idChangesBetween, type ChapterText } from '../lib/phone-beats.ts';
import { byStart, cleanParagraph, isBeatKind, labelOf, PHONE_FOLDER, PHONE_TYPE, readChoices, resultSaid, rewriteInto, withAliases, type PhoneChoice } from '../lib/phone-choices.ts';
import { propNum, propText } from '../lib/props.ts';
import { bookTodos } from '../lib/todos.ts';
import type { BookEntry, DeviceFile, NoteRecord, Schema, VaultIndex, VaultSource } from '../lib/types.ts';
import { replyAction } from '../team/reply.ts';
import { overlayActions } from './apply.ts';
import { filesAction, marksAction, textAction, type Action } from './ops.ts';
import { pushAction } from './push.ts';
import { saveDraft, saveSnapshot } from './words.ts';

/** What happened to one choice, as the notice lists it. */
export interface PhoneResult {
  note: string;
  n: number;
  /** What he chose, with the card or scene: "Use version 2 on C-03". */
  what: string;
  chapter: number;
  /** "applied", "applied (it was already so)", "kept as a copy. <why>" or "skipped. <why>", and after it the beats
   * whose IDs it changed (phone-choices.ts, withAliases), which the notice leaves out. */
  result: string;
}

export const isApplied = (r: { result: string }): boolean => /^applied/.test(r.result);
export const isCopied = (r: { result: string }): boolean => /^kept as a copy/.test(r.result);

/** The book's phone notes that still have choices to put in (or none left at all), oldest first. */
export function waitingPhoneNotes(index: VaultIndex, bookFolder: string): NoteRecord[] {
  const dir = bookFolder + '/' + PHONE_FOLDER + '/';
  return Object.values(index.notes)
    .filter((n) => n.type === PHONE_TYPE && n.path.startsWith(dir) && propText(n, 'status') !== 'applied')
    .sort((a, b) => byStart(a.path, b.path));
}

const SAID: Record<ChangeStatus, string> = { open: 'open', kept: 'accepted', other: 'version 2 used', no: 'rejected', mine: 'your own words', rewrite: 'handled in the rewrite', replaced: 'replaced' };

export function whatOf(c: PhoneChoice): string {
  if (isBeatKind(c.kind)) return labelOf(c) + (c.beatName ? ', ' + c.beatName : '');
  return labelOf(c) + (c.card ? ' on ' + c.card : c.scene ? ' in ' + c.scene : '');
}

/** Every ID change the iPad has written on the book's phone notes, oldest first. */
function bookAliases(index: VaultIndex, bookFolder: string): Map<string, string> {
  const dir = bookFolder + '/' + PHONE_FOLDER + '/';
  const notes = Object.values(index.notes).filter((n) => n.type === PHONE_TYPE && n.path.startsWith(dir)).sort((a, b) => byStart(a.path, b.path));
  return aliasMap(notes.flatMap((n) => readChoices(n.body).map((c) => c.result)));
}

/** A chapter's scenes and beats note as this device has them: by the chapter's own ID, else its number. */
export function chapterText(index: VaultIndex, book: BookEntry, ref: { chapter: number; chapterId: string }, bodyOf: (n: NoteRecord) => string,
  made: Record<string, string> = {}): ChapterText | null {
  const scenes = book.scenes.map((p) => index.notes[p]).filter((n) => n && (ref.chapterId ? propText(n, 'chapter_id') === ref.chapterId : propNum(n, 'chapter') === ref.chapter));
  if (!scenes.length) return null;
  const num = propNum(scenes[0], 'chapter') || ref.chapter;
  const note = beatsNoteFor(index.notes, book.folder, num);
  const path = note ? note.path : beatsPath(book.folder, num);
  return {
    chapter: num, beatsPath: path,
    beatsBody: note ? bodyOf(note) : path in made ? made[path] : null,
    scenes: scenes.map((n) => ({ path: n.path, id: propText(n, 'id'), body: bodyOf(n) }))
  };
}

/** The chapters a choice can change the words of. */
function chapterOfChoice(c: PhoneChoice): { chapter: number; chapterId: string } {
  return { chapter: c.chapter, chapterId: c.chapterId };
}

export interface PhonePlan {
  results: PhoneResult[];
  /** The answers and replies, one action per press, in order, as the Edit room makes them. */
  actions: Action[];
  /** The scenes (and beats notes) whose words change: path to the new body. */
  bodies: Record<string, string>;
  /** Beats notes the chapter did not have yet: path to the properties they start with (as Beats mode starts one). */
  creates: Record<string, string>;
  /** Deleted beats' words, for the book's Archive, saved before anything else. */
  files: DeviceFile[];
  /** The phone's words where the same lines changed here too: a copy of the scene with them in. */
  copies: { path: string; scene: string; body: string }[];
}

/** Work out each choice in order against the vault as this device has it. `index` is the saved copy, `waiting` the
 * outbox; `bodyOf` gives a scene's body with any words still waiting on this device. Pure. */
export function planPhone(index: VaultIndex, waiting: Action[], schema: Schema | null, book: BookEntry,
  choices: (PhoneChoice & { note: string })[], bodyOf: (n: NoteRecord) => string, now: Date): PhonePlan {
  const actions: Action[] = [];
  const bodies: Record<string, string> = {};
  const creates: Record<string, string> = {};
  const files: DeviceFile[] = [];
  const copies: PhonePlan['copies'] = [];
  const results: PhoneResult[] = [];
  const alias = bookAliases(index, book.folder);
  const view = () => overlayActions(index, waiting.concat(actions), schema);
  const scenes = (v: VaultIndex) => book.scenes.map((p) => v.notes[p]).filter(Boolean);
  const body = (n: NoteRecord) => (n.path in bodies ? bodies[n.path] : bodyOf(n));
  const page = (n: NoteRecord) => splitLead(body(n)).text;
  const setPage = (n: NoteRecord, text: string) => { bodies[n.path] = splitLead(body(n)).lead + text; };

  const anyBody = (n: NoteRecord) => (n.path in bodies ? bodies[n.path] : bodyOf(n));

  choices.forEach((c) => {
    const before = { ...bodies };
    const ref = chapterOfChoice(c);
    const was = chapterText(index, book, ref, (n) => (n.path in before ? before[n.path] : bodyOf(n)), before);
    let pairs: [string, string][] = [];
    const said = (result: string) => {
      // A card or a paragraph that changed a beat's first words gives it a new ID: written after the result.
      if (!isBeatKind(c.kind) && was && /^applied/.test(result)) {
        const now = chapterText(index, book, ref, anyBody, bodies);
        if (now) pairs = idChangesBetween(was, now);
      }
      pairs.forEach(([a, b]) => alias.set(a, b));
      results.push({ note: c.note, n: c.n, what: whatOf(c), chapter: c.chapter, result: withAliases(result, pairs) });
    };
    const skip = (why: string) => said('skipped. ' + why);
    if (isBeatKind(c.kind)) {
      if (!was) return skip('Chapter ' + c.chapter + ' has no scenes any more.');
      const st = beatStep(was, c, alias, book.folder, now);
      if (/^applied/.test(st.result) && st.result !== 'applied (it was already so)') {
        st.ch.scenes.forEach((x, i) => { if (x.body !== was.scenes[i].body) bodies[x.path] = x.body; });
        if (st.beatsChanged && st.ch.beatsBody != null) {
          if (was.beatsBody == null && !(st.ch.beatsPath in creates)) creates[st.ch.beatsPath] = Frontmatter.join({ type: BEATS_TYPE, title: beatsTitle(st.ch.chapter), chapter: st.ch.chapter }, '');
          bodies[st.ch.beatsPath] = st.ch.beatsBody;
        }
        if (st.archive) files.push({ path: st.archive.path, taken: 'next', text: st.archive.text, message: st.archive.message });
      }
      if (st.copy) copies.push(st.copy);
      pairs = st.aliases;
      return said(st.result);
    }
    const v = view();
    if (c.kind === 'rewrite') {
      const s = scenes(v).find((n) => propText(n, 'id') === c.scene);
      if (!s) return skip(c.scene + ' is not in the book any more.');
      const t = rewriteInto(page(s), c.was, c.now);
      if (t != null) { setPage(s, t); return said('applied'); }
      const mine = cleanParagraph(c.now);
      if (page(s).indexOf(c.was) < 0 && (mine ? page(s).indexOf(mine) >= 0 : true)) return said('applied (it was already so)');
      return skip('The paragraph is not in ' + c.scene + ' exactly as your phone saw it any more.');
    }
    // The chapter's changes note: by the chapter's own ID, else by its number.
    const note = c.chapterId
      ? Object.values(v.notes).find((n) => n.type === CHANGES_TYPE && n.path.startsWith(book.folder + '/') && propText(n, 'chapter_id') === c.chapterId) || null
      : changesNoteFor(v.notes, book.folder, c.chapter);
    if (!note) return skip('Chapter ' + c.chapter + ' has no change cards any more.');
    const all = parseChanges(note.body).changes;
    const card = all.find((x) => x.id === c.card);
    if (!card) return skip(c.card + ' is not on chapter ' + propNum(note, 'chapter') + '\'s cards any more.');
    if (c.kind === 'tell') {
      if ((card.replies || []).indexOf(c.words.trim()) >= 0) return said('applied (it was already so)');
      try {
        actions.push(replyAction(index, waiting.concat(actions), schema, note.path, card.id, c.words, book.folder, propNum(note, 'chapter'), now));
      } catch (e) { return skip((e as Error).message); }
      return said('applied');
    }
    // Accept, a version, a tweak, Reject: what the card's answer becomes.
    let status: ChangeStatus = 'no';
    let put: Change | null = null;
    if (c.kind === 'use') {
      const which = c.version === 2 ? card.other : card.now;
      if (which == null || which !== c.words) return skip(card.id + '\'s words changed after your phone showed them.');
      status = c.version === 2 ? 'other' : 'kept';
      put = { ...card, now: which };
    } else if (c.kind === 'tweak') {
      status = tweakStatus(card, c.words);
      put = { ...card, now: c.words };
    }
    if (card.status !== 'open') {
      if (card.status === status) return said('applied (it was already so)');
      return skip(card.id + ' was already decided here (' + SAID[card.status] + ').');
    }
    if (put) {
      // The scene the card names, else the chapter's scene that has its words (the Edit room's page or the scene beside it).
      const inCh = scenes(v).filter((n) => (c.chapterId ? propText(n, 'chapter_id') === c.chapterId : propNum(n, 'chapter') === propNum(note, 'chapter')));
      const where = card.scene ? scenes(v).filter((n) => propText(n, 'id') === card.scene) : inCh;
      let done = false;
      for (const s of where) {
        const r = applyChange(page(s), put, 'now');
        if (r) { setPage(s, r.text); done = true; break; }
      }
      if (!done) return skip('The words ' + card.id + ' changes are not on the page as it quotes them any more.');
    }
    // The answer, with the to-dos it ticks: the Edit room's record().
    const after = all.map((x) => (x.id === card.id ? { ...x, status } : x));
    const at = now.toISOString();
    const ticks = todoEdits(after, [card.id], bookTodos(v, book));
    actions.push(marksAction(note.path, { [card.id]: status }, ticks.map((t) => ({ path: t.path, decision: 'edit' as const, reason: '', at, fields: t.fields })), now));
    said('applied');
  });
  return { results, actions, bodies, creates, files, copies };
}

/** What the app hands over to put phone notes in. */
export interface PhoneRun {
  source: VaultSource;
  sourceKey: string;
  schema: Schema | null;
  book: BookEntry;
  /** The saved copy and the outbox, as they are now. */
  index: () => VaultIndex;
  waiting: () => Action[];
  /** Put actions in the outbox and send them (the app's own outbox and push). */
  send: (actions: Action[]) => Promise<void>;
  /** Put notes just saved into the saved copy. */
  fold: (saved: NoteRecord[]) => Promise<void>;
  now?: () => Date;
}

export interface PhoneReport {
  results: PhoneResult[];
  /** A plain sentence about scene words that met changes made elsewhere, as the writing page says it. */
  notice: string | null;
}

/** Put the book's waiting phone notes in. Answers null when there was nothing to do (or another device is doing it). */
export async function applyPhoneNotes(run: PhoneRun): Promise<PhoneReport | null> {
  const now = run.now || (() => new Date());
  const notes = waitingPhoneNotes(run.index(), run.book.folder);
  if (!notes.length || !run.source.commit) return null;
  // Claim each note: one save each, so two devices never put the same note in at once.
  const mine: NoteRecord[] = [];
  for (const n of notes) {
    const at = now().toISOString();
    const res = await pushAction(run.source, textAction([{ path: n.path, change: { what: 'phone-claim', at } }], [], now()));
    const got = res.saved.find((x) => x.path === n.path);
    if (!got) continue;
    await run.fold([got]);
    if (propText(got, 'status') === 'applying' && propText(got, 'claimed') === at.slice(0, 19) + 'Z') mine.push(got);
  }
  if (!mine.length) return null;
  const choices = mine.flatMap((n) => readChoices(n.body).filter((c) => !c.result).map((c) => ({ ...c, note: n.path })));
  const drafts = loadDrafts(run.sourceKey);
  const plan = planPhone(run.index(), run.waiting(), run.schema, run.book, choices, (n) => openDraft(n, drafts[n.path], now()).body, now());
  // A deleted beat's words go to the book's Archive first, as Beats mode sends them.
  if (plan.files.length) await run.send([filesAction(plan.files, [], now())]);
  // The phone's words that met the same lines changed here: a copy of the scene, as the writing page keeps one.
  const copied: string[] = [];
  for (const cp of plan.copies) {
    const note = run.index().notes[cp.path];
    if (!note) continue;
    try { await saveSnapshot(run.source, note, cp.body, 'from your phone', now()); copied.push(cp.scene); } catch { /* the result says where they were meant to go; the phone note keeps them */ }
  }
  // The scenes' words, then the beats notes: kept on this device first, then saved as the writing page saves them.
  const merged: string[] = [], clashed: string[] = [];
  const paths = Object.keys(plan.bodies).sort((a, b) => Number(a in plan.creates || isBeats(run.index(), a)) - Number(b in plan.creates || isBeats(run.index(), b)));
  for (const path of paths) {
    const note = run.index().notes[path];
    let d: Draft;
    if (note) d = { ...openDraft(note, loadDrafts(run.sourceKey)[path], now()), body: plan.bodies[path], updatedAt: now().toISOString(), pending: true };
    else if (path in plan.creates) d = { path, baseSha: '', baseBody: '', body: plan.bodies[path], target: null, startWords: 0, updatedAt: now().toISOString(), pending: true, create: plan.creates[path] };
    else continue;
    putDraft(run.sourceKey, path, d);
    try {
      const r = await saveDraft(run.source, d, now());
      const still = loadDrafts(run.sourceKey)[path];
      if (still && still.body === d.body) putDraft(run.sourceKey, path, null);
      await run.fold([r.note]);
      const name = propText(r.note, 'id') || propText(r.note, 'title');
      if (r.clash) clashed.push(name); else if (r.merged) merged.push(name);
    } catch { /* the words wait on this device and go up with the next sync, as the writing page's do */ }
  }
  // The answers and replies, through the outbox, in order.
  if (plan.actions.length) await run.send(plan.actions);
  // Each result on its note.
  for (const n of mine) {
    const results = plan.results.filter((r) => r.note === n.path).map((r) => ({ n: r.n, result: r.result }));
    const res = await pushAction(run.source, textAction([{ path: n.path, change: { what: 'phone-results', results, at: now().toISOString() } }], [], now()));
    await run.fold(res.saved);
  }
  const copyLine = copied.length ? 'Your phone wrote in ' + copied.join(', ') + ' on the same lines as this iPad. These words are kept; your phone\'s are in the scene\'s Copies, named “from your phone”.' : '';
  return { results: plan.results, notice: [mergeNotice(merged, clashed), copyLine].filter(Boolean).join(' ') || null };
}

const isBeats = (index: VaultIndex, path: string) => Boolean(index.notes[path] && index.notes[path].type === BEATS_TYPE);

/** The notice for Kyle: "12 choices from your phone applied. 2 skipped." */
export function reportLine(results: PhoneResult[]): string {
  const put = results.filter(isApplied).length;
  const copies = results.filter(isCopied).length;
  const skipped = results.length - put - copies;
  return put + (put === 1 ? ' choice' : ' choices') + ' from your phone applied.' + (copies ? ' ' + copies + ' kept as a copy.' : '') + (skipped ? ' ' + skipped + ' skipped.' : '');
}

/** A result as the notice shows it. */
export const resultLine = (r: PhoneResult): string => resultSaid(r.result);

/** How many of the phone's choices that change words wait for this chapter (the writing screen's bar). */
export function phoneWritingFor(index: VaultIndex, bookFolder: string, scene: NoteRecord): number {
  const id = propText(scene, 'chapter_id'), num = propNum(scene, 'chapter');
  return waitingPhoneNotes(index, bookFolder).flatMap((n) => readChoices(n.body).filter((c) => !c.result))
    .filter((c) => (id && c.chapterId ? c.chapterId === id : c.chapter === num))
    .filter((c) => isBeatKind(c.kind) || c.kind === 'rewrite' || c.kind === 'use' || c.kind === 'tweak').length;
}
