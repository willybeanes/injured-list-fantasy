import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export type AutoPickResult =
  | { ok: true; player: { id: number; fullName: string }; draftComplete: boolean }
  | { ok: false; error: string };

/**
 * Picks the best available active player for the current team in a drafting league.
 * Safe to call from both API routes (per-pick timer expiry) and cron jobs (stalled draft recovery).
 *
 * After a successful pick:
 * - Updates League.currentPickStartedAt to now (for stall detection on the next pick)
 * - Broadcasts pick_made via Supabase Realtime so connected clients update instantly
 * - Sets status → "active" and currentPickStartedAt → null when draft completes
 */
export async function runAutoPick(leagueId: string): Promise<AutoPickResult> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: {
        include: { user: { select: { id: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!league) return { ok: false, error: "League not found" };
  if (league.status !== "drafting") return { ok: false, error: "Draft is not active" };

  const teams = league.members.map((m) => m.userId);
  const numTeams = teams.length;
  const rosterSize = league.rosterSize;

  const rosters = await prisma.roster.findMany({
    where: { leagueId },
    include: { _count: { select: { players: true } } },
  });

  const totalPicksMade = rosters.reduce((sum, r) => sum + r._count.players, 0);
  const totalPicksAllowed = numTeams * rosterSize;

  if (totalPicksMade >= totalPicksAllowed) {
    return { ok: false, error: "Draft is already complete" };
  }

  // Snake draft: determine current team
  const currentRound = Math.floor(totalPicksMade / numTeams);
  const slotInRound = totalPicksMade % numTeams;
  const isEvenRound = currentRound % 2 === 1;
  const currentTeamIndex = isEvenRound ? numTeams - 1 - slotInRound : slotInRound;
  const currentUserId = teams[currentTeamIndex];

  // Best available active player
  const draftedIds = (
    await prisma.rosterPlayer.findMany({
      where: { roster: { leagueId } },
      select: { mlbPlayerId: true },
    })
  ).map((dp) => dp.mlbPlayerId);

  const bestPlayer = await prisma.mlbPlayer.findFirst({
    where: {
      id: { notIn: draftedIds.length > 0 ? draftedIds : [-1] },
      currentIlStatus: "active",
    },
    orderBy: [{ careerIlDays: "desc" }, { fullName: "asc" }],
  });

  if (!bestPlayer) return { ok: false, error: "No players available to auto-pick" };

  const roster = await prisma.roster.findUnique({
    where: { leagueId_userId: { leagueId, userId: currentUserId } },
    include: { _count: { select: { players: true } } },
  });

  if (!roster) return { ok: false, error: "Roster not found for current team" };
  if (roster._count.players >= rosterSize) return { ok: false, error: "Current team roster is full" };

  // Make the pick
  await prisma.rosterPlayer.create({
    data: { rosterId: roster.id, mlbPlayerId: bestPlayer.id },
  });

  const newTotal = totalPicksMade + 1;
  const draftComplete = newTotal >= totalPicksAllowed;

  await prisma.league.update({
    where: { id: leagueId },
    data: {
      status: draftComplete ? "active" : "drafting",
      currentPickStartedAt: draftComplete ? null : new Date(),
    },
  });

  // Broadcast so any connected clients update in real-time
  try {
    const admin = createAdminClient();
    await admin.channel(`draft:${leagueId}`).send({
      type: "broadcast",
      event: "pick_made",
      payload: { playerId: bestPlayer.id, auto: true },
    });
  } catch {
    // Non-fatal: clients will catch up on next load
  }

  return { ok: true, player: { id: bestPlayer.id, fullName: bestPlayer.fullName }, draftComplete };
}
