// YouTube Live Stream Detection API
// Uses YouTube's oembed endpoint to check for live streams

import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';
import { UA_BROWSER } from '../_ua.js';

export const config = {
  runtime: 'edge',
};

/** How many candidate ids from one page are worth confirming. */
const MAX_CANDIDATES = 4;

/** Compare a channel name or URL to a handle, ignoring case and punctuation. */
function looksLikeHandle(value, handle) {
  const normalize = (input) => String(input || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalize(value).includes(normalize(handle.replace(/^@/, '')));
}

/**
 * Return the first candidate that oembed says belongs to this channel.
 *
 * oembed reports the owning channel for a video id, which is the cheapest way to
 * reject a recommendation that happened to appear before the live stream in the
 * page. A channel whose display name differs from its handle (@markets is
 * "Bloomberg Television") is matched on either author_url or author_name.
 */
async function firstVideoOwnedBy(candidates, handle) {
  for (const videoId of candidates) {
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { headers: { Accept: 'application/json', 'User-Agent': UA_BROWSER } }
      );
      if (!res.ok) continue;
      const info = await res.json();
      if (looksLikeHandle(info.author_url, handle) || looksLikeHandle(info.author_name, handle)) {
        return videoId;
      }
    } catch {
      // A candidate we cannot confirm is simply not used.
    }
  }
  return null;
}

export default async function handler(request) {
  const cors = getCorsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (isDisallowedOrigin(request)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: cors });
  }
  const url = new URL(request.url);
  const channel = url.searchParams.get('channel');

  if (!channel) {
    return new Response(JSON.stringify({ error: 'Missing channel parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Try to fetch the channel's live page
    const channelHandle = channel.startsWith('@') ? channel : `@${channel}`;
    const liveUrl = `https://www.youtube.com/${channelHandle}/live`;

    const response = await fetch(liveUrl, {
      headers: {
        'User-Agent': UA_BROWSER,
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ videoId: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await response.text();

    // YouTube serves different page shapes to different clients, and on some of
    // them the first "videoId" belongs to a recommendation rather than to the
    // live stream. Taking it on faith made one channel's tile play another
    // channel's stream, so every candidate is confirmed against the handle below.
    const isLiveMatch = html.match(/"isLive":\s*true/);
    const candidates = [...new Set(
      [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1])
    )].slice(0, MAX_CANDIDATES);

    if (isLiveMatch && candidates.length) {
      const videoId = await firstVideoOwnedBy(candidates, channelHandle);
      if (videoId) {
        return new Response(JSON.stringify({ videoId, isLive: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60', // Cache for 5 minutes
          },
        });
      }
    }

    // Return null if no live stream found
    return new Response(JSON.stringify({ videoId: null, isLive: false }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('YouTube live check error:', error);
    return new Response(JSON.stringify({ videoId: null, error: error.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
