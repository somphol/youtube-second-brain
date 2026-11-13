# Architecture

## Shape

One HTML file, one local server, zero runtime packages. `index.html` contains the design tokens, the
semantic shell and one inline ES module organised into numbered sections:

```
1. constants + formatting     2b. local library import
2. persistence                3. local data layer
4. 3D graph                   5. drawer + virtual list
6. search                     7. chrome / theme / keyboard
8. boot
```

There is no bundler, no `app.js`, no data fetch and no build step to deploy. Three.js and MiniSearch load
from pinned CDNs; Tailwind is present for the shell but the layout does not depend on it.

## Boot

```
loadStore()                       theme, bookmarks, recents from localStorage
setTheme()
loadLibrary()                     IndexedDB → { videos }
buildPersonalDataset()            topics, coords, edges, in-memory payloads
activateDataset()                 graph (if any topics), chrome, search index
state.ready = true
routeFromHash()
```

No network request is made at boot. With an empty library, the stage shows the empty-state card and the
library button; the graph is not created until the first record exists.

## Adding a link

```
user pastes URLs → parseYouTubeId()
  → GET /api/oembed?id=<id>          local server only
      → youtube.com/oembed           title, author_name
      → i.ytimg.com/.../mqdefault    thumbnail → data URL
  → normaliseRecord()
  → mergeLibraryRecords()            dedupe by id
  → saveLibrary()                    IndexedDB, awaited
  → buildPersonalDataset()
  → activateDataset()                rebuild graph, reschedule search index
```

If `/api/oembed` is missing (static hosting) or fails, the record is still saved with a placeholder title
and the watch URL. The UI reports how many were added without metadata.

## Importing history

`importLibraryFile()` reads the selected file with `File.text()`, limits it to 120 MB, detects a Takeout
array vs. an exported backup, and calls `takeoutToRecords()` with the chosen grouping. The file never
leaves the tab. Merge, save, rebuild and repaint follow the same path as manual adds.

## 3D graph (local)

- **Nodes**: one `InstancedMesh` sphere per topic. Radius `0.34 + 0.24 * ln(count + 1)`, colour from the
  topic hue. No per-video nodes.
- **Layout**: ring for ≤ 6 topics; Fibonacci sphere for more. Computed in `buildPersonalDataset()`.
- **Edges**: two nearest neighbours per topic, one `LineSegments` buffer.
- **Halos**: one `Points` cloud with a custom shader (`aSize`, `aColor`, `aAlpha`).
- **Labels**: HTML pills above each topic (up to 24; top 12 by count above that), projected per frame.
  Category labels are not used in the personal graph.
- **Interaction**: hand-written orbit/zoom/pinch; camera-facing torus rings for hover/selection; raycast
  on `instanceId`; clicks open the drawer.
- **Empty**: no graph object at all; CSS stage + empty card.

The scene cost grows with topics, not videos. 480 topics is the tested upper bound (100k benchmark).

## Drawer and virtualization

The only scroller is `#drawerScroll`, containing a spacer and a translated window:

```
start = max(0, floor(scrollTop / rowH) - 2)
end   = min(total, ceil((scrollTop + viewport) / rowH) + 2)
```

Rows are re-serialised only when the integer window changes. `--row-h` is 92 px desktop / 88 px mobile.
5,000 rows and 3,765 rows were both verified at ≤ 20 DOM nodes after deep scrolling. A 100k single-topic
library would have a scroll height of ~9.2 million pixels but still ~11 rows.

Drawer modes: `topic` (in-memory payload), `saved` (bookmark records), `topics` (all topics). Each has
its own filter/sort path and empty state. Per-topic search uses a lazy MiniSearch index over that topic.

## Search

- **Topic search**: substring over topic names (`searchTopics`).
- **Video search**: MiniSearch over `title`, `channel`, `topicName` when ready; substring over the same
  fields before that. The index is built in `requestIdleCallback` for libraries above 2,000 records;
  smaller libraries build it immediately.
- Results cap at 10; topic results cap at 5. Clicking a result opens the topic, optionally scrolling to
  the video id.
- `searchStatus` (`idle | pending | ready | error`) drives the panel copy; there is no network index.

## Persistence

- **IndexedDB** is the source of truth for records. `saveLibrary()` awaits the write.
- **localStorage** holds preferences and bookmark snapshots. Bookmarks include enough fields to render
  without the library.
- **Export/import** is the migration path between browsers and Macs.
- The origin is part of the storage key: `127.0.0.1:9000` and `localhost:9000` do not share a library.

## Local server

`scripts/serve.mjs`:

- binds `127.0.0.1` by default (never LAN);
- serves static files with correct MIME and no-store caching;
- exposes `/api/oembed?id=<11-char-id>` only; validates the id, fetches a fixed YouTube oEmbed URL and
  the fixed `i.ytimg.com` thumbnail path, caps the image at 900 KB, caches results in memory, and
  returns JSON. It is not a general proxy.
- `--host 0.0.0.0` exists for deliberate LAN use; `--open` launches the browser.

## Failure modes

| Failure | Behaviour |
| --- | --- |
| No library | Empty state with Add / Import actions. |
| `file://` | Boot explains that a server is required. |
| oEmbed fails / static host | Records saved with placeholder titles; status message reports it. |
| Thumbnail fails | Procedural gradient poster. |
| IndexedDB blocked/full | Import throws with a status message; existing data unchanged. |
| localStorage full | Toast; in-memory bookmarks still work for the session. |
| MiniSearch CDN blocked | Substring search; no index. |
| WebGL unavailable | Graph fallback panel; library/drawer/search still work. |
| Malformed JSON import | Status error; nothing written. |
