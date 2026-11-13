#!/usr/bin/env node
/**
 * verify.mjs — release gate.
 *
 * Boots a local static server, drives the real application in headless Chrome and
 * asserts the behaviour that the architecture promises:
 *   - 100k-scale data is present and lazy-loaded (no shard on boot)
 *   - WebGL graph renders, shard opens on demand, virtual list stays small
 *   - search works globally and inside a shard
 *   - bookmarks and theme survive a reload; IndexedDB caches shards
 *   - deep links, keyboard dismissal, responsive layout
 *
 * Also regenerates screenshots when --shots is passed.
 *
 * Usage: node scripts/verify.mjs [--shots] [--port 9099]
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const SHOTS = argv.includes('--shots');
const portArg = argv.indexOf('--port') === -1 ? 9099 : Number(argv[argv.indexOf('--port') + 1]);
const PORT = Number.isFinite(portArg) ? portArg : 9099;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const checks = [];
function check(name, cond, detail = '') {
  checks.push({ name, ok: !!cond, detail });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- static server ---------------- */
const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), '--port', String(PORT)], {
  cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe']
});
const serverLog = [];
server.stdout.on('data', (d) => serverLog.push(String(d)));
server.stderr.on('data', (d) => serverLog.push(String(d)));
for (let i = 0; i < 60; i++) {
  if (serverLog.join('').includes('serving')) break;
  await sleep(50);
}
if (!serverLog.join('').includes('serving')) {
  console.error('server failed to start:', serverLog.join(''));
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
let requests = [];

async function newPage(viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('requestfailed', (r) => {
    const failure = r.failure()?.errorText || '';
    if (!failure.includes('ERR_ABORTED')) failedRequests.push(`${r.url()} ${failure}`);
  });
  return page;
}

async function boot(page, url = `${BASE}/`) {
  requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('window.__YTB && window.__YTB.ready === true', { timeout: 45000 });
  await sleep(500);
}

const page = await newPage();
await boot(page);
await page.evaluate(() => window.__YTB.clearCaches());
await sleep(1400);

/* ---------------- boot & data ---------------- */
const stats = await page.evaluate(() => window.__YTB.stats());
check('108,000 videos loaded', stats.videos === 108000, String(stats.videos));
check('480 topics loaded', stats.topics === 480, String(stats.topics));
check('edges pre-computed', stats.edges > 500, String(stats.edges));
check('WebGL graph is live', stats.webgl === true);
check('renderer sustains interactive frame rate', stats.fps >= 25, `${stats.fps} fps`);

check('manifest fetched on boot', requests.some((u) => u.includes('/data/manifest.json')));
check('keyword search index fetched on boot', requests.some((u) => u.includes('/data/search_index.json')));
check('no shard fetched before interaction', !requests.some((u) => u.includes('/data/shards/')));

const deferral = await page.evaluate(() => {
  const res = performance.getEntriesByType('resource');
  const vi = res.find((r) => r.name.includes('video_index.json'));
  return { readyAt: window.__YTB_READY_AT || 0, videoIndexStart: vi ? vi.startTime : null, status: window.__YTB.state.videoIndexStatus };
});
check('title index request starts after first paint',
  deferral.videoIndexStart === null || deferral.videoIndexStart >= deferral.readyAt,
  `ready ${Math.round(deferral.readyAt)}ms, index ${deferral.videoIndexStart === null ? 'not requested' : Math.round(deferral.videoIndexStart) + 'ms'}`);

const bootShots = await page.evaluate(() => ({
  brand: document.querySelector('#brandVideos').textContent,
  title: document.title,
  canvas: !!document.querySelector('#canvasHost canvas'),
  canvasW: document.querySelector('#canvasHost canvas')?.width || 0,
  onboarding: !document.querySelector('#onboard').hidden,
  chips: document.querySelectorAll('#categoryChips .chip').length
}));
check('header reports 108K videos', bootShots.brand.includes('108K'), bootShots.brand);
check('document title is descriptive', bootShots.title.includes('108,000'), bootShots.title);
check('canvas is mounted with size', bootShots.canvas && bootShots.canvasW > 500, String(bootShots.canvasW));
check('13 filter chips (All + 12)', bootShots.chips === 13, String(bootShots.chips));

/* ---------------- on-demand shard ---------------- */
await page.evaluate(() => window.__YTB.openTopic('transformer_architecture'));
await page.waitForFunction("window.__YTB.drawerInfo().items > 0", { timeout: 15000 });
const first = await page.evaluate(() => window.__YTB.drawerInfo());
check('drawer opens on demand', first.mode === 'topic');
check('shard contains 4,604 videos', first.items === 4604, String(first.items));
check('shard was fetched over the network', first.source === 'network', first.source);
check('virtual list renders at most 20 rows', first.rendered <= 20, String(first.rendered));
check('exactly one shard request for one click',
  requests.filter((u) => u.includes('/data/shards/')).length === 1,
  String(requests.filter((u) => u.includes('/data/shards/')).length));

const scrollCheck = await page.evaluate(async () => {
  const sc = document.querySelector('#drawerScroll');
  const before = document.querySelector('#vlistWindow .vrow .idx')?.textContent;
  sc.scrollTop = 900 * 92;
  await new Promise((r) => setTimeout(r, 120));
  const rows = document.querySelectorAll('#vlistWindow .vrow').length;
  const after = document.querySelector('#vlistWindow .vrow .idx')?.textContent;
  return { before, after, rows, scrollTop: sc.scrollTop, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight };
});
check('deep scroll keeps DOM small', scrollCheck.rows <= 20, `${scrollCheck.rows} rows`);
check('deep scroll moves the window', scrollCheck.before !== scrollCheck.after, `${scrollCheck.before} → ${scrollCheck.after}`);
check('scroll height reflects 4,604 rows', scrollCheck.scrollHeight > 400000, String(scrollCheck.scrollHeight));

/* ---------------- in-shard search ---------------- */
await page.evaluate(() => {
  const el = document.querySelector('#drawerSearch');
  el.value = 'scaling';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(500);
const filtered = await page.evaluate(() => window.__YTB.drawerInfo());
check('shard search narrows the list', filtered.items > 0 && filtered.items < 4604, String(filtered.items));
check('shard search keeps DOM small', filtered.rendered <= 20, String(filtered.rendered));
await page.evaluate(() => {
  const el = document.querySelector('#drawerSearch');
  el.value = '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(300);

/* ---------------- bookmark + persistence ---------------- */
const bookmark = await page.evaluate(() => {
  const btn = document.querySelector('#vlistWindow .mini-btn[data-act="save"]');
  const title = document.querySelector('#vlistWindow .vtitle')?.textContent;
  btn?.click();
  return { title, saved: JSON.parse(localStorage.getItem('yt-second-brain:v1') || '{}').bookmarks };
});
check('bookmark writes to localStorage', !!bookmark.saved && Object.keys(bookmark.saved).length === 1);
check('saved badge updates', (await page.$eval('#savedCount', (el) => el.textContent)) === '1');
await sleep(400);

await page.evaluate(() => window.__YTB.setTheme('light'));
await sleep(200);
check('theme applies to document', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
check('only one theme icon is visible', await page.evaluate(() => {
  const icons = [...document.querySelectorAll('[data-theme-icon]')];
  return icons.filter((el) => getComputedStyle(el).display !== 'none').length === 1;
}));

// Reload: theme + bookmark must survive, shard must come from IndexedDB.
await boot(page);
check('theme survives reload', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
check('bookmark survives reload', (await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('yt-second-brain:v1')).bookmarks).length)) === 1);

await page.evaluate(() => window.__YTB.openTopic('transformer_architecture'));
await page.waitForFunction("window.__YTB.drawerInfo().items > 0", { timeout: 15000 });
const cached = await page.evaluate(() => window.__YTB.drawerInfo());
check('shard served from IndexedDB after reload', cached.source === 'cache', cached.source);
check('cached shard keeps full count', cached.items === 4604, String(cached.items));

await page.evaluate(() => window.__YTB.openSaved());
await sleep(300);
const saved = await page.evaluate(() => window.__YTB.drawerInfo());
check('saved drawer lists the bookmark', saved.items === 1, String(saved.items));
check('saved row renders', (await page.$$eval('#vlistWindow .vrow', (els) => els.length)) === 1);

/* ---------------- global search ---------------- */
await page.evaluate(() => window.__YTB.closeDrawer());
await page.waitForFunction("window.__YTB.searchInfo().index === 'ready'", { timeout: 60000 });
await page.evaluate(() => window.__YTB.search('attention'));
await page.waitForFunction("window.__YTB.searchInfo().videos > 0", { timeout: 20000 });
const search = await page.evaluate(() => window.__YTB.searchInfo());
const topicsCount = await page.evaluate(() => window.__YTB.searchInfo().topics);
const panelItems = await page.$$eval('#searchPanel .search-item', (els) => els.length);
check('global search finds topic matches', topicsCount > 0, String(topicsCount));
check('global search resolves real video titles', search.videos > 0, String(search.videos));
check('search panel is visible', search.open === true);
check('search panel renders clickable results', panelItems > 0, String(panelItems));
const videoHref = await page.$$eval('#searchPanel .search-item[data-kind="video"]', (els) => els[0]?.dataset.topic || '');
check('video result carries its topic', videoHref === 'transformer_architecture' || videoHref.length > 0, videoHref);

await page.evaluate(() => {
  document.querySelector('#globalSearch').value = '';
  document.querySelector('#globalSearch').dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(250);

/* ---------------- category filter + browse ---------------- */
await page.evaluate(() => window.__YTB.setCategory('agents'));
await sleep(300);
check('category chip becomes active', (await page.$$eval('#categoryChips .chip.is-active', (els) => els.length)) === 1);
check('legend highlights the category', (await page.$$eval('#legendList .is-active', (els) => els.length)) === 1);
const labelMuted = await page.$$eval('.cat-label.is-muted', (els) => els.length);
check('other categories dim in the graph', labelMuted === 11, String(labelMuted));
await page.evaluate(() => window.__YTB.resetView());

await page.evaluate(() => window.__YTB.openBrowse());
await sleep(400);
const browse = await page.evaluate(() => window.__YTB.drawerInfo());
check('browse lists all 480 topics', browse.items === 480, String(browse.items));
check('browse virtualizes too', browse.rendered <= 20, String(browse.rendered));
await page.evaluate(() => {
  const el = document.querySelector('#drawerSearch');
  el.value = 'rag';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(350);
const browseFiltered = await page.evaluate(() => window.__YTB.drawerInfo());
check('topic browse filters by name', browseFiltered.items > 0 && browseFiltered.items < 480, String(browseFiltered.items));
await page.evaluate(() => window.__YTB.closeDrawer());
await sleep(250);

/* ---------------- keyboard + deep link ---------------- */
await page.keyboard.press('/');
await sleep(200);
check('slash focuses search', (await page.evaluate(() => document.activeElement?.id)) === 'globalSearch');
await page.keyboard.press('Escape');
await boot(page, `${BASE}/#/topic/self_attention`);
await page.waitForFunction("window.__YTB.drawerInfo().items > 0", { timeout: 15000 });
const deep = await page.evaluate(() => window.__YTB.drawerInfo());
check('deep link opens the topic', deep.topic === 'self_attention', String(deep.topic));
check('deep-linked shard loads', deep.items > 0, String(deep.items));
await page.keyboard.press('Escape');
await sleep(350);
check('Escape closes the drawer', (await page.evaluate(() => window.__YTB.drawerInfo().mode)) === null);

/* ---------------- mobile ---------------- */
const mobile = await newPage({ width: 390, height: 844 });
await boot(mobile);
const mobileBase = await mobile.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  canvas: !!document.querySelector('#canvasHost canvas'),
  headerH: document.querySelector('.topbar').getBoundingClientRect().height
}));
check('mobile has no horizontal overflow', mobileBase.overflow <= 1, `${mobileBase.overflow}px`);
check('mobile still renders the graph', mobileBase.canvas === true);
await mobile.evaluate(() => window.__YTB.openTopic('ai_agents'));
await mobile.waitForFunction("window.__YTB.drawerInfo().items > 0", { timeout: 15000 });
await sleep(400);
const mobileDrawer = await mobile.evaluate(() => {
  const d = document.querySelector('#drawer').getBoundingClientRect();
  return {
    w: Math.round(d.width), h: Math.round(d.height), vw: innerWidth,
    rows: document.querySelectorAll('#vlistWindow .vrow').length,
    overflow: document.documentElement.scrollWidth - innerWidth
  };
});
check('mobile drawer is full width', mobileDrawer.w === 390, `${mobileDrawer.w}px`);
check('mobile drawer is full height', mobileDrawer.h === 844, `${mobileDrawer.h}px`);
check('mobile virtual list stays small', mobileDrawer.rows <= 20, String(mobileDrawer.rows));
check('drawer causes no horizontal overflow', mobileDrawer.overflow <= 1, `${mobileDrawer.overflow}px`);

/* ---------------- assets & errors ---------------- */
const assetChecks = await page.evaluate(async () => {
  const urls = ['data/manifest.json', 'manifest.webmanifest', 'assets/icon.svg', '404.html', 'robots.txt', 'sitemap.xml'];
  const out = {};
  for (const u of urls) {
    try {
      const r = await fetch(u, { method: 'HEAD' });
      out[u] = r.status;
    } catch (err) { out[u] = 0; }
  }
  return out;
});
for (const [url, status] of Object.entries(assetChecks)) {
  check(`asset ${url} responds 200`, status === 200, String(status));
}

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
check('no failed network requests', failedRequests.length === 0, failedRequests.slice(0, 2).join(' | '));

/* ---------------- screenshots ---------------- */
if (SHOTS) {
  const shots = path.join(ROOT, 'screenshots');
  await mkdir(shots, { recursive: true });
  const shotPage = await newPage({ width: 1440, height: 900 });
  await shotPage.goto(BASE, { waitUntil: 'domcontentloaded' });
  await shotPage.waitForFunction('window.__YTB && window.__YTB.ready', { timeout: 45000 });
  await shotPage.evaluate(() => window.__YTB.clearCaches());
  await shotPage.reload({ waitUntil: 'domcontentloaded' });
  await shotPage.waitForFunction('window.__YTB && window.__YTB.ready', { timeout: 45000 });
  await shotPage.evaluate(() => {
    document.querySelector('#onboard').hidden = true;
    window.__YTB.setTheme('dark');
  });
  await sleep(1800);
  await shotPage.screenshot({ path: path.join(shots, 'desktop-graph.jpg'), type: 'jpeg', quality: 88 });

  await shotPage.evaluate(() => window.__YTB.openTopic('transformer_architecture'));
  await shotPage.waitForFunction("window.__YTB.drawerInfo().items > 0", { timeout: 15000 });
  await sleep(700);
  await shotPage.screenshot({ path: path.join(shots, 'desktop-drawer.jpg'), type: 'jpeg', quality: 88 });

  await shotPage.evaluate(() => window.__YTB.closeDrawer());
  await shotPage.evaluate(() => window.__YTB.openBrowse());
  await sleep(600);
  await shotPage.screenshot({ path: path.join(shots, 'desktop-browse.jpg'), type: 'jpeg', quality: 88 });
  await shotPage.evaluate(() => window.__YTB.closeDrawer());

  await shotPage.evaluate(() => window.__YTB.setTheme('light'));
  await sleep(900);
  await shotPage.screenshot({ path: path.join(shots, 'desktop-light.jpg'), type: 'jpeg', quality: 88 });

  await shotPage.evaluate(() => {
    window.__YTB.setTheme('dark');
    window.__YTB.search('agents');
  });
  await sleep(1600);
  await shotPage.screenshot({ path: path.join(shots, 'desktop-search.jpg'), type: 'jpeg', quality: 88 });

  // social card: 1200x630, graph plus HUD
  await shotPage.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await shotPage.evaluate(() => {
    window.__YTB.closeDrawer();
    document.querySelector('#onboard').hidden = true;
    document.querySelector('#legend').style.display = 'none';
    document.querySelector('.hint-pill').style.display = 'none';
    document.querySelector('#globalSearch').value = '';
    window.__YTB.search('');
  });
  await sleep(1200);
  await shotPage.screenshot({ path: path.join(shots, 'og-cover.png'), type: 'png' });

  const mobileShot = await newPage({ width: 390, height: 844 });
  await mobileShot.goto(BASE, { waitUntil: 'domcontentloaded' });
  await mobileShot.waitForFunction('window.__YTB && window.__YTB.ready', { timeout: 45000 });
  await mobileShot.evaluate(() => { document.querySelector('#onboard').hidden = true; });
  await sleep(1200);
  await mobileShot.screenshot({ path: path.join(shots, 'mobile-graph.jpg'), type: 'jpeg', quality: 88 });
  await mobileShot.evaluate(() => window.__YTB.openTopic('retrieval_augmented_generation'));
  await mobileShot.waitForFunction("window.__YTB.drawerInfo().items > 0", { timeout: 15000 });
  await sleep(700);
  await mobileShot.screenshot({ path: path.join(shots, 'mobile-drawer.jpg'), type: 'jpeg', quality: 88 });
  await mobileShot.close();
  await shotPage.close();
}

await browser.close();
server.kill();

const failed = checks.filter((c) => !c.ok);
console.log(`\n${failed.length ? '✗' : '✓'} ${checks.length - failed.length}/${checks.length} browser checks passed`);
if (failed.length) {
  for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
}
if (consoleErrors.length || pageErrors.length) {
  console.log('\nconsole errors:');
  for (const e of [...new Set(consoleErrors)].slice(0, 6)) console.log('  •', e);
  for (const e of [...new Set(pageErrors)].slice(0, 6)) console.log('  •', e);
}
process.exit(failed.length ? 1 : 0);
