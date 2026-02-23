const prisma = require('./_shared/prisma');
const { requireAuth } = require('./_shared/auth');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function syntheticUid() {
  return BigInt(-(Date.now() * 1000 + Math.floor(Math.random() * 1000)));
}

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
    const {
      name,
      type,
      quantity = 1,
      circulation = 0,
      marketPrice = 0,
      subType,
      damage,
      accuracy,
      armor,
      quality,
      bonuses,
      rarity,
      image,
      myDescription,
      myPrice,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'name is required' }),
      };
    }
    if (!type || typeof type !== 'string' || !type.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'type is required' }),
      };
    }

    const uid = syntheticUid();
    const itemData = {
      sellerId: auth.userId,
      tornId: 0,
      uid,
      name: name.trim(),
      type: type.trim(),
      quantity: Math.max(0, parseInt(quantity, 10) || 1),
      circulation: Math.max(0, parseInt(circulation, 10) || 0),
      marketPrice: Math.max(0, parseInt(marketPrice, 10) || 0),
      subType: subType != null && subType !== '' ? String(subType) : null,
      damage: damage != null && !isNaN(parseFloat(damage)) ? parseFloat(damage) : null,
      accuracy: accuracy != null && !isNaN(parseFloat(accuracy)) ? parseFloat(accuracy) : null,
      armor: armor != null && !isNaN(parseFloat(armor)) ? parseFloat(armor) : null,
      quality: quality != null && !isNaN(parseFloat(quality)) ? parseFloat(quality) : null,
      bonuses: bonuses != null ? bonuses : null,
      rarity: rarity != null && rarity !== '' ? String(rarity) : null,
      image: image != null && image !== '' ? String(image) : null,
      myDescription: myDescription != null && myDescription !== '' ? String(myDescription) : null,
      myPrice: myPrice != null && myPrice !== '' ? parseInt(myPrice, 10) : null,
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
    console.error('Create item error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
