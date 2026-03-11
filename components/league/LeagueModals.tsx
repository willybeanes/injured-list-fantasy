"use client";

import { useState } from "react";
import { Loader2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Minimal league shape returned by both modals
export interface CreatedLeague {
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
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

export function Modal({
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
          <h2 className="text-base font-extrabold text-[var(--text-primary)]">{title}</h2>
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

// ─── Create League Modal ──────────────────────────────────────────────────────

export function CreateLeagueModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (league: CreatedLeague) => void;
}) {
  const [name, setName] = useState("");
  const [maxTeams, setMaxTeams] = useState(8);
  const draftFormat = "snake";
  const scoringType = "season_total";
  const [pickTimerSeconds, setPickTimerSeconds] = useState(90);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, maxTeams, draftFormat, scoringType, pickTimerSeconds, isPublic }),
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
          <label className="text-xs font-semibold text-[var(--text-secondary)]">League Name</label>
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

        {/* Max Teams */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">Max Teams</label>
          <div className="grid grid-cols-3 gap-2">
            {[4, 6, 8].map((n) => (
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
          <label className="text-xs font-semibold text-[var(--text-secondary)]">Time Per Pick</label>
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

        {/* Visibility */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">League Visibility</label>
          <div className="grid grid-cols-2 gap-2">
            {([false, true] as const).map((pub) => (
              <button
                key={String(pub)}
                type="button"
                onClick={() => setIsPublic(pub)}
                className={cn(
                  "py-2.5 rounded-input text-sm font-extrabold border transition-colors flex flex-col items-center gap-0.5",
                  isPublic === pub
                    ? "bg-brand-red text-white border-brand-red"
                    : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]"
                )}
              >
                {pub ? "🌐 Public" : "🔒 Private"}
                <span className={cn("text-[10px] font-medium", isPublic === pub ? "text-white/70" : "text-[var(--text-muted)]")}>
                  {pub ? "Appears in lobby" : "Invite code only"}
                </span>
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
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create League"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Join League Modal ────────────────────────────────────────────────────────

export function JoinLeagueModal({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (league: CreatedLeague) => void;
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
          <label className="text-xs font-semibold text-[var(--text-secondary)]">Invite Code</label>
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
          <p className="text-xs text-[var(--text-muted)]">Shown in standings. You can change this later.</p>
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
