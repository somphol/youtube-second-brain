# Local library guide

## First run

```sh
cd ~/Projects/youtube-second-brain
npm install
npm run local
```

Or double-click `Start Second Brain.command`. The browser opens `http://127.0.0.1:9000`. Keep the
Terminal open; `Ctrl+C` stops the server. The library is stored under that exact origin.

## Add links

1. Click the library icon in the header.
2. Paste one or more URLs into the text area.
3. Type a topic. The same topic name groups videos into one cluster.
4. **Add videos**. The local server fetches title, channel and thumbnail; they are stored offline.

Accepted URL shapes: `youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/shorts/…`,
`youtube.com/live/…`, `youtube.com/embed/…`, or a bare 11-character id.

If the server cannot reach YouTube, the link is still saved with a placeholder title (`YouTube video …`)
and the watch URL. You can edit the title and topic later with the pencil icon.

## Import Google Takeout history

1. Open [takeout.google.com](https://takeout.google.com).
2. Deselect all, then choose **YouTube and YouTube Music**.
3. In that product, include **history** and choose **JSON**.
4. Export, download the archive, unzip, locate `watch-history.json`.
5. In the app choose **My library → Import Takeout / JSON**.
6. Pick grouping:
   - **Auto-detect from titles** — recommended; local classifier.
   - **One topic** — everything under a topic you name.
   - **By channel** — top 24 channels, the rest as “Other channels”.
   - **By year watched** — one cluster per year.
7. Import. Re-importing is safe: duplicates are skipped by video id.

Entries without a watch URL (removed/private videos) are skipped. Bulk imports do not store thumbnails.
For an existing library, **Auto-organize titles** re-labels every record and adds tags. It replaces the
current topics, so export a backup first if you care about the old grouping.

## Backups and moving Macs

- **Export backup** writes `my-youtube-library-YYYY-MM-DD.json`.
- On another browser/Mac, open the app and import that file.
- Bookmarks live in `localStorage`; the library lives in IndexedDB. Export is the only complete backup.
- Clearing site data for `127.0.0.1:9000` deletes the library. Export first.

## Privacy

- The local server binds `127.0.0.1` only.
- The only outbound requests are `/api/oembed` and the thumbnail fetch it performs.
- The page itself makes no requests to YouTube; thumbnails are data URLs stored with the record.
- No analytics, cookies, accounts or cloud storage.
- The repository contains no library data.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Library looks empty after changing URL | Origin changed (`localhost` vs `127.0.0.1`, or port). Use the same URL. |
| “No metadata” on add | The local server is not running, or YouTube blocked oEmbed. Open via `npm run local`. |
| Add button does nothing | Check the status line; invalid/duplicate links are rejected. Max 100 links per batch. |
| Import says no new videos | Every record already exists (dedupe by id). |
| Graph is blank | Add at least one video; WebGL may also be unavailable (a list fallback is provided). |
| Browser asks to allow local network | macOS local-network permission for the Terminal/browser. Allow it. |
| Port 9000 in use | `PORT=9010 npm run local`, but the library will be under a new origin. |
