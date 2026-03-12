/**
 * Proxy for cross-origin images (e.g. Torn CDN) so html2canvas can capture them.
 * html2canvas calls this with ?url=<encoded_image_url>
 * Only allows torn.com image URLs for security.
 */
const TORN_IMAGE_PATTERN = /^https:\/\/(www\.|images\.)?torn\.com(\/images)?\//i;

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let decoded;
  try {
    decoded = decodeURIComponent(targetUrl);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!TORN_IMAGE_PATTERN.test(decoded)) {
    return new Response(JSON.stringify({ error: 'Only torn.com images are allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(decoded, {
      headers: { 'User-Agent': 'TornTradingSpot/1.0' },
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Upstream returned ${res.status}` }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const blob = await res.blob();
    const contentType = res.headers.get('content-type') || 'image/png';
    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Proxy image error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
