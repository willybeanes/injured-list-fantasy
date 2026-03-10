import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateInviteCode, currentSeasonYear } from "@/lib/utils";

// GET /api/leagues — list current user's leagues
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await prisma.leagueMember.findMany({
    where: { userId: user.id },
    include: {
      league: {
        include: { _count: { select: { members: true } } },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const leagues = members.map((m) => ({
    ...m.league,
    isCommissioner: m.league.commissionerId === user.id,
  }));

  return NextResponse.json({ leagues });
}

// POST /api/leagues — create a new league
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, maxTeams, draftFormat, scoringType, pickTimerSeconds } = body;
  const rosterSize = 10; // fixed

  if (!name?.trim()) {
    return NextResponse.json({ error: "League name is required" }, { status: 400 });
  }
  if (![4, 6, 8].includes(maxTeams)) {
    return NextResponse.json({ error: "Max teams must be 4, 6, or 8" }, { status: 400 });
  }
  if (pickTimerSeconds && ![45, 60, 90].includes(pickTimerSeconds)) {
    return NextResponse.json({ error: "Pick timer must be 45, 60, or 90 seconds" }, { status: 400 });
  }

  // Ensure user record exists in DB
  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email!,
      username: user.user_metadata?.username ?? user.email!.split("@")[0],
    },
    update: {},
  });

  // Generate unique invite code
  let inviteCode = generateInviteCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await prisma.league.findUnique({ where: { inviteCode } });
    if (!existing) break;
    inviteCode = generateInviteCode();
    attempts++;
  }

  const league = await prisma.league.create({
    data: {
      name: name.trim(),
      commissionerId: user.id,
      maxTeams,
      rosterSize,
      draftFormat: draftFormat ?? "snake",
      scoringType: scoringType ?? "season_total",
      inviteCode,
      status: "upcoming",
      seasonYear: currentSeasonYear(),
      pickTimerSeconds: pickTimerSeconds ?? 90,
    },
    include: { _count: { select: { members: true } } },
  });

  // Auto-join commissioner as a member
  await prisma.leagueMember.create({
    data: { leagueId: league.id, userId: user.id },
  });

  // Create roster for commissioner
  await prisma.roster.create({
    data: { leagueId: league.id, userId: user.id },
  });

  return NextResponse.json({ league: { ...league, isCommissioner: true } }, { status: 201 });
}
