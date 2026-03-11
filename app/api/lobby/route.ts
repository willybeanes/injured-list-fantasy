import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/lobby
 * Returns all public, upcoming leagues available to join.
 * Requires auth (so we can flag leagues the user has already joined).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leagues = await prisma.league.findMany({
    where: {
      isPublic: true,
      status: "upcoming",
    },
    include: {
      _count: { select: { members: true } },
      commissioner: { select: { username: true } },
    },
    orderBy: { draftScheduledAt: "asc" },
  });

  // Get leagues the current user is already in (to show "Joined" state)
  const myMemberships = await prisma.leagueMember.findMany({
    where: { userId: user.id },
    select: { leagueId: true },
  });
  const myLeagueIds = new Set(myMemberships.map((m) => m.leagueId));

  const result = leagues.map((l) => ({
    id: l.id,
    name: l.name,
    commissionerUsername: l.commissioner.username,
    maxTeams: l.maxTeams,
    memberCount: l._count.members,
    draftFormat: l.draftFormat,
    pickTimerSeconds: l.pickTimerSeconds,
    draftScheduledAt: l.draftScheduledAt,
    delayCount: l.delayCount,
    isFull: l._count.members >= l.maxTeams,
    isJoined: myLeagueIds.has(l.id),
  }));

  return NextResponse.json({ leagues: result });
}
