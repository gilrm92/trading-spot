const prisma = require('./_shared/prisma');
const { getClientIP } = require('./_shared/auth');
const { Prisma } = require('@prisma/client');
const { validateGetItemsParams } = require('./_shared/validate');
const { serializeItem } = require('./_shared/serialize');

// Rate limit for public search: 60 requests per minute per IP
const SEARCH_RATE_LIMIT_WINDOW_MS = 60000;
const SEARCH_RATE_LIMIT_MAX = 60;
const searchRateLimitMap = new Map();

function checkSearchRateLimit(ip) {
  const now = Date.now();
  if (!searchRateLimitMap.has(ip)) {
    searchRateLimitMap.set(ip, { count: 0, resetTime: now + SEARCH_RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  const limit = searchRateLimitMap.get(ip);
  if (now > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = now + SEARCH_RATE_LIMIT_WINDOW_MS;
    return { allowed: true };
  }
  if (limit.count >= SEARCH_RATE_LIMIT_MAX) {
    return { allowed: false, waitTime: Math.ceil((limit.resetTime - now) / 1000) };
  }
  limit.count++;
  return { allowed: true };
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=60',
};

exports.handler = async (event, context) => {
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
  const rateLimit = checkSearchRateLimit(clientIP);
  if (!rateLimit.allowed) {
    return {
      statusCode: 429,
      headers: {
        ...corsHeaders,
        'Retry-After': String(rateLimit.waitTime || 60),
      },
      body: JSON.stringify({
        error: 'Too many requests',
        message: `Please wait ${rateLimit.waitTime} seconds before searching again`,
      }),
    };
  }

  try {
    const rawParams = event.queryStringParameters || {};
    const {
      sort,
      order,
      minPrice,
      maxPrice,
      minQuality,
      minDamage,
      minAccuracy,
      offset,
      limit,
      weapon: validWeapon,
      bonus: validBonus,
      type: validType,
      seller: validSeller,
    } = validateGetItemsParams(rawParams);

    const where = {
      isDeleted: false,
      isSold: false,
    };

    if (validWeapon) {
      where.name = { contains: validWeapon, mode: 'insensitive' };
    }
    if (validType) {
      where.category = { equals: validType, mode: 'insensitive' };
    }
    if ((minPrice != null && !isNaN(minPrice)) || (maxPrice != null && !isNaN(maxPrice))) {
      where.myPrice = {};
      if (minPrice != null && !isNaN(minPrice)) where.myPrice.gte = BigInt(Math.floor(minPrice));
      if (maxPrice != null && !isNaN(maxPrice)) where.myPrice.lte = BigInt(Math.floor(maxPrice));
    }
    if (minQuality != null && !isNaN(minQuality)) {
      where.quality = { gte: minQuality };
    }
    if (minDamage != null && !isNaN(minDamage)) {
      where.damage = { gte: minDamage };
    }
    if (minAccuracy != null && !isNaN(minAccuracy)) {
      where.accuracy = { gte: minAccuracy };
    }
    if (validSeller) {
      where.sellerName = { equals: validSeller, mode: 'insensitive' };
    }

    if (validBonus) {
      const bonusIds = await prisma.$queryRaw(
        Prisma.sql`
          SELECT id FROM items
          WHERE "isDeleted" = false AND "isSold" = false
            AND bonuses IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(bonuses::jsonb) AS elem
              WHERE elem->>'title' = ${validBonus}
            )
        `
      );
      const ids = bonusIds.map((r) => r.id);
      if (ids.length === 0) {
        where.id = { in: [-1] };
      } else {
        where.id = { in: ids };
      }
    }

    const sortFieldMap = {
      price: 'myPrice',
      quality: 'quality',
      damage: 'damage',
      accuracy: 'accuracy',
      name: 'name',
      createdAt: 'createdAt',
    };
    const orderByField = sortFieldMap[sort] || 'name';
    const orderBy = [{ [orderByField]: order }];

    const items = await prisma.item.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
    });

    const serializedItems = items.map(serializeItem);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(serializedItems),
    };
  } catch (error) {
    console.error('Get items error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
