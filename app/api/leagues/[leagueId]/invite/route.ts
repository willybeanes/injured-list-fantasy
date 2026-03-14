import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  sendLeagueInviteToExistingUser,
  sendLeagueInviteToNewUser,
} from "@/lib/email";
import { randomUUID } from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// POST /api/leagues/[leagueId]/invite — commissioner sends an email invite
export async function POST(
  request: Request,
  { params }: { params: { leagueId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = params;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { commissioner: { select: { username: true } } },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }
  if (league.commissionerId !== user.id) {
    return NextResponse.json({ error: "Only the commissioner can send invites" }, { status: 403 });
  }
  if (league.status !== "upcoming") {
    return NextResponse.json({ error: "Invites can only be sent for upcoming leagues" }, { status: 400 });
  }

  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Check if already a member
  const existingMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      user: { email: normalizedEmail },
    },
  });
  if (existingMember) {
    return NextResponse.json({ error: "This person is already in the league" }, { status: 400 });
  }

  // Check for existing non-expired pending invite
  const existingInvite = await prisma.leagueInvite.findFirst({
    where: {
      leagueId,
      email: normalizedEmail,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
  });
  if (existingInvite) {
    return NextResponse.json({ error: "An active invite has already been sent to this email" }, { status: 400 });
  }

  // Create invite
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = randomUUID();

  await prisma.leagueInvite.upsert({
    where: { leagueId_email: { leagueId, email: normalizedEmail } },
    create: {
      leagueId,
      email: normalizedEmail,
      token,
      invitedById: user.id,
      expiresAt,
    },
    update: {
      token,
      status: "pending",
      invitedById: user.id,
      expiresAt,
    },
  });

  // Check if user already has an account
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, emailUnsubscribed: true },
  });

  const inviterUsername = league.commissioner.username;

  if (existingUser) {
    if (!existingUser.emailUnsubscribed) {
      await sendLeagueInviteToExistingUser({
        to: normalizedEmail,
        userId: existingUser.id,
        inviterUsername,
        leagueName: league.name,
        acceptUrl: `${APP_URL}/invites/${token}`,
      });
    }
  } else {
    await sendLeagueInviteToNewUser({
      to: normalizedEmail,
      inviterUsername,
      leagueName: league.name,
      signupUrl: `${APP_URL}/signup?invite=${token}`,
    });
  }

  return NextResponse.json({ ok: true, existingUser: !!existingUser });
}

// DELETE /api/leagues/[leagueId]/invite — commissioner cancels a pending invite
export async function DELETE(
  request: Request,
  { params }: { params: { leagueId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = params;
  const { inviteId } = await request.json();
  if (!inviteId) return NextResponse.json({ error: "inviteId required" }, { status: 400 });

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { commissionerId: true },
  });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  if (league.commissionerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.leagueInvite.updateMany({
    where: { id: inviteId, leagueId, status: "pending" },
    data: { status: "cancelled" },
  });

  return NextResponse.json({ ok: true });
}

// GET /api/leagues/[leagueId]/invite — commissioner lists pending invites
export async function GET(
  _request: Request,
  { params }: { params: { leagueId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = params;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { commissionerId: true },
  });

  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  if (league.commissionerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.leagueInvite.findMany({
    where: {
      leagueId,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, createdAt: true, expiresAt: true },
  });

  return NextResponse.json({ invites });
}
