#!/usr/bin/env node
/**
 * verify-data.mjs — integrity gate for the sharded corpus.
 * Fails loudly if the manifest, shards or search assets drift apart.
 *
 * Usage: node scripts/verify-data.mjs
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');

let pass = 0;
const fails = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; return; }
  fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const json = async (p) => JSON.parse(await readFile(p, 'utf8'));

const manifest = await json(path.join(DATA, 'manifest.json'));
const stats = await json(path.join(DATA, 'stats.json'));
const keywordRaw = await readFile(path.join(DATA, 'search_index.json'), 'utf8');
const videoRaw = await readFile(path.join(DATA, 'video_index.json'), 'utf8');

const videos = manifest.totals.videos;
const topics = manifest.topics;
const cats = manifest.categories;

check('manifest version', manifest.version === 1);
check('synthetic corpus is declared', manifest.synthetic === true);
check('at least 100,000 videos', videos >= 100_000, `got ${videos}`);
check('480 topics', topics.length === 480, `got ${topics.length}`);
check('12 categories', cats.length === 12, `got ${cats.length}`);
check('unique topic ids', new Set(topics.map((t) => t.id)).size === topics.length);
check('topic shard paths are unique', new Set(topics.map((t) => t.shard)).size === topics.length);
check('topic counts sum to total', topics.reduce((s, t) => s + t.count, 0) === videos);
check('category counts sum to total', cats.reduce((s, c) => s + c.count, 0) === videos);
check('manifest is small', (await stat(path.join(DATA, 'manifest.json'))).size < 300_000);
check('keyword index is small', keywordRaw.length < 600_000, `${keywordRaw.length} bytes`);
check('edges exist', manifest.edges.length > 500, `${manifest.edges.length}`);
check('every category has 40 topics',
  cats.every((c) => topics.filter((t) => t.category === c.id).length === 40));

const ids = new Set();
let globalVideos = 0;
let maxShard = 0;
let minShard = Infinity;
const badCoords = [];
const catIds = new Set(cats.map((c) => c.id));

for (const [i, t] of topics.entries()) {
  const shard = await json(path.join(DATA, t.shard));
  check(`shard exists ${t.id}`, !!shard, t.shard);
  if (!shard) continue;
  globalVideos += shard.videos.length;
  check(`shard count matches ${t.id}`, shard.videos.length === t.count, `${shard.videos.length} vs ${t.count}`);
  check(`shard header matches ${t.id}`, shard.name === t.name && shard.category === t.category);
  check(`valid category ${t.id}`, catIds.has(t.category));
  check(`finite coords ${t.id}`, t.pos.every((v) => Number.isFinite(v)) && t.pos.every((v) => Math.abs(v) < 16), String(t.pos));
  check(`positive radius ${t.id}`, t.radius > 0.05 && t.radius < 2);
  maxShard = Math.max(maxShard, shard.videos.length);
  minShard = Math.min(minShard, shard.videos.length);
  check(`has videos ${t.id}`, shard.videos.length > 0);
  for (const v of shard.videos.slice(0, 25)) {
    check(`video fields ${t.id}`, typeof v.title === 'string' && v.title.length > 2 && typeof v.channel === 'string');
    check(`video id shape ${t.id}`, /^[A-Za-z0-9_-]{11}$/.test(v.id), v.id);
    check(`duration ${t.id}`, Number.isInteger(v.duration) && v.duration > 0);
    check(`views ${t.id}`, Number.isInteger(v.views) && v.views > 0);
    check(`published ${t.id}`, /^\d{4}-\d{2}-\d{2}$/.test(v.published));
  }
  for (const v of shard.videos) {
    if (ids.has(v.id)) { badCoords.push(v.id); break; }
    ids.add(v.id);
  }
}
check('all videos accounted for', globalVideos === videos, `${globalVideos}`);
check('global video ids are unique', badCoords.length === 0, badCoords.slice(0, 3).join(','));
check('largest shard has thousands', maxShard >= 3000, String(maxShard));
check('min shard >= 60', minShard >= 60, String(minShard));

const badEdges = manifest.edges.filter(([a, b, w]) =>
  !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 ||
  a >= topics.length || b >= topics.length || a === b || !(w > 0 && w <= 1.1));
check('edges are valid', badEdges.length === 0, `${badEdges.length} bad`);

const keywordIndex = MiniSearch.loadJSON(keywordRaw, {
  fields: ['name', 'categoryName'],
  storeFields: ['type', 'name', 'category', 'categoryName', 'count', 'slug'],
  idField: 'id'
});
check('keyword index has all topics', keywordIndex.search('transformer', { limit: 20 }).length > 0);
check('keyword index finds RAG', keywordIndex.search('retrieval', { limit: 5 }).length > 0);
check('keyword index includes channels', keywordIndex.search('labs', { limit: 5 }).length > 0);

const videoIndex = MiniSearch.loadJSON(videoRaw, {
  fields: ['t'], storeFields: ['k', 'n'], idField: 'id'
});
check('video index document count', videoIndex.documentCount === videos, `${videoIndex.documentCount}`);
const sample = videoIndex.search('transformer', { limit: 5 });
check('video index finds titles', sample.length > 0);
for (const hit of sample) {
  const topic = topics[hit.k];
  const shard = await json(path.join(DATA, topic.shard));
  const video = shard.videos[hit.n];
  check('video index position resolves', !!video, `k=${hit.k} n=${hit.n}`);
}

check('stats video count matches', stats.totals.videos === videos);
check('stats digest recorded', /^[0-9a-f]{16}$/.test(stats.digest));
check('seed is recorded', Number.isInteger(stats.seed));

const diskMb = (stats.bytes.total / 1048576).toFixed(1);
if (fails.length) {
  console.error(`\n✗ ${fails.length} data check(s) failed (${pass} passed)\n`);
  for (const f of fails.slice(0, 30)) console.error(`  • ${f}`);
  process.exit(1);
}
console.log(`✓ data verified — ${pass} checks`);
console.log(`  ${videos.toLocaleString()} videos · ${topics.length} topics · ${manifest.edges.length} links · ${diskMb} MB on disk`);
console.log(`  largest shard ${maxShard.toLocaleString()} videos · digest ${stats.digest}`);
