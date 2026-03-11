import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { DraftingBanner } from "@/components/layout/DraftingBanner";
import { PlayerCardProvider } from "@/components/player/PlayerCardContext";
import { NotificationProvider } from "@/contexts/NotificationContext";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile from DB
  let dbUser = null;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { username: true, email: true, avatarUrl: true },
    });
  } catch {
    // DB not yet configured — gracefully degrade
  }

  return (
    <NotificationProvider>
    <PlayerCardProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
        <Sidebar
          username={dbUser?.username ?? user.email?.split("@")[0]}
          email={dbUser?.email ?? user.email ?? undefined}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Persistent drafting alert banner — renders whenever any of the
              user's leagues is actively in the drafting phase */}
          <DraftingBanner />
          {/* pb-16 on mobile leaves room for the fixed BottomNav */}
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {children}
            {/* Support footer — visible on mobile (sidebar shows it on desktop) */}
            <div className="md:hidden px-6 py-4 border-t border-[var(--border)] mt-4">
              <a
                href="mailto:support@injuredlistfantasy.com"
                className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                Contact Support
              </a>
            </div>
          </main>
        </div>
        <BottomNav />
      </div>
    </PlayerCardProvider>
    </NotificationProvider>
  );
}
