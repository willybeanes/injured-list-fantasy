"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { User, Mail, Save, Loader2, Check, AlertCircle, Bell, Calendar } from "lucide-react";

interface Profile {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [notifInjury, setNotifInjury] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [notifLeague, setNotifLeague] = useState(true);

  useEffect(() => {
    fetch("/api/users/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setProfile(d.user);
          setUsername(d.user.username);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/users/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email: profile?.email }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      setSaving(false);
      setSaveStatus("error");
      return;
    }

    setProfile(data.user);
    setSaving(false);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 3000);
  };

  return (
    <div>
      <Topbar title="Profile" subtitle="Account settings & preferences" />

      <div className="p-6 max-w-2xl space-y-5">
        {/* Profile info */}
        <div className="card">
          <h2 className="text-sm font-extrabold text-[var(--text-primary)] mb-4">
            Account
          </h2>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              {/* Avatar placeholder */}
              <div className="flex items-center gap-4 pb-4 border-b border-[var(--border)]">
                <div className="w-14 h-14 rounded-full bg-brand-red/10 border-2 border-brand-red/20 flex items-center justify-center text-2xl font-extrabold text-brand-red">
                  {username[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[var(--text-primary)]">
                    {profile?.username}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {profile?.email}
                  </p>
                  {profile?.createdAt && (
                    <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>

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
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                    }
                    minLength={3}
                    maxLength={20}
                    className="input-base pl-9"
                  />
                </div>
              </div>

              {/* Email (read-only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    value={profile?.email ?? ""}
                    readOnly
                    className="input-base pl-9 opacity-60 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Email is managed through your Supabase account.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-input bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 text-brand-red shrink-0" />
                  <p className="text-xs text-brand-red">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saveStatus === "saved" ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saveStatus === "saved" ? "Saved!" : "Save Changes"}
              </button>
            </form>
          )}
        </div>

        {/* Notification preferences */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-[var(--text-muted)]" />
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
              Email Notifications
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                key: "injury",
                label: "Injury Alerts",
                desc: "When a player on your roster is placed on the IL",
                value: notifInjury,
                setter: setNotifInjury,
              },
              {
                key: "weekly",
                label: "Weekly Summary",
                desc: "Monday recap of your IL day total and league rank",
                value: notifWeekly,
                setter: setNotifWeekly,
              },
              {
                key: "league",
                label: "League Updates",
                desc: "Invite codes, draft reminders, and league news",
                value: notifLeague,
                setter: setNotifLeague,
              },
            ].map((pref) => (
              <div key={pref.key} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {pref.label}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{pref.desc}</p>
                </div>
                <button
                  onClick={() => pref.setter(!pref.value)}
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                    pref.value ? "bg-brand-red" : "bg-[var(--border-2)]"
                  }`}
                  type="button"
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                      pref.value ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <p className="text-xs text-[var(--text-muted)] mt-4 pt-4 border-t border-[var(--border)]">
            Notification preferences are saved locally. Email delivery requires
            Resend configuration.
          </p>
        </div>
      </div>
    </div>
  );
}
