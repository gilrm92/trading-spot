/**
 * One-time full auction house scan: follows `prev` until the end (weapon rows only).
 * Env: DATABASE_URL, TORN_AUCTION_API_KEY (e.g. in project root `.env`)
 *
 * Progress is saved to `.auction-sync-state.json` after each page: the **next** Torn `prev`
 * URL (usually includes `to=<unix>`). On restart, the next fetch continues **that** older
 * page — same as Torn’s timestamp cursor, not a separate “last row in DB” query.
 * Delete the file or use `--fresh` to start from the newest page again.
 *
 * CLI: --interval-seconds=5, --fresh
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { runPaginationPass } = require('../netlify/functions/_shared/auctionHouseSync');

const prisma = new PrismaClient();

const RESUME_STATE_PATH = path.join(__dirname, '..', '.auction-sync-state.json');

function parseArgs(argv) {
  let intervalSeconds = 5;
  let fresh = false;
  for (const arg of argv) {
    if (arg === '--fresh') fresh = true;
    const m = arg.match(/^--interval-seconds=(\d+(?:\.\d+)?)$/);
    if (m) intervalSeconds = Math.max(0, parseFloat(m[1]));
  }
  return { intervalSeconds, fresh };
}

async function main() {
  const { intervalSeconds, fresh } = parseArgs(process.argv.slice(2));
  const intervalMs = Math.round(intervalSeconds * 1000);

  if (fresh && fs.existsSync(RESUME_STATE_PATH)) {
    fs.unlinkSync(RESUME_STATE_PATH);
    console.log('[auction-sync:full] Removed saved progress (--fresh).');
  }

  const apiKey =
    process.env.TORN_AUCTION_API_KEY?.trim() ||
    process.env.TORN_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      'Missing TORN_AUCTION_API_KEY (or TORN_API_KEY) in .env'
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  console.log(
    `[auction-sync:full] Starting full scan (${intervalSeconds}s between pages)…`
  );
  console.log(
    '[auction-sync:full] Only auctions whose item type is "Weapon" are written to auction_house_listing.'
  );
  if (!fresh && fs.existsSync(RESUME_STATE_PATH)) {
    try {
      const snap = JSON.parse(fs.readFileSync(RESUME_STATE_PATH, 'utf8'));
      console.log(
        `[auction-sync:full] Saved progress from ${snap.updatedAt || '(unknown)'} — will resume unless you use --fresh.`
      );
    } catch {
      /* ignore */
    }
  }

  try {
    const { pagesFetched, resumed, totalWeaponsUpserted } =
      await runPaginationPass(prisma, apiKey, intervalMs, {
        resumeStatePath: RESUME_STATE_PATH,
      });
    let listingCount = null;
    try {
      listingCount = await prisma.auctionHouseListing.count();
    } catch (e) {
      console.warn('[auction-sync:full] Could not count listings', e.message);
    }
    console.log(
      `[auction-sync:full] Done. Pages: ${pagesFetched}${resumed ? ' (resumed)' : ''} | weapon rows upserted this run: ${totalWeaponsUpserted ?? 0}` +
        (listingCount != null
          ? ` | total rows in auction_house_listing: ${listingCount}`
          : '')
    );
  } catch (e) {
    console.error('[auction-sync:full] Fatal', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
