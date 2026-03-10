import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST /api/invites/[token]/accept — accept a league invite
export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamName } = await request.json().catch(() => ({}));

  const invite = await prisma.leagueInvite.findUnique({
    where: { token: params.token },
    include: {
      league: {
        include: { _count: { select: { members: true } } },
      },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.status === "accepted") {
    return NextResponse.json({ error: "This invite has already been accepted", leagueId: invite.leagueId }, { status: 400 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
  }

  // Verify the logged-in user's email matches the invite
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser || dbUser.email.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  const league = invite.league;

  if (league.status !== "upcoming") {
    return NextResponse.json({ error: "This league is no longer accepting new members" }, { status: 400 });
  }
  if (league._count.members >= league.maxTeams) {
    return NextResponse.json({ error: "This league is full" }, { status: 400 });
  }

  // Check not already a member
  const alreadyMember = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: invite.leagueId, userId: user.id } },
  });
  if (alreadyMember) {
    return NextResponse.json({ error: "You are already in this league", leagueId: invite.leagueId }, { status: 400 });
  }

  // Join league + mark invite accepted in one transaction
  await prisma.$transaction([
    prisma.leagueMember.create({
      data: { leagueId: invite.leagueId, userId: user.id },
    }),
    prisma.roster.create({
      data: {
        leagueId: invite.leagueId,
        userId: user.id,
        teamName: teamName?.trim() || null,
      },
    }),
    prisma.leagueInvite.update({
      where: { token: params.token },
      data: { status: "accepted" },
    }),
  ]);

  return NextResponse.json({ ok: true, leagueId: invite.leagueId });
}
