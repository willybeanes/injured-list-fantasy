"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Swords,
  Loader2,
  CheckCircle,
  AlertCircle,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InviteInfo {
  leagueId: string;
  leagueName: string;
  commissionerUsername: string;
  email: string;
  status: string;
  expired: boolean;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const supabase = createClient();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAcceptedLeagueId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Fetch invite info (public)
      const res = await fetch(`/api/invites/${token}`);
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setInvite(data);

      // Check auth
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setCurrentUserEmail(user.email);
        setLoggedIn(true);
      }

      setLoading(false);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    const res = await fetch(`/api/invites/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName: teamName.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      // If already a member, just redirect
      if (data.leagueId) {
        router.push(`/leagues/${data.leagueId}`);
        return;
      }
      setError(data.error ?? "Failed to accept invite");
      setAccepting(false);
      return;
    }
    setAcceptedLeagueId(data.leagueId);
    setAccepting(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-red rounded-[12px] mb-4">
            <Swords className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">
            Injured List Fantasy
          </h1>
        </div>

        {loading ? (
          <div className="card flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : notFound || !invite ? (
          <div className="space-y-4">
            <div className="card text-center py-8 space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="font-extrabold text-[var(--text-primary)]">Invitation no longer valid</p>
              <p className="text-sm text-[var(--text-muted)]">
                This invite link has expired, been cancelled, or the league no longer exists.
              </p>
            </div>
            <div className="card space-y-3">
              <p className="text-xs text-[var(--text-muted)] text-center">
                Still want to play? Create an account or sign in.
              </p>
              <Link href="/signup" className="btn-primary w-full justify-center">
                Create account
              </Link>
              <Link href="/login" className="btn-secondary w-full justify-center">
                Sign in
              </Link>
            </div>
          </div>
        ) : invite.status === "accepted" ? (
          <div className="card text-center py-8 space-y-3">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
            <p className="font-extrabold text-[var(--text-primary)]">Already accepted</p>
            <p className="text-sm text-[var(--text-muted)]">This invite has already been accepted.</p>
            {loggedIn && (
              <Link href={`/leagues/${invite.leagueId}`} className="btn-primary inline-flex mt-2">
                Go to League
              </Link>
            )}
          </div>
        ) : invite.expired || invite.status === "cancelled" ? (
          <div className="space-y-4">
            <div className="card text-center py-8 space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="font-extrabold text-[var(--text-primary)]">
                {invite.status === "cancelled" ? "Invitation cancelled" : "Invite expired"}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                {invite.status === "cancelled"
                  ? "This invitation has been cancelled by the commissioner."
                  : "This invite link has expired. Ask the commissioner to send a new one."}
              </p>
            </div>
            <div className="card space-y-3">
              <p className="text-xs text-[var(--text-muted)] text-center">
                Still want to play? Create an account or sign in.
              </p>
              <Link href="/signup" className="btn-primary w-full justify-center">
                Create account
              </Link>
              <Link href="/login" className="btn-secondary w-full justify-center">
                Sign in
              </Link>
            </div>
          </div>
        ) : accepted ? (
          <div className="card text-center py-8 space-y-3">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
            <p className="font-extrabold text-[var(--text-primary)]">You&apos;re in!</p>
            <p className="text-sm text-[var(--text-muted)]">
              Welcome to <strong className="text-[var(--text-primary)]">{invite.leagueName}</strong>.
            </p>
            <Link href={`/leagues/${accepted}`} className="btn-primary inline-flex mt-2">
              Enter League →
            </Link>
          </div>
        ) : (
          <div className="card space-y-5">
            {/* Invite card */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-brand-red" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[var(--text-primary)]">
                  You&apos;re invited!
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {invite.commissionerUsername} invited you to join
                </p>
              </div>
            </div>

            <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] p-3">
              <p className="text-xs text-[var(--text-muted)] mb-0.5">League</p>
              <p className="text-base font-extrabold text-[var(--text-primary)]">
                {invite.leagueName}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Invited by {invite.commissionerUsername}
              </p>
            </div>

            {!loggedIn ? (
              /* Not logged in */
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-muted)] text-center">
                  Log in or create an account to accept this invitation.
                </p>
                <Link
                  href={`/login?redirect=/invites/${token}`}
                  className="btn-primary w-full justify-center"
                >
                  Log in to accept
                </Link>
                <Link
                  href={`/signup?invite=${token}`}
                  className="btn-secondary w-full justify-center"
                >
                  Create account
                </Link>
              </div>
            ) : currentUserEmail?.toLowerCase() !== invite.email.toLowerCase() ? (
              /* Wrong account */
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 rounded-input bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400">
                    This invite was sent to{" "}
                    <strong>{invite.email}</strong>. You&apos;re currently signed
                    in as <strong>{currentUserEmail}</strong>. Please sign in with
                    the correct account to accept.
                  </p>
                </div>
                <Link
                  href={`/login?redirect=/invites/${token}`}
                  className="btn-secondary w-full justify-center"
                >
                  Switch account
                </Link>
              </div>
            ) : (
              /* Ready to accept */
              <div className="space-y-4">
                {/* Optional team name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">
                    Team Name <span className="text-[var(--text-muted)] font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder={`e.g. The Broken Bones`}
                    maxLength={40}
                    className="input-base"
                  />
                  <p className="text-xs text-[var(--text-muted)]">
                    Shown in standings. You can change this later.
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-input bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-brand-red shrink-0" />
                    <p className="text-xs text-brand-red">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className={cn("btn-primary w-full justify-center", accepting && "opacity-70")}
                >
                  {accepting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Accept Invitation"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
