// What each page of `src/app/pages.ts` draws (code structure redesign, step 2). One entry for each page of the list;
// the compiler fails when a page has none, or when an entry is for no page. A screen gets the app as the pages see it
// (`AppCtx`: the vault as shown, and the things a page can ask the app to do) and the address it was opened at. It
// never saves or syncs itself: it calls an action, and the one saving system (`src/vault/`) does the rest.
import type { ComponentChildren } from 'preact';
import { beatsNoteFor } from '../lib/beats.ts';
import { chapterGroups, sceneLabel } from '../lib/board.ts';
import { copyFor } from '../lib/bookdrafts.ts';
import { fillJobsFor } from '../lib/brackets.ts';
import { changesNoteFor, chapterChanges, countLike, isStoryCall, type ChangeStatus } from '../lib/changes.ts';
import { conversation } from '../lib/chat.ts';
import { codexFor } from '../lib/codex.ts';
import { codexNow } from '../lib/codexnow.ts';
import { buildDocx, exportName, manuscript } from '../lib/docx.ts';
import { typedWords } from '../lib/drafts.ts';
import { flowResults, type NewResult } from '../lib/flow.ts';
import type { Decision } from '../lib/ideas.ts';
import { askFor, openAsk, recentProblem, type OnTake } from '../team/asks.ts';
import { jobNotes, type NewJob } from '../lib/jobs.ts';
import { checkOptions } from '../lib/lintcheck.ts';
import { nameList } from '../lib/links.ts';
import type { NewNote } from '../lib/notes.ts';
import { optionJobsFor } from '../lib/options.ts';
import { decideQueue } from '../lib/overview.ts';
import { planFor, scrapFor } from '../lib/plans.ts';
import type { LogItem } from '../lib/pomodoro.ts';
import { recipeName, recipeNotes, type RecipeFields } from '../lib/recipes.ts';
import { rewriteDone, rewriteProgress } from '../lib/rewrite.ts';
import { mentionsOf, sceneNotesFor } from '../lib/scenes.ts';
import type { Settings } from '../lib/settings.ts';
import type { NewTask } from '../lib/tasks.ts';
import { bookTodos, type NewTodo } from '../lib/todos.ts';
import type { BookEntry, DeviceFile, NoteRecord, Schema, VaultIndex, VaultSource } from '../lib/types.ts';
import { activeBook, makeNote } from '../lib/vault-index.ts';
import { ArcsBoard } from '../ui/ArcsPage.tsx';
import { ChangesOverview } from '../ui/Changes.tsx';
import { ChapterPage } from '../ui/ChapterPage.tsx';
import { ChapterTitlesPage } from '../ui/ChapterTitles.tsx';
import { ChatScreen } from '../ui/Chat.tsx';
import { CodexBoard } from '../ui/Codex.tsx';
import { DecideQueue } from '../ui/Decide.tsx';
import { Editor } from '../ui/Editor.tsx';
import { FlowScreen, FromTheWorkflow } from '../ui/Flow.tsx';
import { ForgeSpecialist } from '../ui/Forge.tsx';
import { BookDetails, downloadWord, Home, SeriesPage } from '../ui/Home.tsx';
import { IdeasBoard } from '../ui/IdeasBoard.tsx';
import { JobsScreen } from '../ui/Jobs.tsx';
import { MatrixBoard } from '../ui/Matrix.tsx';
import { NotesScreen } from '../ui/NotesToTeam.tsx';
import { OverviewPage } from '../ui/Overview.tsx';
import { PomodoroTimer } from '../ui/Pomodoro.tsx';
import { RecipesScreen } from '../ui/Recipes.tsx';
import { ChapterGrid, NoteView } from '../ui/screens.tsx';
import { SeeingBoard } from '../ui/Seeing.tsx';
import { SessionsScreen, SessionView } from '../ui/Sessions.tsx';
import { SettingsScreen } from '../ui/SettingsScreen.tsx';
import { StoryBoardScreen } from '../ui/StoryBoards.tsx';
import { TastePage } from '../ui/Taste.tsx';
import { HistoryScreen, MemberPage, SkillsScreen, TeamScreen } from '../ui/Team.tsx';
import { TensionBoard } from '../ui/TensionPage.tsx';
import { TodoList } from '../ui/TodoList.tsx';
import { WorkflowScreen } from '../ui/Workflow.tsx';
import type { Choice } from '../vault/choice.ts';
import { BRAINDUMP_START, type TextChange } from '../vault/text.ts';
import type { PAGES } from './pages.ts';
import { href, type Route } from './route.ts';
import { propText } from '../lib/props.ts';

type Said = Promise<{ error: boolean; text: string }>;
type Problem = Promise<string | null>;

/** Everything a page can ask the app to do. Each is one action in the saving system, or a read of the vault. */
export interface Actions {
  onDecide: (path: string, decision: Decision, reason: string, fields?: Record<string, string>) => void;
  onMarks: (path: string, marks: Record<string, ChangeStatus>, ticks: { path: string; fields: Record<string, string> }[]) => void;
  /** Kyle's reply to the Writer on a change card, and the ask for a new card from it: one save. A plain sentence when it cannot be sent. */
  onReply: (path: string, id: string, words: string, book: string, chapter: number) => string | null;
  onJob: (j: NewJob) => Said;
  onChat: (thread: string, words: string, book: string, page?: string) => Promise<{ thread: string; book: string } | { error: string }>;
  onAddScene: (book: BookEntry, chapter: number | null, chapterTitle: string, title: string) => Problem;
  onAddMany: (book: BookEntry, list: { chapter: number; chapterTitle: string; title: string }[]) => Problem;
  onAddChapter: (book: BookEntry, after: number | null, chapterTitle: string) => Problem;
  onMove: (book: BookEntry, path: string, chapter: number | null, chapterTitle: string, before: string | null) => void;
  onMoveChapter: (book: BookEntry, from: number, to: number) => Problem;
  onDeleteScenes: (book: BookEntry, paths: string[]) => Problem;
  onRename: (note: NoteRecord, title: string) => Problem;
  onRenameChapter: (scenes: NoteRecord[], title: string) => void;
  onRestore: (book: BookEntry, path: string) => Promise<void>;
  onImport: (book: BookEntry, file: File) => Said;
  onAddRocket: (book: BookEntry, file: File) => Said;
  onCover: (book: BookEntry, file: File) => Problem;
  onFiles: (files: DeviceFile[]) => Promise<void>;
  onWords: (path: string, change: Extract<TextChange, { what: 'words' | 'look' }>) => void;
  onTitles: (path: string, change: TextChange) => void;
  onRewrite: (path: string, reason: string) => Promise<void>;
  onRewriteThrough: (book: BookEntry, chapter: number, done: boolean) => Problem;
  /** Answers of the team's that a page has used: marked on their job notes, so no device uses them again. */
  onTake: OnTake;
  onAddTask: (t: NewTask) => Problem;
  onAddTodo: (bookFolder: string, t: NewTodo) => Problem;
  onAddNote: (book: BookEntry, n: NewNote) => Problem;
  onAddRecipe: (r: RecipeFields) => Problem;
  onSaveRecipe: (note: NoteRecord, r: RecipeFields) => Problem;
  onWorkflowNote: (note: string) => Problem;
  onResults: (book: BookEntry, list: NewResult[]) => Problem;
  onCreateSeries: (name: string, genre: string) => Problem;
  onCreateBook: (seriesFolder: string, seriesName: string, title: string, number: number) => Problem;
  onLog: (items: LogItem[]) => void;
  /** Save Draft N of a book: every scene's words as they stand. Gives the draft's number. */
  saveDraft: (book: BookEntry) => Promise<number>;
  /** Read the vault again. */
  runSync: () => Promise<void>;
  /** Notes a page saved itself come into the app's copy of the vault at once. */
  foldNotes: (saved: NoteRecord[]) => Promise<void>;
  /** A scene was opened: it becomes the one Write goes back to. */
  noteOpened: (path: string) => void;
  onSave: (s: Settings) => void;
  onForget: () => Promise<void>;
}

/** The app before the vault is loaded: what the Settings page needs. */
export interface AppBase {
  source: VaultSource;
  settings: Settings;
  /** True on the demo vault. */
  demo: boolean;
  syncing: boolean;
  act: Actions;
}

/** The app as a page sees it. */
export interface AppCtx extends AppBase {
  schema: Schema;
  /** The vault as shown: the saved copy with what waits in the outbox laid over it. */
  index: VaultIndex;
  /** Board choices waiting to go up, by note. */
  waiting: Record<string, Choice>;
}

type Listed = (typeof PAGES)[number];
type IdOf<K extends Listed['of']> = Extract<Listed, { of: K }>['id'];
type At<N extends Route['name']> = Extract<Route, { name: N }>;
/** The address a screen was opened at is its page's own kind: the list's `pageOf` sends no other there. */
const at = <N extends Route['name']>(r: Route, _name: N) => r as At<N>;

const scenes = (index: VaultIndex, book: BookEntry) => book.scenes.map((p) => index.notes[p]).filter(Boolean);

/** What Check (AI phrases) takes from the vault: the book's Style Guide and the vault's Config, as sf lint does. */
function checkOptionsFor(index: VaultIndex, bookFolder: string) {
  const guide = index.notes[bookFolder + '/Style Guide.md'];
  const config = index.notes['System/Config.md'];
  return checkOptions(guide ? guide.data : null, config ? config.data : null);
}

const story = (id: 'story-juice' | 'beat-sheet' | 'characters' | 'conflict-matrix' | 'market') => ({ source, schema, index, waiting, act }: AppCtx, book: BookEntry) => (
  <StoryBoardScreen schema={schema} index={index} book={book} waiting={waiting} onDecide={act.onDecide} board={id} onAddRocket={source.commit ? act.onAddRocket : undefined} onRewrite={source.commit ? act.onRewrite : undefined} />
);
const seeing = (id: string) => ({ source, schema, index, act }: AppCtx, book: BookEntry) => (
  <SeeingBoard board={id} schema={schema} index={index} book={book} onDecide={source.commit ? act.onDecide : undefined} />
);
const codex = (id: string) => ({ schema, index }: AppCtx, book: BookEntry) => <CodexBoard schema={schema} index={index} book={book} board={id} />;
const flow = ({ source, index, waiting, act }: AppCtx, book: BookEntry, route: Route) => {
  const r = route.name === 'flow' ? route : { stage: 0, step: '' };
  return <FlowScreen index={index} book={book} stage={r.stage} step={r.step} sourceKey={source.key} waiting={waiting}
    onJob={source.commit ? act.onJob : undefined} onDecide={source.commit ? act.onDecide : undefined} onResults={source.commit ? act.onResults : undefined} />;
};

/** A book's pages. Each gets the book its address names. */
export const BOOK_SCREENS: Record<IdOf<'book'>, (app: AppCtx, book: BookEntry, route: Route) => ComponentChildren> = {
  overview: ({ source, schema, index, act }, book) => {
    const scenesOf = scenes(index, book);
    const keepFor = (path: string) => {
      const rn = index.notes[path];
      const named = rn ? sceneLabel(scenesOf, rn) : null;
      return rn && named ? { title: named.chapter || named.scene || 'Your scene',
        where: [named.chapter ? named.scene : '', typedWords(rn).toLocaleString('en-US') + ' words'].filter(Boolean).join(' · ') } : null;
    };
    return <OverviewPage schema={schema} index={index} book={book} sourceKey={source.key} keepFor={keepFor} onJob={source.commit ? act.onJob : undefined} onDecide={source.commit ? act.onDecide : undefined} />;
  },
  decide: ({ source, index, act }, book) => <DecideQueue index={index} book={book} onDecide={source.commit ? act.onDecide : undefined} />,
  market: story('market'),
  'market-steps': flow,
  steps: flow,
  'chapter-grid': ({ source, schema, index, waiting, act }, book) => (
    <ChapterGrid schema={schema} index={index} book={book} waiting={waiting} onDecide={act.onDecide} onAdd={source.commit ? act.onAddScene : undefined}
      onAddMany={source.commit ? act.onAddMany : undefined} onMove={source.commit ? act.onMove : undefined}
      source={source} onJob={source.commit ? act.onJob : undefined}
      onRename={source.commit ? act.onRename : undefined} onImport={source.commit ? act.onImport : undefined} />
  ),
  ideas: ({ source, schema, index, waiting, act }, book) => <IdeasBoard schema={schema} index={index} book={book} waiting={waiting} onDecide={act.onDecide} onJob={source.commit ? act.onJob : undefined} />,
  'story-juice': story('story-juice'),
  'beat-sheet': story('beat-sheet'),
  'conflict-matrix': story('conflict-matrix'),
  promises: seeing('promises'),
  'plot-grid': seeing('plot-grid'),
  timeline: seeing('timeline'),
  arcs: ({ source, index, waiting, act }, book) => <ArcsBoard index={index} book={book} onDecide={source.commit ? act.onDecide : undefined} waiting={waiting} />,
  notes: ({ source, index, waiting, act }, book) => <NotesScreen index={index} book={book} waiting={waiting} onDecide={source.commit ? act.onDecide : undefined} onAdd={source.commit ? act.onAddNote : undefined} />,
  changes: ({ schema, index }, book) => (
    <ChangesOverview book={book} chapters={chapterChanges(index.notes, book.folder, (ch) => { const g = chapterGroups(schema, scenes(index, book)).find((x) => x.num === ch); return g && g.scenes.length ? g.scenes[0].path : null; })}
      calls={decideQueue(index, book).filter(isStoryCall).length} firstScene={book.scenes[0] || null}
      rewrite={rewriteProgress(book.rewrite || [], scenes(index, book), rewriteDone(index.notes[book.path]))} />
  ),
  'story-calls': ({ source, index, act }, book) => <DecideQueue index={index} book={book} onDecide={source.commit ? act.onDecide : undefined} calls />,
  'chapter-titles': ({ source, schema, index, act }, book) => (
    <ChapterTitlesPage index={index} book={book} onChange={act.onTitles} groups={chapterGroups(schema, scenes(index, book))} onRename={source.commit ? act.onRenameChapter : undefined} />
  ),
  tension: ({ source, schema, index, waiting, act }, book) => <TensionBoard schema={schema} index={index} book={book} onDecide={source.commit ? act.onDecide : undefined} waiting={waiting} />,
  themes: seeing('themes'),
  sessions: ({ index }, book) => <SessionsScreen index={index} book={book} />,
  taste: ({ source, index, act }, book) => <TastePage source={source} index={index} book={book} onJob={source.commit ? act.onJob : undefined} />,
  details: ({ source, schema, index, act }, book) => (
    <BookDetails source={source} schema={schema} index={index} book={book} onFiles={act.onFiles} onMatter={act.onWords} onCover={source.commit ? act.onCover : undefined} onDecide={source.commit ? act.onDecide : undefined} />
  ),
  characters: codex('characters'),
  places: codex('places'),
  items: codex('items'),
  lore: codex('lore'),
  matrix: ({ schema, index }, book) => <MatrixBoard schema={schema} index={index} book={book} />,
  'cast-web': seeing('cast-web')
};

/** The app's own places. Settings is drawn before the vault is loaded, so it gets the app without one. */
export const APP_SCREENS: { [K in IdOf<'app'>]: K extends 'settings' ? (app: AppBase) => ComponentChildren : (app: AppCtx, route: Route) => ComponentChildren } = {
  chat: ({ source, index, waiting, demo, act }, route) => {
    const r = at(route, 'chat');
    return <ChatScreen index={index} thread={r.thread} book={r.book} onChat={source.commit ? act.onChat : undefined}
      onDecide={source.commit ? act.onDecide : undefined} waiting={waiting} demo={demo} />;
  },
  jobs: ({ source, index, waiting, syncing, act }) => <JobsScreen index={index} waiting={waiting} onDecide={source.commit ? act.onDecide : undefined} syncing={syncing} />,
  team: ({ source, schema, index, act }, route) => {
    const r = at(route, 'team');
    return r.slug ? <MemberPage source={source} index={index} schema={schema} slug={r.slug} canTalk={Boolean(source.commit)} />
      : <TeamScreen source={source} index={index} schema={schema} canTalk={Boolean(source.commit)}
        extra={<ForgeSpecialist onJob={source.commit ? act.onJob : undefined} book={(activeBook(index) || index.books[0] || { folder: '' }).folder} />} />;
  },
  skills: ({ index }, route) => <SkillsScreen index={index} skill={at(route, 'skills').skill} />,
  recipes: ({ source, index, act }) => <RecipesScreen index={index} onAdd={source.commit ? act.onAddRecipe : undefined} onSave={source.commit ? act.onSaveRecipe : undefined} />,
  workflow: ({ source, index, act }, route) => <WorkflowScreen index={index} step={at(route, 'workflow').step} onNote={source.commit ? act.onWorkflowNote : undefined} />,
  history: ({ source, index }, route) => <HistoryScreen source={source} index={index} who={at(route, 'history').who} />,
  // Books is also where an address the app does not know lands.
  books: ({ source, index, act }) => <Home source={source} index={index} series={false} onCreateSeries={source.commit ? act.onCreateSeries : undefined} onCreateBook={source.commit ? act.onCreateBook : undefined} />,
  series: ({ source, index, act }, route) => {
    const r = at(route, 'series');
    return r.folder ? <SeriesPage source={source} index={index} folder={r.folder} onCreateBook={source.commit ? act.onCreateBook : undefined} />
      : <Home source={source} index={index} series onCreateSeries={source.commit ? act.onCreateSeries : undefined} onCreateBook={source.commit ? act.onCreateBook : undefined} />;
  },
  todo: ({ source, schema, index, waiting, act }) => (
    <TodoList index={index} waiting={waiting} onDecide={act.onDecide} onAdd={source.commit ? act.onAddTask : undefined}
      schema={schema} book={activeBook(index)} onRewrite={source.commit ? act.onRewrite : undefined} />
  ),
  settings: ({ settings, act }) => <SettingsScreen settings={settings} onSave={act.onSave} onForget={act.onForget} />,
  note: ({ source, schema, index, act }, route) => {
    const path = at(route, 'note').path;
    const n = index.notes[path];
    if (n && n.type === 'session') return <SessionView index={index} note={n} />;
    const nb = n && n.type === 'character' ? index.books.find((b) => path.startsWith(b.folder + '/')) || activeBook(index) : null;
    const who = n ? String(n.data.name || n.data.title || '').trim() : '';
    return (
      <>
        <NoteView schema={schema} index={index} path={path} />
        {nb && who && <FromTheWorkflow index={index} book={nb} names={[who].concat(nameList(n.data.aliases))} title={who} onResults={source.commit ? act.onResults : undefined} />}
      </>
    );
  }
};

/** The writing screen: a scene (Page), or its chapter by its beats (Beats). Null when the scene is not in the vault as shown. */
function writing({ source, schema, index: view, waiting, act }: AppCtx, route: Route) {
  const r = route as At<'write'> | At<'beats'>;
  const note = view.notes[r.path];
  if (!note) return null;
  act.noteOpened(r.path);
  const book = view.books.find((b) => r.path.startsWith(b.folder + '/')) || null;
  const i = book ? book.scenes.indexOf(r.path) : -1;
  const next = book && i >= 0 && i + 1 < book.scenes.length ? view.notes[book.scenes[i + 1]] || null : null;
  const prev = book && i > 0 ? view.notes[book.scenes[i - 1]] || null : null;
  const groups = book ? chapterGroups(schema, scenes(view, book)) : [];
  // Beats mode: the chapter by its beats in the page's place.
  const chapter = typeof note.data.chapter === 'number' ? note.data.chapter : null;
  const beats = r.name === 'beats' && book && chapter != null ? {
    note: beatsNoteFor(view.notes, book.folder, chapter),
    asking: openAsk(jobNotes(view), { kind: 'beats', target: 'Chapter ' + chapter, book: book.folder }),
    problem: recentProblem(askFor(jobNotes(view), { kind: 'beats', target: 'Chapter ' + chapter, book: book.folder }))
  } : null;
  return (
    <Editor key={r.path + (beats ? ':beats' : '')} beats={beats} source={source} schema={schema} note={note} next={next} prev={prev}
      nextMentions={book && next && next.data.id ? mentionsOf(Object.values(view.notes).filter((n) => n.path.startsWith(book.folder + '/')), propText(next, 'id')) : []}
      book={book ? { title: book.title, folder: book.folder, groups, archive: book.archive || [] } : null}
      onAdd={book && source.commit ? (ch, chapterTitle, title) => act.onAddScene(book, ch, chapterTitle, title) : undefined}
      onAddChapter={book && source.commit ? (after, chapterTitle) => act.onAddChapter(book, after, chapterTitle) : undefined}
      onRenameChapter={book && source.commit ? act.onRenameChapter : undefined}
      onMoveChapter={book && source.commit ? (from, to) => act.onMoveChapter(book, from, to) : undefined}
      onDeleteScenes={book && source.commit ? (paths) => act.onDeleteScenes(book, paths) : undefined}
      onRestore={book ? (path) => act.onRestore(book, path) : undefined}
      onNotes={book ? (was, body) => act.onWords(book.braindump || book.folder + '/Braindump.md', { what: 'words', of: 'braindump', was, body, start: BRAINDUMP_START, name: book.title }) : undefined}
      onFiles={act.onFiles}
      onJob={book && source.commit ? act.onJob : undefined} onChat={book && source.commit ? act.onChat : undefined}
      onTake={source.commit ? act.onTake : undefined}
      todos={book ? bookTodos(view, book) : []} onTodo={source.commit ? act.onDecide : undefined} onMarks={source.commit ? act.onMarks : undefined} waiting={waiting}
      onAddTodo={book && source.commit ? (t) => act.onAddTodo(book.folder, t) : undefined}
      timer={(variant) => <PomodoroTimer source={source} index={view} variant={variant} onLog={act.onLog} />}
      codexNow={book ? (n) => codexNow(view, book, n, note.path) : undefined}
      codex={book ? codexFor(view, book) : []} braindump={book && book.braindump ? view.notes[book.braindump] || null : null}
      sceneNotes={book ? sceneNotesFor(view.notes, book.folder, propText(note, 'id')) : null}
      fillJobs={book && note.data.id ? fillJobsFor(jobNotes(view), String(note.data.id), book.folder) : []}
      optionJobs={book && note.data.id ? optionJobsFor(jobNotes(view), String(note.data.id), book.folder) : []}
      checkOpts={book ? checkOptionsFor(view, book.folder) : undefined}
      convo={book && note.data.id ? conversation(view, String(note.data.id), book.folder) : null}
      plan={book ? planFor(view.notes, book.folder, chapter) : null}
      scrap={book ? scrapFor(view.notes, book.folder, chapter) : null}
      chapterBeats={book ? beatsNoteFor(view.notes, book.folder, chapter) : null}
      recipes={recipeNotes(view).map(recipeName)}
      flow={book ? { results: flowResults(view, book), href: href.flow(book.folder) } : undefined}
      changes={book ? { note: changesNoteFor(view.notes, book.folder, chapter), asking: chapter != null && Boolean(openAsk(jobNotes(view), { kind: 'revise', target: 'Chapter ' + chapter, book: book.folder })), problem: chapter != null ? recentProblem(askFor(jobNotes(view), { kind: 'revise', target: 'Chapter ' + chapter, book: book.folder })) : '', book: chapterChanges(view.notes, book.folder, (ch) => { const g = groups.find((x) => x.num === ch); return g && g.scenes.length ? g.scenes[0].path : null; }), like: (pairs) => countLike(view.notes, book.folder, pairs),
        replying: chapter != null && Boolean(openAsk(jobNotes(view), { kind: 'reply', target: 'Chapter ' + chapter, book: book.folder })),
        replyProblem: chapter != null ? recentProblem(askFor(jobNotes(view), { kind: 'reply', target: 'Chapter ' + chapter, book: book.folder })) : '',
        onReply: source.commit && chapter != null ? (path, id, words) => act.onReply(path, id, words, book.folder, chapter) : undefined } : undefined}
      rewrite={book ? { files: book.rewrite || [], done: rewriteDone(view.notes[book.path]), onThrough: source.commit ? (ch, done) => act.onRewriteThrough(book, ch, done) : undefined } : null}
      drafts={book ? {
        saved: book.drafts || [],
        onSave: async () => {
          if (!source.commit) return 'Saving a draft needs your own vault, not the demo.';
          if (!navigator.onLine) return 'Connect to the internet to save a draft.';
          try {
            await act.saveDraft(book);
            await act.runSync();
            return null;
          } catch (e) { return (e as Error).message; }
        },
        onExport: async (n) => {
          try {
            const notes = { ...view.notes };
            const d = n == null ? null : (book.drafts || []).find((x) => x.number === n);
            if (n != null && !d) return 'Draft ' + n + ' is not in the vault.';
            // A saved draft: each scene's words as its copy holds them; a scene the draft did not have is left out.
            if (d) for (const p of book.scenes) {
              const s = view.notes[p];
              if (!s) continue;
              const f = copyFor(d, s);
              notes[p] = f ? { ...makeNote(p, f.sha, await source.read(f.path, f.sha)), path: p } : { ...s, body: '' };
            }
            const m = manuscript(schema, { ...view, notes }, book);
            if (!m.scenes) return 'This draft has no written scenes, so there is nothing to export.';
            const data = view.notes[book.path] ? view.notes[book.path].data : {};
            const working = (book.drafts || []).reduce((x, y) => Math.max(x, y.number), 0) + 1;
            const name = exportName(book).replace(/\.docx$/, '_Draft ' + (n == null ? working : n) + '.docx');
            downloadWord(buildDocx(book.title, typeof data.author === 'string' ? data.author : '', m) as Uint8Array<ArrayBuffer>, name);
            return null;
          } catch (e) { return 'The Word file could not be made: ' + (e as Error).message; }
        }
      } : undefined}
      backTo={book ? href.book(book.folder) : href.note(r.path)} onSaved={(n) => { act.foldNotes([n]); }} onChanged={act.runSync} />
  );
}

/** The pages that fill the screen with their own bars: no sidebar or top bar. Null when the scene is not in the vault as shown. */
export const WRITE_SCREENS: Record<IdOf<'write'>, (app: AppCtx, route: Route) => ComponentChildren | null> = {
  write: writing,
  beats: writing,
  chapter: ({ source, schema, index, act }, route) => {
    const path = at(route, 'chapter').path;
    const note = index.notes[path];
    const book = note ? index.books.find((b) => path.startsWith(b.folder + '/')) : null;
    const group = book ? chapterGroups(schema, scenes(index, book)).find((g) => g.scenes.some((n) => n.path === path)) : null;
    if (!book || !group) return null;
    return <ChapterPage key={group.key + ':' + book.folder} source={source} group={group} bookTitle={book.title} codex={codexFor(index, book)} startAt={path}
      checkOpts={checkOptionsFor(index, book.folder)}
      backTo={href.book(book.folder)} onSaved={(n) => { act.foldNotes([n]); }} timer={<PomodoroTimer source={source} index={index} variant="bar" onLog={act.onLog} />} />;
  }
};
