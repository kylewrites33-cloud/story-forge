# Story Forge app: code rules

This repository is the Story Forge web app. The vault it reads is the separate `author-business` repository; read that
repository's CLAUDE.md for the studio's rules and Kyle's hard constraints. This file covers the code.

## What the app does

- Reads the vault through the GitHub REST API with a fine-grained token Kyle pastes into Settings. The token lives in
  localStorage only. Never ask for it, log it, or put any token, key or address in this repository.
- Renders boards from the vault's `System/schema.json`. A new note type or card field needs a schema change, not an app change.
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
  `Tasks/T-NNN` note. The writing screen shows `*italics*` and `**bold**` as styled text (stars kept, faint) in an
  editable page whose characters are exactly the Markdown; Ctrl or Cmd+B and I (and the iPad's B and I keys) add stars;
  a per-device switch in Scene goes back to the plain text box.
  The writing screen has three parts, like Sudowrite: the book's chapters and scenes on the left (press one to save and
  move to it; board shortcuts below), the page in the centre (a tool row with Bold, Italic, Undo, Redo, Split and Join;
  a chapter heading; "Done with this scene?" with Next at the bottom), and the scene panel on the right (Card, Copies,
  Target, Split and join). The list sits beside the page from 900 px wide and the panel from 1200 px; narrower, each
  slides over the page. One top bar holds the book's boards, a sync button, Books, To-do and Settings. A Chapter Grid
  card opens the writing screen; Needs work, Edit card and the note sit behind its "•••" button.
  Novelcrafter-style additions (Kyle, 2026-10-18): the app opens on a home page (Books or Series, "Continue where you
  left off" from the scenes last opened on this device, cover cards or a list, search and sort) and a page per series.
  A book's cover is `Cover.jpg` in the book's folder, shrunk on the device before saving; a book without one gets a
  pattern from its title. Empty pages offer buttons (Create first scene, Start from an outline: pasted lines become
  planned scenes). Chapter Grid: coloured status edge, scene `labels` and `subtitle`, a filter box, Cards or Outline,
  pages and reading time (rates in Settings). Writing screen: Focus mode, a Page tab (size, spacing, width, font,
  paper, per device) and a strip of the chapter's scenes sized by length.
- A scene save replaces the body and the computed `words` line (and `target_words` if Kyle set one) and nothing else.
  If the scene changed elsewhere since Kyle opened it, the other version is saved first as a snapshot and Kyle's wins.
- Writes change only the lines they touch, re-read the note first, and commit with Kyle's token and no `Agent:` trailer:
  a choice on a board is Kyle's. The app never sets `keep` on anything Kyle did not tap.

## Stack

Vite, TypeScript, Preact, idb. No CSS framework and no other runtime dependency without a reason in the vault's
`Docs/Story Forge/02 Decision Ledger.md`. SortableJS is allowed when Phase 2 needs drag.

- JSX goes through Vite's esbuild (`jsxImportSource: preact`); there is no Preact Vite plugin.
- Code is erasable TypeScript (no enums, no parameter properties) so Node runs the tests without a build step.
- Imports name the `.ts` extension.

## Layout

```
src/lib/frontmatter.js   the vault tool's YAML reader, copied as is (do not edit; see below)
src/lib/schema.ts        parse System/schema.json; card fields, enums, property order
src/lib/vault-index.ts   which files to read, parse them, build series/books/scenes; warnings
src/lib/board.ts         Chapter Grid grouping
src/lib/ideas.ts         piles, and the line edits keep, later, drop, accept, needs work and move make
src/lib/boards.ts        Story Juice and Market boards: which notes, grouped and ordered by the schema; the cast with book deltas
src/lib/write-queue.ts   choices waiting to save (localStorage), sending them, showing them before they land
src/lib/github.ts        GitHub source: tree, blobs, connection test, plain-sentence errors
src/lib/demo-source.ts   the bundled demo vault as a source
src/lib/sync.ts          one sync: tree, schema, index, reusing unchanged files
src/lib/cache.ts         IndexedDB snapshot per source, for offline
src/lib/prose.js         the vault tool's prose helpers and word count, copied as is (do not edit; see below)
src/lib/styled.ts        the writing screen's styled view: emphasis runs, HTML that keeps every character
src/lib/drafts.ts        the writing screen's drafts: kept on the device, saved to the vault, snapshots, clashes
src/lib/market.ts        Publisher Rocket files: the ones a series has, safe names, adding one from the device
src/lib/tasks.ts         the to-do list: task notes by status, due dates, new to-dos with the next free ID
src/lib/scenes.ts        new scenes, split and join: next free ID, order between neighbours, archive before removing
src/lib/markdown.ts      small, escaping Markdown reader for the note view
src/lib/home.ts          home page helpers: recent scenes, book sort, cover patterns, labels, reading time, filter, outline
src/lib/covers.ts        book covers: shrink on the device, save as Cover.jpg, keep on the device by blob sha
src/lib/page.ts          the writing page's look per device (size, spacing, width, font, paper)
src/ui/Home.tsx          the home page (Books, Series) and a series' page
src/ui/EditFields.tsx    a card's words edited in place (board cards and scene cards)
src/ui/Icon.tsx          the small line icons, drawn inline
src/ui/                  screens (Preact)
public/sw.js             service worker for the app shell only; never caches GitHub
demo-vault/              a tiny vault that follows the schema, for tests and the Pages preview
tests/                   Node test runner tests
```

## Rules the code keeps

- Parse notes exactly as the `sf` tool does. `src/lib/frontmatter.js` is the FRONTMATTER section of
  `author-business/System/Tools/sf.js`, and `src/lib/prose.js` its prose section with U.escapeHtml and U.wordCount. When sf.js changes, run `npm run sync-parser` (expects `../author-business`).
  A test fails if either copy drifts, whenever the vault is checked out beside this repository.
- Index the same paths sf reads and skip the same folders (Exports, Snapshots, Archive, Templates, System/Tools, hidden).
- Errors shown to Kyle are plain sentences that say what to do.
- The iPad and desktop Chrome get the same app with the same features (Kyle, 2026-10-17). Nothing is iPad-only or
  desktop-only; test both sizes. Keyboard shortcuts are extras (Ctrl or Cmd+S saves in the writing screen), never the only way.
- iPad first: large type, one accent colour, light and dark, 16 px side gutter, no horizontal scroll, 44 px tap targets.
- Files are fetched by blob sha, so an unchanged note is never downloaded twice.
- `demo-vault/System/schema.json` is a copy of the vault's schema. Refresh it when the schema changes, and keep the demo
  vault passing `sf validate` (a test runs it when the vault is beside this repository).

## Run, test, deploy

```
npm install
npm run dev          local server with the demo vault
npm test             node --test (Node 22.18 or later)
npm run typecheck
npm run build        to dist/
npm run icons        redraw public/icons
```

Branches and pull requests; Kyle merges. Never force-push. `.github/workflows/pages.yml` runs the tests and build on
every pull request, and on merge to main deploys `dist/` to GitHub Pages (Settings, Pages, Source: GitHub Actions).
The build uses relative paths, so it works at any Pages address.
