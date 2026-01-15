const { checkRateLimit, getClientIP, verifyTornAPIKey, generateToken } = require('./_shared/auth');

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check rate limiting
    const clientIP = getClientIP(event);
    const rateLimit = checkRateLimit(clientIP);
    
    if (!rateLimit.allowed) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Retry-After': rateLimit.waitTime.toString()
        },
        body: JSON.stringify({
          error: 'Too many attempts',
          message: `Please wait ${rateLimit.waitTime} seconds before trying again`,
          waitTime: rateLimit.waitTime
        })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const apiKey = body.apiKey;

    if (!apiKey) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'API key is required' })
      };
    }

    // Verify Torn API key
    const verification = await verifyTornAPIKey(apiKey);
    
    if (!verification.valid) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Invalid API key',
          details: verification.error
        })
      };
    }

    // Generate JWT token
    const token = generateToken(verification.user.id);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        token,
        user: {
          id: verification.user.id,
          name: verification.user.name,
          level: verification.user.level
        }
      })
    };
  } catch (error) {
    console.error('Auth error:', error);
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
