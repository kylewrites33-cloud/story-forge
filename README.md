# Story Forge app

The web app for Story Forge, Kyle Heath's writing studio. It shows the vault (the `author-business` repository) as boards, reading it through the GitHub API. It runs in the browser on the iPad, the Mac and a phone, installs to the home screen, and keeps working offline with the last copy it saved.

Phase 1 has one board: the **Chapter Grid**, read only. It shows a book's scenes grouped by chapter, in order. Tap a card to see the scene's properties and text.

## Using it

1. Open the app's GitHub Pages address. With no token it shows a small demo vault.
2. Open **Settings**, paste your fine-grained GitHub token, and tap **Save**. **Test connection** says what it found.
3. The app opens on the active book named in the vault's `System/Config.md`. **Books** lists every book.

The token stays in this browser's storage and is only ever sent to GitHub. **Forget token** in Settings removes it and the saved copy.

## For developers

See [CLAUDE.md](CLAUDE.md).
