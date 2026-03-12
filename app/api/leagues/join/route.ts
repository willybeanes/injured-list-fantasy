import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST /api/leagues/join
// Supports two modes:
//   { inviteCode }         — private or public league, validated by invite code
//   { leagueId }           — public league only, no invite code needed
// Both accept optional { teamName }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteCode, leagueId, teamName } = await request.json();

  if (!inviteCode && !leagueId) {
    return NextResponse.json({ error: "Invite code or league ID is required" }, { status: 400 });
  }

  // Look up league by inviteCode OR by leagueId (public only)
  let league;
  if (inviteCode) {
    const normalizedCode = inviteCode.toUpperCase().trim();
    league = await prisma.league.findUnique({
      where: { inviteCode: normalizedCode },
      include: { _count: { select: { members: true } } },
    });
    if (!league) {
      return NextResponse.json({ error: "Invalid invite code. Check the code and try again." }, { status: 404 });
    }
  } else {
    league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: { _count: { select: { members: true } } },
    });
    if (!league) {
      return NextResponse.json({ error: "League not found." }, { status: 404 });
    }
    if (!league.isPublic) {
      return NextResponse.json({ error: "This league is private. You need an invite code to join." }, { status: 403 });
    }
  }

  if (league.status === "completed") {
    return NextResponse.json({ error: "This league has already completed its season." }, { status: 400 });
  }

  if (league.status === "active" || league.status === "drafting") {
    return NextResponse.json({ error: "This league's draft has already begun. New members cannot join." }, { status: 400 });
  }

  if (league._count.members >= league.maxTeams) {
    return NextResponse.json({ error: "This league is full." }, { status: 400 });
  }

  // Check if already a member
  const existingMember = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: league.id, userId: user.id } },
  });
  if (existingMember) {
    return NextResponse.json({ error: "You are already in this league." }, { status: 400 });
  }

  // Ensure user record exists
  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email!,
      username: user.user_metadata?.username ?? user.email!.split("@")[0],
    },
    update: {},
  });

  // Join league
  await prisma.leagueMember.create({
    data: { leagueId: league.id, userId: user.id },
  });

  // Create roster
  await prisma.roster.create({
    data: { leagueId: league.id, userId: user.id, teamName: teamName?.trim() || null },
  });

  // If this join filled the league, email all members
  const newMemberCount = league._count.members + 1;
  if (newMemberCount >= league.maxTeams && process.env.RESEND_API_KEY) {
    const allMembers = await prisma.leagueMember.findMany({
      where: { leagueId: league.id },
      include: { user: { select: { email: true, username: true, id: true } } },
    });
    const leagueUrl = `${process.env.NEXT_PUBLIC_APP_URL}/leagues/${league.id}`;
    const { sendLeagueFullEmail } = await import("@/lib/email");
    await Promise.allSettled(
      allMembers.map((m) =>
        sendLeagueFullEmail({
          to: m.user.email,
          username: m.user.username,
          leagueName: league.name,
          teamCount: league.maxTeams,
          isCommissioner: m.user.id === league.commissionerId,
          leagueUrl,
        })
      )
    );
  }

  return NextResponse.json({
    league: { ...league, isCommissioner: false },
  });
}
