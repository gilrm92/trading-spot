const jwt = require('jsonwebtoken');

// Hardcoded JWT secret
const JWT_SECRET = 'torn-trading-spot-secret-key-change-in-production';
const ALLOWED_USER_ID = 2827691;

// Rate limiting storage (in-memory)
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip;
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 0, resetTime: now + 50000 });
    return { allowed: true, remaining: 3 };
  }
  
  const limit = rateLimitMap.get(key);
  
  if (now > limit.resetTime) {
    // Reset the limit
    rateLimitMap.set(key, { count: 0, resetTime: now + 50000 });
    return { allowed: true, remaining: 3 };
  }
  
  if (limit.count >= 3) {
    const waitTime = Math.ceil((limit.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, waitTime };
  }
  
  limit.count++;
  return { allowed: true, remaining: 3 - limit.count };
}

function getClientIP(event) {
  return event.headers['x-forwarded-for']?.split(',')[0] || 
         event.headers['x-real-ip'] || 
         event.clientContext?.ip || 
         'unknown';
}

async function verifyTornAPIKey(apiKey) {
  try {
    const response = await fetch(`https://api.torn.com/v2/user/basic?striptags=true&key=${apiKey}`);
    const data = await response.json();
    
    if (data.error) {
      return { valid: false, error: data.error };
    }
    
    if (data.profile && data.profile.id === ALLOWED_USER_ID) {
      return { valid: true, user: data.profile };
    }
    
    return { valid: false, error: 'Unauthorized user' };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function getAuthToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

function requireAuth(event) {
  const token = getAuthToken(event);
  if (!token) {
    return { authenticated: false, error: 'No token provided' };
  }
  
  const decoded = verifyToken(token);
  if (!decoded || decoded.userId !== ALLOWED_USER_ID) {
    return { authenticated: false, error: 'Invalid token' };
  }
  
  return { authenticated: true, userId: decoded.userId };
}

module.exports = {
  checkRateLimit,
  getClientIP,
  verifyTornAPIKey,
  generateToken,
  verifyToken,
  getAuthToken,
  requireAuth,
  ALLOWED_USER_ID
};
