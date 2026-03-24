/**
 * Input validation helpers for API handlers.
 * Defense in depth - validate and sanitize user input before it reaches Prisma.
 */

const WEAPONS = require('./weapons');
const WEAPON_BONUSES = require('./weaponBonuses');
const WEAPON_TYPES = require('./weaponTypes');

const SORT_WHITELIST = ['name', 'price', 'quality', 'damage', 'accuracy', 'createdAt'];
const ORDER_WHITELIST = ['asc', 'desc'];
const MAX_SEARCH_LENGTH = 200;
const MAX_OFFSET = 10000;
const PRICE_BOUND = 1e11; // 100 billion

function trimString(val, maxLen = MAX_SEARCH_LENGTH) {
  if (val == null || typeof val !== 'string') return '';
  const trimmed = val.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function whitelist(val, allowed) {
  if (val == null || typeof val !== 'string') return null;
  const trimmed = val.trim().toLowerCase();
  const match = allowed.find((a) => a.toLowerCase() === trimmed);
  return match ? match : null;
}

function parseIntSafe(val, defaultVal = 0, opts = {}) {
  const { min, max } = opts;
  if (val == null || val === '') return defaultVal;
  const num = parseInt(val, 10);
  if (isNaN(num)) return defaultVal;
  if (min != null && num < min) return min;
  if (max != null && num > max) return max;
  return num;
}

function parseFloatSafe(val, defaultVal = 0, opts = {}) {
  const { min, max } = opts;
  if (val == null || val === '') return defaultVal;
  const num = parseFloat(val);
  if (isNaN(num)) return defaultVal;
  if (min != null && num < min) return min;
  if (max != null && num > max) return max;
  return num;
}

/**
 * Validate get-items query params.
 * Returns sanitized params object.
 */
function validateGetItemsParams(params = {}) {
  const sort = whitelist(params.sort, SORT_WHITELIST) || 'name';
  const order = whitelist(params.order, ORDER_WHITELIST) || 'asc';
  const minPrice = parseFloatSafe(params.minPrice, null, { min: 0, max: PRICE_BOUND });
  const maxPrice = parseFloatSafe(params.maxPrice, null, { min: 0, max: PRICE_BOUND });
  const minQuality = parseFloatSafe(params.minQuality, null, { min: 0 });
  const minDamage = parseFloatSafe(params.minDamage, null, { min: 0 });
  const minAccuracy = parseFloatSafe(params.minAccuracy, null, { min: 0 });
  const offset = parseIntSafe(params.offset, 0, { min: 0, max: MAX_OFFSET });
  const limit = parseIntSafe(params.limit, 24, { min: 1, max: 200 });

  const weaponRaw = (params.weapon || '').trim();
  const bonusRaw = (params.bonus || '').trim();
  const typeRaw = (params.type || '').trim();
  const weapon = weaponRaw && WEAPONS.includes(weaponRaw) ? weaponRaw : '';
  const bonus = bonusRaw && WEAPON_BONUSES.includes(bonusRaw) ? bonusRaw : '';
  const type = typeRaw && WEAPON_TYPES.includes(typeRaw) ? typeRaw : '';

  // seller: filter by seller name (case-insensitive, max 100 chars)
  const sellerRaw = (params.seller || '').trim();
  const seller = sellerRaw.length > 0 && sellerRaw.length <= 100 ? sellerRaw : '';

  return {
    sort,
    order,
    minPrice: minPrice != null && !isNaN(minPrice) ? minPrice : null,
    maxPrice: maxPrice != null && !isNaN(maxPrice) ? maxPrice : null,
    minQuality: minQuality != null && !isNaN(minQuality) ? minQuality : null,
    minDamage: minDamage != null && !isNaN(minDamage) ? minDamage : null,
    minAccuracy: minAccuracy != null && !isNaN(minAccuracy) ? minAccuracy : null,
    offset,
    limit,
    weapon,
    bonus,
    type,
    seller,
  };
}

/**
 * Validate get-auction-sold query params (weapon/bonus whitelist + pagination).
 */
function validateAuctionSoldParams(params = {}) {
  const offset = parseIntSafe(params.offset, 0, { min: 0, max: MAX_OFFSET });
  const limit = parseIntSafe(params.limit, 24, { min: 1, max: 200 });

  const weaponRaw = (params.weapon || '').trim();
  const bonusRaw = (params.bonus || '').trim();
  const weapon = weaponRaw && WEAPONS.includes(weaponRaw) ? weaponRaw : '';
  const bonus = bonusRaw && WEAPON_BONUSES.includes(bonusRaw) ? bonusRaw : '';

  return { offset, limit, weapon, bonus };
}

const MAX_DESCRIPTION_LENGTH = 5000;

/**
 * Validate update-item request body.
 * Returns { valid: boolean, error?: string, data?: object }.
 */
function validateUpdateItemBody(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }
  const { myDescription, myPrice, isSold } = body;

  const hasField =
    myDescription !== undefined || myPrice !== undefined || isSold !== undefined;
  if (!hasField) {
    return { valid: false, error: 'At least one field must be provided' };
  }

  const data = {};

  if (myDescription !== undefined) {
    if (typeof myDescription !== 'string') {
      return { valid: false, error: 'myDescription must be a string' };
    }
    data.myDescription =
      myDescription.length > MAX_DESCRIPTION_LENGTH
        ? myDescription.slice(0, MAX_DESCRIPTION_LENGTH)
        : myDescription === ''
          ? null
          : myDescription;
  }

  if (myPrice !== undefined) {
    if (myPrice !== null && myPrice !== '') {
      const num = typeof myPrice === 'number' ? myPrice : parseInt(myPrice, 10);
      if (isNaN(num) || num < 0) {
        return { valid: false, error: 'myPrice must be a non-negative number' };
      }
      data.myPrice = BigInt(Math.min(Math.floor(num), PRICE_BOUND));
    } else {
      data.myPrice = null;
    }
  }

  if (isSold !== undefined) {
    if (typeof isSold !== 'boolean') {
      return { valid: false, error: 'isSold must be a boolean' };
    }
    data.isSold = isSold;
  }

  return { valid: true, data };
}

module.exports = {
  trimString,
  whitelist,
  parseIntSafe,
  parseFloatSafe,
  validateGetItemsParams,
  validateAuctionSoldParams,
  validateUpdateItemBody,
  SORT_WHITELIST,
  ORDER_WHITELIST,
};
