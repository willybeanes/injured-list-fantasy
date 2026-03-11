import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_DELAYS = 3;
const DELAY_HOURS = 24;

/**
 * GET /api/cron/open-drafts
 *
 * Called every 5 minutes via GitHub Actions.
 *
 * For each upcoming league whose draftScheduledAt <= now + 5min:
 *   - Private league OR public + full → open draft (upcoming → drafting)
 *   - Public + not full + delayCount < MAX_DELAYS → delay 24hr, notify members
 *   - Public + not full + delayCount >= MAX_DELAYS → notify commissioner to decide
 */
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  const leaguesToProcess = await prisma.league.findMany({
    where: {
      status: "upcoming",
      draftScheduledAt: {
        not: null,
        lte: fiveMinutesFromNow,
      },
    },
    include: {
      _count: { select: { members: true } },
      members: { include: { user: { select: { email: true, username: true } } } },
      commissioner: { select: { email: true, username: true } },
    },
  });

  if (leaguesToProcess.length === 0) {
    return NextResponse.json({ opened: 0, delayed: 0, pendingDecision: 0 });
  }

  const opened: string[] = [];
  const delayed: string[] = [];
  const pendingDecision: string[] = [];

  for (const league of leaguesToProcess) {
    const isFull = league._count.members >= league.maxTeams;

    // Private leagues or full public leagues → open draft immediately
    if (!league.isPublic || isFull) {
      await prisma.league.update({
        where: { id: league.id },
        data: { status: "drafting" },
      });
      opened.push(league.id);
      continue;
    }

    // Public + not full: check delay count
    if (league.delayCount < MAX_DELAYS) {
      // Auto-delay by 24 hours
      const newDraftTime = new Date(
        (league.draftScheduledAt as Date).getTime() + DELAY_HOURS * 60 * 60 * 1000
      );
      await prisma.league.update({
        where: { id: league.id },
        data: {
          draftScheduledAt: newDraftTime,
          delayCount: league.delayCount + 1,
          // Reset reminder flags so reminders fire again for the new time
          draftReminderSentAt: null,
          draftFinalReminderSentAt: null,
        },
      });
      delayed.push(league.id);

      // Notify all members about the delay
      const spotsLeft = league.maxTeams - league._count.members;
      const delayNum = league.delayCount + 1;
      const newTimeStr = newDraftTime.toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      });

      if (process.env.RESEND_API_KEY) {
        const { sendDraftDelayedEmail } = await import("@/lib/email");
        await Promise.allSettled(
          league.members.map((m) =>
            sendDraftDelayedEmail({
              to: m.user.email,
              username: m.user.username,
              leagueName: league.name,
              newDraftTime: newTimeStr,
              spotsLeft,
              delayNumber: delayNum,
              maxDelays: MAX_DELAYS,
              lobbyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/lobby`,
            })
          )
        );
      }
    } else {
      // Past max delays — bump draft another 24 hrs to prevent repeated cron triggers.
      // Only send the "decision needed" email the first time (when delayCount === MAX_DELAYS).
      const newDraftTime = new Date(
        (league.draftScheduledAt as Date).getTime() + DELAY_HOURS * 60 * 60 * 1000
      );
      await prisma.league.update({
        where: { id: league.id },
        data: {
          draftScheduledAt: newDraftTime,
          delayCount: league.delayCount + 1,
          draftReminderSentAt: null,
          draftFinalReminderSentAt: null,
        },
      });
      pendingDecision.push(league.id);

      // Only email on the first breach of MAX_DELAYS (delayCount was exactly MAX_DELAYS)
      if (league.delayCount === MAX_DELAYS && process.env.RESEND_API_KEY) {
        const { sendDraftDecisionNeededEmail } = await import("@/lib/email");
        await sendDraftDecisionNeededEmail({
          to: league.commissioner.email,
          commissionerUsername: league.commissioner.username,
          leagueName: league.name,
          memberCount: league._count.members,
          maxTeams: league.maxTeams,
          leagueUrl: `${process.env.NEXT_PUBLIC_APP_URL}/leagues/${league.id}`,
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({
    opened: opened.length,
    delayed: delayed.length,
    pendingDecision: pendingDecision.length,
    leagues: { opened, delayed, pendingDecision },
  });
}
