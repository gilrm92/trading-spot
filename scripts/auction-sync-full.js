/**
 * One-time full auction house scan: follows `prev` until the end (weapon rows only).
 * Env: DATABASE_URL, TORN_AUCTION_API_KEY
 *
 * CLI: --interval-seconds=5 (delay between API requests, default 5)
 */

const { PrismaClient } = require('@prisma/client');
const { runPaginationPass } = require('../netlify/functions/_shared/auctionHouseSync');

const prisma = new PrismaClient();

function parseArgs(argv) {
  let intervalSeconds = 5;
  for (const arg of argv) {
    const m = arg.match(/^--interval-seconds=(\d+(?:\.\d+)?)$/);
    if (m) intervalSeconds = Math.max(0, parseFloat(m[1]));
  }
  return { intervalSeconds };
}

async function main() {
  const { intervalSeconds } = parseArgs(process.argv.slice(2));
  const intervalMs = Math.round(intervalSeconds * 1000);

  const apiKey = process.env.TORN_AUCTION_API_KEY?.trim();
  if (!apiKey) {
    console.error('Missing TORN_AUCTION_API_KEY');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  console.log(
    `[auction-sync:full] Starting full scan (${intervalSeconds}s between pages)…`
  );

  try {
    const { pagesFetched } = await runPaginationPass(prisma, apiKey, intervalMs);
    console.log(`[auction-sync:full] Done. Pages fetched: ${pagesFetched}`);
  } catch (e) {
    console.error('[auction-sync:full] Fatal', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
