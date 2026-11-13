# Deployment

The app is static. The only server-dependent feature is metadata fetching (`/api/oembed`) while adding
a link. Import, storage, graph, search, bookmarks and export work without any server beyond static files.

## GitHub Pages (the public build)

1. Push to `main`; `.github/workflows/pages.yml` uploads the repository root.
2. First time only: **Settings → Pages → Source: GitHub Actions**.
3. The site opens with an empty library for every visitor; each visitor's data stays in their browser.

Live: <https://somphol.github.io/youtube-second-brain/>

On Pages there is no `/api/oembed`. Adding a URL by hand saves a URL-only record with a placeholder
title; Takeout import is fully client-side and is the recommended path there.

No secrets, no build command, no environment variables.

## Local (the intended daily use)

```sh
npm run local          # binds 127.0.0.1:9000, opens the browser
npm run serve          # no auto-open
PORT=9010 npm run local
```

- The server binds **127.0.0.1** by default. `--host 0.0.0.0` is available for deliberate LAN use, but
  that exposes your local proxy to the network; do not do it casually.
- The library is scoped to the origin. Keep `http://127.0.0.1:9000` stable; a different port means a
  different IndexedDB.
- `Start Second Brain.command` is a double-clickable launcher (Node + npm install on first run).

## Metadata proxy

`GET /api/oembed?id=<11-char-id>`:

- validates `^[A-Za-z0-9_-]{11}$`;
- fetches `https://www.youtube.com/oembed?url=…&format=json`;
- fetches `https://i.ytimg.com/vi/<id>/mqdefault.jpg` (≤ 900 KB) and returns it as a data URL;
- caches per id in memory for the server process;
- returns 400 for invalid ids and 502 when YouTube fails.

It is not a general-purpose proxy and accepts no arbitrary URL.

## Cache headers

The local server sends `Cache-Control: no-store` for HTML/JSON and the API. Pages handles caching for
static assets itself; the HTML is small and revalidated. There is no versioned dataset to invalidate.

## Self-hosting the CDN assets

Pinned dependencies:

- `three@0.180.0` via import map (unpkg)
- `minisearch@7.2.0` UMD (jsDelivr)
- `tailwindcss@3.4.17` Play CDN

For an air-gapped install, download these into `vendor/`, rewrite the import map and script tags, and
drop the Tailwind CDN if desired (the app's CSS is complete without it). This adds ~700 KB and removes
all third-party runtime requests.

## Release checklist

```sh
npm run verify -- --shots
npm run benchmark:build && npm run benchmark:verify   # optional capacity check
git add -A
git commit -m "release: 2.0.0"
git push origin main
```

Confirm:

- workflow green and live URL 200;
- empty state visible, no console errors;
- add a link locally (metadata works) and import a Takeout file;
- 390 px has no horizontal overflow;
- no library data or `benchmark/` file is committed (`git status` clean).

## Rollback

Pages keeps prior deployments. Revert the release commit and push, or re-run the workflow on the last
good commit. Since there is no server data, rollback only affects the app shell.
