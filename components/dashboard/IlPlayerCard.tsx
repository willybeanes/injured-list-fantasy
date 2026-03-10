import { Activity } from "lucide-react";
import { formatIlStatus, ilStatusBadgeClass } from "@/lib/utils";

interface IlPlayer {
  id: number;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  currentIlStatus: string;
  seasonIlDays: number;
}

export function IlPlayerCard({ player, teamLabel }: { player: IlPlayer; teamLabel?: string }) {
  const isOnIl = player.currentIlStatus !== "active";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--border)] last:border-0">
      {/* Avatar placeholder */}
      <div className="w-9 h-9 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center shrink-0">
        <Activity className="w-4 h-4 text-[var(--text-muted)]" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {player.fullName}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          {player.position ?? "—"} · {player.teamAbbr ?? "—"}
          {teamLabel && <span className="text-blue-400"> · {teamLabel}</span>}
        </p>
      </div>

      <div className="text-right shrink-0">
        <span className={ilStatusBadgeClass(player.currentIlStatus)}>
          {formatIlStatus(player.currentIlStatus)}
        </span>
        {isOnIl && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {player.seasonIlDays}d total
          </p>
        )}
      </div>
    </div>
  );
}
