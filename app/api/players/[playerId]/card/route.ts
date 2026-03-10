import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { SEASONS, Transaction, txDate, isTransfer, parseSeasonIlDays } from "@/lib/il-utils";

export type PlayerCardData = {
  player: {
    id: number;
    fullName: string;
    teamName: string | null;
    teamAbbr: string | null;
    position: string | null;
    age: number | null;
    careerIlDays: number;
    careerSeasons: number;
    currentIlStatus: string;
    seasonIlDays: number;
  };
  seasonBreakdown: Array<{ year: number; days: number }>;
  activeYears: number[];
  transactions: Array<{ date: string; description: string }>;
};

const BASE_URL = "https://statsapi.mlb.com/api/v1";

async function fetchPlayerTransactions(
  playerId: number,
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  const url = `${BASE_URL}/transactions?sportId=1&playerId=${playerId}&startDate=${startDate}&endDate=${endDate}`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.transactions ?? []) as Transaction[]).filter(
      (tx) => tx.person?.id === playerId
    );
  } catch {
    return [];
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { playerId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const playerId = parseInt(params.playerId, 10);
  if (isNaN(playerId)) return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });

  const player = await prisma.mlbPlayer.findUnique({ where: { id: playerId } });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Fetch transactions for all seasons in parallel
  // For the current (2026) season, cap seasonEnd at today
  const today = new Date();
  const results = await Promise.allSettled(
    SEASONS.map((season) => {
      const seasonEnd = season.year === today.getFullYear() ? today : season.seasonEnd;
      return fetchPlayerTransactions(playerId, season.startDate, season.endDate).then(
        (txs) => ({ season, txs, seasonEnd })
      );
    })
  );

  const seasonBreakdown: Array<{ year: number; days: number }> = [];
  const activeYears: number[] = [];
  const allIlTransactions: Array<{ date: string; description: string; rawDate: string }> = [];

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { season, txs, seasonEnd } = result.value;

    // Per-season IL days using shared parsing logic
    const daysByPlayer = parseSeasonIlDays(txs, seasonEnd);
    const days = daysByPlayer.get(playerId) ?? 0;
    seasonBreakdown.push({ year: season.year, days });
    // Track seasons where the player had any MLB transaction (i.e., was active)
    if (txs.length > 0) activeYears.push(season.year);

    // Raw IL transactions for the history log (placements + activations off IL)
    for (const tx of txs) {
      if (tx.typeCode !== "SC") continue;
      const desc = tx.description?.toLowerCase() ?? "";
      const isIlPlacement = desc.includes("placed") && desc.includes("injured list") && !isTransfer(tx);
      const isIlActivation = desc.includes("activated") && !desc.includes("transferred");
      if (!isIlPlacement && !isIlActivation) continue;
      const rawDate = txDate(tx);
      if (!rawDate) continue;
      allIlTransactions.push({ date: rawDate, description: tx.description, rawDate });
    }
  }

  // Sort transactions newest first
  allIlTransactions.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());

  return NextResponse.json({
    player: {
      id: player.id,
      fullName: player.fullName,
      teamName: player.teamName,
      teamAbbr: player.teamAbbr,
      position: player.position,
      age: player.age,
      careerIlDays: player.careerIlDays,
      careerSeasons: player.careerSeasons,
      currentIlStatus: player.currentIlStatus,
      seasonIlDays: player.seasonIlDays,
    },
    seasonBreakdown,
    activeYears,
    transactions: allIlTransactions.map(({ date, description }) => ({ date, description })),
  } satisfies PlayerCardData);
}
