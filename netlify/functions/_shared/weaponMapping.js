/**
 * Maps Torn API data to category (Primary, Secondary, Melee).
 * Uses weapon NAME as primary source - sub_type cannot be trusted (e.g. some SMGs are Secondary).
 */
const WEAPON_TYPE_MAP = require('./weaponTypesMap');
const ALLOWED_WEAPON_TYPES = ['Primary', 'Secondary', 'Melee'];

const TORN_SUB_TYPE_TO_APP_TYPE = {
  Rifle: 'Primary',
  Carbine: 'Primary',
  Shotgun: 'Primary',
  Assault_Rifle: 'Primary',
  SMG: 'Primary',
  LMG: 'Primary',
  Sniper: 'Primary',
  Pistol: 'Secondary',
  Revolver: 'Secondary',
  Melee: 'Melee',
  Slashing: 'Melee',
  Clubbing: 'Melee',
  Piercing: 'Melee',
};

/**
 * Get category (Primary/Secondary/Melee) from weapon data.
 * Priority: 1) weapon name lookup, 2) display type if already Primary/Secondary/Melee, 3) sub_type fallback.
 */
function getAppTypeFromTorn(weaponName, tornType, subType, displayType) {
  const name = (weaponName || '').trim();
  if (name) {
    const exact = WEAPON_TYPE_MAP[name];
    if (exact) return exact;
    const sortedNames = Object.keys(WEAPON_TYPE_MAP).sort((a, b) => b.length - a.length);
    const longestMatch = sortedNames.find((w) => name.includes(w));
    if (longestMatch) return WEAPON_TYPE_MAP[longestMatch];
  }
  const displayMatch = ALLOWED_WEAPON_TYPES.find(
    (t) => t.toLowerCase() === (displayType || '').trim().toLowerCase()
  );
  if (displayMatch) return displayMatch;
  const sub = (subType || '').trim().replace(/-/g, '_');
  const subMapped = TORN_SUB_TYPE_TO_APP_TYPE[sub];
  if (subMapped) return subMapped;
  if ((tornType || '').toLowerCase() === 'weapon') return 'Primary';
  return displayType || tornType || 'Primary';
}

module.exports = {
  ALLOWED_WEAPON_TYPES,
  TORN_SUB_TYPE_TO_APP_TYPE,
  WEAPON_TYPE_MAP,
  getAppTypeFromTorn,
};
