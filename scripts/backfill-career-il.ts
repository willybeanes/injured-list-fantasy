/**
 * scripts/backfill-career-il.ts
 *
 * Fetches MLB transaction history (2021-2025) from the bulk transactions
 * endpoint and calculates career IL days + career seasons for every player.
 * Skips 2020 (COVID shortened season) to keep avg/season meaningful.
 *
 * Uses interval merging to prevent double-counting when a player has
 * multiple IL placements without matching activations (e.g., after a DFA).
 *
 * Run with:
 *   DATABASE_URL=... ~/.bun/bin/bun run scripts/backfill-career-il.ts
 */

import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL env var");
  process.exit(1);
}

const BASE_URL = "https://statsapi.mlb.com/api/v1";

// ─── Season definitions ────────────────────────────────────────────────────────

const SEASONS = [
  { year: 2021, startDate: "2021-03-20", endDate: "2021-11-15", seasonEnd: new Date("2021-11-03") },
  { year: 2022, startDate: "2022-03-20", endDate: "2022-11-15", seasonEnd: new Date("2022-11-05") },
  { year: 2023, startDate: "2023-03-20", endDate: "2023-11-15", seasonEnd: new Date("2023-11-01") },
  { year: 2024, startDate: "2024-03-20", endDate: "2024-11-15", seasonEnd: new Date("2024-10-30") },
  { year: 2025, startDate: "2025-03-20", endDate: "2025-11-15", seasonEnd: new Date("2025-11-01") },
];

// Max IL days we'll attribute to a single season (full season length as safety cap)
const MAX_SEASON_IL_DAYS = 190;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  typeCode: string;
  description: string;
  effectiveDate?: string;
  date?: string;
  person?: { id: number; fullName: string };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchTransactions(startDate: string, endDate: string): Promise<Transaction[]> {
  const url = `${BASE_URL}/transactions?sportId=1&startDate=${startDate}&endDate=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Transactions fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.transactions ?? []) as Transaction[];
}

// ─── Transaction classifiers ──────────────────────────────────────────────────

function txDate(tx: Transaction): string | undefined {
  return tx.effectiveDate || tx.date;
}

function isIlTx(tx: Transaction): boolean {
  return tx.typeCode === "SC" && (tx.description?.toLowerCase().includes("injured list") ?? false);
}
function isPlacement(tx: Transaction): boolean {
  return tx.description?.toLowerCase().includes("placed") ?? false;
}
function isActivation(tx: Transaction): boolean {
  return tx.description?.toLowerCase().includes("activated") ?? false;
}
function isTransfer(tx: Transaction): boolean {
  return tx.description?.toLowerCase().includes("transferred") ?? false;
}

// ─── Interval merging ─────────────────────────────────────────────────────────
// Merges overlapping [start, end] date pairs so overlapping stints are
// counted only once. Prevents double-counting when a player has multiple
// IL placements without matching activations (e.g., after DFA/release).

function mergeIntervals(intervals: Array<[Date, Date]>): Array<[Date, Date]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0].getTime() - b[0].getTime());
  const merged: Array<[Date, Date]> = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const [start, end] = sorted[i];
    if (start.getTime() <= last[1].getTime()) {
      // Overlapping — extend end if needed
      if (end.getTime() > last[1].getTime()) last[1] = end;
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

// ─── Core parsing ─────────────────────────────────────────────────────────────
// Returns Map<playerId, ilDaysThisSeason>

function parseSeasonIlDays(transactions: Transaction[], seasonEnd: Date): Map<number, number> {
  const parseDate = (tx: Transaction): Date | null => {
    const raw = txDate(tx);
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  // Group by player — two passes:
  //   Pass 1: IL placements (strict: SC + "placed" + "injured list")
  //   Pass 2: Activations (broad: SC + "activated", no "injured list" required)
  //           Only added for players who already have a placement this season,
  //           so stray spring-training activations never inflate anyone's days.
  const byPlayer = new Map<number, { placements: Date[]; activations: Date[] }>();

  for (const tx of transactions) {
    if (tx.typeCode !== "SC") continue;
    const d = parseDate(tx);
    if (!d) continue;
    const desc = tx.description?.toLowerCase() ?? "";
    if (!desc.includes("placed") || !desc.includes("injured list")) continue;
    if (isTransfer(tx)) continue;
    const playerId = tx.person?.id;
    if (!playerId) continue;
    if (!byPlayer.has(playerId)) byPlayer.set(playerId, { placements: [], activations: [] });
    byPlayer.get(playerId)!.placements.push(d);
  }

  for (const tx of transactions) {
    if (tx.typeCode !== "SC") continue;
    const d = parseDate(tx);
    if (!d) continue;
    const desc = tx.description?.toLowerCase() ?? "";
    if (!desc.includes("activated") || desc.includes("transferred")) continue;
    const playerId = tx.person?.id;
    if (!playerId) continue;
    if (!byPlayer.has(playerId)) continue; // only close stints for players with a placement
    byPlayer.get(playerId)!.activations.push(d);
  }

  const daysByPlayer = new Map<number, number>();

  for (const [playerId, { placements, activations }] of byPlayer.entries()) {
    placements.sort((a, b) => a.getTime() - b.getTime());
    activations.sort((a, b) => a.getTime() - b.getTime());

    const intervals: Array<[Date, Date]> = [];
    const unusedActivations = [...activations];

    for (const placement of placements) {
      // Find the first activation that occurs AFTER this placement
      const idx = unusedActivations.findIndex((a) => a.getTime() > placement.getTime());
      if (idx >= 0) {
        intervals.push([placement, unusedActivations[idx]]);
        unusedActivations.splice(idx, 1); // each activation closes exactly one stint
      } else {
        // No matching activation — season-ending injury or DFA/release; cap at season end
        intervals.push([placement, seasonEnd]);
      }
    }

    // Merge overlapping intervals to avoid double-counting same calendar days
    const merged = mergeIntervals(intervals);

    let total = 0;
    for (const [start, end] of merged) {
      total += Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    }

    // Hard cap: can't exceed a full season's worth of days
    daysByPlayer.set(playerId, Math.min(total, MAX_SEASON_IL_DAYS));
  }

  return daysByPlayer;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const db = new Client({ connectionString: DATABASE_URL });

try {
  await db.connect();
  console.log("Connected to database\n");

  const careerDays = new Map<number, number>();
  // Track the earliest season year each player appears in any SC transaction.
  // careerSeasons is then computed as (lastYear - firstYear + 1) at write time,
  // which correctly counts seasons even when a player had no roster moves in a year.
  const playerFirstSeason = new Map<number, number>();
  const playerNames = new Map<number, string>(); // for display only

  for (const season of SEASONS) {
    console.log(`=== ${season.year} (${season.startDate} → ${season.endDate}) ===`);
    const transactions = await fetchTransactions(season.startDate, season.endDate);
    const ilCount = transactions.filter(isIlTx).length;
    console.log(`  ${transactions.length.toLocaleString()} total transactions, ${ilCount} IL-related`);

    // Capture player names + earliest season seen
    for (const tx of transactions) {
      if (tx.person?.id && tx.person.fullName) {
        playerNames.set(tx.person.id, tx.person.fullName);
      }
      if (tx.typeCode === "SC" && tx.person?.id) {
        const pid = tx.person.id;
        if (!playerFirstSeason.has(pid) || season.year < playerFirstSeason.get(pid)!) {
          playerFirstSeason.set(pid, season.year);
        }
      }
    }

    const seasonDays = parseSeasonIlDays(transactions, season.seasonEnd);
    console.log(`  ${seasonDays.size} players had IL time`);

    // Top 5 sanity check
    const top5 = [...seasonDays.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [pid, days] of top5) {
      console.log(`    ${(playerNames.get(pid) ?? `id:${pid}`).padEnd(26)} ${days}d`);
    }

    // Accumulate IL days
    for (const [playerId, days] of seasonDays.entries()) {
      careerDays.set(playerId, (careerDays.get(playerId) ?? 0) + days);
    }
    console.log();
  }

  const lastYear = SEASONS[SEASONS.length - 1].year;

  // ─── Write to DB ──────────────────────────────────────────────────────────
  console.log(`=== Writing to database ===`);
  console.log(`Players with career IL data: ${careerDays.size}`);

  // Reset all players first (idempotent re-runs)
  await db.query(`UPDATE "MlbPlayer" SET "careerIlDays" = 0, "careerSeasons" = 0`);

  let updated = 0, skipped = 0;
  for (const [playerId, totalDays] of careerDays.entries()) {
    const firstYear = playerFirstSeason.get(playerId) ?? lastYear;
    const seasons = lastYear - firstYear + 1;
    const result = await db.query(
      `UPDATE "MlbPlayer" SET "careerIlDays" = $1, "careerSeasons" = $2 WHERE id = $3`,
      [totalDays, seasons, playerId]
    );
    if (result.rowCount && result.rowCount > 0) updated++;
    else skipped++;
  }

  console.log(`Career stats updated:  ${updated} players`);
  console.log(`Not in roster DB:      ${skipped} players (retired/released)\n`);
  // Note: seasonIlDays is managed by the sync-il cron for the current (2026) season only.

  // ─── Sanity check ─────────────────────────────────────────────────────────
  const topPlayers = await db.query(`
    SELECT "fullName", "careerIlDays", "careerSeasons",
           ROUND("careerIlDays"::numeric / GREATEST("careerSeasons", 1), 1) AS avg_per_season
    FROM "MlbPlayer"
    WHERE "careerIlDays" > 0
    ORDER BY "careerIlDays" DESC
    LIMIT 20
  `);

  console.log("=== Top 20 Career IL Days (current 40-man roster) ===");
  console.log("  " + "PLAYER".padEnd(26) + "TOTAL".padStart(6) + "  SEASONS  AVG/SEASON");
  console.log("  " + "─".repeat(56));
  for (const row of topPlayers.rows) {
    console.log(
      `  ${String(row.fullName).padEnd(26)}` +
      `${String(row.careerIlDays).padStart(5)}d` +
      `    ${String(row.careerseasons ?? row.careerSeasons).padStart(2)} seas` +
      `    ${String(row.avg_per_season).padStart(5)}d avg`
    );
  }

  const dist = await db.query(`
    SELECT
      CASE
        WHEN ROUND("careerIlDays"::numeric / GREATEST("careerSeasons", 1)) >= 50 THEN 'F (50+ avg)'
        WHEN ROUND("careerIlDays"::numeric / GREATEST("careerSeasons", 1)) >= 25 THEN 'D (25-49 avg)'
        WHEN ROUND("careerIlDays"::numeric / GREATEST("careerSeasons", 1)) >= 10 THEN 'C (10-24 avg)'
        WHEN ROUND("careerIlDays"::numeric / GREATEST("careerSeasons", 1)) >= 1  THEN 'B (1-9 avg)'
        ELSE 'A (0 avg)'
      END AS grade,
      COUNT(*) AS count
    FROM "MlbPlayer"
    WHERE "currentIlStatus" = 'active'
    GROUP BY 1 ORDER BY 1
  `);
  console.log("\n=== Grade distribution (active draft-eligible players) ===");
  for (const row of dist.rows) {
    console.log(`  ${row.grade}: ${row.count}`);
  }

} catch (err) {
  console.error("Error:", err);
  process.exit(1);
} finally {
  await db.end();
}
