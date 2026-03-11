import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/leagues/[leagueId]/force-start
 * Commissioner-only. Used when a public league has hit max auto-delays and
 * still isn't full. Reduces maxTeams to current member count and opens the draft.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = await params;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { _count: { select: { members: true } } },
  });

  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  if (league.commissionerId !== user.id) {
    return NextResponse.json({ error: "Only the commissioner can force-start" }, { status: 403 });
  }
  if (league.status !== "upcoming") {
    return NextResponse.json({ error: "League is not in upcoming state" }, { status: 400 });
  }
  if (league._count.members < 2) {
    return NextResponse.json({ error: "Need at least 2 teams to start" }, { status: 400 });
  }

  await prisma.league.update({
    where: { id: leagueId },
    data: {
      maxTeams: league._count.members, // shrink to actual count
      status: "drafting",
    },
  });

  return NextResponse.json({ ok: true, maxTeams: league._count.members });
}
