const prisma = require('./_shared/prisma');
const { requireAuth, verifyTornAPIKey } = require('./_shared/auth');
const { serializeItem } = require('./_shared/serialize');
const WEAPONS = require('./_shared/weapons');
const {
  ALLOWED_WEAPON_TYPES,
  TORN_SUB_TYPE_TO_APP_TYPE,
  getAppTypeFromTorn,
} = require('./_shared/weaponMapping');
const ALLOWED_RARITIES = ['yellow', 'orange', 'red'];

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

    console.log('[add-by-uid] Request', {
      userId: auth.userId,
      uid: uidParam,
      hasApiKey: !!(apiKey && typeof apiKey === 'string' && apiKey.trim()),
    });

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
      console.log('[add-by-uid] Torn API itemdetails failed', {
        uid: uidNum,
        status: detailsResponse.status,
      });
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to fetch item details from Torn' }),
      };
    }

    const detailsData = await detailsResponse.json();
    if (detailsData.error) {
      console.log('[add-by-uid] Torn API error', {
        uid: uidNum,
        error: detailsData.error,
      });
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: detailsData.error.error || detailsData.error.message || 'Torn API error',
        }),
      };
    }

    const itemDetails = detailsData.itemdetails || {};
    // Stats may be at itemDetails.stats or at top level (API structure varies)
    const stats = itemDetails.stats || {};
    const getStat = (key) =>
      stats[key] != null ? stats[key] : itemDetails[key];
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
    const tornType = (itemDetails.type || '').trim();
    const subType = (itemDetails.sub_type || '').trim().replace(/-/g, '_');
    const rarity = (itemDetails.rarity || '').trim().toLowerCase();

    console.log('[add-by-uid] Item details', {
      uid: uidNum,
      name,
      tornType: tornType || '(empty)',
      subType: subType || '(empty)',
      rarity: rarity || '(empty)',
      tornId,
    });

    // Check if weapon: Torn type "Weapon", or sub_type maps to Primary/Secondary/Melee, or name in weapons list
    const matchedAppType = ALLOWED_WEAPON_TYPES.find(
      (t) => t.toLowerCase() === tornType.toLowerCase()
    ) || TORN_SUB_TYPE_TO_APP_TYPE[subType];
    const tornTypeIsWeapon = tornType.toLowerCase() === 'weapon';
    const nameMatch = WEAPONS.includes(name);

    const isWeapon = tornTypeIsWeapon || matchedAppType || nameMatch;
    if (!isWeapon) {
      console.log('[add-by-uid] Rejected: not a weapon', {
        uid: uidNum,
        name,
        tornType,
        nameMatch,
        matchedAppType: !!matchedAppType,
        tornTypeIsWeapon,
      });
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: `Only weapons can be listed. This item is not a weapon (type: "${tornType || 'unknown'}").`,
        }),
      };
    }

    if (!ALLOWED_RARITIES.includes(rarity)) {
      console.log('[add-by-uid] Rejected: invalid rarity', { uid: uidNum, name, rarity });
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: `Only yellow, orange, or red quality weapons can be listed. This item has "${itemDetails.rarity || 'unknown'}" rarity.`,
        }),
      };
    }

    const quantity = 1;
    const circulation = itemDetails.circulation != null ? itemDetails.circulation : 0;
    const marketPriceRaw =
      itemDetails.market_price != null
        ? itemDetails.market_price
        : itemDetails.market_value != null
          ? itemDetails.market_value
          : 0;
    const marketPrice = BigInt(marketPriceRaw);

    const existing = await prisma.item.findFirst({
      where: { uid: BigInt(uidNum), isSold: false },
      select: { id: true, sellerId: true, sellerName: true },
    });
    if (existing) {
      const isOwn = String(existing.sellerId) === String(auth.userId);
      console.log('[add-by-uid] Rejected: already listed', {
        uid: uidNum,
        existingSellerId: existing.sellerId,
        existingSellerName: existing.sellerName,
        isOwn,
      });
      const msg = isOwn
        ? 'This item is already listed by you.'
        : `This item is already listed by ${existing.sellerName || 'another user'}.`;
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: msg }),
      };
    }

    const sellerName = verification.user.name || verification.user.username || null;
    const normalizedType = getAppTypeFromTorn(name, tornType, subType, null);

    const itemData = {
      sellerId: auth.userId,
      sellerName,
      tornId,
      uid: BigInt(uidNum),
      name,
      category: normalizedType,
      type: tornType || 'Weapon',
      subType: itemDetails.sub_type || null,
      quantity,
      circulation,
      marketPrice,
      damage: getStat('damage') != null ? getStat('damage') : null,
      accuracy: getStat('accuracy') != null ? getStat('accuracy') : null,
      armor: getStat('armor') != null ? getStat('armor') : null,
      quality: getStat('quality') != null ? getStat('quality') : null,
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

    console.log('[add-by-uid] Created', {
      itemId: created.id,
      uid: uidNum,
      name: created.name,
      type: created.type,
      sellerId: created.sellerId,
    });

    const serialized = serializeItem(created);

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
