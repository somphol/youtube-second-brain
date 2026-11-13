# Data model

Everything the app knows about your library lives in this browser profile. There is no server database,
no account and no seeded corpus.

## Record shape

```jsonc
{
  "id": "dQw4w9WgXcQ",              // 11-char YouTube id, primary key
  "title": "Never Gonna Give You Up",
  "channel": "Rick Astley",
  "channelId": "personal",          // not fetched for oEmbed imports
  "thumb": "data:image/jpeg;base64,…", // optional, ~10–25 KB
  "topicName": "Music",              // becomes a graph node
  "source": "manual | takeout | import | benchmark",
  "addedAt": "2026-11-13T09:30:00.000Z",
  "published": "2026-11-13",         // watch/add date when unknown
  "duration": 0,                    // 0 = unknown, badge hidden
  "views": 0,                       // 0 = unknown, meta hidden
  "type": "video",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

Optional fields are tolerated. `normaliseRecord()` fills defaults, strips a leading `Watched ` from
Takeout titles, validates the id, and clamps strings.

## Storage

### IndexedDB `yt-second-brain`

| Store | Key | Value |
| --- | --- | --- |
| `library` | `collection` | `{ key, version, savedAt, videos: Record[] }` |

Legacy `shards` and `assets` stores may exist from earlier versions and are ignored. The database
version is 2; `onupgradeneeded` creates the `library` store.

Writes are awaited before the UI reports success, so a fast reload sees the import. The record array is
stored as one value; for 100k records this is ~20 MB of JSON and a single IDB transaction.

### localStorage `yt-second-brain:v1`

```jsonc
{
  "version": 1,
  "theme": "dark",
  "mode": "library",
  "bookmarks": { "<videoId>": { "id": "...", "title": "...", "channel": "...", "topicId": "...", "topicName": "...", "savedAt": 0 } },
  "recent": ["lib_music"],
  "savedAt": "2026-11-13T09:30:00.000Z"
}
```

Bookmarks store enough to render the saved drawer without loading the library. Recents hold up to six
topic ids. Writes are synchronous.

## Topic derivation

`buildPersonalDataset()` groups videos by `topicName`, sorts each group newest-first, then builds:

```jsonc
{
  "id": "lib_music",
  "name": "Music",
  "category": "library",
  "count": 342,
  "hue": 195,
  "radius": 1.72,
  "pos": [2.1, -1.4, 0.8],
  "__shard": { "videos": [ ...same array... ] }
}
```

- id: `lib_` + a slugified topic name, de-duplicated with `_2`, `_3` if needed.
- hue: golden-angle spread by alphabetical topic order.
- radius: `0.34 + 0.24 * ln(count + 1)`.
- positions: a flat ring for ≤ 6 topics, a Fibonacci sphere above, radius ≈ 5.4–9.
- edges: each topic links to its two nearest neighbours.

Changing a topic name changes its id. Bookmarks keep the old `topicId` in their record, but the saved
drawer still displays them; reopening the old topic is not possible until it exists again.

## Takeout mapping

Input: `watch-history.json` (a JSON array).

| Takeout field | Record field |
| --- | --- |
| `titleUrl` `…watch?v=<id>` | `id` |
| `title` (leading `Watched ` removed) | `title` |
| `subtitles[0].name` | `channel` |
| `time` | `addedAt`, `published` |
| grouping option | `topicName` |

Entries without a parseable watch URL (removed/private videos) are skipped. Duplicate ids are skipped;
the first record wins.

Grouping:

- `single` — one topic, default `Watch history` or the value in the topic field.
- `channel` — the 24 most frequent channels become topics; everything else becomes `Other channels`.
- `year` — the watch year (`2021`, `2022`, …) or `Unknown year`.

## Backup format

Export writes:

```jsonc
{ "version": 1, "exportedAt": "ISO", "videos": [ Record, … ] }
```

Import accepts this object or a Takeout array. Merge is by `id`; existing records are never overwritten.
Grouping options only apply to Takeout imports.

## Capacity model

| Dimension | Design |
| --- | --- |
| Library size | IndexedDB array; validated at 100,000 |
| Graph nodes | one per topic, typically 1–480 |
| Drawer rows | fixed-height window, 10–14 DOM nodes regardless of count |
| Search | MiniSearch over the full library, deferred above 2,000 records |
| Import | one normalisation pass + one IDB write; 100k in 433 ms measured |

The topic grouping is the main lever: 100k videos in one topic is one graph node and a virtualized list;
100k in 480 topics is 480 nodes and short lists. Both are supported.

## No shipped corpus

The repository contains no `data/` directory. `benchmark/library-100k.json` is generated on demand by
`npm run benchmark:build`, is gitignored, labelled synthetic, and is imported manually only for capacity
tests. It is never fetched by the app.
