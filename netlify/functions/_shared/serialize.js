/**
 * Serialize Prisma Item for JSON responses.
 * Converts BigInt fields (uid, marketPrice, myPrice) to JSON-safe values.
 */
function serializeItem(item) {
  if (!item) return item;
  return {
    ...item,
    uid: item.uid != null ? item.uid.toString() : item.uid,
    marketPrice: item.marketPrice != null ? Number(item.marketPrice) : item.marketPrice,
    myPrice: item.myPrice != null ? Number(item.myPrice) : item.myPrice,
  };
}

function serializeBonusDef(b) {
  if (!b) return null;
  return {
    bonusId: b.bonusId,
    title: b.title,
    description: b.description,
  };
}

function serializeCatalog(c) {
  if (!c) return null;
  return {
    tornItemId: c.tornItemId,
    name: c.name,
    type: c.type,
    subType: c.subType,
  };
}

/**
 * JSON-safe auction listing row with relations.
 */
function serializeAuctionListing(row) {
  if (!row) return row;
  const { catalog, bonus1, bonus2, ...rest } = row;
  return {
    ...rest,
    itemUid: rest.itemUid != null ? rest.itemUid.toString() : rest.itemUid,
    price: rest.price != null ? Number(rest.price) : rest.price,
    catalog: serializeCatalog(catalog),
    bonus1: serializeBonusDef(bonus1),
    bonus2: serializeBonusDef(bonus2),
  };
}

module.exports = { serializeItem, serializeAuctionListing };
