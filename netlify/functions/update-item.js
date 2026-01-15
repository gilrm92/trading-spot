const prisma = require('./_shared/prisma');
const { requireAuth } = require('./_shared/auth');

exports.handler = async (event, context) => {
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
    const { myDescription, myPrice } = body;

    // Validate that at least one field is provided
    if (myDescription === undefined && myPrice === undefined) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'At least one field (myDescription or myPrice) must be provided' })
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
