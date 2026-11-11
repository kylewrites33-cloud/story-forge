# Layout, file by file

What each source file holds. Moved out of CLAUDE.md on 2026-10-19. Add a line when you add a file.

```
src/lib/frontmatter.js   the vault tool's YAML reader, copied as is (do not edit; see CLAUDE.md)
src/lib/schema.ts        parse System/schema.json; card fields, enums, property order
src/lib/vault-index.ts   which files to read, parse them, build series/books/scenes; warnings
src/lib/board.ts         Chapter Grid grouping
src/lib/ideas.ts         piles, and the line edits keep, later, drop, accept, needs work and move make; reasons, stars, idea filters
src/lib/boards.ts        Story Juice and Market boards: which notes, grouped and ordered by the schema; the cast with book deltas
src/lib/github.ts        GitHub source: tree, blobs, connection test, plain-sentence errors; commit, the one way the app changes the vault (one save of any number of files through git's own objects); blob shas
src/lib/demo-source.ts   the bundled demo vault as a source; its saves (commit) live in memory until the page reloads
src/lib/sync.ts          one sync: tree, schema, index, reusing unchanged files
src/lib/cache.ts         IndexedDB snapshot per source, for offline
src/lib/prose.js         the vault tool's prose helpers and word count, copied as is (do not edit; see CLAUDE.md)
src/lib/styled.ts        the writing screen's styled view: emphasis runs, HTML that keeps every character
src/lib/drafts.ts        the writing screen's drafts: kept on the device as Kyle types, word counts, the copies a note has; how a draft lands on the note the vault has (draftOnto) and a copy's name and text (planSnapshot), for the saving system; drafts finished offline handed to it when the connection is back (flushDrafts); words that follow a new note saved under another name (moveDrafts)
src/lib/market.ts        Publisher Rocket files: the ones a series has, safe names, a file from the device ready to save (rocketFile)
src/lib/tasks.ts         the to-do list: task notes by status, due dates, what a new to-do is (planTask: next free ID, path, text)
src/lib/todos.ts         a book's chapter to-dos: by chapter, open first, what a new one is (planTodo, in the book's Tasks folder)
src/lib/pomodoro.ts      the Pomodoro timer: its state on the device, words per Pomodoro, words typed all day, the Writing Log notes, and what is due from the two meters for the saving system to carry (takeTypingCounts)
src/lib/jobs.ts          Ask the team: job notes by status, a new job with the next free ID (planJob, for the `job` maker), Kyle's words for kinds and statuses
src/lib/chat.ts          Chat with the team: conversations from chat jobs by thread, messages and replies, next chat-NNN, a message's job
src/lib/scenes.ts        new scenes (planScene, for the `scene` maker), split and join: next free ID, order between neighbours, the text and place of an archived scene, the note to the team after a join; a scene's notes
src/lib/codex.ts         the codex: names that light up, mentions, presence per scene (Matrix, Appears in), longest absence
src/lib/books.ts         new series and books (planSeries and planBook are their makers' plans), manuscript files for Bring in a manuscript
src/lib/markdown.ts      small, escaping Markdown reader for the note view, tables included
src/lib/bookstatus.ts    where each book is for the Books page: stage, percent of it done, where Continue opens
src/lib/bookstages.ts    the Overview's six stages (market research to publishing) with a percent each, and the publish date
src/lib/stagetimes.ts    each stage's start and end days on the book note, how long each took, and the estimated publish date
src/lib/home.ts          home page helpers: recent scenes, book sort, cover patterns, labels, reading time, filter, outline
src/lib/search.ts        the Chapter Grid search: chapter and scene numbers, chapter titles, codex names, near misses, best first
src/lib/covers.ts        book covers: shrink on the device, the two files to save (coverFiles: the full-size picture in Cover/ and Cover.jpg), keep on the device by blob sha
src/lib/page.ts          the writing page's look per device (size, spacing, width, font, paper)
src/lib/docx.ts          Export to Word: the book in reading order as a .docx made on the device, its file name, its backup copy ready to save (backupFile)
src/lib/epub.ts          the Kindle file: the book as an EPUB 3 for KDP (screens boxed, Book Matter pages, cover), the matter page's editing
src/lib/theme.ts         colour themes per device: Match this device, eight light, six dark (colours in styles.css)
src/fonts/               Space Mono and Space Grotesk (Marigold theme, Typewriter page font), Pixelify Sans and DotGothic16 (Lo-Fi theme), VT323 (Retro OS theme), Literata (Library), Nunito (Pebble), Archivo (Prism); woff2, SIL OFL licences beside them
src/lib/topbar.ts        room at the top for the iPad clock bar and window button (ios-app, ios-window), Settings override
src/ui/Home.tsx          the home page (Books, Series) and a series' page
src/ui/Jobs.tsx          the Jobs screen: what Kyle asked the team for, with results and Cancel
src/ui/Chat.tsx          the Chat screen: the list of conversations and one conversation with Send
src/ui/Pomodoro.tsx      the timer's button and panel: in the sidebar's foot, the slim top bar, the writing screen's top bar, or beside Leave focus
src/ui/chirp.ts        the Pomodoro's bird calls: twelve made on the device, the two picked in Settings, unlocked by a press, and keeping the screen on while it runs
src/ui/hold.ts         names on a long press: a finger held on a button with a title shows the title (touch only)
src/ui/viewport.ts       useLockedPage: the writing screens lock the document so the iPad cannot scroll it under them
src/ui/EditorPanels.tsx  the writing screen's side-column panels and small forms (card, codex, Find, beats, marks, notes, history,
                         copies, archive, chapter forms, scene, team, page look, target, to-dos, plan, scrap)
src/ui/ChapterPage.tsx   the whole chapter as one page
src/ui/SceneSection.tsx  another scene of the open chapter on the same page: its own draft and saves
src/lib/brackets.ts      {braces} (asks for the team): finding them, the fill job, its answers, putting each answer into the page
src/lib/live.ts          the open page stays live: line merge with a newer version, cursor mapping, the dots
src/lib/chapters.ts      a chapter's number and name: which notes follow when a chapter is added, moved or deleted and their new text (beats, plans, scraps, change lists renamed); renaming. The save itself is src/vault/chapters.ts
src/lib/plans.ts         a chapter's plan note (Chapter Plans) and scrap note (Chapter Scraps)
src/lib/context.ts       what is on screen, sent with a chat from the team column beside a page (## Page)
src/lib/changes.ts       the team's changes to a chapter (Changes/ notes): reading them, placing them on the page, what Kyle's answer does to the note, story calls
src/lib/bookdrafts.ts    a book's saved drafts (Drafts/Draft N/): finding them, the draft note's text, a scene's copy
src/lib/rewrite.ts       the Writer's rewrite (Drafts/Rewrite/): a scene's copy, paragraphs lined up with Kyle's, bringing one over
src/lib/titles.ts        Chapter Titles.md: the title options per chapter, Kyle's tick, his own title
src/ui/ChapterTitles.tsx Edit > Chapter titles: tick a title, write your own, or None of these for more
src/ui/Changes.tsx       the changes on the page (four views), the Changes bar and tab, the Draft button, Edit > Changes
src/ui/Rewrite.tsx       the Rewrite tab beside the page: the Writer's paragraphs beside Kyle's, Bring over, Put it in, Take it out
src/lib/beats.ts         a chapter's beats: the Chapter Beats note, laying the prose out under its beats and back
src/ui/BeatsPage.tsx     BeatsView, the chapter by its beats inside the writing screen: closed rows that open to their prose
src/ui/Matrix.tsx        who is in which scene
src/ui/TodoList.tsx      the To-do page: Map or List; the List is every to-do by status, and the team's notes on the draft of the active book (was the Edit Queue)
src/lib/todomap.ts       the To-do map: each to-do's place (context), need or want, lanes with counts, Up next, a published book's leftovers
src/ui/TodoMap.tsx       the To-do map: tiles per place, Up next, one lane per place, a to-do's moves
src/ui/EditFields.tsx    a card's words edited in place (board cards and scene cards)
src/lib/team.ts          the AI team: agents, skills and who loads them, lessons, journals, history, numbers for the Team page
src/ui/Team.tsx          the Team page, an agent's page, Skills and Session history
src/lib/workflow.ts      the workflow from System/Workflow.md: stages, steps, who does each, Kyle's dated notes
src/ui/Workflow.tsx      the Workflow page: each stage's table, filters, notes
src/lib/flow.ts          Workflow mode: steps paired into tasks, where each stands (Check too), the mode per book, results as idea notes (planResult, for the `result` maker), the step job's ask
src/ui/Flow.tsx          Workflow mode's screens (home, stage, step), the Workflow | Writing switch, the writing screen's Workflow tab, From the workflow on character pages
src/lib/find.ts          Find in the top bar: chapters, scenes, codex names and ideas matching what Kyle types
src/ui/Find.tsx          the Find button and box in the top bar
src/ui/Codex.tsx         the Codex pages: a list and the entry side by side, for characters, places, items and lore
src/ui/Decide.tsx        Decide one at a time: every card waiting on Kyle, one at a time, with Undo
src/ui/Shell.tsx         the sidebar (book card, rooms with their pages, Team, To-do, Timer, Settings, sync line) and the top bar (page menu, Find, Team) around every screen but the writing ones
src/ui/Icon.tsx          the small line icons, drawn inline
src/lib/taste.ts         the Taste page's numbers: keeps and drops by kind, agent and round, top reasons
src/ui/Taste.tsx         the Taste page: Taste Profile, Style Fingerprint and the bars
src/lib/seeing.ts        what the seeing-the-book pages share: story scenes in order, a book's or series' notes of a type
src/lib/promises.ts      Promises board: lanes of planted, reinforced and paid scenes; promiseWarnings
src/lib/plotgrid.ts      Plot Grid: threads or cast by scene, gaps, the threads toggle; plotGapWarnings
src/lib/timeline.ts      Timeline: scenes by story day, flashbacks, time jumps, scenes with no day
src/lib/themes.ts        Themes heatmap: keyword counts per chapter, cards that link a theme, the matching lines
src/lib/castweb.ts       Cast web: presence, relationships and how tense they are, one character's ties in two columns
src/ui/Seeing.tsx        which of the five seeing pages to show (their names and addresses are in src/app/pages.ts)
src/ui/SeeingParts.tsx   their shared head, scene header rows by chapter and warning list
src/ui/Promises.tsx, PlotGrid.tsx, Timeline.tsx, Themes.tsx, CastWeb.tsx   the five pages
src/lib/lint.js          the vault tool's linter, copied as is (do not edit; see CLAUDE.md)
src/lib/lintcheck.ts     Check (AI phrases): the linter on the page's Markdown, flags mapped onto the page, grades, chapter score
src/lib/options.ts       Options for a passage: the passage, the options job, its answers, the swap
src/lib/listen.ts        Listen: sentences to say with their place on the page, the reader over the browser's speech
src/ui/CheckPanel.tsx    the Check tab beside the page (and Whole chapter's Check column)
src/ui/OptionsPanel.tsx  the Options strip under the tool row and the Options tab
src/ui/Listen.tsx        the Listen button and the bar under the tool row while it reads
src/ui/highlight.ts      CSS Custom Highlight API helpers: draw over words without touching the page
src/lib/overview.ts      a book's Overview: numbers, what waits on Kyle, the Release runway, jobs seen on this device
src/lib/notes.ts         Notes to the Team: the book's notes, open first, who for, where answered, a new one (planNote, for the `note` maker)
src/lib/sessions.ts      session notes: newest first, read speaker by speaker, voice colours, the ideas each filed
src/lib/recipes.ts       Kyle's recipes: the list, a job's ask with a recipe, a new one (planRecipe, for the `recipe` maker), an edited one's text
src/ui/Overview.tsx      the Overview page and the six stages
src/ui/NotesToTeam.tsx   the Notes to the Team screen
src/ui/Sessions.tsx      the Sessions list and one session
src/ui/Recipes.tsx       the Recipes page and the "With a recipe" picker
src/ui/Forge.tsx         Forge a new specialist on the Team page
src/lib/tension.ts       Tension and Pacing: scene positions by words, points, reference curve, warnings, card_draft, story shape
src/lib/arcs.ts          Character Arcs: arc points, which note holds them, edits, wrong-way warnings
src/lib/beatruler.ts     the beat ruler: Save the Cat percentages, beat notes matched, early, on time or late
src/lib/codexnow.ts      a codex card's "now" (progressions) and secrets (sf's timing); the Matrix's red squares
src/ui/SceneChart.tsx    a draggable line chart of one value per scene (pointer events), used by the pages below
src/ui/TensionPage.tsx   Tension and Pacing, with the Mood and shape tab
src/ui/ArcsPage.tsx      Character Arcs
src/ui/BeatRuler.tsx     the folding beat ruler on the Chapter Grid
src/ui/CodexNow.tsx      "Now" and secrets on a codex card
src/ui/                  screens (Preact)
public/sw.js             service worker for the app shell only; never caches GitHub
demo-vault/              a tiny vault that follows the schema, for tests and the Pages preview
tests/                   Node test runner tests
tests/golden/            what a save must leave in the vault, file for file, one .json a case (`leaves` in tests/helpers.ts); first written from the older note-by-note saving code just before it was removed (2026-11-11). `GOLDEN=write npm test` writes them again for a change that is meant
src/lib/study.ts         Crow, the character and plot study app: Studies/ notes (studies, character cards, scenes read for character and plot, lenses), tallies of the best lens
src/study/               Crow's page (crow/index.html): main.tsx, StudyApp.tsx (its screens and Settings), study.css
public/crow/             Crow's manifest and icons (its own home-screen app); public/character-study/ sends the old address to crow/
```
src/lib/types.ts         shapes shared by the vault reader, the cache and the screens
src/lib/settings.ts      connection settings, kept in this browser only
src/lib/links.ts         wiki-link helpers, ported from the vault tool (link names, name lists, numbers)
src/lib/format.ts        how property values read on cards and in the note view
src/lib/warnings.ts      the shape of one warning and of a check, shared by the seeing-the-book pages
src/ui/screens.tsx       the Chapter Grid, the note view and small shared screens
src/ui/IdeasBoard.tsx    the Ideas board: piles, cards, keep, later, drop, reasons
src/ui/StoryBoards.tsx   the boards for every other proposal type
src/ui/SettingsScreen.tsx  the Settings page: connection, colours, reading rates, sounds
src/ui/Editor.tsx        the full-screen writing screen
src/ui/StyledEditor.tsx  the writing box with styles: italics, bold and marks shown as a word processor does
src/app/                 the frame around the pages (2026-11-11, step 2 of the code structure redesign)
src/app/pages.ts         THE ONE LIST OF PAGES: each page's id, name, address, room, place under Book tools, what it tells the team chat, how often it wants the vault read again; the rooms; `pageOf(route)`. A new page is one entry here and one in screens.tsx
src/app/screens.tsx      what each page of the list draws, one entry a page (the compiler fails if one is missing); `Actions`, everything a page can ask the app to do; `AppCtx`, the app as a page sees it
src/app/route.ts         the app's addresses (#/...) and the hook that reads them
src/write/               the TRIAL of the new writing box (2026-11-11, step 3 of the code structure redesign; Kyle's yes covers the trial only). Goes, or becomes the writing page, on his verdict
src/write/prose.ts       the new writing box: CodeMirror 6 set up for prose (stars and == hidden, System screen lines indented, {asks} marked, Bold, Italic, Undo, a line put in from outside as one small edit). Loaded only when the trial page opens, so it is a file of its own in the build
src/write/Trial.tsx      the trial page (#/trial/<scene>): one chapter in the new box, a key-speed line, "Add a line from outside", Start again. It is handed no save action and keeps nothing on the device
tests/golden/pages.json  what the older page map (rooms.ts, Rooms.tsx, StoryBoards.tsx, Seeing.tsx) gave for the demo schema on the day it was removed; tests/pages.test.ts holds the list to it
src/vault/               the one saving system (2026-11-11, step 1 of the code structure redesign); features move onto it one at a time
src/vault/ops.ts         what a save is made of: Action (one thing Kyle did), its Ops (an edit to a note, a new note by its maker, a book's chapters renumbered, scenes deleted, a scene or recipe given a new title and file name, a file from the device saved as it is, the book's draft saved, a scene back from the Archive, or the next scene joined onto this one), Edit (a change kept as what he meant: a board choice, answers on a chapter's changes, a small change to a note's text, or a scene's words with the words they started from)
src/vault/makers.ts      the makers of new notes, by name (task, todo, job, note, recipe, result, scene, series, book, copy): what Kyle typed plus the vault's file list gives the note; run at add and again at the save
src/vault/apply.ts       what an edit does to a note on screen and to its saved text (the two must agree); the vault with waiting actions applied; a save's answer put into the saved copy (notes in, files that left out, each book's archive list, the text of files the app holds as text such as the workflow)
src/vault/text.ts        the small changes to a note's text, kept as what Kyle meant: a chapter title ticked or written, a chapter through in the Rewrite tab, a recipe's words, a note on the workflow, the Writing Log's (a Pomodoro, words typed, minutes typing), and a note's words written in a box of their own (front and back matter, the Braindump), merged from the words as opened; the last two kinds start their note when it is not there; on screen and in the saved text by the same code
src/vault/outbox.ts      actions waiting on the device (localStorage), newer replacing older, the old queue moving over, what is left after a push; what went up but is not in the saved copy on the device yet
src/vault/tree.ts        the vault as one save sees it: the files at the start with the save's own changes on top, so each op meets what the one before it did; files that are not text (pictures, Word files) ride in the same save
src/vault/chapters.ts    the chapters op: a book's chapter numbers changed as one save (room for a new chapter, a move, closing up), every note and list that carries a number following; the delete op: scenes to the Archive, an emptied chapter's notes with them, the chapters after it closed up, as one save
src/vault/book.ts        the draft op (every scene copied to Drafts/Draft N/ with its note, on the vault as it is then), the restore op (a scene back in Scenes and out of the Archive) and the join op (the next scene's note to the Archive, out of Scenes, and the team told), each one save
src/vault/words.ts       the writing page's own saves through the saving system, sent at once: a draft's words (saveDraft), a copy (saveSnapshot), split and join as one save each
src/vault/push.ts        sending the outbox up: one action one save, waiting ones together, made again if the vault moved; a new title's file rename and what follows it
src/vault/choice.ts      a choice on a board (Choice: keep, later, drop, Rewrite, an edit to a card, a card dragged) and what it changes on a note

