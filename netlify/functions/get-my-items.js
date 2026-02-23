const prisma = require('./_shared/prisma');
const { requireAuth } = require('./_shared/auth');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
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

  const auth = requireAuth(event);
  if (!auth.authenticated) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    const userId = auth.userId;
    const items = await prisma.item.findMany({
      where: { sellerId: userId },
      orderBy: [
        { isSold: 'asc' },
        { name: 'asc' },
      ],
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
    console.error('Get my items error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
