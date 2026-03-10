/**
 * lib/il-utils.ts
 *
 * Shared IL transaction parsing utilities used by both the backfill script
 * and the player card API route.
 */

export const BASE_URL = "https://statsapi.mlb.com/api/v1";

// ─── Season definitions ────────────────────────────────────────────────────────

export const SEASONS = [
  { year: 2021, startDate: "2021-03-20", endDate: "2021-11-15", seasonEnd: new Date("2021-11-03") },
  { year: 2022, startDate: "2022-03-20", endDate: "2022-11-15", seasonEnd: new Date("2022-11-05") },
  { year: 2023, startDate: "2023-03-20", endDate: "2023-11-15", seasonEnd: new Date("2023-11-01") },
  { year: 2024, startDate: "2024-03-20", endDate: "2024-11-15", seasonEnd: new Date("2024-10-30") },
  { year: 2025, startDate: "2025-03-20", endDate: "2025-11-15", seasonEnd: new Date("2025-11-01") },
  { year: 2026, startDate: "2026-03-20", endDate: "2026-11-15", seasonEnd: new Date("2026-11-01") },
];

// Max IL days attributable to a single season (full season length as safety cap)
export const MAX_SEASON_IL_DAYS = 190;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Transaction {
  typeCode: string;
  description: string;
  effectiveDate?: string;
  date?: string;
  person?: { id: number; fullName: string };
}

// ─── Transaction classifiers ──────────────────────────────────────────────────

export function txDate(tx: Transaction): string | undefined {
  return tx.effectiveDate || tx.date;
}

export function isIlTx(tx: Transaction): boolean {
  return tx.typeCode === "SC" && (tx.description?.toLowerCase().includes("injured list") ?? false);
}

export function isPlacement(tx: Transaction): boolean {
  return tx.description?.toLowerCase().includes("placed") ?? false;
}

export function isActivation(tx: Transaction): boolean {
  return tx.description?.toLowerCase().includes("activated") ?? false;
}

export function isTransfer(tx: Transaction): boolean {
  return tx.description?.toLowerCase().includes("transferred") ?? false;
}

// ─── Interval merging ─────────────────────────────────────────────────────────

export function mergeIntervals(intervals: Array<[Date, Date]>): Array<[Date, Date]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0].getTime() - b[0].getTime());
  const merged: Array<[Date, Date]> = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const [start, end] = sorted[i];
    if (start.getTime() <= last[1].getTime()) {
      if (end.getTime() > last[1].getTime()) last[1] = end;
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

// ─── Core parsing ─────────────────────────────────────────────────────────────
// Returns Map<playerId, ilDaysThisSeason>

export function parseSeasonIlDays(transactions: Transaction[], seasonEnd: Date): Map<number, number> {
  const parseDate = (tx: Transaction): Date | null => {
    const raw = txDate(tx);
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const byPlayer = new Map<number, { placements: Date[]; activations: Date[] }>();

  // Pass 1: IL placements (strict)
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

  // Pass 2: Activations (broad, only for players with a placement)
  for (const tx of transactions) {
    if (tx.typeCode !== "SC") continue;
    const d = parseDate(tx);
    if (!d) continue;
    const desc = tx.description?.toLowerCase() ?? "";
    if (!desc.includes("activated") || desc.includes("transferred")) continue;
    const playerId = tx.person?.id;
    if (!playerId) continue;
    if (!byPlayer.has(playerId)) continue;
    byPlayer.get(playerId)!.activations.push(d);
  }

  const daysByPlayer = new Map<number, number>();

  for (const [playerId, { placements, activations }] of Array.from(byPlayer.entries())) {
    placements.sort((a, b) => a.getTime() - b.getTime());
    activations.sort((a, b) => a.getTime() - b.getTime());

    const intervals: Array<[Date, Date]> = [];
    const unusedActivations = [...activations];

    for (const placement of placements) {
      const idx = unusedActivations.findIndex((a) => a.getTime() > placement.getTime());
      if (idx >= 0) {
        intervals.push([placement, unusedActivations[idx]]);
        unusedActivations.splice(idx, 1);
      } else {
        intervals.push([placement, seasonEnd]);
      }
    }

    const merged = mergeIntervals(intervals);
    let total = 0;
    for (const [start, end] of merged) {
      total += Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    }
    daysByPlayer.set(playerId, Math.min(total, MAX_SEASON_IL_DAYS));
  }

  return daysByPlayer;
}
