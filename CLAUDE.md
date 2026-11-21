# Sparrow app: code rules

This repository is the Sparrow web app (called Story Forge until 2026-10-22; the repository name and the app's address did not change). The vault it reads is the separate `author-business` repository; read that
repository's CLAUDE.md for the studio's rules and Kyle's hard constraints. This file covers the code.

## What the app does

- Reads the vault through the GitHub REST API with a fine-grained token Kyle pastes into Settings. The token lives in
  localStorage only. Never ask for it, log it, or put any token, key or address in this repository.
- Renders boards from the vault's `System/schema.json`. A new note type or card field needs a schema change, not an app change.
- The rest, screen by screen and with when Kyle asked for each, is in `docs/Features.md`. In short: the Chapter Grid,
  boards for every proposal type (keep, later, drop, Rewrite, Edit), the writing screen (styled text, copies, split and
  join, beats, brackets, Check, Options, Listen, live merge), Ask the team (job notes) and Chat, the codex and the
  seeing-the-book pages, Overview, To-dos, Pomodoro, Team, Taste, Recipes, Export to Word and covers.
- **Before changing a feature, read its part of `docs/Features.md`; after, update it** (dated, in Kyle's words where he
  gave them). A feature that is not written down there gets lost.
- A scene save replaces the body and the computed `words` line (and `target_words` if Kyle set one) and nothing else.
  If the scene changed elsewhere since Kyle opened it, the other version is saved first as a snapshot and Kyle's wins.
- Writes change only the lines they touch, re-read the note first, and commit with Kyle's token and no `Agent:` trailer:
  a choice on a board is Kyle's. The app never sets `keep` on anything Kyle did not tap.

## Stack

Vite, TypeScript, Preact, idb. No CSS framework and no other runtime dependency without a reason in the vault's
`Docs/Sparrow/02 Decision Ledger.md`. SortableJS is allowed when Phase 2 needs drag.

- JSX goes through Vite's esbuild (`jsxImportSource: preact`); there is no Preact Vite plugin.
- Code is erasable TypeScript (no enums, no parameter properties) so Node runs the tests without a build step.
- Imports name the `.ts` extension.

## Layout

Every source file and what it holds is in `docs/Layout.md`; read it before adding a file and add the new one there. The
shape:

```
src/app/            the frame: pages.ts is the one list of pages (a new page is one entry there and one in screens.tsx,
                    which holds what each page draws); route.ts is the addresses
src/vault/          the one saving system: the only code that changes the vault. A feature that saves makes an action here
src/team/           the one way to ask the team: where an ask stands, which answers are used, and the kinds of job (read
                    from the vault schema's `types.job.kinds`; a new kind is an entry there, not an app change)
src/lib/            logic, tested with Node (no DOM): parsing, indexing, sync, one module per feature
src/lib/frontmatter.js, prose.js, lint.js   copies of the vault tool's sections (do not edit; see below)
src/ui/             screens (Preact); src/ui/Shell.tsx is the sidebar and top bar
public/sw.js        service worker for the app shell only; never caches GitHub
demo-vault/         a tiny vault that follows the schema, for tests and the Pages preview
server/             the always-on runner's setup
tests/             Node test runner tests
docs/              Features.md and Layout.md
```

## Rules the code keeps

- Parse notes exactly as the `sf` tool does. `src/lib/frontmatter.js` is the FRONTMATTER section of
  `author-business/System/Tools/sf.js`, `src/lib/prose.js` its prose section with U.escapeHtml and U.wordCount, and
  `src/lib/lint.js` its lint section with U.wordCount, U.sum, U.mean, U.stdev and U.escRe. When sf.js changes, run `npm run sync-parser` (expects `../author-business`).
  A test fails if any copy drifts, whenever the vault is checked out beside this repository.
- Index the same paths sf reads and skip the same folders (Exports, Snapshots, Archive, Templates, System/Tools, hidden).
  The one exception is the team's files in `.claude` (agents, skills, agent memory), read separately for the Team page.
- Errors shown to Kyle are plain sentences that say what to do.
- What a device keeps goes through `src/lib/prefs.ts` under a name in its `PREF` list; no other file names
  `localStorage` or `sessionStorage`, and a name a device already holds is never changed. What must follow Kyle between
  devices goes in the vault instead.
- The iPad and desktop Chrome get the same app with the same features (Kyle, 2026-10-17). Nothing is iPad-only or
  desktop-only; test both sizes. Keyboard shortcuts are extras (Ctrl or Cmd+S saves in the writing screen), never the only way.
- iPad first: large type, one accent colour, light and dark (Settings, Colours: nine light and ten dark themes per device,
  Kyle 2026-10-18; every colour is a CSS variable, so new styles use the variables, never fixed colours; the stylesheet is `src/styles/`, a colour theme one line in `themes/colours.css`, a theme with its own shapes one file beside it), 16 px side gutter, no horizontal scroll, 44 px tap targets.
- A note's property is read with `propText` or `propNum` from `src/lib/props.ts`, never `String(note.data.x || '')` by
  hand; the names come from the schema (`npm run props` after the demo schema copy changes).
- A chapter note belongs to its chapter by `chapter_id` (CH-007), never by its number: read `chapter` from the index
  (it is worked out from the ID there, `src/lib/chapterids.ts`), and let the save's last step write the IDs. Never
  write or change a `chapter_id` anywhere else.
- Files are fetched by blob sha, so an unchanged note is never downloaded twice.
- `demo-vault/System/schema.json` is a copy of the vault's schema. Refresh it when the schema changes, and keep the demo
  vault passing `sf validate` (a test runs it when the vault is beside this repository).

## Sparrow Pocket (the phone page, `pocket/`)

Kyle, 2026-11-21: "im a little worried about messing up the main app with this pocket app ... i feel comfident in the
integrity of the main app, and just dont want to mess things up with a buggy entry point into it". So Pocket is walled
off, and `tests/pocket-wall.test.ts` fails if the wall is broken:

- Pocket's code is `src/pocket/` and `src/lib/pocket*.ts`. Nothing else imports it, and the main app's page loads none
  of it. What both ends need lives in a shared module that is neither (`src/lib/phone-choices.ts`, the note format).
- Pocket only records. It changes no note: Kyle's choices are kept on the phone (its own names in `PREF`) and go up by
  themselves to the book's `phone-choices` note in `Phone/`, from `src/pocket/send.ts`, its only save. It loads nothing
  from `src/vault/`, `src/ui/` or `src/app/`, has no outbox or waiting words, and keeps its own saved copy.
- The main app puts the choices in (`src/vault/phone.ts`) through its own actions, skips what no longer fits, and writes
  each result on the note. A new kind of choice is a new line in the note format, a recorded choice in Pocket, and a
  step in `planPhone` that uses an action the Edit room already has. Write mode's beat choices (write, rename, add,
  delete, move) go through `src/lib/phone-beats.ts`, shared by both ends, and are saved as Beats mode saves them. The
  writing screen never puts them in by itself: it shows a bar, and only Put it in does.

## Run, test, deploy

```
npm install
npm run dev          local server with the demo vault
npm test             node --test (Node 22.18 or later)
npm run typecheck
npm run test:webkit  the page checks in a real WebKit (tests/webkit/; needs a build, vite preview on 4173, webkit2gtk-driver, xvfb)
npm run build        to dist/
npm run icons        redraw public/icons
npm run props        rewrite src/lib/prop-names.ts from the demo vault's schema
```

Branches and pull requests; Kyle merges. Never force-push. `.github/workflows/pages.yml` runs the tests and build on
every pull request, and on merge to main deploys `dist/` to GitHub Pages (Settings, Pages, Source: GitHub Actions).
The build uses relative paths, so it works at any Pages address.
