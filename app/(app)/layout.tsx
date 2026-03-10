import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { DraftingBanner } from "@/components/layout/DraftingBanner";
import { PlayerCardProvider } from "@/components/player/PlayerCardContext";

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
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
        </div>
        <BottomNav />
      </div>
    </PlayerCardProvider>
  );
}
