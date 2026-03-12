const { getStore } = require('@netlify/blobs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { itemId, image } = body;

    if (!itemId || !image) {
      return new Response(
        JSON.stringify({ error: 'itemId and image are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const id = parseInt(itemId, 10);
    if (isNaN(id) || id < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid item ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract base64 from data URL if provided
    let base64 = image;
    if (typeof image === 'string' && image.startsWith('data:image/')) {
      base64 = image.split(',')[1];
    }
    if (!base64 || typeof base64 !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid image data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const buffer = Buffer.from(base64, 'base64');
    const store = getStore({ name: 'card-images', consistency: 'strong' });
    const key = `card-${id}.png`;
    await store.set(key, buffer);

    const baseUrl = process.env.URL || req.headers.get('x-forwarded-host') || 'https://torn-trading-spot.netlify.app';
    const shareUrl = `${baseUrl}/card/${id}.png`;

    return new Response(
      JSON.stringify({ success: true, url: shareUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Save card image error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to save card image' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};
