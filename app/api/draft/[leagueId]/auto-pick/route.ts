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
  _request: Request,
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

  const result = await runAutoPick(leagueId);

  if (!result.ok) {
    const status = result.error === "League not found" ? 404
      : result.error === "Not a league member" ? 403
      : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
