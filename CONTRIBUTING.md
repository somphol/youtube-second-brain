# Contributing

## Setup

```sh
git clone https://github.com/somphol/youtube-second-brain.git
cd youtube-second-brain
npm install
npm run local        # http://127.0.0.1:9000
```

Node 20+ and Chrome are required for the gate. The deployed app has no runtime npm dependency.

## Before a pull request

```sh
npm run verify
npm run benchmark:build && npm run benchmark:verify   # only if you touch import/capacity
```

If you change visible behaviour, regenerate screenshots:

```sh
npm run screenshots
```

## Editing the app

`index.html` is one file by design. Keep it that way.

- CSS lives in the single `<style>` block: tokens → layout → components → responsive.
- The runtime is one inline `<script type="module">`; add code inside the matching numbered section.
- No bundler, framework or runtime package.
- No seeded library, sample records or automatic dataset fetch. The empty state is the product.
- Do not add Google authentication, cookie import or scraping. Takeout JSON is the history path.
- Keep `/api/oembed` narrow (validated id, fixed hosts, no arbitrary URL proxy).
- Escape every data-derived string before HTML interpolation.
- Keep the virtual list at ≤ 20 rendered rows.

## Editing the capacity fixture

`scripts/taxonomy.mjs` feeds only the optional benchmark generator. It does not ship. After changing it:

```sh
npm run benchmark:build
npm run benchmark:verify
```

Never commit `benchmark/`.

## Style

Vanilla ES2022, two-space indentation, single quotes, semicolons. Prefer `textContent` for new UI unless
markup is needed. Respect `prefers-reduced-motion`.

## Reporting bugs

Include browser/version, viewport, whether the app is local or hosted, the topic, expected vs. actual,
and whether metadata was available. Do not attach your library export or personal watch history.
