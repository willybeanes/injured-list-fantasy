"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Swords, Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "password" | "magic";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const supabase = createClient();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect=${redirectTo}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMagicSent(true);
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
            Sign in
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Welcome back to Injured List Fantasy
          </p>
        </div>

        <div className="card">
          {/* Mode toggle */}
          <div className="flex bg-[var(--surface-2)] rounded-input p-1 mb-5">
            <button
              onClick={() => { setMode("password"); setError(null); setMagicSent(false); }}
              className={cn(
                "flex-1 py-1.5 rounded-[7px] text-sm font-semibold transition-colors",
                mode === "password"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              Password
            </button>
            <button
              onClick={() => { setMode("magic"); setError(null); setMagicSent(false); }}
              className={cn(
                "flex-1 py-1.5 rounded-[7px] text-sm font-semibold transition-colors",
                mode === "magic"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              Magic Link
            </button>
          </div>

          {magicSent ? (
            <div className="text-center py-4">
              <Mail className="w-10 h-10 text-brand-red mx-auto mb-3" />
              <p className="font-semibold text-[var(--text-primary)]">Check your email</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                We sent a magic link to <strong>{email}</strong>
              </p>
            </div>
          ) : (
            <form onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink} className="space-y-4">
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

              {/* Password (password mode only) */}
              {mode === "password" && (
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
                      className="input-base pl-9"
                    />
                  </div>
                </div>
              )}

              {/* Error */}
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
                ) : mode === "password" ? (
                  "Sign In"
                ) : (
                  "Send Magic Link"
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-[var(--text-muted)] mt-4">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-brand-red hover:text-brand-red-hover font-semibold"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
