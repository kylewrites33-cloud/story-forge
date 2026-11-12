// What the app keeps on a device, in one place (2026-11-12, step 6 of the code structure redesign). Every name the app
// stores under is in `PREF`, and every read and write goes through the functions here: nothing else in src/ names
// localStorage or sessionStorage (tests/prefs.test.ts holds both rules). Before, 30 files each named their own key and
// wrapped their own try and catch. The names are the ones the devices already hold, so nothing has to be moved.
//
// A device's storage can be missing or refuse (private mode, full): reads then answer null and writes do nothing, and
// the app carries on for that visit.

/** 'device': kept until Kyle clears the browser (localStorage). 'visit': kept until the tab closes (sessionStorage). */
export type Where = 'device' | 'visit';

/** The device's storage itself, for the few modules whose tests hand them a pretend one; null when there is none. */
export function storeOf(where: Where = 'device'): Storage | null {
  try { return (where === 'visit' ? globalThis.sessionStorage : globalThis.localStorage) ?? null; } catch { return null; }
}

/** The words kept under this name, or null. */
export function readPref(key: string, where: Where = 'device'): string | null {
  try { const s = storeOf(where); return s ? s.getItem(key) : null; } catch { return null; }
}

/** Keep these words under this name; null forgets them. */
export function writePref(key: string, value: string | null, where: Where = 'device'): void {
  try {
    const s = storeOf(where);
    if (!s) return;
    if (value == null) s.removeItem(key); else s.setItem(key, value);
  } catch { /* the device would not keep it: it lasts for this visit */ }
}

/** What is kept under this name, read as JSON; null when there is nothing or it cannot be read. */
export function readJson(key: string, where: Where = 'device'): unknown {
  const raw = readPref(key, where);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function writeJson(key: string, value: unknown, where: Where = 'device'): void {
  writePref(key, value == null ? null : JSON.stringify(value), where);
}

/** Every name the app keeps something under. A name ending in '.' or ':' has more after it (the vault, a book, a
 * chapter). The names never change once a device may hold them: a new meaning gets a new name. */
export const PREF = {
  // ---- The connection and the vault's waiting work (data, not settings)
  settings: 'story-forge.settings', // which vault, and Kyle's key for it (never leaves the browser)
  outbox: 'story-forge.outbox.', // changes waiting to go to the vault, per vault
  landed: 'story-forge.landed.', // what went up and is not in the device's copy of the vault yet
  oldQueue: 'story-forge.queue.', // where choices waited before the outbox (until 2026-11-11); read once
  drafts: 'story-forge.drafts.', // words being typed, per vault
  syncNotice: 'story-forge.sync-notice.', // the last sync's note for Kyle
  changeChoices: 'story-forge.change-choices.', // Keep or No choices from before the outbox; read once
  changeRules: 'story-forge.change-rules.', // swaps Kyle accepted everywhere
  changeRulesSkip: 'story-forge.change-rules-skip.', // changes he undid after Accept everywhere
  dots: 'story-forge.added.', // lines the team added to an open page, dotted until he has seen them
  seenJobs: 'story-forge.seen-jobs.', // finished jobs he has seen on the Overview
  filledOld: 'story-forge.filled.', // brace answers used, the older per-device way (read once; see src/team/asks.ts)
  optionsDoneOld: 'story-forge.options-done.', // options dealt with, the older per-device way (read once)
  recent: 'story-forge.recent.', // scenes opened lately, per vault
  // ---- The Pomodoro timer and the typing counts
  pomodoro: 'sf-pomodoro', // the running timer
  pomodoroLog: 'sf-pomodoro-log:', // finished sessions waiting to be written to the Writing Log
  typed: 'sf-typed', // words typed, waiting to be logged
  typing: 'sf-typing', // minutes of typing, waiting to be logged
  timerSounds: 'sf-timer-sounds', // which bird ends writing and the break
  // ---- How the app looks on this device
  theme: 'story-forge.theme',
  pageLook: 'story-forge.page-look', // the writing page's font, width, where { } notes sit
  pageLookAsksLeft: 'story-forge.page-look.asks-left', // the one-time move of margin notes to the left (2026-11-06)
  topRoom: 'sparrow.top-room', // what the top bar shows
  listen: 'story-forge.listen', // Listen's speed and voice
  readRates: 'story-forge.read-rates', // words a page, words a minute
  checkShow: 'story-forge.check-show', // AI-phrase marks on the page: absent is on
  fillAuto: 'story-forge.fill-auto', // fill { } on their own
  // ---- Where each page was left
  panelTab: 'story-forge.panel-tab', // the writing page's side column tab
  sideChapters: 'story-forge.chapters', // chapter list open or closed
  sidePanel: 'story-forge.scene-panel', // side column open or closed
  sideTools: 'story-forge.side-tools',
  shownScenes: 'story-forge.shown-scenes.', // chapters whose scenes show in the list, per book
  chapterListScroll: 'story-forge.chapter-list-scroll.', // per book
  sideChat: 'story-forge.side-chat.', // the team column's conversation, per vault and book
  sideChatOpen: 'story-forge.side-chat-open',
  beatsOpen: 'story-forge.beats-open.', // open beats, per book and chapter
  beatRuler: 'story-forge.beat-ruler',
  changesView: 'story-forge.changes-view', // Hide marks
  rewriteLeftOff: 'story-forge.rewrite-left-off.', // where he left off in the rewrite, per book
  rewriteHideSame: 'story-forge.rewrite.hide-same',
  homeSort: 'story-forge.home-sort',
  homeView: 'story-forge.home-view',
  gridView: 'story-forge.grid-view-2', // Chapter Grid: outline or cards
  tensionTab: 'story-forge.tension-tab',
  matrixShow: 'story-forge.matrix-show',
  plotGridMode: 'story-forge.plot-grid-mode',
  promisesSettled: 'story-forge.promises-settled',
  castWebFocus: 'sf-castweb-focus:', // per book
  todoView: 'story-forge.todo-view',
  todoMapFilter: 'story-forge.todo-map-filter',
  teamSort: 'sf-team-sort',
  // ---- Kept for one visit only (sessionStorage)
  chatPrefill: 'sf-chat-prefill', // words to start a conversation with, taken once
  rewriteEdits: 'story-forge.rewrite-edits.', // tweaks to the Writer's paragraphs before bringing them over
  draftView: 'story-forge.draft-view.', // which saved draft is on screen, per book
  rewriteOpened: 'story-forge.rewrite-opened.', // the Rewrite tab opened itself once this visit, per book
  // ---- Crow (the study app, src/study/)
  studyCache: 'character-study.cache.',
  studyLens: 'character-study.lens'
} as const;
