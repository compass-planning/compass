import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Westoak formatting utilities ─────────────────────────────────────────────

export function fmt$(val: string | number | null | undefined): string {
  if (val == null || val === "") return "—";
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtPct(val: string | number | null | undefined): string {
  if (val == null) return "—";
  return `${Number(val).toFixed(1)}%`;
}

export function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}
