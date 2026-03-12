"use client";

import { useState, useEffect, useMemo } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Activity, TrendingUp, ChevronLeft, ChevronRight, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { formatIlStatus, ilStatusBadgeClass, cn } from "@/lib/utils";
import { format } from "date-fns";
import { usePlayerCard } from "@/components/player/PlayerCardContext";

type IlStatusFilter = "all" | "il60" | "il15" | "il10" | "dtd";

const IL_FILTERS: { label: string; value: IlStatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "IL-60", value: "il60" },
  { label: "IL-15", value: "il15" },
  { label: "IL-10", value: "il10" },
  { label: "DTD", value: "dtd" },
];

const PAGE_SIZE_OPTIONS = [20, 100] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

interface RecentLogEntry {
  id: number;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  currentIlStatus: string;
  seasonIlDays: number;
  ilPlacedDate: string;
}

interface OnIlPlayer {
  id: number;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  currentIlStatus: string;
  seasonIlDays: number;
  ilPlacedDate: string | null;
}

// ─── Pagination controls ─────────────────────────────────────────────────────

function PaginationBar({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  pageSize: PageSize;
  totalItems: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: PageSize) => void;
}) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] mt-1">
      {/* Per-page toggle */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[var(--text-muted)]">Per page:</span>
        {PAGE_SIZE_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { onPageSizeChange(s); onPageChange(1); }}
            className={cn(
              "px-2 py-0.5 rounded-[5px] text-xs font-semibold transition-colors",
              pageSize === s
                ? "bg-brand-red text-white"
                : "bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Page info + arrows */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">
          {start}–{end} of {totalItems}
        </span>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="w-6 h-6 flex items-center justify-center rounded-[5px] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-[var(--text-primary)]">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="w-6 h-6 flex items-center justify-center rounded-[5px] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InjuriesPage() {
  const { openPlayerCard } = usePlayerCard();
  const [loading, setLoading] = useState(true);
  const [recentLog, setRecentLog] = useState<RecentLogEntry[]>([]);
  const [onIl, setOnIl] = useState<OnIlPlayer[]>([]);
  const [myPlayerIds, setMyPlayerIds] = useState<Set<number>>(new Set());

  // Recent placements pagination
  const [recentPage, setRecentPage] = useState(1);
  const [recentPageSize, setRecentPageSize] = useState<PageSize>(20);

  // Currently on IL — filter + pagination
  const [ilFilter, setIlFilter] = useState<IlStatusFilter>("all");
  const [ilPage, setIlPage] = useState(1);
  const [ilPageSize, setIlPageSize] = useState<PageSize>(20);
  const [ilSortCol, setIlSortCol] = useState<"fullName" | "currentIlStatus" | "ilPlacedDate" | "seasonIlDays">("ilPlacedDate");
  const [ilSortDir, setIlSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/injuries")
      .then((r) => r.json())
      .then((d) => {
        setRecentLog(d.recentLog ?? []);
        setOnIl(d.onIl ?? []);
        setMyPlayerIds(new Set(d.myPlayerIds ?? []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Filtered + sorted "currently on IL" list
  const filteredOnIl = useMemo(() => {
    const filtered = ilFilter === "all" ? onIl : onIl.filter((p) => p.currentIlStatus === ilFilter);
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (ilSortCol === "fullName") {
        cmp = a.fullName.localeCompare(b.fullName);
      } else if (ilSortCol === "currentIlStatus") {
        cmp = a.currentIlStatus.localeCompare(b.currentIlStatus);
      } else if (ilSortCol === "ilPlacedDate") {
        const aT = a.ilPlacedDate ? new Date(a.ilPlacedDate).getTime() : 0;
        const bT = b.ilPlacedDate ? new Date(b.ilPlacedDate).getTime() : 0;
        cmp = aT - bT;
      } else {
        cmp = a.seasonIlDays - b.seasonIlDays;
      }
      return ilSortDir === "asc" ? cmp : -cmp;
    });
  }, [onIl, ilFilter, ilSortCol, ilSortDir]);

  // Reset to page 1 when filter or sort changes
  useEffect(() => { setIlPage(1); }, [ilFilter, ilSortCol, ilSortDir]);

  const handleIlSort = (col: typeof ilSortCol) => {
    if (ilSortCol === col) setIlSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setIlSortCol(col); setIlSortDir(col === "fullName" ? "asc" : "desc"); }
  };

  // Paginated slices
  const recentTotal = recentLog.length;
  const recentTotalPages = Math.max(1, Math.ceil(recentTotal / recentPageSize));
  const recentSlice = recentLog.slice(
    (recentPage - 1) * recentPageSize,
    recentPage * recentPageSize
  );

  const ilTotal = filteredOnIl.length;
  const ilTotalPages = Math.max(1, Math.ceil(ilTotal / ilPageSize));
  const ilSlice = filteredOnIl.slice(
    (ilPage - 1) * ilPageSize,
    ilPage * ilPageSize
  );

  // Counts per status for filter badge
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of onIl) {
      counts[p.currentIlStatus] = (counts[p.currentIlStatus] ?? 0) + 1;
    }
    return counts;
  }, [onIl]);

  if (loading) {
    return (
      <div>
        <Topbar title="Injury Tracker" subtitle="Loading..." />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar
        title="Injury Tracker"
        subtitle={`${onIl.length} players currently on the IL`}
      />

      <div className="p-4 md:p-6 max-w-5xl space-y-5">
        {/* ── Recent IL Placements ── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-brand-red" />
            <div>
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                Recent IL Placements
              </h2>
              <p className="text-xs text-[var(--text-muted)]">Last 14 days</p>
            </div>
          </div>

          {recentLog.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">
              No recent IL placements tracked yet.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Status</th>
                    <th className="hidden sm:table-cell">Placed On IL</th>
                    <th className="text-right">2026 IL Days</th>
                    <th className="hidden sm:table-cell text-right">On Your Roster</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSlice.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div>
                          <button
                            onClick={() => openPlayerCard(log.id)}
                            className="text-sm font-semibold text-[var(--text-primary)] hover:text-brand-red transition-colors text-left"
                          >
                            {log.fullName}
                          </button>
                          <p className="text-xs text-[var(--text-muted)]">
                            {log.position} · {log.teamAbbr}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className={ilStatusBadgeClass(log.currentIlStatus)}>
                          {formatIlStatus(log.currentIlStatus)}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell text-sm text-[var(--text-secondary)]">
                        {format(new Date(log.ilPlacedDate), "MMM d, yyyy")}
                      </td>
                      <td className="text-right">
                        <span className="text-sm font-semibold text-brand-red">
                          {log.seasonIlDays}d
                        </span>
                      </td>
                      <td className="hidden sm:table-cell text-right">
                        {myPlayerIds.has(log.id) ? (
                          <span className="badge badge-green">Yes</span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {recentTotal > 20 && (
                <PaginationBar
                  page={recentPage}
                  totalPages={recentTotalPages}
                  pageSize={recentPageSize}
                  totalItems={recentTotal}
                  onPageChange={setRecentPage}
                  onPageSizeChange={setRecentPageSize}
                />
              )}
            </>
          )}
        </div>

        {/* ── Currently on IL ── */}
        <div className="card">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <div>
                <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                  Currently on IL
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {ilFilter === "all"
                    ? `${onIl.length} players total`
                    : `${filteredOnIl.length} of ${onIl.length} players`}
                  {" · "}sorted by 2026 IL days
                </p>
              </div>
            </div>

            {/* IL status filter buttons */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {IL_FILTERS.map(({ label, value }) => {
                const count = value === "all"
                  ? onIl.length
                  : (statusCounts[value] ?? 0);
                return (
                  <button
                    key={value}
                    onClick={() => setIlFilter(value)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-[7px] text-xs font-semibold transition-colors whitespace-nowrap",
                      ilFilter === value
                        ? "bg-brand-red text-white"
                        : "bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {label}
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1 rounded-[4px]",
                        ilFilter === value
                          ? "bg-white/20 text-white"
                          : "bg-[var(--surface)] text-[var(--text-muted)]"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredOnIl.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">
              {ilFilter === "all"
                ? "No players on the IL right now (or sync hasn't run yet)."
                : `No players on the ${ilFilter.toUpperCase().replace("IL", "IL-")} right now.`}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="hidden sm:table-cell w-8">#</th>
                    <th>
                      <button onClick={() => handleIlSort("fullName")} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
                        Player
                        {ilSortCol === "fullName" ? (ilSortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
                      </button>
                    </th>
                    <th>
                      <button onClick={() => handleIlSort("currentIlStatus")} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
                        Status
                        {ilSortCol === "currentIlStatus" ? (ilSortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
                      </button>
                    </th>
                    <th className="hidden sm:table-cell">
                      <button onClick={() => handleIlSort("ilPlacedDate")} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
                        Date Placed
                        {ilSortCol === "ilPlacedDate" ? (ilSortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
                      </button>
                    </th>
                    <th className="text-right">
                      <button onClick={() => handleIlSort("seasonIlDays")} className="flex items-center gap-1 ml-auto hover:text-[var(--text-primary)] transition-colors">
                        2026 IL Days
                        {ilSortCol === "seasonIlDays" ? (ilSortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
                      </button>
                    </th>
                    <th className="hidden sm:table-cell text-right">On Your Roster</th>
                  </tr>
                </thead>
                <tbody>
                  {ilSlice.map((player, idx) => (
                    <tr key={player.id}>
                      <td className="hidden sm:table-cell text-xs text-[var(--text-muted)] font-semibold">
                        {(ilPage - 1) * ilPageSize + idx + 1}
                      </td>
                      <td>
                        <div>
                          <button
                            onClick={() => openPlayerCard(player.id)}
                            className="text-sm font-semibold text-[var(--text-primary)] hover:text-brand-red transition-colors text-left"
                          >
                            {player.fullName}
                          </button>
                          <p className="text-xs text-[var(--text-muted)]">
                            {player.position} · {player.teamAbbr}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className={ilStatusBadgeClass(player.currentIlStatus)}>
                          {formatIlStatus(player.currentIlStatus)}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell text-sm text-[var(--text-secondary)]">
                        {player.ilPlacedDate
                          ? format(new Date(player.ilPlacedDate), "MMM d")
                          : "—"}
                      </td>
                      <td className="text-right">
                        <span className="text-sm font-extrabold text-brand-red">
                          {player.seasonIlDays}d
                        </span>
                      </td>
                      <td className="hidden sm:table-cell text-right">
                        {myPlayerIds.has(player.id) ? (
                          <span className="badge badge-green">Yes</span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {ilTotal > 20 && (
                <PaginationBar
                  page={ilPage}
                  totalPages={ilTotalPages}
                  pageSize={ilPageSize}
                  totalItems={ilTotal}
                  onPageChange={setIlPage}
                  onPageSizeChange={setIlPageSize}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
