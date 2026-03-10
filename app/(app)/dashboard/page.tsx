import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/Topbar";
import { IlPlayerCard } from "@/components/dashboard/IlPlayerCard";
import { WeeklyChart } from "@/components/dashboard/WeeklyChart";
import {
  Activity,
  Trophy,
  Globe,
  TrendingUp,
  Minus,
  Calendar,
  ArrowRight,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { format, subWeeks, startOfWeek } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type IlPlayerWithTeams = {
  mlbPlayerId: number;
  mlbPlayer: {
    id: number;
    fullName: string;
    teamAbbr: string | null;
    position: string | null;
    currentIlStatus: string;
    seasonIlDays: number;
  };
  teamNames: string[];
};

type RecentInjuryWithTeams = {
  id: string;
  mlbPlayerId: number;
  logDate: Date;
  ilStatus: string;
  mlbPlayer: {
    fullName: string;
    teamAbbr: string | null;
    seasonIlDays: number;
  };
  teamNames: string[];
};

// ─── Data layer ───────────────────────────────────────────────────────────────

async function getDashboardData(userId: string, selectedLeagueId?: string) {
  try {
    // Fetch all rosters for this user
    const allRosters = await prisma.roster.findMany({
      where: { userId },
      include: {
        league: { select: { name: true, id: true, status: true } },
        players: { include: { mlbPlayer: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const empty = {
      allRosters: [] as typeof allRosters,
      selectedLeagueId: undefined as string | undefined,
      totalIlDays: 0,
      weeklyIlDays: 0,
      globalScore: null as { globalRank: number | null; totalIlDays: number } | null,
      leagueRank: null as number | null,
      totalLeagueTeams: 0,
      weeklyData: [] as { week: string; days: number; isCurrent: boolean }[],
      recentInjuriesWithTeams: [] as RecentInjuryWithTeams[],
      ilPlayersWithTeams: [] as IlPlayerWithTeams[],
    };

    if (allRosters.length === 0) return empty;

    // Determine which rosters to show
    const isAllMode = !selectedLeagueId;
    const rostersToShow = isAllMode
      ? allRosters
      : allRosters.filter((r) => r.leagueId === selectedLeagueId);
    const effectiveRosters = rostersToShow.length > 0 ? rostersToShow : allRosters;

    // Aggregate stat card values
    const totalIlDays = effectiveRosters.reduce((s, r) => s + r.totalIlDays, 0);
    const weeklyIlDays = effectiveRosters.reduce((s, r) => s + r.weeklyIlDays, 0);

    // Global score
    const globalScore = await prisma.globalScore.findUnique({ where: { userId } });

    // League rank — only meaningful for a single selected roster
    let leagueRank: number | null = null;
    let totalLeagueTeams = 0;
    if (!isAllMode && effectiveRosters.length === 1) {
      const leagueRosters = await prisma.roster.findMany({
        where: { leagueId: effectiveRosters[0].leagueId },
        orderBy: { totalIlDays: "desc" },
      });
      leagueRank = leagueRosters.findIndex((r) => r.userId === userId) + 1;
      totalLeagueTeams = leagueRosters.length;
    }

    // Build player → team-names map across shown rosters
    const playerToTeams = new Map<number, string[]>();
    for (const roster of effectiveRosters) {
      for (const rp of roster.players) {
        const teams = playerToTeams.get(rp.mlbPlayerId) ?? [];
        teams.push(roster.league.name);
        playerToTeams.set(rp.mlbPlayerId, teams);
      }
    }
    const uniquePlayerIds = Array.from(playerToTeams.keys());

    // IL players — deduplicated, sorted by season IL days
    const seenIl = new Set<number>();
    const ilPlayersWithTeams: IlPlayerWithTeams[] = [];
    for (const roster of effectiveRosters) {
      for (const rp of roster.players) {
        if (rp.mlbPlayer.currentIlStatus !== "active" && !seenIl.has(rp.mlbPlayerId)) {
          seenIl.add(rp.mlbPlayerId);
          ilPlayersWithTeams.push({
            mlbPlayerId: rp.mlbPlayerId,
            mlbPlayer: rp.mlbPlayer,
            teamNames: playerToTeams.get(rp.mlbPlayerId) ?? [],
          });
        }
      }
    }
    ilPlayersWithTeams.sort((a, b) => b.mlbPlayer.seasonIlDays - a.mlbPlayer.seasonIlDays);

    // Recent injuries (last 7 days)
    const rawInjuries = uniquePlayerIds.length > 0
      ? await prisma.ilDayLog.findMany({
          where: {
            mlbPlayerId: { in: uniquePlayerIds },
            logDate: { gte: subWeeks(new Date(), 1) },
          },
          include: {
            mlbPlayer: { select: { fullName: true, teamAbbr: true, seasonIlDays: true } },
          },
          orderBy: { logDate: "desc" },
          distinct: ["mlbPlayerId"],
          take: isAllMode ? 10 : 5,
        })
      : [];
    const recentInjuriesWithTeams: RecentInjuryWithTeams[] = rawInjuries.map((log) => ({
      ...log,
      teamNames: playerToTeams.get(log.mlbPlayerId) ?? [],
    }));

    // Weekly chart — count IL days for unique player set
    const weeklyData: { week: string; days: number; isCurrent: boolean }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const weekEnd = i === 0
        ? new Date()
        : startOfWeek(subWeeks(new Date(), i - 1), { weekStartsOn: 1 });

      const days = uniquePlayerIds.length > 0
        ? await prisma.ilDayLog.count({
            where: {
              mlbPlayerId: { in: uniquePlayerIds },
              logDate: { gte: weekStart, lt: weekEnd },
            },
          })
        : 0;
      weeklyData.push({ week: format(weekStart, "M/d"), days, isCurrent: i === 0 });
    }

    return {
      allRosters,
      selectedLeagueId,
      totalIlDays,
      weeklyIlDays,
      globalScore,
      leagueRank,
      totalLeagueTeams,
      weeklyData,
      recentInjuriesWithTeams,
      ilPlayersWithTeams,
    };
  } catch (err) {
    console.error("Dashboard error:", err);
    return {
      allRosters: [],
      selectedLeagueId: undefined,
      totalIlDays: 0,
      weeklyIlDays: 0,
      globalScore: null,
      leagueRank: null,
      totalLeagueTeams: 0,
      weeklyData: [],
      recentInjuriesWithTeams: [] as RecentInjuryWithTeams[],
      ilPlayersWithTeams: [] as IlPlayerWithTeams[],
    };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { team?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const selectedLeagueId = searchParams.team;
  const data = await getDashboardData(user.id, selectedLeagueId);
  const {
    allRosters,
    totalIlDays,
    weeklyIlDays,
    globalScore,
    leagueRank,
    totalLeagueTeams,
    weeklyData,
    recentInjuriesWithTeams,
    ilPlayersWithTeams,
  } = data;

  const isAllMode = !selectedLeagueId;
  const globalRank = globalScore?.globalRank;
  const globalTotal = globalScore?.totalIlDays ?? 0;
  const hasMultipleRosters = allRosters.length > 1;
  const selectedRosterName = selectedLeagueId
    ? (allRosters.find((r) => r.leagueId === selectedLeagueId)?.league.name ?? "League")
    : "All Leagues";

  const statCards = [
    {
      label: "Total IL Days",
      value: formatNumber(totalIlDays),
      sublabel: isAllMode && allRosters.length > 1
        ? `across ${allRosters.length} leagues`
        : "Season total",
      icon: Activity,
      color: "text-brand-red",
      bg: "bg-red-500/10",
    },
    {
      label: "This Week",
      value: formatNumber(weeklyIlDays),
      sublabel: "IL days earned",
      icon: Calendar,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "League Rank",
      value: isAllMode && allRosters.length > 1
        ? `${allRosters.length} leagues`
        : leagueRank ? `#${leagueRank}` : "—",
      sublabel: isAllMode && allRosters.length > 1
        ? "select a team to see rank"
        : leagueRank ? `of ${totalLeagueTeams} teams` : "No league yet",
      icon: Trophy,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Global Rank",
      value: globalRank ? `#${globalRank}` : "—",
      sublabel: globalRank ? `${formatNumber(globalTotal)} total days` : "All platforms",
      icon: Globe,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
  ];

  return (
    <div>
      <Topbar
        title="Dashboard"
        subtitle={selectedRosterName}
        actions={
          <div className="flex gap-2">
            <Link href="/leagues?join=1" className="btn-secondary text-sm py-1.5 px-3">
              Join League
            </Link>
            <Link href="/leagues?create=1" className="btn-primary text-sm py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" />
              Create League
            </Link>
          </div>
        }
      />

      <div className="p-6 max-w-6xl space-y-6">
        {/* ── Team filter tabs (only when in multiple leagues) ── */}
        {hasMultipleRosters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href="/dashboard"
              className={cn(
                "px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors border",
                isAllMode
                  ? "bg-brand-red text-white border-brand-red"
                  : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              All
            </Link>
            {allRosters.map((r) => (
              <Link
                key={r.leagueId}
                href={`/dashboard?team=${r.leagueId}`}
                className={cn(
                  "px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors border",
                  selectedLeagueId === r.leagueId
                    ? "bg-brand-red text-white border-brand-red"
                    : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                {r.league.name}
              </Link>
            ))}
          </div>
        )}

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="card">
                <div className={`w-8 h-8 ${card.bg} rounded-[8px] flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <p className="text-2xl font-extrabold text-[var(--text-primary)]">
                  {card.value}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{card.label}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{card.sublabel}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* ── Weekly chart ── */}
          <div className="card col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                  Weekly IL Days
                </h2>
                <p className="text-xs text-[var(--text-muted)]">Last 8 weeks</p>
              </div>
              <div className="flex items-center gap-1 text-xs">
                {weeklyIlDays > 0 ? (
                  <span className="flex items-center gap-1 text-green-500 font-semibold">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {weeklyIlDays} this week
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[var(--text-muted)] font-semibold">
                    <Minus className="w-3.5 h-3.5" />
                    No days yet
                  </span>
                )}
              </div>
            </div>
            <WeeklyChart data={weeklyData} />
          </div>

          {/* ── Players on IL ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                Players on IL
              </h2>
              <span className="badge badge-red">{ilPlayersWithTeams.length}</span>
            </div>

            {ilPlayersWithTeams.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  {allRosters.length > 0
                    ? "No players on the IL right now"
                    : "Join a league to start drafting"}
                </p>
                {allRosters.length === 0 && (
                  <Link href="/leagues" className="btn-primary mt-3 text-xs py-1.5 px-3 inline-flex">
                    Browse Leagues
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ) : (
              <div>
                {ilPlayersWithTeams.slice(0, 5).map((item) => (
                  <IlPlayerCard
                    key={item.mlbPlayerId}
                    player={item.mlbPlayer}
                    teamLabel={
                      item.teamNames.length === 1
                        ? item.teamNames[0]
                        : item.teamNames.length > 1
                        ? `${item.teamNames.length} teams`
                        : undefined
                    }
                  />
                ))}
                {ilPlayersWithTeams.length > 5 && (
                  <p className="text-xs text-[var(--text-muted)] text-center pt-2">
                    +{ilPlayersWithTeams.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent injury feed ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                Recent Injuries
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Your players — last 7 days
              </p>
            </div>
            <Link
              href="/injuries"
              className="text-xs text-brand-red font-semibold hover:text-brand-red-hover flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentInjuriesWithTeams.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-4 text-center">
              {allRosters.length > 0
                ? "No new injuries in the last 7 days"
                : "Draft players to track their injuries"}
            </p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Fantasy Team</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="text-right">Season Days</th>
                </tr>
              </thead>
              <tbody>
                {recentInjuriesWithTeams.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {log.mlbPlayer.fullName}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {log.mlbPlayer.teamAbbr}
                      </p>
                    </td>
                    <td className="text-xs text-blue-400">
                      {log.teamNames.length === 0
                        ? "—"
                        : log.teamNames.length === 1
                        ? log.teamNames[0]
                        : `${log.teamNames.length} teams`}
                    </td>
                    <td>
                      <span className="badge badge-red">
                        {log.ilStatus.toUpperCase().replace("IL", "IL-")}
                      </span>
                    </td>
                    <td className="text-[var(--text-secondary)]">
                      {format(new Date(log.logDate), "MMM d")}
                    </td>
                    <td className="text-right font-semibold text-brand-red">
                      {log.mlbPlayer.seasonIlDays}d
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
