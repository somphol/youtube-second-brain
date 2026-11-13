# Design and interaction

## Intent

A private shelf, not a feed. The app starts empty and asks for one deliberate action: add a link or
import history. From there it becomes a spatial index of your own topics. No recommendations, no
autoplay, no engagement mechanics.

The interface stays quiet: near-black stage, thin borders, one accent. Colour is data (topic hues).
Everything else is chrome that disappears when you read.

## Visual system

| Token | Dark | Light |
| --- | --- | --- |
| `--bg` | `#06070b` | `#f3f4f9` |
| `--panel` | translucent near-black | translucent white |
| `--text` | `#f3f4f9` | `#0f1222` |
| `--accent` | `#ff3d63` | `#e11d48` |
| `--accent-2` | `#8b5cff` | `#6338f0` |

- System sans (Inter → SF Pro → Segoe → system-ui), system mono for counts and status.
- No web fonts, no stock images. Posters are procedural; own thumbnails are stored data URLs.
- Radii 8/14/22 px; one easing curve; motion stops under `prefers-reduced-motion`.
- Topic hues are golden-angle spaced at build time, so clusters stay distinguishable.

## Screens

**Empty stage** — centered card: “Start with your own videos”, two actions (Add videos / Import
history), and a one-line privacy note. The graph is not rendered; there is nothing to orbit.

```
┌──────────────────────────────────────────────────────────┐
│ brand      search                library browse saved theme│
├──────────────────────────────────────────────────────────┤
│ All                                                      │
├──────────────────────────────────────────────────────────┤
│                     ┌──────────────────┐                 │
│                     │   empty card      │                 │
│                     │  Add / Import     │                 │
│                     └──────────────────┘                 │
└──────────────────────────────────────────────────────────┘
```

**Graph** — topic spheres with labels above them; the drawer pushes the stage left instead of covering
it on desktop, so the selected cluster stays visible.

**Library panel** — centered sheet (full-screen under 560 px): URL textarea, topic field, add button,
grouping select for Takeout, import/export/clear, and a list of the latest 100 records. The privacy
note is at the top, not buried.

**Drawer** — topic title, count, `LOCAL` badge, filter, sort, saved-only, virtualized rows, footer
“Local library · offline”. Saved and all-topics modes reuse the same shell.

## Interaction

| Action | Result |
| --- | --- |
| Click a node or its label | Open the topic drawer |
| Drag / wheel / pinch | Orbit / zoom |
| Double-click stage | Reset view |
| `/` or `⌘K` | Focus search |
| `Esc` | Close library → search → drawer |
| Library icon | Add / import / export |
| Star | Bookmark in localStorage |
| Browse icon | All topics as a list (works without WebGL) |
| Theme icon | Dark/light, persisted |

## Empty and error states

- Empty library: actionable card, no fake suggestions.
- No search matches: names the scope (“your library”) and suggests adding records.
- Import failure: inline status with the reason; nothing is written.
- Metadata failure: record still saved by URL; the status says how many lacked metadata.
- WebGL failure: fallback panel; the list and search remain.

## Accessibility

- Skip link; labelled search; `role="option"` results; labelled dialog for the library and drawer.
- Focus moves into the library/drawer, Tab cycles, Esc closes, focus returns to the opener.
- Icon buttons have `aria-label`; saved toggles expose `aria-pressed`; status/toast regions are live.
- Colour is never the only signal: saved stars fill, active chips have background + border, the focused
  row has a left bar.
- Contrast ≥ 7:1 for body text, ≥ 4.5:1 for muted; visible 2 px focus rings.
- Reduced motion disables rotation and pulses.

## Responsive

| Breakpoint | Change |
| --- | --- |
| ≤ 1080 px | Brand subtitle and hint pill hidden; narrower legend |
| ≤ 860 px | Legend hidden; 68 px header; 88 px rows; static search row |
| ≤ 560 px | Two-row header; full-width search; 2-column library controls; full-screen library/drawer; index status hidden |

Mobile camera starts further back for the personal ring/sphere and pinch zoom remains available.

## Copy

Direct, technical, private-by-default. “No account. No cookies. No upload.” appears once on the empty
card and once in the library panel. The app never claims to have fetched your history; it asks for a
Takeout file and explains why.
