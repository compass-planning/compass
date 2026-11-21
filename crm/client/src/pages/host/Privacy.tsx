import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { HostLayout } from "@/components/HostLayout";
import { AppBadge, Stat, dateOnly, type AppName } from "@/components/host/hostBits";
import { ShieldAlert, FileWarning, CalendarClock, Trash2, UserCheck } from "lucide-react";

interface Summary {
  breaches: { open: number; notify_needed: number; unassessed: number; last_24m: number };
  requests: { open: number; overdue: number; due_soon: number };
  pendingPurges: { id: number; email: string; purge_requested_at: string; purge_at: string; overdue: boolean }[];
  consent: { total: number; no_processing: number; marketing: number; crm_sharing: number };
  last30d: { resets: number; locks: number };
}
interface Breach { id: number; discovered_at: string; occurred_at: string | null; description: string; data_types: string | null; individuals_affected: number | null; apps: string; rrosh: string; contained: boolean; opc_notified_at: string | null; individuals_notified_at: string | null; status: string; notes: string | null }
interface Req { id: number; app: AppName; email: string; kind: string; received_at: string; due_at: string; status: string; completed_at: string | null; notes: string | null }

const RROSH: Record<string, string> = { unassessed: "bg-amber-50 text-amber-700", low: "bg-slate-100 text-slate-600", real_risk: "bg-red-50 text-red-700" };
const KINDS = ["access", "erasure", "correction", "withdraw_consent", "complaint", "other"];
const inp = "border border-border rounded-lg px-2 py-1.5 bg-background text-sm";
const today = () => new Date().toISOString().slice(0, 10);
const refresh = () => ["summary", "breaches", "requests"].forEach((k) => queryClient.invalidateQueries({ queryKey: [`/api/crm/host/pipeda/${k}`] }));

export default function Privacy() {
  const { data: sum } = useQuery<Summary>({ queryKey: ["/api/crm/host/pipeda/summary"], refetchInterval: 60000 });
  const { data: breaches = [] } = useQuery<Breach[]>({ queryKey: ["/api/crm/host/pipeda/breaches"] });
  const { data: reqs = [] } = useQuery<Req[]>({ queryKey: ["/api/crm/host/pipeda/requests"] });
  const [b, setB] = useState({ discoveredAt: today(), description: "", dataTypes: "", individualsAffected: "", apps: "both" });
  const [r, setR] = useState({ app: "planning", email: "", kind: "access", notes: "" });
  const addBreach = useMutation({ mutationFn: async () => (await apiRequest("POST", "/api/crm/host/pipeda/breaches", b)).json(), onSuccess: () => { setB({ ...b, description: "", dataTypes: "", individualsAffected: "" }); refresh(); } });
  const patchBreach = useMutation({ mutationFn: async (v: { id: number } & Record<string, unknown>) => { const { id, ...rest } = v; return (await apiRequest("PATCH", `/api/crm/host/pipeda/breaches/${id}`, rest)).json(); }, onSuccess: refresh });
  const addReq = useMutation({ mutationFn: async () => (await apiRequest("POST", "/api/crm/host/pipeda/requests", r)).json(), onSuccess: () => { setR({ ...r, email: "", notes: "" }); refresh(); } });
  const patchReq = useMutation({ mutationFn: async (v: { id: number; status: string }) => (await apiRequest("PATCH", `/api/crm/host/pipeda/requests/${v.id}`, { status: v.status })).json(), onSuccess: refresh });

  const attention = (sum?.breaches.notify_needed ?? 0) + (sum?.requests.overdue ?? 0) + (sum?.breaches.unassessed ?? 0);

  return (
    <HostLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="text-privacy-title">Privacy &amp; PIPEDA</h1>
          <p className="text-muted-foreground mt-1">Breach register, privacy requests with 30-day deadlines, erasure queue and consent — Planning and CRM</p>
        </div>

        <div className={`rounded-2xl border p-4 text-sm font-medium ${attention ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} data-testid="banner-privacy-status">
          {attention ? `${sum?.breaches.notify_needed ?? 0} breach(es) needing notification · ${sum?.breaches.unassessed ?? 0} unassessed · ${sum?.requests.overdue ?? 0} overdue request(s)` : "No privacy items need attention."}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat label="Open breaches" value={sum?.breaches.open ?? 0} icon={FileWarning} tone={(sum?.breaches.open ?? 0) ? "text-red-600 bg-red-50" : "text-slate-600 bg-slate-100"} testId="stat-open-breaches" />
          <Stat label="Open requests" value={sum?.requests.open ?? 0} icon={UserCheck} testId="stat-open-requests" />
          <Stat label="Due within 7 days" value={sum?.requests.due_soon ?? 0} icon={CalendarClock} tone="text-amber-600 bg-amber-50" testId="stat-due-soon" />
          <Stat label="Pending erasures" value={sum?.pendingPurges.length ?? 0} icon={Trash2} testId="stat-pending-purges" />
          <Stat label="Breaches (24 mo)" value={sum?.breaches.last_24m ?? 0} icon={ShieldAlert} testId="stat-breaches-24m" />
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border" data-testid="card-breaches">
          <h2 className="text-lg font-display font-bold mb-1">Breach register</h2>
          <p className="text-xs text-muted-foreground mb-4">PIPEDA requires a record of every breach of security safeguards for 24 months, and reporting to the Privacy Commissioner and affected individuals when there is a real risk of significant harm (RROSH).</p>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
            <input type="date" value={b.discoveredAt} onChange={(e) => setB({ ...b, discoveredAt: e.target.value })} data-testid="input-breach-date" className={inp} />
            <input value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} placeholder="What happened" data-testid="input-breach-description" className={`${inp} md:col-span-2`} />
            <input value={b.dataTypes} onChange={(e) => setB({ ...b, dataTypes: e.target.value })} placeholder="Data involved" data-testid="input-breach-data" className={inp} />
            <input type="number" min={0} value={b.individualsAffected} onChange={(e) => setB({ ...b, individualsAffected: e.target.value })} placeholder="# people" data-testid="input-breach-count" className={inp} />
            <select value={b.apps} onChange={(e) => setB({ ...b, apps: e.target.value })} data-testid="select-breach-app" className={inp}><option value="both">Both apps</option><option value="planning">Planning</option><option value="crm">CRM</option></select>
          </div>
          <button onClick={() => addBreach.mutate()} disabled={!b.description || addBreach.isPending} data-testid="button-add-breach" className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 mb-4">Log breach</button>
          {breaches.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-no-breaches">No breaches recorded.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2">Discovered</th><th className="pb-2">Description</th><th className="pb-2">People</th><th className="pb-2">Risk (RROSH)</th><th className="pb-2">OPC notified</th><th className="pb-2">Individuals notified</th><th className="pb-2">Status</th></tr></thead>
              <tbody>{breaches.map((x) => (
                <tr key={x.id} className="border-t border-border align-top" data-testid={`row-breach-${x.id}`}>
                  <td className="py-2 whitespace-nowrap">{dateOnly(x.discovered_at)}</td>
                  <td className="py-2 max-w-[260px]">{x.description}<div className="text-xs text-muted-foreground">{x.apps} · {x.data_types ?? "—"}</div></td>
                  <td className="py-2">{x.individuals_affected ?? "—"}</td>
                  <td className="py-2"><select value={x.rrosh} onChange={(e) => patchBreach.mutate({ id: x.id, rrosh: e.target.value })} data-testid={`select-rrosh-${x.id}`} className={`text-xs rounded-lg px-2 py-1 border-0 ${RROSH[x.rrosh]}`}><option value="unassessed">Unassessed</option><option value="low">Low risk</option><option value="real_risk">Real risk</option></select></td>
                  <td className="py-2"><input type="date" value={x.opc_notified_at?.slice(0, 10) ?? ""} onChange={(e) => patchBreach.mutate({ id: x.id, opcNotifiedAt: e.target.value })} data-testid={`input-opc-${x.id}`} className={inp} /></td>
                  <td className="py-2"><input type="date" value={x.individuals_notified_at?.slice(0, 10) ?? ""} onChange={(e) => patchBreach.mutate({ id: x.id, individualsNotifiedAt: e.target.value })} data-testid={`input-individuals-${x.id}`} className={inp} /></td>
                  <td className="py-2"><select value={x.status} onChange={(e) => patchBreach.mutate({ id: x.id, status: e.target.value })} data-testid={`select-breach-status-${x.id}`} className={inp}><option value="open">Open</option><option value="investigating">Investigating</option><option value="contained">Contained</option><option value="closed">Closed</option></select></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border" data-testid="card-requests">
          <h2 className="text-lg font-display font-bold mb-1">Privacy requests</h2>
          <p className="text-xs text-muted-foreground mb-4">Access, correction, erasure, consent withdrawal and complaints. The response deadline is 30 days from receipt.</p>
          <div className="flex gap-2 flex-wrap mb-4">
            <select value={r.app} onChange={(e) => setR({ ...r, app: e.target.value })} data-testid="select-request-app" className={inp}><option value="planning">Planning</option><option value="crm">CRM</option></select>
            <input value={r.email} onChange={(e) => setR({ ...r, email: e.target.value })} placeholder="Requester email" data-testid="input-request-email" className={`${inp} w-64`} />
            <select value={r.kind} onChange={(e) => setR({ ...r, kind: e.target.value })} data-testid="select-request-kind" className={inp}>{KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}</select>
            <input value={r.notes} onChange={(e) => setR({ ...r, notes: e.target.value })} placeholder="Notes" data-testid="input-request-notes" className={`${inp} flex-1 min-w-[160px]`} />
            <button onClick={() => addReq.mutate()} disabled={!r.email || addReq.isPending} data-testid="button-add-request" className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">Log request</button>
          </div>
          {reqs.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-no-requests">No requests logged.</p> : (
            <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2">App</th><th className="pb-2">Requester</th><th className="pb-2">Type</th><th className="pb-2">Received</th><th className="pb-2">Due</th><th className="pb-2">Status</th></tr></thead>
              <tbody>{reqs.map((x) => {
                const overdue = x.status === "open" && new Date(x.due_at) < new Date(new Date().toDateString());
                return (
                  <tr key={x.id} className="border-t border-border" data-testid={`row-request-${x.id}`}>
                    <td className="py-2"><AppBadge app={x.app} /></td><td className="py-2">{x.email}</td><td className="py-2">{x.kind.replace("_", " ")}</td>
                    <td className="py-2">{dateOnly(x.received_at)}</td>
                    <td className={`py-2 ${overdue ? "text-red-600 font-semibold" : ""}`} data-testid={`text-request-due-${x.id}`}>{dateOnly(x.due_at)}{overdue && " · overdue"}</td>
                    <td className="py-2"><select value={x.status} onChange={(e) => patchReq.mutate({ id: x.id, status: e.target.value })} data-testid={`select-request-status-${x.id}`} className={inp}><option value="open">Open</option><option value="completed">Completed</option><option value="refused">Refused</option></select></td>
                  </tr>);
              })}</tbody></table>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-border" data-testid="card-purges">
            <h2 className="text-lg font-display font-bold mb-1">Erasure queue (Planning)</h2>
            <p className="text-xs text-muted-foreground mb-3">Self-service erasure requests from Compass Planning. Data is scheduled for permanent deletion 30 days after the request.</p>
            {(sum?.pendingPurges ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No erasure requests pending.</p> : (
              <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2">Account</th><th className="pb-2">Requested</th><th className="pb-2">Delete by</th></tr></thead>
                <tbody>{sum!.pendingPurges.map((p) => (
                  <tr key={p.id} className="border-t border-border" data-testid={`row-purge-${p.id}`}><td className="py-1.5">{p.email}</td><td className="py-1.5">{dateOnly(p.purge_requested_at)}</td>
                    <td className={`py-1.5 ${p.overdue ? "text-red-600 font-semibold" : ""}`}>{dateOnly(p.purge_at)}{p.overdue && " · overdue"}</td></tr>))}</tbody></table>
            )}
          </div>
          <div className="glass-card rounded-2xl p-6 border border-border" data-testid="card-consent">
            <h2 className="text-lg font-display font-bold mb-1">Consent (Planning users)</h2>
            <p className="text-xs text-muted-foreground mb-3">Recorded consent on {sum?.consent.total ?? 0} accounts.</p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between"><dt>Without data-processing consent</dt><dd className={`font-semibold ${(sum?.consent.no_processing ?? 0) ? "text-red-600" : ""}`} data-testid="text-consent-none">{sum?.consent.no_processing ?? 0}</dd></div>
              <div className="flex justify-between"><dt>Opted in to marketing</dt><dd className="font-semibold" data-testid="text-consent-marketing">{sum?.consent.marketing ?? 0}</dd></div>
              <div className="flex justify-between"><dt>Opted in to CRM data sharing</dt><dd className="font-semibold" data-testid="text-consent-crm">{sum?.consent.crm_sharing ?? 0}</dd></div>
              <div className="flex justify-between text-muted-foreground"><dt>Password resets / lockouts (30 days)</dt><dd>{sum?.last30d.resets ?? 0} / {sum?.last30d.locks ?? 0}</dd></div>
            </dl>
          </div>
        </div>
      </div>
    </HostLayout>
  );
}
