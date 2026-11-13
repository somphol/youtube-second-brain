# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-11-13

### Added

- 108,000-record synthetic corpus across 480 topics and 12 disciplines, generated deterministically by `scripts/build-data.mjs` (seed `20261113`).
- Sharded data contract: 112 KB manifest with pre-computed 3D coordinates and 958 edges, 480 lazy shards, 176 KB topic index, 12.5 MB deferred title index.
- Three.js knowledge graph: one instanced mesh for 480 spheres, shader halos, one line buffer for edges, HTML category labels, hand-written orbit/zoom/pinch controls, category focus and camera reset.
- Drawer with fixed-height virtualization (10–14 DOM rows for shards up to 4,604 videos), sort, saved-only filter and in-shard MiniSearch.
- Global search over topics, channels and all 108,000 titles with shard resolution for real result cards.
- localStorage bookmarks and theme, IndexedDB shard and index caching, recent topics.
- Hash deep links: `#/topic/<id>`, `#/topic/<id>?v=<videoId>`, `#/saved`.
- Dark/light themes, responsive layout at 390 px, focus trap, reduced-motion support and a list fallback when WebGL is unavailable.
- 67,990 data integrity checks and 63 headless Chrome checks; automated screenshots and a 1200×630 OG card.
- Release docs, GitHub Pages workflow, 404, manifest, robots and sitemap.
- Reusable `youtube-second-brain-studio` skill and its GitHub backup.

### Notes

- The corpus is synthetic by design. Titles, channels and view counts do not describe real videos.
- Three.js, MiniSearch and Tailwind load from pinned CDNs.

[1.0.0]: https://github.com/somphol/youtube-second-brain/releases/tag/v1.0.0
