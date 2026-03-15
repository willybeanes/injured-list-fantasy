import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/draft/[leagueId]/activate
 *
 * Called by the draft room client when it detects the league is still "upcoming"
 * but the scheduled start time has already passed. Transitions the league to
 * "drafting" without requiring the 5-minute cron cycle to catch up.
 *
 * Requirements:
 * - User must be authenticated and a member of the league
 * - League must be "upcoming" with a draftScheduledAt in the past
 * - League must be full (all roster spots filled)
 */
export async function POST(
  _request: Request,
  { params }: { params: { leagueId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = params;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { _count: { select: { members: true } } },
  });

  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  // Must be a member
  const isMember = await prisma.leagueMember.findFirst({
    where: { leagueId, userId: user.id },
  });
  if (!isMember) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  // Only act if still upcoming with a past scheduled time
  if (league.status !== "upcoming") {
    return NextResponse.json({ status: league.status });
  }
  if (!league.draftScheduledAt || league.draftScheduledAt > new Date()) {
    return NextResponse.json({ error: "Draft is not yet scheduled to start" }, { status: 400 });
  }

  // Must be full
  if (league._count.members < league.maxTeams) {
    return NextResponse.json({ error: "League is not full yet" }, { status: 400 });
  }

  const updated = await prisma.league.update({
    where: { id: leagueId },
    data: { status: "drafting", currentPickStartedAt: new Date() },
  });

  return NextResponse.json({ status: updated.status });
}
