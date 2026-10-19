# What the app does, feature by feature

The full record of every screen and behaviour, with when Kyle asked for it. Moved out of CLAUDE.md on 2026-10-19 so that
file stays under Anthropic's 200-line guidance; nothing was dropped. Read the part about a feature before changing it, and
add a dated line here when you add or change one.

- Phase 1: the Chapter Grid, read only. Phase 2 adds the Ideas board (keep, later, drop, written back with a write queue).
  Phase 3 adds the Story Juice, Beat Sheet, Conflict Matrix (keep, later, drop) and Characters (read only) boards, and
  Accept card / Needs work on the Chapter Grid (sets or clears a scene's `accepted` time). Phase 6 (first part) adds the
  writing screen: Kyle writes and edits a scene's prose full screen, kept on the device as he types and saved to the vault
  on Done, after two quiet minutes, or when the connection is back; word targets; copies (snapshots) saved and restored.
  Then: Add a scene (per chapter, or start a new chapter) on the Chapter Grid; in the writing screen, Split here (the words
  after the cursor become a new scene; a copy is saved first), Join the next scene (its note moves to the book's Archive
  with a note saying why, and an open Notes to the Team note asks the team to repoint its old ID), and Mark as drafted.
  On the Chapter Grid, hold a card's Move button and drag it (finger or mouse) to a new place or chapter: only its `order`,
  `chapter` and `chapter_title` change, through the write queue (a chapter title the card carried passes to the chapter's
  next scene). The Market board shows the series' market case, comps, keyword sets and titles with keep, later and drop,
  the same way as the Ideas board, and Add a Rocket file saves a Publisher Rocket CSV from the device, unchanged, into the
  series' `Market/Rocket Exports` (never replacing an earlier file). Every proposal board also has Rewrite (status
  `regenerate`, with what to change in `decision_note`) and Edit (the card's text fields, one line each, never the title or
  ID); a scene card's Edit card also changes its status (planned, drafted, revised, final). The To-do list (Phase 4's
  Edit Queue tasks) shows every task note by status, with Start, Done, Drop and Reopen, and Add a to-do writes a new
  `Tasks/T-NNN` note. The writing screen shows `*italics*`, `**bold**` and `==marks==` the way a word processor
  does, with no stars on the page: each styled span keeps its mark in `data-m` and the page reads back to exactly the
  Markdown (`readText`). Bold, Italic and Highlight (buttons, Ctrl or Cmd+B and I, the iPad's B and I keys) style or
  unstyle the selection or the word at the cursor, or wait for the next letters typed; Enter inside styled words closes and
  reopens their marks; copy gives other apps styled text and paste keeps a word processor's italics and bold
  (`toggleStyle`, `insertText`). A per-device switch in Scene goes back to the plain text box with its stars.
  Export to Word (Kyle, 2026-10-18) on Book details: the whole book in reading order as a .docx named
  `series_book_YYYY-MM-DD.docx`, made on the device and downloaded (`src/lib/docx.ts`, the layout of sf's Docx.build;
  italics and bold read with styled.ts, so they come back unchanged through `sf import`). Each export also saves a copy in the vault's
  `Book Backups/<series>/<book>/` (same day replaces that day's file); New series and New book make their backup folders.
  The writing screen has three parts, like Sudowrite: the book's chapters and scenes on the left (press one to save and
  move to it; board shortcuts below), the page in the centre (a tool row with Bold, Italic, Undo, Redo, Split and Join;
  a chapter heading; "Done with this scene?" with Next at the bottom), and the scene panel on the right (Card, Copies,
  Target, Split and join). The list sits beside the page from 900 px wide and the panel from 1200 px; narrower, each
  slides over the page. Outside the writing screen a sidebar on the left (Sudowrite and Novelcrafter style, `src/ui/Shell.tsx`)
  holds Books and Series, the open book's cover and title, Keep writing, the book's boards grouped as Write, Plan, Codex,
  Review and Publish, and at its foot Chat, Jobs, To-do, sync and Settings. From 1100 px it shows names; from 700 px it is
  a strip of icons with short names that the menu button opens in full; narrower, a slim top bar opens it over the page. A Chapter Grid
  card opens the writing screen; Needs work, Edit card and the note sit behind its "•••" button.
  Novelcrafter-style additions (Kyle, 2026-10-18): the app opens on a home page (Books or Series, "Continue where you
  left off" from the scenes last opened on this device, cover cards or a list, search and sort) and a page per series.
  A book's cover is `Cover.jpg` in the book's folder, shrunk on the device before saving, and is added or changed on Book details (`#/board/details/<book>`, the sidebar's item under Keep writing, like Novelcrafter's novel settings; the Chapter Grid's cover links there; Kyle 2026-10-18); a book without one gets a
  pattern from its title. Empty pages offer buttons (Create first scene, Start from an outline: pasted lines become
  planned scenes). Chapter Grid: a summary under the title (stage, chapters, scenes, words, pages, a count per status, and a ring in the next status's colour for how far the book is through drafting, revising or finishing, set by its least finished scenes; `bookProgress`, Kyle 2026-10-18), coloured status edge with a key under the filter (grey planned, orange drafted, blue revised, green final; no scene ID or status word on cards and outline rows, an experiment, Kyle 2026-10-18), scene `labels` and `subtitle`, a filter box, Outline (first, the default) or Cards,
  pages and reading time (rates in Settings). Writing screen: Focus mode, a Page tab (size, spacing, width, font,
  paper, per device) and a strip of the chapter's scenes sized by length.
  Ask the team (jobs): a Team tab in the writing screen's scene panel (Draft this scene, planned scenes only; Notes on
  this chapter; Check for AI-sounding phrases; Learn from my edits; Ask the team… with one line of Kyle's words) and
  Draft / Check on a Chapter Grid card's ••• menu each write a `Jobs/J-NNN` note with status `requested` as Kyle's commit.
  The vault's GitHub workflow runs the job and writes `started`, `finished`, `cost_usd`, `run_url`, `result` and a
  `## Result` section back; the Jobs screen (top bar) lists jobs by status, refreshes itself every minute while open, and
  Cancel sets a requested job to `cancelled`. A job of the same kind and target still waiting or working is never made twice.
  Chat with the team (top bar Chat, `#/chat` and `#/chat/<thread>`): each message Kyle sends is a job of kind `chat`
  whose `thread` is a scene ID (a conversation about that scene, opened from the Team tab's "Talk about this scene") or
  `chat-NNN` (New conversation); the runner answers each in ID order from the earlier messages in its thread. The screen
  lists conversations newest first and shows one like a chat (Kyle right, the team's reply left, cost small); Kyle may send
  again before a reply comes. While an open conversation waits for a reply the app syncs every 15 seconds (only while the
  page is visible). The Jobs screen leaves chat messages out.
  Everything else from the Sudowrite and Novelcrafter lists (Kyle, 2026-10-18, "set up everything app-wise"): in the
  writing screen, codex names (characters, places, items, lore, with aliases and a character's first name) underlined in
  their colour and opened as a card in the Card tab; Notes (the book's Braindump.md); Marks (`==highlight==`, with a
  highlighter button and a list to jump through); Normal (takes bold, italic and highlight marks off); Find and replace;
  Every save (the file's commits, with Go back to this version); the book's Archive with Restore; Whole chapter (every
  scene of the chapter as one page, each saving on its own). Boards: Matrix (scenes down, codex across; point of view,
  on the card, or named), Edit Queue (editorial notes and to-dos), and Appears in on character, place, item and lore notes.
  New book and New series on the home page; Bring in a manuscript (file saved unchanged in the book's Research folder,
  then an `import` job); Edit card changes a scene's title (the file is renamed). Rewrite can ask the team to rewrite
  now (a `rewrite` job); Table read of this chapter (`table-read`) and Ask the team for more ideas (`ideas`). These kinds
  have full steps in the job's ## Ask, so the runner's coordinator can run them without its own prompt.
  The writing screen's toolbar (Kyle, 2026-10-18) has Undo and Redo; Bold, Italic, Highlight and Normal; Find, Split and
  Join; and a second row, Ask the team: Rewrite, Describe, Brainstorm and Write on each send one chat message about the
  words picked (or the paragraph, or the text before the cursor) to the scene's conversation, and the team answers there
  without changing the scene; Team opens the Team tab. The page, not the text box, scrolls: nothing in it may shrink.
  Chapter to-dos (Kyle, 2026-10-18): the writing screen's To-dos button (with the open count) opens the To-dos tab, the
  chapter's to-dos beside the page. They are `task` notes in the book's own `Tasks/` folder with `chapter` (and `scene`);
  Kyle adds one in a line and ticks it off; the team's carry `generated: true` and `found_by` and show a Generated label.
  Ask the team to check this chapter (`chapter-check`) and to tick off fixed ones (`todo-review`, which sets `done_note`).
  The To-do list shows both lists, with Book to-dos and Story Forge to-dos tabs. Kyle's "~" notes in Quest Declined became to-dos (Kyle, 2026-10-18).
  The Pomodoro timer (Kyle, 2026-10-18): 25 or 50 minutes of writing, 5 or 10 of break, kept on the device. It floats at the
  bottom right outside the writing screens and sits in their top bar (beside Leave focus in Focus mode), so it never
  covers the page or the toolbar. Each finished Pomodoro adds a line to the vault's `Writing Log/YYYY-MM-DD.md`
  (`writing-day`: pomodoros, minutes, words) with the words written in it; offline ones wait on the device.
  Scene notes (Kyle, 2026-10-18, "i want to see the word processor clean"): a scene's planning notes (Kyle's outline,
  Team notes, Open for Kyle questions, Source lines) live in the book's `Scene Notes/` folder as a `scene-notes` note
  per scene, never in the prose; the writing screen's Card tab shows them under the card, read only.
  The AI team (Kyle, 2026-10-18): below the sidebar's foot, at the bottom of its scroll, "The AI team" lists every agent
  (from the vault's `.claude/agents`, grouped by each file's `team:` line) and "Skills" lists every skill in
  `.claude/skills` with who loads it (each agent's `skills:` list; none means the coordinator runs it); both fold away,
  remembered per device, and the icon strip shows Team, Skills and History instead. The Team page (`#/team`) is a table
  like the first Story Forge's: Recently used, A-Z and By team; specialty, last used, ideas (proposals whose `source` is
  the agent), kept share, lessons (MEMORY.md) and Talk (a new chat that starts with the agent's name). An agent's page
  (`#/team/<name>`) adds its skills, lessons and what it has done. Session history (`#/history`) is every agent's
  Journal.md entries, the jobs it ran and the vault's last 100 saves with an `Agent:` line.
  Beats (Kyle, 2026-10-18, modelled on the Writer's chapter 31 page): `#/beats/<scene path>` is the writing screen with
  its page area showing the scene's chapter by its beats (chapter list, right column and top bar stay; the top bar's Beats
  button becomes Page to switch back, Kyle 2026-10-18), each a closed row (number, title, one-line summary); open one for a slim title row with its prose right under
  it (the summary hides while open); Open all, Close all; title, summary and prose are edited in place and save like the
  writing screen. The scenes keep only the story: a chapter's beats live in the book's `Chapter Beats/Chapter N beats.md`
  (`chapter-beats`), each beat with `Starts: S-NNN · <first ten words>` so the app finds where its prose begins (see
  `src/lib/beats.ts`). Prose before a scene's first beat shows without a heading. Add a beat after, Take off this heading.
  Ask the team writes a `beats` job (the Story Specialist finds the beats in the prose, plans them from Kyle's words, or
  redoes them, archiving the old note). Reached from the writing screen's and whole chapter's Beats button and each
  chapter heading on the Chapter Grid.
  Brackets, plan and chat beside the page (Kyle, 2026-10-18): `[...]` in the prose is a gap and `[a question]` an ask
  for the team (`src/lib/brackets.ts`; never `[[links]]`, `[!callouts]`, `[^notes]` or `[text](links)`). Fill brackets in
  the toolbar (or, per device, on their own after 20 quiet seconds) writes a `fill` job listing them; the Writer answers in
  the job note only, and the page puts each answer in once: a gap in place, an ask as a paragraph under its paragraph with
  the bracket taken out. An answer whose bracket is gone offers Put it at the end. Added lines get a dot drawn by CSS
  (never in the file), kept per device, gone when Kyle clicks or types in that line. The right-hand column opens on Chat
  (the scene's conversation) or Plan (the chapter's `chapter-plan` note in the book's `Chapter Plans/`, never the prose),
  remembers its tab, hides with its arrow or the top bar's panel button, and sits beside the page from 900 px while the
  chapter list is closed. While a scene is open the app reads the vault every 30 seconds (15 while the team is answering)
  and merges a newer version line by line into the page (`src/lib/live.ts`): Kyle's lines win a clash, the other version is
  saved as a copy. The vault's `put-in-page` skill tells any Claude session how to push words there.
  Team chat beside every page (Kyle, 2026-10-18): outside the writing screens, every page but Chat and Settings has the
  team chat on the right (`TeamSide` in `src/ui/Chat.tsx`, placed by `Shell`): beside the page from 1200 px, over it
  narrower; a round Chat button at the bottom right opens it, its arrow hides it (per device), and the Pomodoro moves
  left of it. One conversation per book on this device (a `chat-NNN`, until New conversation). Each message carries a
  `## Page` section (`src/lib/context.ts`): the page, the book and the notes on screen, so the team can guess what
  "this one" means; the vault's runner passes it on.
  Deciding faster (Kyle, 2026-10-18, from Writers Room): after Keep, Later or Drop on any proposal board the toast offers
  one-press reasons (Love it, Surprising, Specific, Raises the stakes; Not now, Needs work, Could combine; Cliché, Wrong
  tone, Already have this, Too clever) written to the note's `reasons` list as a separate edit, so skipping costs nothing
  and Undo puts the old reasons back. Ideas have 1 to 5 stars (`rating`, a number) on the card. The Ideas board adds a
  filter by who proposed (`source`) and kind, tick boxes with Keep all / Later all / Drop all, Ask the team to combine (two
  or more ticked, a `combine` job) and Ask for variations (one ticked, a `variations` job, three takes), both filed by the
  team as new inbox ideas, and One at a time (a button, or F). Keys there are extras: K keep, M later, D drop, 1-5 stars,
  U undo, X tick, arrows move. The Taste page (`#/board/taste/<book>`, sidebar Review) shows `Taste/Taste Profile.md` and
  `Taste/Style Fingerprint.md` (read on demand, they are not indexed) and bars of keeps and drops by kind and agent, the
  top 12 reasons and the keep rate per brainstorm `round`, for all books or this one; Update my taste writes a
  `learn-taste` job (`src/lib/taste.ts`).
  Seeing the book (Kyle, 2026-10-18, from Writers Room's Story Dashboard): five pages of the open book. Plan group:
  Promises (`#/board/promises/<book>`: each promise note a lane across the scenes in reading order, a ring where it is
  planted, a dot where reinforced, a square where paid; open ones always show, paid, subverted and dropped fold away;
  warns about an open promise no scene pays even in the last fifth, and a promise naming a scene the book lacks; press a
  lane for its note), Plot Grid (`plot-grid`: the series' and book's threads, or the cast by pov and cast, down the side
  and scenes across; a shaded gap where a thread disappears, flagged past 4 scenes or 15% of the book; pressing a square
  adds or removes the thread in the scene's `threads` through the write queue, a front-matter edit only, and a dashed
  square, the team's guess from `card_draft`, is confirmed first) and Timeline (`timeline`: scenes against story `day`,
  flashbacks and time jumps drawn and said in words, scenes with no day listed). Review group: Themes (`themes`: theme
  notes by chapter, shaded by how often their `keywords` appear in the prose as whole words, a diamond where a card links
  the theme; press a cell for the lines) and Cast web (`cast-web`: an SVG map, circles sized by scenes on stage, lines
  from `relationships`, as wide as the words after the link or the character note's sentences about the other say it is
  tense, else even; a small fixed force layout; press a circle for the character). Wide grids scroll in their own box
  with sticky side labels. `promiseWarnings` and `plotGapWarnings` are WarningChecks for the Overview.
  Check, Options and Listen in the writing screen (Kyle, 2026-10-18, from Writers Room): Check (tool row, and the Check
  tab) runs the vault tool's own linter on the device, free and offline (`src/lib/lint.js` is sf.js's lint section,
  copied by `npm run sync-parser`; `src/lib/lintcheck.ts` maps each flag back onto the page and takes the book's Style
  Guide and the vault Config as sf lint does). It shows the score with sf lint's grade (under 2 Clean, under 5 Light,
  under 10 Noticeable, else Heavy), rhythm numbers and the flags by paragraph; the flagged words are drawn over the page
  with the CSS Custom Highlight API (never in the text or the file), and a flag pressed is shown in the page. Whole
  chapter has the same Check for every scene, scored by words. The team's paid job stays as "the deeper check". Options
  (the Ask the team row) asks for Expand, Describe, Tighten (20 to 40% shorter) or More like my voice on the words picked
  or the paragraph at the cursor: an `options` job carrying the exact passage, answered as `### Option 1/2/3` in its
  ## Result (`src/lib/options.ts`). The Options tab shows them; Use this one saves a copy of the scene, then swaps the
  passage only if it is still there word for word (otherwise Put it at the end or Copy); nothing changes before. Listen
  (tool row, and Whole chapter) reads the page aloud with the browser's speech, a sentence at a time with the marks taken
  out (`src/lib/listen.ts`): Pause, Resume, Back, Next, Stop, speed and voice (kept per device), the sentence being read
  highlighted and scrolled into view. On a narrow page the new tools show icons only and the Ask the team heading goes.
  Running the book (Kyle, 2026-10-18, from Writers Room): Overview (`#/board/overview/<book>`, the sidebar's item under
  Book details) shows words against `target_words`, scenes per status, what is waiting on Kyle (proposals to decide, open
  chapter to-dos, open Notes to the Team, questions in the scene notes, finished jobs not marked seen on this device), the
  warnings of every check (`bookWarnings`), and the Release runway: chapters posted (a scene has `published`), chapters
  ready (all final, none posted) and weeks of buffer at `cadence` (chapters a week; red under two). Target and pace are
  changed in place (written as numbers). A stage strip (the schema's `book_stage` list) tops the Overview and the Chapter
  Grid; pressing a stage asks first, then changes only the book's `stage`. The guided next step (`src/lib/nextstep.ts`) is
  one big button with a sentence of why: Kyle's own step (decide what waits on a board), a move to the next stage, or a
  `next-step` job whose ## Ask names the step and tells the team to stop at a gate for his yes (never made twice while
  one waits). Notes to the Team (`#/board/notes/<book>`, Plan): the book's `note` notes, open first, to the whole team or
  one agent, Mark done and Reopen, and where each was answered. Sessions (`#/board/sessions/<book>`, Review): the book's
  session notes newest first; a session note opens speaker by speaker (`> [!voice] Name` callouts or `**Name:**` lines),
  each agent in its own `--voice-N` colour, Kyle in the accent, then the ideas it filed (its `ideas` list and ideas whose
  `session` links it). "Ask the team about this scene" (a Chapter Grid card's ••• menu, a scene's note view) opens the
  scene's conversation with "About S-012 Title: " filled in. Recipes (`#/recipes`, the sidebar's foot): the vault's
  `Recipes/` notes, Add and Edit (renaming moves the file); the writing screen's Team tab has "With a recipe", which adds
  "Use the recipe [[Name]]" to every job sent from there. The Team page has Forge a new specialist (one line, a `forge` job).
  Pictures of the book (Kyle, 2026-10-18, from Writers Room): Tension and Pacing (`#/board/tension/<book>`, Review) draws
  each scene's `tension` (1-10) in reading order, placed by its share of the book's words, over a reference curve (a rough
  guide: rising, a dip near 75%, the peak near 85-90%), each point coloured by `outcome`; drag a point (finger or mouse)
  to change it, press one for a panel with - and +, the outcome buttons and Open the scene. It warns about three scenes in
  a row that do not rise, a peak before 70% and over 30% clean wins (`tensionWarnings`). Its Mood and shape tab draws
  `mood` (-5..5), smoothed over three scenes and compared with the six shapes of Reagan et al., 2016 (as cited in the
  Writers Room code; not re-checked). Character Arcs (`#/board/arcs/<book>`, Plan): a card per character with `arc_type`
  or `arc_points` (a book delta's points win), Lie (0) to Truth (10); drag a point, press an empty column to add one,
  press a point to nudge or remove it; wrong-way arcs warn (`arcWarnings`). Values the team guessed (scene `card_draft`,
  character `arc_draft`) show dashed and muted; Kyle's change or Confirm takes them off. These writes are card edits
  through the write queue (front matter only; `tension` and `mood` as numbers, `card_draft` and `arc_points` as lists).
  The Chapter Grid has a folding beat ruler (`BeatRuler`): the fifteen Save the Cat beats by percent of words (Snyder,
  Brody, as the vault's save-the-cat skill gives them) and whether the scenes of each save-the-cat beat note (scene
  `beat` link or the beat's `scenes`) land early, on time or late (3 points of give). Codex cards (note view and the
  writing screen's) show "now", the subject's latest progression up to the open scene (or where the writing is), and its
  > [!secret] callouts with whether the team may see each yet, timed the way sf's packet times them (`codexnow.ts`).
  The Matrix marks a red square where a character is on a written scene's card but never named in its prose.
