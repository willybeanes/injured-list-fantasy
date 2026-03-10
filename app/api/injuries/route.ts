import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/injuries
 * Returns:
 *   - recentLog: distinct IL placements in the last 14 days (up to 100)
 *   - onIl: all players currently on the IL (up to 500), with counts per status
 *   - myPlayerIds: player IDs the user has on any roster
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Recent IL placements — last 14 days, one entry per player
    const recentLog = await prisma.ilDayLog.findMany({
      where: {
        logDate: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      include: {
        mlbPlayer: {
          select: {
            fullName: true,
            teamAbbr: true,
            position: true,
            currentIlStatus: true,
            seasonIlDays: true,
          },
        },
      },
      orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
      distinct: ["mlbPlayerId"],
      take: 100,
    });

    // All players currently on IL, sorted by season days
    const onIl = await prisma.mlbPlayer.findMany({
      where: { currentIlStatus: { not: "active" } },
      orderBy: [{ seasonIlDays: "desc" }, { fullName: "asc" }],
      take: 500,
    });

    // Approximate "date placed on IL" — earliest ilDayLog entry this season per player
    const seasonStart = new Date(`${new Date().getFullYear()}-01-01`);
    const ilStartGroups = onIl.length > 0
      ? await prisma.ilDayLog.groupBy({
          by: ["mlbPlayerId"],
          where: {
            mlbPlayerId: { in: onIl.map((p) => p.id) },
            logDate: { gte: seasonStart },
          },
          _min: { logDate: true },
        })
      : [];
    const ilStartMap = new Map(
      ilStartGroups.map((g) => [g.mlbPlayerId, g._min.logDate])
    );
    const onIlWithDates = onIl.map((p) => ({
      ...p,
      ilStartDate: ilStartMap.get(p.id) ?? null,
    }));

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
