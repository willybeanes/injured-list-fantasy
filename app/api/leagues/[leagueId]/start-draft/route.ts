import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { sendDraftStartingEmail } from "@/lib/email";

// POST /api/leagues/[leagueId]/start-draft
// Commissioner-only: sets a 5-minute countdown and notifies all members.
// The open-drafts cron will flip status → "drafting" when the time arrives.
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
    include: {
      members: { include: { user: { select: { email: true, username: true } } } },
      _count: { select: { members: true } },
    },
  });

  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  if (league.commissionerId !== user.id) {
    return NextResponse.json({ error: "Only the commissioner can start the draft" }, { status: 403 });
  }
  if (league.status !== "upcoming") {
    return NextResponse.json({ error: "Draft can only be started from upcoming status" }, { status: 400 });
  }
  const memberCount = league._count.members;
  if (memberCount < league.maxTeams) {
    return NextResponse.json({ error: "League is not full" }, { status: 400 });
  }
  if (memberCount > league.maxTeams) {
    return NextResponse.json(
      { error: `League has ${memberCount} members but only ${league.maxTeams} spots. Raise the team limit and fill the extra spots before starting.` },
      { status: 400 }
    );
  }

  // Set draft to start in 5 minutes
  const startsAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.league.update({
    where: { id: leagueId },
    data: {
      draftScheduledAt: startsAt,
      // Clear any stale reminder flags so the cron doesn't skip this run
      draftReminderSentAt: null,
      draftFinalReminderSentAt: null,
    },
  });

  // Notify all members in parallel (fire-and-forget; don't block the response)
  void Promise.all(
    league.members.map((m) =>
      sendDraftStartingEmail({
        to: m.user.email!,
        username: m.user.username ?? "Manager",
        leagueName: league.name,
        leagueId,
      })
    )
  );

  return NextResponse.json({ ok: true, startsAt: startsAt.toISOString() });
}
