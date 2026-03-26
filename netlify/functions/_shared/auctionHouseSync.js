const fs = require('fs');
const path = require('path');

const BASE_PATH = '/v2/market/auctionhouse';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withApiKey(urlString, apiKey) {
  const u = new URL(urlString);
  u.searchParams.set('key', apiKey);
  return u.toString();
}

function initialAuctionHouseUrl(apiKey) {
  const u = new URL('https://api.torn.com' + BASE_PATH);
  u.searchParams.set('limit', '100');
  u.searchParams.set('sort', 'DESC');
  u.searchParams.set('key', apiKey);
  return u.toString();
}

function numOrNull(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** One transaction per Torn page: dedupe catalog + bonus upserts, then all listings. */
const BATCH_TX_OPTIONS = {
  maxWait: 30_000,
  timeout: 120_000,
};

function parseWeaponListing(entry) {
  const item = entry.item;
  if (!item || String(item.type || '').toLowerCase() !== 'weapon') return null;
  if (entry.id == null || item.id == null || item.uid == null) return null;
  const seller = entry.seller || {};
  if (seller.id == null) return null;

  const bonuses = Array.isArray(item.bonuses) ? item.bonuses : [];
  if (bonuses.length > 2) {
    console.warn('[auction-sync] More than 2 bonuses; truncating', {
      auctionId: entry.id,
      count: bonuses.length,
    });
  }

  const stats = item.stats || {};
  const subType = item.sub_type != null ? String(item.sub_type) : null;
  const buyer = entry.buyer || {};
  const b0 = bonuses[0];
  const b1 = bonuses[1];

  const bonusDefs = [];
  if (b0 && b0.id != null) {
    bonusDefs.push({
      bonusId: b0.id,
      title: String(b0.title || ''),
      description: String(b0.description || ''),
    });
  }
  if (b1 && b1.id != null) {
    bonusDefs.push({
      bonusId: b1.id,
      title: String(b1.title || ''),
      description: String(b1.description || ''),
    });
  }

  const listing = {
    auctionId: entry.id,
    itemUid: BigInt(item.uid),
    sellerId: seller.id,
    sellerName: String(seller.name || ''),
    buyerId: buyer.id != null ? buyer.id : null,
    buyerName: buyer.name != null ? String(buyer.name) : null,
    timestamp: entry.timestamp,
    price: BigInt(entry.price),
    bids: entry.bids,
    tornItemId: item.id,
    bonus1Id: b0 && b0.id != null ? b0.id : null,
    bonus2Id: b1 && b1.id != null ? b1.id : null,
    bonus1Value: b0 && b0.id != null ? numOrNull(b0.value) : null,
    bonus2Value: b1 && b1.id != null ? numOrNull(b1.value) : null,
    damage: numOrNull(stats.damage),
    accuracy: numOrNull(stats.accuracy),
    armor: numOrNull(stats.armor),
    quality: numOrNull(stats.quality),
    rarity: item.rarity != null ? String(item.rarity) : null,
  };

  const catalog = {
    tornItemId: item.id,
    name: String(item.name || ''),
    type: String(item.type || ''),
    subType,
  };

  return { catalog, bonusDefs, listing };
}

/** Why a row was not stored (only weapon rows are stored). */
function skipReason(entry) {
  const item = entry?.item;
  if (!item) return 'no_item';
  if (String(item.type || '').toLowerCase() !== 'weapon') return 'not_weapon';
  if (entry.id == null || item.id == null || item.uid == null) {
    return 'weapon_bad_ids';
  }
  const seller = entry.seller || {};
  if (seller.id == null) return 'weapon_no_seller';
  return null;
}

async function upsertWeaponAuctionPage(prisma, rows) {
  const apiRowCount = Array.isArray(rows) ? rows.length : 0;
  const skipCounts = {
    not_weapon: 0,
    no_item: 0,
    weapon_bad_ids: 0,
    weapon_no_seller: 0,
    parse_error: 0,
  };

  const catalogs = new Map();
  const bonuses = new Map();
  const listings = [];

  for (const entry of rows) {
    try {
      const parsed = parseWeaponListing(entry);
      if (!parsed) {
        const r = skipReason(entry);
        if (r && skipCounts[r] != null) skipCounts[r] += 1;
        else skipCounts.not_weapon += 1;
        continue;
      }
      catalogs.set(parsed.catalog.tornItemId, parsed.catalog);
      for (const b of parsed.bonusDefs) {
        bonuses.set(b.bonusId, b);
      }
      listings.push(parsed.listing);
    } catch (e) {
      skipCounts.parse_error += 1;
      console.error('[auction-sync] Skip row (parse)', {
        auctionId: entry?.id,
        err: e.message,
      });
    }
  }

  const skippedNonWeapon = skipCounts.not_weapon;
  const skippedInvalid =
    skipCounts.no_item +
    skipCounts.weapon_bad_ids +
    skipCounts.weapon_no_seller +
    skipCounts.parse_error;

  if (listings.length === 0) {
    return {
      weaponRows: 0,
      apiRowCount,
      skippedNonWeapon,
      skippedInvalid,
      skipCounts,
      uniqueCatalogs: 0,
      uniqueBonuses: 0,
    };
  }

  await prisma.$transaction(async (tx) => {
    for (const c of catalogs.values()) {
      await tx.itemCatalog.upsert({
        where: { tornItemId: c.tornItemId },
        create: c,
        update: {
          name: c.name,
          type: c.type,
          subType: c.subType,
        },
      });
    }
    for (const b of bonuses.values()) {
      await tx.bonusDefinition.upsert({
        where: { bonusId: b.bonusId },
        create: b,
        update: {
          title: b.title,
          description: b.description,
        },
      });
    }
    for (const l of listings) {
      await tx.auctionHouseListing.upsert({
        where: { auctionId: l.auctionId },
        create: l,
        update: {
          itemUid: l.itemUid,
          sellerId: l.sellerId,
          sellerName: l.sellerName,
          buyerId: l.buyerId,
          buyerName: l.buyerName,
          timestamp: l.timestamp,
          price: l.price,
          bids: l.bids,
          tornItemId: l.tornItemId,
          bonus1Id: l.bonus1Id,
          bonus2Id: l.bonus2Id,
          bonus1Value: l.bonus1Value,
          bonus2Value: l.bonus2Value,
          damage: l.damage,
          accuracy: l.accuracy,
          armor: l.armor,
          quality: l.quality,
          rarity: l.rarity,
        },
      });
    }
  }, BATCH_TX_OPTIONS);

  return {
    weaponRows: listings.length,
    apiRowCount,
    skippedNonWeapon,
    skippedInvalid,
    skipCounts,
    uniqueCatalogs: catalogs.size,
    uniqueBonuses: bonuses.size,
  };
}

async function pageAllKnown(prisma, auctionIds) {
  if (auctionIds.length === 0) return true;
  const found = await prisma.auctionHouseListing.findMany({
    where: { auctionId: { in: auctionIds } },
    select: { auctionId: true },
  });
  const set = new Set(found.map((r) => r.auctionId));
  return auctionIds.every((id) => set.has(id));
}

function writeResumeState(resumeStatePath, nextUrl) {
  if (!resumeStatePath) return;
  try {
    const dir = path.dirname(resumeStatePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!nextUrl) {
      if (fs.existsSync(resumeStatePath)) fs.unlinkSync(resumeStatePath);
      return;
    }
    fs.writeFileSync(
      resumeStatePath,
      JSON.stringify(
        { nextUrl, updatedAt: new Date().toISOString() },
        null,
        2
      ),
      'utf8'
    );
  } catch (e) {
    console.warn('[auction-sync] Could not write resume state', e.message);
  }
}

function readResumeState(resumeStatePath) {
  if (!resumeStatePath || !fs.existsSync(resumeStatePath)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(resumeStatePath, 'utf8'));
    return typeof j.nextUrl === 'string' && j.nextUrl.length > 0 ? j : null;
  } catch {
    return null;
  }
}

/** Torn’s `prev` links usually include `to=<unix>` — that is the pagination cursor. */
function describeTornCursor(urlString) {
  try {
    const u = new URL(urlString);
    const to = u.searchParams.get('to');
    if (to) {
      return `to=${to} (unix seconds — older-than cursor for this page)`;
    }
    return 'no `to` in query (first/newest page URL shape)';
  } catch {
    return 'unparseable URL';
  }
}

/**
 * Walk `prev` until exhausted. Waits `intervalMs` between requests (not before the first).
 * Stops early if a **non-first** page’s auction ids are all already in the DB (backfill shortcut).
 *
 * @param {{ resumeStatePath?: string }} [options] If `resumeStatePath` is set (local full scan only),
 *   saves the next URL after each page so a later run can resume after connection errors.
 */
async function runPaginationPass(prisma, apiKey, intervalMs, options = {}) {
  const resumeStatePath = options.resumeStatePath;
  const saved = readResumeState(resumeStatePath);
  let url = saved
    ? withApiKey(saved.nextUrl, apiKey)
    : initialAuctionHouseUrl(apiKey);

  if (saved) {
    const cursor = describeTornCursor(saved.nextUrl);
    console.log(
      '[auction-sync] Resuming: next request uses the saved Torn `prev` URL (not MAX(timestamp) from our DB).'
    );
    console.log(`[auction-sync] Resume cursor: ${cursor}`);
    console.log(
      '[auction-sync] Delete .auction-sync-state.json or use npm run auction-sync:full -- --fresh to start from newest page again.'
    );
  }

  let firstRequest = true;
  let pagesFetched = 0;
  let totalWeaponsUpserted = 0;

  while (url) {
    if (!firstRequest) await sleep(intervalMs);
    firstRequest = false;

    console.log(
      `[auction-sync] Fetching page #${pagesFetched + 1}… (${intervalMs > 0 ? `then ${intervalMs}ms pause before next` : 'no pause'})`
    );

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url.split('?')[0]}`);
    }

    const data = await res.json();
    if (data.error) {
      const msg =
        typeof data.error === 'object'
          ? JSON.stringify(data.error)
          : String(data.error);
      throw new Error(`Torn API error: ${msg}`);
    }

    pagesFetched += 1;

    const rows = Array.isArray(data.auctionhouse) ? data.auctionhouse : [];
    const ids = rows.map((r) => r.id).filter((id) => id != null);

    // Skip this shortcut on page 1: after a partial run, page 1 can be "all known"
    // while older pages are not — we must still follow `prev`.
    if (
      pagesFetched > 1 &&
      ids.length > 0 &&
      (await pageAllKnown(prisma, ids))
    ) {
      console.log(
        `[auction-sync] Page ${pagesFetched}: early stop — every auction id on this page is already in the DB (nothing older to pull via this shortcut).`
      );
      writeResumeState(resumeStatePath, null);
      break;
    }

    let batch = {
      weaponRows: 0,
      apiRowCount: rows.length,
      skippedNonWeapon: 0,
      skippedInvalid: 0,
      uniqueCatalogs: 0,
      uniqueBonuses: 0,
    };
    try {
      batch = await upsertWeaponAuctionPage(prisma, rows);
      totalWeaponsUpserted += batch.weaponRows;
    } catch (e) {
      console.error('[auction-sync] Page batch failed', e.message);
    }

    const prev = data._metadata?.links?.prev;
    const nextUrl = prev ? withApiKey(prev, apiKey) : null;

    const iso = new Date().toISOString();
    console.log(
      `[auction-sync] ${iso} | page #${pagesFetched} | API rows: ${batch.apiRowCount} | weapons upserted: ${batch.weaponRows} | skipped (non-weapon): ${batch.skippedNonWeapon} | skipped (invalid weapon): ${batch.skippedInvalid} | uniq catalog/bonus: ${batch.uniqueCatalogs}/${batch.uniqueBonuses} | older page: ${nextUrl ? 'yes' : 'no'}`
    );
    if (batch.apiRowCount > 0 && batch.weaponRows === 0) {
      console.log(
        '[auction-sync] Hint: only items with type "Weapon" are saved. If this page is all armor/other, `auction_house_listing` count will not grow.'
      );
    }

    writeResumeState(resumeStatePath, nextUrl);
    url = nextUrl;
  }

  return {
    pagesFetched,
    resumed: Boolean(saved),
    totalWeaponsUpserted,
  };
}

/**
 * Single request: newest page only (no `prev`). For steady-state “new listings” polling.
 */
async function runHeadPollPass(prisma, apiKey) {
  const url = initialAuctionHouseUrl(apiKey);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url.split('?')[0]}`);
  }

  const data = await res.json();
  if (data.error) {
    const msg =
      typeof data.error === 'object'
        ? JSON.stringify(data.error)
        : String(data.error);
    throw new Error(`Torn API error: ${msg}`);
  }

  const rows = Array.isArray(data.auctionhouse) ? data.auctionhouse : [];
  let batch = {
    weaponRows: 0,
    apiRowCount: rows.length,
    skippedNonWeapon: 0,
    skippedInvalid: 0,
  };
  try {
    batch = await upsertWeaponAuctionPage(prisma, rows);
  } catch (e) {
    console.error('[auction-sync] Page batch failed', e.message);
  }

  const iso = new Date().toISOString();
  console.log(
    `[auction-sync:head] ${iso} | API rows: ${batch.apiRowCount} | weapons upserted: ${batch.weaponRows} | skipped non-weapon: ${batch.skippedNonWeapon} | skipped invalid: ${batch.skippedInvalid}`
  );

  return {
    pagesFetched: 1,
    rowCount: rows.length,
    weaponRows: batch.weaponRows,
  };
}

module.exports = {
  runPaginationPass,
  runHeadPollPass,
  upsertWeaponAuctionPage,
  sleep,
  withApiKey,
  initialAuctionHouseUrl,
};
