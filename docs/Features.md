# What the app does, feature by feature

The app is called Sparrow (Kyle, 2026-10-22: "lets change the name of the app to sparrow. and change the app immage"). Its
name shows in the sidebar, the browser tab and on the home screen; its icon is Kyle's own picture of a white, round bird with a red eye and a red wing on a flat red square (Kyle, 2026-11-12: "Make this the new sparrow app icon."; it replaced the cream sparrow on terracotta he picked on 2026-10-22). `scripts/make-icons.js` makes every size from `scripts/icon-source.png`, and the same bird in fixed colours is in `src/ui/Shell.tsx`; the vault skill `app-icon` has the steps to change it again. The first Sparrow icon replaced the SF badge. The
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
  The Kindle file (Kyle, 2026-11-04: "Start on step 1", the first step of the vault's `Docs/Sparrow/17 Replacing Vellum.md`)
  sits under Export to Word, on Book details and Publish's first page: Make the Kindle file downloads the book as an EPUB 3
  named like the Word file with `.epub`, made on the device, ready to upload to KDP with no Vellum (`src/lib/epub.ts`; the vault
  tool's `sf compile --epub` makes the same file). System screens (format C1) are boxed, left-aligned blocks: bold small-caps
  title, one line per fact, a gap where the block has a lone `>`, no `>` marks. Chapters start a new page with a small
  "Chapter N" over the title. The cover is the newest full-size picture in the book's `Cover/` folder, marked as the cover
  image with no cover page (KDP help G6GTK3T3NUHKLEFX). Front and back matter come from the book's `Book Matter.md` (type
  `book-matter`): `## Front: <page>` before chapter 1, `## Back: <page>` after the last chapter, in the order written; a
  page with no words is left out; Copyright, Dedication and Epigraph show without a heading and stay out of the contents.
  Front and back matter, under the button, opens that note's words in a box to edit and Save (it starts one with the
  copyright line filled in from the book's author and the year). The message after making the file names what is not in it yet
  (the cover, or the copyright page). The file passes EPUBCheck 5.1 with no errors (Quest Declined 1, 2026-11-04).
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
  Since 2026-11-11 a new scene or a new last chapter shows at once and works with no connection, and a chapter in the
  middle is one save with the renumbering (see "The one saving system, step 1: chapters").
  Delete (Kyle, 2026-10-27: "I definitely need an option to hard press it and delete it", about a team test-drive scene
  under No chapter yet): the chapter's hold menu has Delete chapter, and holding a scene listed under its chapter (Show
  scenes) or under No chapter yet gives Delete this scene. It asks once, with the word count. Nothing is destroyed: each
  scene goes to the book's Archive (Book tools, Archive, with Restore) with a line saying when it was deleted, and an
  older copy there is never overwritten (`archiveNote` in `src/lib/scenes.ts`). A chapter left with no scenes takes its
  beats, plan, scrap, to-dos and scene notes to `Archive/Deleted chapter N <date>/`, and the chapters after it move down
  one (`chapterCloseUp`). If the open scene goes, the page moves to the next scene left. Needs the internet.
  Since 2026-11-11 a delete is one save (see "The one saving system, step 1: chapters, second half").
  A short press still opens the scene. Renaming a chapter (Kyle, 2026-10-22: "i should be able to change the chapter name
  by tapping in the field in the word processor, or long pressing on the chapter in the left pane"): tap the chapter's
  name at the top of the page and type (Enter or tapping away saves, Esc cancels), or choose Rename the chapter in the
  hold menu. The name is saved as `chapter_title` on the chapter's first scene and on any of its scenes that already
  carry one, through the write queue (so it works offline). Moving a chapter (Kyle, 2026-10-22: "there should be a move
  chapters option when you long press on the chapter, so I can reorder them"): Move chapter in the hold menu opens Up
  one, Down one, or a chapter number to jump to; the panel stays under the chapter so Up can be pressed again. The
  chapters in between close up by one; every note with a chapter number changes, the moving chapter's scenes take new
  reading-order numbers, and its beats, plan and scrap pass through a "(moving)" name so no two files clash. Needs a
  connection. Since 2026-11-11 a move is one save and no file passes through another name (see "The one saving system,
  step 1: chapters"). Since 2026-11-11 the Edit room follows a chapter that is added, moved or deleted (found in the code
  structure review; before this they stayed on the old number): its change list (`Changes/Chapter N changes.md`) is
  renumbered and renamed like the beats, the chapters marked through in the Rewrite tab (`rewrite_done` on the book
  note) take their new numbers, and the sections of `Chapter Titles.md` are renumbered and put back in order. A deleted
  chapter's change list and title options go to the Archive with its other notes. Keep or No choices still waiting on
  the device are sent first, because they are stored by file name. Outside the writing screen a sidebar on the left (Sudowrite and Novelcrafter style, `src/ui/Shell.tsx`)
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
  A book's cover is `Cover.jpg` in the book's folder, shrunk on the device before saving (since 2026-10-29 to 720 px tall, about 50 to 120 KB, because it only ever shows as a small picture; Kyle: "would it make sense for you to automatically shrink the file size since it'll be a small thumbnail?"; and cut to the 6 by 9 shape of a print book, a picture too tall losing its bottom and one too wide the same from each side; Kyle, 2026-10-29: "can you make sure it conforms to 6x9 format automatically? Maybe it'll end up cutting off the bottom of some images if necessary"), while the picture as chosen is kept untouched in the book's `Cover/` folder as `Original cover YYYY-MM-DD HHMMSS.jpg` for publishing, one file per picture added, never replaced, and is added or changed on Book details (`#/board/details/<book>`, the sidebar's item under Keep writing, like Novelcrafter's novel settings; the Chapter Grid's cover links there; Kyle 2026-10-18); a book without one gets a
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
  again before a reply comes. While any ask waits for the team (since 2026-11-12; before, only an open conversation) the app syncs every 15 seconds (only while the
  page is visible). The Jobs screen leaves chat messages out.
  Everything else from the Sudowrite and Novelcrafter lists (Kyle, 2026-10-18, "set up everything app-wise"): in the
  writing screen, codex names (characters, places, items, lore, with aliases and a character's first name) underlined in
  their colour and opened as a card in the Card tab; Notes (the book's Braindump.md); Marks (`==highlight==`, with a
  highlighter button and a list to jump through); Normal (takes bold, italic and highlight marks off); Find and replace
  (its bar stays at the top while the page scrolls; on a read-only page, such as the Edit room's changes or a saved draft,
  the arrows step through the matches marked on the page, the current one filled in. Kyle, 2026-11-10: "in edit the find
  feature doesnt work. once i search and hit the down arrow, i cant go down anymore");
  Every save (the file's commits, with Go back to this version); the book's Archive with Restore; Whole chapter (every
  scene of the chapter as one page, each saving on its own). Boards: Matrix (scenes down, codex across; point of view,
  on the card, or named), Edit Queue (editorial notes and to-dos; part of To-do since 2026-10-22), and Appears in on character, place, item and lore notes.
  New book and New series on the home page (a new book starts with a 60,000-word target, Kyle 2026-10-27: "make the
  default words target for every new created book 60,000 words"; changed on its Overview); Bring in a manuscript (file saved unchanged in the book's Research folder,
  then an `import` job); Edit card changes a scene's title (the file is renamed; since 2026-11-11 with no connection too, see "the small saves"). Rewrite can ask the team to rewrite
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
  No stray chirp (Kyle, 2026-11-10: "Sometimes the bird sound randomly chirps 10 to 15 seconds or so after I open the
  app"): the first touch used to unlock the sound by playing the real bird call muted, which the iPad sometimes let through.
  It now plays a tenth of a second of silence in the bird's player instead, then puts the bird back, so a bird is only
  ever heard when a timer ends or Kyle presses one in Settings.
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
  Minutes typing count on their own too, with no timer to press (Kyle, 2026-10-29: "the ultimate measure would probably
  simply be the Pomodoro times divided by the number of words typed as measured by this new independent typing
  measurement"; the Pomodoro becomes mostly a stay-on-task tool). Every change Kyle makes on the page in any writing
  screen (keys, cuts, dictation) keeps the clock running; the time between two changes counts when it is two minutes or
  less, and a longer gap counts nothing, so time away or reading does not count. The team's words are not changes he
  made. The minutes go to the day's Writing Log note as `typing_minutes` (one decimal place) with the words typed, and the
  panel leads with "Today: 1,240 words typed in 52 minutes of typing, 1,431 words an hour", with the day's Pomodoros on
  the line below. Pomodoros keep their own minutes and words as before.
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
  **Fixed 2026-11-11: this had never worked when the app's copy of the vault was up to date, which is nearly always.**
  The page marked the version it was told about as seen, then asked whether the version it had just read was seen;
  the two are the same version, so every line from elsewhere was dropped and showed only when the scene was opened
  again (the saves themselves always merged, so nothing was lost). The question is now asked first (`takeFresh` in
  `src/lib/live.ts`, with a test), and a read that comes back while a save is on its way is tried again when the
  save lands. Checked in Chromium at 1180 x 820, 1366 x 1024 and 1440 x 900 and in WebKitGTK at the two iPad sizes
  against a pretend GitHub: a line added to an untouched open page shows, and the app saves nothing because of it; a
  line that arrives while Kyle is typing shows, every key he typed is there in order and the cursor keeps its place;
  nothing goes in twice over repeated reads; the same line changed in both places keeps his on the page and saves
  theirs as one copy; words that waited offline and met a line from elsewhere are saved with it and the line comes
  into the page, as the message under the heading says.
  **Also 2026-11-11: words that waited with no connection go up the moment it is back, with the scene still open.**
  Before, nothing sent an open scene's waiting words until the next key press, the next pause in typing or leaving
  the page, though the page said "It goes to the vault when you are back online". The page now listens for the
  connection coming back, with one listener that stays for as long as the page is open (in WebKit a listener that is
  taken off and put back at each redraw missed the event: the redraw the event causes took it off first).
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
  under 10 Noticeable, else Heavy), rhythm numbers and the flags by paragraph; the flagged words are marked in the page
  by the writing box (never in the text or the file; since 2026-11-12, see the last section), and a flag pressed is shown in the page. Whole
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
  warnings of every check (shown inside Waiting on you since 2026-11-06; the old `bookWarnings` list was removed 2026-11-10), and the Release runway: chapters posted (a scene has `published`), chapters
  ready (all final, none posted) and weeks of buffer at `cadence` (chapters a week; red under two). Target and pace are
  changed in place (written as numbers). A stage strip (the schema's `book_stage` list) tops the Overview and the Chapter
  Grid; pressing a stage asks first, then changes only the book's `stage`.
  Book progress counts done chapters (Kyle, 2026-10-22: "please set up the pomodoro and progress the way you described"):
  a chapter is done when every scene in it is revised or final, and only done chapters' words count toward
  `target_words`, whoever wrote them first, so a burst of team text moves nothing until Kyle has edited the chapter and
  marked it done (the Writer and the team only ever set drafted). Home's Progress card leads with "N of M chapters
  done", then words in done chapters against the target with its bar, then all words on the page; the Books page's
  cards said "N of M chapters done" until 2026-11-05 (now the stage and its percent, see "The Books page knows the
  stage"); the Chapter Grid adds a Chapters done number;
  the writing screen's chapter list ticks done chapters. Kyle marks it in the writing screen (••• menu, Mark as done,
  or the Done, split, join tab): "Mark this chapter done" sets the scene to revised ("Mark this scene done" when the
  chapter has several scenes), and "Not done yet" puts it back to drafted. The Pomodoro and Writing Log stay Kyle's own
  typing, as below. `chaptersDone` in `src/lib/overview.ts`. The guided next step (removed: the button left the Overview on 2026-11-06 and its code, `src/lib/nextstep.ts`, on 2026-11-10; what follows is how it worked) was
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

- **The sidebar** (`src/lib/rooms.ts`, `Shell.tsx`): Home, Market, Plan, Write, Edit, Publish under the book (Market since 2026-11-06, see "The Overview made simpler"); lower down, with Team
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

2026-11-07: three more dark themes (Kyle: "three more totally different color swatches for dark mode so I have some more
variation"). Each stays quiet (near-black, colour only in words and small marks, white or grey main buttons) but has its
own shapes and font. **Library**: an old reading room. Warm brown-black, the Literata book font everywhere, italic page
titles with a short gold rule under them, small-caps kickers, gold words, chosen tabs underlined in gold, parchment main
buttons on Keep writing and Next step. **Pebble**: soft and round. Cool black, the Nunito rounded font, pill buttons and
round-cornered cards with no outlines, round checkboxes, white main buttons and pink in the words. **Poster**: a Swiss
poster. Near-black, heavy Archivo titles with a thick white bar above them, sharp corners, a white bar across the top of
Keep writing and Next step, white main buttons, red only in kickers, ticks, counts and the underline under a chosen tab.
The fonts ship with the app (src/fonts, SIL OFL) and load only when their theme is on.

Same day, Kyle: "for library, though, can you make the darks as dark as most of the other dark modes? Also, i dont think
i'll use that last squared off one you did. could you replace it with something that is like, ULTRA colorful dark mode?"
Library's page, panels and lines are now as dark as Graphite's. Poster is gone (a device that had it chosen goes back to
Match this device). In its place, **Prism**, the one loud dark theme: a deep indigo-black page, page titles in a pink,
orange, cyan and violet gradient, main buttons and chosen tabs in a pink-to-orange gradient, Keep writing on a
purple-to-blue glow with a lime-to-cyan Open button, cyan kickers and links, lime counts and ticks, a rainbow line under
the top bar, each sidebar icon in its own colour and rainbow progress bars. Heavy Archivo titles, round corners.

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
  Simple and Final are for reading; All changes and Self-Edit are typed in (All changes since 2026-11-12, below). All changes marks only the words that
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
  his choice goes on the change's `Kyle:` line in the note (waiting on the device when offline; through the outbox since 2026-11-11). Without changes, the
  tab offers "Ask the Writer for changes on chapter N" (job kind `revise`). The chapter list shows each chapter's count.
- **Finding the spot** (2026-10-28, Kyle: "the word processor screen then loses the place of where I wanted to type. And
  then if I tap the card, it doesn't bring me to the spot"; "right after I tap the italicize button, the word processing
  screen jumps away"). Edit it myself scrolls the page to the change's words and picks them; tapping that card while
  editing goes back there (to Kyle's new words' starting place once the old words are gone). The page scrolls to the
  selection itself, not its paragraph. Bold, Italic and Highlight keep the page where it is.
- **Edit, then accept** (2026-10-28, Kyle: "sometimes the writers choices are 80% good, and i just want to edit them in
  the right hand column card and accept that"; "make sure you have the logic of which version I'm working in"). Each card
  has Edit, then accept; a card with two versions has Edit the first, then accept and Edit the other, then accept. The
  version's words open in a box on the card, labelled with which version it is; Accept my version puts them on the page
  in place of Kyle's old words and records his own words (or kept / the other version if he changed nothing).
- **Readable reasons** (2026-10-28, Kyle: "the lack of formatting makes it extremely difficult to read ... you don't
  need to tell me to read it slowly"). A change may carry `Asked:`, `Change:` and `Check:` lines under `Why:`; the card
  shows them as YOU ASKED and THE CHANGE, and folds the team's check. "New passage · read slowly" is gone.
- **Other scenes' changes** (2026-10-28, Kyle: "something is messed up with the number of changes remaining displayed in
  the chapters column"). The chapter list counts every waiting change in the chapter; the Changes tab counts the scene on
  screen and adds "· N more in this chapter's other scenes" so the two agree.
  Since 2026-10-29 (Kyle: "no cards show up in chapter 7, even though 3 show up on the chapter bar") that line is a
  button, "N more changes in this chapter's other scenes: show", that opens the next scene with waiting changes, also
  when the open scene has none; and the up and down arrows go through the chapter's other scenes before the next chapter.
- **The whole chapter in the Edit room** (2026-10-29, Kyle: "Can I just see all the scenes in a chapter by default? ...
  from a work perspective, I'm always going to work on a chapter level, probably. at least in the writing portion. In the
  planning and outlining part, it will be worth dividing by scenes"). In a chapter of several scenes, every scene on the
  page shows its changes marked, and the Changes column lists every card in the chapter in page order. Accept, the other
  version, Edit then accept, Reject, Undo and Accept all work on whichever scene the change is in; Edit it myself on a
  change in another scene opens that scene first. The arrows run through the whole chapter.
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
- **Typing in All changes** (2026-11-12, Kyle: "i would love to be able to just type in the all changes section, in
  the event i have a little text to add ... i find it annoying to cycle to self-edit (and then the whole screen runs to
  the top)"). All changes is the writing box itself with the team's changes drawn on it: the old words struck through
  (they are still Kyle's text), the new words and the few margin words beside them as marks that are not text, so the
  cursor steps over them and they never reach the scene. Kyle types anywhere; typing over a change's old words takes it
  off the page and its card offers I wrote my own. A press on a change picks its card; picking a card brings its change
  into sight. Accept, Reject, Undo and Accept all put words in as one step to undo without drawing the box again, so the
  page no longer runs to the top. Every scene of the chapter works the same way. In `src/write/prose.ts` (`PageChanges`, `changesField`). Checks `type.mjs` and
  `webkit-type.mjs` in the project files' `app/saving-checks/`.
- **One page, one Hide marks switch** (2026-11-12, Kyle: "i dont think ive used simple and final at all ... im
  wondering if we need those other modes or not"; he chose "All changes plus Hide marks"). The four view buttons (All
  changes, Simple, Final, Self-Edit) are gone. The Changes bar has one Hide marks switch (Show marks to bring them back):
  the same page, still typed in, with the team's marks taken off, which is what Self-Edit was. A device that had Self-Edit
  saved opens with marks hidden; any other saved view opens with marks shown. The older entries above that name Simple,
  Final and Self-Edit tell how it was before.
- **Pressing a card, both margins, and which column opens** (2026-11-12). Kyle: "why does tapping on the card in draft 3
  not bring the relevant writing paragraph up to it?": a press on a card always brings its words into sight, also when
  it is the card already picked (before, a second press did nothing after he had scrolled away). With his { } notes in
  the left margin and the changes' words in the right one, the page keeps room on both sides (the right-hand words were
  cut off behind the side column). Kyle: "can it default to changes when I'm in draft 3 and rewrite only when I'm in
  draft 2? changes would be the default for draft 4 as well, and subsequent drafts": each time a chapter opens, the side
  column opens on Changes from draft 3 on and on Rewrite in draft 2; a move to another tab in that chapter stays. Checks
  `pick.mjs` and `webkit-pick.mjs`.
- **Every mark in the left margin** (2026-11-12, Kyle: "definitely we're going to want like any kind of annotations to
  be on just the left margin, not both the left and the right", then "for now, just bring whats currently on the right
  to the left as well, so that my manuscript text extends to the right this far when theres annotations"). The few words
  that say what each change is ("Style Guide: was → is", "Sentence") now sit in the left margin beside their line, under
  or above his { } notes, never on the right. A page with any marks keeps its room on the left only, so the text runs out
  to the right as far as it does beside a { } note. This replaces the "both margins" room in the entry above. A cleaner
  look for the marks themselves (pictures A and B in the project files' `app/change-marks/`) waits on Kyle's pick.
- **A card far down a long scene, and the draft 2 line in draft 3** (2026-11-12). Kyle: "Tapping this card did not
  bring the paragraph up to the right spot in the writing area" (C-75, chapter 3, far down the chapter's second scene):
  the page guessed the height of lines it had not drawn yet, and one correction was not enough, so the words stayed below
  the screen and looked missing. The page now keeps correcting over the next frames until the words hold still. Kyle:
  "Why does it say I'm through chapter 3 in draft 3 when I'm not finished?": "You are through chapter N" and Done with
  this chapter at the foot of the page belong to the Writer's rewrite in draft 2 (the book note's `rewrite_done`), and now
  show only in draft 2. The move to draft 3 itself had happened.
- **The picked change's paragraph is lit** (2026-11-12, Kyle: "in the draft 2 version, it was easy to tell where I was
  because the paragraph in the writing section got highlighted ... Can we do that in draft 3 mode as well? When you tap a
  card"). Pressing a card (or moving to a change with the arrows) lights the whole paragraph its change sits in, in the
  same colour the Rewrite column uses; the light moves with the next card and goes when marks are hidden. It is never in
  the text (`lit-card` in `src/write/prose.ts`'s lights).
- **The card's edit box keeps its cursor** (2026-11-13, Kyle: "wont let me tap and type in this card window. it enables
  but immediately disables the cursor", on the iPad in "Your edit of version 1"). For a second and a half after Kyle
  presses the box, a cursor taken away by anything but his own next press is put back where it was, also when the box is
  drawn again. Chromium and desktop WebKit never lost it, so what took it on the iPad is not known; checks
  `tweak-focus.mjs` and `webkit-tweak.mjs` take the cursor away on purpose and see it come back.
- **The new card replaces the old one** (2026-11-12, Kyle: "Once the writer makes a new card, shouldn't the writer scrap
  the old card since we've established something's wrong with it? ... don't we need a brand new card and for the writing
  page to reflect the new card's changes recommended instead of the old card?"). A card still open that has a card made
  from Kyle's reply on it (`Re:` that card) is retired: it leaves the page and the open cards, and sits with the decided
  ones as "Replaced by C-NN" with its New card link. Nothing is written for it: the app reads it from the new card being
  there (`replaced` in `src/lib/changes.ts`). A card Kyle had already decided keeps his choice. The Writer's reply steps
  say its new card carries over whatever on the old card his reply did not object to.
- **Version 1 and Version 2** (2026-11-12, Kyle: "On the right side, I don't know how to choose option 1 or 2"). A card
  with a second version labels its two versions Version 1 and Version 2 and has a Use version 1 and a Use version 2
  button side by side (and Edit version 1 or 2, then use it); a decided one says which version went in. Before, the
  buttons said Accept and Accept the other. The card in his picture (C-74) showed no buttons at all because the old card
  C-61 held the same words; the replace rule above frees them.
- **A choice on a card the Writer just made is saved** (2026-11-12). For two minutes after a save the app plans the next
  one on the version of the vault it saved itself. If the team had saved since (the Writer's new card), the plan found
  no such card, saved nothing, and the choice was lost. Now a save that finds nothing to do on that version looks again
  at the vault as it is now (`src/lib/github.ts`, `commit`).
- **Reply to the Writer** (2026-11-12, Kyle: "i need to be able to reply within the changes, to explain to the writer
  why i made a choice, and for the writer to create a new card based on my reply"). Every card, waiting or decided, has
  Reply to the Writer: a box opens on the card, and Send to the Writer puts his words on the card as a `Reply:` line in
  the changes note (shown as "You told the Writer") and asks the Writer for a new card (job kind `reply`, target
  "Chapter N"), as one save that waits on the device when offline. A reply sent while the chapter's ask still waits
  for the team adds no second ask: the Writer answers every reply in the chapter that no card answers yet. The Writer's
  new card goes at the end of the same note in the usual card format with `Re: C-NN` (headed "Your reply on C-NN") and
  his reply as its `Asked:` line ("You asked"); the card he replied on says "The Writer is making a new card" until it
  comes, then "New card C-NN: see it". The Writer also journals the lesson. Checks `reply.mjs` and `webkit-reply.mjs`
  in the project files' `app/saving-checks/`.
- **Edit > Changes** lists the story calls waiting, each chapter with changes, and the saved drafts.
- **{ } asks in the margin.** Page look has "Asks for the team in { }": Left margin, Right margin (the default
  before 2026-11-06) or In the text. A margin floats them beside the text when the page is wide enough. The note stays
  in the text exactly where Kyle typed it; only how it shows changes, so the team still sees its place.
  Left margin (2026-11-06, Kyle: "I want to experiment with these green curly notes showing on the left side instead of
  the right, so that the main text gets shoved to the right. That way it's closer to the writer's text"): the text moves
  right, next to the Rewrite column. Every device switched to it once; Right margin puts them back. Every scene of a
  chapter shows its notes this way (before, only the open scene did).
  Fixed 2026-11-12 (Kyle, the morning after the writing page moved to the new writing box: "the curly bracket comments
  arent showing up anymore"): the new box cut off anything outside its own edge, so a note in the margin showed only as
  a thin bar. The box no longer clips (`.cm-scroller` in `src/write/prose.ts`; the page scrolls, not the box). Checks
  `asks.mjs` and `webkit-asks.mjs` in the project files' `app/saving-checks/`.

## The Writer's rewrite beside the page (2026-11-04)

Kyle, going through the developmental edit of Quest Declined 2: "this isn't exactly what i need for my final pass. i
appreciate the card system and it will be really helpful. but i need a full rewrite from the fable writer ... i need a
way to compare side-by-side, so i can easily bring in changes to each paragraph where necessary. there are simply too
many things i want subtly tweaked to have to go through and mark them all in curly brackets. i just need a whole
rewrite of the book in the chamber on the right side at all times to pull from (one thats obviously written
thoughtfully, just like an edit done by a professional dev, line, and copy editor.)" This is how draft 1 becomes
draft 2; the cards, changes and proofreads from draft 2 on stay as they are ("the draft 2 to draft 3 process and draft
3 to 4 is already great").

- **Where the rewrite lives.** The Writer rewrites a chapter as a copy of each of its scenes in the book's
  `Drafts/Rewrite/` folder, the same file name as the scene, with a `Rewrite.md` note beside the folder. The scene
  files are never touched; the index and `sf` skip `Drafts/`, so the copies never clash with the real scenes. The
  Writer works in Claude (the vault skill `rewrite-book`), one chapter per call, on the model Kyle asked for.
- **The Rewrite tab.** While the open scene has a rewrite, Rewrite is the first tab in the side column (then Chat,
  Plan, To-dos; with the team's changes too, Rewrite, Changes, Chat, Plan, and To-dos moves into More). The column
  takes a third of a wide screen, as Changes does, and opens on the Rewrite tab the first time a scene with a rewrite
  opens on the device. It shows the rewrite paragraph by paragraph, each lined up with Kyle's paragraph by how many
  words they share (`align`); a paragraph the Writer added or left out gets a row of its own. New words are darker,
  Kyle's own greyer, as on a change card. A paragraph that reads the same as his is quiet, with "Hide paragraphs that
  match yours" to fold them. The row his cursor is in is marked and the column scrolls to it as he moves through the
  page; tapping a paragraph in the column picks his paragraph on the page.
- **Bring over** puts the rewrite's paragraph in place of Kyle's, as one step to undo, and leaves the cursor after it;
  **Put it in** adds a paragraph the Writer added, after the paragraph before it; **Take it out** removes a paragraph
  the Writer left out. Every one is Kyle's own save, like typing: the rewrite file never changes from the app, so he
  can go back to it at any time. On the iPad in portrait the column is the usual sheet over the page.
- **Edit > Changes** opens with "The Writer's rewrite: N of M chapters rewritten", linking to the first chapter with
  one, before the story calls and the changes.
- **Change it first (2026-11-05).** Kyle: "can i put my cursor in there on the right and adjust it before i move it
  over? that would be ideal. (esp if i dont have to push a button to begin typing on the right side)". Every paragraph
  of the Writer's that differs from his is a box he can type in straight away, no button: his own words greyer behind
  the text, the Writer's new words and his typing darker, and the box grows with its words. Putting the cursor in a
  box lights his paragraph on the page and scrolls to it without taking the cursor away. Bring over then uses the box's
  words; "Changed by you" marks a tweaked box and "Back to the Writer's words" drops the tweak. Tweaks are kept per
  rewrite file on the device until the browser tab closes (sessionStorage), so a change of tab or a reload keeps them.
- **One place for draft 1 to 2 (2026-11-05).** Kyle asked how the rewrite and the Edit room's cards relate and chose
  to link them: the rewrite already carries the cards' fixes, so Bring over (and Take it out) closes the open cards
  whose words lay in that paragraph with the status `rewrite` ("In the rewrite" on the card; it counts as went in, so
  the to-dos those cards name tick off). **Done with this chapter**, at the end of the Rewrite column, saves the page,
  closes the chapter's leftover open cards the same way and lists the chapter in the book note's `rewrite_done`;
  "You are through this chapter" shows at the top, with Open it again. Edit > Changes says "You are through N of M
  rewritten chapters" and its link opens the next chapter not yet through. When the last rewritten chapter is
  through, the app saves the next draft by itself (the `Drafts/Draft N/` copies, as Book details' Save a draft does)
  and says so.
- **The light on the page and Done at the end (2026-11-05).** Putting the cursor in a box lights Kyle's paragraph with
  boxes drawn over the page from the words' own rectangles; the browser's highlight feature painted it a few words off
  on the iPad ("something's a little funny about how the text in the middle gets selected"). The light stays while the cursor
  is in the box and follows the page as it scrolls, and goes when the cursor leaves the box (Kyle: "once i select in
  the right side box to edit, the highlight on the left disappears ... difficult for me to track which location im
  working in"). The boxes are cut to the part of the page in sight (2026-11-11, Kyle: "the highlights run past the word
  processor section when you scroll"): scrolled above the page they were drawn over the top bar and the changes bar,
  because they sat over the whole screen. Since 2026-11-12 the light is a mark the writing box draws with the page's own
  words (`light` in `src/write/prose.ts`), so it cannot leave the page. A chapter of several scenes keeps one left edge when a scene has a { } note in the margin ("the next
  scene on the screen seems staggered differently when i close the left side chapters pane"). Done with this chapter is
  also at the end of the page, under the last scene, with the same "You are through chapter N" and Open it again
  (Kyle: "is there an option for me to mark the draft 2 chapter as done at the bottom of the page").
- **Joined paragraphs (2026-11-06).** Kyle: "when i accepted this paragraph, it didn't remove the top line of the
  original". Where the Writer made one paragraph of two or more of Kyle's (a screen's plain title line and its words
  turned into one `>` block, or two lines of dialogue run together), the column shows them as one row: Bring over
  replaces all of them, and the light covers all of them. A paragraph the Writer really cut keeps its own "left out"
  row. A row counts as the same only when it reads exactly the same, marks and all, so a change of only a stop, a
  colon, an italic or a screen's `>` marks still gets its Bring over.
- **Easier to read (2026-11-08).** Kyle: "bring the gray text on the right slightly closer to white ... while still
  distinguishable". The Writer's words that match the page are now at 80% of the text colour (was 68%), and matching
  rows at 72% (was 60%); new words stay full strength.
- **Split paragraphs (2026-11-07).** Kyle: "Why is it doing this weird duplication for this set of paragraphs?" Kyle
  had three lines of dialogue in one paragraph; the Writer made three paragraphs of them, and the column offered two
  as "Added by the Writer", so putting them in left his own lines below. Now the Writer's paragraphs that came from one
  of Kyle's sit in one row, and Bring over replaces his paragraph with all of them. A matching row the cursor is in
  shows in full even when "Hide paragraphs that match yours" is on (it was an empty dashed card).
- **Bring over reads the page as it is (2026-11-06).** Kyle: "this happened too (see after "silence")": after typing in
  the second scene of a chapter, Bring over put the Writer's paragraph inside Poppy's line, because the column still
  had that scene's words from before he typed. Bring over, Take it out and the light now read the page that moment
  and line the rows up again first; Take it out does nothing if Kyle has changed that paragraph since. Typing in any
  scene of the chapter redraws the column a moment after the last key.
- **The column follows your tap (2026-11-06).** Kyle: "tapping in the main writing area might automatically pull the
  right column up to the approximate location of the corrected paragraphs". Putting the cursor in any scene of the
  chapter (before, only the first scene) marks the Writer's matching paragraph and, when it is out of sight, scrolls
  the column so it sits in the middle. Only the column scrolls, never the page.
- **The column follows the page as you scroll (2026-11-10).** Kyle: "At the beginning of a chapter, when I tap a line
  on the right, even if I've already scrolled down on the left side, a lot of times it bumps the left side back a lot so
  that I lose my place." The column only followed the cursor, so after scrolling the page it still showed the chapter's
  first paragraphs, and tapping one brought the page back up to it. Now, a moment after the page stops scrolling, the
  row of the first paragraph in sight moves to the top of the column, so the boxes beside the page are the ones for
  what is on screen. Only the page's own scrolling counts. Scrolling the column yourself, or having the cursor in one of
  its boxes, leaves it where it is.
- **Level with the box (2026-11-10).** Kyle, with a picture of a lit paragraph near the bottom of the page: "the
  paragraph on the left has not come up". Putting the cursor in a box now moves the page so his paragraph sits level
  with the box, kept clear of the page's top and bottom edges. With the column following the page, that is a short move.
- **The page is the boss (2026-11-10, later the same day).** Kyle: "i think we want the center text screen to be the
  boss. so whatever paragraph is in the middle of the screen, we want the right-side paragraphs to track with it
  (probably as soon as the scroll stops). then, if i happen to scroll the right side paragraphs, the left side stays put
  unless i tap a right side paragraph. and then the right will stay put until i move the left again." This replaces the
  two entries above where they differ. A moment after Kyle stops scrolling the page, the row of the paragraph nearest
  the middle of the page comes level with that paragraph (not the top of the column), even when his cursor is in a box.
  Scrolling the column never moves the page. Tapping a box still brings his paragraph level with it, and that move of
  the page does not move the column, so the column stays where he left it until he scrolls the page himself.
- **Where Kyle reads (2026-11-10, evening).** Kyle: "my true reading and working zone is not the halfway mark of the
  document, but two-thirds of the way up the document." The column now follows the paragraph a third of the way down
  the page, not the one in the middle.
- **Level after Bring over (2026-11-10).** Kyle, with a picture of a box far below its paragraph: "Note how low the
  right side line is after submission." When Kyle's cursor moves on the page (a click, a Bring over), its row in the
  column now comes level with his paragraph, not only when the row was out of sight.
- **The page stays put after Bring over (2026-11-10).** Kyle: "submitted on the right and the middle section
  submission went straight to the bottom." Bring over and Put it in now leave the page where it was (the iPad's own
  scroll to the cursor is undone), and the column does not chase that.
- **The real cause of the jump (2026-11-10, evening).** Kyle: "i submitted a paragraph on the right, and the middle area
  text jumped so far down, i cant even see the new text ... fix it for real." The earlier fix remembered the page's
  place after the new words went in, but Safari (every browser on the iPad) had already thrown the page back at the
  moment its words were replaced, as far as the top of the chapter, so the fix held the page at the wrong place. Seen
  and fixed in WebKit, not only in Chrome. Now every redraw of the page's words keeps the page's place (since 2026-11-12 `apply` in
  `src/write/prose.ts`), which also covers Bold, Italic, undo and the team's words arriving. After a Bring over
  (`land`): the cursor goes after the new words, the page does not move, and the row comes level with the paragraph.
  Only when no line of the new words is in sight (Kyle scrolled the column away from the page) does the page move, to
  bring them level with the box they came from. The page is held for half a second against the iPad's own late
  scrolling; Kyle's finger ends the hold at once. The marked-changes views keep their place too.
- **Where you left off (2026-11-06).** Kyle: "a subtle little arrow to track underneath the last paragraph in the main
  body that we changed ... and maybe even on the right-hand side too". The last paragraph Kyle brought over, put in or
  typed in while the chapter has a rewrite is kept on the device, per book. A small arrow in the accent colour sits
  under it on the page and under its row in the column, and when the column opens it scrolls that row into view. The
  arrow goes when the chapter is marked Done.
- **The whole chapter (2026-11-05).** Kyle: "for chapter 2, i dont see anything rewritten after the first scene
  divider". When the page shows the whole chapter, the Rewrite column shows every scene of it in order, each under
  its scene name, with Bring over and the boxes working on that scene's part of the page.

## The Books page knows the stage (2026-11-05)

Kyle, 2026-11-05: "wouldnt continue where you left off for QD2 recognize the phase im in, and then take me to the draft 2
editing mode at my most recent chapter? also, why are there 2 cards for 1 project, and why does QD1 have anything to work
on in that section? ... Maybe that area should recognize what mode we're in, and give a progress % based on how much of
the current stage has been completed?"

- Each book has one stage, worked out in `src/lib/bookstatus.ts` (`bookStatus`): Published (the book's stage is done),
  "Draft 2: the rewrite" while the Writer's rewrite is in and Kyle has not been through every chapter (percent =
  chapters marked with Done with this chapter), "Draft N: changes" while the team's changes wait (percent =
  changes decided), "Draft 1: writing" (percent = words in chapters Kyle marked done against the target, the 2026-10-22
  rule), or Planning with the workflow stage it is in (percent = steps kept). A stage names the draft being made, never
  "draft N to N+1" (Kyle, 2026-11-12: "we're working on draft 3 now (if anything its draft 2 to 3, though ive never like
  this language. its draft 3)").
- Continue where you left off shows one card per book still being worked on (never a published one), the book opened
  last first, at most three. The card names the stage, its percent and bar, the chapter, and opens the right place:
  in the rewrite, the last chapter Kyle opened, or the next chapter not through yet if he already finished that one;
  with changes waiting, the last chapter he opened if it has some, else the first that does; while writing, the last
  scene he opened.
- The book cards and rows say the stage, its percent, what it counts and the words, and fill their bar from the
  percent (a published book's bar is full, in the done colour).

## Chapter titles (2026-10-29)

Kyle: "it would be helpful to have an actual interface in the app where I can select the chapter titles I like ... tap a
check mark next to each title that I like, or check a box that says none, which will communicate to you that in the next
round, I want you to generate 4 more options for that chapter title while retaining the chapter titles we already decided
on"; "it would be one of the options in the edit dropdown section"; "a write my own option for each chapter would be a
good idea too".

- Edit > Chapter titles reads the book's `Chapter Titles.md` (schema type `chapter-titles`): one `## Chapter N` section
  with `Was:` and `- [ ]` option lines ending in `- [ ] None of these`.
- One tick per chapter (since 2026-11-11 a tick works with no connection, see "the small saves"). Ticking a title renames the chapter (its scenes' `chapter_title`, through the write queue);
  unticking puts the `Was:` name back. Write my own adds his title as a ticked line. None of these asks for four more.
- The team writes each round in chat: four new options only in chapters marked None of these, None unticked, nothing
  removed (vault skill `chapter-titles`).
- Each chapter shows its scenes' one-line headlines under its number, for context (Kyle, 2026-10-29: "Can you write a
  short summary or use one we already have beside each chapter").

## System screens, format C1 (2026-10-28)

Kyle chose the layout for his System screens (Kyle: "What we want is C1"; the five options he compared are in project
files `edit-qd1/system-screen-formats.html`). In the scene a screen is a block of lines that start with `> `: the title
line all in bold, one line per fact, a lone `>` for a blank line between the parts (name, facts, fine print, Note), the
fine print and the Note in italics. Two screens with no story between them share one block.
- **Writing screen and Edit room**: a `> ` line is indented (the `>` shows faint, so Kyle can type one), a bold title
  line shows in small caps.
- **The page with changes in spaced blocks** (2026-11-12, Kyle: "can we keep the view on the writing panel as the
  blocks with spaces between, like in draft 2 mode? its way easier to read and work on"): All changes, Simple and Final
  show paragraphs as blocks with a blank line's space between them and no first-line indent, as the page reads while
  typing; System screens stay indented with no `>` marks. The cards' quotes keep the Kindle look below.
- **The Edit room reads like a Kindle page** (Kyle, 2026-10-28: "when we're in editing mode, the document automatically
  converts to the form that it's going to show up as in Kindle... without these weird arrows"): in All changes, Simple
  and Final, and in the cards' quotes, paragraphs are indented with no blank lines between them, System screens are
  indented with no `>` marks, a lone `>` is a small gap, and the story picks up after two lines' space. A struck-out line
  break is not shown. The files stay Markdown. Self-Edit still shows the faint `>` marks; a Kindle look for the typing
  page itself is an app to-do.
- **Export to Word**: style "Vellum Flush Left" (2026-10-31, Kyle: "The system screens aren't showing correctly in the
  Vellum version"; first "System Screen", then "Vellum Block Quote", but Vellum indented the lines of list screens such
  as stats). The whole screen is one paragraph with a line break after each line, an empty line where the block has a
  lone `>`, the title bold small caps (character style "Vellum Small Caps"), space before the story goes on. Vellum
  imports it as a left Alignment Block; Kyle turns on Inset (gear icon) in Vellum to set it in like a box. The vault
  tool's `sf compile --docx` does the same.

## The To-do map (2026-11-01)

Kyle, 2026-11-01: "can you create a to-do visualizer app for me so i can see all the things i need or want to do in
various contexts related to writing?" and "and publishing, etc". Built inside the To-do page rather than as a separate
app like Crow, so it uses the same key, sync and offline copy (Claude's choice; Kyle did not choose).

- **Map and List.** The To-do page opens on Map; List is the old page (by status, with the team's notes on the draft).
  The choice is kept on the device.
- **Six places** (`src/lib/todomap.ts`, the task schema's `context`): Writing, Publishing, Marketing, Sparrow app, AI
  team, Setup and upkeep. A tile per place shows how many are open, how many are being done, late and wants, and a bar of
  how many are done; pressing a tile shows that place alone. Below, one lane per place.
- **Up next**: being done now, late, or due within a week, across every place.
- **Need or want** (the task schema's `priority`, need by default). Wants show greyer with a dashed mark; Needs and wants,
  Needs, Wants filter the map, and Everyone, Yours, The team's filter by owner. Filters are kept on the device.
- **A to-do on the map**: the circle marks it done. Pressing the words opens its details with Start (or Not started), Make it a
  want (or need), Drop, Belongs in (moves it to another place, written as `context`), and Open the page / the whole note.
- **Writing** groups a book's to-dos by book, with "N story calls waiting on you" linking to Decide one at a time. A book
  whose stage is done (published) folds its leftover to-dos away under "is out", where they no longer count, with Mark
  all N done.
- A studio to-do with no `context` is guessed from its title (validation fixes, keys and the Mac mini are Setup and
  upkeep; KDP, Vellum and covers are Publishing; and so on) until Kyle moves it. A book's to-do is Writing. Add a to-do
  asks where it belongs and whether it is a need or a want.
- The vault's 67 open studio to-dos were given their place on 2026-11-01, Quest Declined 1 set to stage done (published
  that day), and T-113 added for Useless Magic's new edition under Kyle Heath.

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

## The Overview made simpler, and a Market room (2026-11-06)

Kyle, 2026-11-06: "I want to work on the overview screen to make it more useful to me ... making it clean and simple".
The book's Overview (Home) now holds, top to bottom:
- **Publish date** under the title: the day he plans to publish, set or changed in place with a date picker and shown as
  "Tue, Dec 15, 2026 · 39 days away". Saved as the book's `publish_date` (vault schema). Before this the only date on the
  page was the workflow's "Publishing (proposed 2026-10-31, not yet kept)", which is when that workflow stage was proposed,
  not a release date.
- **Keep writing** (Keep editing while a draft is being edited): the same scene the Books page's Continue opens
  (`bookStatus`), so both pages agree. A book still in planning gets Keep planning, which opens the workflow.
- **Status** (called Where the book is until Kyle renamed it the same day: "Status Editing: Rewrite (Draft 2) - 6/37 chapters compete"), six stages with a percent each (`src/lib/bookstages.ts`; Kyle: "the market research, the planning,
  the outlining, which maybe would involve both the outline and the beats, the writing, the editing, the publishing"):
  Market research = the workflow's market steps kept (or the Market board's thesis, comps, keywords and title, whichever
  is further); Planning = the premise, test drive and cast steps kept; Outlining = half the outline (outline steps, or the
  beat sheet's beats kept) and half the chapters with beats or a chapter plan; Writing = 100% once a draft is saved or
  editing has begun, else the Books page's count; Editing = three passes (drafts 2, 3 and 4; draft 3 is pass 2 of 3, Kyle
  2026-11-12), the one under way counted as far as it has got; Publishing = the workflow's publishing steps, 100% once published. Each stage opens
  its room. The stage the book is in is lit, with its detail beside the heading. Stages before it that were not finished
  in the app count as done outside the app: a full bar in a lighter colour marked Done (Kyle, 2026-11-06: "can we assume that if im in
  a further stage, that the previous stages are implicity complete (even if we mark the filled in bar with a different
  color or something?)"; then "im not sure i like saying its skipped. maybe it just happened off-app").
- **Progress**: the stage it is in and its percent in the Books page's style, then words in the book, chapters, words
  Kyle typed in the last seven days with minutes of typing (Writing Log), and the word target with Change. The old card
  (chapters marked done, scene statuses) is gone: it said 0 of 37 for a book in its rewrite.
- **Waiting on you**: a small box with only Decide one at a time (or "Nothing to decide right now"), no counts (Kyle,
  2026-11-06: "the waiting on you section is distracting ... a small box that says waiting on you with the box that says
  decide one at a time, without any numbers or anything"). Earlier the same day it listed counts with the warnings folded
  in; to-dos, notes, questions and jobs are on their own pages, and the warnings on each check's page.
- The guided **Next step** is gone from the Overview: it overlapped Keep writing and pointed at drafting while the book
  was in its rewrite. The **Release runway** is hidden until a chapter is posted or a posting pace is set (for Royal Road).

**Market room** (Kyle, 2026-11-06: "I kind of like the idea of separating the marketing work from the planning work: They're
two very large stages. We have different AI agents responsible for those steps"): a room between Home and Plan with the
Market board and Research steps (the workflow's market research stage). Publish keeps Book details, which already holds
Export to Word and the Kindle file, so the Market board no longer repeats the Export card.

## Stage times and the estimated publish date (2026-11-06)

Kyle, 2026-11-06: "I want us to automate this a little bit and for you to estimate the publishing date yourself. This is
part of an overall aim of mine to, number one, track how long it takes me to go through these steps. Number two, to be able
to anticipate and guess how long it's going to take to finish each step. And number three, for me to systematically speed
up how long it takes for me to finish these steps."

- **Stage dates** live on the book note as `market_start`, `market_end`, `planning_start` ... `publishing_end`
  (vault schema), one start and one end per Overview stage. Stages may overlap (Book 1's planning and outlining ran together).
  Quest Declined 1 and 2 were filled in from Kyle's answers and the vault's history.
- **The record keeps itself** (`datesToRecord`): when the Overview opens, the stage the book is in gets today as its start
  if it has none, every earlier stage that was started but not finished ends today, and a published book's publishing
  ends today. Stages done outside the app with no start stay blank.
- **Estimated publish date** under the title, above Kyle's own date (now "Your publish date"). The stage the book is in
  finishes at his pace so far (days spent ÷ percent done, once a tenth is done and three days have passed), or early on
  as long as it took in his other books; every later stage takes its average from his other books; a stage no book has
  dates for gets a first guess (`FIRST_GUESS`) and the page says so.
- **Done by** over the stage the book is in, in the Status row: the day that stage should finish, from the same estimate
  (Kyle, 2026-11-06: "I don't think we need the Sparrow app to tell how long each of these steps take. I just need you to
  continually track this going forward and remember it. And then I want you to display an estimated completion date over
  whatever step I'm in"). The "How long each stage takes" panel built earlier the same day was taken out; the dates stay on
  the book note, kept up by the app and read by the team (vault `Docs/Sparrow/18 Stage Times.md`).
- The estimate is also written to the book note as `publish_estimate` whenever it moves by more than three days, so the
  team and Kyle's Chief of Staff can read it (Kyle, 2026-11-06: the Chief of Staff tells him day to day what is due).
- Kyle's own publish date line ("Your publish date", Set it or Change) was taken out the same day (Kyle, 2026-11-06:
  "remove the your published date thing, because we just came up with a better solution"). Only the estimate shows; the
  book's `publish_date` property stays in the schema and is no longer shown.
- **Editing is timed pass by pass** (2026-11-07, Kyle: "Why is it estimating Quest Decline 2's publish date as so far
  away?"). It had timed all of editing from its first day (Oct 29, before the Rewrite tab) and counted the rewrite as a
  third of editing, so 9 days for 10% read as 81 more days. Now the pass under way runs at Kyle's pace since the pass
  began (`editing_pass_start`, which the app sets when a pass begins, counting that day), and the rest of editing takes
  what it took in his other books after the same draft was done (`draft2_end`, `draft3_end` to `editing_end`, less
  waiting days). With no book to go by, each pass still to come is a first guess of a week.
- **Pass count and early guesses** (2026-11-12, Kyle: "draft 3 is pass 2 of 3, am i wrong? ... i think it should
  reflect the length of time estimated with respect to the period we're in, right? like, editing didnt take me 50
  days, did it?"). After stages were renamed by the draft being made ("Draft 3: changes"), the Overview no longer
  recognised the pass: it showed pass 1 of 3 and timed all of editing from Oct 29 again (Done by Dec 29). Now the draft
  number is read from either name (`draftMade`), a changes pass counts only its own changes (the book note keeps
  `editing_pass_base`, the changes already decided when the pass began, so the 1,500 decided in draft 2 do not make draft
  3 look nearly done), and in a pass's first three days, or before a tenth is done, the pass gets the week's first guess
  instead of one morning's pace.

## Tidy-up after the audit (2026-11-10)

Kyle, after the audit of 2026-11-09 (vault `Docs/Sparrow/19 Audit 2026-11-09.md`): "make every one of these changes."

- Words: jobs wait "for the team", not "for GitHub" (the server's runner picks them up; GitHub's own runner is the
  fallback and is switched off). Jobs page, the Sent line and the waiting pile say so.
- Job names added for Voice check, Compare two versions and Fill in the scene cards, so they no longer show as "Ask the team".
- Removed, because nothing used them: the next step code and its `next-step` job kind (`src/lib/nextstep.ts`), the old
  warnings list (`bookWarnings`), `loadMode`, `saveMode`, `BookPath`, `bookChapters`, `daysWords`, `changesPath`,
  `PASSAGE_TOOLS`, and their styles. Nothing on any screen changed.
- `tsconfig.json` now has `noUnusedLocals`, so the typecheck fails on an import or local nothing reads.

## No intro lines in the side column (2026-11-10)

Kyle, 2026-11-10: "in the right column: ditch these explanatory lines at the top in the various sections." Gone from the
top of each part: the changes note's summary box above "N waiting · Accept all" in Changes, the line above the Writer's
rewrite in Rewrite, the line above the box in Plan and Scrap, the starter line in Chat (the box still says "Ask the
team"), "The team sees you are on …" under the team column's heading on other pages, the instructions above Marks (one
short line now sits in the empty list instead), "Tick one off when it is fixed" after the to-do count, and the score key
under the Check score. Options with nothing waiting says one short line, "No options yet. Pick some words and press
Options in the tool row." The changes note's summary is still in the note itself (Open the changes note).

## Typing stays quick with the Rewrite tab open (2026-11-11)

Kyle, 2026-11-11: "Typing in Sparrow is suddenly real slow." With the Rewrite tab open, every key on the page lined the
whole chapter up with the Writer's again (every paragraph of his against every one of the Writer's) and worked out the
grey and dark words of every box in the column. In a long chapter that was about a third of a second a key on WebKit,
the iPad's engine. Now each paragraph's comparison is kept, so a key compares only the paragraph being typed in; each
box works out its words only when its own paragraph changes; and the column no longer measures the page at every key
(it still follows a tap, a Bring over and a move to another paragraph). Measured in WebKitGTK on a 6,300-word chapter:
354 ms a key before, 48 ms after (29 ms with the Rewrite tab closed).

## The one saving system, step 1: board choices (2026-11-11)

Kyle, 2026-11-11: "i want sparrow to have a clean code structure, and for all the various additions ive given it to be
built according to a sensible whole." The proposal is the vault's `Docs/Sparrow/20 Code Structure Redesign.md`; he said
yes to its step 1, one saving system, built beside the old code with features moved over one at a time. This is the
first piece. The code is `src/vault/`.

- **What moved.** Every choice on a board: keep, later, drop, back to To decide, Rewrite, a card's Edit, reasons, stars,
  Accept card and Needs work, a card dragged on the Chapter Grid, and a chapter renamed. Nothing on any screen changed.
  Everything else (the writing page, to-dos, jobs, chat, adding and moving chapters, the Edit room's Keep and No) still
  saves the old way and moves over in later pieces, the writing page last.
- **One action, one save.** What Kyle does is an action: a list of small changes that go up together or not at all. A
  card dragged out of a chapter it named, and the next card taking the name on, is one save where it was two. A chapter
  renamed is one save where it was one for each scene. A save can no longer stop half-way.
- **The outbox.** Actions wait on the device (`story-forge.outbox.<vault>` in localStorage) until the vault has them,
  and show on every screen at once, as before. A newer choice still replaces a waiting one in the same place on the
  same note, and a second edit joins the first. Choices left in the old queue move into the outbox the first time the
  app opens, once.
- **Saved on top of the newest version.** A save reads each note as the vault has it at that moment, makes Kyle's change
  to those lines only, and writes. If the team or another device saved in between, GitHub refuses, and the change is
  made again on the newer notes (up to four more times). So Kyle's choice lands on top and nothing of theirs is lost.
- **After time offline** the waiting actions go up together, up to forty a save, where each was its own save before; if
  a group will not save, its actions go one at a time so only the one at fault waits, with its plain sentence. The
  vault's history names the first change and lists the rest under "Saved together with:" (the vault's Timeline tool
  reads that list). When GitHub says to slow down, or its hourly limit is used up, everything waits and nothing is
  marked as failed.
- **Saving and syncing take turns** (one lane in `App.tsx`). Before, a sync that began just before a save landed could
  finish after it and put the older note back on the screen until the next sync.
- **The way back** (gone 2026-11-11, see "the old way is out" below). Settings, Saving had The new way or The old way,
  per device, while features moved over; the old way sent the outbox one note at a time as before.
- Checked in Chromium at 1180 x 820, 1366 x 1024 and 1440 x 900 and in WebKitGTK at the two iPad sizes, against the
  demo vault and a pretend GitHub: keep, three quick choices, a save the team beat to the branch, GitHub out of reach
  with the app closed and opened, the old queue moving over, and the switch.

## The one saving system, step 1: new to-dos (2026-11-11)

The second piece. A new to-do, from Add a to-do on the To-do page or from the box beside the writing page, now goes
through the outbox like a board choice. Nothing on either screen changed but this:

- **It works offline.** Before, adding a to-do needed the connection ("Connect to the internet to add a to-do.") and
  waited for GitHub before it showed. Now it shows at once, with "Saving" on its card, waits on the device with
  everything else, and goes up when the connection allows. It can be started or ticked off while it waits; the tick
  goes up in the same save as the to-do.
- **Its number.** The to-do shows with the next free number (T-NNN) the device knows of. At the save the number is
  checked against the vault as it is at that moment; if the team or another device took it meanwhile, the to-do takes
  the next one, and anything still waiting for it follows. The note is the same one the old code wrote, in the same
  folder (`Tasks/`, or the book's own `Tasks/` with `chapter` and `scene`), with the same line in the vault's history
  and no Agent trailer.
- **Never twice.** If a save lands in the vault but its answer never reaches the device (the connection drops at the
  last moment), the next try finds the note already there, by its path, ID, title and date, and adds nothing.
- **How it is built.** A new note is an op that names its maker (`src/vault/makers.ts`: `task` and `todo` so far) and
  carries what Kyle typed. The maker runs when he adds it, for the note on screen, and again at the save on the vault's
  own file list. Other things the app adds (asks to the team, chat, chapters, recipes, notes) move onto makers in later
  pieces and still need the connection until then.
- The line under the Sync button now counts changes, not choices ("2 changes are saved on this device and go up when
  you are back online.").
- The old way (Settings, Saving) adds the note with the old single-file call, after reading the vault's file list.
- Checked in Chromium at 1180 x 820, 1366 x 1024 and 1440 x 900 and in WebKitGTK at the two iPad sizes, against the
  demo vault and a pretend GitHub: add online, add with GitHub out of reach and the app closed and opened, start or
  tick while it waits, the team taking the number meanwhile, the Map and the List, the box beside the page, the old way.

## The one saving system, step 1: the Edit room's answers (2026-11-11)

The third piece. Accept, Accept the other, Reject, Undo, Accept all, Accept everywhere, Edit then accept, Mark my
changes as done and Back to Draft 1 on the team's changes now go through the outbox. Nothing on the screen changed.

- **One save for an answer and its to-dos.** An answer sets the change's `Kyle:` line in the chapter's changes note,
  and a to-do the change carries out is ticked off (or opened again on Undo). Before, the note and each to-do were
  separate saves from two different waiting lists. Now they are one action and one save.
- **One waiting list.** The Edit room kept its own list on the device (`story-forge.change-choices.<vault>`), sent by
  its own code. Answers now wait in the outbox with everything else: they show at once on every screen (the cards, the
  counts on the chapter list, the Overview and Edit > Changes), count in the Sync button's line, and survive closing
  the app. What was left in the old list moves into the outbox the first time the app opens, once.
- **Answers to one chapter join.** Several answers that wait for the same changes note are one change to it, the newer
  answer to a change winning, so a run of Accepts made faster than GitHub saves them goes up in a few saves, not one
  each. The vault's history says "Kyle kept C-04 in Chapter 12 changes" as before, or "Kyle chose on 3 changes in ...".
- **Saved on top of the team's newest version**, like every action: if the Writer added or reworded changes in the
  note meanwhile, only the `Kyle:` lines Kyle answered are set, on the note as the vault has it at the save.
- **Adding, moving or deleting a chapter** sends what waits for the book first, because answers wait by their note's
  file name and those names are about to change. If answers still wait after that, the app says "Your answers on the
  team's changes have not saved yet. Press Sync, then try again." and changes nothing.
- The saved copy of the vault on the device is now written a moment after the last save lands (and when the app is
  put away), not once for each save: writing it copies the whole vault, which a long run of Accepts would feel.
- The accepted words themselves still go into the scene through the writing page's own saving, which moves last.
- Checked in Chromium at 1180 x 820, 1366 x 1024 and 1440 x 900 and in WebKitGTK at the two iPad sizes, against the
  demo vault and a pretend GitHub: Accept with a to-do ticked in the same save, Reject, Undo opening the to-do again,
  answers made with GitHub out of reach and the app closed and opened, the old list moving over, and the old way.


## The one saving system, step 1: asks, chat, notes, recipes and workflow results (2026-11-11)

The fourth piece. Five more things the app adds now go through the outbox: an ask to the team (Ask the team, the
writing page's Fill braces, Options, Check, beats and the rest, which are all job notes), a Chat message, a Note to the
Team, a new recipe, and results written or pasted into a workflow step. Nothing on the screens changed but this:

- **They work offline.** Each needed the connection before ("Connect to the internet to ask the team.", "... to send
  a message.", "... to add a note.", "... to add a recipe.", "... to save results.") and waited for GitHub before it
  showed. Now each shows at once, waits on the device with everything else and goes up when the connection allows.
  The team still only starts on an ask once it is in the vault, so the line after asking says which it is: "Sent to
  the team. The team picks it up within a few minutes; see Jobs." or "Saved on this device. It goes to the team when
  you are back online; see Jobs."
- **Not asked twice.** The same ask for the same target is still refused while one is open, and an ask that waits on
  the device counts as open.
- **Chat.** A message shows in its conversation at once. A new conversation takes the next conversation number the
  device knows of, counting messages that still wait.
- **Several results, one save.** Results brought into a workflow step together are one action: all of them are in
  the vault, or none.
- **Numbers and names.** A job takes the next free J-number and a result the next free I-number, checked again at the
  save as for to-dos. A Note to the Team or a recipe whose file name was taken meanwhile gets the next free name
  ("Ferry times 2"). The notes, their folders and the lines in the vault's history are the ones the old code wrote.
- **How it is built.** Four more makers in `src/vault/makers.ts` (`job`, `note`, `recipe`, `result`); `createAction`
  takes one thing or a list. The old functions that wrote these notes straight to GitHub are gone (`createJob`,
  `createNote`, `createRecipe`, `createResults`).
- **Closing the app right after a save.** The saved copy of the vault on the device is written a moment after the
  outbox goes up (the Edit room piece, above). If the app was closed in that moment and opened again with no
  connection, a choice that had already gone up showed as not made until the next sync. Now what went up stays on the
  device in a small list of its own (`story-forge.landed.<vault>`) until the saved copy with it in has been written,
  and is shown over an older copy when the app opens. Saves from the writing page write the saved copy at once again,
  as they did before the Edit room piece.
- **Still need the connection** until their own pieces: adding a scene or a chapter, moving or deleting a chapter,
  chapter titles, starting a series or a book, covers, Rocket files, bringing in a manuscript, changing a recipe, a
  note on the workflow, marking a chapter in the rewrite, split and join, copies and saved drafts.
- Checked in Chromium at 1180 x 820, 1366 x 1024 and 1440 x 900 and in WebKitGTK at the two iPad sizes, against the
  demo vault and a pretend GitHub: a new conversation, a message sent with GitHub out of reach and the app closed and
  opened (the team taking its number meanwhile), Ask the team asked twice while the first waits, a Note to the Team,
  a recipe, the old way, and every earlier piece's check again (boards, to-dos, the Edit room), with the app closed
  right after a save and GitHub out of reach.

## The one saving system, step 1: chapters, first half (2026-11-11)

The fifth piece: adding a scene, adding a chapter and moving a chapter. Deleting is the second half.

- **A new scene or a new last chapter works offline.** Add a chapter at the end of the list, Add another scene, and
  scenes from a pasted outline are new notes in the outbox (maker `scene`). The page for the new chapter opens at once,
  with no wait for GitHub, and takes Kyle's words; the scene goes up when the connection allows and his words are saved
  into it after. Scenes from an outline are one save for all of them. Before, each needed the connection ("Connect to
  the internet to add a scene.").
- **If its number was taken while it waited** (another device added a scene to the book), the scene takes the next
  S-number at the save. The page moves to the new name by itself, and what Kyle typed under the old name follows
  (`moveDrafts` in `src/lib/drafts.ts`), so nothing is left behind and nothing is saved twice.
- **Moving a chapter is one save.** Every note that carries a chapter number follows (scenes, to-dos, scene notes,
  beats, plan, scrap, the Edit room's change list), the ones named after their chapter get their new file names, and
  the Rewrite tab's ticks and the Chapter Titles note follow, all in one save: all of it, or nothing. Before, it was one
  save a note (about 120 for a far move in Quest Declined 2), and a failure part-way left the book half moved. No file
  passes through a "(moving)" name any more. The vault's history has one line: "chapters: chapter 30 is now chapter 12".
- **A chapter added in the middle is one save too**: the later chapters move up and the new chapter's scene is added
  together.
- **These two still need the connection**, and say so: "Connect to the internet to add a chapter in the middle of the
  book: the chapters after it get new numbers." Everything else that waits on the device is addressed by file names and
  numbers that a renumbering changes, so a renumbering is sent at once, after what waits for the book has gone up, or
  not at all. If something for the book still waits, the app says "Your answers on the team's changes have not saved
  yet. Press Sync, then try again." or "Something you added or moved in this book has not saved yet. ..." and changes
  nothing. This limit goes when chapters get IDs of their own (step 5 of the redesign).
- **Only what is needed is read.** The save works the new numbers out on the vault as it is at that moment, so a note
  the team added meanwhile follows too. A note whose file has not changed since the device last read the vault is not
  read again unless it moves: moving a chapter one place in Quest Declined 2 reads 17 notes, a far move about 100.
- **The list shows it at once.** The save's answer is put into the saved copy on the device (new names in, old names
  out), so the chapter list is right without a sync.
- **How it is built.** `src/vault/tree.ts` is the vault as one save sees it: every op reads and writes there in order,
  so a later op meets what an earlier one did (a note added, a file renamed). `src/vault/chapters.ts` is the chapters op
  (room for a new chapter, a move, and closing up after a deleted one, used by the second half). The saving order on a
  sync is now the outbox first, then Kyle's writing, so a new scene is in the vault before its words are saved to it.
- The old way (Settings, Saving) keeps the old code for all of this: one save a note, with the connection.
- Checked with tests that run the old way and the new way on the same book and compare every file (the demo book, and
  a copy of Quest Declined 2 when the vault is beside the repository), and in Chromium at 1180 x 820, 1366 x 1024 and
  1440 x 900 and WebKitGTK at the two iPad sizes against a pretend GitHub: a new last chapter online and with no
  connection, typing in it before it is saved, its number taken meanwhile, a move, a chapter in the middle, the plain
  sentence with no connection, the old way and the new way leaving the same files, and every earlier piece's check.

## The one saving system, step 1: chapters, second half (2026-11-11)

The sixth piece: deleting a scene or a chapter. What Kyle sees and where things go is as before (the note about Delete
in the chapter list section); how it is saved changed.

- **A delete is one save.** The scenes go to the book's Archive with the line saying when they were deleted; a chapter
  left with no scene takes its beats, plan, scrap, to-dos, scene notes and change list to
  `Archive/Deleted chapter N <date>/`, its title options go there too, the chapters after it close up by one, and the
  Rewrite tab's ticks and the Chapter Titles note follow. All of it lands together, or nothing changes. Before, it was
  two saves a note and one more for every note that followed (about 200 for a chapter in the middle of Quest Declined
  2), and a failure part-way left a chapter half deleted. The vault's history has one line: "delete: S-031 The Offer",
  with what went with it under it.
- **Nothing is destroyed and nothing is written over**, as before: each note goes to the Archive as the vault has it at
  the moment of the save (so a change the team made a moment ago is in the archived copy), and an older archived copy
  with the same name keeps its name; the new one is "name (2)".
- **Whether a chapter is empty is decided on the vault at the save**, not on what the device last saw: if another
  device added a scene to that chapter meanwhile, the chapter stays and only the deleted scene goes.
- **The list and the Archive show it at once.** The save's answer is put into the saved copy on the device: the
  scenes leave the chapter list, the later chapters show their new numbers, and Book tools, Archive counts the deleted
  scenes and can Restore them, all without a sync (`foldSaved` in `src/vault/apply.ts` now also keeps each book's
  archive list, and leaves out of the notes any file the app holds no note for).
- **It still needs the connection** ("Connect to the internet to delete: the words go to the Archive first."), and
  what waits for the book goes up first, for the same reason as a move: a delete can change chapter numbers.
- A scene that is no longer in the book when the save is made: "That scene is not in the book as the vault has it now.
  Press Sync and look at the chapter list.", and nothing changes.
- **How it is built.** A `delete` op (`src/vault/ops.ts`) planned by `planDelete` in `src/vault/chapters.ts` on the
  save's tree: archive the scenes, then for each emptied chapter (the last first) archive its notes and run the same
  closing-up the chapters op has. Like the chapters op it is sent at once and never waits in the outbox.
- The old way (Settings, Saving) keeps the old code.
- Checked with tests that run the old way and the new way on the same book and compare every file (seven deletes on
  the demo book: one scene, a scene with no chapter, a last chapter, a middle chapter, the first chapter, two chapters
  at once, a chapter and a scene of another; and a middle and a late chapter on a copy of Quest Declined 2 when the
  vault is beside the repository: 200 saves and 8 saves the old way, 1 each the new way), and in Chromium at 1180 x
  820, 1366 x 1024 and 1440 x 900 and WebKitGTK at the two iPad sizes against a pretend GitHub: the last chapter, a
  middle chapter with two scenes, the Archive count, Restore from the list the save left, no note fetched again by the
  next sync, the plain sentence with no connection, the open scene's chapter (the page moves on), the old way and the
  new way leaving the same files, and every earlier piece's check.

## The one saving system, step 1: the small saves (2026-11-11)

The seventh piece: five small things that each had a save of their own and each said "Connect to the internet". What
Kyle sees is as before, except that each shows at once, waits on the device with everything else when there is no
connection, and goes up as one save.

- **A scene's title** (Edit card on a scene's card, and the title on the writing page). The new title shows at once.
  The save changes the title line and gives the file the name that goes with it, in the same save, so the words are
  never in two places or in none. Before, it needed the connection and refused while the scene had writing that had
  not reached the vault ("Open it and press Done first"); now the words kept on the device, and anything else waiting
  for that scene, follow it to the new name. A second new title before the first has gone up is fine. A name another
  scene already has: "A scene called X is already there. Choose another title." If the open page is that scene, the
  page moves to the new name by itself.
- **A changed recipe** (Team, Recipes, Edit). The words change at once; a new name renames its file at the save. One
  save where it was two (the words, then the rename).
- **Chapter titles** (Edit, Chapter titles). A tick, an untick, None of these and Write my own each show at once and
  wait. Each changes only its chapter's lines in `Chapter Titles.md` as the vault has the note at the save, so a round
  the team added a moment ago is kept. The chapter's own rename went through the saving system already.
- **Done with this chapter in the Rewrite tab.** The mark shows at once and waits. The one part that still needs the
  connection is the last chapter, where Draft 2 is saved by itself: with no connection it says "Chapter N is through,
  the last one. Save the draft from Book details when you are connected." (saved drafts move with the copies, later).
- **New series and New book** on the home page. Each shows at once and opens, with no connection too, and goes up as
  one save with its Book Backups folder (two saves before). A name already in the vault: "A series called X is already
  in the vault. Choose another name."
- **How it is built.** Two new things an action can hold (`src/vault/ops.ts`). A `text` edit carries what Kyle meant
  (`src/vault/text.ts`: a title ticked, a title written, a chapter through, a recipe's words) and is made on the note
  as the vault has it at the save; the same code makes the note on screen, and a test holds the two together. A
  `retitle` op renames a scene or a recipe on the save's tree; what it renamed comes back in the save's answer, and
  the outbox, the drafts kept on the device and the open page follow. New series and books are two more makers
  (`planSeries` and `planBook` in `src/lib/books.ts`), and a maker can now bring a second file with it (the backup
  folder's placeholder).
- The old way (Settings, Saving) keeps the old code for all five.
- **Still need the connection** until their own pieces: a note on the workflow, covers, Rocket files, bringing in a
  manuscript, split and join, copies and saved drafts. The writing page's own saves stay on the old way for now.
- Checked with tests that run the old way and the new way and compare the files (a recipe changed and renamed, a
  scene renamed, a new series and book), and tests for a tick landing on a note the team changed meanwhile, the
  Rewrite mark with no connection, waiting changes and words on the device following a rename, a taken name, and a
  scene that is gone; and in Chromium at 1180 x 820, 1366 x 1024 and 1440 x 900 and WebKitGTK at the two iPad sizes
  against a pretend GitHub: a recipe changed and renamed with no connection and the app closed and opened, a tick on
  Chapter titles, a scene's new title from its card, a new series and its first book, one save each when the
  connection is back, no note fetched again by the next sync, and every earlier piece's check. The Rewrite tab's mark
  was checked by the tests only (the demo book has no rewrite).

## The one saving system, step 1: a note on the workflow, and files from the device (2026-11-11)

The eighth piece. What Kyle sees is as before; how each is saved changed.

- **A note on the workflow** (Team, Workflow, Add a note on the workflow, or Note on a step) shows at once under
  "Kyle's notes", waits on the device with no connection, and goes up as one save on the workflow as the vault has it
  then. Two notes written offline both land, in order. Before, it said "Connect to the internet to add a note to the
  workflow."
- **Files from the device go up inside one save each**, where some were two:
  - **A cover**: the small copy (`Cover.jpg`) and the full-size picture in the book's Cover folder land together.
    Before, the full-size picture was saved first and the small copy second, so a failure in between left a picture
    in the Cover folder and no cover.
  - **Bring in a manuscript**: the file and the ask to the team land together, so there is never a manuscript in the
    vault that nobody was asked to bring in. Every manuscript, a text file too, goes up byte for byte. The ask shows
    in Jobs from the save's answer, with no sync.
  - **A Rocket file** and **the Word backup of Export to Word** were one save already and still are, now through the
    same door as everything else. A Rocket file whose name is taken gets the next free name ("name (2).csv") at the
    save, on the vault's own file list; a second Word backup on the same day replaces that day's file, as before.
- **These files still need the connection**, and say so ("Connect to the internet to add a cover." and the like): a
  picture or a manuscript is too big for the small store on the device where waiting changes are kept.
- **How it is built.** A `file` op (`src/vault/ops.ts`, `DeviceFile` in `src/lib/types.ts`) carries the file as text or
  as base64 and says what happens when its name is taken: the next free name, in its place, or stop with a sentence.
  Like the chapters op it is sent at once and never waits. A save's plan can now hold files that are not text
  (`blobs` on `CommitPlan`; `Tree.writeBytes`): on GitHub each is sent as a blob first and named in the save's tree,
  and sent once even when the save has to be planned again because the vault moved. The workflow is a file the app
  holds as text and not as a note (`index.team`): a waiting edit to it changes that text on screen
  (`overlayActions`), and the save's answer puts the saved text into the saved copy (`Pushed.texts`, `foldSaved`), so
  the next sync fetches nothing again. The note itself is one more small text change (`workflow-note` in
  `src/vault/text.ts`).
- The old way (Settings, Saving) keeps the old code for all five.
- **Still on their own saves** until their pieces: split and join, copies and saved drafts, the timer's log and the
  typing counts, and the writing page's own saves (held on the old way until a save from Kyle's own device has been
  seen going through the new way).
- Checked with tests (the workflow note waiting, landing on a version the team changed, and matching a fresh read
  with no sync; a Rocket file against the old way's files; a cover as one save of two pictures; a manuscript and its
  ask landing together or not at all; the backup replacing the day's file; a file going up again whole when the
  vault moved; pictures inside the save against a pretend GitHub, sent once across a retry), and in Chromium at
  1180 x 820, 1366 x 1024 and 1440 x 900 and WebKitGTK at the two iPad sizes against a pretend GitHub: the note with
  no connection and the app closed and opened, a Rocket file twice, a real picture shrunk in that engine and shown as
  the cover, a manuscript with its ask showing in Jobs, and every earlier piece's check. Export to Word's backup was
  checked in Chromium only (the WebKit test browser cannot take a download).

## The one saving system, step 1: the timer's log and the typing counts (2026-11-11)

The ninth piece. What Kyle sees is as before: the timer, its panel and the Writing Log notes are unchanged.

- **The timer no longer sends anything itself.** A finished (or stopped) Pomodoro, the words typed and the minutes
  typing are handed to the saving system, which keeps them on the device until they are in the vault and shows them at
  once. Before, the timer had three waiting lists of its own and three copies of the send-and-try-again code.
- **Words and minutes go up as one save**, where they were two each time (after a two-minute pause, every ten minutes
  while typing, and when the page is put away). A Pomodoro that finishes at the same moment goes in the same save.
- **The first Pomodoro or the first words of a day start that day's note** in the same save. A count lands on the
  day's note as the vault has it then, so the iPad and the desktop can both log to the same day and both are kept.
- **With no connection** a Pomodoro waits with everything else ("1 change is saved on this device"); the words and
  minutes stay in their two meters on the device, which add up, and are handed over when the connection is back, so
  a long stretch offline is one change and not dozens.
- **Nothing is counted twice:** what is handed over leaves the meter in the same moment. The part of a tenth of a
  minute not handed over stays for the next time, as before.
- A Pomodoro still in the timer's old list (`sf-pomodoro-log:<vault>`) moves over the first time the timer shows.
- **How it is built.** Three more small text changes (`log-pomodoro`, `log-typed`, `log-typing` in
  `src/vault/text.ts`), made by the same functions the timer used (`addToDay`, `addTypedToDay`, `addTypingToDay`).
  These are the one kind of edit that starts its note when the vault does not have it (`startsNote`): on screen
  (`overlayActions`) and at the save (`push.ts`). `takeTypingCounts` in `src/lib/pomodoro.ts` takes what is due out of
  the meters; `onLog` in `src/ui/App.tsx` puts it in the outbox.
- The old way (Settings, Saving) keeps the timer sending for itself.
- One thing is as it was: if a save lands and its answer is lost on the way back, the same counts go up again on the
  next try. The old sending had the same gap; closing it needs each count to carry a mark of its own.
- Checked with tests (each change on screen equal to its saved text; the first Pomodoro of a day starting the note,
  waiting across closing the app and matching a fresh read; Pomodoros, words and minutes leaving the day's note
  exactly as the timer's own sending left it, in one save where that took four; counts landing on top of what another
  device logged; the tenth-of-a-minute remainder), and in Chromium at 1180 x 820, 1366 x 1024 and 1440 x 900 and
  WebKitGTK at the two iPad sizes against a pretend GitHub: a Pomodoro from the old list going up, eleven words typed
  over seven seconds handed over with GitHub out of reach, asked for again without being counted twice, then one save
  with the day reading 423 words typed; the old way with its two saves; and every earlier piece's check.
- **Found while checking this piece, and fixed: a waiting change could go up twice when the app opened.** The timer
  hands over a waiting Pomodoro the moment it shows, which is before the app's own start-up sync; the two were not
  kept in line at that one moment, so both sent the same change, and the second was made again on top of the first.
  For a choice or a tick that changes nothing (the second finds it already made), but a Pomodoro, a count or a note on
  the workflow would have landed twice. Now a change is never in two sends at once (`sending` and `pushing` beside
  `pushNow` in `src/ui/App.tsx`), whatever asks for the send, and the line the sends wait in is no longer cleared when
  the app starts. The browser check opens the app with a Pomodoro waiting and reads the day's note: one Pomodoro.

## The one saving system, step 1: the book's notes, front and back matter, saved drafts, Restore (2026-11-11)

The tenth piece. Five more things stop talking to GitHub themselves.

- **The book's notes (the writing page's Notes tab, the Braindump) save with no connection.** Save notes shows them at
  once and they wait with everything else; the line "Connect to the internet to save your notes" is gone. The first
  notes of a book start its Braindump note in the same save.
- **Front and back matter (Book details) saves with no connection** too. The box opens with the note as the app shows
  it, so words still waiting to save are in it, and the Kindle file made offline has them.
- **Notes changed somewhere else meanwhile are merged, not written over.** Each save carries the words as Kyle opened
  them. If the team or another device changed the note since, their lines come in beside his, line by line; where both
  changed the same line, his is kept. Before, the Braindump was written over whole, and the front and back matter
  refused to save ("changed somewhere else since you opened it").
- **Saving the book's draft** (Save Draft N, and the draft that saves itself when the last chapter is through in the
  Rewrite tab) is one save through the saving system, made on the vault as it is at that moment, so a scene another
  device saved a minute ago is in the copy. It still needs the connection: the copies are the book as it stands then.
- **Restore from the Archive is one save** where it was two (the scene written to Scenes, then its archived copy
  removed), so a scene can no longer end up in both places. The chapter list and the Archive list follow from the
  save's answer.
- **A deleted beat's words** go to the Archive through the saving system (a file saved as it is, under a name of its
  own). Deleting a beat with words still needs the connection, so the words are safe first.
- **How it is built.** One text change, `words` (`src/vault/text.ts`): the note's body replaced, its properties kept
  byte for byte, merged from the words as opened (`merge3`, the same line merge the writing page uses), starting the
  note when the vault does not have it. Two ops that are sent at once and never wait, `draft` and `restore`
  (`src/vault/book.ts`: `planDraft`, `planRestore`). In the app: `saveDraft`, `onRestore`, `onWords` in
  `src/ui/App.tsx`; `NotesPanel` and `ArchiveList` in `src/ui/EditorPanels.tsx`; `MatterEditor` in `src/ui/Home.tsx`.
- The old way (Settings, Saving) keeps all five as they were.
- Checked with tests (`tests/vault-book.test.ts`: the words change on screen equal to its saved text; the first notes
  starting the Braindump, waiting across closing the app; another device's lines merged in and Kyle's kept on a clash;
  two saves with no connection landing in order as one; the matter started and then only its words changing; a draft
  leaving the vault exactly as the old way did, in one save, from the vault as it is then; Restore leaving the vault
  as the old way did, in one save where that took two, and refusing when the name is taken), and in Chromium at
  1180 x 820, 1366 x 1024 and 1440 x 900 and WebKitGTK at the two iPad sizes against a pretend GitHub: notes saved,
  then saved with GitHub out of reach, still in the box after the app is opened again, and merged with another
  device's line; a scene restored in one save; Draft 2 saved in one save of every scene; the matter saved with GitHub
  out of reach and in the box after opening the app again; a beat deleted with its words in the Archive; the old way.

## The one saving system, step 1: the writing page's own saves, copies, split and join (2026-11-11)

The eleventh and twelfth pieces, the last things that talked to GitHub themselves. Writing still works as it did: the
words are kept on the device as Kyle types (`src/lib/drafts.ts`, unchanged), and a save sends them at once.

- **A save of a scene's words is one save through the saving system.** The same goes for the chapter page's other
  scenes, the beats, the plan and scrap boxes and a passage's Options, which all save through the same door
  (`saveDraft` in `src/vault/words.ts`). What changed elsewhere since Kyle opened the scene is merged in line by line,
  his line kept on a clash, exactly as before (for the new way the rule is one function, `draftOnto` in
  `src/lib/drafts.ts`; the old way keeps its own copy of it until the old way is removed, and tests hold the two to
  the same files).
- **A clash keeps the other version as a copy in the same save.** Before, the copy ("changed elsewhere") was saved
  first and the scene after, so a failure between the two left a copy of a clash that never landed.
- **A copy from the Copies tab is one save**, numbered at the save from the copies the vault has then.
- **Split is one save** where it was three: a copy of the whole scene ("before split"), the new scene with the words
  after the cursor, and this scene with the words before it. If it fails, nothing changed and every word is still in
  the scene. Before, a failure after the first save left the words in both scenes.
- **Join is one save** where it was four: this scene with both sets of words, the next scene's note in the Archive,
  that scene out of Scenes, and the note to the team to update what still names it. If the next scene changed
  somewhere else in the moment between pressing Join and the save, the join stops and says so ("Press Join again to
  join it as it is now") instead of joining older words.
- Still the same: a scene's save needs the connection (with none, the words wait on the device and the page says so);
  copies, split and join need the connection; a scene that is gone from the vault keeps Kyle's words on the device
  and says to press Sync.
- **How it is built.** `Edit` has a fourth form, a scene's words (`{ type: 'body' }`: the draft's words, the words it
  started from, and what Kyle set beside them), landed by `draftOnto`. A new maker, `copy` (`planSnapshot`). A new op,
  `join` (`planJoin` in `src/vault/book.ts`). `src/vault/words.ts` holds what the pages call: `saveDraft`,
  `saveSnapshot`, `splitWords`, `joinWords`. These are sent at once (`pushAction`) and never sit in the outbox: the
  drafts store on the device is already the waiting place for words.
- The old way (Settings, Saving) keeps all of it as it was.
- Checked with tests (`tests/vault-words.test.ts`: the old way and the new way leave the same files for a plain save,
  a status, target and headline change, a merge, a clash, first beats, a scene that is gone and a save whose answer was
  lost; a clash copy and the scene in one save; a copy and the words in one save; words kept offline going up through
  the new save; split as one save against three, and failing without changing anything; join as one save against
  four, stopping when the next scene changed, and never writing over an archived copy), and in Chromium at 1180 x 820,
  1366 x 1024 and 1440 x 900 and WebKitGTK at the two iPad sizes against a pretend GitHub: a save; a save that waited
  with GitHub out of reach and met another device's line; a clash kept as a copy in the same save; a copy; split;
  join; the old way.

### The one saving system, step 1: the old way is out (2026-11-11)

Kyle wrote and finished chapter 34 of Quest Declined 2 on the new way (five saves of the scene between 2:39 and 3:01pm
Eastern, each changing only his words, with his Rewrite-tab choices and the Writing Log beside them), which was the
sign waited for. So:

- **Settings has no Saving section.** There is one way to save. A device that still carries the switch's mark
  (`sparrow.old-saving` in its storage) is not asked about it.
- **Out of the app:** the old sender (`pushLegacy` and the `legacy` option in `src/vault/push.ts`), the old queue
  module (`src/lib/write-queue.ts`: `enqueue`, `overlay`, `saveChoice`, `flush`), the switch (`src/vault/switch.ts`),
  and every "if the old way" branch in `App.tsx`, `Editor.tsx` and `src/vault/words.ts`. `App.tsx` no longer hands a
  page a save that may be missing: the notes box, Front and back matter, Chapter titles, the timer's log, Restore and
  files from the device always go through the saving system.
- **Kept:** a board choice's shape and what it changes moved to `src/vault/choice.ts`; choices and Edit room answers
  left waiting in the two older lists on a device that has not opened the app since 2026-11-11 still move into the
  outbox once (`loadOutbox`).
- **Gone with it, the same day:** the older one-note-at-a-time code nothing called any more. See the next section.
- Checked with the unit tests (the tests that compared the old way with the new now state what the new way must
  leave), and every browser check again in Chromium at the three sizes and WebKitGTK at the two iPad sizes; the first
  check now also holds that Settings shows no switch and that a device carrying the old mark saves the one way.

### The one saving system, step 1: one way to change the vault (2026-11-11)

Nothing Kyle sees changes. What changed is underneath: the app now has exactly one way to change the vault, so a new
feature cannot save around the saving system by accident.

- **A vault source has one write: `commit`** (`VaultSource` in `src/lib/types.ts`). `write`, `writeMany`, `writeBytes`
  and `remove` are gone from the source, from `GitHubSource` and from the demo vault, with GitHub's one-file-at-a-time
  calls and their "saved again after a 409" patch (2026-11-05), which one save for many files never needed. Whether a
  vault can be changed is asked one way everywhere: `source.commit`.
- **The older saving functions are deleted** (about 600 lines): in `scenes.ts` (`createScene`, `splitOff`,
  `archiveForJoin`, `removeJoined`, `archiveNote`, `archiveScene`, `noteJoinForTeam`, `restoreArchived`,
  `renameScene`), `chapters.ts` (`applyShifts`, `makeRoom`, `renumberLists`), `books.ts` (`createSeries`,
  `createBook`), `bookdrafts.ts` (`saveBookDraft`), `covers.ts` (`addCover`, `saveCover`), `docx.ts` (`saveBackup`,
  `makeBackupFolder`), `epub.ts` (`saveMatterBody`), `market.ts` (`addRocketFile`), `recipes.ts` (`saveRecipe`),
  `drafts.ts` (the old `saveDraft` and `saveSnapshot`) and the timer's own sending (`flushLog`, `flushTyped`,
  `flushTyping`). What is left in those modules works out text, names and places; `src/vault/` does the saving.
- **Screens no longer carry a second way to save.** The Word backup and Front and back matter (`Home.tsx`), Chapter
  titles, the notes box and Restore (`EditorPanels.tsx`), a deleted beat's words (`BeatsPage.tsx`) and the timer's log
  (`Pomodoro.tsx`) only hand their change to the saving system; the fallbacks that wrote to GitHub themselves are out.
- **Crow's picture for a character** (`src/study/StudyApp.tsx`) is saved through the saving system too (a file from
  the device, replacing the one there). It was the last direct write in the code.
- **What the old code did is written down, not lost.** Before it was removed, each test that compared "the old way"
  with the new one wrote what the old way left in the vault to `tests/golden/<case>.json` (32 cases: every chapter
  added or moved, scenes deleted, a split, a join, copies, a clash, a renamed scene and recipe, a new series and book,
  a draft of the book, a restored scene, Rocket files, a day of the Writing Log). The tests now hold the saving system
  to those files, byte for byte (`leaves` in `tests/helpers.ts`). The older functions' own tests were moved onto the
  saving system rather than dropped, among them the one that adds, splits and joins scenes in a copy of the demo vault
  and runs the vault's own validator over the result. The check on the real Quest Declined 2 (when the vault is beside
  this repository) no longer compares with the old code; it holds that every scene lands at the chapter number the
  change gives it, with no word changed.
- Checked with the unit tests and every browser check in Chromium at the three sizes and WebKitGTK at the two iPad
  sizes, plus a new check that a picture added in Crow is one save.

## One list of pages (2026-11-11)

Step 2 of the code structure redesign (vault `Docs/Sparrow/20 Code Structure Redesign.md`). Kyle, 2026-11-11, on the card
"Start step 2 of the cleanup, one list of the app's pages?": "Yes, start step 2". Nothing he sees changes.

- **Before.** What the app's pages are was written in five files: the rooms and which boards each holds (`rooms.ts`), each
  page's name, icon and address (`Rooms.tsx`, `boardLinks` in `StoryBoards.tsx`, `seeingLinks` in `Seeing.tsx`), and in
  `App.tsx` a chain of over 30 "if this address or board, draw that", a table of top bar titles, a table of what to tell the team chat, and
  a reading loop that looked at the address bar to decide how often to read the vault. A new page meant editing all five.
- **Now.** `src/app/pages.ts` lists every page once: its id, name, address, room, its place under Book tools on the writing
  page, what it tells the team chat (`where`, `tells`), and how often it wants the vault read again (`reread`, `waiting`).
  `src/app/screens.tsx` holds what each page draws, one entry for each page of the list; the compiler fails if a page has
  none. The sidebar, the top bar and its menu, Book tools, the chat's "sent from" lines and the reading loop all read the
  list. `App.tsx` looks the page up and hands it the app (`AppCtx`: the vault as shown, and `Actions`, everything a page
  can ask the app to do); it is about 250 lines shorter and no longer names a single board.
- **A new page** is one entry in `pages.ts` and one in `screens.tsx`.
- **Kept exactly:** every name, address, order and icon; the schema's title for a board still wins; a board the vault's
  schema lacks is still not listed; Places, Items and Lore still come with Characters; History still shows under Agents;
  the market research stage of the workflow is still Market's "Research steps"; old links to the Edit Queue still open
  To-do; an unknown board still says "The app has no ... board yet".
- **Two small changes, neither on screen.** (1) The team chat is now told the name of the pages that are not boards:
  "the Book details page", "the Story calls page", "the Places page" and so on, where it was told only "this page".
  (2) The reading loop no longer tries to read the vault each minute on Jobs or Chat while the iPad is offline; coming
  back online reads it at once, as before.
- **Checked.** `tests/pages.test.ts` holds the list to what the older page map gave for the demo schema, written down on
  the day it was removed (`tests/golden/pages.json`: every board, no boards, no Characters, three boards renamed by the
  schema); the same comparison passed against the real vault's schema. A browser check (`pages.mjs`, project files
  `app/saving-checks/`) wrote down the sidebar, the top bar, its menu, Book tools and the page's words for 65 addresses at
  four sizes (iPad 1180x820 and 1366x1024, desktop 1440x900, phone 390x844) from the app before the change, and the app
  after it matches all 260.


## The writing page on the new writing box (2026-11-12)

Step 3 of the code structure redesign (vault `Docs/Sparrow/20 Code Structure Redesign.md`). A trial of the new box sat
on a spare page from 2026-11-11 (Kyle: "Yes, build the trial page"). His verdict, 2026-11-12: "yeah, it seemed fine to
me." Then, on the card "Move your real writing page onto the new writing box?": "Yes, move the writing page over" ("I
rebuild your writing page on the new box, with every tool it has today, test it on both devices, then put it live and
tell you.").

- **What Kyle sees.** The same writing page with the same tools. Nothing was added or taken away. The trial page and
  its door at the top of Settings are gone.
- **What changed underneath.** The box Kyle types in is `src/write/prose.ts` (CodeMirror 6; reason in the vault's
  Decision Ledger), drawn by `src/write/ProseEditor.tsx`. The page IS the scene's Markdown: the stars of italics and
  bold, the equals signs of marks and the "> " of System screen lines are in the page and hidden, so there is no
  second copy of the words to keep in step, no redrawing of the whole page on a key, and no putting the cursor back
  after one. A key changes only its own line, and only the lines near the screen are drawn. The older box
  (`src/ui/StyledEditor.tsx`), which rebuilt the page's HTML and restored the cursor after every change, is removed
  with its helpers (`src/ui/highlight.ts`).
- **Typing beside a style** follows written rules in `src/lib/prosedit.ts`, tested without a browser: words typed inside
  italics are italic, words typed after them are plain, a space at the end of styled words sits outside the stars,
  Backspace never leaves a lone star, Bold between words waits for the next letter. A line whose marks are nested in a
  way those rules do not write (italics inside bold) falls back to the older insert rules, so nothing is lost.
- **Every tool is behind one contract,** `EditorCommands` in `src/write/prose.ts`: Bold, Italic, Highlight, Normal,
  undo and redo, Find and replace, the picked-words menu, codex names (pressed to open their card), {asks} and the
  one being worked on, the dot on lines the team added, Bring over and its undo, lines arriving from elsewhere
  (`apply` keeps the cursor and the first line in sight where they were), copy and paste with styles
  (`src/write/clipboard.ts`), the cursor's place for the side column.
- **Lights are part of the page now.** The Rewrite tab's light on Kyle's paragraph, Check's flagged words and the word
  Listen is reading are marks the box draws with its own words (`light(name, spans)`, classes `lit-shown`, `lit-check`,
  `lit-check-now`, `lit-listen`), so they cannot run past the page or sit a few words off, and they move with the
  words as Kyle types. The boxes drawn over the screen and the CSS Custom Highlight API are no longer used.
- **The download.** The box is part of the app's main file now (about 280 KB zipped, up from about 200 KB), not fetched
  when first needed, so writing works offline from the first open.
- **Checked** on the final build: the unit tests; the 28 saving checks in Chromium and WebKitGTK; the 260 page
  pictures against the released app; and new checks on the real writing page in both engines at both iPad sizes and at
  desktop size (`box.mjs`, `box2.mjs`, `webkit-box.mjs` in the project files' `app/saving-checks/`): real keys beside
  italics, bold and marks, Enter and Backspace across lines, every button of the tool row, copy and paste, Find and
  replace, codex names, Check's marks, the picked-words menu, Bring over and Undo, the chapter page, and the Markdown
  that reaches the vault. What only Kyle's iPad can say: the on-screen keyboard, autocorrect, dictation and the
  selection handles on his real page. Not covered by a check: Listen's light (no speech in a test browser).


## One way to ask the team (step 4 of the code structure redesign, from 2026-11-12)

Kyle, 2026-11-12, in the project chat: "can i start stage 4 of app design while the prospective draft 3 work is being
done?", then "go". The plan is in the vault's `Docs/Sparrow/20 Code Structure Redesign.md`; this section grows as each
piece goes live.

- **An answer used on one device is used on the other (2026-11-12, first piece).** When the app puts a brace answer
  into the page, or Kyle picks one of the team's options or puts them away, the job note in the vault gets a `taken`
  line (`taken: [B1]` for a brace, `taken: [all]` for the whole ask). It goes up through the saving system like every
  other change (`taken` in `src/vault/text.ts`, `onTake` in `src/ui/App.tsx`), shows at once and waits with no
  connection. Every device reads it (`src/team/asks.ts`: `isTaken`, `askState`), so the desktop no longer puts in an
  answer the iPad already used. Before, each device kept its own list (`story-forge.filled.`,
  `story-forge.options-done.`) and guessed about the other: an answer over three hours old was taken as used elsewhere.
- **The move from the older way.** Asks the team finished before 13:00 UTC on 2026-11-12 (`fromOldWay`) are still told
  from the device's own list and the three-hour rule, once, and then marked `taken` in the vault. That code and the two
  lists can be removed once both of Kyle's devices have opened the app after this went live.
- **Not changed:** how an ask is sent, what the team writes, where an answer lands in the page, the note the page shows
  when a brace is gone and its answer has nowhere to go.
- **Checked** with two browsers that share nothing, on one pretend GitHub (`taken.mjs` in the project files'
  `app/saving-checks/`): the team's answer comes into the iPad's page once and the job note says `taken: [B1]`, the
  rest of the note untouched, saved as Kyle's; the desktop does not put it in a second time, and gets it with the scene
  when the iPad saves; options put away on the iPad are away on the desktop at its next look at the vault.
- **The kinds of ask live in one list (2026-11-12, second piece).** What a kind is called, the title a job gets when
  Kyle gives none, the fixed instructions some kinds carry in their ask, who on the team runs it and what that agent is
  told were kept in three places: the app's own tables (`jobLabel`, `defaultJobTitle`, `jobAsk` in `src/lib/jobs.ts`),
  the runner's (`AGENT_FOR` and `buildPrompt` in the vault's `System/Tools/jobs.mjs`) and the schema's list of kind
  names. They are now one list in the vault's schema, `types.job.kinds` (its `kinds_about` line says how to read it).
  The runner reads it for the agent and the steps; the app reads it through `src/team/kinds.ts` (`kindsFrom` when the
  schema loads, in `src/ui/App.tsx`; the schema the app was built with stands in when the copy on the device is from
  before the list). **A new kind of ask is one entry in that list and its name in the `kind` list: no app change.**
  Only a conversation (`chat`) is still put together by the runner's own code, because it carries the messages so far.
- **Nothing the team is told changed.** Before the move, what the runner says for every kind (with a target and
  without, and two conversations) was written down from the old code, 56 prompts in the vault's
  `System/Tools/tests/fixtures/job-prompts/`; after it they are the same to the letter (`jobs.test.js`, which also
  fails if the two lists of kind names differ). The app's labels, titles and asks for every kind were written down the
  same way (`tests/golden/job-kinds.json`, `tests/kinds.test.ts`) and are unchanged. `node System/Tools/jobs.mjs
  prompt <job note>` prints what a job would be told without changing anything.
- **One way to wait, and one sentence when it went wrong (2026-11-12, third piece).** While the team has any ask (a
  job that is requested or running), the app reads the vault again every 15 seconds, on whatever page Kyle is on, so
  the answer shows where he asked for it (`watchStep` in `src/team/asks.ts`, called from the one timer in
  `src/ui/App.tsx`). One timeout rule: after 20 minutes with the same asks open and nothing moving, it looks once a
  minute instead, and goes back to every 15 seconds as soon as an ask starts, finishes or is added. Before, each page
  said which of its own asks counted (the Chat page its open conversation, the writing page its scene's chat, braces
  and options), the team column was found by looking for it on the screen, and Beats, Changes and the workflow steps
  said nothing, so their answers waited for the next ordinary read. Those per-page rules are gone from the list of
  pages.
  A feature finds its ask one way (`askFor`, `openAsk`: by kind, target and book), which Beats, Changes, the workflow
  steps and the "already asked" check now use (that check used to ignore the book). When the team could not finish,
  every place says the same sentence (`askProblem`): "The team could not finish this. <what the team said>. Ask again
  when you are ready; the Jobs page has the details." Chat and Options show it on the failed message or ask. Beats,
  the Changes tab and a workflow step show it where the ask button is for a day after the failure (`recentProblem`),
  or until Kyle asks again; before, a failed ask on those pages just went quiet. The Beats page also says "The team is
  working on this chapter's beats" while it waits (it was handed the job before and showed nothing).
  Checked in Chromium at iPad and desktop sizes and in WebKit at two iPad sizes (`watch.mjs`, `webkit-watch.mjs`): on
  Beats and on a workflow step the page says the team is working, then within 25 seconds of the team's failure says
  the sentence, with no reload.

## Tidying the rest (step 6 of the code structure redesign, from 2026-11-12)

Kyle, 2026-11-12: "Start whatever step next that you think is best." Step 6 changes only the app's code; nothing he
sees or anything in the vault changes. This section grows as each piece goes live.

- **What a device keeps, in one place (2026-11-12, first piece).** The app keeps 57 things on a device: the connection,
  words and changes waiting to go up, the timer, and where each page was left (which tab, which view, what is open).
  Thirty-four files each named their own storage key and wrapped their own try and catch around the browser's storage.
  Now every name is listed once, in `PREF` in `src/lib/prefs.ts`, and every read and write goes through that file
  (`readPref`, `writePref`, `readJson`, `writeJson`; `storeOf` for the few modules whose tests hand them a pretend
  store). Nothing else in `src/` names `localStorage` or `sessionStorage`; `tests/prefs.test.ts` fails if a file
  does, if a name is used outside the list, or if a name a device already holds is changed or removed. **The names
  are the ones Kyle's devices already hold, so nothing was moved and nothing is forgotten.** A new setting is one line
  in `PREF` and one in that test's list. What must follow Kyle between devices does not belong here: it goes in the
  vault (as "used" did in step 4).
- **Page checks in the iPad's engine on every change (2026-11-12, second piece).** Kyle's iPad runs WebKit, and bugs
  there (cursor, scroll, typing) often do not show in Chrome. Six checks that were kept outside the repository now
  live in `tests/webkit/` and run on every pull request in a real WebKit (WebKitGTK, driven over plain WebDriver, at
  1180x820 and 1366x1024): typing and styling in a long chapter (`box`), saving offline, reconnecting and merging with
  the team's lines (`live`), adding, moving and deleting chapters (`chapters`), Accept, Reject and Undo in the Edit room
  (`edit`), the Rewrite tab's light staying inside the page (`light`), and the team watcher and failure sentence
  (`watch`). They drive the built app against a pretend GitHub that starts from `demo-vault/` (`fake.mjs`). The
  `webkit` job in `.github/workflows/pages.yml` runs them (about ten minutes); a merge to main still deploys after
  the unit tests and build alone. Locally: `npm run build`, `npx vite preview --port 4173`, `npm run test:webkit`
  (needs `webkit2gtk-driver` and `xvfb`). The Chromium copies and the rest of the saving checks stay in the project
  files' `app/saving-checks/`.
- **Each theme in its own place (2026-11-12, third piece).** The one 2,800-line stylesheet had the 18 themes in its
  middle, the shared parts of some themes inside other themes' sections. It is now `src/styles/`: `index.css` brings
  in, in order, `app.css`, `themes/colours.css` (the eleven colour themes, **one line of values each**, and how loud
  their buttons are), `themes/square-skins.css` (what Marigold, Lo-Fi and Retro OS share), one file for each of the
  seven themes with their own shapes and fonts (a "skin"), and `app-after-themes.css`. A new colour theme is one line
  in `colours.css` and one entry in `src/lib/theme.ts`; a new skin is also one file. `tests/theme.test.ts` checks that
  every theme has all ten values, that a skin's file styles only its own theme, and that no other file names a theme.
  **Not done, on purpose:** the plan said shapes and fonts would become values too. The seven skins were each drawn
  from a picture Kyle sent, and their rules are particular (a title bar, a pressed button, a drawn checkbox); turning
  them into shared values would change some 200 rules whose pressed and hover looks no picture check covers, to save
  work only on a kind of theme that is drawn by hand anyway. One file each keeps them easy to find and to add.
  Checked: the built stylesheet has exactly the same rules as before (same count, same bytes; only the order of a few
  that cannot clash moved), and 360 pictures (20 pages under each of the 18 themes, iPad size) are identical, dot for
  dot, to the app before the change (`themes.mjs` in the project files' `app/saving-checks/`).
- **One way to read a note's properties (2026-11-12, fourth piece).** A note's properties arrive untyped, so 48 files
  turned them into text by hand, 134 times (`String(note.data.title || '')`), and a misspelt name read as empty
  without anyone being told. Now they read `propText(note, 'title')` or `propNum(note, 'rating')` from
  `src/lib/props.ts`, and the name must be one the schema has: `src/lib/prop-names.ts` lists all 263, written from
  `demo-vault/System/schema.json` by `npm run props`, so a misspelt or made-up property fails the type check before it
  ships. `tests/props.test.ts` fails if the list and the schema differ or if a file goes back to the cast by hand.
  Only the reads that meant exactly the same thing were moved, so nothing behaves differently. **Smaller than the
  plan, on purpose:** the plan had readers that also know each property's kind (a number, a list, a link) and share
  the job runner's reader. The reads that are left do something of their own (a default, a trim, a list); they move
  when the code around them is next changed. After a schema change: refresh the demo copy, then `npm run props`.

## Chapters have their own ID (step 5 of the code structure redesign, 2026-11-12)

Kyle, 2026-11-12: "can you save the status of the cards at the moment, do step 5, then try to bring the cards into it?"
Nothing he sees changes.

- **What a chapter is now.** A chapter is still the scenes that share a `chapter` number, and those scenes also share a
  `chapter_id` (CH-007) that never changes when chapters are added, moved or deleted. A chapter's other notes (beats,
  plan, scrap, the Edit room's change cards, scene notes, to-dos) carry the same `chapter_id`, and that line is what says
  which chapter they belong to. The `chapter` number on them and the "Chapter 7" in a file name are labels.
- **Reading.** `resolveChapters` in `src/lib/chapterids.ts` reads every chapter note's chapter from its ID, once, where
  the index is put together (`assemble`, and the two places waiting and saved changes are folded in). Every page keeps
  reading `chapter` as before and gets the right one, even from a note the team wrote with an old number (a job that
  was running while a chapter moved). A note with no ID, or whose chapter is gone, reads by its number as before.
- **Saving.** The last thing every save does is `stampChapterIds` (`src/vault/chapters.ts`): a new scene takes its
  chapter's ID, or the next free one when it starts a chapter; a scene moved into another chapter takes that chapter's;
  a new chapter note (first beats, a plan, a to-do) takes its chapter's. It only looks when a save adds such a note or
  changes one's chapter, so typing never pays for it, and it does nothing in a book that has no chapter IDs.
- **The labels are still kept current.** Adding, moving or deleting a chapter still corrects the numbers and file names
  in the same one save (step 1). **Smaller than the plan, on purpose:** the plan had the number never stored and a
  move changing one line. The team's skills, `sf` and Kyle's own eyes all read `chapter: 7` and "Chapter 7 changes",
  and he was in the middle of 677 open cards; so the numbers stay as labels that are kept right, and the ID is what
  holds a note to its chapter when a label is wrong. The two lists kept by number outside chapter notes (`rewrite_done`
  on the book, the Chapter Titles note) still follow by the code from 2026-11-11.
- **In the vault:** `chapter_id` in the schema for the seven kinds; `System/Tools/chapter-ids.mjs` gave the first IDs
  (chapter N became CH-00N; it adds one line under `chapter:` and changes no other) and gives one to notes the team
  writes with only a number (run at the end of every job and by the Morning check); `sf` reads by ID and `sf validate`
  says when two chapters share an ID. An older copy of the app left open on a device keeps working: it ignores the line
  and keeps it when it saves.
- Checks: `tests/chapterids.test.ts`; the WebKit `chapters` check now runs on a book with chapter IDs.

