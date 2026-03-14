import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string }>;
}) {
  const { uid } = await searchParams;

  if (!uid) {
    return <UnsubscribeLayout>
      <p className="text-[var(--text-muted)]">Invalid unsubscribe link.</p>
    </UnsubscribeLayout>;
  }

  const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, emailUnsubscribed: true } });

  if (!user) {
    return <UnsubscribeLayout>
      <p className="text-[var(--text-muted)]">Invalid unsubscribe link.</p>
    </UnsubscribeLayout>;
  }

  if (!user.emailUnsubscribed) {
    await prisma.user.update({ where: { id: uid }, data: { emailUnsubscribed: true } });
  }

  return (
    <UnsubscribeLayout>
      <p className="text-[var(--text-muted)] text-sm">
        You&apos;ve been unsubscribed from all Injured List Fantasy emails.
      </p>
      <p className="text-[var(--text-muted)] text-sm mt-2">
        Changed your mind? Email{" "}
        <a href="mailto:support@injuredlistfantasy.com" className="text-[var(--text-primary)] hover:underline">
          support@injuredlistfantasy.com
        </a>{" "}
        to opt back in.
      </p>
    </UnsubscribeLayout>
  );
}

function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-8 max-w-md w-full text-center">
        <div className="w-10 h-10 bg-[#dc2f1f] rounded-[8px] flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-lg">🩼</span>
        </div>
        <h1 className="text-[var(--text-primary)] font-bold text-xl mb-3">Injured List Fantasy</h1>
        {children}
        <Link href="/" className="inline-block mt-6 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          Back to home
        </Link>
      </div>
    </div>
  );
}
