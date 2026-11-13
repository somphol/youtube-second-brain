# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Local, rule-based title classifier: 39 topics plus entity tags (Meta, OpenAI, Nvidia, …).
- “Auto-detect from titles” import grouping (now the default) and **Auto-organize titles** for an
  existing library.
- Tags are stored on records and included in local search.

## [2.0.0] — 2026-11-13

### Changed

- The app is now a **local-first personal library**, not a seeded demonstration. It starts empty and ships no videos.
- Removed the synthetic 108,000-record corpus, sharded assets and demo mode from the app and repository.
- The 3D graph is built from the user's own topics, laid out locally.
- Search builds a MiniSearch index over the local library in an idle slot; substring fallback until ready.
- The library panel is the primary tool: paste links, import Takeout, group by year/channel/topic, export a backup.
- Documentation rewritten around privacy, Takeout, capacity and operation.

### Added

- Local metadata proxy (`/api/oembed`) that stores title, channel and thumbnail as a data URL.
- Google Takeout `watch-history.json` importer with dedupe and three grouping modes.
- Empty-state onboarding and a double-click launcher (`Start Second Brain.command`).
- Optional 100,000-record capacity fixture (`npm run benchmark:build`) and its integrity gate.
- 59 headless checks, including a 5,000-video virtualization test and Takeout parsing.

### Removed

- `data/` corpus, `build-data.mjs`, `verify-data.mjs`, the 12 MB global index and all shard fetches.
- The "100k videos shipped" claim and demo toggle.

## [1.0.0] — 2026-11-13

Initial release: a static, sharded 3D knowledge graph over a synthetic 108,000-record corpus, with
pre-computed coordinates, virtualized lists, bookmarks and a verified GitHub Pages deployment.

[2.0.0]: https://github.com/somphol/youtube-second-brain/releases/tag/v2.0.0
[1.0.0]: https://github.com/somphol/youtube-second-brain/releases/tag/v1.0.0
