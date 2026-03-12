import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllRosterPlayers } from "@/lib/mlb-api";
import { sendInjuryAlert, sendWeeklySummary } from "@/lib/email";
import { currentSeasonYear } from "@/lib/utils";

/**
 * GET /api/cron/sync-il
 *
 * Daily IL sync job — designed to be called by Vercel Cron at 8:00 AM ET.
 * Protected by CRON_SECRET header.
 *
 * Steps:
 * 1. Fetch ALL 40-man roster players from MLB Stats API (active + IL)
 * 2. Upsert mlb_players for every player; log today in il_day_log for IL players only
 * 3. Update roster totals and recalculate ranks
 * 4. Send injury alert emails for newly IL'd players
 * 5. On Mondays: send weekly summaries + reset weekly_il_days
 */
export async function GET(request: Request) {
  // Auth check
  const secret = request.headers.get("x-cron-secret") ??
    new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isMondayReset = today.getDay() === 1; // Monday
  const seasonYear = currentSeasonYear();

  // IL days only accumulate once the season starts (Opening Day)
  const openingDay = new Date(`${seasonYear}-03-25`);
  const seasonStarted = today >= openingDay;

  console.log(`[sync-il] Starting sync for ${today.toISOString()} (Monday: ${isMondayReset})`);

  try {
    // ─── Step 1: Fetch all 40-man roster players from MLB API ───────────────
    const allPlayers = await fetchAllRosterPlayers();
    console.log(`[sync-il] Fetched ${allPlayers.length} players from MLB API (all 40-man rosters)`);

    // Track which player IDs are on IL today
    const ilPlayerIds: number[] = [];
    const newlyInjured: Array<{ playerId: number; fullName: string; status: string }> = [];

    // ─── Step 2: Upsert ALL players + log IL days for injured ones ──────────
    for (const entry of allPlayers) {
      const playerId = entry.player.id;
      const ilStatus = entry.ilStatus;

      // Upsert mlb_players — ALL players, including healthy ones
      await prisma.mlbPlayer.upsert({
        where: { id: playerId },
        update: {
          fullName: entry.player.fullName,
          teamName: entry.team.name,
          teamAbbr: entry.team.abbreviation,
          position: entry.position ?? null,
          currentIlStatus: ilStatus,
          age: entry.age ?? null,
          birthDate: entry.birthDate ?? null,
          lastSyncedAt: new Date(),
        },
        create: {
          id: playerId,
          fullName: entry.player.fullName,
          teamName: entry.team.name,
          teamAbbr: entry.team.abbreviation,
          position: entry.position ?? null,
          currentIlStatus: ilStatus,
          age: entry.age ?? null,
          birthDate: entry.birthDate ?? null,
          seasonIlDays: 0,
          lastSyncedAt: new Date(),
        },
      });

      // Log IL days for all IL players (powers Recent IL Placements list).
      // Only increment seasonIlDays once the season has started (Opening Day).
      if (ilStatus !== "active") {
        ilPlayerIds.push(playerId);

        // Always log today's entry (idempotent — unique constraint on [playerId, logDate])
        const existing = await prisma.ilDayLog.findUnique({
          where: { mlbPlayerId_logDate: { mlbPlayerId: playerId, logDate: today } },
        });

        if (!existing) {
          await prisma.ilDayLog.create({
            data: { mlbPlayerId: playerId, logDate: today, ilStatus },
          });

          if (seasonStarted) {
            // Increment season total only after Opening Day
            await prisma.mlbPlayer.update({
              where: { id: playerId },
              data: { seasonIlDays: { increment: 1 } },
            });
          }

          newlyInjured.push({ playerId, fullName: entry.player.fullName, status: ilStatus });
        }
      }
    }

    console.log(`[sync-il] Upserted ${allPlayers.length} players; ${ilPlayerIds.length} on IL; ${newlyInjured.length} new IL entries`);

    // ─── Step 3: Update roster totals + ranks ────────────────────────────────
    const rosters = await prisma.roster.findMany({
      include: {
        players: { select: { mlbPlayerId: true } },
        league: { select: { id: true, status: true } },
      },
    });

    for (const roster of rosters) {
      if (roster.league.status === "upcoming") continue;

      const rosterPlayerIds = roster.players.map((p) => p.mlbPlayerId);
      const rosterIlIds = rosterPlayerIds.filter((id) => ilPlayerIds.includes(id));

      if (rosterIlIds.length > 0) {
        // Count newly logged days for this roster today
        const newDays = await prisma.ilDayLog.count({
          where: {
            mlbPlayerId: { in: rosterIlIds },
            logDate: today,
          },
        });

        if (newDays > 0) {
          await prisma.roster.update({
            where: { id: roster.id },
            data: {
              totalIlDays: { increment: newDays },
              weeklyIlDays: { increment: newDays },
              updatedAt: new Date(),
            },
          });
        }
      }
    }

    // ─── Recalculate league ranks ─────────────────────────────────────────────
    const leagues = await prisma.league.findMany({
      where: { status: { in: ["active", "drafting"] } },
      select: { id: true },
    });

    for (const league of leagues) {
      const leagueRosters = await prisma.roster.findMany({
        where: { leagueId: league.id },
        orderBy: { totalIlDays: "desc" },
      });

      for (let i = 0; i < leagueRosters.length; i++) {
        await prisma.roster.update({
          where: { id: leagueRosters[i].id },
          data: { rank: i + 1 },
        });
      }
    }

    // ─── Recalculate global scores + ranks ───────────────────────────────────
    const allUsers = await prisma.user.findMany({ select: { id: true } });

    for (const user of allUsers) {
      const userRosters = await prisma.roster.findMany({
        where: { userId: user.id },
        select: { totalIlDays: true },
      });

      const totalDays = userRosters.reduce((sum, r) => sum + r.totalIlDays, 0);

      await prisma.globalScore.upsert({
        where: { userId: user.id },
        update: { totalIlDays: totalDays, seasonYear, updatedAt: new Date() },
        create: {
          userId: user.id,
          seasonYear,
          totalIlDays: totalDays,
        },
      });
    }

    const globalScores = await prisma.globalScore.findMany({
      where: { seasonYear },
      orderBy: { totalIlDays: "desc" },
    });

    for (let i = 0; i < globalScores.length; i++) {
      await prisma.globalScore.update({
        where: { id: globalScores[i].id },
        data: { globalRank: i + 1 },
      });
    }

    // ─── Step 4: Injury alert emails ─────────────────────────────────────────
    if (newlyInjured.length > 0 && process.env.RESEND_API_KEY) {
      // Find roster owners who have newly injured players
      for (const injured of newlyInjured) {
        const affectedRosters = await prisma.rosterPlayer.findMany({
          where: { mlbPlayerId: injured.playerId },
          include: {
            roster: {
              include: {
                user: { select: { email: true, username: true } },
              },
            },
          },
        });

        for (const rp of affectedRosters) {
          await sendInjuryAlert({
            to: rp.roster.user.email,
            username: rp.roster.user.username,
            playerName: injured.fullName,
            ilStatus: injured.status,
          });
        }
      }
    }

    // ─── Step 5: Monday weekly summary + reset ───────────────────────────────
    if (isMondayReset) {
      if (process.env.RESEND_API_KEY) {
        const rostersForSummary = await prisma.roster.findMany({
          include: {
            user: { select: { email: true, username: true } },
            league: { select: { name: true } },
          },
        });

        for (const roster of rostersForSummary) {
          const leagueRosters2 = await prisma.roster.findMany({
            where: { leagueId: roster.leagueId },
            orderBy: { totalIlDays: "desc" },
          });
          const rank = leagueRosters2.findIndex((r) => r.userId === roster.userId) + 1;

          await sendWeeklySummary({
            to: roster.user.email,
            username: roster.user.username,
            weeklyIlDays: roster.weeklyIlDays,
            leagueRank: rank || null,
            leagueName: roster.league.name,
            totalIlDays: roster.totalIlDays,
          });
        }
      }

      // Reset weekly IL days for all rosters
      await prisma.roster.updateMany({
        data: { weeklyIlDays: 0 },
      });

      console.log(`[sync-il] Monday reset: weekly_il_days cleared`);
    }

    return NextResponse.json({
      ok: true,
      date: today.toISOString(),
      playersUpserted: allPlayers.length,
      ilPlayersFound: ilPlayerIds.length,
      newIlEntries: newlyInjured.length,
      mondayReset: isMondayReset,
    });
  } catch (err) {
    console.error("[sync-il] Error:", err);
    return NextResponse.json(
      { error: "Sync failed", details: String(err) },
      { status: 500 }
    );
  }
}
