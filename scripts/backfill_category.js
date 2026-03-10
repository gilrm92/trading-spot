/**
 * Backfill category column (Primary, Secondary, Melee) using weapon name lookup.
 * Run: node scripts/backfill_category.js
 * Requires: DATABASE_URL in .env
 */
const { PrismaClient } = require('@prisma/client');
const WEAPON_TYPE_MAP = require('../netlify/functions/_shared/weaponTypesMap');

const prisma = new PrismaClient();

function getCategoryFromName(name) {
  const n = (name || '').trim();
  if (!n) return null;
  const exact = WEAPON_TYPE_MAP[n];
  if (exact) return exact;
  const sortedNames = Object.keys(WEAPON_TYPE_MAP).sort((a, b) => b.length - a.length);
  const longestMatch = sortedNames.find((w) => n.includes(w));
  return longestMatch ? WEAPON_TYPE_MAP[longestMatch] : null;
}

async function main() {
  const items = await prisma.item.findMany({
    select: { id: true, name: true, type: true, category: true },
  });

  if (items.length === 0) {
    console.log('No items in database.');
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const category = getCategoryFromName(item.name);
    if (!category) {
      console.warn(`Skipped id=${item.id} name="${item.name}" - not in weapon map`);
      skipped++;
      continue;
    }
    await prisma.item.update({
      where: { id: item.id },
      data: { category, type: 'Weapon' },
    });
    updated++;
    console.log(`Updated id=${item.id} "${item.name}" -> category=${category}`);
  }

  console.log(`Done. Updated ${updated}, skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
