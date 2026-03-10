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

module.exports = { serializeItem };
