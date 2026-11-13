#!/usr/bin/env node
/**
 * build-data.mjs — deterministic corpus builder for YouTube Second Brain 100k.
 *
 * Produces:
 *   data/manifest.json       taxonomy, counts, shard paths, pre-computed 3D coords, edges
 *   data/search_index.json   MiniSearch index over topics + channels (small, boot asset)
 *   data/video_index.json    MiniSearch index over all video titles (deferred asset)
 *   data/shards/<slug>.json  one shard per topic
 *   data/stats.json          machine-readable corpus statistics
 *
 * The corpus is SYNTHETIC. Titles, channels and view counts are generated from
 * taxonomy.mjs so the project can demonstrate 100k-record behaviour without
 * redistributing YouTube metadata. Every record is clearly marked in the docs.
 *
 * Usage: node scripts/build-data.mjs [--out data] [--videos 108000] [--seed 20261113]
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import MiniSearch from 'minisearch';
import {
  CATEGORIES, CHANNELS, TITLE_PREFIXES, TITLE_SUFFIXES, CHANNEL_SUFFIXES
} from './taxonomy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ------------------------------- argv ---------------------------------- */
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const OUT = path.resolve(ROOT, arg('--out', 'data'));
const TARGET_VIDEOS = Number(arg('--videos', 108000));
const SEED = Number(arg('--seed', 20261113));

/* ------------------------------- rng ----------------------------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const gauss = () => {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* ------------------------------ helpers -------------------------------- */
export function slugify(s) {
  return s.toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
function videoId() {
  let s = '';
  for (let i = 0; i < 11; i++) s += B64[Math.floor(rand() * B64.length)];
  return s;
}

const now = new Date();
const GENERATED_AT = now.toISOString();
const year = now.getUTCFullYear();
const dayMs = 86400000;

/* --------------------------- topic counts ------------------------------ */
const flat = [];
for (const cat of CATEGORIES) {
  cat.keywords.forEach((name, rank) => {
    flat.push({ name, cat, rank });
  });
}

const FLAGSHIP = new Set([
  'Transformer Architecture', 'Retrieval Augmented Generation', 'AI Agents',
  'AI UX Patterns', 'Inference Latency', 'LoRA', 'LLM Evaluation', 'AI Product Strategy'
]);

const rawWeights = flat.map((k, i) => {
  const base = 1 / Math.pow(k.rank + 1.7, 0.78);
  const boost = FLAGSHIP.has(k.name) ? 4.4 : 1;
  const jitter = 0.72 + rand() * 0.62;
  return base * boost * jitter;
});

const sumW = rawWeights.reduce((a, b) => a + b, 0);
const MIN = 60;
let counts = rawWeights.map((w) => Math.max(MIN, Math.round((w / sumW) * TARGET_VIDEOS)));
let delta = TARGET_VIDEOS - counts.reduce((a, b) => a + b, 0);
// distribute the rounding delta across the largest topics
const order = counts.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c);
let guard = 0;
while (delta !== 0 && guard++ < 2_000_000) {
  for (const { i } of order) {
    if (delta === 0) break;
    const step = delta > 0 ? 1 : -1;
    if (delta < 0 && counts[i] <= MIN) continue;
    counts[i] += step;
    delta -= step;
  }
}

/* --------------------------- channels ---------------------------------- */
const channelPools = {};
let channelSeq = 0;
const allChannels = [];
for (const cat of CATEGORIES) {
  const bases = CHANNELS[cat.id];
  const names = new Set();
  while (names.size < 26) {
    const base = pick(bases);
    const suffix = pick(CHANNEL_SUFFIXES);
    names.add(base + suffix);
  }
  channelPools[cat.id] = [...names].map((name) => {
    const ch = {
      id: `ch_${++channelSeq}`,
      name,
      category: cat.id,
      categoryName: cat.name,
      hue: cat.hue,
      subscribers: Math.round(1200 * Math.exp(gauss() * 1.5))
    };
    allChannels.push(ch);
    return ch;
  });
}

/* ---------------------------- 3D layout -------------------------------- */
// One cluster centre per category on a Fibonacci sphere; nodes scatter around
// their category centre. Everything is pre-computed so the browser never runs
// a force simulation for 480 nodes.
const R = 7.4;
const centres = CATEGORIES.map((cat, i) => {
  const n = CATEGORIES.length;
  const phi = Math.acos(1 - 2 * (i + 0.5) / n);
  const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
  return {
    cat,
    x: Math.cos(theta) * Math.sin(phi) * R,
    y: Math.cos(phi) * R,
    z: Math.sin(theta) * Math.sin(phi) * R
  };
});

const nodes = [];
const coordIndex = new Map();
for (const [i, k] of flat.entries()) {
  const centre = centres[CATEGORIES.indexOf(k.cat)];
  const radius = 0.55 + Math.pow(rand(), 0.6) * 2.05;
  // random direction, biased to keep cluster readable
  const u = rand() * 2 - 1;
  const t = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  const x = centre.x + Math.cos(t) * s * radius;
  const y = centre.y + u * radius * 0.72;
  const z = centre.z + Math.sin(t) * s * radius;
  const count = counts[i];
  const node = {
    i,
    id: slugify(k.name),
    name: k.name,
    category: k.cat.id,
    categoryName: k.cat.name,
    categoryIndex: CATEGORIES.indexOf(k.cat),
    count,
    radius: Number((0.12 + 0.2 * Math.log(count / MIN)).toFixed(3)),
    x: Number(x.toFixed(3)),
    y: Number(y.toFixed(3)),
    z: Number(z.toFixed(3))
  };
  coordIndex.set(node.id, node);
  nodes.push(node);
}

// Duplicate slugs are impossible for the curated taxonomy, but guard anyway.
const slugSeen = new Set();
for (const n of nodes) {
  if (slugSeen.has(n.id)) throw new Error(`Duplicate slug: ${n.id}`);
  slugSeen.add(n.id);
}

/* ----------------------------- edges ----------------------------------- */
const edges = [];
const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const seenEdge = new Set();
function addEdge(a, b, weight) {
  if (a === b) return;
  const key = edgeKey(a, b);
  if (seenEdge.has(key)) return;
  seenEdge.add(key);
  edges.push([Math.min(a, b), Math.max(a, b), Number(weight.toFixed(2))]);
}

// k-nearest neighbours inside each category (cheap O(n^2) over 40 nodes)
for (const cat of CATEGORIES) {
  const group = nodes.filter((n) => n.category === cat.id);
  for (const a of group) {
    const near = group
      .filter((b) => b !== a)
      .map((b) => ({ b, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 }))
      .sort((p, q) => p.d - q.d)
      .slice(0, 3);
    for (const { b, d } of near) addEdge(a.i, b.i, 0.9 / (1 + d));
  }
}
// A handful of cross-category bridges between cluster centres' closest topics
for (let c = 0; c < centres.length; c++) {
  const a = centres[c];
  const b = centres[(c + 5) % centres.length];
  const pickNearest = (from, to) => nodes
    .filter((n) => n.category === from.cat.id)
    .sort((p, q) =>
      ((p.x - to.x) ** 2 + (p.y - to.y) ** 2 + (p.z - to.z) ** 2) -
      ((q.x - to.x) ** 2 + (q.y - to.y) ** 2 + (q.z - to.z) ** 2))[0];
  const na = pickNearest(a, b);
  const nb = pickNearest(b, a);
  addEdge(na.i, nb.i, 0.35);
}

/* ---------------------------- titles ----------------------------------- */
const ANGLES = [
  'Latency, Cost and Tradeoffs', 'What the Benchmarks Miss', 'Failure Modes', 'A Visual Explanation',
  'Production Notes', 'The Math Behind It', 'Lessons From 50 Deployments', 'Under the Hood',
  'Compared With Alternatives', 'Debugging Guide', 'A Minimal Implementation', 'Where It Breaks',
  'The 2026 Edition', 'For Smaller Teams', 'Cost per Token', 'Three Common Mistakes',
  'What Changed This Year', 'An Honest Review', 'Scaling Behaviour', 'Before You Commit'
];
const SERIES = ['Part 1', 'Part 2', 'Part 3', 'Ep. 12', 'Ep. 27', 'Ep. 41', 'Season 2', 'Revisited'];

function makeTitle(keyword, used, idx) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const prefix = pick(TITLE_PREFIXES);
    const suffix = pick(TITLE_SUFFIXES);
    let base;
    if (attempt < 22) base = `${prefix}${keyword}${suffix}`;
    else if (attempt < 52) base = `${prefix}${keyword} — ${pick(ANGLES)}`;
    else base = `${prefix}${keyword}: ${pick(ANGLES)}`;
    if (attempt > 52 && rand() < 0.28) base += ` (${pick(SERIES)})`;
    if (!used.has(base)) { used.add(base); return base; }
  }
  const fallback = `${keyword} — Field Notes ${idx + 1}`;
  used.add(fallback);
  return fallback;
}

const viewFor = (type) => {
  const base = type === 'short' ? 9.4 : type === 'live' ? 9.0 : 8.5;
  return Math.round(clamp(Math.exp(base + gauss() * 1.25), 320, 40_000_000));
};

function publishedFor(index, total) {
  // skew recent: 2026 is the most likely year, then walk backwards
  const u = rand();
  const yearsBack = Math.floor(Math.pow(u, 0.55) * 11);
  const y = year - yearsBack;
  const dayOfYear = Math.floor(rand() * 365);
  const ms = Date.UTC(y, 0, 1) + dayOfYear * dayMs;
  const cap = now.getTime() - 2 * dayMs;
  return new Date(Math.min(ms, cap)).toISOString().slice(0, 10);
}

/* ---------------------------- build ------------------------------------ */
const usedIds = new Set();
const shards = [];
const indexDocs = [];
const videoDocs = [];
let globalPos = 0;

for (const node of nodes) {
  const cat = CATEGORIES[node.categoryIndex];
  const pool = channelPools[cat.id];
  const used = new Set();
  const videos = [];
  const pendingDocs = [];

  for (let v = 0; v < node.count; v++) {
    let id;
    do { id = videoId(); } while (usedIds.has(id));
    usedIds.add(id);

    const t = rand();
    const type = t < 0.78 ? 'video' : t < 0.90 ? 'short' : t < 0.95 ? 'live' : 'podcast';
    const duration = type === 'short'
      ? 20 + Math.floor(rand() * 40)
      : type === 'live'
        ? 1800 + Math.floor(rand() * 7200)
        : type === 'podcast'
          ? 1500 + Math.floor(rand() * 5400)
          : 240 + Math.floor(Math.pow(rand(), 0.7) * 3300);

    const channel = pool[Math.floor(Math.pow(rand(), 1.35) * pool.length)];
    const title = makeTitle(node.name, used, v);

    const video = {
      id,
      title,
      channel: channel.name,
      channelId: channel.id,
      duration,
      views: viewFor(type),
      published: publishedFor(v, node.count),
      type
    };
    videos.push(video);
    pendingDocs.push({ id: globalPos++, t: title });
  }

  // stable, useful default order: newest first
  videos.sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : b.views - a.views));

  // The global title index stores (keyword index, position in shard). Positions
  // must be measured AFTER the shard is sorted.
  const posById = new Map(videos.map((v, idx) => [v.id, idx]));
  for (let d = 0; d < pendingDocs.length; d++) {
    videoDocs.push({
      id: pendingDocs[d].id,
      t: pendingDocs[d].t,
      k: node.i,
      n: posById.get(videos[d].id)
    });
  }

  // re-map index positions after sorting
  const shard = {
    version: 1,
    id: node.id,
    name: node.name,
    slug: node.id,
    category: cat.id,
    categoryName: cat.name,
    count: videos.length,
    generatedAt: GENERATED_AT,
    synthetic: true,
    videos
  };
  shards.push(shard);

  indexDocs.push({
    id: `kw:${node.id}`,
    type: 'topic',
    name: node.name,
    category: cat.id,
    categoryName: cat.name,
    count: node.count,
    slug: node.id
  });
}

for (const ch of allChannels) {
  indexDocs.push({
    id: ch.id,
    type: 'channel',
    name: ch.name,
    category: ch.category,
    categoryName: ch.categoryName,
    count: Math.round(ch.subscribers / 100),
    slug: 'channel'
  });
}

/* --------------------------- write files ------------------------------- */
await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(OUT, 'shards'), { recursive: true });

const manifest = {
  version: 1,
  name: 'YouTube Second Brain 100k',
  generatedAt: GENERATED_AT,
  generator: 'scripts/build-data.mjs',
  seed: SEED,
  synthetic: true,
  notice: 'Synthetic demo corpus. Titles, channels and counts are generated for scale testing, not scraped from YouTube.',
  totals: {
    videos: videoDocs.length,
    topics: nodes.length,
    categories: CATEGORIES.length,
    channels: allChannels.length,
    shards: shards.length
  },
  categories: CATEGORIES.map((c, i) => ({
    id: c.id,
    name: c.name,
    short: c.short,
    hue: c.hue,
    blurb: c.blurb,
    count: nodes.filter((n) => n.category === c.id).reduce((s, n) => s + n.count, 0),
    centre: [centres[i].x, centres[i].y, centres[i].z].map((v) => Number(v.toFixed(2)))
  })),
  topics: nodes.map((n) => ({
    id: n.id,
    name: n.name,
    category: n.category,
    categoryName: n.categoryName,
    count: n.count,
    radius: n.radius,
    pos: [n.x, n.y, n.z],
    shard: `shards/${n.id}.json`
  })),
  edges,
  assets: {
    searchIndex: 'search_index.json',
    videoIndex: 'video_index.json'
  },
  schema: {
    video: {
      id: 'YouTube-style 11 char id (synthetic)',
      title: 'string',
      channel: 'string',
      channelId: 'string',
      duration: 'seconds',
      views: 'integer',
      published: 'YYYY-MM-DD',
      type: 'video | short | live | podcast'
    }
  }
};

const keywordIndex = new MiniSearch({
  idField: 'id',
  fields: ['name', 'categoryName'],
  storeFields: ['type', 'name', 'category', 'categoryName', 'count', 'slug'],
  searchOptions: { boost: { name: 3 }, fuzzy: 0.2, prefix: true }
});
keywordIndex.addAll(indexDocs);

const videoIndex = new MiniSearch({
  idField: 'id',
  fields: ['t'],
  storeFields: ['k', 'n'],
  searchOptions: { fuzzy: 0.15, prefix: true }
});
videoIndex.addAll(videoDocs);

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
await writeFile(path.join(OUT, 'search_index.json'), JSON.stringify(keywordIndex));
await writeFile(path.join(OUT, 'video_index.json'), JSON.stringify(videoIndex));
for (const shard of shards) {
  await writeFile(path.join(OUT, 'shards', `${shard.id}.json`), JSON.stringify(shard));
}

/* ---------------------------- statistics ------------------------------- */
const { statSync } = await import('node:fs');
const sizeOf = (p) => statSync(p).size;
const shardBytes = shards.reduce((s, sh) => s + sizeOf(path.join(OUT, 'shards', `${sh.id}.json`)), 0);
const sorted = [...nodes].sort((a, b) => b.count - a.count);

const stats = {
  generatedAt: GENERATED_AT,
  seed: SEED,
  targetVideos: TARGET_VIDEOS,
  totals: manifest.totals,
  bytes: {
    manifest: sizeOf(path.join(OUT, 'manifest.json')),
    searchIndex: sizeOf(path.join(OUT, 'search_index.json')),
    videoIndex: sizeOf(path.join(OUT, 'video_index.json')),
    shards: shardBytes,
    total: shardBytes + sizeOf(path.join(OUT, 'manifest.json')) +
      sizeOf(path.join(OUT, 'search_index.json')) + sizeOf(path.join(OUT, 'video_index.json'))
  },
  largestTopics: sorted.slice(0, 10).map((n) => ({ name: n.name, count: n.count })),
  smallestTopics: sorted.slice(-5).map((n) => ({ name: n.name, count: n.count })),
  videosPerShard: {
    min: sorted[sorted.length - 1].count,
    max: sorted[0].count,
    mean: Math.round(videoDocs.length / nodes.length)
  },
  edges: edges.length,
  digest: ''
};

const digestInput = JSON.stringify([
  manifest.totals, SEED, counts, nodes.map((n) => [n.id, n.x, n.y, n.z])
]);
stats.digest = createHash('sha256').update(digestInput).digest('hex').slice(0, 16);

await writeFile(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 2));
await writeFile(path.join(OUT, 'VERSION'), `1.0.0-${stats.digest}\n`);

console.log(`built ${videoDocs.length.toLocaleString()} videos across ${nodes.length} topics`);
console.log(`shards ${(shardBytes / 1048576).toFixed(1)} MB · video index ${(stats.bytes.videoIndex / 1048576).toFixed(1)} MB · keyword index ${(stats.bytes.searchIndex / 1024).toFixed(0)} KB`);
console.log(`largest: ${stats.largestTopics[0].name} (${stats.largestTopics[0].count}) · digest ${stats.digest}`);
