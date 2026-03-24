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

async function upsertWeaponListing(prisma, entry) {
  const item = entry.item;
  if (!item || String(item.type || '').toLowerCase() !== 'weapon') return;

  if (entry.id == null || item.id == null || item.uid == null) return;
  const seller = entry.seller || {};
  if (seller.id == null) return;

  const bonuses = Array.isArray(item.bonuses) ? item.bonuses : [];
  if (bonuses.length > 2) {
    console.warn('[auction-sync] More than 2 bonuses; truncating', {
      auctionId: entry.id,
      count: bonuses.length,
    });
  }

  const stats = item.stats || {};
  const subType = item.sub_type != null ? String(item.sub_type) : null;

  await prisma.$transaction(async (tx) => {
    await tx.itemCatalog.upsert({
      where: { tornItemId: item.id },
      create: {
        tornItemId: item.id,
        name: String(item.name || ''),
        type: String(item.type || ''),
        subType,
      },
      update: {
        name: String(item.name || ''),
        type: String(item.type || ''),
        subType,
      },
    });

    let bonus1Id = null;
    let bonus2Id = null;
    let bonus1Value = null;
    let bonus2Value = null;

    const b0 = bonuses[0];
    const b1 = bonuses[1];
    if (b0 && b0.id != null) {
      await tx.bonusDefinition.upsert({
        where: { bonusId: b0.id },
        create: {
          bonusId: b0.id,
          title: String(b0.title || ''),
          description: String(b0.description || ''),
        },
        update: {
          title: String(b0.title || ''),
          description: String(b0.description || ''),
        },
      });
      bonus1Id = b0.id;
      bonus1Value = numOrNull(b0.value);
    }
    if (b1 && b1.id != null) {
      await tx.bonusDefinition.upsert({
        where: { bonusId: b1.id },
        create: {
          bonusId: b1.id,
          title: String(b1.title || ''),
          description: String(b1.description || ''),
        },
        update: {
          title: String(b1.title || ''),
          description: String(b1.description || ''),
        },
      });
      bonus2Id = b1.id;
      bonus2Value = numOrNull(b1.value);
    }

    const buyer = entry.buyer || {};

    await tx.auctionHouseListing.upsert({
      where: { auctionId: entry.id },
      create: {
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
        bonus1Id,
        bonus2Id,
        bonus1Value,
        bonus2Value,
        damage: numOrNull(stats.damage),
        accuracy: numOrNull(stats.accuracy),
        armor: numOrNull(stats.armor),
        quality: numOrNull(stats.quality),
        rarity: item.rarity != null ? String(item.rarity) : null,
      },
      update: {
        itemUid: BigInt(item.uid),
        sellerId: seller.id,
        sellerName: String(seller.name || ''),
        buyerId: buyer.id != null ? buyer.id : null,
        buyerName: buyer.name != null ? String(buyer.name) : null,
        timestamp: entry.timestamp,
        price: BigInt(entry.price),
        bids: entry.bids,
        tornItemId: item.id,
        bonus1Id,
        bonus2Id,
        bonus1Value,
        bonus2Value,
        damage: numOrNull(stats.damage),
        accuracy: numOrNull(stats.accuracy),
        armor: numOrNull(stats.armor),
        quality: numOrNull(stats.quality),
        rarity: item.rarity != null ? String(item.rarity) : null,
      },
    });
  });
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

/**
 * Walk `prev` until exhausted. Waits `intervalMs` between requests (not before the first).
 * Stops early if an entire page’s auction ids are already in the DB (optional backfill shortcut).
 */
async function runPaginationPass(prisma, apiKey, intervalMs) {
  let url = initialAuctionHouseUrl(apiKey);
  let firstRequest = true;
  let pagesFetched = 0;

  while (url) {
    if (!firstRequest) await sleep(intervalMs);
    firstRequest = false;

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

    if (ids.length > 0 && (await pageAllKnown(prisma, ids))) {
      break;
    }

    for (const entry of rows) {
      try {
        await upsertWeaponListing(prisma, entry);
      } catch (e) {
        console.error('[auction-sync] Row failed', {
          auctionId: entry?.id,
          err: e.message,
        });
      }
    }

    const prev = data._metadata?.links?.prev;
    url = prev ? withApiKey(prev, apiKey) : null;
  }

  return { pagesFetched };
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
  for (const entry of rows) {
    try {
      await upsertWeaponListing(prisma, entry);
    } catch (e) {
      console.error('[auction-sync] Row failed', {
        auctionId: entry?.id,
        err: e.message,
      });
    }
  }

  return { pagesFetched: 1, rowCount: rows.length };
}

module.exports = {
  runPaginationPass,
  runHeadPollPass,
  upsertWeaponListing,
  sleep,
  withApiKey,
  initialAuctionHouseUrl,
};
