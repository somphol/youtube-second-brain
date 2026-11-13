# Security policy

## Scope

This is a static site. It has no server, no authentication, no accounts and no database. The attack surface is the browser: third-party CDN scripts, `localStorage`, IndexedDB and the hash router.

## Reporting

Open a private security advisory on GitHub, or email the maintainer listed in `CREDITS.md`. Please do not file a public issue for a vulnerability. Expect an acknowledgement within seven days.

## Design decisions relevant to security

- **No user content is rendered unescaped.** Titles, channels, topic names and search results are escaped before insertion into HTML.
- **No `eval`, no dynamic script injection, no `innerHTML` from network text.** Shard JSON is parsed as data.
- **No analytics, cookies or tracking.** The only stored data is the bookmark/theme object in `localStorage` and cached JSON in IndexedDB.
- **No secrets.** The repository contains no tokens, keys or environment files, and the deployment workflow uses GitHub's OIDC-based Pages action.
- **Outbound links** use `rel="noopener noreferrer"` and go to YouTube search pages for generated titles.
- **CDNs are pinned** to exact versions. A compromised CDN remains a supply-chain risk; see `docs/DEPLOYMENT.md` for self-hosting the three vendor files.

## Data disclaimer

The corpus is synthetic. Do not treat titles, channels or view counts as facts about real people or videos. If you replace it with real data, you are responsible for the rights, privacy and licensing of that data.

## Supported versions

Only the latest release on `main` receives fixes.
