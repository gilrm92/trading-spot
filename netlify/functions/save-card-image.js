const { getStore } = require('@netlify/blobs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { itemId, image } = body;

    if (!itemId || !image) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'itemId and image are required' }),
      };
    }

    const id = parseInt(itemId, 10);
    if (isNaN(id) || id < 1) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid item ID' }),
      };
    }

    // Extract base64 from data URL if provided
    let base64 = image;
    if (typeof image === 'string' && image.startsWith('data:image/')) {
      base64 = image.split(',')[1];
    }
    if (!base64 || typeof base64 !== 'string') {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid image data' }),
      };
    }

    const buffer = Buffer.from(base64, 'base64');
    const store = getStore({ name: 'card-images', consistency: 'strong' });
    const key = `card-${id}.png`;
    await store.set(key, buffer);

    // Build the share URL (works with Netlify base URL)
    const baseUrl = process.env.URL || event.headers?.['x-forwarded-host'] || 'https://torn-trading-spot.netlify.app';
    const shareUrl = `${baseUrl}/card/${id}.png`;

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, url: shareUrl }),
    };
  } catch (error) {
    console.error('Save card image error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Failed to save card image' }),
    };
  }
};
