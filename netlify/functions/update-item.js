const prisma = require('./_shared/prisma');
const { requireAuth } = require('./_shared/auth');
const { validateUpdateItemBody } = require('./_shared/validate');
const { serializeItem } = require('./_shared/serialize');

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

    // Parse and validate request body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const validation = validateUpdateItemBody(body);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: validation.error })
      };
    }

    const updateData = validation.data;

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

    if (existingItem.sellerId !== auth.userId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'You can only edit your own listings' })
      };
    }

    // Update item
    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: updateData
    });

    const serializedItem = serializeItem(updatedItem);

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
