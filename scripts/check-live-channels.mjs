#!/usr/bin/env node
/**
 * Verify the Live News panel's YouTube channels still resolve.
 *
 * Two things rot independently and neither fails loudly in the UI:
 *   1. A channel HANDLE changes or is mistyped, so live detection silently
 *      returns nothing and the panel falls back forever. This is how Bloomberg
 *      (@Bloomberg, whose live stream actually lives on @markets), Euronews
 *      (@euabortnews, a mangled @euronews) and France24 (@FRANCE24English)
 *      all ended up permanently on stale fallbacks.
 *   2. A fallbackVideoId points at an ended stream, so the fallback is dead too.
 *
 * When both rot the tile just says "cannot be embedded", which reads like a
 * YouTube problem rather than stale config.
 *
 * Detection runs through the deployed /api/youtube/live route on purpose. That
 * is the exact code path production uses, and YouTube serves a different page
 * shape to different IP classes: querying it directly from a laptop or a CI box
 * returns ids that do not match what the deployed route sees.
 *
 *   node scripts/check-live-channels.mjs
 *   node scripts/check-live-channels.mjs --via http://localhost:3000
 *
 * Exits non-zero when a channel has no live stream AND a dead fallback, which is
 * the only combination the user actually sees as broken.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PANEL = path.join(ROOT, 'src/components/LiveNewsPanel.ts');

const viaFlag = process.argv.indexOf('--via');
const BASE = (viaFlag !== -1 && process.argv[viaFlag + 1]) || 'https://chainscope-8m2.pages.dev';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

/** Read the channel entries straight out of the panel source. */
async function readChannels() {
  const source = await readFile(PANEL, 'utf8');
  const entries = [...source.matchAll(
    /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*handle:\s*'([^']+)',\s*fallbackVideoId:\s*'([^']+)'/g
  )];
  // The same channel can appear in both the full and tech variant lists.
  const seen = new Map();
  for (const [, id, name, handle, fallbackVideoId] of entries) {
    const key = `${handle}|${fallbackVideoId}`;
    if (!seen.has(key)) seen.set(key, { id, name, handle, fallbackVideoId });
  }
  return [...seen.values()];
}

/** The video id a handle is currently streaming live, per the deployed route. */
async function liveVideoId(handle) {
  const res = await fetch(`${BASE}/api/youtube/live?channel=${encodeURIComponent(handle)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`live route returned ${res.status}`);
  const body = await res.json();
  return body.videoId ?? null;
}

/** Whether a video still exists and reports itself as embeddable. */
async function videoIsAlive(videoId) {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    { headers: { 'User-Agent': UA } }
  );
  return res.ok;
}

const channels = await readChannels();
if (!channels.length) {
  console.error('[live-channels] parsed no channels from LiveNewsPanel.ts; did its shape change?');
  process.exit(2);
}

console.log(`[live-channels] detecting via ${BASE}\n`);

let broken = 0;
let stale = 0;

for (const channel of channels) {
  const [live, fallbackAlive] = await Promise.all([
    liveVideoId(channel.handle).catch(() => null),
    videoIsAlive(channel.fallbackVideoId).catch(() => false),
  ]);

  const label = `${channel.name} (${channel.handle})`.padEnd(34);

  if (!live && !fallbackAlive) {
    broken += 1;
    console.log(`BROKEN  ${label} no live stream, and fallback ${channel.fallbackVideoId} is gone`);
  } else if (!live) {
    stale += 1;
    console.log(`STALE   ${label} no live stream; check the handle. Serving ${channel.fallbackVideoId}`);
  } else if (!fallbackAlive) {
    stale += 1;
    console.log(`STALE   ${label} live now, but fallback is dead. Replace it with: ${live}`);
  } else {
    console.log(`ok      ${label} live ${live}`);
  }
}

console.log(`\n[live-channels] ${channels.length} checked, ${stale} stale, ${broken} broken`);
if (broken) {
  console.error('[live-channels] a channel has no working stream and no working fallback.');
  process.exit(1);
}
