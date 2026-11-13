# Security policy

## Scope

A local-first static app plus a small local Node server. No accounts, no authentication, no cloud
database. The attack surface is the browser, the local `/api/oembed` endpoint, and the JSON importer.

## Reporting

Open a private security advisory on GitHub, or email the maintainer in `CREDITS.md`. Do not file a public
issue for a vulnerability.

## Design decisions

- **The server binds `127.0.0.1`** by default; it is not exposed on the LAN. `--host 0.0.0.0` is opt-in.
- **`/api/oembed` validates an 11-character id** and fetches only fixed YouTube oEmbed and thumbnail
  paths. It does not accept a URL parameter, so it cannot be used as an open proxy.
- **No secrets in the repository.** No Google credentials, API keys, cookies or tokens.
- **No OAuth and no history scraping.** Takeout files are parsed locally with `File.text()`; nothing is
  uploaded.
- **All rendered strings are escaped.** Titles, channels and topic names pass through `escapeHtml`.
- **Import is bounded**: 120 MB file limit, 100 links per manual batch, JSON parsed as data (never
  evaluated).
- **No analytics or third-party storage.** IndexedDB and localStorage are origin-scoped.
- **CDNs are pinned.** Three 0.180.0, MiniSearch 7.2.0, Tailwind 3.4.17. Self-hosting guidance is in
  `docs/DEPLOYMENT.md`.
- **Outbound links** use `rel="noopener noreferrer"`.

## Data ownership

The app stores personal viewing metadata on the user's machine. It is not encrypted at rest; anyone with
access to the browser profile can read it. Users should export backups and clear site data on shared
machines. Do not commit exports; `my-youtube-library-*.json` is gitignored.

## Supported versions

Only the latest release on `main` receives fixes.
