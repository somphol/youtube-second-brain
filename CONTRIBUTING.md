# Contributing

## Setup

```sh
git clone https://github.com/somphol/youtube-second-brain.git
cd youtube-second-brain
npm install
npm run serve          # http://localhost:9000
```

Node 20+ and Chrome are required for the gates. The deployed app has no runtime dependencies.

## Before opening a pull request

```sh
npm run verify:data
npm run verify
```

Both must pass. If you change visible behaviour, regenerate screenshots:

```sh
npm run verify -- --shots
```

## Editing the app

`index.html` is intentionally one file. Keep it that way:

- CSS lives in the single `<style>` block, tokens first, then layout, then components, then responsive rules.
- The runtime is one inline `<script type="module">`. Add code inside the matching numbered section rather than creating a second module.
- Do not add a bundler, framework or runtime npm package.
- Do not fetch a shard or the title index during boot.

## Editing the corpus

`scripts/taxonomy.mjs` is the editorial source. Changing a keyword changes its id, shard filename, URL and every bookmark pointing at it. Treat ids as permanent once published. After any taxonomy or generator change:

```sh
npm run build:data
npm run verify:data
npm run verify
```

Commit `data/` in the same change; the app and corpus ship together.

## Style

- Vanilla ES2022, two-space indentation, single quotes, semicolons.
- Escape any user- or data-derived string inserted as HTML (`escapeHtml`).
- Prefer `textContent` for new UI unless markup is genuinely needed.
- Keep the row count in the virtual list bounded.
- Respect `prefers-reduced-motion`.

## Reporting bugs

Include: browser and version, viewport size, the topic id or hash, what you expected, what happened, and whether the drawer header said `fetched`, `indexeddb` or `in memory`. Console output helps. Do not attach personal bookmarks.
