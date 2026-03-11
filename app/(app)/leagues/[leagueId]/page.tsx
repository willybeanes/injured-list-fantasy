"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import {
  Trophy,
  Users,
  Copy,
  Check,
  Loader2,
  ArrowRight,
  Info,
  Settings,
  X,
  AlertCircle,
  Calendar,
  Clock,
  Mail,
  Send,
  Trash2,
  Pencil,
  Globe,
  Lock,
  Play,
} from "lucide-react";
import Link from "next/link";
import { formatNumber, formatIlStatus } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { usePlayerCard } from "@/components/player/PlayerCardContext";

interface RosterWithUser {
  id: string;
  userId: string;
  teamName: string | null;
  totalIlDays: number;
  weeklyIlDays: number;
  rank: number | null;
  user: { id: string; username: string; avatarUrl: string | null };
  players: Array<{
    mlbPlayerId: number;
    mlbPlayer: {
      fullName: string;
      teamAbbr: string | null;
      currentIlStatus: string;
      seasonIlDays: number;
    };
  }>;
}

interface LeagueDetail {
  id: string;
  name: string;
  status: string;
  maxTeams: number;
  rosterSize: number;
  draftFormat: string;
  scoringType: string;
  inviteCode: string;
  seasonYear: number;
  commissionerId: string;
  commissioner: { username: string };
  _count: { members: number };
  draftScheduledAt: string | null;
  isPublic: boolean;
  delayCount: number;
}

export default function LeagueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.leagueId as string;

  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [rosters, setRosters] = useState<RosterWithUser[]>([]);
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [myRosterId, setMyRosterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [startingDraft, setStartingDraft] = useState(false);
  const [activeRoster, setActiveRoster] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [forceStarting, setForceStarting] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState("");
  const [savingTeamName, setSavingTeamName] = useState(false);
  const { openPlayerCard } = usePlayerCard();

  const loadLeague = useCallback(() => {
    fetch(`/api/leagues/${leagueId}`)
      .then((r) => r.json())
      .then((d) => {
        setLeague(d.league);
        setRosters(d.rosters ?? []);
        setIsCommissioner(d.isCommissioner);
        setMyRosterId(d.myRosterId ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [leagueId]);

  useEffect(() => { loadLeague(); }, [loadLeague]);

  const copyCode = async () => {
    if (!league) return;
    await navigator.clipboard.writeText(league.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const saveTeamName = async () => {
    setSavingTeamName(true);
    const res = await fetch(`/api/leagues/${leagueId}/roster`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName: teamNameInput }),
    });
    if (res.ok) {
      const data = await res.json();
      setRosters((prev) =>
        prev.map((r) => r.id === myRosterId ? { ...r, teamName: data.teamName } : r)
      );
      setEditingTeamName(false);
    }
    setSavingTeamName(false);
  };

  const handleForceStart = async () => {
    if (!confirm(`Start the draft now with only ${league?._count.members} teams? This will reduce the max teams and open the draft immediately.`)) return;
    setForceStarting(true);
    const res = await fetch(`/api/leagues/${leagueId}/force-start`, { method: "POST" });
    if (res.ok) {
      router.push(`/draft/${leagueId}`);
    } else {
      const d = await res.json();
      alert(d.error ?? "Failed to start draft");
      setForceStarting(false);
    }
  };

  const startDraft = async () => {
    setStartingDraft(true);
    await fetch(`/api/leagues/${leagueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "drafting" }),
    });
    router.push(`/draft/${leagueId}`);
  };

  if (loading) {
    return (
      <div>
        <Topbar title="League" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div>
        <Topbar title="League Not Found" />
        <div className="p-6 text-center py-16">
          <p className="text-[var(--text-muted)]">League not found or you are not a member.</p>
          <Link href="/leagues" className="btn-primary mt-4 inline-flex">
            Back to Leagues
          </Link>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    upcoming: "badge-muted",
    drafting: "badge-amber",
    active: "badge-green",
    completed: "badge-red",
  };

  const isFull = league._count.members >= league.maxTeams;
  const spotsLeft = league.maxTeams - league._count.members;

  return (
    <div>
      <Topbar
        title={league.name}
        subtitle={`${league._count.members}/${league.maxTeams} teams · ${league.seasonYear} season`}
        actions={
          <div className="flex gap-1.5 flex-wrap justify-end">
            {/* Invite code — only show while the league is still filling up */}
            {league.status === "upcoming" && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={copyCode}
                  className="btn-secondary text-sm py-1.5 px-3"
                  title="Copy invite code"
                >
                  {copiedCode ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {league.inviteCode}
                </button>
                <div className="relative group">
                  <Info className="w-3.5 h-3.5 text-[var(--text-muted)] cursor-help" />
                  <div className="absolute right-0 top-6 z-50 hidden group-hover:block w-52 p-2.5 rounded-[9px] bg-[var(--surface)] border border-[var(--border)] shadow-lg text-xs text-[var(--text-secondary)] leading-relaxed">
                    Share this code with friends to invite them to your league.
                  </div>
                </div>
              </div>
            )}

            {/* Invite by Email (commissioner + upcoming only) */}
            {isCommissioner && league.status === "upcoming" && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="btn-secondary text-sm py-1.5 px-3"
                title="Invite managers by email"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Invite</span>
              </button>
            )}

            {/* Settings (commissioner + upcoming only) */}
            {isCommissioner && league.status === "upcoming" && (
              <button
                onClick={() => setShowSettings(true)}
                className="btn-secondary text-sm py-1.5 px-3"
                title="League settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Start Draft */}
            {isCommissioner && league.status === "upcoming" && (
              <button
                onClick={startDraft}
                disabled={startingDraft || !isFull}
                className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!isFull ? `Need ${spotsLeft} more team${spotsLeft === 1 ? "" : "s"} to start` : "Start the draft"}
              >
                {startingDraft ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span className="text-sm leading-none">🩼</span>
                )}
                Start Draft
              </button>
            )}

            {league.status === "drafting" && (
              <Link href={`/draft/${leagueId}`} className="btn-primary text-sm py-1.5 px-3">
                <span className="text-sm leading-none">🩼</span>
                Enter Draft Room
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        }
      />

      <div className="p-4 md:p-6 max-w-5xl space-y-5">
        {/* "Waiting for teams" banner — shown when not yet full */}
        {league.status === "upcoming" && !isFull && (
          <div className="rounded-card p-3 flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20">
            <Users className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-400 font-semibold">
              Waiting for {spotsLeft} more team{spotsLeft === 1 ? "" : "s"} to join before the draft can start.
            </p>
          </div>
        )}

        {/* Scheduled draft countdown banner */}
        {league.status === "upcoming" && league.draftScheduledAt && (
          <ScheduledDraftBanner draftScheduledAt={league.draftScheduledAt} leagueId={leagueId} />
        )}

        {/* Commissioner decision banner: public league hit max delays */}
        {isCommissioner && league.isPublic && league.status === "upcoming" && league.delayCount >= 3 && !isFull && (
          <div className="rounded-card p-4 bg-red-500/10 border border-red-500/30 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-extrabold text-red-300">Action required — max auto-delays reached</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Your league has been auto-delayed 3 times and still has {league._count.members}/{league.maxTeams} teams.
                  Choose how to proceed:
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleForceStart}
                disabled={forceStarting}
                className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                {forceStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Start with {league._count.members} teams
              </button>
              <Link href={`/leagues/${leagueId}?delete=1`} className="btn-secondary text-sm py-1.5 px-3 text-red-400 hover:text-red-300">
                Cancel League
              </Link>
            </div>
          </div>
        )}

        {/* League info cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Status", value: <span className={`badge ${statusColors[league.status]}`}>{league.status}</span> },
            { label: "Visibility", value: league.isPublic ? <span className="flex items-center gap-1 text-blue-400"><Globe className="w-3 h-3" />Public</span> : <span className="flex items-center gap-1 text-[var(--text-muted)]"><Lock className="w-3 h-3" />Private</span> },
            { label: "Draft Format", value: league.draftFormat === "snake" ? "Snake" : "Auction" },
            { label: "Roster Size", value: `${league.rosterSize} players` },
          ].map((item) => (
            <div key={item.label} className="card-2 text-center">
              <p className="text-xs text-[var(--text-muted)] mb-1">{item.label}</p>
              <div className="text-sm font-extrabold text-[var(--text-primary)]">{item.value}</div>
            </div>
          ))}
        </div>

        {/* Standings table */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">Standings</h2>
          </div>

          {rosters.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-sm text-[var(--text-muted)]">Waiting for teams to join...</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Share invite code{" "}
                <span className="font-extrabold text-brand-red">{league.inviteCode}</span>{" "}
                with friends
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Team</th>
                  <th className="hidden sm:table-cell text-right">This Week</th>
                  <th className="text-right">Total IL Days</th>
                  <th className="hidden sm:table-cell text-right">Active IL</th>
                </tr>
              </thead>
              <tbody>
                {rosters.map((roster, idx) => {
                  const rank = idx + 1;
                  const ilOnRoster = roster.players.filter(
                    (p) => p.mlbPlayer.currentIlStatus !== "active"
                  ).length;
                  return (
                    <tr
                      key={roster.id}
                      className="cursor-pointer"
                      onClick={() => setActiveRoster(activeRoster === roster.id ? null : roster.id)}
                    >
                      <td className="w-8">
                        <span
                          className={`text-sm font-extrabold ${
                            rank === 1 ? "text-amber-500"
                            : rank === 2 ? "text-[var(--text-secondary)]"
                            : rank === 3 ? "text-amber-700"
                            : "text-[var(--text-muted)]"
                          }`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-xs font-extrabold text-brand-red">
                            {(roster.teamName ?? roster.user.username)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            {roster.id === myRosterId && editingTeamName ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={teamNameInput}
                                  onChange={(e) => setTeamNameInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") saveTeamName(); if (e.key === "Escape") setEditingTeamName(false); }}
                                  maxLength={40}
                                  placeholder={roster.user.username}
                                  className="input-base h-7 text-xs px-2 w-32"
                                />
                                <button onClick={saveTeamName} disabled={savingTeamName} className="text-green-400 hover:text-green-300 shrink-0">
                                  {savingTeamName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => setEditingTeamName(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                  {roster.teamName ?? roster.user.username}
                                  {league.commissionerId === roster.userId && (
                                    <span className="ml-1 text-xs text-[var(--text-muted)]">(C)</span>
                                  )}
                                </p>
                                {roster.id === myRosterId && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setTeamNameInput(roster.teamName ?? ""); setEditingTeamName(true); }}
                                    className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                                    title="Rename team"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-[var(--text-muted)]">
                              {roster.teamName ? `@${roster.user.username} · ` : ""}{roster.players.length}/{league.rosterSize} drafted
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell text-right">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {roster.weeklyIlDays}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="text-sm font-extrabold text-brand-red">
                          {formatNumber(roster.totalIlDays)}d
                        </span>
                      </td>
                      <td className="hidden sm:table-cell text-right">
                        <span className={`text-sm font-semibold ${ilOnRoster > 0 ? "text-brand-red" : "text-[var(--text-muted)]"}`}>
                          {ilOnRoster}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Expanded roster view */}
        {activeRoster && (() => {
          const roster = rosters.find((r) => r.id === activeRoster);
          if (!roster) return null;
          return (
            <div className="card">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] mb-3">
                {roster.teamName ?? roster.user.username}&apos;s Roster
                {roster.teamName && (
                  <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">
                    @{roster.user.username}
                  </span>
                )}
              </h3>
              {roster.players.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">No players drafted yet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {roster.players.map((rp) => (
                    <div
                      key={rp.mlbPlayerId}
                      className="flex items-center justify-between p-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]"
                    >
                      <div>
                        <button
                          onClick={() => openPlayerCard(rp.mlbPlayerId)}
                          className="text-xs font-semibold text-[var(--text-primary)] hover:text-brand-red transition-colors text-left"
                        >
                          {rp.mlbPlayer.fullName}
                        </button>
                        <p className="text-xs text-[var(--text-muted)]">{rp.mlbPlayer.teamAbbr}</p>
                      </div>
                      <div className="text-right">
                        <span className={`badge text-xs ${rp.mlbPlayer.currentIlStatus !== "active" ? "badge-red" : "badge-green"}`}>
                          {formatIlStatus(rp.mlbPlayer.currentIlStatus)}
                        </span>
                        <p className="text-xs text-brand-red font-semibold mt-0.5">
                          {rp.mlbPlayer.seasonIlDays}d
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Invite by Email Modal */}
      {showInviteModal && league && (
        <InviteByEmailModal
          leagueId={league.id}
          leagueName={league.name}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && league && (
        <LeagueSettingsModal
          league={league}
          currentMemberCount={league._count.members}
          onClose={() => setShowSettings(false)}
          onSaved={(updated) => {
            setLeague((prev) => prev ? { ...prev, ...updated } : prev);
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDateString(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeSlot(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = d.getMinutes() < 30 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}

/** Every half-hour slot across a 24-hour day */
const TIME_SLOTS: { value: string; label: string }[] = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const period = h < 12 ? "AM" : "PM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
      slots.push({ value, label });
    }
  }
  return slots;
})();

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Starting soon…";
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// ─── Scheduled Draft Banner ───────────────────────────────────────────────────

function ScheduledDraftBanner({
  draftScheduledAt,
  leagueId,
}: {
  draftScheduledAt: string;
  leagueId: string;
}) {
  const [timeLeft, setTimeLeft] = useState<number>(
    Math.max(0, new Date(draftScheduledAt).getTime() - Date.now())
  );

  useEffect(() => {
    const update = () =>
      setTimeLeft(Math.max(0, new Date(draftScheduledAt).getTime() - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [draftScheduledAt]);

  const scheduled = new Date(draftScheduledAt);
  const formattedDate = scheduled.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = scheduled.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const tzAbbr = Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(scheduled)
    .find((p) => p.type === "timeZoneName")?.value ?? "";

  const isImminent = timeLeft <= 5 * 60 * 1000; // within 5 minutes

  return (
    <div
      className={cn(
        "rounded-card p-3 flex items-center gap-2.5 border",
        isImminent
          ? "bg-amber-500/10 border-amber-500/30"
          : "bg-blue-500/10 border-blue-500/20"
      )}
    >
      <Calendar
        className={cn("w-4 h-4 shrink-0", isImminent ? "text-amber-400" : "text-blue-400")}
      />
      <div className="flex-1 min-w-0">
        {isImminent ? (
          <>
            <p className="text-sm text-amber-300 font-semibold">
              Draft starting in{" "}
              <span className="font-extrabold">{formatCountdown(timeLeft)}</span>
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              The draft room is now open — get in there!
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-blue-300 font-semibold">
              Draft scheduled for {formattedDate} at {formattedTime}{" "}
              <span className="font-normal opacity-70">{tzAbbr}</span>
            </p>
            <p className="text-xs text-blue-400/70 mt-0.5">
              Draft room opens 5 min before · starts in{" "}
              <span className="font-extrabold text-blue-300">{formatCountdown(timeLeft)}</span>
            </p>
          </>
        )}
      </div>
      {isImminent ? (
        <Link
          href={`/draft/${leagueId}`}
          className="flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 transition-colors px-2.5 py-1.5 rounded-[8px] text-xs font-extrabold text-amber-300 shrink-0"
        >
          Enter Draft Room
          <ArrowRight className="w-3 h-3" />
        </Link>
      ) : (
        <Clock className="w-4 h-4 text-blue-400/60 shrink-0" />
      )}
    </div>
  );
}

// ─── League Settings Modal ────────────────────────────────────────────────────

function LeagueSettingsModal({
  league,
  currentMemberCount,
  onClose,
  onSaved,
}: {
  league: LeagueDetail;
  currentMemberCount: number;
  onClose: () => void;
  onSaved: (updated: Partial<LeagueDetail>) => void;
}) {
  const [maxTeams, setMaxTeams] = useState(league.maxTeams);
  const [scheduledDate, setScheduledDate] = useState<string>(
    league.draftScheduledAt ? toLocalDateString(league.draftScheduledAt) : ""
  );
  const [scheduledTime, setScheduledTime] = useState<string>(
    league.draftScheduledAt ? toLocalTimeSlot(league.draftScheduledAt) : "12:00"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/leagues/${league.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/leagues");
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to delete league");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const originalDate = league.draftScheduledAt ? toLocalDateString(league.draftScheduledAt) : "";
  const originalTime = league.draftScheduledAt ? toLocalTimeSlot(league.draftScheduledAt) : "12:00";

  const handleSave = async () => {
    const maxTeamsChanged = maxTeams !== league.maxTeams;
    const schedChanged = scheduledDate !== originalDate || scheduledTime !== originalTime;
    if (!maxTeamsChanged && !schedChanged) { onClose(); return; }

    setLoading(true);
    setError(null);

    const patchBody: Record<string, unknown> = {};
    if (maxTeamsChanged) patchBody.maxTeams = maxTeams;
    if (schedChanged) {
      patchBody.draftScheduledAt = scheduledDate
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : null;
    }

    const res = await fetch(`/api/leagues/${league.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to save settings");
      setLoading(false);
      return;
    }

    onSaved({
      maxTeams: data.league.maxTeams,
      _count: data.league._count,
      draftScheduledAt: data.league.draftScheduledAt ?? null,
    });
  };

  // Min date = today
  const minDate = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-extrabold text-[var(--text-primary)]">League Settings</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Max Teams */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Max Teams</label>
            <div className="grid grid-cols-3 gap-2">
              {[4, 6, 8].map((n) => {
                const tooSmall = n < currentMemberCount;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={tooSmall}
                    onClick={() => !tooSmall && setMaxTeams(n)}
                    className={cn(
                      "py-2.5 rounded-input text-sm font-extrabold border transition-colors",
                      maxTeams === n
                        ? "bg-brand-red text-white border-brand-red"
                        : tooSmall
                        ? "opacity-30 cursor-not-allowed bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]"
                        : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]"
                    )}
                    title={tooSmall ? `Can't go below current ${currentMemberCount} members` : `${n} teams`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {currentMemberCount} of {maxTeams} spots filled
            </p>
          </div>

          {/* Schedule Draft */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Schedule Draft
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={scheduledDate}
                min={minDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                className="input-base flex-1 text-sm cursor-pointer"
              />
              <select
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="input-base text-sm w-32 shrink-0"
                style={{ colorScheme: "dark" }}
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>{slot.label}</option>
                ))}
              </select>
              {scheduledDate && (
                <button
                  type="button"
                  onClick={() => setScheduledDate("")}
                  className="w-9 h-9 flex items-center justify-center rounded-input bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                  title="Clear schedule"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {(() => {
              const tzAbbr = Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
                .formatToParts(new Date())
                .find((p) => p.type === "timeZoneName")?.value ?? "";
              return (
                <p className="text-xs text-[var(--text-muted)]">
                  Draft room opens 5 min before.{" "}
                  <span className="text-[var(--text-secondary)]">Time is in {tzAbbr}.</span>
                </p>
              );
            })()}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-input bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-brand-red shrink-0" />
            <p className="text-xs text-brand-red">{error}</p>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="btn-primary flex-1 justify-center"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </button>
        </div>

        {/* Danger zone */}
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-input text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete League
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-center text-[var(--text-muted)]">
                Are you sure? This will permanently delete <strong className="text-[var(--text-primary)]">{league.name}</strong> and all its data.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="btn-secondary flex-1 justify-center text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-input text-sm font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Invite by Email Modal ─────────────────────────────────────────────────────

interface PendingInvite {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

function InviteByEmailModal({
  leagueId,
  leagueName,
  onClose,
}: {
  leagueId: string;
  leagueName: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (inviteId: string) => {
    setCancellingId(inviteId);
    const res = await fetch(`/api/leagues/${leagueId}/invite`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
    if (res.ok) {
      setPendingInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    }
    setCancellingId(null);
  };

  const loadInvites = async () => {
    const res = await fetch(`/api/leagues/${leagueId}/invite`);
    if (res.ok) {
      const data = await res.json();
      setPendingInvites(data.invites ?? []);
    }
    setLoadingInvites(false);
  };

  useEffect(() => { loadInvites(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(null);

    const res = await fetch(`/api/leagues/${leagueId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to send invite");
    } else {
      setSuccess(
        data.existingUser
          ? `Invite sent to ${email} — they'll get a link to accept.`
          : `Invite sent to ${email} — they'll get a link to create an account and join.`
      );
      setEmail("");
      loadInvites();
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-extrabold text-[var(--text-primary)]">
              Invite by Email
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{leagueName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Send invite form */}
        <form onSubmit={handleSend} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@example.com"
                required
                className="input-base pl-9"
              />
            </div>
            <button
              type="submit"
              disabled={sending || !email}
              className="btn-primary px-3 shrink-0"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          {success && (
            <div className="flex items-start gap-2 p-3 rounded-input bg-green-500/10 border border-green-500/20">
              <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <p className="text-xs text-green-400">{success}</p>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-input bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-brand-red shrink-0" />
              <p className="text-xs text-brand-red">{error}</p>
            </div>
          )}
        </form>

        {/* Pending invites list */}
        {(loadingInvites || pendingInvites.length > 0) && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">
              Pending Invites
            </p>
            {loadingInvites ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : (
              pendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {inv.email}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="badge badge-amber">Pending</span>
                    <button
                      onClick={() => handleCancel(inv.id)}
                      disabled={cancellingId === inv.id}
                      className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[var(--text-muted)] hover:text-brand-red hover:bg-red-500/10 transition-colors"
                      title="Cancel invite"
                    >
                      {cancellingId === inv.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="btn-secondary w-full justify-center mt-5"
        >
          Done
        </button>
      </div>
    </div>
  );
}
