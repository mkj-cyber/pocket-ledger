# Pocket Ledger

A small phone app for logging spending and money lent to friends.

- **Works offline.** Everything is saved on the phone first; the app itself is stored on the phone by a service worker.
- **Backs up to Google Sheets.** Changes wait in an outbox and are sent to a Google Apps Script web app whenever the phone is online.
- **Install it** from Chrome on Android: open the site, then tap **Install** (or ⋮ → Add to Home screen).

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app: layout, styles and code |
| `sw.js` | Service worker that keeps the app working offline (bump `VERSION` on every change) |
| `manifest.webmanifest` | Name, colours and icons used when installed |
| `icon-*.png` | App icons |

The Google Apps Script that receives the backup lives in the Google Sheet itself (Extensions → Apps Script), not in this repository, because it holds the private sync key.

## Quick changes

At the top of the `<script>` in `index.html`:

- `CUR` — the currency sign
- `CATS` — category names and colours
