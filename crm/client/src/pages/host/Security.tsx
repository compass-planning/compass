import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { HostLayout } from "@/components/HostLayout";
import { useHostUser } from "@/hooks/use-host";
import { ShieldAlert, ShieldCheck, Lock, KeyRound, MonitorSmartphone, Globe, Unlock, RefreshCw } from "lucide-react";

interface Summary {
  range: string;
  counts: Record<string, number>;
  locked: { app: "crm" | "planning"; id: number | null; email: string; first_name: string; last_name: string; locked_until: string; last_failed_login_at: string | null; company: string | null }[];
  topIps: { ip: string; failures: number; accounts: number; last_seen: string }[];
}
interface SecEvent {
  id: number; created_at: string; type: string; email: string | null; ip: string | null;
  user_agent: string | null; detail: Record<string, any>; staff_id: number | null; company: string | null; app: "crm" | "planning";
}

const TYPE_META: Record<string, { label: string; cls: string }> = {
  reset_code_failed: { label: "Wrong reset code", cls: "bg-orange-50 text-orange-700" },
  password_reset_requested: { label: "Reset requested", cls: "bg-slate-100 text-slate-600" },
  password_reset_done: { label: "Password reset", cls: "bg-slate-100 text-slate-600" },
  login_failed: { label: "Failed login", cls: "bg-amber-50 text-amber-700" },
  account_locked: { label: "Account locked", cls: "bg-red-50 text-red-700" },
  login_blocked_locked: { label: "Blocked (locked)", cls: "bg-red-50 text-red-700" },
  ip_burst_alert: { label: "IP burst alert", cls: "bg-red-50 text-red-700" },
  mfa_failed: { label: "MFA failed", cls: "bg-orange-50 text-orange-700" },
  new_device_login: { label: "New device", cls: "bg-violet-50 text-violet-700" },
  account_unlocked: { label: "Unlocked", cls: "bg-emerald-50 text-emerald-700" },
  login_success: { label: "Login", cls: "bg-slate-100 text-slate-600" },
  alert_sent: { label: "Alert emailed", cls: "bg-blue-50 text-blue-700" },
};

const FILTERS: { key: string; label: string; types: string }[] = [
  { key: "issues", label: "Issues", types: "login_failed,account_locked,login_blocked_locked,ip_burst_alert,mfa_failed,account_unlocked,reset_code_failed" },
  { key: "devices", label: "New devices", types: "new_device_login" },
  { key: "alerts", label: "Alerts sent", types: "alert_sent,ip_burst_alert,account_locked" },
  { key: "logins", label: "Successful logins", types: "login_success" },
  { key: "all", label: "Everything", types: "" },
];

const ago = (iso: string) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const shortUa = (ua: string | null) => {
  const u = ua || "";
  const b = /Edg\//.test(u) ? "Edge" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "Unknown";
  const o = /Windows/.test(u) ? "Windows" : /iPhone|iPad/.test(u) ? "iOS" : /Android/.test(u) ? "Android" : /Mac OS X/.test(u) ? "macOS" : /Linux/.test(u) ? "Linux" : "";
  return o ? `${b} · ${o}` : b;
};

function AppBadge({ app }: { app: "crm" | "planning" }) {
  return (
    <span data-testid={`badge-app-${app}`} className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${app === "planning" ? "bg-sky-50 text-sky-700" : "bg-fuchsia-50 text-fuchsia-700"}`}>
      {app === "planning" ? "Planning" : "CRM"}
    </span>
  );
}

export default function Security() {
  const { data: hostUser } = useHostUser();
  const isAdmin = ((hostUser as any)?.roles ?? []).includes("admin");
  const [range, setRange] = useState("24h");
  const [filter, setFilter] = useState("issues");
  const [app, setApp] = useState<"all" | "crm" | "planning">("all");
  const types = FILTERS.find((f) => f.key === filter)?.types ?? "";

  const summaryKey = `/api/crm/host/security/summary?range=${range}&app=${app}`;
  const eventsKey = `/api/crm/host/security/events?range=${range}&app=${app}${types ? `&type=${types}` : ""}`;
  const { data: summary, isLoading: sumLoading, refetch } = useQuery<Summary>({ queryKey: [summaryKey], refetchInterval: 30000 });
  const { data: events = [], isLoading: evLoading } = useQuery<SecEvent[]>({ queryKey: [eventsKey], refetchInterval: 30000 });

  const unlock = useMutation({
    mutationFn: async (l: Summary["locked"][number]) =>
      l.app === "planning"
        ? (await apiRequest("POST", `/api/crm/host/security/unlock-planning`, { email: l.email })).json()
        : (await apiRequest("POST", `/api/crm/host/security/unlock/${l.id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [summaryKey] });
      queryClient.invalidateQueries({ queryKey: [eventsKey] });
    },
  });

  const c = summary?.counts ?? {};
  const issueTotal = (c.account_locked ?? 0) + (c.ip_burst_alert ?? 0) + (c.mfa_failed ?? 0);
  const cards = [
    { label: "Failed logins", value: c.login_failed ?? 0, icon: KeyRound, tone: (c.login_failed ?? 0) > 20 ? "text-amber-600 bg-amber-50" : "text-slate-600 bg-slate-100" },
    { label: "Accounts locked", value: c.account_locked ?? 0, icon: Lock, tone: (c.account_locked ?? 0) > 0 ? "text-red-600 bg-red-50" : "text-slate-600 bg-slate-100" },
    { label: "IP burst alerts", value: c.ip_burst_alert ?? 0, icon: Globe, tone: (c.ip_burst_alert ?? 0) > 0 ? "text-red-600 bg-red-50" : "text-slate-600 bg-slate-100" },
    { label: "MFA failures", value: c.mfa_failed ?? 0, icon: ShieldAlert, tone: (c.mfa_failed ?? 0) > 0 ? "text-orange-600 bg-orange-50" : "text-slate-600 bg-slate-100" },
    { label: "New-device logins", value: c.new_device_login ?? 0, icon: MonitorSmartphone, tone: "text-violet-600 bg-violet-50" },
  ];

  return (
    <HostLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold" data-testid="text-security-title">Security</h1>
            <p className="text-muted-foreground mt-1">Sign-in activity and suspicious events across Compass Planning and Compass CRM</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden text-sm" data-testid="toggle-security-app">
              {([["all", "Both apps"], ["planning", "Planning"], ["crm", "CRM"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setApp(k)} data-testid={`app-${k}`}
                  className={`px-3 py-2 ${app === k ? "bg-violet-600 text-white" : "hover:bg-muted text-muted-foreground"}`}>{label}</button>
              ))}
            </div>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              data-testid="select-security-range"
              className="text-sm border border-border rounded-lg px-3 py-2 bg-background"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <button onClick={() => refetch()} className="p-2 border border-border rounded-lg hover:bg-muted" title="Refresh" data-testid="button-security-refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 flex items-center gap-3 ${issueTotal > 0 ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
          data-testid="banner-security-status"
        >
          {issueTotal > 0 ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          <span className="text-sm font-medium">
            {sumLoading ? "Checking…" : issueTotal > 0
              ? `${issueTotal} security alert${issueTotal === 1 ? "" : "s"} in this period — review below.`
              : "No lockouts, brute-force alerts or MFA failures in this period."}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" data-testid="grid-security-stats">
          {cards.map((s) => (
            <div key={s.label} className="glass-card rounded-2xl p-5 border border-border" data-testid={`stat-sec-${s.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.tone}`}><s.icon className="w-4 h-4" /></div>
              <p className="text-2xl font-display font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-border" data-testid="card-locked">
            <h2 className="text-lg font-display font-bold mb-3">Currently locked accounts</h2>
            {(summary?.locked ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">None right now.</p>
            ) : (
              <div className="space-y-2">
                {summary!.locked.map((l) => {
                  const lk = l.app === "planning" ? `planning-${l.email}` : String(l.id);
                  return (
                  <div key={lk} className="flex items-center justify-between gap-3 text-sm border border-border rounded-xl px-3 py-2" data-testid={`row-locked-${lk}`}>
                    <div className="min-w-0">
                      <div className="font-medium truncate"><AppBadge app={l.app} /> {l.first_name} {l.last_name} <span className="text-muted-foreground font-normal">· {l.email}</span></div>
                      <div className="text-xs text-muted-foreground">{l.company ?? "—"} · unlocks {new Date(l.locked_until).toLocaleTimeString()}</div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => unlock.mutate(l)}
                        disabled={unlock.isPending}
                        data-testid={`button-unlock-${lk}`}
                        className="flex items-center gap-1 text-xs font-semibold text-violet-700 border border-violet-200 rounded-lg px-2.5 py-1.5 hover:bg-violet-50"
                      >
                        <Unlock className="w-3 h-3" /> Unlock
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-card rounded-2xl p-6 border border-border" data-testid="card-top-ips">
            <h2 className="text-lg font-display font-bold mb-3">Top IPs by failed logins</h2>
            {(summary?.topIps ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No failed logins in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2">IP</th><th className="pb-2">Failures</th><th className="pb-2">Accounts</th><th className="pb-2">Last</th></tr></thead>
                <tbody>
                  {summary!.topIps.map((i) => (
                    <tr key={i.ip} className="border-t border-border">
                      <td className="py-1.5 font-mono text-xs">{i.ip}</td>
                      <td className={`py-1.5 font-semibold ${i.failures >= 8 ? "text-red-600" : ""}`}>{i.failures}</td>
                      <td className="py-1.5">{i.accounts}</td>
                      <td className="py-1.5 text-muted-foreground">{ago(i.last_seen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border" data-testid="card-events">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-lg font-display font-bold">Event log</h2>
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  data-testid={`filter-${f.key}`}
                  className={`text-xs px-3 py-1.5 rounded-full border ${filter === f.key ? "bg-violet-600 text-white border-violet-600" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {evLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-events">No events in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2">When</th><th className="pb-2">App</th><th className="pb-2">Event</th><th className="pb-2">Account</th><th className="pb-2">Business</th><th className="pb-2">IP</th><th className="pb-2">Browser</th></tr></thead>
                <tbody>
                  {events.map((e) => {
                    const m = TYPE_META[e.type] ?? { label: e.type, cls: "bg-slate-100 text-slate-600" };
                    return (
                      <tr key={e.id} className="border-t border-border" data-testid={`row-event-${e.id}`}>
                        <td className="py-2 whitespace-nowrap text-muted-foreground" title={new Date(e.created_at).toLocaleString()}>{ago(e.created_at)}</td>
                        <td className="py-2"><AppBadge app={e.app} /></td>
                        <td className="py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>{e.detail?.subject && <span className="ml-2 text-xs text-muted-foreground">{String(e.detail.subject)}</span>}</td>
                        <td className="py-2 truncate max-w-[200px]">{e.email ?? "—"}</td>
                        <td className="py-2 text-muted-foreground">{e.company ?? "—"}</td>
                        <td className="py-2 font-mono text-xs">{e.ip ?? "—"}</td>
                        <td className="py-2 text-muted-foreground whitespace-nowrap">{shortUa(e.user_agent)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </HostLayout>
  );
}
