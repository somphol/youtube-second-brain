# Verification

Two gates, both dependency-light, both deterministic.

```sh
npm install
npm run verify:data   # 67,990 corpus checks, ~25 s
npm run verify        # 63 browser checks, ~40 s
npm run screenshots   # same as verify --shots
```

The browser gate starts its own server (`scripts/serve.mjs`), launches Chrome headless via `puppeteer-core`, and exits non-zero on any failure. Set `CHROME_PATH` if Chrome is not at the default macOS location.

## Data gate

`scripts/verify-data.mjs` re-reads every file from disk and checks:

- 108,000 videos, 480 topics, 12 categories, 40 topics per category.
- Manifest totals equal the sum of topic and category counts.
- Every shard exists, parses, declares the right id/name/category, and has `videos.length === count`.
- Every one of the 108,000 video ids is unique across all shards.
- Titles, channels, ids, durations, views and dates are well-formed (sampled fields on every shard, ids exhaustive).
- Coordinates are finite and bounded; radii are in range; edges reference valid, distinct topics with sane weights.
- The keyword index loads and answers `transformer`, `retrieval` and `labs` (channel test).
- The video index reports 108,000 documents, finds `transformer`, and sampled `(k, n)` positions resolve to a real video.
- Size budgets: manifest < 300 KB, keyword index < 600 KB; digest and seed are recorded.
- The largest shard holds at least 3,000 videos (proves the virtualization case is real).

Failure output lists the first 30 problems with the topic id that broke.

## Browser gate

`scripts/verify.mjs` drives the real app. Current coverage (63 checks):

**Boot and data**
- 108,000 videos, 480 topics, 958 edges reported by the running app.
- WebGL context created and FPS ≥ 25 after warm-up.
- Manifest and keyword index fetched; no shard fetched before interaction.
- The title index request starts at or after `__YTB_READY_AT` (after first paint).
- Header, document title, canvas size and 13 chips are correct.

**Lazy loading**
- Clicking a node fetches exactly one shard and reports `network`.
- 4,604 items in the drawer, ≤ 20 rendered rows.
- Deep scroll keeps ≤ 20 rows and moves the window (first visible index changes).
- Scroll height is > 400,000 px, proving the full list is addressable.

**Search**
- In-shard search narrows 4,604 to a smaller set while staying virtualized.
- Global search returns topic matches and resolves real video titles from shards.
- The panel is open, clickable, and video results carry their topic.

**Persistence**
- Starring writes one record to `localStorage` and updates the badge.
- After reload: theme and bookmark survive; the topic shard is served from IndexedDB.
- Saved drawer shows exactly the bookmarked row.

**Navigation and layout**
- Category chip and legend highlight, 11 labels muted, reset restores.
- Browse lists all 480 topics, virtualized, and filters by name.
- `/` focuses search; `Esc` closes the drawer.
- `#/topic/self_attention` opens the right shard.
- 390 × 844: no horizontal overflow, canvas present, drawer exactly 390 × 844, ≤ 20 rows.
- Required static assets (`manifest.webmanifest`, icon, 404, robots, sitemap) return 200.

**Hygiene**
- Zero page errors, zero console errors, zero failed requests.

Screenshots, when requested:

```
screenshots/desktop-graph.jpg    1440×900 dark, clean state
screenshots/desktop-drawer.jpg   1440×900 drawer with real rows
screenshots/desktop-browse.jpg   1440×900 all-topics list
screenshots/desktop-light.jpg    1440×900 light theme
screenshots/desktop-search.jpg   1440×900 global search panel
screenshots/mobile-graph.jpg     390×844
screenshots/mobile-drawer.jpg    390×844
screenshots/og-cover.png         1200×630 social card
```

## Manual checklist

Some things are better judged by a human:

1. Drag, wheel and pinch feel damped, not jerky; auto-rotate resumes after ~9 s.
2. Hovering a node shows the tooltip and ring; clicking empty space does nothing.
3. 4,604-row scroll is smooth with the scrollbar and trackpad.
4. Theme switch keeps the graph readable in both modes.
5. Tab through the drawer: focus cycles inside, closes on Esc, returns to the opener.
6. Enable "reduce motion" in the OS: auto-rotation and ring pulses stop.
7. Disable WebGL (`chrome://flags` → WebGL off) and confirm the Browse fallback.
8. Throttle to Slow 3G: boot still paints before the 12 MB title index arrives.

## Known test limitations

- FPS is measured under headless Chrome; software rendering can dip below the 25 FPS threshold. That is an environment signal, not a data bug.
- The video-index position contract is sampled (5 documents), not exhaustively verified, because exhaustively loading 480 shards to check 108k positions would take minutes. A mismatch would surface as a wrong card, never a crash.
- Screenshots are generated in a shared browser profile; the script clears localStorage and IndexedDB first so badges and cache states are clean.
