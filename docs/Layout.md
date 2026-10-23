# Layout, file by file

What each source file holds. Moved out of CLAUDE.md on 2026-10-19. Add a line when you add a file.

```
src/lib/frontmatter.js   the vault tool's YAML reader, copied as is (do not edit; see CLAUDE.md)
src/lib/schema.ts        parse System/schema.json; card fields, enums, property order
src/lib/vault-index.ts   which files to read, parse them, build series/books/scenes; warnings
src/lib/board.ts         Chapter Grid grouping
src/lib/ideas.ts         piles, and the line edits keep, later, drop, accept, needs work and move make; reasons, stars, idea filters
src/lib/boards.ts        Story Juice and Market boards: which notes, grouped and ordered by the schema; the cast with book deltas
src/lib/write-queue.ts   choices waiting to save (localStorage), sending them, showing them before they land
src/lib/github.ts        GitHub source: tree, blobs, connection test, plain-sentence errors
src/lib/demo-source.ts   the bundled demo vault as a source
src/lib/sync.ts          one sync: tree, schema, index, reusing unchanged files
src/lib/cache.ts         IndexedDB snapshot per source, for offline
src/lib/prose.js         the vault tool's prose helpers and word count, copied as is (do not edit; see CLAUDE.md)
src/lib/styled.ts        the writing screen's styled view: emphasis runs, HTML that keeps every character
src/lib/drafts.ts        the writing screen's drafts: kept on the device, saved to the vault, snapshots, clashes
src/lib/market.ts        Publisher Rocket files: the ones a series has, safe names, adding one from the device
src/lib/tasks.ts         the to-do list: task notes by status, due dates, new to-dos with the next free ID
src/lib/todos.ts         a book's chapter to-dos: by chapter, open first, new ones in the book's Tasks folder
src/lib/pomodoro.ts      the Pomodoro timer: its state on the device, words per Pomodoro, words typed all day, the Writing Log notes
src/lib/jobs.ts          Ask the team: job notes by status, new jobs with the next free ID, Kyle's words for kinds and statuses
src/lib/chat.ts          Chat with the team: conversations from chat jobs by thread, messages and replies, next chat-NNN, a message's job
src/lib/scenes.ts        new scenes, split and join: next free ID, order between neighbours, archive before removing; rename, restore; a scene's notes
src/lib/codex.ts         the codex: names that light up, mentions, presence per scene (Matrix, Appears in), longest absence
src/lib/books.ts         new series and books, manuscript files for Bring in a manuscript
src/lib/markdown.ts      small, escaping Markdown reader for the note view, tables included
src/lib/home.ts          home page helpers: recent scenes, book sort, cover patterns, labels, reading time, filter, outline
src/lib/search.ts        the Chapter Grid search: chapter and scene numbers, chapter titles, codex names, near misses, best first
src/lib/covers.ts        book covers: shrink on the device, save as Cover.jpg, keep on the device by blob sha
src/lib/page.ts          the writing page's look per device (size, spacing, width, font, paper)
src/lib/docx.ts          Export to Word: the book in reading order as a .docx made on the device, its file name
src/lib/theme.ts         colour themes per device: Match this device, eight light, six dark (colours in styles.css)
src/fonts/               Space Mono and Space Grotesk (Marigold theme, Typewriter page font), Pixelify Sans and DotGothic16 (Lo-Fi theme), VT323 (Retro OS theme); woff2, SIL OFL licences beside them
src/lib/topbar.ts        room at the top for the iPad clock bar and window button (ios-app, ios-window), Settings override
src/ui/Home.tsx          the home page (Books, Series) and a series' page
src/ui/Jobs.tsx          the Jobs screen: what Kyle asked the team for, with results and Cancel
src/ui/Chat.tsx          the Chat screen: the list of conversations and one conversation with Send
src/ui/Pomodoro.tsx      the timer's button and panel: in the sidebar's foot, the slim top bar, the writing screen's top bar, or beside Leave focus
src/ui/chirp.ts        the Pomodoro's bird calls: twelve made on the device, the two picked in Settings, unlocked by a press, and keeping the screen on while it runs
src/ui/hold.ts         names on a long press: a finger held on a button with a title shows the title (touch only)
src/ui/viewport.ts       useLockedPage: the writing screens lock the document so the iPad cannot scroll it under them
src/ui/ChapterPage.tsx   the whole chapter as one page
src/ui/SceneSection.tsx  another scene of the open chapter on the same page: its own draft and saves
src/lib/brackets.ts      {braces} (asks for the team): finding them, the fill job, its answers, putting each answer into the page
src/lib/live.ts          the open page stays live: line merge with a newer version, cursor mapping, the dots
src/lib/chapters.ts      a chapter's number and name: making room for a new chapter, moving a chapter, renaming (beats, plans, scraps renamed)
src/lib/plans.ts         a chapter's plan note (Chapter Plans) and scrap note (Chapter Scraps)
src/lib/context.ts       what is on screen, sent with a chat from the team column beside a page (## Page)
src/lib/beats.ts         a chapter's beats: the Chapter Beats note, laying the prose out under its beats and back
src/ui/BeatsPage.tsx     BeatsView, the chapter by its beats inside the writing screen: closed rows that open to their prose
src/ui/Matrix.tsx        who is in which scene
src/ui/TodoList.tsx      the To-do page: every to-do, and the team's notes on the draft of the active book (was the Edit Queue)
src/ui/EditFields.tsx    a card's words edited in place (board cards and scene cards)
src/lib/team.ts          the AI team: agents, skills and who loads them, lessons, journals, history, numbers for the Team page
src/ui/Team.tsx          the Team page, an agent's page, Skills and Session history
src/lib/workflow.ts      the workflow from System/Workflow.md: stages, steps, who does each, Kyle's dated notes
src/ui/Workflow.tsx      the Workflow page: each stage's table, filters, notes
src/lib/flow.ts          Workflow mode: steps paired into tasks, where each stands (Check too), the mode per book, results as idea notes, the step job's ask
src/ui/Flow.tsx          Workflow mode's screens (home, stage, step), the Workflow | Writing switch, the writing screen's Workflow tab, From the workflow on character pages
src/lib/rooms.ts         the book's six rooms and which pages each holds (Plan's Steps, the Codex's four kinds); the Team room's places
src/lib/find.ts          Find in the top bar: chapters, scenes, codex names and ideas matching what Kyle types
src/ui/Rooms.tsx         each room's pages and their addresses (listed in the sidebar and the top bar's menu)
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
src/ui/Seeing.tsx        the five pages' links (sidebar Plan and Review) and which one to show
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
src/lib/nextstep.ts      the guided next step from the book's stage and notes, and its next-step job
src/lib/notes.ts         Notes to the Team: the book's notes, open first, who for, where answered, new ones
src/lib/sessions.ts      session notes: newest first, read speaker by speaker, voice colours, the ideas each filed
src/lib/recipes.ts       Kyle's recipes: the list, a job's ask with a recipe, add, edit and rename
src/ui/Overview.tsx      the Overview page, the stage strip and the next step button
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
```
