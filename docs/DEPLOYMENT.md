# Deployment

## GitHub Pages (default)

The site is pure static files. The repository root **is** the deployable artifact.

1. Push to `main`. The workflow at `.github/workflows/pages.yml` uploads the root and deploys it.
2. First time only: **Settings → Pages → Source: GitHub Actions**.
3. Wait for the `pages` environment URL. Current deployment: <https://somphol.github.io/youtube-second-brain/>.

The workflow has no install step, no build command and no secrets. `node_modules/` is excluded by `.gitignore` and never uploaded because the artifact path is the repository root; add an exclusion list if you keep local tooling outside `node_modules`.

### Caching

GitHub Pages serves JSON and HTML with revalidation and gzip/brotli negotiation. Assets are content-addressed only by the immutable `data/VERSION` digest, not by filename, so:

- Do not add long `Cache-Control: immutable` headers for `data/*.json` unless you also version the filenames.
- The app fetches the manifest with `cache: 'no-cache'` to pick up a new corpus on reload.
- Shards and the title index are cached in IndexedDB. After a data rebuild, bump `version` in `manifest.json` and change the IndexedDB cache key (or ship the existing `__YTB.clearCaches()` migration) if you need clients to discard old shards. For a demo corpus, a hard reload plus a new shard id is enough.

## Cloudflare Pages

- Build command: *none*
- Output directory: `/`
- Framework preset: *None*

Same files, same behaviour. Cloudflare applies Brotli, which brings the title index to roughly 3 MB.

## Any static host

Requirements:

- Serve `index.html` at `/`.
- Serve `data/` with `application/json` and allow range/streaming responses (the title index is read as a stream for progress).
- Serve `404.html` for unknown paths (optional but included).
- HTTPS is not technically required but browsers restrict some storage APIs on insecure origins.

Test locally exactly as deployed:

```sh
npm run serve         # http://localhost:9000
# or
python3 -m http.server 8080
```

## Self-hosting the CDN assets

The app pins:

- `three@0.180.0` (ES module via importmap, unpkg)
- `minisearch@7.2.0` (UMD, jsDelivr)
- `tailwindcss@3.4.17` (Play CDN)

For an air-gapped deployment, download those three files into `vendor/`, rewrite the importmap and script tags, and remove the Tailwind CDN (the layout does not depend on it). The app's own CSS is complete without Tailwind. This adds ~1.1 MB but removes all third-party runtime requests.

## Release checklist

```sh
npm ci
npm run build:data
npm run verify:data
npm run verify -- --shots
git add -A
git commit -m "release: 1.0.0"
git push origin main
```

Then confirm:

- Pages workflow is green.
- Live URL returns 200 and the graph renders.
- `#/topic/transformer_architecture` opens a drawer.
- Search finds a title (wait for "Titles ready").
- Mobile viewport has no horizontal scroll.

## Rollback

Pages keeps the previous deployment per commit. Re-run the workflow on the last good commit, or revert the release commit and push. Data and app ship together, so a revert restores a consistent manifest/index/shard set.
