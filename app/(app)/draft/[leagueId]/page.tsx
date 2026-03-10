"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import {
  Search,
  Clock,
  Users,
  Activity,
  Trophy,
  Loader2,
  CheckCircle,
  AlertCircle,
  Zap,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, healthGrade, GRADE_STYLES } from "@/lib/utils";
import { usePlayerCard } from "@/components/player/PlayerCardContext";

interface MlbPlayer {
  id: number;
  fullName: string;
  teamName: string | null;
  teamAbbr: string | null;
  position: string | null;
  currentIlStatus: string;
  seasonIlDays: number;
  careerIlDays: number;
  careerSeasons: number;
  age: number | null;
  birthDate: string | null;
}

interface DraftPick {
  pickNumber: number;
  round: number;
  teamIndex: number;
  userId: string;
  username: string;
  mlbPlayerId: number | null;
  playerName: string | null;
}

interface DraftState {
  leagueName: string;
  leagueId: string;
  status: string;
  rosterSize: number;
  pickTimerSeconds: number;
  teams: Array<{ userId: string; username: string }>;
  myUserId: string;
  myTeamIndex: number;
  currentPickNumber: number;
  currentTeamIndex: number;
  draftedPlayerIds: Set<number>;
  picks: DraftPick[];
}

// healthGrade and GRADE_STYLES imported from @/lib/utils

const PAGE_SIZE = 60;

function SortIcon({
  col,
  sortColumn,
  sortDir,
}: {
  col: string;
  sortColumn: string;
  sortDir: "asc" | "desc";
}) {
  if (sortColumn !== col)
    return (
      <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 shrink-0 transition-opacity" />
    );
  return sortDir === "desc" ? (
    <ChevronDown className="w-3 h-3 text-brand-red shrink-0" />
  ) : (
    <ChevronUp className="w-3 h-3 text-brand-red shrink-0" />
  );
}

export default function DraftRoomPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [players, setPlayers] = useState<MlbPlayer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [makingPick, setMakingPick] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(90);
  const [autoPickMsg, setAutoPickMsg] = useState<string | null>(null);

  // Mobile tab ("players" | "board")
  const [mobileTab, setMobileTab] = useState<"players" | "board">("players");

  // Sort
  const [sortColumn, setSortColumn] = useState("careerIlDays");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(0);

  // Filters
  const [filterTeam, setFilterTeam] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterAgeMin, setFilterAgeMin] = useState("");
  const [filterAgeMax, setFilterAgeMax] = useState("");
  const [filterGrades, setFilterGrades] = useState<Set<string>>(new Set());

  const { openPlayerCard } = usePlayerCard();
  const supabase = createClient();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoPickTriggeredRef = useRef(false);

  // Load draft state
  const loadDraftState = useCallback(async () => {
    const res = await fetch(`/api/draft/${leagueId}`);
    if (!res.ok) return;
    const data = await res.json();
    setDraftState(() => {
      const draftedIds = new Set<number>(
        data.picks
          .filter((p: DraftPick) => p.mlbPlayerId !== null)
          .map((p: DraftPick) => p.mlbPlayerId as number)
      );
      return {
        ...data.league,
        myUserId: data.myUserId,
        myTeamIndex: data.myTeamIndex,
        picks: data.picks,
        currentPickNumber: data.currentPickNumber,
        currentTeamIndex: data.currentTeamIndex,
        draftedPlayerIds: draftedIds,
      };
    });
  }, [leagueId]);

  // Load player pool (active players only)
  const loadPlayers = useCallback(async () => {
    const res = await fetch(`/api/draft/${leagueId}/players`);
    if (!res.ok) return;
    const data = await res.json();
    setPlayers(data.players ?? []);
  }, [leagueId]);

  useEffect(() => {
    Promise.all([loadDraftState(), loadPlayers()]).then(() => setLoading(false));
  }, [loadDraftState, loadPlayers]);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`draft:${leagueId}`)
      .on("broadcast", { event: "pick_made" }, () => {
        loadDraftState();
        loadPlayers();
        autoPickTriggeredRef.current = false;
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, loadDraftState, loadPlayers, supabase]);

  // Pick timer — resets on each pick
  useEffect(() => {
    if (!draftState || draftState.status !== "drafting") return;

    const timerDuration = draftState.pickTimerSeconds ?? 90;
    autoPickTriggeredRef.current = false;

    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(timerDuration);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftState?.currentPickNumber]);

  // Auto-pick when timer hits 0
  useEffect(() => {
    if (timeLeft !== 0) return;
    if (!draftState || draftState.status !== "drafting") return;
    if (autoPickTriggeredRef.current) return;

    autoPickTriggeredRef.current = true;

    const trigger = async () => {
      const res = await fetch(`/api/draft/${leagueId}/auto-pick`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.autoPicked) {
        const msg = `⚡ Auto-picked ${data.player.fullName}`;
        setAutoPickMsg(msg);
        setTimeout(() => setAutoPickMsg(null), 4000);

        await supabase.channel(`draft:${leagueId}`).send({
          type: "broadcast",
          event: "pick_made",
          payload: { playerId: data.player.id, autoPicked: true },
        });

        await loadDraftState();
        await loadPlayers();
      }
    };

    trigger();
  }, [timeLeft, draftState, leagueId, loadDraftState, loadPlayers, supabase]);

  const makePick = async (playerId: number) => {
    if (!draftState) return;
    if (draftState.currentTeamIndex !== draftState.myTeamIndex) return;
    if (makingPick) return;

    setMakingPick(true);
    setPickError(null);

    const res = await fetch(`/api/draft/${leagueId}/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mlbPlayerId: playerId }),
    });

    const data = await res.json();
    if (!res.ok) {
      setPickError(data.error ?? "Failed to make pick");
      setMakingPick(false);
      return;
    }

    await supabase.channel(`draft:${leagueId}`).send({
      type: "broadcast",
      event: "pick_made",
      payload: { playerId },
    });

    await loadDraftState();
    await loadPlayers();
    setMakingPick(false);
  };

  // ── Derived filter options ────────────────────────────────────────────────────
  const availableTeams = useMemo(
    () =>
      Array.from(new Set(players.map((p) => p.teamAbbr).filter(Boolean))).sort() as string[],
    [players]
  );

  const availablePositions = useMemo(
    () =>
      Array.from(new Set(players.map((p) => p.position).filter(Boolean))).sort() as string[],
    [players]
  );

  // ── Filtered + sorted players ─────────────────────────────────────────────────
  const displayPlayers = useMemo(() => {
    let result = players.filter((p) => !draftState?.draftedPlayerIds.has(p.id));

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.teamAbbr?.toLowerCase().includes(q) ||
          p.position?.toLowerCase().includes(q)
      );
    }

    // Team filter
    if (filterTeam) result = result.filter((p) => p.teamAbbr === filterTeam);

    // Position filter
    if (filterPosition) result = result.filter((p) => p.position === filterPosition);

    // Age range
    const ageMin = filterAgeMin !== "" ? Number(filterAgeMin) : null;
    const ageMax = filterAgeMax !== "" ? Number(filterAgeMax) : null;
    if (ageMin !== null) result = result.filter((p) => p.age != null && p.age >= ageMin);
    if (ageMax !== null) result = result.filter((p) => p.age != null && p.age <= ageMax);

    // Grade filter
    if (filterGrades.size > 0) {
      result = result.filter((p) =>
        filterGrades.has(healthGrade(p.careerIlDays, p.careerSeasons).grade)
      );
    }

    // Sort
    const GRADE_ORDER: Record<string, number> = { F: 5, D: 4, C: 3, B: 2, A: 1 };
    result = [...result].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortColumn) {
        case "fullName":
          aVal = a.fullName;
          bVal = b.fullName;
          break;
        case "teamAbbr":
          aVal = a.teamAbbr ?? "";
          bVal = b.teamAbbr ?? "";
          break;
        case "position":
          aVal = a.position ?? "";
          bVal = b.position ?? "";
          break;
        case "age":
          aVal = a.age ?? 0;
          bVal = b.age ?? 0;
          break;
        case "careerIlDays":
          aVal = a.careerIlDays;
          bVal = b.careerIlDays;
          break;
        case "ilPerSeason":
          aVal = a.careerIlDays / Math.max(1, a.careerSeasons);
          bVal = b.careerIlDays / Math.max(1, b.careerSeasons);
          break;
        case "grade":
          aVal = GRADE_ORDER[healthGrade(a.careerIlDays, a.careerSeasons).grade] ?? 0;
          bVal = GRADE_ORDER[healthGrade(b.careerIlDays, b.careerSeasons).grade] ?? 0;
          break;
      }

      if (typeof aVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [
    players,
    draftState,
    search,
    filterTeam,
    filterPosition,
    filterAgeMin,
    filterAgeMax,
    filterGrades,
    sortColumn,
    sortDir,
  ]);

  // Reset to page 1 when filters or sort column changes
  useEffect(() => {
    setPage(0);
  }, [search, filterTeam, filterPosition, filterAgeMin, filterAgeMax, filterGrades, sortColumn]);

  // Paginated slice
  const totalPages = Math.ceil(displayPlayers.length / PAGE_SIZE);
  const paginatedPlayers = useMemo(
    () => displayPlayers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [displayPlayers, page]
  );

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      // Default direction: asc for text columns, desc for numeric
      setSortDir(["fullName", "teamAbbr", "position"].includes(col) ? "asc" : "desc");
    }
  };

  const toggleGrade = (grade: string) => {
    setFilterGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) { next.delete(grade); } else { next.add(grade); }
      return next;
    });
  };

  const clearFilters = () => {
    setFilterTeam("");
    setFilterPosition("");
    setFilterAgeMin("");
    setFilterAgeMax("");
    setFilterGrades(new Set());
  };

  const hasActiveFilters =
    !!(filterTeam || filterPosition || filterAgeMin || filterAgeMax || filterGrades.size > 0);

  // ── Render guards ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <Topbar title="Draft Room" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
        </div>
      </div>
    );
  }

  if (!draftState) {
    return (
      <div>
        <Topbar title="Draft Room" />
        <div className="p-6 text-center py-16">
          <p className="text-[var(--text-muted)]">
            Draft not found or you are not a member of this league.
          </p>
        </div>
      </div>
    );
  }

  const isMyTurn = draftState.currentTeamIndex === draftState.myTeamIndex;
  const isDraftComplete = draftState.status === "active";
  const currentTeam = draftState.teams[draftState.currentTeamIndex];
  const totalPicks = draftState.rosterSize * draftState.teams.length;
  const timerDuration = draftState.pickTimerSeconds ?? 90;
  const timerPercent = (timeLeft / timerDuration) * 100;
  const timerColor =
    timeLeft > timerDuration * 0.33
      ? "#16a34a"
      : timeLeft > timerDuration * 0.17
      ? "#d97706"
      : "#dc2f1f";

  return (
    <div>
      <Topbar
        title={`${draftState.leagueName} — Draft`}
        subtitle={
          isDraftComplete
            ? "Draft complete"
            : `Pick ${draftState.currentPickNumber} of ${totalPicks}`
        }
      />

      <div className="p-4 max-w-[1400px] mx-auto flex flex-col md:grid md:grid-cols-[1fr_280px] gap-4 h-[calc(100vh-56px-64px)] md:h-[calc(100vh-56px-1rem)] overflow-hidden">

        {/* Mobile tab switcher (hidden on desktop) */}
        <div className="flex md:hidden gap-1 rounded-[10px] bg-[var(--surface-2)] p-1 shrink-0">
          <button
            onClick={() => setMobileTab("players")}
            className={cn(
              "flex-1 py-1.5 text-xs font-extrabold rounded-[8px] transition-colors",
              mobileTab === "players"
                ? "bg-[var(--surface)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            Players
          </button>
          <button
            onClick={() => setMobileTab("board")}
            className={cn(
              "flex-1 py-1.5 text-xs font-extrabold rounded-[8px] transition-colors",
              mobileTab === "board"
                ? "bg-[var(--surface)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            Draft Board
          </button>
        </div>

        {/* ── Left: Player pool ── */}
        <div className={cn(
          "flex-1 flex flex-col gap-2 overflow-hidden",
          mobileTab === "players" ? "flex" : "hidden md:flex"
        )}>

          {/* Status banner */}
          {!isDraftComplete && (
            <div
              className={cn(
                "rounded-card p-3 flex items-center justify-between shrink-0",
                isMyTurn
                  ? "bg-brand-red/10 border border-brand-red/30"
                  : "bg-[var(--surface)] border border-[var(--border)]"
              )}
            >
              <div className="flex items-center gap-2">
                {isMyTurn ? (
                  <Activity className="w-4 h-4 text-brand-red animate-pulse" />
                ) : (
                  <Users className="w-4 h-4 text-[var(--text-muted)]" />
                )}
                <span className="text-sm font-extrabold text-[var(--text-primary)]">
                  {isMyTurn
                    ? "Your pick — choose a player!"
                    : `Waiting for ${currentTeam?.username ?? "..."} to pick`}
                </span>
              </div>

              {/* Timer */}
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8">
                  <svg className="w-8 h-8 -rotate-90">
                    <circle cx="16" cy="16" r="14" fill="none" stroke="var(--border)" strokeWidth="3" />
                    <circle
                      cx="16" cy="16" r="14"
                      fill="none"
                      stroke={timerColor}
                      strokeWidth="3"
                      strokeDasharray={`${2 * Math.PI * 14}`}
                      strokeDashoffset={`${2 * Math.PI * 14 * (1 - timerPercent / 100)}`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                  </svg>
                  <span
                    className="absolute inset-0 flex items-center justify-center text-xs font-extrabold"
                    style={{ color: timerColor }}
                  >
                    {timeLeft}
                  </span>
                </div>
                <Clock className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            </div>
          )}

          {isDraftComplete && (
            <div className="rounded-card p-3 flex items-center gap-2 bg-green-500/10 border border-green-500/30 shrink-0">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-extrabold text-green-500">
                Draft complete! The season has begun.
              </span>
            </div>
          )}

          {autoPickMsg && (
            <div className="rounded-card p-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 shrink-0">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-400">{autoPickMsg}</span>
            </div>
          )}

          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players, teams, positions…"
              className="input-base pl-9"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Team */}
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="input-base text-xs h-8 py-0 pl-2.5 pr-6 cursor-pointer !w-36"
            >
              <option value="">All Teams</option>
              {availableTeams.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Position */}
            <select
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="input-base text-xs h-8 py-0 pl-2.5 pr-6 cursor-pointer !w-32"
            >
              <option value="">All Positions</option>
              {availablePositions.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>

            {/* Age range */}
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min age"
                value={filterAgeMin}
                onChange={(e) => setFilterAgeMin(e.target.value)}
                className="input-base text-xs h-8 py-0 px-2.5 w-[72px]"
                min={18}
                max={50}
              />
              <span className="text-[var(--text-muted)] text-xs font-semibold">–</span>
              <input
                type="number"
                placeholder="Max age"
                value={filterAgeMax}
                onChange={(e) => setFilterAgeMax(e.target.value)}
                className="input-base text-xs h-8 py-0 px-2.5 w-[72px]"
                min={18}
                max={50}
              />
            </div>

            {/* Grade pills */}
            <div className="flex items-center gap-1">
              {(["F", "D", "C", "B", "A"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGrade(g)}
                  className={cn(
                    "text-xs font-extrabold w-7 h-7 rounded-full border transition-colors",
                    filterGrades.has(g)
                      ? GRADE_STYLES[g]
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-secondary)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Clear */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {pickError && (
            <div className="flex items-center gap-2 p-3 rounded-input bg-red-500/10 border border-red-500/20 shrink-0">
              <AlertCircle className="w-4 h-4 text-brand-red shrink-0" />
              <p className="text-xs text-brand-red">{pickError}</p>
            </div>
          )}

          {/* Player table */}
          <div className="flex-1 overflow-y-auto rounded-card border border-[var(--border)] bg-[var(--surface)] min-h-0">
            <table className="table-base">
              <thead className="sticky top-0 bg-[var(--surface)] z-10">
                <tr>
                  <th
                    className="group cursor-pointer hover:text-[var(--text-primary)] select-none"
                    onClick={() => handleSort("fullName")}
                  >
                    <span className="flex items-center gap-1">
                      Player
                      <SortIcon col="fullName" sortColumn={sortColumn} sortDir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="hidden sm:table-cell group cursor-pointer hover:text-[var(--text-primary)] select-none"
                    onClick={() => handleSort("teamAbbr")}
                  >
                    <span className="flex items-center gap-1">
                      Team
                      <SortIcon col="teamAbbr" sortColumn={sortColumn} sortDir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="hidden sm:table-cell group cursor-pointer hover:text-[var(--text-primary)] select-none"
                    onClick={() => handleSort("position")}
                  >
                    <span className="flex items-center gap-1">
                      Pos
                      <SortIcon col="position" sortColumn={sortColumn} sortDir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="hidden sm:table-cell text-center group cursor-pointer hover:text-[var(--text-primary)] select-none"
                    onClick={() => handleSort("age")}
                  >
                    <span className="flex items-center justify-center gap-1">
                      Age
                      <SortIcon col="age" sortColumn={sortColumn} sortDir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="text-right group cursor-pointer hover:text-[var(--text-primary)] select-none"
                    onClick={() => handleSort("careerIlDays")}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Career IL
                      <SortIcon col="careerIlDays" sortColumn={sortColumn} sortDir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="hidden sm:table-cell text-right group cursor-pointer hover:text-[var(--text-primary)] select-none"
                    onClick={() => handleSort("ilPerSeason")}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Avg / Season
                      <SortIcon col="ilPerSeason" sortColumn={sortColumn} sortDir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="text-center group cursor-pointer hover:text-[var(--text-primary)] select-none"
                    onClick={() => handleSort("grade")}
                  >
                    <span className="flex items-center justify-center gap-1">
                      Grade
                      <SortIcon col="grade" sortColumn={sortColumn} sortDir={sortDir} />
                    </span>
                  </th>
                  <th className="w-20 text-right">
                    {isMyTurn && !isDraftComplete ? "Action" : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-[var(--text-muted)]">
                      {search || hasActiveFilters
                        ? "No players match your filters"
                        : "No active players available"}
                    </td>
                  </tr>
                ) : (
                  paginatedPlayers.map((player) => {
                    const { grade, color } = healthGrade(
                      player.careerIlDays,
                      player.careerSeasons
                    );
                    const avg = player.careerIlDays / Math.max(1, player.careerSeasons);
                    return (
                      <tr
                        key={player.id}
                        className={cn(
                          isMyTurn && !isDraftComplete
                            ? "cursor-pointer hover:bg-[var(--surface-2)]"
                            : ""
                        )}
                        onClick={() => {
                          if (isMyTurn && !isDraftComplete && !makingPick) {
                            makePick(player.id);
                          }
                        }}
                      >
                        {/* Player */}
                        <td>
                          <button
                            onClick={(e) => { e.stopPropagation(); openPlayerCard(player.id); }}
                            className="text-sm font-semibold text-[var(--text-primary)] hover:text-brand-red transition-colors text-left"
                          >
                            {player.fullName}
                          </button>
                        </td>

                        {/* Team */}
                        <td className="hidden sm:table-cell">
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">
                            {player.teamAbbr ?? "—"}
                          </span>
                        </td>

                        {/* Position */}
                        <td className="hidden sm:table-cell">
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">
                            {player.position ?? "—"}
                          </span>
                        </td>

                        {/* Age */}
                        <td className="hidden sm:table-cell text-center">
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">
                            {player.age ?? "—"}
                          </span>
                        </td>

                        {/* Career IL */}
                        <td className="text-right">
                          <span
                            className={cn(
                              "text-sm font-extrabold",
                              player.careerIlDays > 0
                                ? "text-brand-red"
                                : "text-[var(--text-muted)]"
                            )}
                          >
                            {player.careerIlDays}d
                          </span>
                        </td>

                        {/* Avg / Season */}
                        <td className="hidden sm:table-cell text-right">
                          {player.careerIlDays > 0 ? (
                            <span className="text-xs font-semibold text-[var(--text-secondary)]">
                              {avg.toFixed(1)}d
                              {player.careerSeasons === 1 && (
                                <span className="text-[10px] text-[var(--text-muted)] ml-0.5">
                                  *
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">—</span>
                          )}
                        </td>

                        {/* Grade */}
                        <td className="text-center">
                          <span
                            className={cn("text-sm font-extrabold", color)}
                            title={`Grade ${grade} — ${avg.toFixed(1)}d avg/season (2021–2025). F = most injury-prone = best pick.${player.careerSeasons === 1 ? " *1 season of data." : ""}`}
                          >
                            {grade}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="text-right">
                          {isMyTurn && !isDraftComplete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                makePick(player.id);
                              }}
                              disabled={makingPick}
                              className="btn-primary text-xs py-1 px-2.5"
                            >
                              {makingPick ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Draft"
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Data footnote */}
          <p className="text-[11px] text-[var(--text-muted)] shrink-0 px-0.5">
            * Stats reflect Major League IL days only (2021–2025). Minor league IL stints are not included. A single asterisk (*) next to a value means only 1 season of MLB data is available.
          </p>

          {/* Pagination */}
          <div className="flex items-center justify-between shrink-0 px-0.5">
            <span className="text-xs text-[var(--text-muted)]">
              {displayPlayers.length.toLocaleString()} player
              {displayPlayers.length !== 1 ? "s" : ""}
              {hasActiveFilters || search.trim() ? " (filtered)" : ""}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="text-xs px-2.5 py-1 rounded-input border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-xs text-[var(--text-secondary)] font-semibold min-w-[56px] text-center">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="text-xs px-2.5 py-1 rounded-input border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Draft board ── */}
        <div className={cn(
          "flex-1 flex flex-col gap-3 overflow-hidden",
          mobileTab === "board" ? "flex" : "hidden md:flex"
        )}>
          <div className="card flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                Draft Board
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {draftState.picks.map((pick) => {
                const isCurrentPick =
                  pick.pickNumber === draftState.currentPickNumber;
                const isPicked = pick.mlbPlayerId !== null;
                const isMyPick = pick.userId === draftState.myUserId;

                return (
                  <div
                    key={pick.pickNumber}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-xs transition-colors",
                      isCurrentPick && !isPicked
                        ? "bg-brand-red/10 border border-brand-red/30"
                        : isPicked
                        ? isMyPick
                          ? "bg-blue-500/5 border border-blue-500/10"
                          : "bg-[var(--surface-2)]"
                        : "opacity-40"
                    )}
                  >
                    <span className="text-[var(--text-muted)] w-6 shrink-0 font-semibold">
                      {pick.pickNumber}
                    </span>
                    <span
                      className={cn(
                        "truncate font-semibold flex-1",
                        isMyPick ? "text-blue-400" : "text-[var(--text-secondary)]"
                      )}
                    >
                      {pick.username}
                    </span>
                    <span
                      className={cn(
                        "truncate text-right",
                        isPicked
                          ? "text-[var(--text-primary)] font-semibold"
                          : isCurrentPick
                          ? "text-brand-red animate-pulse font-semibold"
                          : "text-[var(--text-muted)]"
                      )}
                    >
                      {isPicked
                        ? pick.playerName
                        : isCurrentPick
                        ? "Picking..."
                        : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
