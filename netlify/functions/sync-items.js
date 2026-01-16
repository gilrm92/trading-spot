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

  // Require authentication
  const auth = requireAuth(event);
  if (!auth.authenticated) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    // Get API key from query parameter
    const apiKey = event.queryStringParameters?.key;
    if (!apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'API key is required' })
      };
    }

    // Fetch items from Torn API
    const displayResponse = await fetch(
      `https://api.torn.com/user/?selections=display&key=${apiKey}`
    );
    
    if (!displayResponse.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch from Torn API' })
      };
    }

    const displayData = await displayResponse.json();
    
    if (displayData.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: displayData.error })
      };
    }

    const items = displayData.display || [];
    const syncedUids = new Set();
    let created = 0;
    let updated = 0;
    let errors = [];

    // Process each item
    for (const item of items) {
      try {
        // Fetch item details
        const detailsResponse = await fetch(
          `https://api.torn.com/v2/torn/${item.UID}/itemdetails?key=${apiKey}`
        );
        
        if (!detailsResponse.ok) {
          errors.push(`Failed to fetch details for UID ${item.UID}`);
          continue;
        }

        const detailsData = await detailsResponse.json();
        
        if (detailsData.error) {
          errors.push(`Error for UID ${item.UID}: ${detailsData.error.error || 'Unknown error'}`);
          continue;
        }

        const itemDetails = detailsData.itemdetails || {};
        const stats = itemDetails.stats || {};
        const bonuses = itemDetails.bonuses || [];

        // Fetch item image from items endpoint using tornId
        let imageUrl = null;
        try {
          const itemsResponse = await fetch(
            `https://api.torn.com/v2/torn/${item.ID}/items?sort=ASC&key=${apiKey}`
          );
          
          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            if (itemsData.items && itemsData.items.length > 0) {
              // Find the item that matches our UID (the item.id in the response should match item.UID)
              // If not found, take the first item
              const matchingItem = itemsData.items.find(i => i.id === item.UID) || itemsData.items[0];
              if (matchingItem && matchingItem.image) {
                imageUrl = matchingItem.image;
              }
            }
          } else {
            console.error(`Failed to fetch items for tornId ${item.ID}: ${itemsResponse.status}`);
          }
        } catch (imageError) {
          console.error(`Failed to fetch image for item ${item.ID}:`, imageError);
          // Continue without image if fetch fails
        }

        // Prepare data for database
        const itemData = {
          tornId: item.ID,
          uid: BigInt(item.UID),
          name: item.name,
          type: item.type,
          subType: itemDetails.sub_type || null,
          quantity: item.quantity,
          circulation: item.circulation,
          marketPrice: item.market_price,
          damage: stats.damage || null,
          accuracy: stats.accuracy || null,
          armor: stats.armor || null,
          quality: stats.quality || null,
          bonuses: bonuses.length > 0 ? bonuses : null,
          rarity: itemDetails.rarity || null,
          image: imageUrl,
        };

        // Upsert item (create or update)
        const existingItem = await prisma.item.findUnique({
          where: { uid: BigInt(item.UID) }
        });

        if (existingItem) {
          await prisma.item.update({
            where: { uid: BigInt(item.UID) },
            data: itemData
          });
          updated++;
        } else {
          await prisma.item.create({
            data: itemData
          });
          created++;
        }

        syncedUids.add(item.UID.toString());
      } catch (error) {
        errors.push(`Error processing item ${item.UID}: ${error.message}`);
      }
    }

    // Remove items that are no longer in the Torn API response
    const allItems = await prisma.item.findMany();
    let removed = 0;

    for (const dbItem of allItems) {
      if (!syncedUids.has(dbItem.uid.toString())) {
        await prisma.item.delete({
          where: { id: dbItem.id }
        });
        removed++;
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        created,
        updated,
        removed,
        total: items.length,
        errors: errors.length > 0 ? errors : undefined
      })
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
