# What the app does, feature by feature

The app is called Sparrow (Kyle, 2026-10-22: "lets change the name of the app to sparrow. and change the app immage"). Its
name shows in the sidebar, the browser tab and on the home screen; its icon is a cream sparrow over a dark line on
terracotta (Kyle picked it from ten colours on 2026-10-22, after turning down violet versions: "it really doesn't need to
be purple. make it look professional"; drawn by `scripts/make-icons.js`, the same bird in fixed colours in `src/ui/Shell.tsx`), replacing the SF badge. The
repository, the web address and the app's saved settings keep the story-forge name, so keys and home-screen links still
work. Kyle renamed the studio and the vault to Sparrow the same day ("i want the name changed in the studio and all over the
vault"); notes and commits the app writes say "in the Sparrow app". The To-do list's second tab is Sparrow to-dos.

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
  Since 2026-10-23 the same button is also a card, "Export the whole book", at the top of Publish's first page (the
  Market board), because Kyle could not find Book details behind the top bar's page menu.
  The writing screen has three parts, like Sudowrite: the book's chapters and scenes on the left (press one to save and
  move to it; board shortcuts below), the page in the centre (a tool row with Bold, Italic, Undo, Redo, Split and Join;
  a chapter heading; an arrow to the previous and next section at the bottom), and the scene panel on the right (Card, Copies,
  Target, Done, split, join). The bottom bar (Kyle, 2026-10-21: "a more useful function at the bottom would be previous
  section and next section"; then "really subtle ... just an arrow to the left on the left side, and an arrow to the right
  on the right side. no colored text"; then "stay fixed at the bottom ... i just always see it" with "a subtle visible
  horizontal divider") is two faint arrows side by side on the left (Kyle, 2026-10-21: "right next to each other on the left side"), pinned to the bottom of the screen under a faint line (also while typing with a hardware keyboard: the screen
  keeps its full height and the iPad's small shortcut bar floats between the arrows; Kyle, 2026-10-21, "bring the bar all
  the way down, even when im tapped in the word processor"; 2026-10-22, "this happened when the keyboard screen lowered
  with the switch to bluetooth keyboard": the screen now looks again after each keyboard change and every second, so it
  goes back to full height even when the iPad sends no word), opening the scene before and
  after in reading order, crossing chapters. Its name (the chapter when it is another chapter or a one-scene chapter)
  shows on hover. At the start or end of the book that arrow is left out. It replaced "Done with this scene?"; Mark as drafted is now on the Card tab (and still in
  Done, split, join), and Done in the top bar goes back to the Chapter Grid. The list sits beside the page from 900 px wide and the panel from 1200 px; narrower, each
  slides over the page. The chapter list keeps where Kyle left it scrolled, per book, on this device: picking a scene,
  leaving the writing screen and coming back all find it where it was (Kyle, 2026-10-22: "rather than moving the left side
  chapter bar as i select through ... simply remember its position when i leave and re-enter the mode"). Only the first
  time, with nothing remembered, does it open at the chapter he is in (Kyle, 2026-10-21: "right now im regularly having
  to scroll down from chapter 1"). Chapters first, scenes inside (Kyle, 2026-10-22: "i dont like how the chapters with
  scenes look different from the chapters without scenes ... by default the left hand view will just show the chapters
  ... within the chapter, the default is to present it with all scenes, with a divider between them. there can be an
  add scene button in the '...'"): the list shows one row per chapter, every chapter alike, with all its scenes' words;
  pressing it opens the chapter at its first scene (or the scene Kyle is in). Show scenes in the hold menu lists that
  chapter's scenes under it, indented, the chapter's row unchanged (remembered per book on the device). A chapter of
  several scenes is one page: the other scenes sit above and below the open one with a line between (`src/ui/SceneSection.tsx`),
  each still its own file with its own draft on the device and its own saves (quiet, steady typing, iPad put down,
  leaving the page; anything left unsaved goes with the next sync). The writing bar's B, I, highlight, undo and redo work
  in whichever scene the cursor is in; the scene's card, Split and Join stay with the scene that was opened (Join saves
  the next scene's words first). The arrows at the foot go chapter to chapter. "Add a scene to this chapter" is in the
  ••• menu. Under the chapters, the book's boards and the archive sit folded behind one
  "Book tools" button (a grid icon) and open only when Kyle presses it; the app remembers open or closed (Kyle,
  2026-10-22: "i dont anticipate using those frequently and would prefer them not to take visual space all the time"). Adding chapters from the list (Kyle, 2026-10-22: "its too cumbersome to add a chapter in
  this view ... the + 'add a scene to chapter 33' at the bottom should probably be add a chapter. then possibly if we long
  press on a chapter in the list, we get an option to add a chapter below, or add another scene"): the list ends with
  "+ Add a chapter" (a title, which may be left empty, then the new chapter's one scene opens ready to write). Holding a
  finger on a chapter, or right-clicking it, opens a small menu under it: Add a chapter below and Add another scene. A
  chapter added in the middle moves every later chapter up one first (`src/lib/chapters.ts`): their scenes, to-dos,
  scene notes, and the beats, plan and scrap notes, renamed to their new number; one save each, Kyle's (no Agent line).
  Delete (Kyle, 2026-10-27: "I definitely need an option to hard press it and delete it", about a team test-drive scene
  under No chapter yet): the chapter's hold menu has Delete chapter, and holding a scene listed under its chapter (Show
  scenes) or under No chapter yet gives Delete this scene. It asks once, with the word count. Nothing is destroyed: each
  scene goes to the book's Archive (Book tools, Archive, with Restore) with a line saying when it was deleted, and an
  older copy there is never overwritten (`archiveNote` in `src/lib/scenes.ts`). A chapter left with no scenes takes its
  beats, plan, scrap, to-dos and scene notes to `Archive/Deleted chapter N <date>/`, and the chapters after it move down
  one (`chapterCloseUp`). If the open scene goes, the page moves to the next scene left. Needs the internet.
  A short press still opens the scene. Renaming a chapter (Kyle, 2026-10-22: "i should be able to change the chapter name
  by tapping in the field in the word processor, or long pressing on the chapter in the left pane"): tap the chapter's
  name at the top of the page and type (Enter or tapping away saves, Esc cancels), or choose Rename the chapter in the
  hold menu. The name is saved as `chapter_title` on the chapter's first scene and on any of its scenes that already
  carry one, through the write queue (so it works offline). Moving a chapter (Kyle, 2026-10-22: "there should be a move
  chapters option when you long press on the chapter, so I can reorder them"): Move chapter in the hold menu opens Up
  one, Down one, or a chapter number to jump to; the panel stays under the chapter so Up can be pressed again. The
  chapters in between close up by one; every note with a chapter number changes, the moving chapter's scenes take new
  reading-order numbers, and its beats, plan and scrap pass through a "(moving)" name so no two files clash. Needs a
  connection. Outside the writing screen a sidebar on the left (Sudowrite and Novelcrafter style, `src/ui/Shell.tsx`)
  holds Books and Series, the open book's cover and title, Keep writing, the book's boards grouped as Write, Plan, Codex,
  Review and Publish, and at its foot Chat, Jobs, To-do, sync and Settings. From 1100 px it shows names; from 700 px it is
  a strip of icons with short names that the menu button opens in full; narrower, a slim top bar opens it over the page. A Chapter Grid
  card opens the writing screen; Needs work, Edit card and the note sit behind its "•••" button.
  Novelcrafter-style additions (Kyle, 2026-10-18): the app opens on a home page (Books or Series, "Continue where you
  left off" from the scenes last opened on this device, cover cards or a list, search and sort) and a page per series.
  Chapter names are read fresh (Kyle, 2026-10-26: "when I open up the app and it tells me to continue on, it gives me an
  old version of the chapter title"): Continue where you left off, Home's Keep writing card, Find and the Chapter Grid's
  Best match name a scene by its chapter's current name ("Chapter 29: Three Days", from `chapter_title`), and add the
  scene's own header only when the chapter has no name or holds more than one scene. Before, they showed the scene's
  first `title`, which never changes when a chapter is renamed. `sceneLabel` in src/lib/board.ts.
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
  on the card, or named), Edit Queue (editorial notes and to-dos; part of To-do since 2026-10-22), and Appears in on character, place, item and lore notes.
  New book and New series on the home page (a new book starts with a 60,000-word target, Kyle 2026-10-27: "make the
  default words target for every new created book 60,000 words"; changed on its Overview); Bring in a manuscript (file saved unchanged in the book's Research folder,
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
  The To-do list shows both lists, with Book to-dos and Story Forge to-dos tabs (Sparrow to-dos since 2026-10-22). Kyle's "~" notes in Quest Declined became to-dos (Kyle, 2026-10-18).
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
  Two chirps (Kyle, 2026-10-22: "the pomodoro should chirp at the end of 25. and a different chirp after 5"): two quick
  rising chirps when the writing ends, three lower falling ones when the break ends. The iPad only lets a page play sound
  after a touch or key press, so the first one anywhere in the app unlocks the sound; a time that ran out more than ten
  minutes before the app was opened plays nothing.
  Louder and surer (Kyle, 2026-10-22: "I didn't really hear the sparrow sound at the end of the Pomodoro although my
  volume was up 2/3"): each chirp plays twice, as a small sound file made on the device and played through an audio
  player, which the iPad plays even on silent; the screen stays on while a timer runs, since a sleeping iPad stops the
  page. Settings, Timer sound has "End of writing" and "End of break" to hear them.
  Brighter (Kyle, 2026-10-23: "it's not very soothing. It sounds like an alarm ... more bright and cheerful"): the chirps
  became soft bell chimes, a rising C-E-G-C run when the writing ends and a G-C ding-ding, twice, when the break ends.
  Birds again (Kyle, 2026-10-23: "i do kind of still want it to be bird chirps. in keeping with the sparrow theme ... a
  soothing small bird sound"): soft songbird calls made on the device, quieter than before; a little warbled song (two
  sweet notes, a short trill, a falling note) when the writing ends, two slow rising "tsweet" calls when the break ends.
  Twelve birds to pick from (Kyle, 2026-10-23: "give me 12 different bird options in settings, and then I can choose in
  settings what to select for end of writing and end of break"): Settings, Timer sound lists them (Little song and Two
  tsweets first, the defaults); press a name to hear it, and "End of writing" or "End of break" to pick it. The picks
  stay on the device. All twelve are made by the app for now: Kyle asked for some real recordings too, which wait on the
  cloud environment being allowed to reach a free sound library such as Wikimedia Commons.
  The panel keeps only its buttons, the words so far and the "Today" line: no grey explanations and no buttons to hear the
  chirps (Kyle, 2026-10-22: "you dont need all those explanations in the grey text. or the option to hear the bird chirps").
  Words count what Kyle writes, in the page, Beats view and Focus alike: each rise in a scene's count adds, and cuts are
  not taken away, so rewriting a passage counts its new words (Kyle, 2026-10-20: a rewrite in Beats logged 0 words).
  Words typed count all the time, with or without a Pomodoro (Kyle, 2026-10-21: "sometimes ill write in the app but forget
  to hit the pomodoro"): the day's total goes to the same Writing Log note as `typed`, after a two-minute pause or every ten
  minutes of steady typing (and when the app is put away), and the panel leads with "Today: N words typed". They count
  Kyle's own words only: words the team puts on the page (filled braces, Options, Put it at the end, lines merged in from
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
  persist in workflow use and be reflected on the team page"): chat, Fill braces, Options, Check and scene summaries
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
  `src/lib/beats.ts`). Prose before a scene's first beat shows as an unnamed beat.
  Tidied 2026-10-22 (Kyle: "i dont like the 3 options taking up space in each beat box"): the beat boxes have no buttons
  of their own. The top row is Open all, Close all and Add a beat (a new beat after the one Kyle is in, else at the
  chapter's end, opened with its name ready to type). Holding a beat's name, open or closed (right-click on desktop),
  gives Delete beat and its words (asks once: "Delete beat 2 and its 43 words?"; the words are first saved to the book's
  `Archive/Deleted beats/`, so the delete needs the internet) and Take off the name, keep the words. The Ask the team
  button left Beats ("redundant"); a `beats` job is now asked from the side column's Ask the team, "Beats for this chapter" (the old beats note goes to the Archive). Reached from the writing screen's and whole chapter's Beats button and each
  chapter heading on the Chapter Grid. The writing screen's tool row stays in beats mode (Kyle, 2026-10-19, "the full word
  processor tool set too"): Undo, Redo, Bold, Italic, Highlight, Normal, Find, Names, Check, Listen and the Ask the team
  buttons work on the open beat the cursor is in. Split, Join, Options and Fill braces stay on the page only.
  Beats mode also shows the page's heading: the scene line, the chapter strip and the target bar, all
  counting the words as Kyle types in the beats (Kyle, 2026-10-19). The writing screen no longer shows pages and minutes to read
  (Kyle, 2026-10-22: "the minutes to read area in a section isn't needed"); the Chapter Grid and home page still do. A beat's prose looks like the page while it is edited
  (no tinted box). Each beat has a Move handle on its left, under its number (Kyle, 2026-10-22; it was top right): hold and
  drag it up or down (finger or mouse); its prose moves with it, into the scene it lands in (`moveBeat` in `src/lib/beats.ts`).
  Every part of a scene is a beat (Kyle, 2026-10-19: "the whole scene should be composed of these sections"): a scene's
  opening words show as a numbered beat with no name yet, and move like any other; once they are not first in their
  scene they are saved in the beats note as "Untitled beat", which reads back with no name.
  The writing screen's right column has a Beats tab (Kyle, 2026-10-21: "a button for seeing the beats laid out there as
  well. no need for the dropdown for the actual text within the beat"): the open scene's chapter beats as a plain list,
  title and one-line summary, no prose. A beat in the open scene is a link that puts the cursor where it starts. Its beat titles are a little larger than the rest of the column, for scanning (Kyle, 2026-10-22).
  The writing screen's top bar stays on one line with icons only below 1300 px (Kyle, 2026-10-19, after trying short
  names under the icons: "bring it back to what it was before for now. i like them all on one line").
  Braces, plan and chat beside the page (Kyle, 2026-10-18): `{...}` in the prose is a gap and `{a question}` an ask
  for the team (`src/lib/brackets.ts`; never `{{doubled}}`). Until 2026-10-23 these were square brackets; Kyle moved them
  to braces because he types square brackets in his System screens ("i actually use the same bars sometimes for my system
  screens... change the functional agent change bars to {} instead"), so `[ ]` is now always plain text: not marked, not
  sent, read aloud without the marks. Below, "bracket" means an ask in braces. Fill braces in
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
  2026-10-22 (Kyle's screenshot in split view: "something weird happened here when i backed out of the writing screen"):
  narrower than 1200 px the column lies over the page, so it opens only when Kyle presses Team and closes on leaving the
  page or when the window narrows; its open or shut state is remembered only beside the page. Its heading and Hide arrow
  stay in sight while the chat scrolls. The Keep writing card on Home shows the words typed in the scene even while it is
  still planned (the book's totals still count a planned scene as none, as `sf words` does).
  2026-10-23 (Kyle: "Chapter 34, Fighting Saffron, says it has 0 words when I've selected a different chapter"): the
  writing screen's chapter list and scene strip count the words typed in every scene the same way (`typedWords` in
  `src/lib/drafts.ts`), so a planned chapter shows its real words whether or not it is open.
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
  the theme; press a cell for the lines) and Cast web (`cast-web`: lines
  from `relationships`, as wide as the words after the link or the character note's sentences about the other say it is
  tense, else even). Since 2026-10-22 (Kyle: "the cast web needs to be altered to be useful"; the whole-cast picture piled
  circles and names on top of each other) it shows one character at a time: a row of names to pick from (on stage the
  most first, each with its number of ties; those on stage in no scene are tucked under "Not on stage in any scene yet"),
  the picked one in the middle with initials, and everyone tied to them in two columns, tensest at the top, each name
  with how tense and how many scenes. Press a name in the picture to move to them; "Open" or the middle circle opens the
  character. Below: that character's ties in words, then "Every tie in the book" folded away. Starts on the character on
  stage the most and remembers the last one picked on that device. Wide grids scroll in their own box
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
  Book details) shows the book's progress, scenes per status, what is waiting on Kyle (proposals to decide, open
  chapter to-dos, open Notes to the Team, questions in the scene notes, finished jobs not marked seen on this device), the
  warnings of every check (`bookWarnings`), and the Release runway: chapters posted (a scene has `published`), chapters
  ready (all final, none posted) and weeks of buffer at `cadence` (chapters a week; red under two). Target and pace are
  changed in place (written as numbers). A stage strip (the schema's `book_stage` list) tops the Overview and the Chapter
  Grid; pressing a stage asks first, then changes only the book's `stage`.
  Book progress counts done chapters (Kyle, 2026-10-22: "please set up the pomodoro and progress the way you described"):
  a chapter is done when every scene in it is revised or final, and only done chapters' words count toward
  `target_words`, whoever wrote them first, so a burst of team text moves nothing until Kyle has edited the chapter and
  marked it done (the Writer and the team only ever set drafted). Home's Progress card leads with "N of M chapters
  done", then words in done chapters against the target with its bar, then all words on the page; the Books page's
  cards say "N of M chapters done" and fill their bar from done chapters; the Chapter Grid adds a Chapters done number;
  the writing screen's chapter list ticks done chapters. Kyle marks it in the writing screen (••• menu, Mark as done,
  or the Done, split, join tab): "Mark this chapter done" sets the scene to revised ("Mark this scene done" when the
  chapter has several scenes), and "Not done yet" puts it back to drafted. The Pomodoro and Writing Log stay Kyle's own
  typing, as below. `chaptersDone` in `src/lib/overview.ts`. The guided next step (`src/lib/nextstep.ts`) is
  one big button with a sentence of why: Kyle's own step (decide what waits on a board), a move to the next stage, or a
  `next-step` job whose ## Ask names the step and tells the team to stop at a gate for his yes (never made twice while
  one waits). Once every scene has a draft and the book has story calls or changes in the Edit room, the next step points there instead of moving the book to revise: Answer the story calls, then Go through the changes, else Open the Edit room (Kyle, 2026-10-28, asking what "Move the book to revise" meant on Quest Declined 1 mid proofread). Notes to the Team (`#/board/notes/<book>`, Plan): the book's `note` notes, open first, to the whole team or
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
  Card, Notes, Marks, Copies, Target, Done, split, join; Tools: Page look, Check), with the to-do count and the chat's dot on
  them. Rounder cards, a 44 px sidebar row and theme colours only, so all ten themes still work.
- The rest of the new look (Kyle, 2026-10-21: "seems good. bring over whatever else."). The Pomodoro timer sits in the
  sidebar's foot as Timer (Writing, Paused or Break while it runs, coloured as before), its panel opening beside the
  sidebar; on a phone, where the sidebar is hidden, it sits in the slim top bar. Only one timer is on screen at a time.
  The writing screen keeps its own timer in its top bar. Below 900 px wide (an iPad held upright, a phone) the writing
  screen's right-hand column is a sheet pulled up from the bottom over the lower part of the page; its arrow or a press
  on the page above puts it away. The Team button in the writing bar shows and hides it, and reopens it on the page it last showed (Kyle, 2026-10-22:
  "once i pull away the right hand column, theres no way to bring it back"; a tab on the page's right edge was tried and
  removed the same day: "this arrow in the middle of the word processor right side ... is unnecessary"). While the column is open, Team
  looks the same as Chapters does with its column open (Kyle, 2026-10-22).
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

## Write, and the rooms in a new order (2026-10-22)

Kyle, 2026-10-22: "maybe chapter grid can move to the plannig section. and i dont know if we need edit queue if it can be
handled in to do? this could allow us to change manuscript to Write, and get us right in the writing sectio with a push
of a button. i know scrivener gets you in there with minimal steps", then "then maybe we can do Plan Write Edit Publish for
the list below home. and codex can move down to the section witht eh team and to dos".

- **The sidebar** (`src/lib/rooms.ts`, `Shell.tsx`): Home, Plan, Write, Edit, Publish under the book; lower down, with Team
  and To-do, the Codex (its pages open beneath it as before). Edit is the old Review room (Tension and Pacing, Themes,
  Sessions, Taste) under a new name.
- **Write** has no pages. Pressing it opens the writing screen straight away at the scene last opened on this device; on
  a device that has not opened one, the last scene with writing in it (any status but planned), or else the first scene;
  in a book with no scenes, the Chapter Grid (`keepWriting` in `Shell.tsx`). The writing screen's Done still goes back to
  the Chapter Grid. The writing screen's bar starts with Home (Kyle, 2026-10-22: "there doesnt seem to be a wayto back
  out of writing mode and go back to the main screen"): it saves, then opens the book's Home.
- **The Chapter Grid is in Plan**, after Steps. The book's own address (`#/book/...`) still opens it.
- **The Edit Queue is part of To-do.** Its to-dos were already on the To-do page; its other half, the team's notes on the
  draft (ideas of kind note, line, scene or structure that wait to be decided, rewritten or were put off), now sits at the
  top of To-do as "Notes on the draft of <book>" for the active book, with Keep, Later, Rewrite and Drop as before. The same
  notes are still on the Ideas board. Old links to the Edit Queue open To-do; Home's "open chapter to-dos" opens To-do.

## The design review redesign (2026-10-22)

Kyle asked a designer to study usability basics and the leading AI writing tools, critique the app and propose a new
design (report and mockups in the vault, `Docs/Sparrow/Research/App design 2026-10/`). Kyle, 2026-10-22: "as long as
its still possible to go through the workflow mode from somewhere, please apply all changes to the app."

- **Top bar on every page** (`Shell.tsx`): the room and page (a menu of the room's pages), Find (a chapter number, a scene,
  a codex name or an idea in the book on screen; Ctrl or Cmd+K is an extra; `src/lib/find.ts`, `Find.tsx`), and Team,
  which opens the team panel on the right of any page. The round floating chat button is gone.
- **Sidebar**: the room on screen lists its pages beneath it, one level down, instead of tabs across the top; Team does
  the same for Chat, Jobs, Agents, Skills, Recipes and the Workflow table. Narrower than 1100 px the strip of icons stays
  and the top bar's menu lists the pages. The book card opens Home.
- **Workflow mode is Plan > Steps.** The Workflow | Writing switch is gone; every stage and step page, Judge, Keep,
  Bring in results and Check work as before at the same addresses (`#/flow/...`). Home shows "Where the book is": one
  path of the workflow's six stages plus Publish, each opening its stage. The ten stage pills (Spark to Done) moved to
  Publish > Book details, where the book's `stage` is still changed.
  2026-10-27 (Kyle: "if I've clearly just jumped into writing, then I think the writing step should be highlighted"):
  the lit stage is the furthest one with work in it, skipped stages before it or not. A stage has work when a step has
  a result or a job, Writing when a scene has prose, Editing when Kyle marked a chapter done; a fully kept stage hands
  on to the next. Published books show "Published." (`currentStage` in `src/lib/flow.ts`).
- **Decide one at a time** (Home > Decide one at a time, and a button in Waiting on you): every idea (with the workflow's
  results), beat and conflict waiting on Kyle, one large card at a time, with 58 px Keep, Later, Rewrite (asks what to
  change) and Drop, stars, and Undo for ten seconds. Keys K, M, D and U are extras.
- **Codex**: Characters, Places, Items and Lore each have a page: a list with a filter on the left, the entry on the
  right with its "now" and where it appears (`Codex.tsx`). Narrower than 900 px the list comes first.
  2026-10-23 (Kyle: agents should look up "Grey's abilities or what a certain character's motivations are" without
  reading the book, and "what a character wants could potentially change from act to act"): character cards show
  Wants over time, Looks and Abilities, each line starting with the scene it becomes true at, and every codex card shows
  what Kyle has Not decided yet. Lists of sentences show one per line (`longList` in `format.ts`). The fields come from
  the schema; the vault's `sf index` builds a Book Index from them for the team.
  2026-10-22 (Kyle: "there's some weird scrolling here"): the list and the entry each scroll on their own, under the
  top bar, and a newly picked entry opens at its top. The note view says "To change this, ask the team" (Kyle never
  opens Obsidian; error messages say the same). On the iPad home-screen app the top bar fills the strip above it, and
  room for the clock bar is kept only when the app really sits under it (window as tall as the screen).
  2026-10-22 (Kyle: "something about how the app behaves with the top horizontal apple bar is weird"): in split view or
  a window the iPad puts its window button (•••) on the app's top left corner, so the sidebar starts below it and the
  writing bar (and the narrow top bar) starts to its right (`ios-window` in `main.tsx`).
  2026-10-22 (Kyle's screenshot: "somethings up with the app positioning with the top bar"): the writing bar sat under
  the clock bar on the full-screen iPad app. The room for the clock bar is now judged from the tallest the window has been
  at its width, so the keyboard or its shortcut bar can't take it away, and when unsure the room is kept
  (`src/lib/topbar.ts`). Settings, Top of the screen sets it by hand per device: Let the app decide, Leave room for the
  clock, No room; it also shows the window and screen size, for a screenshot if it still goes wrong.
- **Writing screen**: one slim bar (Chapters, chapter number and name, Undo, Redo, B, I, Highlight, Find, Saved and
  today's words, timer, Team, •••). The ••• menu holds Split here, Join, Names, Check, Listen, Fill braces, Ask
  the team for a job, Focus, Page look, Copies, Mark as drafted, Whole chapter and Done. Normal left the ••• menu on 2026-10-22 (Kyle: "i dont think we need
  it"); pressing B, I or Highlight again on picked words takes that style off. Page | Beats | Whole chapter sits
  above the chapter title. Picking words brings a menu under them: Rewrite, Describe, Options, Ask about this (opens the
  chat with the words quoted), and ••• for Brainstorm, Write on and Fill braces. On the iPad with the on-screen keyboard
  up, a format row (the two arrows, Undo, Redo, B, I, Highlight) sits just above the keyboard. The side column's groups are
  one row: Chat, Scene (Page look and Check moved here), Chapter.
- **The side column in one row** (Kyle, 2026-10-23: "simplify the appearance of it to make it easier to find what we need
  right away", then "this design change is good as long as we don't lose any functionality. But rather than scrap as the
  third immediately visible option, I think it should be to-dos since I use that more frequently"). The groups and chips
  are gone. One row at the top of the column: Chat, Plan, Beats, To-dos and More, with the hide arrow at its end (the
  to-do count and the chat's dot as before). More fills the column with every other part under four headings: This scene
  (Card and names, Marks, Word target, Copies, Done, split, join), This chapter (Scrap, From the workflow), The team (Ask
  the team for a job, Options to pick from) and Tools (Check for AI phrases, Page look, Braindump for the whole book, which
  the old tabs called Notes). Picking one opens it and the More button shows its name until another tab is picked. The
  ••• menu and pressing a name on the page still open the same parts. The column is 376 px wide so the row fits on the
  iPad. Mockups: project files `app/side-column/`.
  2026-10-23 (Kyle's screenshot: Team opened on the chat scrolled to its last message, the row out of sight: "it should
  always start at the very top. It shouldn't have the same behavior as the chapters on the left-hand column"). The column
  opens at its top, and so does every tab and the More list; the chat beside the page no longer jumps to its last
  message when it opens (only a new message scrolls it down). The row stays at the top of the column while it scrolls.
- **Colours and type**: darker status colours (planned #6e6b7b, drafted #a35f00, revised #2f6aa6, final #237445) and a
  small shape beside the colour on Chapter Grid cards (empty circle planned, half drafted, three quarters revised, full
  final), so colour is never the only sign; nothing smaller than 15 px except small capital headings.

## Dark themes (2026-10-22)

Kyle: "the dark mode with purple accents is my favorite dark mode. especially with the dark tones. id like the other dark
modes to have different colors, but tone the dark portions similarly." Violet Night is unchanged. The other four dark
themes now use its greys at the same lightness, tinted faintly toward their own accent, with a new accent each: Blue
Night, Green Night, Amber Night and Rose Night (they were Midnight, Forest, Ember and Ink, and keep those ids in
`src/lib/theme.ts` so a saved choice still works; Ink's true black and teal are gone). Every accent reads at 7:1 or
better on the cards and on its own soft panel's text. The light themes did not change.

Same day, later: Kyle could not see himself using the green or the rose ("think about the button colors a little bit
differently"). From six calmer options (Sea Glass, Sage, Slate, Copper, Plum, Brass) Green Night became Sea Glass Night
(soft teal) and Rose Night became Copper Night (the icon's terracotta); ids `forest` and `ink` kept.

Same evening, Kyle: "take note of claude's dark mode. see how it's kind of subtle?" Blue, Sea Glass, Amber and Copper
Night became quieter: greys at Violet Night's lightness with almost no tint, softer accents and fainter soft panels.
Violet Night is unchanged.

Later still, after research on quiet dark modes (project files app/dark-themes/), Kyle chose six dark themes: Violet
Night (unchanged), Graphite and Warm Clay (Ink's near-black greys; quiet buttons: grey with the accent in their words),
Ink (white buttons, a touch of indigo), Claude ("a color scheme thats basically the claude app", from his screenshot:
#151515, white buttons, a little green) and True Black (for OLED screens, white buttons). How loud the buttons are is
set per theme by CSS variables (`--fill`, `--on-fill`, `--hero-bg` and friends, falling back to the accent), so
Violet Night and the light themes look as before. Ids: midnight is Graphite, ember Warm Clay, forest Claude, black new.

The Claude theme then got the Claude app's colour shapes (Kyle: "these dark green and blue button shapes in the chat
threads ... green, blue, and orange, with the ocassional white pop"): Keep writing is a dark green card, Next step a dark
blue one with a blue-grey button, Kyle's chat messages dark green and the team's dark blue, orange for kickers and counts,
white for the main buttons. Set by `--kicker`, `--next-go`, `--team-msg`, `--badge` and friends, which fall back to the
accent everywhere else.

2026-10-23: a sixth light theme, Marigold, from a book-app design Kyle sent ("this light mode will also have different
buttons and ui element changes that match a color theme, including different font choices"; "you kmow i expect different
button shapes"). Cream pages, black outlines, square corners on everything but dots, a yellow top bar and writing bar,
flat orange buttons with black words, yellow soft buttons, orange for the chosen tab, the Space Mono typewriter font for
the app and Space Grotesk for headings. The fonts ship with the app (src/fonts, SIL Open Font License), so they work
offline. The writing page keeps the font chosen in its Page panel, which gained a Typewriter (Space Mono) choice.

Same day, a seventh light theme, Lo-Fi, from a lo-fi hip hop picture of old computer windows Kyle sent ("take heavy
inspiration from this one in the same manner"): white windows with blue outlines and a hard blue shadow, square corners,
pink, mint and butter-yellow panels, blue words, a faint dot grid behind the page, buttons with a small hard shadow that
press in, Pixelify Sans for headings and buttons and the DotGothic16 dot font for the rest (src/fonts, SIL OFL). The
writing page keeps its own font and has no shadows.

Same day, an eighth light theme, Retro OS, from a "Retro OS UI kit" picture Kyle sent ("now makeone for this"): a 1990s
desktop. Beige raised panels and buttons (light top-left edge, dark bottom-right) that sink when pressed, a black frame
on the main button, sunken boxes to type in, blue title-bar strips over Keep writing and Next step, a dark teal top bar,
Windows blue for chosen tabs and sidebar items, Verdana for words and the VT323 terminal font for big titles.

Kyle then asked for checkboxes to match each of these three themes, each different, and for better Marigold titles.
Marigold: a black-edged square that fills orange with a thick black tick. Lo-Fi: a white box with a hard blue shadow
that fills mint with a pixel tick and presses in. Retro OS: a sunken white box with the old black pixel tick. Marigold's
page titles are now big, tight Space Grotesk with a yellow marker stroke behind the lower half.

Same day, a seventh dark theme, Typewriter (Kyle: "make a dark mode UI out of marigold, too. Choose different colors."):
Marigold's shapes in the dark. Square corners, outlined cards and buttons, the Space Mono typewriter font with Space
Grotesk headings, buttons that press in, and a title marker stroke, but quiet like the other dark themes: near-black
pages, grey outlines, bone-white main buttons and chosen tabs, teal only in words, counts, ticks and the title stroke.
The word under the percent in the progress ring uses the heading font in Marigold and Typewriter so it fits.

## Code audit (2026-10-23)

Kyle asked for an audit of the app's code for places to simplify or improve. Nothing a screen does changed. Typing in a
long chapter is about a third faster per key: after each letter the writing box checked whether the page needed
redrawing by spelling out every letter's look (`lookString`), and reading the page back with a mark at every piece of
text (`locator`) compared every mark with every piece; both now do one pass. The offline copy of the app no longer keeps
every old version: each deploy gave the script and styles new names and the iPad kept the old ones (about 1 MB a
deploy), so the service worker now drops the ones the new page no longer names, and only a good page from GitHub
replaces the offline page. About 95 lines of styles and four functions left from earlier designs, and ten unused
imports, went.

Same day, the writing screen rework (Kyle: "you can go ahead with reworking the writing page to improve it"). Typing in a
long chapter takes about half the time per key it took in the morning, and the slowest keys a third: each line's styled
HTML is kept and only the changed line is worked out again (`styledHtml`); typing at the very end of the page no longer
runs the full look check, since only the page's last line break differs; and the page's words are counted 300 ms after
typing pauses rather than on every letter (words typed just before leaving the page still count for the Pomodoro). The
side column's panels moved out of `Editor.tsx` into `EditorPanels.tsx`, so the writing screen's file is about 1,200
lines instead of 2,050. Saving, offline and the live merge are unchanged.

## The Edit room: drafts and the team's changes (2026-10-24)

Workflow 1.2's editing stage (steps 35 to 42), built after Kyle said "Go for the build". The ideas came from his asks:
draft 1 "labelled and kept accessible", "some kind of writing mode where i can scroll the chapter and cycle through the
chapters", and "surely word's track changes can be an inspiration for us". The separate editing-path page, the
compare-versions screen and side by side were dropped; Workflow mode (Plan > Steps) shows where the stage is.

- **Drafts.** The Draft button over the page (beside Page, Beats, Whole chapter) shows which draft is on screen. "Save
  Draft 1 before editing" copies every scene into the book's `Drafts/Draft 1/` folder with a `Draft 1.md` note, as one
  save; the copies never change and the scene files become Draft 2. Picking a saved draft shows that scene's copy, read
  only, with a line to go back. Export Draft N to Word works for any draft (file name ends `_Draft N`). Saving again
  makes Draft 2's copies and starts Draft 3. The index and `sf` skip `Drafts/`, like Snapshots.
- **Changes on the page.** The Writer revises a chapter as a `chapter-changes` note in `Changes/` (one per chapter), never
  by rewriting the scene. When the open scene has changes, a bar over the page has Word's four views: All changes (old
  words struck in red, new words underlined; a new passage dashed), Simple (the page as it would read, a bar beside each
  changed paragraph), Final (no marks) and Self-Edit (Kyle's page as it stands, with every change he accepted, where he types; called Original until 2026-10-28, Kyle: "original sounds like im editing draft 1", "make the button called Self-Edit"). Up and down arrows step through
  the changes and on into the next chapter that has any.
  A change that only adds italics shows the words in italics, not raw stars (2026-10-28).
  The marked views are for reading; to type, press Self-Edit or Edit it myself. All changes marks only the words that
  differ, so a name change strikes one word, not its sentence, and All changes and Simple put a few words beside each
  change saying what it is ("Name: Grey → Basil", "Typo: teh → the", "Story call I-089"): in the margin when the page is
  wide, small before the change when not (2026-10-28, Kyle: "some short text on the side that summarizes what the
  actual change is").
- **Changes tab.** First in the side column while a chapter has changes (Beats moves into More). While it is open the
  column takes a third of a wide screen and its words are one point smaller than the page's own size (2026-10-28, Kyle: "the right-hand side text size is equivalent to the left-hand side text size. Then make it 1 point smaller"); other tabs keep the usual column. One card per change:
  its kind, its reason, the old and new words, "New passage · read slowly" for new words, and Accept, Accept the other
  (a second version), Reject, Edit it myself (Accept and Reject as in Word, 2026-10-28, Kyle: "keep this change is
  throwing me off"). A change that only swaps words (Grey → Basil) also has Accept everywhere, with how many such
  changes wait in the book (2026-10-28, Kyle: "apply this identical change in all cases"): it accepts them on this page
  now and in each chapter, of either book, as it opens; the rule is kept on the device, and Undo on one leaves that one
  alone. Edit it myself keeps the card open at the top of the column, with the team's words, while Kyle rewrites the
  spot on the page; Mark my changes as done records it as his own words, and Back to the choices puts the card back
  (2026-10-28, Kyle: "the change stays open until i tap mark my changes as complete"). Every change is a card of its own, typos and names included, headed by what it does ("Typo: teh → the"), and
  Accept all (as in Word) sits at the top of the column; there is no separate small-fixes button over the page any more
  (2026-10-28, Kyle: "the small fixes should exist as changes, just like anything else... in the right section would be
  where the accept or accept all buttons would be"). Cards run in page order, as in Word's margin: the current one is highlighted, the column scrolls to it when Kyle
  uses the arrows or picks a change on the page, and follows the page as he scrolls (a card already in sight stays put, and scrolling the column itself is never pulled back, 2026-10-28); changes no longer on the page come
  last (2026-10-28, Kyle: "Why are the changes on the right column not in sequential order? Take inspiration from
  Microsoft Word's structure"); such a card says its words are gone from the page and offers I wrote my own and Back to Draft 1, 2026-10-28, Kyle: "I did indeed write my own version, but I don't see no like it's asking me to do"; "maybe reject should instead be revert to draft one". Back to Draft 1 finds Kyle's version by the words around the change in the scene's Draft 1 copy and puts Draft 1's words back, recorded as Rejected; with no Draft 1 the card offers Reject). Decided cards fold away with Undo. Accept puts the words in as Kyle's own save;
  his choice goes on the change's `Kyle:` line in the note (waiting on the device when offline). Without changes, the
  tab offers "Ask the Writer for changes on chapter N" (job kind `revise`). The chapter list shows each chapter's count.
- **Finding the spot** (2026-10-28, Kyle: "the word processor screen then loses the place of where I wanted to type. And
  then if I tap the card, it doesn't bring me to the spot"; "right after I tap the italicize button, the word processing
  screen jumps away"). Edit it myself scrolls the page to the change's words and picks them; tapping that card while
  editing goes back there (to Kyle's new words' starting place once the old words are gone). The page scrolls to the
  selection itself, not its paragraph. Bold, Italic and Highlight keep the page where it is.
- **Other scenes' changes** (2026-10-28, Kyle: "something is messed up with the number of changes remaining displayed in
  the chapters column"). The chapter list counts every waiting change in the chapter; the Changes tab counts the scene on
  screen and adds "· N more in this chapter's other scenes" so the two agree.
- **To-dos tick off with their changes** (2026-10-28, Kyle: "as those changes go through in edit mode, those to-do items
  you should tick off automatically"; "all to-dos should be reflected with a relevant change card, because these to-dos
  are revision-related to-dos"). A change names the to-dos it carries out in its Why (`To-do T-002: ...`). When every
  change naming a to-do is decided and at least one went in (Accept, the other version, or I wrote my own), the to-do
  is marked done with a `done_note` such as "Edit room: C-08 your own words."; Undo opens it again. A to-do whose changes
  were all refused stays open.
- **Story calls.** Edit > Story calls is Decide one at a time for the whole-book read's calls (ideas with `step: "36"`):
  Yes with fix A, B or C (from the idea's "Fix A:" lines), Yes my way, Later, No. The fix goes in `decision_note`.
  The box for his own fix is always open above the buttons at the bottom of the screen, with Yes, my way beside it
  (2026-10-27, Kyle: "When I say yes, my choice, it just goes on to the next one"). The card says "A:" not "Fix A:"
  ("fix can be a verb too"), bolds each answer's letter and short version, spaces its paragraphs, and the buttons
  are just A, B, C ("why not A?"); the note keeps its "Fix A:" lines (2026-10-27).
- **Edit > Changes** lists the story calls waiting, each chapter with changes, and the saved drafts.
- **{ } asks in the margin.** Page look has "Asks for the team in { }": In the margin (the default) floats them beside
  the text when the page is wide enough, or In the text.

## System screens, format C1 (2026-10-28)

Kyle chose the layout for his System screens (Kyle: "What we want is C1"; the five options he compared are in project
files `edit-qd1/system-screen-formats.html`). In the scene a screen is a block of lines that start with `> `: the title
line all in bold, one line per fact, a lone `>` for a blank line between the parts (name, facts, fine print, Note), the
fine print and the Note in italics. Two screens with no story between them share one block.
- **Writing screen and Edit room**: a `> ` line is indented (the `>` shows faint, so Kyle can type one), a bold title
  line shows in small caps.
- **The Edit room reads like a Kindle page** (Kyle, 2026-10-28: "when we're in editing mode, the document automatically
  converts to the form that it's going to show up as in Kindle... without these weird arrows"): in All changes, Simple
  and Final, and in the cards' quotes, paragraphs are indented with no blank lines between them, System screens are
  indented with no `>` marks, a lone `>` is a small gap, and the story picks up after two lines' space. A struck-out line
  break is not shown. The files stay Markdown. Self-Edit still shows the faint `>` marks; a Kindle look for the typing
  page itself is an app to-do.
- **Export to Word**: style System Screen, indented half an inch, one paragraph per line, a blank line where the block
  has a lone `>`, the title bold small caps, two blank lines before the story goes on.

## Crow, the character and plot study app (2026-10-26; first called Character Study)

Kyle: "an app that assists me in studying the characters of good, already written stories ... we're going to analyze
these stories scene by scene and build out the characters", with "various views that we can cycle through", and the
plot studied beside it: "tabs so that I am focusing on just character or just plot". Its own page at
`crow/` on the same web address (the old `character-study/` address forwards there), opened from Settings in Sparrow. Not
part of Sparrow's sidebar yet; it may join Sparrow later.

- **Crow** (Kyle, 2026-10-26: "this app, I want to be named Crow", and "an icon on my iPad, and all of the information
  can persist between sessions, the way Sparrow does"). Its own manifest, name and crow icon, so Add to Home Screen gives
  a separate Crow icon. From that icon it has its own storage, so Crow has its own Settings with a key box (in the same
  browser tab it shares Sparrow's key). Sparrow's service worker keeps Crow's page and files too, each app's page under its
  own name, so both open offline; the last-read studies are kept on the device.

- The notes are in the vault's `Studies/` folder (types `study`, `study-character`, `study-scene`, `study-lens`); the
  team writes them with the `character-study` skill from chapters Kyle pastes in the Character Study chat. The story's
  text is never saved, only summaries and short quotes.
- Studies, then a study with two tabs. **Character**: a card per character (name above the face, role and key facts
  below, the best lens so far), lens buttons that switch every card to that lens's reading, and scenes with each
  character's best lens and whether it holds. **Plot**: how the plot is built, which plot lens explains the scenes, and
  the scenes as a chain joined by therefore, but or and then, with who drives each and why it comes next.
- A character's page: the card, how often each lens was best, the reading across the story, and scene by scene with
  moments (short quotes) and the lens's reading there. **Add a picture** saves Kyle's own picture as
  `Studies/<Study>/Faces/<Name>.jpg`; without one the card shows a plain silhouette.
- **The trait table** (Kyle, 2026-10-27: "a table where i can see each of these character traits from a particular
  perspective, and see if they hold up"). Character tab, Trait table: pick a character and a lens (or Every lens). A row
  per lens field with the card's reading and how many scenes it fully holds in; a column per scene with the scene's own
  reading of that field, coloured and labelled by the verdict in the card's `## Checks` (holds, partly, breaks, not
  shown). Tapping a cell opens that scene's lenses. The team keeps `## Checks` up to date (character-study skill).
- **The plot view** (Kyle, 2026-10-26: "with the plot scenes, i should be able to read the whole text as one option.
  next option would be to see a beat by beat breakdown. and then i want to see these scenes lined up next to each other
  in some view where i can see each character in the scene as an icon, with maybe a color explaining their role somehow.
  and then ... some way to visually represent where the scene beats come from--maybe like which character"). The Plot
  tab has three views:
  - **Story board** (the default): the scenes side by side in a row that scrolls sideways, joined by therefore, but or
    and then. Each card has its value shift (from, to), its cast as icons (the face from `Faces/` if there is one, else
    initials; a square for a force such as The world) ringed in the colour of their role in that scene (drives,
    opposes, supports, receives, with the word beside it), and its beats as a strip of icons of who caused each one, the
    turning beat ringed in black. Tapping the strip opens the scene's beats.
  - **Who drives the plot**: one row per character or force, one column per scene, with their role there and a dot per
    beat they caused (the turning beat ringed), the beats caused in all, the turning beats per character and the driver
    scene by scene.
  - **Plot lenses**: what the Plot tab showed before (how the plot is built, the lens tally, the chain by lens).
- A scene's page: the cast with their roles, then three tabs. **Read**: Open the original (the scene's `source_url`, the
  translator's page, in a new tab; the story's text is never kept in the vault) and our retelling below it. **Beats**:
  the value shift, the link from the last scene, then beat by beat with who caused it, its kind, and the turning beat
  marked. **Lenses**: the plot reading, every plot lens, and each character's moments and lenses, as before.
  The scene format (`### Beats`, `### Retelling`, `- Others`, `- Role`) is in the vault's schema and character-study skill.
- **The Engine tab** (Kyle, 2026-10-27: "what specific info about konosuba's characters actually matters to the
  story (if we had to distill things as much as possible)(this is what im circling around in the whole app is just
  getting that answer)"; also what the world does for the plot, where the author got the scenes, and why they work).
  A third tab beside Character and Plot. It shows the study's `Engine.md` (type `study-engine`): the short answer, what
  matters about each character (one card per character, linked to their page), what the world does for the plot, where
  the scenes come from, why they work, how each scene is built, what we would need to build one, open questions. The
  team writes it after five or six scenes (character-study skill). Without one, the tab says so.
- **The Kishōtenketsu page** (Kyle, 2026-10-27: "a dedicated linked page to kishotenketsu from the app that shows the
  premise of each scene, then each beat that is one of the 4 kishotenketsu. then i want to see if there is any way each
  scene connects to the next"). Linked from the Engine tab and from the Plot lenses view when the Kishōtenketsu lens is
  picked. Where the turn falls: a strip per scene, one cell per beat coloured by its part (ki, shō, ten, ketsu) with
  the turning beat outlined, and "turn at beat n of m". Then scene by scene: the premise (the scene's `premise` line),
  every beat as a block coloured by its part with who caused it, and the lens's "What the turn re-reads" line. Between
  scenes, the handoff: the last scene's ketsu beats beside this scene's ki beats, the link word and why the scene comes
  next. The part is the last tag of a beat (`- Aqua (reveal, turning, ten): ...`).
- Lenses page: every lens with its framework and source. A new lens is a new note, no app change. The Two Essentials
  lens waits for the tweet Kyle shared (not found in the vault).
- Without Sparrow's key it shows a made-up sample study from the demo vault.
