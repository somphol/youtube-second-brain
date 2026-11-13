#!/usr/bin/env node
/**
 * serve.mjs — dependency-free static server + local-only YouTube metadata proxy.
 *
 * Binds to 127.0.0.1 by default so a personal library is never exposed on the LAN.
 * `/api/oembed?id=<11-char-id>` fetches public oEmbed metadata and the thumbnail
 * server-side, returning the image as a data URL. The browser stores that record in
 * IndexedDB, so the library renders offline and makes no requests to YouTube after
 * import. This endpoint only exists locally; on static hosting the importer falls
 * back to URL-only records.
 *
 * Usage: node scripts/serve.mjs [--port 9000] [--host 127.0.0.1] [--open] [--root .]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };
const ROOT = path.resolve(__dirname, '..', arg('--root', '.'));
const PORT = Number(arg('--port', process.env.PORT || 9000));
const HOST = arg('--host', '127.0.0.1');
const OPEN = argv.includes('--open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

/* ------------------------- local metadata proxy ------------------------- */
const oembedCache = new Map();
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

async function fetchWithTimeout(url, ms = 9000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'YouTube-Second-Brain-Local/1.0 (personal library importer)',
        'Accept': 'application/json,image/*,*/*'
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function oembed(id) {
  if (oembedCache.has(id)) return oembedCache.get(id);
  const watch = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  const metaRes = await fetchWithTimeout(`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`);
  if (!metaRes.ok) throw new Error(`oEmbed HTTP ${metaRes.status}`);
  const meta = await metaRes.json();

  let thumbnail = '';
  try {
    const imgRes = await fetchWithTimeout(`https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`, 7000);
    if (imgRes.ok) {
      const type = imgRes.headers.get('content-type') || 'image/jpeg';
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.length > 0 && buf.length < 900_000) thumbnail = `data:${type};base64,${buf.toString('base64')}`;
    }
  } catch (err) { /* thumbnail is optional */ }

  const out = {
    id,
    title: String(meta.title || '').slice(0, 300),
    author_name: String(meta.author_name || '').slice(0, 200),
    thumbnail,
    url: watch
  };
  oembedCache.set(id, out);
  return out;
}

/* ------------------------------- server -------------------------------- */
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);

    if (url.pathname === '/api/oembed') {
      const id = (url.searchParams.get('id') || '').trim();
      if (!ID_RE.test(id)) {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end('{"error":"invalid id"}');
        return;
      }
      try {
        const data = await oembed(id);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(err.message || err) }));
      }
      return;
    }

    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  const pageUrl = `http://${shown}:${PORT}/`;
  console.log(`serving ${ROOT} on ${pageUrl}`);
  console.log('local library: metadata and thumbnails are fetched through /api/oembed and stored in IndexedDB.');
  if (OPEN) {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try { spawn(cmd, [pageUrl], { stdio: 'ignore', detached: true }).unref(); } catch (err) { /* ignore */ }
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
