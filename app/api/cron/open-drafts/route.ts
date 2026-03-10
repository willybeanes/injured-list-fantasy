import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/open-drafts
 *
 * Meant to be called every 1–2 minutes (Vercel Cron or similar).
 * Finds leagues whose draft is scheduled to start within the next 5 minutes
 * and transitions them from "upcoming" → "drafting" so the draft room opens.
 *
 * The 5-minute early open gives managers time to get into the room before
 * picks begin.
 */
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  // Find upcoming leagues whose scheduled start is within the next 5 minutes
  // (i.e. draftScheduledAt <= now + 5min, meaning the room should be open by now)
  const leaguesToOpen = await prisma.league.findMany({
    where: {
      status: "upcoming",
      draftScheduledAt: {
        not: null,
        lte: fiveMinutesFromNow,
      },
    },
    select: { id: true, name: true, draftScheduledAt: true },
  });

  if (leaguesToOpen.length === 0) {
    return NextResponse.json({ opened: 0, leagues: [] });
  }

  // Transition all matching leagues to "drafting"
  const ids = leaguesToOpen.map((l) => l.id);
  await prisma.league.updateMany({
    where: { id: { in: ids } },
    data: { status: "drafting" },
  });

  return NextResponse.json({
    opened: leaguesToOpen.length,
    leagues: leaguesToOpen.map((l) => ({
      id: l.id,
      name: l.name,
      scheduledAt: l.draftScheduledAt,
    })),
  });
}
