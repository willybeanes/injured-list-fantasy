import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/draft/[leagueId]/players
 * Returns available (not yet drafted in this league) MLB players,
 * sorted by career IL days descending.
 */
export async function GET(
  _request: Request,
  { params }: { params: { leagueId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = params;

  // Get already-drafted player IDs in this league
  const draftedPlayers = await prisma.rosterPlayer.findMany({
    where: { roster: { leagueId } },
    select: { mlbPlayerId: true },
  });
  const draftedIds = draftedPlayers.map((dp) => dp.mlbPlayerId);

  // Return only ACTIVE players not already drafted.
  // The goal of the game is to draft players who *will* get hurt —
  // so we only show currently healthy (active) players.
  const players = await prisma.mlbPlayer.findMany({
    where: {
      id: { notIn: draftedIds.length > 0 ? draftedIds : [-1] },
      currentIlStatus: "active",
    },
    orderBy: [
      { careerIlDays: "desc" },
      { fullName: "asc" },
    ],
  });

  return NextResponse.json({ players });
}
