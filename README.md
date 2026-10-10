# Archery Pro

A simple practice tracker for indoor archery competition prep. Score each end as you shoot, watch your session average update live, and see how your average changes across practice sessions.

It runs entirely in the browser as a static site (GitHub Pages friendly) and keeps your data in the browser's local storage.

## Features

- Start a practice session with a date, arrows per end (3 or 6) and optional notes such as distance and target face.
- Big tap-friendly keypad coloured like a 10-ring indoor face: X, 10–1 and M (miss). X counts as 10 and is tracked separately.
- The end fills as you tap and moves on to the next end automatically. Undo removes the last arrow.
- Live session stats: average per arrow, average per end, total, ends shot, 10s and Xs.
- Progress tab with a chart of average arrow score per session, overall stats and a list of all sessions you can reopen or delete.
- Export and import a JSON backup.
- Keyboard scoring on desktop: `x`, `1`–`9`, `0` for 10, `m` for miss, Backspace to undo.

## Running locally

It is plain HTML, CSS and JavaScript modules with no build step. Serve the folder with any static server, for example:

```sh
python3 -m http.server 8000
```

then open http://localhost:8000.

## Deploying to GitHub Pages

In the repository settings, open **Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.

## Adding a backend later

All persistence goes through `js/storage.js`, which exposes an async interface (`listSessions`, `getSession`, `saveSession`, `deleteSession`, `getActiveSessionId`, `setActiveSessionId`, `exportAll`, `importAll`). To use a database, write an adapter with the same methods that calls your API and export it as `storage`. Existing browser data can be moved over with the JSON export.

## Data model

```json
{
  "id": "uuid",
  "date": "2026-10-10",
  "notes": "18m, 40cm triple spot",
  "arrowsPerEnd": 3,
  "ends": [["X", "10", "9"], ["10", "9", "8"]],
  "completed": true,
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```
