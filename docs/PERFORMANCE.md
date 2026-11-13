# Performance notes

Measured locally on an Apple silicon Mac, Chrome 157, static server on localhost. Numbers are for the shipped 108k corpus; use `npm run verify` and Chrome DevTools to reproduce.

## Payload budget

| Phase | Asset | Transfer | Cost |
| --- | --- | ---: | --- |
| Boot | `manifest.json` | 112 KB | parse < 5 ms |
| Boot | `search_index.json` | 176 KB | MiniSearch load ~ 8 ms |
| Boot | `index.html` | 119 KB | one request, no JS chunk waterfall |
| After paint | `video_index.json` | 12.5 MB (≈ 3 MB gzip on Pages) | streamed, progress shown, cached in IndexedDB |
| Click | one shard | 16–974 KB | median topic ~ 44 KB |

Boot never waits for the title index. The index is scheduled with `requestIdleCallback({ timeout: 2200 })` after `state.ready`, and the test gate asserts `startTime >= __YTB_READY_AT`.

## Virtualization

A 4,604-video shard:

```
row height          92 px
scroll height       423,568 px
viewport            ~700 px
rendered rows       10–14 (including 2 overscan above and below)
DOM nodes           ~60 (rows + buttons)
scroll handler      1 rAF-throttled paint
```

The window is recomputed only when the integer start/end changes. Re-render replaces the innerHTML of the window, not the whole list. Deep-scroll and filter behaviour are verified headlessly (`deep scroll keeps DOM small`, `virtual list renders at most 20 rows`).

Why not `content-visibility` or infinite append? Both still grow the DOM or require sentinel logic. Fixed-height windowing is predictable, works with scrollbar dragging to arbitrary positions, and keeps sort/filter resets simple.

## 3D scene

| Object | Draw calls | Count |
| --- | ---: | ---: |
| Node spheres | 1 (`InstancedMesh`) | 480 |
| Halos | 1 (`Points` + shader) | 480 |
| Edges | 1 (`LineSegments`) | 958 |
| Stars | 1 (`Points`) | 900 |
| Hover/selection rings | 2 | 2 |
| HTML labels | 0 (DOM) | 12 |

Scene cost is roughly constant with topic count: adding topics increases instance count, not draw calls. The browser performs **zero** physics or layout computation; only camera interpolation and 12 label projections run per frame.

Headless Chrome reports 60 FPS after warm-up (`renderer sustains interactive frame rate`). Under software rendering or a busy CPU this can drop; the check threshold is 25 FPS to stay meaningful in CI.

## Search

- **Topic index**: 480+312 documents, in-memory; sub-millisecond queries.
- **Title index**: 108,000 documents, ~12.5 MB JSON, ~57 MB heap for the parsed index (measured in Node with `--expose-gc`). Query time is single-digit milliseconds at this scale.
- **Cross-corpus query cost**: search → group by `k` → fetch at most 4 shards (~200 KB worst case) → render 10 resolved cards. Shards are cached, so repeat queries hit memory.
- **In-shard search**: the first keystroke builds a MiniSearch index over the shard (4,604 docs ≈ 30 ms). Subsequent keystrokes reuse it. Without MiniSearch, substring search is linear over the shard.

## Storage

- `localStorage` payload is a few KB (bookmarks + theme + 6 recents).
- IndexedDB holds 480 shard texts and the title index text. Cached shards are bounded by the corpus (~34 MB); the browser may evict under pressure.
- Re-opening a topic after reload reports `indexeddb` in the drawer header and skips the network entirely (asserted in `verify.mjs`).

## Practical limits

- **Mobile memory**: the 12.5 MB title index is the largest object. On a low-memory phone the tab may reclaim it; the app falls back to topic search and reloads the index on the next idle slot. The 3D graph itself is small.
- **Very large shards**: one shard with 100k videos would still virtualize, but its JSON parse and IndexedDB write would be noticeable. The generator caps at 4,604; keep real shards in the low thousands or split by sub-topic.
- **CDN latency** dominates first paint on cold networks. Assets are pinned but not self-hosted by design; see [DEPLOYMENT.md](DEPLOYMENT.md) for the self-hosting trade-off.
