# Build state — Second Brain 2.0.0

A local-first 3D map of a personal YouTube library. No seeded videos: the app starts empty, imports
links or Google Takeout history, and stores everything in the browser on this Mac.

- **Live (empty for each visitor):** https://somphol.github.io/youtube-second-brain/
- **Repository:** https://github.com/somphol/youtube-second-brain
- **Release commit:** `8cf472d` · **Pages:** success
- **Skill:** `~/.config/opencode/skills/youtube-second-brain-studio` · backup:
  https://github.com/somphol/youtube-second-brain-skill

## Time

| | |
| --- | --- |
| Session start | 2026-11-13T08:48:56Z |
| Packaged | 2026-11-13T09:49:18Z |
| Elapsed | **1h 0m 22s** |
| Deployed | 2026-11-13T09:45:33Z |

The first implementation built a 108,000-record synthetic corpus. The user clarified that 100k was a
**capacity target**, not content to ship, so the corpus and shard loader were removed and the app was
rebuilt around a personal, empty-by-default library.

## Use

```sh
cd ~/Projects/youtube-second-brain
npm run local          # http://127.0.0.1:9000
```

- Add links: library icon → paste → topic → Add.
- Import history: My library → Import Takeout / JSON → `watch-history.json` → choose grouping.
- Export a backup before clearing site data.

## Capacity (optional fixture)

100,000 synthetic records imported in **433 ms**; 480 topics; 60 FPS; largest topic 3,765 videos with
10 DOM rows at the top and 12 at mid-scroll; search index ready; 126 → 169 MB heap. Generate with
`npm run benchmark:build`, import manually. The fixture is gitignored and never loaded by the app.

## Verification

- **59/59** headless Chrome checks (empty state, imports, local drawer, 5,000-row virtualization,
  Takeout grouping/dedupe, persistence, 390 px, zero errors).
- **11/11** benchmark fixture checks.
- 9 screenshots regenerated from a clean context.

## Tokens and model

| | |
| --- | ---: |
| Input | 408,501 |
| Output | 176,104 |
| Reasoning | 107,713 |
| **Total** | **692,318** |
| Cache read | 35,921,536 |
| Cost | $0.00 (reported) |

Model **DeepSeek V4.1 Flash** (`opencode-go`) · Harness **OpenCode 2.2.7**.

Snapshot at 2026-11-13T09:49:18Z; the final commit and closing response add a small amount. Full detail
in [`state.json`](state.json).
