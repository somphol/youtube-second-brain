# Agent notes — Second Brain

## What it is

A local-first, single-page app that maps **your own** YouTube library in 3D. Videos are added by URL or
imported from Google Takeout; records and thumbnails live in IndexedDB on the Mac, and nothing is
uploaded. The app starts empty and ships **no corpus**. It is not a downloader, scraper or OAuth client,
and watch history cannot be fetched programmatically.

The design must stay smooth at 100,000 videos: windowed lists, in-memory search index, topics (not
videos) as graph nodes.

## Commands

```sh
npm run local                 # 127.0.0.1:9000 + open browser (double-click .command also works)
npm run serve                 # same, no auto-open
npm run verify                # 59 headless Chrome checks — release gate
npm run screenshots           # regenerate screenshots/ (includes the OG card)
npm run benchmark:build       # optional 100k fixture → benchmark/library-100k.json (gitignored)
npm run benchmark:verify      # 11 fixture checks
CHROME_PATH=/path/to/chrome npm run verify
```

Node 20+; `npm install` installs only `puppeteer-core` for the gate. Deploy: push `main`; Pages workflow
publishes the repo root. First time: **Settings → Pages → Source: GitHub Actions**.

## Architecture

- `index.html` — the whole app: CSS tokens → shell → one inline ES module. Navigate by the numbered
  section banners (`/* --- 2b. local library --- */`, `/* --- 4. 3D graph --- */`, …). There is no
  `app.js`, no bundler and no runtime npm dependency.
- `scripts/serve.mjs` — static server bound to `127.0.0.1` **plus** `/api/oembed?id=<11-char-id>`, which
  fetches public oEmbed metadata and the `mqdefault` thumbnail server-side, returning the image as a
  data URL. This endpoint exists only locally.
- **Library pipeline**: import → `normaliseRecord` → `mergeLibraryRecords` (dedupe by video id) →
  `saveLibrary` (IndexedDB `library`) → `buildPersonalDataset` (topics, coordinates, edges) →
  `activateDataset` (graph rebuild, search index scheduled).
- **Persistence**: IndexedDB `yt-second-brain` → `library` (one record keyed `collection`), plus legacy
  `shards`/`assets` stores. `localStorage['yt-second-brain:v1']` holds theme, bookmarks and recents.
- **Graph**: `InstancedMesh` for topic spheres, one `Points` shader for halos, one `LineSegments` for
  links, HTML labels projected per frame. Coordinates are generated from topic counts in the browser
  (ring for ≤ 6 topics, Fibonacci sphere above).
- **Drawer**: fixed-height virtual list (`spacer` + translated `window`); `topic.__shard` is an in-memory
  payload with `{videos}`. No shard is fetched over the network.
- **Classifier**: `classifyTitle()` in the inline module is a local regex taxonomy (39 topics +
  entities). It returns `{ topic, tags }`; imports use `auto` grouping by default and `autoOrganizeAll()`
  re-labels an existing library. No network, no model.
- **Search**: `searchTopics` filters topic names; `schedulePersonalIndex` builds a MiniSearch index over
  the library in an idle slot (deferred above 2,000 records) and `runSearch` uses it, falling back to
  substring matching until ready.
- **Local server proxy** is the only outbound metadata path. Takeout import is pure client-side parsing.

## Decisions and constraints

- **No seeded videos.** Do not add a demo corpus, sample data or a "load 100k" default. The empty state
  is the product. The benchmark fixture is gitignored and opt-in.
- **Never add Google auth, cookie import or history scraping.** Takeout JSON is the only history path.
- **Topic ids are derived from topic names** (`lib_<slug>`), and are used in hashes and bookmarks.
  Renaming a topic changes its id; that is acceptable but should be documented in the UI.
- **The library is origin-bound.** `127.0.0.1:9000` ≠ `localhost:9000` ≠ another port. Keep the default.
- **`/api/oembed` must stay narrow**: 11-char id validation, fixed YouTube hosts, no arbitrary URL proxy.
- **Meta values for imported links are unknown.** Do not invent duration/views; `0` renders as absent.
- **Virtualization math depends on `--row-h`.** Keep rendered `.vrow` count ≤ 20 and test deep scroll.
- **All data-derived strings are escaped** before HTML interpolation.
- **Auto-organize is destructive**: it replaces every `topicName`. Keep the confirm dialog and never run
  it on boot. Tags are additive and searchable.
- **Do not reintroduce `data/` fetches.** The gate asserts no `/data/` request on boot.
- **The 100k benchmark is synthetic and labelled.** Never commit `benchmark/` or present it as real
  history.

## Known issues

- oEmbed requires the local server; static hosting saves URL-only records.
- Imported links have no duration/views; Takeout has no duration/views either.
- 100k import uses ~130–170 MB of tab memory with the search index warm.
- Bulk imports skip thumbnails to avoid hundreds of MB of image data.
- IndexedDB is per-origin; changing port/host makes the library look empty.
- Clearing site data deletes the library; users must export a JSON backup.
- The gate's FPS check is lenient under headless software rendering.

## Continuity

- Local source of truth: `/Users/somphol/Projects/youtube-second-brain`
- Repository: https://github.com/somphol/youtube-second-brain
- Live (empty library, per visitor): https://somphol.github.io/youtube-second-brain/
- Provenance: `state.json`, `STATE.md`
- Skill: `~/.config/opencode/skills/youtube-second-brain-studio`
- Kitchen-table demo URLs live only in `screenshots/`; they are not seeded data.

Never record secrets, tokens, cookies, credentials or personal watch history in this repository.
