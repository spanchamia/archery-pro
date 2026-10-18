# Archery Pro

A simple practice tracker for indoor archery competition prep. Score each end as you shoot, watch your session average update live, and see how your average changes across practice sessions.

It runs entirely in the browser as a static site (GitHub Pages friendly) and keeps your data in the browser's local storage.

## Features

- Start a practice session with a date, distance (18, 30, 60 or 72 m), target size (40, 60, 80 or 120 cm), arrows per end (3, 6 or varies) and optional notes. The last setup you used is pre-selected.
- Ends can have any number of arrows. Change the arrows-per-end count at any point during practice, or tap **End done** to close an end early. With "Any", every end stays open until you tap End done.
- Big tap-friendly keypad coloured like a 10-ring indoor face: X, 10–1 and M (miss). X counts as 10 and is tracked separately.
- With a set count, the end fills as you tap and moves on to the next end automatically. Undo removes the last arrow and reopens its end.
- Live session stats: average per arrow, average per end, total, arrows shot, ends shot, 10s and Xs.
- Progress tab with a chart of average arrow score per session, overall stats and a list of all sessions you can reopen or delete. Pick a distance and target size combination at the top to see progress for that setup; only setups you've shot appear.
- Export and import a JSON backup.
- Light / dark mode switch in the header. It follows your device setting until you tap it, then remembers your choice.
- Keyboard scoring on desktop: `x`, `1`–`9`, `0` for 10, `m` for miss, Enter for End done, Backspace to undo.

## Offline use and installing on a phone

After the app has been opened once with an internet connection, it works with no connection: a service worker (`sw.js`) keeps a copy of every app file on the device. When the device is online, the app quietly downloads updates in the background and uses them the next time it opens.

To install it like an app:

- **iPhone / iPad (Safari):** open the site, tap the Share button, then **Add to Home Screen**.
- **Android (Chrome):** open the site, tap the ⋮ menu, then **Install app** (or **Add to Home screen**).

On iPhone, the home-screen app keeps its own data, separate from Safari, so start using it from the home-screen icon. Use Export / Import backup to move existing sessions across.

When changing app files, bump `CACHE` in `sw.js` (and the `?v=` numbers in `index.html` / `js/app.js`) so installed copies pick up the new files.

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

`arrowsPerEnd` is the count used for new ends (0 means ends are closed by hand). Each end stores its own arrows, so ends can differ in length. `endOpen` says whether the last end is still being shot. Sessions without `distanceM` / `targetCm` (saved before setups existed) count as 18m / 40cm.

```json
{
  "id": "uuid",
  "date": "2026-10-10",
  "notes": "18m, 40cm triple spot",
  "distanceM": 18,
  "targetCm": 40,
  "arrowsPerEnd": 3,
  "ends": [["X", "10", "9"], ["10", "9", "8", "7", "9", "10"]],
  "endOpen": false,
  "completed": true,
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```
