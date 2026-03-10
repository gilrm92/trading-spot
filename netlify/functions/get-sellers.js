const prisma = require('./_shared/prisma');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=300',
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

  try {
    const items = await prisma.item.findMany({
      where: {
        isDeleted: false,
        isSold: false,
        sellerName: { not: null },
      },
      select: { sellerName: true },
      distinct: ['sellerName'],
      orderBy: { sellerName: 'asc' },
    });

    const sellers = items
      .map((item) => item.sellerName)
      .filter(Boolean);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(sellers),
    };
  } catch (error) {
    console.error('Get sellers error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
