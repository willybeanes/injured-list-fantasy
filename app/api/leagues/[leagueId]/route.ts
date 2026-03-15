import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { sendDraftScheduledEmail } from "@/lib/email";

// GET /api/leagues/[leagueId]
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
  if (!member) return NextResponse.json({ error: "Not a member of this league" }, { status: 403 });

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      commissioner: { select: { username: true } },
      _count: { select: { members: true } },
    },
  });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  // Get standings
  const rosters = await prisma.roster.findMany({
    where: { leagueId },
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
      players: {
        include: {
          mlbPlayer: {
            select: {
              fullName: true,
              teamAbbr: true,
              currentIlStatus: true,
              seasonIlDays: true,
            },
          },
        },
      },
    },
    orderBy: { totalIlDays: "desc" },
  });

  const myRoster = rosters.find((r) => r.user.id === user.id);

  return NextResponse.json({ league, rosters, isCommissioner: league.commissionerId === user.id, myRosterId: myRoster?.id ?? null });
}

// DELETE /api/leagues/[leagueId] — delete league (commissioner only)
export async function DELETE(
  _request: Request,
  { params }: { params: { leagueId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = params;

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  if (league.commissionerId !== user.id) {
    return NextResponse.json({ error: "Only the commissioner can delete the league" }, { status: 403 });
  }

  await prisma.league.delete({ where: { id: leagueId } });

  return NextResponse.json({ ok: true });
}

// PATCH /api/leagues/[leagueId] — update league (commissioner only)
export async function PATCH(
  request: Request,
  { params }: { params: { leagueId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = params;

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  if (league.commissionerId !== user.id) {
    return NextResponse.json({ error: "Only the commissioner can update the league" }, { status: 403 });
  }

  const body = await request.json();
  const { status, maxTeams, pickTimerSeconds, draftScheduledAt } = body;

  // Validate status transitions.
  // NOTE: upcoming → drafting is intentionally NOT here — that transition
  // only happens via POST /api/leagues/[id]/start-draft (commissioner manual
  // start with 5-min countdown) or automatically via the open-drafts cron.
  // NOTE: drafting → active is intentionally NOT here — that transition
  // only happens automatically via /api/draft/[id]/pick or /auto-pick
  // once all picks are complete. This prevents commissioners from
  // short-circuiting the draft via the API.
  const validTransitions: Record<string, string[]> = {
    upcoming: [],
    drafting: [],
    active: ["completed"],
    completed: [],
  };
  if (status && !validTransitions[league.status]?.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${league.status} to ${status}` },
      { status: 400 }
    );
  }

  // Validate maxTeams change
  if (maxTeams !== undefined) {
    if (league.status !== "upcoming") {
      return NextResponse.json({ error: "Cannot change team count after draft has started" }, { status: 400 });
    }
    if (![4, 6, 8].includes(maxTeams)) {
      return NextResponse.json({ error: "Max teams must be 4, 6, or 8" }, { status: 400 });
    }
    // Can't reduce below current member count
    const memberCount = await prisma.leagueMember.count({ where: { leagueId } });
    if (maxTeams < memberCount) {
      return NextResponse.json(
        { error: `Can't set max teams to ${maxTeams} — league already has ${memberCount} members` },
        { status: 400 }
      );
    }
  }

  // Validate pickTimerSeconds change
  if (pickTimerSeconds !== undefined) {
    if (league.status !== "upcoming") {
      return NextResponse.json({ error: "Cannot change pick timer after the draft has started" }, { status: 400 });
    }
    if (![45, 60, 90].includes(pickTimerSeconds)) {
      return NextResponse.json({ error: "Pick timer must be 45, 60, or 90 seconds" }, { status: 400 });
    }
  }

  // Validate draftScheduledAt change
  if (draftScheduledAt !== undefined) {
    if (league.status !== "upcoming") {
      return NextResponse.json({ error: "Cannot schedule draft after it has already started" }, { status: 400 });
    }
    if (draftScheduledAt !== null && new Date(draftScheduledAt) <= new Date()) {
      return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 });
    }
  }

  // Detect draft time changes before writing, so we can send the right email
  const draftTimeIsBeingSet =
    draftScheduledAt !== undefined &&
    draftScheduledAt !== null &&
    !league.draftScheduledAt;
  const draftTimeIsBeingChanged =
    draftScheduledAt !== undefined &&
    draftScheduledAt !== null &&
    !!league.draftScheduledAt &&
    new Date(draftScheduledAt).getTime() !== new Date(league.draftScheduledAt).getTime();

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (maxTeams !== undefined) updateData.maxTeams = maxTeams;
  if (pickTimerSeconds !== undefined) updateData.pickTimerSeconds = pickTimerSeconds;
  if (draftScheduledAt !== undefined) {
    updateData.draftScheduledAt = draftScheduledAt ? new Date(draftScheduledAt) : null;
    // Reset reminder flags whenever the time changes so reminders fire correctly
    if (draftScheduledAt !== null) {
      updateData.draftReminderSentAt = null;
      updateData.draftFinalReminderSentAt = null;
    }
  }

  const updated = await prisma.league.update({
    where: { id: leagueId },
    data: updateData,
    include: { _count: { select: { members: true } } },
  });

  // Send "draft scheduled/rescheduled" emails when the commissioner sets or changes the time
  if (draftTimeIsBeingSet || draftTimeIsBeingChanged) {
    const members = await prisma.leagueMember.findMany({
      where: { leagueId },
      include: { user: { select: { id: true, email: true, username: true, emailUnsubscribed: true } } },
    });
    void Promise.all(
      members
        .filter((m) => !m.user.emailUnsubscribed)
        .map((m) =>
          sendDraftScheduledEmail({
            to: m.user.email!,
            userId: m.user.id,
            username: m.user.username ?? "Manager",
            leagueName: league.name,
            leagueId,
            draftAt: new Date(draftScheduledAt),
            isChange: draftTimeIsBeingChanged,
          })
        )
    );
  }

  return NextResponse.json({ league: updated });
}
