import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/invites/[token] — public; returns invite info for display
export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const invite = await prisma.leagueInvite.findUnique({
    where: { token: params.token },
    include: {
      league: { select: { id: true, name: true } },
      invitedBy: { select: { username: true } },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  return NextResponse.json({
    leagueId: invite.league.id,
    leagueName: invite.league.name,
    commissionerUsername: invite.invitedBy.username,
    email: invite.email,
    status: invite.status,
    expired: invite.expiresAt < new Date(),
  });
}
