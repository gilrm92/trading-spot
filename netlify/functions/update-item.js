const prisma = require('./_shared/prisma');
const { requireAuth } = require('./_shared/auth');

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow PUT requests
  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Require authentication
  const auth = requireAuth(event);
  if (!auth.authenticated) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    // Get item ID from path or query parameter
    let itemId;
    const pathParts = event.path.split('/').filter(p => p);
    const lastPart = pathParts[pathParts.length - 1];
    
    // Try to get from path first
    itemId = parseInt(lastPart);
    
    // If not valid, try query parameter
    if (isNaN(itemId) && event.queryStringParameters?.id) {
      itemId = parseInt(event.queryStringParameters.id);
    }

    if (isNaN(itemId)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid item ID' })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { myDescription, myPrice, likes, dislikes, heatUps, isSold } = body;

    // Validate that at least one field is provided
    if (myDescription === undefined && myPrice === undefined && 
        likes === undefined && dislikes === undefined && heatUps === undefined &&
        isSold === undefined) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'At least one field must be provided' })
      };
    }

    // Validate myPrice is a number if provided
    if (myPrice !== undefined && (typeof myPrice !== 'number' || myPrice < 0)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'myPrice must be a non-negative number' })
      };
    }

    // Validate reaction counts are numbers if provided
    if (likes !== undefined && (typeof likes !== 'number' || likes < 0 || !Number.isInteger(likes))) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'likes must be a non-negative integer' })
      };
    }

    if (dislikes !== undefined && (typeof dislikes !== 'number' || dislikes < 0 || !Number.isInteger(dislikes))) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'dislikes must be a non-negative integer' })
      };
    }

    if (heatUps !== undefined && (typeof heatUps !== 'number' || heatUps < 0 || !Number.isInteger(heatUps))) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'heatUps must be a non-negative integer' })
      };
    }

    // Validate isSold is a boolean if provided
    if (isSold !== undefined && typeof isSold !== 'boolean') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'isSold must be a boolean' })
      };
    }

    // Check if item exists
    const existingItem = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!existingItem) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Item not found' })
      };
    }

    // Prepare update data
    const updateData = {};
    if (myDescription !== undefined) {
      updateData.myDescription = myDescription === '' ? null : myDescription;
    }
    if (myPrice !== undefined) {
      updateData.myPrice = myPrice === null || myPrice === '' ? null : myPrice;
    }
    if (likes !== undefined) {
      updateData.likes = likes;
    }
    if (dislikes !== undefined) {
      updateData.dislikes = dislikes;
    }
    if (heatUps !== undefined) {
      updateData.heatUps = heatUps;
    }
    if (isSold !== undefined) {
      updateData.isSold = isSold;
    }

    // Update item
    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: updateData
    });

    // Convert BigInt to string for JSON serialization
    const serializedItem = {
      ...updatedItem,
      uid: updatedItem.uid.toString()
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        item: serializedItem
      })
    };
  } catch (error) {
    console.error('Update item error:', error);
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
