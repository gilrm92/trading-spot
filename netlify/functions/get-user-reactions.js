const prisma = require('./_shared/prisma');

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
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
    const body = JSON.parse(event.body || '{}');
    const { userId, itemIds } = body;

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'userId is required' })
      };
    }

    const reactions = await prisma.userReaction.findMany({
      where: {
        userId,
        ...(itemIds && itemIds.length > 0 ? { itemId: { in: itemIds } } : {})
      }
    });

    // Convert to a map for easy lookup
    const reactionsMap = {};
    reactions.forEach(reaction => {
      reactionsMap[reaction.itemId] = {
        liked: reaction.liked,
        disliked: reaction.disliked,
        heatedUp: reaction.heatedUp
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(reactionsMap)
    };
  } catch (error) {
    console.error('Get user reactions error:', error);
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
