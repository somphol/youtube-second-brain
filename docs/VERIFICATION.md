# Verification

```sh
npm run verify             # 59 headless Chrome checks (~35 s)
npm run screenshots        # same plus screenshots/
npm run benchmark:build    # optional 100k fixture (~10 s)
npm run benchmark:verify   # 11 fixture checks
```

The browser gate starts its own server on `127.0.0.1:9099`, drives Chrome through `puppeteer-core`, and
exits non-zero on failure. `CHROME_PATH` overrides the macOS default.

## What the 59 checks cover

**Empty boot**
- 0 videos, 0 topics, no WebGL scene, empty state visible.
- No `/data/` request of any kind — there is no shipped corpus.
- Header reports `0 saved`; only the All chip exists.
- Document title describes a personal library.

**Manual import**
- 3 records import, 2 topic clusters, graph created, empty state hidden.
- Header and legend update; All + 2 topic chips.
- Drawer opens with the 2 videos, source `local`, no `/shards/` request.

**Search**
- A library query resolves the right title and opens the panel.
- The panel reports local mode.

**Persistence**
- Bookmark writes to localStorage and updates the badge; saved drawer shows it.
- Theme and library survive a reload; topics rebuild; the drawer still opens locally.

**Scale (5,000 videos in one topic)**
- Import succeeds; the drawer reports 5,000 rows.
- Source is `local`; DOM remains ≤ 20 rows at the top.
- Deep scroll to row 3,200 keeps ≤ 20 rows, the first visible index changes, scroll height > 400,000 px.
- Search finds a title after the idle MiniSearch build.

**Takeout**
- Removed/private entries without a URL are skipped (3 of 4).
- Re-import adds nothing (dedupe by id).
- Year grouping creates `2022`/`2023` topics.
- Channel grouping creates channel topics.

**Mobile**
- 390 × 844 has no horizontal overflow and a usable empty state.
- Drawer is exactly 390 × 844, ≤ 20 rows, no overflow.

**Hygiene**
- Static assets (manifest, icon, 404, robots, sitemap) return 200.
- Zero page errors, zero console errors, zero failed requests.

## Benchmark fixture (optional)

`npm run benchmark:build` writes a gitignored `benchmark/library-100k.json` with 100,000 synthetic
records across 480 topics. `npm run benchmark:verify` asserts 100k count, unique ids/titles, valid dates,
≥ 400 topics, a topic with ≥ 2,000 videos, and a file > 10 MB.

It is **not** loaded by the app or committed. Import it manually to reproduce the capacity numbers in
[SCALING.md](SCALING.md).

## Screenshots

```
screenshots/desktop-empty.jpg    1440×900, first run
screenshots/desktop-graph.jpg    1440×900 after a 10-record import
screenshots/desktop-drawer.jpg   1440×900 topic drawer, graph pushed aside
screenshots/desktop-library.jpg  1440×900 import panel
screenshots/desktop-light.jpg    1440×900 light theme
screenshots/desktop-search.jpg   1440×900 search results
screenshots/mobile-graph.jpg     390×844
screenshots/mobile-drawer.jpg    390×844
screenshots/og-cover.png         1200×630 social card
```

The screenshot script uses an incognito context, clears storage, and imports a small set of real,
well-known video links for illustration only. Those records are not shipped.

## Manual checklist

1. Paste one link and confirm the thumbnail appears; add the same link again and confirm it is rejected.
2. Import a Takeout file with 1,000+ entries and watch the progress/status line.
3. Switch grouping and re-import to a clean library; compare clusters.
4. Scroll a large topic with the scrollbar and trackpad; the scrollbar spans the full list.
5. Bookmark a record, reload, open Saved; the row is still there.
6. Switch theme; reload; the theme persists.
7. Resize to 390 px; the drawer becomes a full-screen sheet.
8. Stop the server and use the app: existing records still render; adding new links falls back to
   placeholders.
9. Export a backup, clear the library, import the backup.
10. Run with WebGL disabled; Browse still lists topics.

## Known test limitations

- FPS is measured headless; software rendering can lower it. The threshold is lenient.
- The 100k import is not part of the routine gate (too heavy); the gate proves 5,000 rows and the
  optional fixture proves 100k.
- Screenshot records are illustrative and depend on public YouTube thumbnails being reachable when the
  screenshots are regenerated.
