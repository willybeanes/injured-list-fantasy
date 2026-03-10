import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST /api/leagues/join — join league via invite code
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteCode, teamName } = await request.json();
  if (!inviteCode) {
    return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
  }

  // Normalize to uppercase
  const normalizedCode = inviteCode.toUpperCase().trim();

  const league = await prisma.league.findUnique({
    where: { inviteCode: normalizedCode },
    include: { _count: { select: { members: true } } },
  });

  if (!league) {
    return NextResponse.json({ error: "Invalid invite code. Check the code and try again." }, { status: 404 });
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

  // Join league
  await prisma.leagueMember.create({
    data: { leagueId: league.id, userId: user.id },
  });

  // Create roster
  await prisma.roster.create({
    data: { leagueId: league.id, userId: user.id, teamName: teamName?.trim() || null },
  });

  return NextResponse.json({
    league: { ...league, isCommissioner: false },
  });
}
