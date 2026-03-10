/**
 * Maps Torn API types/sub_types to app types (Primary, Secondary, Melee).
 * Used by add-by-uid and sync-items.
 */
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
};

function getAppTypeFromTorn(tornType, subType, displayType) {
  const sub = (subType || '').trim().replace(/-/g, '_');
  const mapped = TORN_SUB_TYPE_TO_APP_TYPE[sub];
  if (mapped) return mapped;
  const displayMatch = ALLOWED_WEAPON_TYPES.find(
    (t) => t.toLowerCase() === (displayType || '').trim().toLowerCase()
  );
  if (displayMatch) return displayMatch;
  if ((tornType || '').toLowerCase() === 'weapon') return 'Primary';
  return displayType || tornType || 'Primary';
}

module.exports = {
  ALLOWED_WEAPON_TYPES,
  TORN_SUB_TYPE_TO_APP_TYPE,
  getAppTypeFromTorn,
};
