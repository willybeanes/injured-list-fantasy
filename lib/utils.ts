import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generate a random 6-character uppercase invite code */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

/** Format IL status label for display */
export function formatIlStatus(status: string): string {
  const map: Record<string, string> = {
    active: "Active",
    il10: "IL-10",
    il15: "IL-15",
    il60: "IL-60",
    dtd: "Day-to-Day",
  };
  return map[status] ?? status;
}

/** Get badge variant based on IL status */
export function ilStatusBadgeClass(status: string): string {
  if (status === "active") return "badge badge-green";
  if (status === "dtd") return "badge badge-amber";
  if (status === "il60") return "badge badge-red";
  return "badge badge-red";
}

/** Format number with commas */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Get current MLB season year */
export function currentSeasonYear(): number {
  const now = new Date();
  return now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Pluralize helper */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Health grade based on avg IL days per season */
export function healthGrade(careerIlDays: number, careerSeasons: number): { grade: string; color: string } {
  const avg = careerSeasons > 0 ? careerIlDays / careerSeasons : 0;
  if (avg >= 50) return { grade: "F", color: "text-brand-red" };
  if (avg >= 25) return { grade: "D", color: "text-orange-500" };
  if (avg >= 10) return { grade: "C", color: "text-amber-500" };
  if (avg >= 1)  return { grade: "B", color: "text-yellow-400" };
  return { grade: "A", color: "text-[var(--text-muted)]" };
}

/** Grade pill active styles (border + bg tint) */
export const GRADE_STYLES: Record<string, string> = {
  F: "text-brand-red border-brand-red/50 bg-brand-red/10",
  D: "text-orange-500 border-orange-500/50 bg-orange-500/10",
  C: "text-amber-500 border-amber-500/50 bg-amber-500/10",
  B: "text-yellow-400 border-yellow-400/50 bg-yellow-400/10",
  A: "text-[var(--text-secondary)] border-[var(--border)] bg-[var(--surface-2)]",
};
