export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function fmt$(val: string | number | null | undefined): string {
  if (val == null || val === "") return "—";
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}

export function fmtPct(val: string | number | null | undefined): string {
  if (val == null) return "—";
  return `${Number(val).toFixed(1)}%`;
}

export function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

const BG_COLORS = ["bg-blue-500","bg-violet-500","bg-emerald-500","bg-orange-500","bg-pink-500","bg-teal-500","bg-indigo-500","bg-rose-500"];
export function avatarBg(name: string) {
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return BG_COLORS[Math.abs(h) % BG_COLORS.length];
}
