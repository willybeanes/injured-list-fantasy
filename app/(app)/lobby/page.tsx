"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Users, Clock, Swords, Globe, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface LobbyLeague {
  id: string;
  name: string;
  commissionerUsername: string;
  maxTeams: number;
  memberCount: number;
  draftFormat: string;
  pickTimerSeconds: number;
  draftScheduledAt: string | null;
  delayCount: number;
  isFull: boolean;
  isJoined: boolean;
}

function formatDraftTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    + " at "
    + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function LobbyPage() {
  const [leagues, setLeagues] = useState<LobbyLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchLeagues = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lobby");
      const data = await res.json();
      setLeagues(data.leagues ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeagues(); }, []);

  const handleJoin = async (league: LobbyLeague) => {
    setJoiningId(league.id);
    setErrors((e) => ({ ...e, [league.id]: "" }));
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: league.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [league.id]: data.error ?? "Failed to join" }));
      } else {
        setJoinedIds((s) => { const n = new Set(s); n.add(league.id); return n; });
      }
    } catch {
      setErrors((e) => ({ ...e, [league.id]: "Something went wrong" }));
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div>
      <Topbar
        title="Public Lobby"
        subtitle="Join an open league"
        actions={
          <button
            onClick={fetchLeagues}
            disabled={loading}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
      />

      <div className="p-4 sm:p-6 max-w-4xl space-y-4">
        {/* Header blurb */}
        <div className="flex items-start gap-3 card p-4">
          <Globe className="w-5 h-5 text-brand-red shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">How public leagues work</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Anyone can join. If a league isn&apos;t full when draft time arrives, the draft auto-delays
              by 24 hours (up to 3 times) to give more teams time to join.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : leagues.length === 0 ? (
          <div className="card text-center py-16">
            <Globe className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-[var(--text-primary)]">No public leagues open right now</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Create your own league and set it to Public to appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leagues.map((league) => {
              const isJoined = league.isJoined || joinedIds.has(league.id);
              const spotsLeft = league.maxTeams - league.memberCount;
              const isDelayed = league.delayCount > 0;

              return (
                <div key={league.id} className="card p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* League name + badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-[var(--text-primary)] text-base truncate">
                          {league.name}
                        </h3>
                        {isDelayed && (
                          <span className="badge badge-amber text-[10px]">
                            ⏰ Delayed ×{league.delayCount}
                          </span>
                        )}
                        {league.isFull && (
                          <span className="badge badge-muted text-[10px]">Full</span>
                        )}
                      </div>

                      {/* Commissioner */}
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        by @{league.commissionerUsername}
                      </p>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                          <Users className="w-3.5 h-3.5" />
                          <span className={cn("font-semibold", spotsLeft <= 1 && !league.isFull && "text-amber-400")}>
                            {league.memberCount}/{league.maxTeams} teams
                          </span>
                          {!league.isFull && (
                            <span className="text-[var(--text-muted)]">
                              · {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                          <Swords className="w-3.5 h-3.5" />
                          <span>Snake draft · {league.pickTimerSeconds}s</span>
                        </div>
                        {league.draftScheduledAt && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatDraftTime(league.draftScheduledAt)}</span>
                          </div>
                        )}
                      </div>

                      {errors[league.id] && (
                        <p className="text-xs text-red-400 mt-2">{errors[league.id]}</p>
                      )}
                    </div>

                    {/* Join / Joined button */}
                    <div className="shrink-0">
                      {isJoined ? (
                        <span className="badge badge-green text-xs px-3 py-1.5">✓ Joined</span>
                      ) : league.isFull ? (
                        <span className="text-xs text-[var(--text-muted)] font-medium">Full</span>
                      ) : (
                        <button
                          onClick={() => handleJoin(league)}
                          disabled={joiningId === league.id}
                          className="btn-primary text-sm py-1.5 px-4"
                        >
                          {joiningId === league.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : "Join"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
