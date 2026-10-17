# Story Forge app: code rules

This repository is the Story Forge web app. The vault it reads is the separate `author-business` repository; read that
repository's CLAUDE.md for the studio's rules and Kyle's hard constraints. This file covers the code.

## What the app does

- Reads the vault through the GitHub REST API with a fine-grained token Kyle pastes into Settings. The token lives in
  localStorage only. Never ask for it, log it, or put any token, key or address in this repository.
- Renders boards from the vault's `System/schema.json`. A new note type or card field needs a schema change, not an app change.
- Phase 1: the Chapter Grid, read only. Phase 2 adds the Ideas board (keep, later, drop, written back with a write queue);
  drag to reorder, status toggles and inline edit come later.
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
src/lib/ideas.ts         Ideas board piles, and the line edits keep, later and drop make
src/lib/write-queue.ts   choices waiting to save (localStorage), sending them, showing them before they land
src/lib/github.ts        GitHub source: tree, blobs, connection test, plain-sentence errors
src/lib/demo-source.ts   the bundled demo vault as a source
src/lib/sync.ts          one sync: tree, schema, index, reusing unchanged files
src/lib/cache.ts         IndexedDB snapshot per source, for offline
src/lib/markdown.ts      small, escaping Markdown reader for the note view
src/ui/                  screens (Preact)
public/sw.js             service worker for the app shell only; never caches GitHub
demo-vault/              a tiny vault that follows the schema, for tests and the Pages preview
tests/                   Node test runner tests
```

## Rules the code keeps

- Parse notes exactly as the `sf` tool does. `src/lib/frontmatter.js` is the FRONTMATTER section of
  `author-business/System/Tools/sf.js`. When sf.js changes, run `npm run sync-parser` (expects `../author-business`).
  A test fails if the copy drifts, whenever the vault is checked out beside this repository.
- Index the same paths sf reads and skip the same folders (Exports, Snapshots, Archive, Templates, System/Tools, hidden).
- Errors shown to Kyle are plain sentences that say what to do.
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
