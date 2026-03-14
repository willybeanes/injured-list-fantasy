import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDraftReminder, sendDraftFinalReminder } from "@/lib/email";

/**
 * GET /api/cron/draft-reminders
 *
 * Runs every 5 minutes. Handles two reminder emails per league:
 *
 * 1. 2-hour reminder: sent when draftScheduledAt is 110–130 min from now.
 *    Tracked via draftReminderSentAt.
 *
 * 2. "Starting now" reminder: sent when draftScheduledAt is within the next
 *    6 minutes (same window the draft room opens). Tracked via draftFinalReminderSentAt.
 */
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // ── 2-hour reminder ─────────────────────────────────────────────────────────
  const in110Min = new Date(now.getTime() + 110 * 60 * 1000);
  const in130Min = new Date(now.getTime() + 130 * 60 * 1000);

  const twoHourLeagues = await prisma.league.findMany({
    where: {
      status: "upcoming",
      draftReminderSentAt: null,
      draftScheduledAt: { gte: in110Min, lte: in130Min },
    },
    include: {
      members: {
        include: { user: { select: { id: true, email: true, username: true, emailUnsubscribed: true } } },
      },
    },
  });

  for (const league of twoHourLeagues) {
    await Promise.all(
      league.members
        .filter((m) => !m.user.emailUnsubscribed)
        .map((m) =>
          sendDraftReminder({
            to: m.user.email,
            userId: m.user.id,
            username: m.user.username,
            leagueName: league.name,
            leagueId: league.id,
            draftAt: league.draftScheduledAt!,
          })
        )
    );
    await prisma.league.update({
      where: { id: league.id },
      data: { draftReminderSentAt: now },
    });
  }

  // ── "Starting now" reminder ─────────────────────────────────────────────────
  // Window matches the open-drafts cron: draft is within the next ~5–6 min.
  const in6Min = new Date(now.getTime() + 6 * 60 * 1000);

  const finalLeagues = await prisma.league.findMany({
    where: {
      status: "upcoming",
      draftFinalReminderSentAt: null,
      draftScheduledAt: { gte: now, lte: in6Min },
    },
    include: {
      members: {
        include: { user: { select: { id: true, email: true, username: true, emailUnsubscribed: true } } },
      },
    },
  });

  for (const league of finalLeagues) {
    await Promise.all(
      league.members
        .filter((m) => !m.user.emailUnsubscribed)
        .map((m) =>
          sendDraftFinalReminder({
            to: m.user.email,
            userId: m.user.id,
            username: m.user.username,
            leagueName: league.name,
            leagueId: league.id,
          })
        )
    );
    await prisma.league.update({
      where: { id: league.id },
      data: { draftFinalReminderSentAt: now },
    });
  }

  return NextResponse.json({
    twoHourReminders: twoHourLeagues.length,
    finalReminders: finalLeagues.length,
  });
}
