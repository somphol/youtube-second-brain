#!/usr/bin/env node
/**
 * verify.mjs — release gate for the local-first library.
 *
 * Proves the promises that matter:
 *   - no synthetic corpus and no network dataset on boot
 *   - an empty library renders an actionable empty state
 *   - imports persist in IndexedDB; the drawer is local and virtualized
 *   - 5,000-video topics stay at ≤ 20 DOM rows after deep scrolling
 *   - Takeout parsing, grouping, dedupe and search work
 *   - bookmarks/theme survive reload; 390 px has no overflow
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

async function newPage(viewport = { width: 1440, height: 900 }, context = null) {
  const page = context ? await context.newPage() : await browser.newPage();
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
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__YTB && window.__YTB.ready === true', { timeout: 45000 });
await sleep(400);

/* ---------------- empty boot ---------------- */
const empty = await page.evaluate(() => ({
  info: window.__YTB.libraryInfo(),
  stats: window.__YTB.stats(),
  emptyVisible: !document.querySelector('#emptyStage').hidden,
  brand: document.querySelector('#brandVideos').textContent,
  canvas: !!document.querySelector('#canvasHost canvas'),
  chipCount: document.querySelectorAll('#categoryChips .chip').length,
  title: document.title
}));
check('starts with zero videos', empty.info.videos === 0, String(empty.info.videos));
check('starts with zero topics', empty.info.topics === 0, String(empty.info.topics));
check('empty state is visible', empty.emptyVisible === true);
check('no graph is built for an empty library', empty.stats.webgl === false);
check('no synthetic dataset is fetched', !requests.some((u) => u.includes('/data/')), requests.filter((u) => u.includes('/data/')).join(','));
check('header reports zero saved', empty.brand.includes('0 saved'), empty.brand);
check('only the All chip exists', empty.chipCount === 1, String(empty.chipCount));
check('title reflects a personal library', empty.title.includes('YouTube library'), empty.title);

/* ---------------- import 3 real-shaped records ---------------- */
const imported = await page.evaluate(() => window.__YTB.libraryImportRecords([
  { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', channel: 'Rick Astley', topicName: 'Music' },
  { id: '9bZkp7q19f0', title: 'Gangnam Style', channel: 'PSY', topicName: 'Music' },
  { id: 'jNQXAC9IVRw', title: 'Me at the zoo', channel: 'jawed', topicName: 'History' }
], 'Tests'));
await sleep(700);
const filled = await page.evaluate(() => ({
  info: window.__YTB.libraryInfo(),
  stats: window.__YTB.stats(),
  emptyVisible: !document.querySelector('#emptyStage').hidden,
  chips: document.querySelectorAll('#categoryChips .chip').length,
  legend: document.querySelectorAll('#legendList .legend-item').length,
  brand: document.querySelector('#brandVideos').textContent,
  stored: JSON.parse(localStorage.getItem('yt-second-brain:v1') || '{}')
}));
check('import adds three videos', imported.added === 3, JSON.stringify(imported));
check('three videos are live', filled.info.videos === 3, String(filled.info.videos));
check('two topic clusters are built', filled.info.topics === 2, String(filled.info.topics));
check('WebGL graph is created after import', filled.stats.webgl === true);
check('empty state disappears', filled.emptyVisible === false);
check('All + two topic chips', filled.chips === 3, String(filled.chips));
check('legend lists two topics', filled.legend === 2, String(filled.legend));
check('header updates saved count', filled.brand.includes('3 saved'), filled.brand);

/* ---------------- drawer + virtualization ---------------- */
await page.evaluate(() => window.__YTB.openTopic('lib_music'));
await page.waitForFunction('window.__YTB.drawerInfo().items > 0', { timeout: 10000 });
const drawer = await page.evaluate(() => window.__YTB.drawerInfo());
check('topic drawer opens locally', drawer.mode === 'topic');
check('music has two videos', drawer.items === 2, String(drawer.items));
check('drawer source is local', drawer.source === 'local', drawer.source);
check('no shard was fetched', !requests.some((u) => u.includes('/shards/')));

const bookmark = await page.evaluate(() => {
  const btn = document.querySelector('#vlistWindow .mini-btn[data-act="save"]');
  btn?.click();
  return Object.keys(JSON.parse(localStorage.getItem('yt-second-brain:v1') || '{}').bookmarks || {}).length;
});
check('bookmark writes to localStorage', bookmark === 1, String(bookmark));
check('saved badge updates', (await page.$eval('#savedCount', (el) => el.textContent)) === '1');

await page.evaluate(() => window.__YTB.openSaved());
await sleep(300);
check('saved drawer lists the bookmark', (await page.evaluate(() => window.__YTB.drawerInfo().items)) === 1);
await page.evaluate(() => window.__YTB.closeDrawer());

/* ---------------- search ---------------- */
await page.evaluate(() => window.__YTB.search('gangnam'));
await page.waitForFunction('window.__YTB.searchInfo().videos > 0', { timeout: 15000 });
const search = await page.evaluate(() => window.__YTB.searchInfo());
check('library search finds a title', search.videos === 1, String(search.videos));
check('search panel is visible', search.open === true);
check('search reports local mode', search.index === 'local', search.index);
await page.evaluate(() => { document.querySelector('#globalSearch').value = ''; document.querySelector('#globalSearch').dispatchEvent(new Event('input', { bubbles: true })); });
await sleep(250);

/* ---------------- persistence ---------------- */
await page.evaluate(() => window.__YTB.setTheme('light'));
await sleep(250);
check('theme applies', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
await boot(page);
const afterReload = await page.evaluate(() => ({
  info: window.__YTB.libraryInfo(),
  theme: document.documentElement.dataset.theme,
  bookmarks: Object.keys(JSON.parse(localStorage.getItem('yt-second-brain:v1') || '{}').bookmarks || {}).length,
  chips: document.querySelectorAll('#categoryChips .chip').length
}));
check('library survives reload', afterReload.info.videos === 3, String(afterReload.info.videos));
check('theme survives reload', afterReload.theme === 'light');
check('bookmark survives reload', afterReload.bookmarks === 1, String(afterReload.bookmarks));
check('topics rebuild on reload', afterReload.chips === 3, String(afterReload.chips));

await page.evaluate(() => window.__YTB.openTopic('lib_music'));
await page.waitForFunction('window.__YTB.drawerInfo().items > 0', { timeout: 10000 });
check('local drawer still resolves after reload', (await page.evaluate(() => window.__YTB.drawerInfo().source)) === 'local');
await page.evaluate(() => window.__YTB.closeDrawer());

/* ---------------- scale: 5,000-video topic ---------------- */
const scale = await page.evaluate(() => {
  const records = Array.from({ length: 5000 }, (_, i) => ({
    id: 'st' + String(i).padStart(9, '0'),
    title: `Scale Test Video ${i} — a long title for virtualization checks`,
    channel: 'Scale Channel',
    topicName: 'Scale Test'
  }));
  return window.__YTB.libraryImportRecords(records, 'Scale Test');
});
await sleep(1200);
await page.waitForFunction("window.__YTB.state.personal.searchStatus === 'ready'", { timeout: 30000 }).catch(() => {});
await page.evaluate(() => window.__YTB.openTopic('lib_scale_test'));
await page.waitForFunction('window.__YTB.drawerInfo().items > 0', { timeout: 15000 });
const scaleTop = await page.evaluate(() => window.__YTB.drawerInfo());
check('5,000-video topic imports', scale.added === 5000, String(scale.added));
check('scale topic has 5,000 rows', scaleTop.items === 5000, String(scaleTop.items));
check('scale topic opens locally', scaleTop.source === 'local');
check('scale list keeps DOM small', scaleTop.rendered <= 20, String(scaleTop.rendered));

const scrollCheck = await page.evaluate(async () => {
  const sc = document.querySelector('#drawerScroll');
  const before = document.querySelector('#vlistWindow .vrow .idx')?.textContent;
  sc.scrollTop = 3200 * 92;
  await new Promise((r) => setTimeout(r, 200));
  return {
    before,
    after: document.querySelector('#vlistWindow .vrow .idx')?.textContent,
    rows: document.querySelectorAll('#vlistWindow .vrow').length,
    scrollHeight: sc.scrollHeight,
    clientHeight: sc.clientHeight
  };
});
check('deep scroll keeps DOM small', scrollCheck.rows <= 20, String(scrollCheck.rows));
check('deep scroll moves the window', scrollCheck.before !== scrollCheck.after, `${scrollCheck.before} → ${scrollCheck.after}`);
check('scroll height covers 5,000 rows', scrollCheck.scrollHeight > 400000, String(scrollCheck.scrollHeight));

await page.evaluate(() => window.__YTB.search('Scale Test Video 4321'));
await page.waitForFunction('window.__YTB.searchInfo().videos > 0', { timeout: 15000 });
check('search is indexed at 5k scale', (await page.evaluate(() => window.__YTB.searchInfo().videos)) >= 1);
await page.evaluate(() => window.__YTB.closeDrawer());

/* ---------------- Takeout parsing + grouping ---------------- */
await page.evaluate(() => window.__YTB.resetLibrary());
await sleep(400);
check('reset clears the library', (await page.evaluate(() => window.__YTB.libraryInfo().videos)) === 0);

const takeout = await page.evaluate(async () => {
  const entries = [
    { title: 'Watched Alpha', titleUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', subtitles: [{ name: 'Channel One' }], time: '2022-04-01T10:00:00.000Z' },
    { title: 'Watched Beta', titleUrl: 'https://www.youtube.com/watch?v=bbbbbbbbbbb', subtitles: [{ name: 'Channel Two' }], time: '2022-05-01T10:00:00.000Z' },
    { title: 'Watched Gamma', titleUrl: 'https://www.youtube.com/watch?v=ccccccccccc', subtitles: [{ name: 'Channel One' }], time: '2023-01-01T10:00:00.000Z' },
    { title: 'A video that has been removed', subtitles: [{ name: 'Channel One' }], time: '2023-02-01T10:00:00.000Z' }
  ];
  const first = await window.__YTB.importTakeout(entries, 'year', 'History');
  const second = await window.__YTB.importTakeout(entries, 'year', 'History');
  return { first, second, info: window.__YTB.libraryInfo(), topics: window.__YTB.state.personal.topics.map((t) => t.name).sort() };
});
check('Takeout parse skips removed entries', takeout.first.added === 3, JSON.stringify(takeout.first));
check('dedupe skips repeated history', takeout.second.added === 0 && takeout.second.skipped === 3, JSON.stringify(takeout.second));
check('year grouping creates year topics', JSON.stringify(takeout.topics) === JSON.stringify(['2022', '2023']), JSON.stringify(takeout.topics));

const channelGroup = await page.evaluate(async () => {
  const entries = [
    { title: 'Watched One', titleUrl: 'https://www.youtube.com/watch?v=ddddddddddd', subtitles: [{ name: 'Alpha Channel' }], time: '2024-01-01T00:00:00Z' },
    { title: 'Watched Two', titleUrl: 'https://www.youtube.com/watch?v=eeeeeeeeeee', subtitles: [{ name: 'Alpha Channel' }], time: '2024-02-01T00:00:00Z' },
    { title: 'Watched Three', titleUrl: 'https://www.youtube.com/watch?v=fffffffffff', subtitles: [{ name: 'Beta Channel' }], time: '2024-03-01T00:00:00Z' }
  ];
  const r = await window.__YTB.importTakeout(entries, 'channel', 'History');
  return { r, topics: window.__YTB.state.personal.topics.map((t) => t.name).sort() };
});
check('channel grouping creates channel topics', channelGroup.r.added === 3 && channelGroup.topics.includes('Alpha Channel') && channelGroup.topics.includes('Beta Channel'), JSON.stringify(channelGroup.topics));

/* ---------------- mobile ---------------- */
const mobileCtx = await browser.createBrowserContext();
const mobile = await newPage({ width: 390, height: 844 }, mobileCtx);
await boot(mobile);
const mobileBase = await mobile.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  empty: !document.querySelector('#emptyStage').hidden,
  headerH: document.querySelector('.topbar').getBoundingClientRect().height
}));
check('mobile has no horizontal overflow', mobileBase.overflow <= 1, `${mobileBase.overflow}px`);
check('mobile empty state is usable', mobileBase.empty === true);
await mobile.evaluate(() => window.__YTB.libraryImportRecords([
  { id: 'jNQXAC9IVRw', title: 'Me at the zoo', channel: 'jawed', topicName: 'History' },
  { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', channel: 'Rick Astley', topicName: 'Music' }
], 'Mobile'));
await mobile.waitForFunction("window.__YTB.libraryInfo().videos > 0", { timeout: 10000 });
await mobile.evaluate(() => window.__YTB.openTopic('lib_music'));
await mobile.waitForFunction('window.__YTB.drawerInfo().items > 0', { timeout: 10000 });
await sleep(500);
const mobileDrawer = await mobile.evaluate(() => {
  const d = document.querySelector('#drawer').getBoundingClientRect();
  return {
    w: Math.round(d.width), h: Math.round(d.height),
    rows: document.querySelectorAll('#vlistWindow .vrow').length,
    overflow: document.documentElement.scrollWidth - innerWidth
  };
});
check('mobile drawer is full width', mobileDrawer.w === 390, `${mobileDrawer.w}px`);
check('mobile drawer is full height', mobileDrawer.h === 844, `${mobileDrawer.h}px`);
check('mobile list stays small', mobileDrawer.rows <= 20, String(mobileDrawer.rows));
check('drawer causes no mobile overflow', mobileDrawer.overflow <= 1, `${mobileDrawer.overflow}px`);

/* ---------------- assets + hygiene ---------------- */
const assetChecks = await page.evaluate(async () => {
  const urls = ['manifest.webmanifest', 'assets/icon.svg', '404.html', 'robots.txt', 'sitemap.xml'];
  const out = {};
  for (const u of urls) {
    try { out[u] = (await fetch(u, { method: 'HEAD' })).status; } catch (err) { out[u] = 0; }
  }
  return out;
});
for (const [url, status] of Object.entries(assetChecks)) {
  check(`asset ${url} responds 200`, status === 200, String(status));
}
check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 2).join(' | '));

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
  await shotPage.evaluate(() => window.__YTB.setTheme('dark'));
  await sleep(700);
  await shotPage.screenshot({ path: path.join(shots, 'desktop-empty.jpg'), type: 'jpeg', quality: 88 });

  await shotPage.evaluate(() => window.__YTB.libraryImportRecords([
    { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', channel: 'Rick Astley', topicName: 'Music' },
    { id: '9bZkp7q19f0', title: 'Gangnam Style', channel: 'PSY', topicName: 'Music' },
    { id: 'jNQXAC9IVRw', title: 'Me at the zoo', channel: 'jawed', topicName: 'History' },
    { id: 'kJQP7kiw5Fk', title: 'Despacito', channel: 'Luis Fonsi', topicName: 'Music' },
    { id: 'JGwWNGJdvx8', title: 'Shape of You', channel: 'Ed Sheeran', topicName: 'Music' },
    { id: 'RgKAFK5djSk', title: 'See You Again', channel: 'Wiz Khalifa', topicName: 'Music' },
    { id: 'OPf0YbXqDm0', title: 'Uptown Funk', channel: 'Mark Ronson', topicName: 'Production' },
    { id: 'hT_nvWreIhg', title: 'Counting Stars', channel: 'OneRepublic', topicName: 'Production' },
    { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', channel: 'Queen', topicName: 'History' },
    { id: 'CevxZvSJLk8', title: 'Roar', channel: 'Katy Perry', topicName: 'Production' }
  ], 'Demo'));
  await sleep(1400);
  await shotPage.screenshot({ path: path.join(shots, 'desktop-graph.jpg'), type: 'jpeg', quality: 88 });

  await shotPage.evaluate(() => window.__YTB.openTopic('lib_music'));
  await shotPage.waitForFunction('window.__YTB.drawerInfo().items > 0', { timeout: 10000 });
  await sleep(800);
  await shotPage.screenshot({ path: path.join(shots, 'desktop-drawer.jpg'), type: 'jpeg', quality: 88 });

  await shotPage.evaluate(() => window.__YTB.openLibrary());
  await sleep(700);
  await shotPage.screenshot({ path: path.join(shots, 'desktop-library.jpg'), type: 'jpeg', quality: 88 });
  await shotPage.evaluate(() => window.__YTB.closeLibrary());

  await shotPage.evaluate(() => window.__YTB.setTheme('light'));
  await sleep(900);
  await shotPage.screenshot({ path: path.join(shots, 'desktop-light.jpg'), type: 'jpeg', quality: 88 });

  await shotPage.evaluate(() => { window.__YTB.setTheme('dark'); window.__YTB.search('music'); });
  await sleep(1200);
  await shotPage.screenshot({ path: path.join(shots, 'desktop-search.jpg'), type: 'jpeg', quality: 88 });

  await shotPage.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await shotPage.evaluate(() => {
    window.__YTB.closeDrawer();
    document.querySelector('#globalSearch').value = '';
    window.__YTB.search('');
    document.querySelector('#legend').style.display = 'none';
    document.querySelector('.hint-pill').style.display = 'none';
  });
  await sleep(900);
  await shotPage.screenshot({ path: path.join(shots, 'og-cover.png'), type: 'png' });

  const shotCtx = await browser.createBrowserContext();
  const mobileShot = await newPage({ width: 390, height: 844 }, shotCtx);
  await mobileShot.goto(BASE, { waitUntil: 'domcontentloaded' });
  await mobileShot.waitForFunction('window.__YTB && window.__YTB.ready', { timeout: 45000 });
  await mobileShot.evaluate(() => window.__YTB.libraryImportRecords([
    { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', channel: 'Rick Astley', topicName: 'Music' },
    { id: 'jNQXAC9IVRw', title: 'Me at the zoo', channel: 'jawed', topicName: 'History' }
  ], 'Mobile'));
  await sleep(1000);
  await mobileShot.screenshot({ path: path.join(shots, 'mobile-graph.jpg'), type: 'jpeg', quality: 88 });
  await mobileShot.evaluate(() => window.__YTB.openTopic('lib_music'));
  await mobileShot.waitForFunction('window.__YTB.drawerInfo().items > 0', { timeout: 10000 });
  await sleep(700);
  await mobileShot.screenshot({ path: path.join(shots, 'mobile-drawer.jpg'), type: 'jpeg', quality: 88 });
  await mobileShot.close();
  await shotCtx.close();
  await shotPage.close();
}

await browser.close();
server.kill();

const failed = checks.filter((c) => !c.ok);
console.log(`\n${failed.length ? '✗' : '✓'} ${checks.length - failed.length}/${checks.length} browser checks passed`);
if (failed.length) for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
if (consoleErrors.length || pageErrors.length) {
  console.log('\nconsole errors:');
  for (const e of [...new Set(consoleErrors)].slice(0, 6)) console.log('  •', e);
  for (const e of [...new Set(pageErrors)].slice(0, 6)) console.log('  •', e);
}
process.exit(failed.length ? 1 : 0);
