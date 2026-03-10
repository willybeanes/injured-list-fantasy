"use client";

import { useEffect, useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { type PlayerCardData } from "@/app/api/players/[playerId]/card/route";
import { healthGrade, formatIlStatus, ilStatusBadgeClass, cn } from "@/lib/utils";

export function PlayerCardModal({
  playerId,
  onClose,
}: {
  playerId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<PlayerCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/players/${playerId}/card`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load player data."); setLoading(false); });
  }, [playerId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const avg = data
    ? data.player.careerSeasons > 0
      ? Math.round(data.player.careerIlDays / data.player.careerSeasons)
      : 0
    : 0;
  const { grade, color } = data
    ? healthGrade(data.player.careerIlDays, data.player.careerSeasons)
    : { grade: "—", color: "" };

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-card shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[var(--border)] shrink-0">
          {loading ? (
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 bg-[var(--surface-2)] rounded animate-pulse" />
              <div className="h-3.5 w-32 bg-[var(--surface-2)] rounded animate-pulse" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-brand-red text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          ) : data ? (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-[var(--text-primary)] truncate">
                  {data.player.fullName}
                </h2>
                {data.player.currentIlStatus !== "active" && (
                  <span className={ilStatusBadgeClass(data.player.currentIlStatus)}>
                    {formatIlStatus(data.player.currentIlStatus)}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {[data.player.position, data.player.teamAbbr, data.player.age ? `Age ${data.player.age}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {/* Career summary */}
              <div className="flex items-center gap-3 mt-2.5">
                <span className={cn("text-2xl font-black", color)}>{grade}</span>
                <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
                  <p>
                    <span className="font-semibold text-[var(--text-primary)]">{data.player.careerIlDays}d</span>
                    {" "}career IL · {data.player.careerSeasons} {data.player.careerSeasons === 1 ? "season" : "seasons"}
                  </p>
                  <p>
                    <span className="font-semibold text-[var(--text-primary)]">{avg}d</span>
                    {" "}avg / season
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-[7px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {loading && (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-[var(--surface-2)] rounded animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
              ))}
            </div>
          )}

          {!loading && data && (
            <>
              {/* ── IL Days by Season ── */}
              <div>
                <h3 className="text-xs font-extrabold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                  IL Days by Season
                </h3>
                {data.activeYears.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-4 text-center">
                    No MLB seasons found (2021–2025).
                  </p>
                ) : (
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Season</th>
                        <th className="text-right">IL Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activeYears.map((year) => {
                        const entry = data.seasonBreakdown.find((s) => s.year === year);
                        const days = entry?.days ?? 0;
                        return (
                          <tr key={year}>
                            <td className="text-sm text-[var(--text-secondary)]">{year}</td>
                            <td className="text-right">
                              {days > 0 ? (
                                <span className="text-sm font-semibold text-[var(--text-primary)]">{days}d</span>
                              ) : (
                                <span className="text-sm text-[var(--text-muted)]">0d</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* ── Injury History ── */}
              <div>
                <h3 className="text-xs font-extrabold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                  Injury History
                </h3>
                {data.transactions.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-4 text-center">
                    No IL transactions found (2021–2026).
                  </p>
                ) : (
                  <ul className="space-y-0 divide-y divide-[var(--border)]">
                    {data.transactions.map((tx, i) => {
                      const desc = tx.description.toLowerCase();
                      const isPlace = desc.includes("placed");
                      return (
                        <li key={i} className="flex items-start gap-3 py-2.5">
                          <span className={cn(
                            "mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 mt-1.5",
                            isPlace ? "bg-brand-red" : "bg-emerald-500"
                          )} />
                          <div className="min-w-0">
                            <p className="text-xs text-[var(--text-muted)] tabular-nums">
                              {format(new Date(tx.date), "MMM d, yyyy")}
                            </p>
                            <p className="text-sm text-[var(--text-primary)] leading-snug">
                              {tx.description}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
