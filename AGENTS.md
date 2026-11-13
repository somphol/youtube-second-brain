# Agent notes — YouTube Second Brain 100k

## What it is

A static single-page app that maps 108,000 **synthetic** YouTube-style videos across 480 topics into
a pre-computed 3D graph. Topic clicks lazy-load one JSON shard; a virtualized drawer renders 10–14
rows at a time; bookmarks live in localStorage. It is not a YouTube client or scraper, and no backend
exists. Everything the browser needs is `index.html` + `data/`.

## Commands

```sh
python3 -m http.server 8080   # or: npm run serve  (port 9000, PORT=… to change)
npm install                   # dev only: minisearch 7.2.0, puppeteer-core 24
npm run build:data            # rewrite data/ deterministically (seed 20261113)
npm run verify:data           # 67,990 corpus checks — run before every data change
npm run verify                # 63 headless Chrome checks — release gate
npm run verify -- --shots     # also regenerate screenshots/ (includes 1200×630 OG card)
CHROME_PATH=/path/to/chrome npm run verify   # non-macOS Chrome location
```

Deploy: push `main`; `.github/workflows/pages.yml` publishes the repo root. Pages source must be
**GitHub Actions** (set once in Settings). No build command, no secrets.

## Architecture

- `index.html` — the whole app: CSS tokens → shell markup → Tailwind/MiniSearch CDN scripts → one
  inline ES module. Find edits by the section banners (`/* --- 4. 3D graph --- */`, etc.). There is no
  `app.js`; do not reintroduce a build step.
- `data/manifest.json` — 480 topics with `pos:[x,y,z]`, `radius`, `count`, shard path; 12 categories;
  958 edges. Boot asset.
- `data/search_index.json` — prebuilt MiniSearch over topics + channels. Boot asset.
- `data/video_index.json` — prebuilt MiniSearch over all 108k titles; stores only `(k,n)` positions.
  Loaded after first paint and cached in IndexedDB.
- `data/shards/<topic>.json` — videos for one topic, sorted newest first. Fetched on demand.
- `scripts/build-data.mjs` + `scripts/taxonomy.mjs` — the only source of the corpus.
- `scripts/verify*.mjs` — the truth. If behaviour changes, change the gate in the same commit.

## Decisions and constraints

- **The corpus is synthetic and must stay labelled.** `manifest.synthetic` and each shard's
  `synthetic:true` are part of the contract. Links intentionally go to YouTube **search**, not to
  unverified video ids. Replacing the corpus with real data requires updating the disclosure and
  `youtubeSearchUrl()`.
- **Shard order is load-bearing.** `video_index.json` stores `(k,n)` where `n` is the position in the
  sorted shard. Re-sort a shard without rebuilding the title index and search opens the wrong video.
- **Boot must not fetch the title index or any shard.** `verify` asserts both. Keep the
  `requestIdleCallback` deferral and the 112 KB / 176 KB boot budget.
- **Virtualization is fixed-height.** `--row-h` is read from computed style; rows must not rely on
  margins that escape the box. Keep rendered `.vrow` count ≤ 20.
- **Coordinates are baked at build time.** Do not add a force simulation. If you change layout,
  regenerate and rerun both gates.
- **Persisted schema is `yt-second-brain:v1`** with `version:1`. Bookmarks store enough data to render
  without a shard fetch. Keep old keys readable.
- **Hash routing uses `replaceState`.** `#/topic/<id>`, `#/topic/<id>?v=<videoId>`, `#/saved`.
- **CDNs are pinned.** Three 0.180.0, MiniSearch 7.2.0, Tailwind 3.4.17. Tailwind is present for the
  brief but is not the layout source; removing its two tags does not change layout.
- **No tracking, no external fonts, no stock images.** Posters, icons and the OG card are procedural.

## Known issues

- The 12.5 MB title index is heavy on low-memory phones; it is deferred and cached, but a cold load
  costs ~3 MB gzipped. Shrinking it means dropping global title search or sharding the index further.
- FPS assertions are environment-sensitive under software rendering (threshold is 25, not 60).
- Title-index position resolution is sampled in `verify:data`, not exhaustive.
- The demo GitHub Pages deployment has no custom 404 for client-side topic URLs; hash routing means
  no server round-trip, so this is intentional.
- `screenshots/og-cover.png` is a live capture, not a composed asset; regenerate it with `--shots`.

## Continuity

- Local source of truth: `/Users/somphol/Projects/youtube-second-brain`
- Repository: https://github.com/somphol/youtube-second-brain
- Live: https://somphol.github.io/youtube-second-brain/
- Build provenance, elapsed time, tokens and model: `state.json` and `STATE.md`.
- Reusable skill: `~/.config/opencode/skills/youtube-second-brain-studio` (backup repo linked there).

Do not record secrets, tokens or credentials in this repository.
