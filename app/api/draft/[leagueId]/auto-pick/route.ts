import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/draft/[leagueId]/auto-pick
 *
 * Triggered by any connected client when the pick timer expires.
 * Picks the best available active player for the current team.
 * Any league member can trigger this — the first call wins,
 * subsequent calls from other clients will get "not your turn" or
 * "draft not active" once the pick is registered.
 *
 * Player selection priority:
 *   1. Highest seasonIlDays (most injury-prone history)
 *   2. Alphabetical as tiebreaker
 */
export async function POST(
  _request: Request,
  { params }: { params: { leagueId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = params;

  // Verify membership
  const member = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Not a league member" }, { status: 403 });

  // Load league with members in join order
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: {
        include: { user: { select: { id: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  if (league.status !== "drafting") {
    return NextResponse.json({ error: "Draft is not active" }, { status: 400 });
  }

  const teams = league.members.map((m) => m.userId);
  const numTeams = teams.length;
  const rosterSize = league.rosterSize;

  // Count total picks made
  const rosters = await prisma.roster.findMany({
    where: { leagueId },
    include: { _count: { select: { players: true } } },
  });

  const totalPicksMade = rosters.reduce((sum, r) => sum + r._count.players, 0);
  const totalPicksAllowed = numTeams * rosterSize;

  if (totalPicksMade >= totalPicksAllowed) {
    return NextResponse.json({ error: "Draft is already complete" }, { status: 400 });
  }

  // Determine whose turn it is
  const currentRound = Math.floor(totalPicksMade / numTeams);
  const slotInRound = totalPicksMade % numTeams;
  const isEvenRound = currentRound % 2 === 1;
  const currentTeamIndex = isEvenRound ? numTeams - 1 - slotInRound : slotInRound;
  const currentUserId = teams[currentTeamIndex];

  // Get already-drafted player IDs
  const draftedPlayers = await prisma.rosterPlayer.findMany({
    where: { roster: { leagueId } },
    select: { mlbPlayerId: true },
  });
  const draftedIds = draftedPlayers.map((dp) => dp.mlbPlayerId);

  // Best available active player (highest career injury history)
  const bestPlayer = await prisma.mlbPlayer.findFirst({
    where: {
      id: { notIn: draftedIds.length > 0 ? draftedIds : [-1] },
      currentIlStatus: "active",
    },
    orderBy: [{ careerIlDays: "desc" }, { fullName: "asc" }],
  });

  if (!bestPlayer) {
    return NextResponse.json({ error: "No players available to auto-pick" }, { status: 400 });
  }

  // Get the current team's roster
  const roster = await prisma.roster.findUnique({
    where: { leagueId_userId: { leagueId, userId: currentUserId } },
    include: { _count: { select: { players: true } } },
  });

  if (!roster) {
    return NextResponse.json({ error: "Roster not found for current team" }, { status: 404 });
  }

  if (roster._count.players >= rosterSize) {
    return NextResponse.json({ error: "Current team roster is full" }, { status: 400 });
  }

  // Make the pick
  await prisma.rosterPlayer.create({
    data: { rosterId: roster.id, mlbPlayerId: bestPlayer.id },
  });

  // Transition league to active if draft is complete
  const newTotal = totalPicksMade + 1;
  const draftComplete = newTotal >= totalPicksAllowed;
  if (draftComplete) {
    await prisma.league.update({
      where: { id: leagueId },
      data: { status: "active" },
    });
  }

  return NextResponse.json({
    ok: true,
    autoPicked: true,
    player: { id: bestPlayer.id, fullName: bestPlayer.fullName },
    draftComplete,
  });
}
