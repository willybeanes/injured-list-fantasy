import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/Topbar";
import { Trophy, Globe, TrendingUp } from "lucide-react";
import { currentSeasonYear, formatNumber } from "@/lib/utils";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LEAGUE_SIZE_OPTIONS = [
  { label: "All", value: null },
  { label: "5 Teams", value: 5 },
  { label: "10 Teams", value: 10 },
  { label: "15 Teams", value: 15 },
] as const;

async function getStandingsData(userId: string, leagueSizeFilter: number | null) {
  try {
    const memberLeagues = await prisma.leagueMember.findMany({
      where: { userId },
      select: { leagueId: true },
    });
    const leagueIds = memberLeagues.map((m) => m.leagueId);

    const primaryLeague = await prisma.league.findFirst({
      where: { id: { in: leagueIds }, status: { in: ["active", "drafting"] } },
      orderBy: { createdAt: "desc" },
    });

    let leagueStandings: Array<{
      rank: number;
      userId: string;
      username: string;
      totalIlDays: number;
      weeklyIlDays: number;
      playerCount: number;
    }> = [];

    if (primaryLeague) {
      const rosters = await prisma.roster.findMany({
        where: { leagueId: primaryLeague.id },
        include: {
          user: { select: { username: true } },
          _count: { select: { players: true } },
        },
        orderBy: { totalIlDays: "desc" },
      });

      leagueStandings = rosters.map((r, idx) => ({
        rank: idx + 1,
        userId: r.userId,
        username: r.user.username,
        totalIlDays: r.totalIlDays,
        weeklyIlDays: r.weeklyIlDays,
        playerCount: r._count.players,
      }));
    }

    // Global leaderboard — include league maxTeams for filtering
    const globalScores = await prisma.globalScore.findMany({
      where: { seasonYear: currentSeasonYear() },
      include: {
        user: {
          select: {
            username: true,
            leagueMembers: {
              take: 1,
              include: {
                league: { select: { name: true, maxTeams: true } },
              },
            },
          },
        },
      },
      orderBy: { totalIlDays: "desc" },
      take: 200,
    });

    const allGlobal = globalScores.map((gs, idx) => ({
      rank: idx + 1,
      userId: gs.userId,
      username: gs.user.username,
      leagueName: gs.user.leagueMembers[0]?.league.name ?? "—",
      leagueMaxTeams: gs.user.leagueMembers[0]?.league.maxTeams ?? null,
      totalIlDays: gs.totalIlDays,
      globalRank: gs.globalRank,
    }));

    // Apply size filter and re-rank within filtered set
    const filteredGlobal = leagueSizeFilter
      ? allGlobal.filter((r) => r.leagueMaxTeams === leagueSizeFilter)
      : allGlobal;

    const globalLeaderboard = filteredGlobal.slice(0, 100).map((r, idx) => ({
      ...r,
      rank: idx + 1,
    }));

    return { primaryLeague, leagueStandings, globalLeaderboard };
  } catch {
    return { primaryLeague: null, leagueStandings: [], globalLeaderboard: [] };
  }
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: { leagueSize?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const leagueSizeFilter = searchParams.leagueSize
    ? Number(searchParams.leagueSize)
    : null;

  const { primaryLeague, leagueStandings, globalLeaderboard } =
    await getStandingsData(user.id, leagueSizeFilter);

  return (
    <div>
      <Topbar title="Standings" subtitle="League & Global Leaderboard" />

      <div className="p-6 max-w-5xl space-y-6">
        {/* My League Standings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" />
            <div>
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                {primaryLeague?.name ?? "League Standings"}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {primaryLeague
                  ? `${primaryLeague.seasonYear} season`
                  : "Join an active league to see standings"}
              </p>
            </div>
          </div>

          {leagueStandings.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">
              No active league standings yet.
            </p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Team</th>
                  <th className="text-right">Players</th>
                  <th className="text-right">This Week</th>
                  <th className="text-right">Season IL Days</th>
                </tr>
              </thead>
              <tbody>
                {leagueStandings.map((row) => (
                  <tr
                    key={row.userId}
                    className={row.userId === user.id ? "bg-red-500/5" : ""}
                  >
                    <td><RankBadge rank={row.rank} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-xs font-extrabold text-brand-red">
                          {row.username[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {row.username}
                          {row.userId === user.id && (
                            <span className="ml-1.5 text-xs text-[var(--text-muted)]">(you)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="text-right text-sm text-[var(--text-secondary)]">
                      {row.playerCount}
                    </td>
                    <td className="text-right text-sm font-semibold text-[var(--text-primary)]">
                      +{row.weeklyIlDays}
                    </td>
                    <td className="text-right">
                      <span className="text-sm font-extrabold text-brand-red">
                        {formatNumber(row.totalIlDays)}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Global Leaderboard */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" />
              <div>
                <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                  Global Leaderboard
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Top {globalLeaderboard.length} across all leagues ·{" "}
                  {currentSeasonYear()} season
                </p>
              </div>
            </div>

            {/* League size filter */}
            <div className="flex items-center gap-1.5">
              {LEAGUE_SIZE_OPTIONS.map((opt) => {
                const isActive = leagueSizeFilter === opt.value;
                const href = opt.value
                  ? `/standings?leagueSize=${opt.value}`
                  : "/standings";
                return (
                  <Link
                    key={opt.label}
                    href={href}
                    className={cn(
                      "px-2.5 py-1 rounded-[7px] text-xs font-semibold transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-brand-red text-white"
                        : "bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {opt.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {globalLeaderboard.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">
              {leagueSizeFilter
                ? `No scores yet for ${leagueSizeFilter}-team leagues.`
                : "No global scores yet — the season is just getting started!"}
            </p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Player</th>
                  <th>League</th>
                  <th className="text-right">Season IL Days</th>
                </tr>
              </thead>
              <tbody>
                {globalLeaderboard.map((row) => (
                  <tr
                    key={row.userId}
                    className={row.userId === user.id ? "bg-red-500/5" : ""}
                  >
                    <td><RankBadge rank={row.rank} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-xs font-extrabold text-brand-red">
                          {row.username[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {row.username}
                          {row.userId === user.id && (
                            <span className="ml-1.5 text-xs text-[var(--text-muted)]">(you)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span className="text-sm text-[var(--text-secondary)]">
                          {row.leagueName}
                        </span>
                        {row.leagueMaxTeams && (
                          <span className="ml-1.5 text-xs text-[var(--text-muted)]">
                            ({row.leagueMaxTeams}-team)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.rank <= 3 && (
                          <TrendingUp className="w-3 h-3 text-green-500" />
                        )}
                        <span className="text-sm font-extrabold text-brand-red">
                          {formatNumber(row.totalIlDays)}d
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: "text-amber-400 font-extrabold",
    2: "text-slate-400 font-extrabold",
    3: "text-amber-600 font-extrabold",
  };
  return (
    <span className={`text-sm ${colors[rank] ?? "text-[var(--text-muted)] font-semibold"}`}>
      {rank}
    </span>
  );
}
