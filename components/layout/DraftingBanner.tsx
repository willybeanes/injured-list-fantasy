"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "lucide-react";

interface DraftingLeague {
  id: string;
  name: string;
}

/**
 * Polls the user's leagues every 30s and shows a thin red banner
 * at the top of the app whenever one of their leagues is actively drafting.
 */
export function DraftingBanner() {
  const pathname = usePathname();
  const [draftingLeagues, setDraftingLeagues] = useState<DraftingLeague[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchLeagues = () => {
      fetch("/api/leagues")
        .then((r) => r.json())
        .then((d) => {
          const drafting: DraftingLeague[] = (d.leagues ?? [])
            .filter((l: { status: string }) => l.status === "drafting")
            .map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }));
          setDraftingLeagues(drafting);
        })
        .catch(() => {});
    };

    fetchLeagues();
    const interval = setInterval(fetchLeagues, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Don't show the banner if the user is already inside a draft room
  if (pathname?.startsWith("/draft/")) return null;

  const visible = draftingLeagues.filter((l) => !dismissed.has(l.id));
  if (visible.length === 0) return null;

  // Show banner for the first undismissed drafting league
  const league = visible[0];

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-brand-red text-white text-sm font-semibold shrink-0">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
        <span>
          <span className="opacity-80">Your league </span>
          <span className="font-extrabold">{league.name}</span>
          <span className="opacity-80"> is drafting now!</span>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/draft/${league.id}`}
          className="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors px-2.5 py-1 rounded-[6px] text-xs font-extrabold"
        >
          Enter Draft Room
          <ArrowRight className="w-3 h-3" />
        </Link>
        <button
          onClick={() => setDismissed((prev) => new Set(Array.from(prev).concat(league.id)))}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition-colors opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
