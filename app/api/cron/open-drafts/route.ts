import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAutoPick } from "@/lib/draft";

const MAX_DELAYS = 3;
const DELAY_HOURS = 24;
// Safety cap: max picks to auto-advance per league per cron run (prevents runaway loops)
const MAX_CATCH_UP_PICKS = 100;

/**
 * GET /api/cron/open-drafts
 *
 * Called every 5 minutes via GitHub Actions.
 *
 * For each upcoming league whose draftScheduledAt <= now + 5min:
 *   - Full league (public or private) → open draft (upcoming → drafting)
 *   - Private + not full → clear draftScheduledAt (commissioner must reschedule)
 *   - Public + not full + delayCount < MAX_DELAYS → delay 24hr, notify members
 *   - Public + not full + delayCount >= MAX_DELAYS → notify commissioner to decide
 *
 * Additionally, for each actively drafting league:
 *   - If currentPickStartedAt + pickTimerSeconds < now → pick has stalled
 *   - Auto-pick until caught up or draft completes (handles overnight abandonment)
 */
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  // ── 1. Open scheduled drafts ─────────────────────────────────────────────

  const leaguesToProcess = await prisma.league.findMany({
    where: {
      status: "upcoming",
      draftScheduledAt: { not: null, lte: fiveMinutesFromNow },
    },
    include: {
      _count: { select: { members: true } },
      members: { include: { user: { select: { id: true, email: true, username: true, emailUnsubscribed: true } } } },
      commissioner: { select: { id: true, email: true, username: true, emailUnsubscribed: true } },
    },
  });

  const opened: string[] = [];
  const cleared: string[] = [];
  const delayed: string[] = [];
  const pendingDecision: string[] = [];

  for (const league of leaguesToProcess) {
    const isFull = league._count.members === league.maxTeams;

    if (isFull) {
      await prisma.league.update({
        where: { id: league.id },
        data: { status: "drafting", currentPickStartedAt: new Date() },
      });
      opened.push(league.id);
      continue;
    }

    if (!league.isPublic) {
      await prisma.league.update({
        where: { id: league.id },
        data: { draftScheduledAt: null, draftReminderSentAt: null, draftFinalReminderSentAt: null },
      });
      cleared.push(league.id);
      continue;
    }

    if (league.delayCount < MAX_DELAYS) {
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
      delayed.push(league.id);

      if (process.env.RESEND_API_KEY) {
        const { sendDraftDelayedEmail } = await import("@/lib/email");
        const spotsLeft = league.maxTeams - league._count.members;
        const newTimeStr = newDraftTime.toLocaleString("en-US", {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit",
        });
        await Promise.allSettled(
          league.members
            .filter((m) => !m.user.emailUnsubscribed)
            .map((m) =>
              sendDraftDelayedEmail({
                to: m.user.email,
                userId: m.user.id,
                username: m.user.username,
                leagueName: league.name,
                newDraftTime: newTimeStr,
                spotsLeft,
                delayNumber: league.delayCount + 1,
                maxDelays: MAX_DELAYS,
                lobbyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/lobby`,
              })
            )
        );
      }
    } else {
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

      if (league.delayCount === MAX_DELAYS && process.env.RESEND_API_KEY) {
        const { sendDraftDecisionNeededEmail } = await import("@/lib/email");
        if (!league.commissioner.emailUnsubscribed) {
          await sendDraftDecisionNeededEmail({
            to: league.commissioner.email,
            userId: league.commissioner.id,
            commissionerUsername: league.commissioner.username,
            leagueName: league.name,
            memberCount: league._count.members,
            maxTeams: league.maxTeams,
            leagueUrl: `${process.env.NEXT_PUBLIC_APP_URL}/leagues/${league.id}`,
          }).catch(() => {});
        }
      }
    }
  }

  // ── 2. Advance stalled active drafts ─────────────────────────────────────

  const stalledLeagues = await prisma.league.findMany({
    where: {
      status: "drafting",
      currentPickStartedAt: { not: null },
    },
    select: { id: true, pickTimerSeconds: true, currentPickStartedAt: true },
  });

  const advanced: Record<string, number> = {}; // leagueId → picks auto-advanced

  for (const league of stalledLeagues) {
    const deadline = new Date(
      league.currentPickStartedAt!.getTime() + league.pickTimerSeconds * 1000
    );
    if (deadline > now) continue; // Timer hasn't expired yet — nothing to do

    let picks = 0;
    while (picks < MAX_CATCH_UP_PICKS) {
      const result = await runAutoPick(league.id);
      if (!result.ok) break; // Draft complete or error
      picks++;
      if (result.draftComplete) break;

      // Check if the NEXT pick is also already overdue (catching up after long absence)
      const updated = await prisma.league.findUnique({
        where: { id: league.id },
        select: { currentPickStartedAt: true, status: true },
      });
      if (!updated || updated.status !== "drafting" || !updated.currentPickStartedAt) break;
      const nextDeadline = new Date(
        updated.currentPickStartedAt.getTime() + league.pickTimerSeconds * 1000
      );
      if (nextDeadline > now) break; // Next pick is still within its window
    }

    if (picks > 0) advanced[league.id] = picks;
  }

  return NextResponse.json({
    opened: opened.length,
    cleared: cleared.length,
    delayed: delayed.length,
    pendingDecision: pendingDecision.length,
    advanced: Object.keys(advanced).length,
    leagues: { opened, cleared, delayed, pendingDecision, advanced },
  });
}
