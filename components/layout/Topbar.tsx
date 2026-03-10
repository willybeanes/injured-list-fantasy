"use client";

import { Bell, X, Trash2 } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import Link from "next/link";

interface TopbarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleBellClick = () => {
    const next = !open;
    setOpen(next);
    // Mark all read when opening
    if (next && unreadCount > 0) markAllRead();
  };

  return (
    <header
      className={cn(
        "min-h-14 px-4 md:px-6 flex items-center justify-between shrink-0 gap-2",
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

        {/* Bell with notification dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleBellClick}
            className={cn(
              "relative w-9 h-9 rounded-btn flex items-center justify-center transition-colors",
              "hover:bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              open && "bg-[var(--surface-2)] text-[var(--text-primary)]"
            )}
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-brand-red text-white text-[9px] font-extrabold flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-11 z-50 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-card shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <span className="text-sm font-extrabold text-[var(--text-primary)]">
                  Notifications
                </span>
                <div className="flex items-center gap-1">
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--text-muted)] hover:text-brand-red hover:bg-red-500/10 transition-colors"
                      title="Clear all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold text-[var(--text-muted)]">
                    No notifications yet
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 opacity-70">
                    Draft pick alerts will appear here
                  </p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
                  {notifications.map((n) => {
                    const content = (
                      <div className="px-4 py-3 hover:bg-[var(--surface-2)] transition-colors cursor-default">
                        <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[11px] text-[var(--text-muted)] mt-1">
                          {new Date(n.timestamp).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    );

                    return n.href ? (
                      <Link key={n.id} href={n.href} onClick={() => setOpen(false)}>
                        {content}
                      </Link>
                    ) : (
                      <div key={n.id}>{content}</div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
