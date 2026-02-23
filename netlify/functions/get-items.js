const prisma = require('./_shared/prisma');
const { getClientIP } = require('./_shared/auth');

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
    const params = event.queryStringParameters || {};
    const q = (params.q || '').trim();
    const sort = params.sort || 'name';
    const order = (params.order || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    const minPrice = params.minPrice != null ? parseInt(params.minPrice, 10) : null;
    const maxPrice = params.maxPrice != null ? parseInt(params.maxPrice, 10) : null;
    const minQuality = params.minQuality != null ? parseFloat(params.minQuality) : null;
    const minDamage = params.minDamage != null ? parseFloat(params.minDamage) : null;
    const minAccuracy = params.minAccuracy != null ? parseFloat(params.minAccuracy) : null;
    const limit = Math.min(parseInt(params.limit, 10) || 200, 200);

    const where = {
      isDeleted: false,
      isSold: false,
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { type: { contains: q, mode: 'insensitive' } },
      ];
    }
    if ((minPrice != null && !isNaN(minPrice)) || (maxPrice != null && !isNaN(maxPrice))) {
      where.myPrice = {};
      if (minPrice != null && !isNaN(minPrice)) where.myPrice.gte = minPrice;
      if (maxPrice != null && !isNaN(maxPrice)) where.myPrice.lte = maxPrice;
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
      take: limit,
    });

    const serializedItems = items.map((item) => ({
      ...item,
      uid: item.uid.toString(),
    }));

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
