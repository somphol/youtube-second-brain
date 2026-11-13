# Scaling to 100,000 videos

The app ships **no videos**. This document is the capacity contract: how the UI behaves as a library
grows, and how to reproduce the 100k check yourself.

## Design levers

| Lever | Behaviour |
| --- | --- |
| Topics, not videos, are nodes | 100k videos grouped into 480 topics → 480 spheres; one topic → one sphere |
| Fixed-height virtualization | DOM rows = `ceil(viewport / rowH) + overscan`, independent of item count |
| IndexedDB array | One record per video, ~200 bytes + optional thumbnail |
| MiniSearch | In-memory index over titles/channels/topics, built after import |
| Takeout grouping | Years/channels keep lists and clusters legible |
| No boot data | Nothing is downloaded until you import |

## Measured fixture

Generated with `npm run benchmark:build` (100,000 synthetic records, 480 topics, largest topic 3,765)
and imported through the real in-app path. Headless Chrome 157 on Apple silicon:

| Measurement | Result |
| --- | --- |
| Import + normalise + IndexedDB write | **433 ms** |
| Records / topics / edges | 100,000 / 480 / 510 |
| Renderer | 60 FPS |
| Largest topic drawer | 3,765 items, 10 DOM rows |
| Deep-scroll window | 12 rows at mid-list |
| Drawer scroll height | 346,380 px |
| Search index | ready, 10 results for a query |
| JS heap after import | 126 MB |
| JS heap with title index | 169 MB |
| Console/page errors | 0 |

These are headless numbers; a real Mac with a visible window may differ. They are recorded to show
order of magnitude, not a guarantee.

## Why the UI stays bounded

```
scrollHeight = items × 92px          // can be millions of px
rendered rows = ceil(viewport/92) + 4 // ~10–14
```

Search is the only operation that touches every record; MiniSearch compiles the corpus once, in an idle
slot, and queries are sub-millisecond at this size. The graph never iterates videos — it uses the
precomputed topic list.

## Reproduce

```sh
npm run benchmark:build
npm run benchmark:verify
npm run local
# My library → Import Takeout / JSON → benchmark/library-100k.json
```

The fixture is gitignored and labelled synthetic. It is not fetched by the app; importing it is a manual
capacity test. Delete it when done (or `Clear library` in the UI).

## Practical limits

- **Memory**: ~130–170 MB with 100k records and the search index warm. Older iPads/low-RAM phones may
  reclaim the tab; the index rebuilds on demand.
- **IndexedDB quota**: browsers allow hundreds of MB to GBs per origin, but can evict under pressure.
  Export a JSON backup.
- **Thumbnails**: bulk imports skip them deliberately. 100k thumbnails at ~20 KB would add ~2 GB.
- **Graph readability**: more than ~60 topic nodes becomes visually dense. Group by channel/year or
  merge topics; labels cap at 24.
- **Import JSON size**: 100k records ≈ 20 MB; the import guard is 120 MB.

## If you need a prebuilt 100k catalogue

This release intentionally supports only personal imports. A hosted catalogue would need a new loader
that fetches topic payloads on demand; the drawer, search and graph APIs are independent of where the
payload comes from. Do not ship a 100k catalogue unless you have the rights to it.
