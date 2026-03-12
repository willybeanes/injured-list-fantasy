"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { ArrowRight, Copy, Check, Loader2, Info, Calendar, Users, Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CreateLeagueModal, JoinLeagueModal } from "@/components/league/LeagueModals";

interface League {
  id: string;
  name: string;
  status: string;
  maxTeams: number;
  rosterSize: number;
  draftFormat: string;
  inviteCode: string;
  seasonYear: number;
  draftScheduledAt: string | null;
  _count: { members: number };
  isCommissioner: boolean;
}

/** Format a scheduled draft ISO string as "Sun, Mar 10 at 7:00 PM EST" */
function formatScheduledDraftTime(isoString: string): string {
  const d = new Date(isoString);
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const tz = Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${date} at ${time} ${tz}`;
}

export default function LeaguesPage() {
  const searchParams = useSearchParams();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const didAutoOpen = useRef(false);

  // Auto-open modals from URL params (e.g. from Dashboard buttons)
  useEffect(() => {
    if (didAutoOpen.current) return;
    didAutoOpen.current = true;
    if (searchParams.get("create") === "1") setShowCreate(true);
    if (searchParams.get("join") === "1") setShowJoin(true);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/leagues")
      .then((r) => r.json())
      .then((d) => {
        setLeagues(d.leagues ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      upcoming: "badge-muted",
      drafting: "badge-amber",
      active: "badge-green",
      completed: "badge-red",
    };
    return `badge ${map[status] ?? "badge-muted"}`;
  };

  return (
    <div>
      <Topbar
        title="My Leagues"
        subtitle={`${leagues.length} league${leagues.length === 1 ? "" : "s"}`}
        actions={
          <>
            <button onClick={() => setShowJoin(true)} className="btn-secondary text-sm py-1.5 px-3">
              Join League
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" />
              Create League
            </button>
          </>
        }
      />

      <div className="p-4 sm:p-6 max-w-4xl space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : leagues.length === 0 ? (
          <div className="card text-center py-16">
            <Users className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="font-extrabold text-[var(--text-primary)] mb-1">
              No leagues yet
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              Create a league or join one with an invite code.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowJoin(true)}
                className="btn-secondary"
              >
                Join with Code
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary"
              >
                <Plus className="w-3.5 h-3.5" />
                Create League
              </button>
            </div>
          </div>
        ) : (
          leagues.map((league) => (
            <div key={league.id} className="card hover:border-[var(--border-2)] transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link
                      href={league.status === "drafting" ? `/draft/${league.id}` : `/leagues/${league.id}`}
                      className="text-base font-extrabold text-[var(--text-primary)] hover:text-brand-red transition-colors truncate"
                    >
                      {league.name}
                    </Link>
                    <span className={statusBadge(league.status)}>
                      {league.status}
                    </span>
                    {league.isCommissioner && (
                      <span className="badge badge-amber">Commissioner</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {league._count.members}/{league.maxTeams} teams ·{" "}
                    {league.rosterSize} roster spots ·{" "}
                    {league.draftFormat === "snake" ? "Snake" : "Auction"} draft ·{" "}
                    {league.seasonYear} season
                  </p>
                  {league.status === "upcoming" && league.draftScheduledAt && (
                    <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 shrink-0" />
                      Draft: {formatScheduledDraftTime(league.draftScheduledAt)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Invite code + tooltip — only while filling up */}
                  {league.status === "upcoming" && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => copyCode(league.inviteCode)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-xs font-semibold transition-colors",
                          "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
                        )}
                        title="Copy invite code"
                      >
                        {copiedCode === league.inviteCode ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
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

                  {league.status === "drafting" && (
                    <Link
                      href={`/draft/${league.id}`}
                      className="btn-primary text-sm py-1.5 px-3 animate-pulse bg-brand-red"
                    >
                      <span className="text-sm leading-none">🩼</span>
                      Drafting Now!
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create League Modal */}
      {showCreate && (
        <CreateLeagueModal
          onClose={() => setShowCreate(false)}
          onCreated={(league) => {
            setLeagues((prev) => [{ ...league, isCommissioner: true }, ...prev]);
            setShowCreate(false);
          }}
        />
      )}

      {/* Join League Modal */}
      {showJoin && (
        <JoinLeagueModal
          onClose={() => setShowJoin(false)}
          onJoined={(league) => {
            setLeagues((prev) => [{ ...league, isCommissioner: false }, ...prev]);
            setShowJoin(false);
          }}
        />
      )}
    </div>
  );
}
