import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { runAutoPick } from "@/lib/draft";

/**
 * POST /api/draft/[leagueId]/auto-pick
 *
 * Triggered by any connected client when the pick timer expires.
 * Delegates to the shared runAutoPick helper which also handles
 * server-side cron-driven stall recovery.
 */
export async function POST(
  request: Request,
  { params }: { params: { leagueId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = params;

  const member = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Not a league member" }, { status: 403 });

  // Optional idempotency guard: client passes the pick number it thinks is current.
  // If the draft has already advanced, we silently return ok:false so the client
  // knows to just refresh state without showing an error.
  let expectedPicksMade: number | undefined;
  try {
    const body = await request.json();
    if (typeof body?.currentPickNumber === "number") {
      // currentPickNumber is 1-indexed; totalPicksMade = currentPickNumber - 1
      expectedPicksMade = body.currentPickNumber - 1;
    }
  } catch {
    // Body parsing is optional; proceed without idempotency check
  }

  const result = await runAutoPick(leagueId, expectedPicksMade);

  if (!result.ok) {
    const status = result.error === "League not found" ? 404
      : result.error === "Not a league member" ? 403
      : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
