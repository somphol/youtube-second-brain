#!/usr/bin/env node
/**
 * verify-benchmark.mjs — validate the optional 100k capacity fixture.
 * Usage: npm run benchmark:verify
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'benchmark/library-100k.json');

let pass = 0;
const fails = [];
const check = (name, cond, detail = '') => cond ? pass++ : fails.push(`${name}${detail ? ` — ${detail}` : ''}`);

let payload;
try {
  payload = JSON.parse(await readFile(FILE, 'utf8'));
} catch (err) {
  console.error('missing benchmark/library-100k.json — run npm run benchmark:build');
  process.exit(1);
}
const videos = payload.videos;
check('100,000 records', videos.length === 100000, String(videos.length));
check('payload is labelled synthetic', payload.synthetic === true);
check('all ids are 11 chars', videos.every((v) => /^[A-Za-z0-9_-]{11}$/.test(v.id)));
check('ids are unique', new Set(videos.map((v) => v.id)).size === videos.length);
check('titles are unique', new Set(videos.map((v) => v.title)).size === videos.length);
check('every record has a topic', videos.every((v) => typeof v.topicName === 'string' && v.topicName.length > 0));
check('every record has a channel', videos.every((v) => typeof v.channel === 'string' && v.channel.length > 0));
check('every record has a valid date', videos.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v.published)));
const byTopic = new Map();
for (const v of videos) byTopic.set(v.topicName, (byTopic.get(v.topicName) || 0) + 1);
const largest = Math.max(...byTopic.values());
check('at least 400 topics', byTopic.size >= 400, String(byTopic.size));
check('largest topic is thousands', largest >= 2000, String(largest));
check('file exists on disk', (await stat(FILE)).size > 10_000_000);

if (fails.length) {
  console.error(`\n✗ ${fails.length} benchmark check(s) failed (${pass} passed)`);
  for (const f of fails.slice(0, 20)) console.error('  •', f);
  process.exit(1);
}
console.log(`✓ benchmark verified — ${pass} checks`);
console.log(`  ${videos.length.toLocaleString()} records · ${byTopic.size} topics · largest ${largest}`);
