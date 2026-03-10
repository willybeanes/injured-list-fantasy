"use client";

import { Bell } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

interface TopbarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <header
      className={cn(
        "h-14 px-4 md:px-6 flex items-center justify-between shrink-0",
        "border-b border-[var(--border)] bg-[var(--surface)]",
        "sticky top-0 z-10"
      )}
    >
      <div>
        {title && (
          <h1 className="text-base font-extrabold text-[var(--text-primary)] leading-tight">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap justify-end">
        {actions}
        <button
          className={cn(
            "relative w-9 h-9 rounded-btn flex items-center justify-center transition-colors",
            "hover:bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
