/**
 * Scheduled head poll only: newest auction house page (same as `npm run auction-sync:head`).
 * Full history backfill must be run manually: `npm run auction-sync:full` (serverless timeout is too short).
 */
const prisma = require('./_shared/prisma');
const { runHeadPollPass } = require('./_shared/auctionHouseSync');

/** Netlify scheduled functions send POST with JSON body { next_run: ISO string } */
function isNetlifyScheduledInvocation(event) {
  if (event.httpMethod !== 'POST' || !event.body) return false;
  try {
    const b = JSON.parse(event.body);
    return typeof b?.next_run === 'string' && b.next_run.length > 10;
  } catch {
    return false;
  }
}

function isAuthorized(event) {
  const secret = process.env.AUCTION_SYNC_CRON_SECRET?.trim();
  if (!secret) return true;

  if (isNetlifyScheduledInvocation(event)) return true;

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const q = event.queryStringParameters || {};
  const querySecret = q.secret?.trim();

  return bearer === secret || querySecret === secret;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!isAuthorized(event)) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const apiKey = process.env.TORN_AUCTION_API_KEY?.trim();
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server misconfiguration: TORN_AUCTION_API_KEY' }),
    };
  }

  try {
    const { pagesFetched, rowCount, weaponRows } = await runHeadPollPass(
      prisma,
      apiKey
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        mode: 'head',
        pagesFetched,
        rowCount,
        weaponRows,
      }),
    };
  } catch (e) {
    console.error('[sync-auction-house]', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: e.message || String(e) }),
    };
  }
};
