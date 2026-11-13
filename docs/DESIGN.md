# Design and interaction

## Intent

A "second brain" should feel like a place, not a spreadsheet. The graph is the primary navigation: twelve colour-coded disciplines, each a constellation of topics sized by how much material exists. Everything else — search, filters, drawer — is an instrument for getting to a specific video without losing that spatial sense.

The interface is deliberately quiet: near-black stage, thin borders, one warm accent, and colour reserved for data (category hues). Chrome recedes; the graph carries the identity.

## Visual system

| Token | Dark | Light |
| --- | --- | --- |
| `--bg` | `#06070b` | `#f3f4f9` |
| `--panel` | translucent near-black | translucent white |
| `--text` | `#f3f4f9` | `#0f1222` |
| `--accent` | `#ff3d63` | `#e11d48` |
| `--accent-2` | `#8b5cff` | `#6338f0` |

- **Type**: system sans (Inter → SF Pro → Segoe → system-ui) for UI; system mono for counts, durations, badges and status. No web fonts, no font flash.
- **Radii**: 8/14/22 px; pills for filters, 9–12 px for controls.
- **Depth**: a single border + translucent panel + backdrop blur. No heavy drop shadows except the drawer and search overlay.
- **Motion**: one easing curve `cubic-bezier(.22,.8,.26,1)`, 120–420 ms. Auto-rotation and pulses stop under `prefers-reduced-motion`.
- **Category hues**: architecture 265, training 205, inference 160, RAG 30, agents 320, multimodal 190, media 345, MLOps 15, data 85, eval 45, product 285, research 235.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ brand      search (centered)        browse saved theme   │ 76 px
├──────────────────────────────────────────────────────────┤
│ All · 12 discipline chips          title-index status    │ 52 px
├──────────────────────────────────────────────────────────┤
│ HUD title                         ┌──────── drawer ────┐ │
│ stats                             │ header             │ │
│                                   │ toolbar            │ │
│           3D graph                │ virtual list       │ │
│                                   │ footer             │ │
│ legend        hint        zoom    └────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

The drawer is a fixed 560 px overlay with a scrim; on ≤ 560 px it becomes a full-screen sheet. The canvas remains mounted underneath, so closing restores the camera exactly.

## Interaction map

| Action | Result |
| --- | --- |
| Drag | Orbit camera (damped) |
| Wheel / pinch | Zoom 9–42 world units |
| Click node / category label | Open topic / focus category |
| Double-click stage, reset button | Reset camera + filter |
| `/` or `⌘K` | Focus global search |
| `↑` / `↓` / `Enter` in search | Move through results / open |
| `Esc` | Close search, then drawer |
| Star | Bookmark (localStorage) |
| Saved icon | Open saved drawer |
| Browse icon | Open all 480 topics as a list |
| Theme icon | Toggle dark/light, persisted |

## Drawer anatomy

- **Header**: category eyebrow with hue dot, topic title, count, shard-source badge, path (hidden on small screens), close.
- **Toolbar**: filter field, sort select, saved-only toggle. On mobile it becomes a 2-column grid with the search full width.
- **Meta row**: result count and visible range (`1–10 of 4,604`).
- **Rows**: index, procedural poster with duration or LIVE, two-line title, channel · views · age, star, external link. Saved rows add the parent topic as a link.
- **Footer**: load provenance (`Fetched on demand`, `Restored from IndexedDB`, `Shard in memory`), elapsed time, size.

The rows are the only place with colour beyond the category system: the poster hue is hashed from the channel id, giving each channel a stable identity without images.

## Accessibility

- Skip link to the graph.
- The graph has `role="img"` and an accessible name; the same 480 topics are reachable through **Browse** without WebGL.
- Search is a labelled input; results are `role="option"` buttons, keyboard-navigable.
- The drawer is a labelled `role="dialog"` with `aria-modal`, focus moved to close, a Tab focus trap, and focus restored to the opener.
- All icon-only controls have `aria-label`; saved toggles expose `aria-pressed`; live regions announce toasts and search status.
- Colour is never the only signal: active chips have border + background, saved stars fill, the current row has a left bar.
- Contrast: body text ≥ 7:1 in both themes; muted text ≥ 4.5:1. Focus rings use a 2 px accent outline with offset.
- Motion respects `prefers-reduced-motion`; auto-rotation stops.

## Responsive rules

| Breakpoint | Change |
| --- | --- |
| ≤ 1080 px | Hide brand subtitle and hint pill; narrower legend |
| ≤ 860 px | Static search wrap, legend hidden, 68 px header, 88 px rows, camera further back |
| ≤ 560 px | Two-row header, full-width search, index status hidden, 2-col drawer toolbar, path hidden, full-screen drawer |

The mobile camera starts at 33 world units instead of 24 so the whole constellation fits a portrait viewport; pinch and zoom remain available.

## Copy and tone

Direct, technical, no hype. "Pre-computed coordinates. Shards fetched on demand. Nothing simulated in the browser except the orbit." The synthetic-data disclaimer appears in onboarding and the README rather than being hidden in a tooltip.
