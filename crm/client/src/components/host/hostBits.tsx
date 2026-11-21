export type AppName = "crm" | "planning";

export function AppBadge({ app }: { app: AppName }) {
  return (
    <span data-testid={`badge-app-${app}`} className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${app === "planning" ? "bg-sky-50 text-sky-700" : "bg-fuchsia-50 text-fuchsia-700"}`}>
      {app === "planning" ? "Planning" : "CRM"}
    </span>
  );
}

export function AppToggle({ value, onChange }: { value: "all" | AppName; onChange: (v: "all" | AppName) => void }) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden text-sm" data-testid="toggle-app">
      {([["all", "Both apps"], ["planning", "Planning"], ["crm", "CRM"]] as const).map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} data-testid={`app-${k}`} className={`px-3 py-2 ${value === k ? "bg-violet-600 text-white" : "hover:bg-muted text-muted-foreground"}`}>{label}</button>
      ))}
    </div>
  );
}

export const ago = (iso?: string | null) => {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const dateOnly = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

export const fmtDuration = (secs: number) => {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.round(secs / 60)} min`;
  return `${Math.floor(secs / 3600)}h ${Math.round((secs % 3600) / 60)}m`;
};

export function Stat({ label, value, tone = "text-slate-600 bg-slate-100", icon: Icon, testId }: { label: string; value: React.ReactNode; tone?: string; icon: any; testId?: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 border border-border" data-testid={testId ?? `stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${tone}`}><Icon className="w-4 h-4" /></div>
      <p className="text-2xl font-display font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
