/**
 * Torn weapons from https://wiki.torn.com/wiki/Weapon
 * Used for search filter dropdown.
 */
export const WEAPONS = [
  'AK-47', 'Axe', 'Baseball Bat', 'Benelli M1', 'Beretta 92FS', 'Chainsaw',
  'Claymore Mine', 'Crossbow', 'Crowbar', 'Desert Eagle', 'Flamethrower',
  'Glock 17', 'Ithaca 37', 'Katana', 'M16 A2', 'M4A1', 'MP5', 'MP9', 'P90',
  'Pepper Spray', 'RPG Launcher', 'Samurai Sword', 'Sawed-Off Shotgun',
  'S&W M29', 'Steyr AUG', 'Taser', 'Tear Gas', 'UMP', 'USP', 'XM8',
].sort((a, b) => a.localeCompare(b));
