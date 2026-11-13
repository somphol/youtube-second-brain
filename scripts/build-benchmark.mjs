#!/usr/bin/env node
/**
 * build-benchmark.mjs — OPTIONAL capacity fixture. Not shipped, not loaded by the app.
 *
 * Generates benchmark/library-100k.json: 100,000 synthetic records in the same shape
 * the local importer accepts. Use it to prove the library survives 100k videos:
 *
 *   npm run benchmark:build
 *   npm run serve
 *   # open the app, My library → Import Takeout / JSON → benchmark/library-100k.json
 *
 * The file is gitignored. The app starts empty and never reads this fixture.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, CHANNELS, TITLE_PREFIXES, TITLE_SUFFIXES } from './taxonomy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'benchmark');
const TOTAL = Number(process.argv[process.argv.indexOf('--videos') + 1]) || 100000;
const SEED = Number(process.argv[process.argv.indexOf('--seed') + 1]) || 20261113;

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
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

const topics = [];
for (const cat of CATEGORIES) {
  for (const name of cat.keywords) topics.push({ name, category: cat.id, hue: cat.hue });
}

// Zipf-ish topic sizes so a few topics hold thousands of videos (the case the
// virtualized drawer must survive) while still spanning all 480 topics.
const weights = topics.map((_, i) => 1 / Math.pow(i + 2, 0.72));
const sumW = weights.reduce((a, b) => a + b, 0);
const counts = weights.map((w) => Math.max(40, Math.round((w / sumW) * TOTAL)));
let delta = TOTAL - counts.reduce((a, b) => a + b, 0);
for (let i = 0; delta !== 0; i = (i + 1) % counts.length) {
  const step = delta > 0 ? 1 : -1;
  if (delta < 0 && counts[i] <= 40) continue;
  counts[i] += step;
  delta -= step;
}

const usedIds = new Set();
const usedTitles = new Set();
function videoId() {
  let id;
  do {
    id = '';
    for (let i = 0; i < 11; i++) id += B64[Math.floor(rand() * B64.length)];
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}
function title(topic, i) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const base = `${pick(TITLE_PREFIXES)}${topic}${pick(TITLE_SUFFIXES)}`;
    const candidate = attempt > 20 ? `${base} — Part ${(i % 9) + 1}` : base;
    if (!usedTitles.has(candidate)) { usedTitles.add(candidate); return candidate; }
  }
  const fallback = `${topic} — Field Notes ${i + 1}`;
  usedTitles.add(fallback);
  return fallback;
}

const videos = [];
const now = Date.now();
for (let t = 0; t < topics.length; t++) {
  const topic = topics[t];
  const cat = CATEGORIES.find((c) => c.id === topic.category);
  const channels = CHANNELS[topic.category];
  for (let i = 0; i < counts[t]; i++) {
    const daysAgo = Math.floor(Math.pow(rand(), 0.7) * 1200);
    const addedAt = new Date(now - daysAgo * 86400000).toISOString();
    const id = videoId();
    videos.push({
      id,
      title: title(topic.name, i),
      channel: pick(channels),
      channelId: 'benchmark',
      thumb: '',
      topicName: topic.name,
      source: 'benchmark',
      addedAt,
      published: addedAt.slice(0, 10),
      duration: 60 + Math.floor(rand() * 3400),
      views: Math.round(clamp(Math.exp(8.5 + rand() * 2.5), 500, 20000000)),
      type: rand() < 0.9 ? 'video' : 'short',
      url: `https://www.youtube.com/watch?v=${id}`
    });
  }
}

await mkdir(OUT, { recursive: true });
const payload = {
  version: 1,
  synthetic: true,
  note: 'Capacity fixture only. Not shipped and never loaded automatically.',
  generatedAt: new Date().toISOString(),
  videos
};
await writeFile(path.join(OUT, 'library-100k.json'), JSON.stringify(payload));
await writeFile(path.join(OUT, 'stats.json'), JSON.stringify({
  generatedAt: payload.generatedAt,
  seed: SEED,
  total: videos.length,
  topics: topics.length,
  largestTopic: topics.map((topic, i) => ({ name: topic.name, count: counts[i] }))
    .sort((a, b) => b.count - a.count).slice(0, 10),
  bytes: Buffer.byteLength(JSON.stringify(payload))
}, null, 2));

console.log(`built ${videos.length.toLocaleString()} benchmark records across ${topics.length} topics`);
console.log(`largest topic: ${counts.reduce((a, b) => Math.max(a, b))} videos · benchmark/library-100k.json`);
console.log('import it manually through My library → Import Takeout / JSON. It is gitignored.');
