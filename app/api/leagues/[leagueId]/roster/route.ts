import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/leagues/[leagueId]/roster — update current user's team name
export async function PATCH(
  request: Request,
  { params }: { params: { leagueId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = params;
  const { teamName } = await request.json();

  if (typeof teamName !== "string") {
    return NextResponse.json({ error: "teamName is required" }, { status: 400 });
  }

  const trimmed = teamName.trim().slice(0, 40);

  const roster = await prisma.roster.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
  });
  if (!roster) return NextResponse.json({ error: "Not a member of this league" }, { status: 404 });

  const updated = await prisma.roster.update({
    where: { id: roster.id },
    data: { teamName: trimmed || null },
  });

  return NextResponse.json({ teamName: updated.teamName });
}
