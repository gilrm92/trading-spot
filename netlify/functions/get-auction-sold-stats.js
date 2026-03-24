const prisma = require('./_shared/prisma');
const { getClientIP } = require('./_shared/auth');
const { validateAuctionSoldStatsParams } = require('./_shared/validate');
const {
  buildAuctionSoldStatsQuery,
  utcMonthStartUnixSeconds,
} = require('./_shared/auctionSoldSql');

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 60;
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  const limit = rateLimitMap.get(ip);
  if (now > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = now + RATE_LIMIT_WINDOW_MS;
    return { allowed: true };
  }
  if (limit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, waitTime: Math.ceil((limit.resetTime - now) / 1000) };
  }
  limit.count += 1;
  return { allowed: true };
}

function roundAvg(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=120',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const clientIP = getClientIP(event);
  const rateLimit = checkRateLimit(clientIP);
  if (!rateLimit.allowed) {
    return {
      statusCode: 429,
      headers: {
        ...corsHeaders,
        'Retry-After': String(rateLimit.waitTime || 60),
      },
      body: JSON.stringify({
        error: 'Too many requests',
        message: `Please wait ${rateLimit.waitTime} seconds before trying again`,
      }),
    };
  }

  try {
    const rawParams = event.queryStringParameters || {};
    const parsed = validateAuctionSoldStatsParams(rawParams);
    if (!parsed.valid) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: parsed.error || 'Invalid parameters' }),
      };
    }

    const { weapon, bonus, bonusValue } = parsed;
    const now = new Date();
    const thisMonthStart = utcMonthStartUnixSeconds(now);
    const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const lastMonthStart = utcMonthStartUnixSeconds(lastMonthDate);

    const statsSql = buildAuctionSoldStatsQuery(
      weapon,
      bonus,
      bonusValue,
      thisMonthStart,
      lastMonthStart
    );

    const rows = await prisma.$queryRaw(statsSql);

    const body = rows.map((r) => ({
      bonusValue: r.bonus_value,
      avgAllTime: roundAvg(r.avg_all),
      avgThisMonth: roundAvg(r.avg_this_month),
      avgLastMonth: roundAvg(r.avg_last_month),
      saleCount: r.sale_count,
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(body),
    };
  } catch (error) {
    console.error('Get auction sold stats error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
