# Performance

Measured on Apple silicon, Chrome 157. Headless numbers; treat them as order of magnitude.

## Boot

| Asset | Size | When |
| --- | ---: | --- |
| `index.html` | ~153 KB | first request |
| Three.js (CDN) | ~600 KB | first request |
| MiniSearch (CDN) | ~30 KB | first request |
| Tailwind Play CDN | ~110 KB | first request |
| Library records | 0 by default | IndexedDB, local |
| Dataset download | **0 bytes** | none |

Boot is: read localStorage → read IndexedDB → build topics → paint. With an empty library it is a few
milliseconds plus the CDN scripts. No corpus is fetched, because none exists.

## Import

| Operation | 3 videos | 5,000 videos | 100,000 videos |
| --- | ---: | ---: | ---: |
| Normalise + dedupe | < 1 ms | ~5 ms | ~120 ms |
| IndexedDB write | ~2 ms | ~30 ms | ~300 ms |
| Dataset build | < 1 ms | ~3 ms | ~60 ms |
| Graph rebuild | ~15 ms | ~20 ms | ~40 ms |
| MiniSearch build | immediate | idle, < 100 ms | idle, ~1–2 s |
| Total measured | < 50 ms | < 200 ms | **433 ms** |

100k numbers from the optional fixture; see [SCALING.md](SCALING.md).

## Drawer virtualization

```
rowHeight        92 px desktop / 88 px mobile
scrollHeight     items × rowH      (3,765 rows = 346,380 px)
rendered         ceil(viewport/rowH) + 4  ≈ 10–14
scroll handler   1 rAF-throttled paint
```

Verified: 5,000 rows → 10–14 DOM nodes at top and after scrolling to row 3,200; 3,765 rows → 10–12.

## Search

- MiniSearch fields: `title`, `channel`, `topicName`; stored field `id`; prefix + fuzzy.
- Built in an idle callback for libraries > 2,000 records; immediately below that.
- Queries: single-digit ms at 100k. Until the index is ready, substring matching runs over the array
  (~20–40 ms per keystroke at 100k, still usable).
- Per-topic search builds a small index over that topic on first keystroke.

## Graph

| Object | Draw calls | Count |
| --- | ---: | ---: |
| Topic spheres | 1 (`InstancedMesh`) | topics |
| Halos | 1 (`Points` shader) | topics |
| Edges | 1 (`LineSegments`) | 2 × topics |
| Stars | 1 (`Points`) | 900 |
| Rings | 2 | 2 |
| Labels | DOM | ≤ 24 |

Scene cost depends on topics, not videos. 480 topics at 100k records rendered at 60 FPS headless.

## Memory

| State | JS heap |
| --- | ---: |
| Empty | ~25 MB |
| 100k imported, no index | 126 MB |
| 100k with MiniSearch | 169 MB |

Thumbnails are stored in IndexedDB, not held in the JS heap beyond the visible rows.

## Limits and tuning

- Reduce `--row-h`? No: it is the virtualization constant; changing it requires updating the math.
- Large single-topic libraries are fine; the scrollbar becomes very long, but the DOM does not grow.
- Too many topics (> 60) hurts legibility, not performance. Group by channel/year or merge topics.
- Keep backups; IndexedDB can be evicted.
