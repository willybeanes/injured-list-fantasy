"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Swords, Mail, Lock, User, Loader2, AlertCircle, CheckCircle, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  // Pre-fill email from invite if possible
  useEffect(() => {
    if (!inviteToken || email) return;
    fetch(`/api/invites/${inviteToken}`)
      .then((r) => r.json())
      .then((d) => { if (d.email) setEmail(d.email); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (username.length < 3) {
      setError("Username must be at least 3 characters.");
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    // Build post-signup redirect — go to invite acceptance page if invite token present
    const postSignupRedirect = inviteToken
      ? `/invites/${inviteToken}`
      : "/dashboard";

    // Create Supabase auth user
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect=${encodeURIComponent(postSignupRedirect)}`,
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Create user profile via API
      const res = await fetch("/api/users/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Failed to create profile.");
        setLoading(false);
        return;
      }

      // If email confirmation is enabled, show success. Otherwise redirect.
      if (data.session) {
        router.push(postSignupRedirect);
        router.refresh();
      } else {
        setSuccess(true);
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-red rounded-[12px] mb-4">
            <Swords className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
            Create account
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Join the league of the injured
          </p>
        </div>

        <div className="card">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-[var(--text-primary)]">
                Check your email
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                We sent a confirmation link to <strong>{email}</strong>. Click
                it to activate your account
                {inviteToken ? " and accept your league invitation" : ""}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              {inviteToken && (
                <div className="flex items-center gap-2 p-3 rounded-input bg-brand-red/10 border border-brand-red/20">
                  <Users className="w-4 h-4 text-brand-red shrink-0" />
                  <p className="text-xs text-brand-red font-semibold">
                    Create your account to accept the league invitation
                  </p>
                </div>
              )}
              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    required
                    placeholder="injuryking42"
                    minLength={3}
                    maxLength={20}
                    className="input-base pl-9"
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Letters, numbers and underscores only
                </p>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="input-base pl-9"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={8}
                    className="input-base pl-9"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-input bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 text-brand-red shrink-0" />
                  <p className="text-xs text-brand-red">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Create Account"
                )}
              </button>

              <p className="text-xs text-[var(--text-muted)] text-center">
                By signing up, you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-[var(--text-muted)] mt-4">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-brand-red hover:text-brand-red-hover font-semibold"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
