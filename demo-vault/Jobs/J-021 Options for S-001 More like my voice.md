---
type: job
id: J-021
title: Options for S-001 More like my voice
kind: options
target: S-001
book: Series/Ember Road/Books/1 Ash Bell
status: done
requested_by: Kyle
agent: Writer
created: 2026-10-18
started: 2026-10-18T09:12
finished: 2026-10-18T09:16
cost_usd: 0.08
run_url: https://github.com/example/author-business/actions/runs/21
result: Three takes on the breath paragraph, each linted clean.
---
## Ask
Kyle picked a passage in S-001 The Crack in the Story Forge app and asked for options: More like my voice.

1. Read the scene for context, the book's Style Guide and the prose rules in CLAUDE.md. Never change the scene or any other note: the app swaps in the option Kyle picks.
2. Rewrite it as the Writer, as close to Kyle's own voice as you can: load the style-fingerprint skill (Taste/Style Fingerprint.md), the book's Style Guide and your MEMORY.md lessons from his edits. Keep its events and dialogue.
3. Write three options (two if a third would only repeat one), each a different take. Each replaces the passage exactly, so it starts and ends where the passage does, in the same tense and point of view, with *italics* kept as Markdown.
4. Check each one before writing it down: run `System/Tools/sf lint` on it (or the anti-slop skill's rules) and fix every strong or likely tell.
5. Put them in this job's ## Result, each under its own heading, `### Option 1`, `### Option 2`, `### Option 3`, holding only the replacement text: no quote marks around it, no labels, no comments. Anything to say about them goes last, under `### Notes`, one short line per option.

Mode: voice
Before:

### Passage
She let out a breath she didn't know she was holding. The silence was palpable, a testament to every winter the bell had survived.

## Result
### Option 1
She breathed out. Forty winters on that beam, and the bell had never once gone quiet on her.

### Option 2
Her breath fogged the lantern glass. Below, the ford hadn't made a sound since the frost came in.

### Option 3
She counted the winters on her fingers and ran out of fingers.

### Notes
1 keeps the bell's age. 2 moves to the ford. 3 is the shortest; sf lint finds nothing in any of them.
