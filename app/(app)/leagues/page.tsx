"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import {
  Plus,
  Users,
  ArrowRight,
  Copy,
  Check,
  Loader2,
  X,
  AlertCircle,
  Info,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
          <div className="flex gap-2">
            <button
              onClick={() => setShowJoin(true)}
              className="btn-secondary text-sm py-1.5 px-3"
            >
              Join League
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary text-sm py-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              Create League
            </button>
          </div>
        }
      />

      <div className="p-6 max-w-4xl space-y-4">
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
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
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

                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {/* Invite code + tooltip */}
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

// ─── Create League Modal ─────────────────────────────────────────────────────

function CreateLeagueModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (league: League) => void;
}) {
  const [name, setName] = useState("");
  const [maxTeams, setMaxTeams] = useState(10);
  const draftFormat = "snake";
  const scoringType = "season_total";
  const [pickTimerSeconds, setPickTimerSeconds] = useState(90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, maxTeams, draftFormat, scoringType, pickTimerSeconds }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create league");
      setLoading(false);
      return;
    }

    onCreated(data.league);
  };

  return (
    <Modal title="Create League" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            League Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="The Broken Bones Bowl"
            maxLength={50}
            className="input-base"
          />
        </div>

        {/* Max Teams — fixed options */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Max Teams
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 15].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxTeams(n)}
                className={cn(
                  "py-2 rounded-input text-sm font-extrabold border transition-colors",
                  maxTeams === n
                    ? "bg-brand-red text-white border-brand-red"
                    : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Pick Timer */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Time Per Pick
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[45, 60, 90].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPickTimerSeconds(s)}
                className={cn(
                  "py-2 rounded-input text-sm font-extrabold border transition-colors",
                  pickTimerSeconds === s
                    ? "bg-brand-red text-white border-brand-red"
                    : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]"
                )}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Draft Format</p>
            <p className="text-sm text-[var(--text-primary)]">Snake Draft</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Scoring</p>
            <p className="text-sm text-[var(--text-primary)]">Cumulative IL Days</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-input bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-brand-red shrink-0" />
            <p className="text-xs text-brand-red">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1 justify-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1 justify-center"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create League"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Join League Modal ─────────────────────────────────────────────────────

function JoinLeagueModal({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (league: League) => void;
}) {
  const [code, setCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/leagues/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: code.toUpperCase().trim(), teamName: teamName.trim() || undefined }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to join league");
      setLoading(false);
      return;
    }

    onJoined(data.league);
  };

  return (
    <Modal title="Join League" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Invite Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            required
            placeholder="BONE42"
            maxLength={6}
            className="input-base text-center text-lg font-extrabold tracking-[0.15em] uppercase"
          />
          <p className="text-xs text-[var(--text-muted)]">
            Enter the 6-character code shared by your league commissioner.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Team Name <span className="text-[var(--text-muted)] font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. The Broken Bones"
            maxLength={40}
            className="input-base"
          />
          <p className="text-xs text-[var(--text-muted)]">
            Shown in standings. You can change this later.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-input bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-brand-red shrink-0" />
            <p className="text-xs text-brand-red">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button type="submit" disabled={loading || code.length !== 6} className="btn-primary flex-1 justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join League"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal wrapper ─────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md relative">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-extrabold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
