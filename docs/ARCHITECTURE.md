# Architecture

## Shape of the app

One HTML file, one static data directory, no server logic. `index.html` contains:

1. **Design tokens and CSS** — the visual system, all responsive rules.
2. **Semantic shell** — header, filter bar, stage, drawer, boot screen, toasts.
3. **Classic scripts** — Tailwind CDN, MiniSearch UMD, a 12 s boot watchdog.
4. **One ES module** — the entire runtime, organised into eight labelled sections:

```
1. constants + formatting     9. persistence
2. (formatting helpers)      10. data layer
3. (debug surface)           11. 3D graph
4. persistence               12. drawer + virtual list
5. data layer                13. search
6. 3D graph                  14. chrome / theme / keyboard
7. drawer + virtual list     15. boot
8. search                    16. test hooks
```

Search for the section banner comments (`/* --- 4. 3D graph --- */`) when editing. There is no bundler, transpiler or minifier. The file is intentionally readable and diff-able.

## Boot sequence

```
document parse
  → CSS paints boot screen (server-rendered, no JS needed)
  → importmap resolves three from unpkg
  → module executes init()
      loadStore()                    localStorage: theme, bookmarks, recents
      setTheme()                     apply before first paint of the shell
      fetch data/manifest.json       ~112 KB
      fetch data/search_index.json   ~176 KB, MiniSearch.loadJSON
      paint header counters, chips, legend, onboarding
      new KnowledgeGraph()           WebGL scene, 480 instances, edges, halos
      state.ready = true
      hide boot screen
      routeFromHash()                #/topic/... or #/saved
      requestIdleCallback(loadVideoIndex)
```

If `fetch` fails (opened with `file://`), the boot card explains the failure instead of spinning. If Three.js fails to load, a 12 s watchdog writes a CDN-specific message into the same card.

## Data flow on a topic click

```
node click / search result / deep link
  → openDrawer('topic', { topicId, focusId? })
  → getShard(topic)
       memory cache?      → instant
       IndexedDB?         → parse, populate memory
       else fetch(data/shards/<id>.json)
           → JSON.parse, validate videos[], cache in memory + IndexedDB
  → ensureShardIndex(shard)   (only when the user types)
  → filteredTopicVideos()     (query · savedOnly · sort)
  → virtual list setItems()
```

The drawer header shows which path was taken (`fetched`, `indexeddb`, `in memory`), the elapsed milliseconds, and the shard size. This is diagnostic UI, not decoration: it makes lazy loading observable.

## 3D graph

- **Coordinates** are baked into the manifest by `scripts/build-data.mjs`. Each of the 12 categories gets a Fibonacci-sphere centre at radius 7.4; its 40 topics scatter inside a 0.55–2.6 radius cloud. Nothing moves on open except the camera.
- **Nodes** are a single `THREE.InstancedMesh` (480 instances, one draw call). Sphere radius is `0.12 + 0.2 * ln(count / 60)`, computed at build time. Per-instance colour comes from the category hue.
- **Halos** are one `THREE.Points` cloud with a custom shader (`aSize`, `aColor`, `aAlpha`); additive blending, depth write off.
- **Edges** are one `LineSegments` buffer built from 958 manifest links (3 nearest neighbours per topic plus 12 cross-category bridges).
- **Pick/hover** uses `Raycaster.intersectObject(instancedMesh)` and `instanceId`. Hovering draws a camera-facing torus and an HTML tooltip; clicking opens the drawer.
- **Labels** are 12 HTML pills projected from category centres every frame. They stay crisp, are clickable, and cost 12 transforms per frame.
- **Controls** are hand-written spherical orbit: drag rotates, wheel/pinch zooms, double-click resets, buttons expose zoom/reset. Auto-rotate resumes after 9 s of no interaction and is disabled under `prefers-reduced-motion`.
- **Filtering** dims non-active instances (colour × dark multiplier, 0.82 scale, halo alpha 0.02), fades edges, and mutes labels. Selecting a category also aims the camera at that cluster's centre.

No post-processing, no external HDRIs, no textures. The glow texture is procedural in the shader.

## Drawer and virtualization

`state.drawer` is the single source of truth:

```js
{ mode, topic, shard, items, query, sort, savedOnly,
  loading, error, source, bytes, ms, focusId }
```

The list uses a three-element structure:

```html
<div id="drawerScroll">          <!-- the only scroller -->
  <div class="vlist">
    <div class="vlist-spacer"></div>          <!-- height = items × rowHeight -->
    <div class="vlist-window"></div>          <!-- translateY(start × rowHeight) -->
  </div>
</div>
```

On scroll (throttled to one `requestAnimationFrame`), the visible window is recomputed:

```
start = max(0, floor(scrollTop / rowH) - 2)
end   = min(total, ceil((scrollTop + viewport) / rowH) + 2)
```

Only those rows are serialised into `innerHTML`. With a 92 px row and a ~700 px viewport that is 10–12 rows, plus 4 overscan. A 4,604-row shard scrolls to `scrollHeight ≈ 423,568 px` while the DOM stays at 10–14 `.vrow` nodes. `--row-h` is read from computed style, so the mobile breakpoint (88 px) stays correct.

Rebuild triggers: query, sort, saved-only, bookmark toggle (saved mode), resize. Scroll position resets on filter changes and centres on `focusId` when a deep link targets a specific video.

## Search design

Two MiniSearch instances with different lifetimes:

| Index | Built | Fields | Stored | Size |
| --- | --- | --- | --- | --- |
| `search_index.json` | build time | `name`, `categoryName` | type, name, category, count, slug | 176 KB |
| `video_index.json` | build time | `t` (title) | `k` (topic index), `n` (position in sorted shard) | 12.5 MB |
| shard index | lazy per shard | `title`, `channel` | `id` | memory only |

The global title index stores only two integers per document. Titles live in shards, so resolving a result means fetching the shards for the top matches (max 4 per query) and indexing into `shard.videos[n]`. This keeps the boot payload small and avoids duplicating 108k titles in the index.

If MiniSearch is unavailable, the topic index degrades to `fallbackSearch()` (substring over 480 topics) and shard search degrades to title/channel substring matching.

## State and persistence

`localStorage['yt-second-brain:v1']`:

```json
{
  "version": 1,
  "theme": "dark",
  "bookmarks": {
    "<videoId>": { "id": "...", "title": "...", "channel": "...", "topicId": "...", "topicName": "...", "savedAt": 0 }
  },
  "recent": ["transformer_architecture"],
  "savedAt": "2026-11-13T09:00:00.000Z"
}
```

Bookmarks store enough to render and reopen the topic without a network request. Writes are synchronous (the payload is tiny) so a fast reload never loses a star.

`IndexedDB['yt-second-brain']` has two stores: `shards` (keyed by topic id, raw JSON text) and `assets` (the streamed title index). Failures degrade silently to network fetches. `__YTB.clearCaches()` clears both stores and localStorage for testing.

## Routing

Hash-based, `history.replaceState` only:

- `#/topic/<id>` — open a topic
- `#/topic/<id>?v=<videoId>` — open and centre a video row
- `#/saved` — open the saved drawer

Closing the drawer clears the hash. The `hashchange` listener routes only after boot, so back/forward and pasted links work. Unknown ids are ignored rather than crashing.

## Failure modes

| Failure | Behaviour |
| --- | --- |
| `file://` | Boot card: serve over HTTP. |
| CDN Three.js blocked | Watchdog message; no graph. |
| CDN MiniSearch blocked | Substring search for topics and shards. |
| WebGL unavailable | Cooked `try/catch`, browse-list fallback. |
| Shard 404 | Inline error card with retry; other topics unaffected. |
| IndexedDB blocked | Every shard fetched from network; app still works. |
| localStorage full | Toast warning; in-memory bookmarks still work for the session. |
| Corrupt stored JSON | Ignored; clean defaults. |
