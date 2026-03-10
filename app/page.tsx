import Link from "next/link";
import { Swords, Trophy, Activity, Users, ArrowRight, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

// Platform stats (fetched server-side from DB)
async function getPlatformStats() {
  try {
    const { prisma } = await import("@/lib/prisma");
    const [userCount, leagueCount, ilDaysResult] = await Promise.all([
      prisma.user.count(),
      prisma.league.count(),
      prisma.globalScore.aggregate({ _sum: { totalIlDays: true } }),
    ]);
    return {
      users: userCount,
      leagues: leagueCount,
      ilDays: ilDaysResult._sum.totalIlDays ?? 0,
    };
  } catch {
    return { users: 0, leagues: 0, ilDays: 0 };
  }
}

export default async function LandingPage() {
  const stats = await getPlatformStats();

  const howItWorks = [
    {
      icon: Users,
      title: "Draft a roster",
      description:
        "Join or create a league and snake-draft real MLB players onto your roster.",
    },
    {
      icon: Activity,
      title: "Players get hurt",
      description:
        "Every day a player on your roster spends on the Injured List earns you 1 point.",
    },
    {
      icon: Trophy,
      title: "Most IL days wins",
      description:
        "Compete in your private league and the Global Leaderboard across all platforms users.",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Nav */}
      <nav className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-red rounded-[8px] flex items-center justify-center">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-sm text-[var(--text-primary)]">
              Injured List Fantasy
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="btn-secondary text-sm py-1.5 px-3"
            >
              Sign In
            </Link>
            <Link href="/signup" className="btn-primary text-sm py-1.5 px-3">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-brand-red text-xs font-semibold mb-6">
          <Zap className="w-3.5 h-3.5" />
          Fantasy baseball&apos;s most twisted league
        </div>
        <h1 className="text-5xl font-extrabold text-[var(--text-primary)] leading-tight mb-4 max-w-3xl mx-auto">
          Score points for every day your players{" "}
          <span className="text-brand-red">can&apos;t play</span>
        </h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-8">
          Draft MLB players, root for injuries, and climb the standings one IL
          day at a time. The most banged-up roster wins.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary text-base py-3 px-6">
            Start Your League
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="btn-secondary text-base py-3 px-6"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: "Total Users", value: stats.users.toLocaleString() || "—" },
            { label: "Active Leagues", value: stats.leagues.toLocaleString() || "—" },
            { label: "IL Days Scored", value: stats.ilDays.toLocaleString() || "—" },
          ].map((stat) => (
            <div key={stat.label} className="card text-center">
              <p className="text-3xl font-extrabold text-[var(--text-primary)]">
                {stat.value}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <h2 className="text-2xl font-extrabold text-[var(--text-primary)] text-center mb-10">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {howItWorks.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="card relative">
                <div className="w-10 h-10 bg-brand-red/10 rounded-[10px] flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-brand-red" />
                </div>
                <div className="absolute top-5 right-5 text-4xl font-extrabold text-[var(--border-2)] select-none">
                  {i + 1}
                </div>
                <h3 className="text-base font-extrabold text-[var(--text-primary)] mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-3">
            Ready to draft the walking wounded?
          </h2>
          <p className="text-[var(--text-secondary)] mb-6">
            Create your league in minutes. Invite your friends. Root for chaos.
          </p>
          <Link href="/signup" className="btn-primary text-base py-3 px-8">
            Create Free Account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>© 2025 Injured List Fantasy. Not affiliated with MLB.</span>
          <span>Built with Next.js + Supabase</span>
        </div>
      </footer>
    </div>
  );
}
