const prisma = require('./_shared/prisma');
const { getClientIP } = require('./_shared/auth');
const { validateAuctionSoldParams } = require('./_shared/validate');
const { serializeAuctionListing } = require('./_shared/serialize');

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

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=60',
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
    const {
      offset,
      limit,
      weapon: validWeapon,
      bonus: validBonus,
      minBonusValue,
      maxBonusValue,
    } = validateAuctionSoldParams(rawParams);

    const catalogWhere = {
      type: { equals: 'Weapon', mode: 'insensitive' },
    };
    if (validWeapon) {
      catalogWhere.name = { contains: validWeapon, mode: 'insensitive' };
    }

    const where = {
      buyerId: { not: null },
      catalog: catalogWhere,
    };

    if (validBonus) {
      const titleMatch = { equals: validBonus, mode: 'insensitive' };
      const hasBonusValueFilter = minBonusValue != null || maxBonusValue != null;
      const bonus1ValueFilter = {};
      const bonus2ValueFilter = {};
      if (minBonusValue != null) {
        bonus1ValueFilter.gte = minBonusValue;
        bonus2ValueFilter.gte = minBonusValue;
      }
      if (maxBonusValue != null) {
        bonus1ValueFilter.lte = maxBonusValue;
        bonus2ValueFilter.lte = maxBonusValue;
      }

      if (hasBonusValueFilter) {
        where.OR = [
          {
            AND: [
              { bonus1: { is: { title: titleMatch } } },
              { bonus1Value: bonus1ValueFilter },
            ],
          },
          {
            AND: [
              { bonus2: { is: { title: titleMatch } } },
              { bonus2Value: bonus2ValueFilter },
            ],
          },
        ];
      } else {
        where.OR = [
          { bonus1: { is: { title: titleMatch } } },
          { bonus2: { is: { title: titleMatch } } },
        ];
      }
    }

    const rows = await prisma.auctionHouseListing.findMany({
      where,
      include: {
        catalog: true,
        bonus1: true,
        bonus2: true,
      },
      orderBy: { timestamp: 'desc' },
      skip: offset,
      take: limit,
    });

    const body = rows.map(serializeAuctionListing);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(body),
    };
  } catch (error) {
    console.error('Get auction sold error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
