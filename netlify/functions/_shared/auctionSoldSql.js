const { Prisma } = require('@prisma/client');

/**
 * Build WHERE + ORDER BY for sold auction weapon listings (joins catalog + bonus defs).
 * @param {object} opts
 * @param {string} [opts.validWeapon] whitelisted weapon name substring
 * @param {string} [opts.validBonus] whitelisted bonus title
 * @param {number|null} [opts.bonusValue] rounded integer %; only when validBonus set
 * @param {'soldAt'|'price'|'bonusValue'} opts.sort
 * @param {'asc'|'desc'} opts.order
 */
function buildOrderedAuctionIdsQuery({ validWeapon, validBonus, bonusValue, sort, order }) {
  const dir = order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  const weaponFrag = validWeapon
    ? Prisma.sql`AND c.name ILIKE ${'%' + validWeapon + '%'}`
    : Prisma.empty;

  const bonusFrag =
    validBonus && bonusValue != null
      ? Prisma.sql`AND (
          (LOWER(TRIM(bd1.title)) = LOWER(${validBonus}) AND ROUND(l.bonus_1_value::numeric) = ${bonusValue})
          OR (LOWER(TRIM(bd2.title)) = LOWER(${validBonus}) AND ROUND(l.bonus_2_value::numeric) = ${bonusValue})
        )`
      : validBonus
        ? Prisma.sql`AND (
            LOWER(TRIM(bd1.title)) = LOWER(${validBonus})
            OR LOWER(TRIM(bd2.title)) = LOWER(${validBonus})
          )`
        : Prisma.empty;

  let orderBy;
  if (sort === 'price') {
    orderBy = Prisma.sql`ORDER BY l.price ${dir}`;
  } else if (sort === 'bonusValue' && validBonus) {
    orderBy = Prisma.sql`ORDER BY (
      CASE
        WHEN LOWER(TRIM(bd1.title)) = LOWER(${validBonus}) THEN l.bonus_1_value
        WHEN LOWER(TRIM(bd2.title)) = LOWER(${validBonus}) THEN l.bonus_2_value
        ELSE NULL
      END
    ) ${dir} NULLS LAST`;
  } else {
    orderBy = Prisma.sql`ORDER BY l.timestamp ${dir}`;
  }

  return Prisma.sql`
    SELECT l.auction_id AS auction_id
    FROM auction_house_listing l
    INNER JOIN torn_item_catalog c ON c.torn_item_id = l.torn_item_id
    LEFT JOIN torn_bonus_definition bd1 ON bd1.bonus_id = l.bonus_1_id
    LEFT JOIN torn_bonus_definition bd2 ON bd2.bonus_id = l.bonus_2_id
    WHERE l.buyer_id IS NOT NULL
      AND LOWER(c.type) = 'weapon'
      ${weaponFrag}
      ${bonusFrag}
    ${orderBy}
  `;
}

function utcMonthStartUnixSeconds(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return Math.floor(Date.UTC(y, m, 1) / 1000);
}

/**
 * Per rounded bonus %: avg price all-time, this UTC month, last UTC month.
 * @param {string} validWeapon
 * @param {string} validBonus
 * @param {number|null} [bonusValue] if set, only that rounded %
 */
function buildAuctionSoldStatsQuery(validWeapon, validBonus, bonusValue, thisMonthStart, lastMonthStart) {
  const weaponFrag = Prisma.sql`AND c.name ILIKE ${'%' + validWeapon + '%'}`;

  const bonusValueFrag =
    bonusValue != null
      ? Prisma.sql`AND ROUND(
          (CASE
            WHEN LOWER(TRIM(bd1.title)) = LOWER(${validBonus}) THEN l.bonus_1_value
            WHEN LOWER(TRIM(bd2.title)) = LOWER(${validBonus}) THEN l.bonus_2_value
            ELSE NULL
          END)::numeric
        ) = ${bonusValue}`
      : Prisma.empty;

  return Prisma.sql`
    SELECT
      ROUND(
        (CASE
          WHEN LOWER(TRIM(bd1.title)) = LOWER(${validBonus}) THEN l.bonus_1_value
          WHEN LOWER(TRIM(bd2.title)) = LOWER(${validBonus}) THEN l.bonus_2_value
          ELSE NULL
        END)::numeric
      )::int AS bonus_value,
      AVG(l.price::numeric) AS avg_all,
      AVG(l.price::numeric) FILTER (WHERE l.timestamp >= ${thisMonthStart}) AS avg_this_month,
      AVG(l.price::numeric) FILTER (WHERE l.timestamp >= ${lastMonthStart} AND l.timestamp < ${thisMonthStart}) AS avg_last_month,
      COUNT(*)::int AS sale_count
    FROM auction_house_listing l
    INNER JOIN torn_item_catalog c ON c.torn_item_id = l.torn_item_id
    LEFT JOIN torn_bonus_definition bd1 ON bd1.bonus_id = l.bonus_1_id
    LEFT JOIN torn_bonus_definition bd2 ON bd2.bonus_id = l.bonus_2_id
    WHERE l.buyer_id IS NOT NULL
      AND LOWER(c.type) = 'weapon'
      ${weaponFrag}
      AND (
        LOWER(TRIM(bd1.title)) = LOWER(${validBonus})
        OR LOWER(TRIM(bd2.title)) = LOWER(${validBonus})
      )
      AND (
        CASE
          WHEN LOWER(TRIM(bd1.title)) = LOWER(${validBonus}) THEN l.bonus_1_value
          WHEN LOWER(TRIM(bd2.title)) = LOWER(${validBonus}) THEN l.bonus_2_value
          ELSE NULL
        END
      ) IS NOT NULL
      ${bonusValueFrag}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
}

module.exports = {
  buildOrderedAuctionIdsQuery,
  buildAuctionSoldStatsQuery,
  utcMonthStartUnixSeconds,
};
