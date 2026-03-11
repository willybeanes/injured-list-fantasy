"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";

interface PlusMenuProps {
  createHref: string;
  joinHref: string;
}

/** Mobile-only "+" button that drops down Create League / Join League options */
export function PlusMenu({ createHref, joinHref }: PlusMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative sm:hidden" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-primary text-sm py-1.5 px-3"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[9px] shadow-lg overflow-hidden z-50 w-44">
          <Link
            href={createHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <Plus className="w-4 h-4 text-[var(--text-muted)]" />
            Create League
          </Link>
          <Link
            href={joinHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <Users className="w-4 h-4 text-[var(--text-muted)]" />
            Join League
          </Link>
        </div>
      )}
    </div>
  );
}
