import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/injuries
 * Returns:
 *   - recentLog: players placed on IL in the last 14 days (by MLB transaction date), up to 100
 *   - onIl: all players currently on the IL (up to 500), with counts per status
 *   - myPlayerIds: player IDs the user has on any roster
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Recent IL placements — last 14 days by actual MLB transaction date
    const recentLog = await prisma.mlbPlayer.findMany({
      where: {
        currentIlStatus: { not: "active" },
        ilPlacedDate: {
          not: null,
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        fullName: true,
        teamAbbr: true,
        position: true,
        currentIlStatus: true,
        seasonIlDays: true,
        ilPlacedDate: true,
      },
      orderBy: { ilPlacedDate: "desc" },
      take: 100,
    });

    // All players currently on IL, sorted by season days
    const onIlWithDates = await prisma.mlbPlayer.findMany({
      where: { currentIlStatus: { not: "active" } },
      select: {
        id: true,
        fullName: true,
        teamAbbr: true,
        position: true,
        currentIlStatus: true,
        seasonIlDays: true,
        ilPlacedDate: true,
      },
      orderBy: [{ seasonIlDays: "desc" }, { fullName: "asc" }],
      take: 500,
    });

    // User's drafted player IDs (across all leagues)
    const rosterPlayers = await prisma.rosterPlayer.findMany({
      where: { roster: { userId: user.id } },
      select: { mlbPlayerId: true },
    });
    const myPlayerIds = rosterPlayers.map((rp) => rp.mlbPlayerId);

    return NextResponse.json({ recentLog, onIl: onIlWithDates, myPlayerIds });

  } catch (err) {
    console.error("Injuries API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
