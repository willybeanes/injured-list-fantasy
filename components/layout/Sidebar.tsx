"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Users,
  Activity,
  User,
  Swords,
  LogOut,
  Mail,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Leagues", href: "/leagues", icon: Users },
  { label: "Public Lobby", href: "/lobby", icon: Globe },
  { label: "Standings", href: "/standings", icon: Trophy },
  { label: "Injuries", href: "/injuries", icon: Activity },
  { label: "Profile", href: "/profile", icon: User },
];

interface SidebarProps {
  username?: string;
  email?: string;
}

export function Sidebar({ username, email }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      className={cn(
        "w-[220px] shrink-0 h-screen sticky top-0",
        "hidden md:flex flex-col",
        "bg-[var(--surface)] border-r border-[var(--border)]"
      )}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[var(--border)]">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-brand-red rounded-[8px] flex items-center justify-center shrink-0">
            <Swords className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-sm text-[var(--text-primary)] leading-tight block">
              Injured List
            </span>
            <span className="font-bold text-xs text-brand-red leading-tight block">
              Fantasy
            </span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-item", isActive && "active")}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info + sign out */}
      <div className="px-3 py-4 border-t border-[var(--border)] space-y-1">
        <div className="px-2 py-1.5">
          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
            {username ?? "User"}
          </p>
          <p className="text-xs text-[var(--text-muted)] truncate">{email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="nav-item w-full text-left text-[var(--text-muted)] hover:text-brand-red"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
        <a
          href="mailto:support@injuredlistfantasy.com"
          className="nav-item text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          <Mail className="w-4 h-4 shrink-0" />
          Contact Support
        </a>
      </div>
    </aside>
  );
}
