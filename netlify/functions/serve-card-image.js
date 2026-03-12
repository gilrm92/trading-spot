const { getStore } = require('@netlify/blobs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  const itemId = event.queryStringParameters?.id;
  if (!itemId) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing id parameter' }),
    };
  }

  const id = parseInt(String(itemId).replace(/\.png$/, ''), 10);
  if (isNaN(id) || id < 1) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid item ID' }),
    };
  }

  try {
    const store = getStore({ name: 'card-images' });
    const key = `card-${id}.png`;
    const data = await store.get(key);

    if (!data) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Card image not found. Click Share on the card first.' }),
      };
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Serve card image error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
