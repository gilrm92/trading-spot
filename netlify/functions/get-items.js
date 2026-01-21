const prisma = require('./_shared/prisma');

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get all items that are not deleted, sorted by isSold (sold items last) then by name
    const items = await prisma.item.findMany({
      where: {
        isDeleted: false
      },
      orderBy: [
        { isSold: 'asc' },  // false (not sold) first, true (sold) last
        { name: 'asc' }
      ]
    });

    // Convert BigInt to string for JSON serialization
    const serializedItems = items.map(item => ({
      ...item,
      uid: item.uid.toString()
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(serializedItems)
    };
  } catch (error) {
    console.error('Get items error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
