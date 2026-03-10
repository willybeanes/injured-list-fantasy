import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/draft/[leagueId]/pick
 * Body: { mlbPlayerId: number }
 *
 * Validates it's the user's turn and drafts the player.
 * Server-side enforcement of:
 * - League is in "drafting" status
 * - It's actually this user's turn
 * - Player is not already drafted in this league
 * - User's roster is not full
 */
export async function POST(
  request: Request,
  { params }: { params: { leagueId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = params;
  const { mlbPlayerId } = await request.json();

  if (!mlbPlayerId) {
    return NextResponse.json({ error: "mlbPlayerId is required" }, { status: 400 });
  }

  // Load league
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
  const myTeamIndex = teams.indexOf(user.id);
  if (myTeamIndex === -1) {
    return NextResponse.json({ error: "Not a member of this league" }, { status: 403 });
  }

  // Calculate whose turn it is (snake draft logic)
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
    return NextResponse.json({ error: "Draft is complete" }, { status: 400 });
  }

  // Determine current pick's team index (snake draft)
  const currentRound = Math.floor(totalPicksMade / numTeams);
  const slotInRound = totalPicksMade % numTeams;
  const isEvenRound = currentRound % 2 === 1;
  const currentTeamIndex = isEvenRound ? numTeams - 1 - slotInRound : slotInRound;

  if (currentTeamIndex !== myTeamIndex) {
    return NextResponse.json({ error: "It's not your turn to pick" }, { status: 400 });
  }

  // Check player not already drafted in this league
  const alreadyDrafted = await prisma.rosterPlayer.findFirst({
    where: {
      mlbPlayerId,
      roster: { leagueId },
    },
  });
  if (alreadyDrafted) {
    return NextResponse.json({ error: "Player is already on another team" }, { status: 400 });
  }

  // Check player exists
  const player = await prisma.mlbPlayer.findUnique({ where: { id: mlbPlayerId } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Get user's roster
  const roster = await prisma.roster.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
    include: { _count: { select: { players: true } } },
  });

  if (!roster) {
    return NextResponse.json({ error: "Roster not found" }, { status: 404 });
  }

  // Enforce roster size limit server-side
  if (roster._count.players >= rosterSize) {
    return NextResponse.json({ error: "Your roster is full" }, { status: 400 });
  }

  // Make the pick
  await prisma.rosterPlayer.create({
    data: {
      rosterId: roster.id,
      mlbPlayerId,
    },
  });

  // Check if draft is complete — transition league to active
  const newTotalPicks = totalPicksMade + 1;
  if (newTotalPicks >= totalPicksAllowed) {
    await prisma.league.update({
      where: { id: leagueId },
      data: { status: "active" },
    });
  }

  return NextResponse.json({
    ok: true,
    player: { id: player.id, fullName: player.fullName },
    draftComplete: newTotalPicks >= totalPicksAllowed,
  });
}
