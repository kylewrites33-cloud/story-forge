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
  (`toggleStyle`, `insertText`). The plain text box with its stars is gone (Kyle, 2026-10-20: no need to keep it).
  Export to Word (Kyle, 2026-10-18) on Book details: the whole book in reading order as a .docx named
  `series_book_YYYY-MM-DD.docx`, made on the device and downloaded (`src/lib/docx.ts`, the layout of sf's Docx.build;
  italics and bold read with styled.ts, so they come back unchanged through `sf import`). Each export also saves a copy in the vault's
  `Book Backups/<series>/<book>/` (same day replaces that day's file); New series and New book make their backup folders.
  The writing screen has three parts, like Sudowrite: the book's chapters and scenes on the left (press one to save and
  move to it; board shortcuts below), the page in the centre (a tool row with Bold, Italic, Undo, Redo, Split and Join;
  a chapter heading; an arrow to the previous and next section at the bottom), and the scene panel on the right (Card, Copies,
  Target, Split and join). The bottom bar (Kyle, 2026-10-21: "a more useful function at the bottom would be previous
  section and next section"; then "really subtle ... just an arrow to the left on the left side, and an arrow to the right
  on the right side. no colored text"; then "stay fixed at the bottom ... i just always see it" with "a subtle visible
  horizontal divider") is two faint arrows side by side on the left (Kyle, 2026-10-21: "right next to each other on the left side"), pinned to the bottom of the screen under a faint line (also while typing with a hardware keyboard: the screen
  keeps its full height and the iPad's small shortcut bar floats between the arrows; Kyle, 2026-10-21, "bring the bar all
  the way down, even when im tapped in the word processor"), opening the scene before and
  after in reading order, crossing chapters. Its name (the chapter when it is another chapter or a one-scene chapter)
  shows on hover. At the start or end of the book that arrow is left out. It replaced "Done with this scene?"; Mark as drafted is now on the Card tab (and still in
  Split and join), and Done in the top bar goes back to the Chapter Grid. The list sits beside the page from 900 px wide and the panel from 1200 px; narrower, each
  slides over the page. The chapter list opens at the chapter Kyle is in, its scene highlighted, on every size (Kyle,
  2026-10-21: "right now im regularly having to scroll down from chapter 1"); while it stays open it scrolls only when
  the open scene is out of sight. Outside the writing screen a sidebar on the left (Sudowrite and Novelcrafter style, `src/ui/Shell.tsx`)
  holds Books and Series, the open book's cover and title, Keep writing, the book's boards grouped as Write, Plan, Codex,
  Review and Publish, and at its foot Chat, Jobs, To-do, sync and Settings. From 1100 px it shows names; from 700 px it is
  a strip of icons with short names that the menu button opens in full; narrower, a slim top bar opens it over the page. A Chapter Grid
  card opens the writing screen; Needs work, Edit card and the note sit behind its "•••" button.
  Novelcrafter-style additions (Kyle, 2026-10-18): the app opens on a home page (Books or Series, "Continue where you
  left off" from the scenes last opened on this device, cover cards or a list, search and sort) and a page per series.
  A book's cover is `Cover.jpg` in the book's folder, shrunk on the device before saving, and is added or changed on Book details (`#/board/details/<book>`, the sidebar's item under Keep writing, like Novelcrafter's novel settings; the Chapter Grid's cover links there; Kyle 2026-10-18); a book without one gets a
  pattern from its title. Empty pages offer buttons (Create first scene, Start from an outline: pasted lines become
  planned scenes). Chapter Grid: a summary under the title (stage, chapters, scenes, words, pages, a count per status, and a ring in the next status's colour for how far the book is through drafting, revising or finishing, set by its least finished scenes; `bookProgress`, Kyle 2026-10-18), coloured status edge with a key under the filter (grey planned, orange drafted, blue revised, green final; no scene ID or status word on cards and outline rows, an experiment, Kyle 2026-10-18), scene `labels` and `subtitle`, a search box (Kyle, 2026-10-21: "if i type in 33, chapter 33 should show up": a number finds that chapter, then the scene with that ID; "ch 33", "S-051" or "s51" ask for one or the other; a chapter's title finds its scenes; a nickname finds the character's scenes; one wrong letter in a longer title or name still matches; the best match comes first, with a Best match button, and Enter opens it; `src/lib/search.ts`), Outline (first, the default) or Cards,
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
  A to-do keeps every word Kyle types, at any length; only its file name is shortened (Kyle, 2026-10-20: "when I pasted
  it in this to do, it cut it off short").
  The Pomodoro timer (Kyle, 2026-10-18): 25 minutes of writing and a 5 minute break, kept on the device ("just 25 minutes
  and a 5 minute break option. no 50 or 10", Kyle 2026-10-19). It floats at the
  bottom right outside the writing screens and sits in their top bar (beside Leave focus in Focus mode), so it never
  covers the page or the toolbar. Each finished Pomodoro adds a line to the vault's `Writing Log/YYYY-MM-DD.md`
  (`writing-day`: pomodoros, minutes, words) with the words written in it; offline ones wait on the device.
  A Pomodoro stopped early still logs its minutes (pauses left out) and words, marked "(stopped early)", without adding
  to the Pomodoro count; the panel shows today's Pomodoros, minutes and words (Kyle, 2026-10-19: "it doesnt show the 15
  minutes or so of the pomodoro i stopped").
  The panel and its button count the day in Pomodoros by minutes, so stopped ones add up: 40 minutes shows as
  1.6 Pomodoros (Kyle, 2026-10-19: "my goal is to amount to 5 pomodoro sessions worth of writing"). The log keeps the real
  count of whole ones.
  While a Pomodoro runs, its button only changes colour (no ticking clock); the time shows when Kyle taps it, and
  starting one leaves the panel closed (Kyle, 2026-10-20).
  Words count what Kyle writes, in the page, Beats view and Focus alike: each rise in a scene's count adds, and cuts are
  not taken away, so rewriting a passage counts its new words (Kyle, 2026-10-20: a rewrite in Beats logged 0 words).
  Words typed count all the time, with or without a Pomodoro (Kyle, 2026-10-21: "sometimes ill write in the app but forget
  to hit the pomodoro"): the day's total goes to the same Writing Log note as `typed`, after a two-minute pause or every ten
  minutes of steady typing (and when the app is put away), and the panel leads with "Today: N words typed". They count
  Kyle's own words only: words the team puts on the page (filled brackets, Options, Put it at the end, lines merged in from
  elsewhere), a copy brought back, a joined scene, a beat moved to another scene and undo or redo add nothing, and since
  cuts never take words away, deleting the team's words does not lower the count (Kyle, 2026-10-21: "how the words typed
  might be affected by deleting generated text"). The Pomodoro's own words follow the same rule.
  Opened from the iPad's home screen, the app moves down below the device's clock and battery bar (the `ios-app` class
  and `--safe-top`, 24 px), since iPadOS lays that bar over the page and reports no safe area (Kyle's screenshot, 2026-10-20).
  The writing screens lock the page in place, so dragging a text selection down on the iPad scrolls the writing, not the
  whole app (Kyle's screenshot, 2026-10-20).
  Pressing Start (or Carry on, or Skip the break) closes the panel; it opens again only when Kyle presses the timer
  (Kyle, 2026-10-19: "when i start the pomodoro, dont show the dropdown by default. only show it when i tap the button again").
  Pressing the timer when nothing runs starts a Pomodoro straight away, with no panel first (Kyle, 2026-10-22: "the
  pomodoro timer still drops down when you first tap it, instead of starting immediately"). Pressing it again while one
  runs opens the panel (time left, Pause, Stop, today); holding it, or a right-click with a mouse, opens the panel at any
  time without starting one, so today's words and Pomodoros are still in reach.
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
  One link each (Kyle, 2026-10-19: "it's not important for me to have a dropdown. I just want to click AI team with the
  number of AI team members and get to the whole team page. Session history should be available on that page too"; and
  for skills, "I'd like them to be in a dropdown format, so you don't see the details of any individual skill until you
  click"): the sidebar's foot ends with "AI team" and "Skills", each with its count, in place of the two folding lists.
  The Team page ends with Session history for everyone (the last 30, Show all for more); a face still opens one agent's
  history at `#/history/<name>`. The Skills page shows each skill folded to its name and who loads it; opening it shows
  the rest, and a link to one skill opens that one.
  Team page update (Kyle, 2026-10-19: "update the agents list in the app, including their roles, the model, the skills
  they possess"): the table's columns are Agent, Role (the agent file's `role:` line, else its specialty), Model ("Your
  pick" for `inherit`, with the job model from Config; otherwise Opus 5.5, Sonnet 5.5), Skills, Steps (workflow steps
  whose Who names the agent, linking to the Workflow page) and Kept, with last used, ideas and lessons under the role.
  Narrower than 860 px of page (iPad, or desktop beside the team chat) each agent is a card. An agent's page adds Role,
  Model, Never sees (`never_sees:`), Can (its tools in plain words), Called in when (its description) and "In the
  workflow", each step linking to `#/workflow/<n>`.
  Quick jobs on Sonnet (Kyle, 2026-10-19: "for these cases, where I'm doing a quick chat in the app or if I'm pressing
  one of those quick buttons like filling in the brackets, I would like to use Sonnet... I do want the ideal models to
  persist in workflow use and be reflected on the team page"): chat, Fill brackets, Options, Check and scene summaries
  run on the vault's `job_quick_model` (Sonnet 5.5), helpers included; every other job keeps the workflow's models.
  Naming a model in the ask ("use Opus", "on Fable") runs that one job on it. The Team page keeps each agent's own model
  and says so under the table; an agent's page adds "Quick chats and buttons".
  The Workflow (Kyle, 2026-10-19: "put the slightly modified (workflow 1.1) in the app so it shows all the tables. I want
  to always be able to assess and judge this workflow"): `#/workflow`, in the sidebar's foot and the icon strip, reads
  the vault's `System/Workflow.md` (synced with the team's files) and shows each stage's table: Step, Who (agents as
  linked faces), Minds (several minds marked), Needs, Why, with filters for one agent's steps or only the steps with
  several minds. The Step column has no "Several minds" bubble; the Minds column already says it (Kyle, 2026-10-19).
  Below 600 px of page each step is a card. Add a note on the workflow, or Note on a step, saves a dated
  line under "## Kyle's notes" at the end of the note (`addWorkflowNote`), so the next version answers it; the team chat
  beside the page knows it is on the workflow. Note views now show Markdown tables too.
  Workflow mode (Kyle, 2026-10-21: "put in the AI mode with all these workflows... databases for all these AI-created
  elements in the AI mode, so that what's created in AI mode can naturally show up in the writing mode too"; nothing
  removed). A Workflow | Writing switch sits under the book in the sidebar and on every Workflow page, kept per book on
  the device; a book with no prose starts in Workflow mode (Kyle agreed new books start there), one with prose in Writing
  mode, and in Workflow mode the book's link opens Workflow. `#/flow/<book>` is its home: Pick up here (the first step
  with nothing kept), the six stages as a road with steps kept and waiting, Waiting on you, The team is working on, and
  Your own steps. `#/flow/<book>/stage/<n>` lists a stage's steps with where each stands (Not started, The team is on it,
  Waiting on you, Check, Kept); a step and the "Judge…" step after it are one row ("18–19"). `#/flow/<book>/step/<key>`
  has Judge (Keep, Later, Drop, with the panel's 1-to-5 score and line; Ask the team to judge), Kept, Make (Ask the team,
  Bring in results pasted from elsewhere, one per paragraph or list line, and Write your own, kept at once) and Change
  (the team makes new results from Kyle's words). Check shows when an earlier step in the same or the stage before kept
  something after this step's results were kept; Still fine sets `checked` on them. The store is the book's Ideas folder:
  every result is an idea note with `step`, `origin` (team, brought-in, kyle), `target` (a character or "Chapter N") and,
  once judged, `panel_score` and `panel_note`, so results also show on the Ideas board. Asking writes a `workflow-step`
  job (target "Step N") that the runner answers from the step's row. In Writing mode the writing screen has a Workflow tab
  (what was kept about the chapter and the people named on the page) and a Workflow button in the top bar, and a
  character's page ends with From the workflow (kept results about them, and Add a part of your own). In the sidebar, in
  Workflow mode, All stages and the six stages come first and every other place sits under Writing tools; the foot's
  link to the table is now called Workflow table.
  Beats (Kyle, 2026-10-18, modelled on the Writer's chapter 31 page): `#/beats/<scene path>` is the writing screen with
  its page area showing the scene's chapter by its beats (chapter list, right column and top bar stay; the top bar's Beats
  button becomes Page to switch back, Kyle 2026-10-18), each a closed row (number, title, one-line summary); open one for a slim title row with its prose right under
  it (the summary hides while open); Open all, Close all; title, summary and prose are edited in place and save like the
  writing screen. The scenes keep only the story: a chapter's beats live in the book's `Chapter Beats/Chapter N beats.md`
  (`chapter-beats`), each beat with `Starts: S-NNN · <first ten words>` so the app finds where its prose begins (see
  `src/lib/beats.ts`). Prose before a scene's first beat shows as an unnamed beat. Add a beat after, Take off this heading.
  Ask the team writes a `beats` job (the Story Specialist finds the beats in the prose, plans them from Kyle's words, or
  redoes them, archiving the old note). Reached from the writing screen's and whole chapter's Beats button and each
  chapter heading on the Chapter Grid. The writing screen's tool row stays in beats mode (Kyle, 2026-10-19, "the full word
  processor tool set too"): Undo, Redo, Bold, Italic, Highlight, Normal, Find, Names, Check, Listen and the Ask the team
  buttons work on the open beat the cursor is in. Split, Join, Options and Fill brackets stay on the page only.
  Beats mode also shows the page's heading: the scene line, the chapter strip and the target bar, all
  counting the words as Kyle types in the beats (Kyle, 2026-10-19). The writing screen no longer shows pages and minutes to read
  (Kyle, 2026-10-22: "the minutes to read area in a section isn't needed"); the Chapter Grid and home page still do. A beat's prose looks like the page while it is edited
  (no tinted box). Each beat with a heading has a Move handle: hold and drag it up or down (finger or mouse), or press
  Move up / Move down on an open beat; its prose moves with it, into the scene it lands in (`moveBeat` in `src/lib/beats.ts`).
  Every part of a scene is a beat (Kyle, 2026-10-19: "the whole scene should be composed of these sections"): a scene's
  opening words show as a numbered beat with no name yet, and move like any other; once they are not first in their
  scene they are saved in the beats note as "Untitled beat", which reads back with no name.
  The writing screen's right column has a Beats tab (Kyle, 2026-10-21: "a button for seeing the beats laid out there as
  well. no need for the dropdown for the actual text within the beat"): the open scene's chapter beats as a plain list,
  title and one-line summary, no prose. A beat in the open scene is a link that puts the cursor where it starts.
  The writing screen's top bar stays on one line with icons only below 1300 px (Kyle, 2026-10-19, after trying short
  names under the icons: "bring it back to what it was before for now. i like them all on one line").
  Brackets, plan and chat beside the page (Kyle, 2026-10-18): `[...]` in the prose is a gap and `[a question]` an ask
  for the team (`src/lib/brackets.ts`; never `[[links]]`, `[!callouts]`, `[^notes]` or `[text](links)`). Fill brackets in
  the toolbar (or, per device, on their own after 20 quiet seconds) writes a `fill` job listing them; the Writer answers in
  the job note only, and the page puts each answer in once: a gap's words right after it, an ask as a paragraph under its
  paragraph. The bracket always stays until Kyle deletes it (Kyle, 2026-10-19: "I do want to keep the bracket so that I
  can check the results"), and an answered bracket is not sent again unless he changes its words. Answers come in plain,
  in the page's own style: "> " quote arrows are taken off and each quoted line becomes its own paragraph (Kyle,
  2026-10-19: "I don't like the arrows"). An answer whose bracket is gone offers Put it at the end. Added lines get a dot drawn by CSS
  (never in the file), kept per device, gone when Kyle clicks or types in that line. The right-hand column opens on Chat
  (the scene's conversation) or Plan (the chapter's `chapter-plan` note in the book's `Chapter Plans/`, never the prose),
  remembers its tab, hides with its arrow or the top bar's panel button, and sits beside the page from 900 px while the
  chapter list is closed. While a scene is open the app reads the vault every 30 seconds (15 while the team is answering)
  and merges a newer version line by line into the page (`src/lib/live.ts`): Kyle's lines win a clash, the other version is
  saved as a copy. The vault's `put-in-page` skill tells any Claude session how to push words there.
  Offline sync made safe (Kyle, 2026-10-20: the iPad is the main device; words written offline must reach the vault the
  way Scrivener's do). Every save, including a scene that waited on the device with no connection, merges line by line
  with what changed elsewhere (`saveDraft` uses `merge3`): only lines both sides changed make a "changed elsewhere" copy,
  with Kyle's lines kept. A save that waited tells Kyle in a notice at the top of the page that stays until he presses OK
  (`mergeNotice`, kept per device). While he types without a two-minute pause the page still saves every five minutes.
  The app asks the browser to keep its stored words (`navigator.storage.persist`). On a touch screen, holding a finger on
  any button with a name shows the name (`src/ui/hold.ts`), so the icon-only bars can be learnt on the iPad.
  Repeated lines fixed (Kyle, 2026-10-21: "Peppermint was right." appeared three times with big gaps in chapter 32; "i
  definitely didn't type this"). A scene left marked as waiting on the device was also saved by the 30-second sync while
  the page saved it, and the merge then added his new line a second time on every round. Now a scene open on the page is
  saved only by the page (`holdOpen`), and `merge3` never brings in lines Kyle already added himself in the same place,
  nor empty lines where he is writing.
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
- The cleaner look (Kyle, 2026-10-21: "a visual redesign... keep the app as simple and uncluttered as is realistically
  possible... keeps all the app's capabilities"; "cool, lets do it. we'll tweak things as I use it"). The sidebar has the
  book card (its books button opens Books and Series), the Workflow | Writing switch, then six rooms: Home (the Overview,
  with Keep writing as the big button at the top), Manuscript (Chapter Grid, Edit Queue), Plan (Ideas, Story Juice, Beat
  Sheet, Conflicts, Promises, Plot Grid, Timeline, Character Arcs, Notes to the Team), Codex (Characters, Matrix, Cast
  web), Review (Tension and Pacing, Themes, Sessions, Taste) and Publish (Market, Book details with Export to Word). Each
  room shows its boards as tabs across the top (`src/lib/rooms.ts`, `src/ui/Rooms.tsx`). In Workflow mode the stages come
  first and the rooms follow under "The book". The foot has Team (tabs: Chat, Jobs, Agents, Skills, Recipes, Workflow
  table; a dot while a job runs), To-do (open count), Settings, and a small sync line (press it to sync). Edit Queue went
  in Manuscript and To-do stayed its own link (Claude's defaults; Kyle did not choose). The writing screen's top bar has
  one switch for Page, Beats and Whole chapter; its To-dos, Workflow and Chat buttons moved into the side column, whose
  fifteen tabs are now four groups (Team: Chat, Options, Ask the team; Chapter: Plan, Beats, Workflow, To-dos; Scene:
  Card, Notes, Marks, Copies, Target, Split and join; Tools: Page look, Check), with the to-do count and the chat's dot on
  them. Rounder cards, a 44 px sidebar row and theme colours only, so all ten themes still work.
- The rest of the new look (Kyle, 2026-10-21: "seems good. bring over whatever else."). The Pomodoro timer sits in the
  sidebar's foot as Timer (Writing, Paused or Break while it runs, coloured as before), its panel opening beside the
  sidebar; on a phone, where the sidebar is hidden, it sits in the slim top bar. Only one timer is on screen at a time.
  The writing screen keeps its own timer in its top bar. Below 900 px wide (an iPad held upright, a phone) the writing
  screen's right-hand column is a sheet pulled up from the bottom over the lower part of the page; its arrow or a press
  on the page above puts it away.
- Chapter names and a tidier Workflow page (Kyle, 2026-10-21: "maybe you invent and store in your database a chapter
  name for each of these scenes, and then the chapter title is just presented there"; "i dont see number order, and these
  rounded rectangles are not presented cleanly"). The writing screen's chapter list shows each chapter's number and
  name (`chapter_title`, written on the first scene of each Quest Declined chapter, vault e70ded9) on one line; a
  chapter of one scene is one row, and a longer chapter's scenes sit under its name, one line each, with the full
  summary on a long press or hover. Workflow home numbers its six stages (Stage 1 to 6, the group name beside it) in even
  cards, two across or three when the page is wide enough, the bar at the bottom of each; Waiting on you and The team
  sit side by side, Your own steps across the full width; the page's own Workflow | Writing switch hides wherever the
  sidebar shows one.
- Scrap (Kyle, 2026-10-22: "can you please give me a scrap section in the right hand chapter column pullout?"). The
  writing screen's right-hand column has a Scrap tab in its Chapter group, after Plan: one scrap per chapter for words he
  cut and notes he wants to keep out of the story, saved as a `chapter-scrap` note in the book's `Chapter Scraps/`
  folder and kept on the device as he types, the way the Plan tab is. "Move picked words here" cuts the words picked on
  the page (one step to undo there) and adds them to the end of the scrap. The team leaves the scrap alone unless he
  asks, and sf packet does not include it.
