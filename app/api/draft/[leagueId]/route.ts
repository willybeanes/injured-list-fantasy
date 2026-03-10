import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/draft/[leagueId]
 * Returns full draft state: teams, pick order, current pick, all picks made so far.
 */
export async function GET(
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
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: {
        include: { user: { select: { id: true, username: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const teams = league.members.map((m) => ({
    userId: m.userId,
    username: m.user.username,
  }));

  const numTeams = teams.length;
  const rosterSize = league.rosterSize;
  const totalPicks = numTeams * rosterSize;

  // Generate snake draft order
  const draftOrder: Array<{ pickNumber: number; round: number; teamIndex: number; userId: string; username: string }> = [];
  for (let round = 0; round < rosterSize; round++) {
    const isEvenRound = round % 2 === 1;
    for (let slot = 0; slot < numTeams; slot++) {
      const teamIndex = isEvenRound ? numTeams - 1 - slot : slot;
      const team = teams[teamIndex];
      draftOrder.push({
        pickNumber: round * numTeams + slot + 1,
        round: round + 1,
        teamIndex,
        userId: team.userId,
        username: team.username,
      });
    }
  }

  // Get all picks made so far (from roster_players)
  const rosters = await prisma.roster.findMany({
    where: { leagueId },
    include: {
      players: {
        include: { mlbPlayer: { select: { fullName: true } } },
        orderBy: { draftedAt: "asc" },
      },
      user: { select: { id: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  // Build picks array with player info filled in
  // We track picks in draft order: for each pick slot, find which team picks
  // and check if that team has drafted enough players to have made this pick.
  const picksWithData = draftOrder.map((slot) => {
    const teamRoster = rosters.find((r) => r.userId === slot.userId);

    // Get the player drafted in this round for this team
    // Players are stored in draft order
    const teamsBeforeThisRound = draftOrder
      .filter((p) => p.round < slot.round && p.userId === slot.userId)
      .length;

    const player = teamRoster?.players[teamsBeforeThisRound] ?? null;

    return {
      ...slot,
      mlbPlayerId: player?.mlbPlayerId ?? null,
      playerName: player?.mlbPlayer.fullName ?? null,
    };
  });

  // Determine current pick number
  const nextUnpickedSlot = picksWithData.find((p) => p.mlbPlayerId === null);
  const currentPickNumber = nextUnpickedSlot?.pickNumber ?? totalPicks + 1;
  const currentTeamIndex = nextUnpickedSlot?.teamIndex ?? 0;

  const myTeamIndex = teams.findIndex((t) => t.userId === user.id);

  return NextResponse.json({
    league: {
      leagueId,
      leagueName: league.name,
      status: league.status,
      rosterSize: league.rosterSize,
      pickTimerSeconds: league.pickTimerSeconds,
      draftScheduledAt: league.draftScheduledAt?.toISOString() ?? null,
      teams,
    },
    picks: picksWithData,
    currentPickNumber,
    currentTeamIndex,
    myUserId: user.id,
    myTeamIndex,
  });
}
