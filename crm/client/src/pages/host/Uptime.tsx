import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { HostLayout } from "@/components/HostLayout";
import { useHostUser } from "@/hooks/use-host";
import { Stat, ago, fmtDuration } from "@/components/host/hostBits";
import { Activity, Gauge, Timer, AlertOctagon } from "lucide-react";

interface Incident { id: number; started_at: string; ended_at: string | null; kind: string; source: string; detail: any; note: string | null; seconds: number }
interface Summary {
  range: string; monitoringSince: string | null; status: "up" | "down" | "stale" | "unknown"; uptimePct: number | null; downSeconds: number;
  lastCheck: { checked_at: string; ok: boolean; latency_ms: number; detail: Record<string, { ok: boolean; ms: number }> } | null;
  checks: { checks: number; ok_checks: number; avg_ms: number | null; max_ms: number | null }; incidents: Incident[];
}
const KIND: Record<string, string> = { check_failed: "Health check failed", downtime_gap: "App not running", manual: "Reported outage" };
const STATUS = {
  up: { label: "All systems operational", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  down: { label: "Health checks failing", cls: "border-red-200 bg-red-50 text-red-800" },
  stale: { label: "No recent heartbeat — the monitor may be down", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  unknown: { label: "Monitoring has not started yet", cls: "border-slate-200 bg-slate-50 text-slate-700" },
} as const;

export default function Uptime() {
  const { data: hostUser } = useHostUser();
  const roles: string[] = (hostUser as any)?.roles ?? [];
  const canEdit = roles.includes("admin") || roles.includes("development");
  const [range, setRange] = useState("24h");
  const key = `/api/crm/host/uptime/summary?range=${range}`;
  const { data, isLoading } = useQuery<Summary>({ queryKey: [key], refetchInterval: 30000 });
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [note, setNote] = useState("");
  const add = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/crm/host/uptime/incidents", { startedAt: new Date(start).toISOString(), endedAt: end ? new Date(end).toISOString() : null, note }); return r.json(); },
    onSuccess: () => { setStart(""); setEnd(""); setNote(""); queryClient.invalidateQueries({ queryKey: [key] }); },
  });
  const saveNote = useMutation({
    mutationFn: async (v: { id: number; note: string }) => (await apiRequest("PATCH", `/api/crm/host/uptime/incidents/${v.id}`, { note: v.note })).json(),
  });
  const st = STATUS[data?.status ?? "unknown"];
  const c = data?.lastCheck;

  return (
    <HostLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold" data-testid="text-uptime-title">System Status</h1>
            <p className="text-muted-foreground mt-1">Uptime and downtime for Compass Planning and Compass CRM (one shared server and database)</p>
          </div>
          <select value={range} onChange={(e) => setRange(e.target.value)} data-testid="select-uptime-range" className="text-sm border border-border rounded-lg px-3 py-2 bg-background">
            <option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
          </select>
        </div>

        <div className={`rounded-2xl border p-4 text-sm font-medium ${st.cls}`} data-testid="banner-uptime-status">{isLoading ? "Checking…" : st.label}{c && <span className="font-normal"> · last check {ago(c.checked_at)}</span>}</div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Uptime" value={data?.uptimePct == null ? "—" : `${data.uptimePct}%`} icon={Gauge} tone="text-emerald-600 bg-emerald-50" testId="stat-uptime-pct" />
          <Stat label="Total downtime" value={fmtDuration(data?.downSeconds ?? 0)} icon={Timer} tone={(data?.downSeconds ?? 0) > 0 ? "text-red-600 bg-red-50" : "text-slate-600 bg-slate-100"} testId="stat-downtime" />
          <Stat label="Incidents" value={data?.incidents.length ?? 0} icon={AlertOctagon} testId="stat-incidents" />
          <Stat label="Avg / max response" value={data?.checks.avg_ms == null ? "—" : `${data.checks.avg_ms} / ${data.checks.max_ms} ms`} icon={Activity} testId="stat-latency" />
        </div>

        {c && (
          <div className="glass-card rounded-2xl p-6 border border-border" data-testid="card-components">
            <h2 className="text-lg font-display font-bold mb-3">Components (latest check)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {Object.entries(c.detail).map(([k, v]) => (
                <div key={k} className="border border-border rounded-xl px-3 py-2 flex justify-between" data-testid={`component-${k}`}>
                  <span>{({ db_ca: "Database (Canada)", db_us: "Database (US)", app: "Web app / API" } as Record<string, string>)[k] ?? k}</span>
                  <span className={v.ok ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>{v.ok ? `OK · ${v.ms}ms` : "Failing"}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Monitoring since {data?.monitoringSince ? new Date(data.monitoringSince).toLocaleString() : "—"}. Restarts and deploys appear as "App not running" incidents the next time the server starts. For outside-in checks, point an external pinger at /api/health.</p>
          </div>
        )}

        <div className="glass-card rounded-2xl p-6 border border-border" data-testid="card-incidents">
          <h2 className="text-lg font-display font-bold mb-3">Incident log</h2>
          {(data?.incidents ?? []).length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-no-incidents">No incidents in this period.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2">Started</th><th className="pb-2">Type</th><th className="pb-2">Duration</th><th className="pb-2">Note</th></tr></thead>
              <tbody>
                {data!.incidents.map((i) => (
                  <tr key={i.id} className="border-t border-border" data-testid={`row-incident-${i.id}`}>
                    <td className="py-2 whitespace-nowrap">{new Date(i.started_at).toLocaleString()}</td>
                    <td className="py-2">{KIND[i.kind] ?? i.kind}{!i.ended_at && <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">ongoing</span>}</td>
                    <td className="py-2">{fmtDuration(i.seconds)}</td>
                    <td className="py-2"><input defaultValue={i.note ?? ""} disabled={!canEdit} placeholder="Add a note (cause, fix)…" data-testid={`input-incident-note-${i.id}`}
                      onBlur={(e) => { if (e.target.value !== (i.note ?? "")) saveNote.mutate({ id: i.id, note: e.target.value }); }} className="w-full border border-border rounded-lg px-2 py-1 bg-background text-sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {canEdit && (
          <div className="glass-card rounded-2xl p-6 border border-border" data-testid="card-add-incident">
            <h2 className="text-lg font-display font-bold mb-1">Record an outage</h2>
            <p className="text-xs text-muted-foreground mb-3">For outages seen from outside (e.g. your external pinger, Fly status, a client report).</p>
            <div className="flex gap-2 flex-wrap items-end">
              <label className="text-xs">Started<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} data-testid="input-incident-start" className="block border border-border rounded-lg px-2 py-1.5 bg-background text-sm" /></label>
              <label className="text-xs">Ended<input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="input-incident-end" className="block border border-border rounded-lg px-2 py-1.5 bg-background text-sm" /></label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened" data-testid="input-incident-new-note" className="flex-1 min-w-[200px] border border-border rounded-lg px-2 py-1.5 bg-background text-sm" />
              <button onClick={() => add.mutate()} disabled={!start || add.isPending} data-testid="button-add-incident" className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">Add</button>
            </div>
            {add.isError && <p className="text-xs text-red-600 mt-2">{(add.error as Error).message}</p>}
          </div>
        )}
      </div>
    </HostLayout>
  );
}
