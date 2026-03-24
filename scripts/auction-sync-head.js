/**
 * Continuous poll: only the newest auction house page (weapon rows), on an interval.
 * Use after a full scan (`npm run auction-sync:full`). Env: DATABASE_URL, TORN_AUCTION_API_KEY
 *
 * CLI: --head-interval-seconds=30 (default 30)
 */

const { PrismaClient } = require('@prisma/client');
const {
  runHeadPollPass,
  sleep,
} = require('../netlify/functions/_shared/auctionHouseSync');

const prisma = new PrismaClient();

function parseArgs(argv) {
  let headIntervalSeconds = 30;
  for (const arg of argv) {
    const h = arg.match(/^--head-interval-seconds=(\d+(?:\.\d+)?)$/);
    if (h) headIntervalSeconds = Math.max(1, parseFloat(h[1]));
  }
  return { headIntervalSeconds };
}

async function main() {
  const { headIntervalSeconds } = parseArgs(process.argv.slice(2));
  const headIntervalMs = Math.round(headIntervalSeconds * 1000);

  const apiKey = process.env.TORN_AUCTION_API_KEY?.trim();
  if (!apiKey) {
    console.error('Missing TORN_AUCTION_API_KEY');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.log('\n[auction-sync:head] Shutting down…');
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(
    `[auction-sync:head] Polling first page every ${headIntervalSeconds}s (Ctrl+C to stop)`
  );

  try {
    while (!stopping) {
      await runHeadPollPass(prisma, apiKey);
      if (stopping) break;
      await sleep(headIntervalMs);
    }
  } catch (e) {
    console.error('[auction-sync:head] Fatal', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
