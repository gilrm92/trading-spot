const prisma = require('./_shared/prisma');
const { requireAuth, verifyTornAPIKey } = require('./_shared/auth');

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
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
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
    const body = JSON.parse(event.body || '{}');
    const { uid: uidParam, apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'apiKey is required for add-by-uid' }),
      };
    }

    const uidNum = parseInt(uidParam, 10);
    if (isNaN(uidNum) || uidNum <= 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Valid uid (positive number) is required' }),
      };
    }

    const verification = await verifyTornAPIKey(apiKey.trim());
    if (!verification.valid) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: verification.error || 'Invalid API key' }),
      };
    }
    if (verification.user.id !== auth.userId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'API key must belong to the logged-in user' }),
      };
    }

    const detailsResponse = await fetch(
      `https://api.torn.com/v2/torn/${uidNum}/itemdetails?key=${encodeURIComponent(apiKey.trim())}`
    );
    if (!detailsResponse.ok) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to fetch item details from Torn' }),
      };
    }

    const detailsData = await detailsResponse.json();
    if (detailsData.error) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: detailsData.error.error || detailsData.error.message || 'Torn API error',
        }),
      };
    }

    const itemDetails = detailsData.itemdetails || {};
    const stats = itemDetails.stats || {};
    const bonuses = Array.isArray(itemDetails.bonuses) ? itemDetails.bonuses : [];
    const tornId = itemDetails.id != null ? itemDetails.id : itemDetails.tornId != null ? itemDetails.tornId : 0;

    let imageUrl = null;
    if (tornId > 0) {
      try {
        const itemsResponse = await fetch(
          `https://api.torn.com/v2/torn/${tornId}/items?sort=ASC&key=${encodeURIComponent(apiKey.trim())}`
        );
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          if (itemsData.items && itemsData.items.length > 0) {
            const matching = itemsData.items.find((i) => i.id === uidNum) || itemsData.items[0];
            if (matching && matching.image) imageUrl = matching.image;
          }
        }
      } catch (e) {
        // ignore image failure
      }
    }

    const name = itemDetails.name || 'Unknown';
    const type = itemDetails.type || 'Unknown';
    const quantity = itemDetails.quantity != null ? itemDetails.quantity : 1;
    const circulation = itemDetails.circulation != null ? itemDetails.circulation : 0;
    const marketPrice =
      itemDetails.market_price != null
        ? itemDetails.market_price
        : itemDetails.market_value != null
          ? itemDetails.market_value
          : 0;

    const existing = await prisma.item.findUnique({
      where: { uid: BigInt(uidNum) },
    });
    if (existing) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'This item is already listed' }),
      };
    }

    const itemData = {
      sellerId: auth.userId,
      tornId,
      uid: BigInt(uidNum),
      name,
      type,
      subType: itemDetails.sub_type || null,
      quantity,
      circulation,
      marketPrice,
      damage: stats.damage != null ? stats.damage : null,
      accuracy: stats.accuracy != null ? stats.accuracy : null,
      armor: stats.armor != null ? stats.armor : null,
      quality: stats.quality != null ? stats.quality : null,
      bonuses: bonuses.length > 0 ? bonuses : null,
      rarity: itemDetails.rarity || null,
      image: imageUrl,
      myDescription: null,
      myPrice: null,
      isSold: false,
      isDeleted: false,
    };

    const created = await prisma.item.create({
      data: itemData,
    });

    const serialized = {
      ...created,
      uid: created.uid.toString(),
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, item: serialized }),
    };
  } catch (error) {
    console.error('Add by UID error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
