const { getStore } = require('@netlify/blobs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  const url = new URL(req.url);
  const itemId = url.searchParams.get('id');

  if (!itemId) {
    return new Response(
      JSON.stringify({ error: 'Missing id parameter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const id = parseInt(String(itemId).replace(/\.png$/, ''), 10);
  if (isNaN(id) || id < 1) {
    return new Response(
      JSON.stringify({ error: 'Invalid item ID' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const store = getStore({ name: 'card-images' });
    const key = `card-${id}.png`;
    const data = await store.get(key);

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Card image not found. Click Share on the card first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Serve card image error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};
