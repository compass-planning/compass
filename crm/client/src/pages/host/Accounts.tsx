import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { HostLayout } from "@/components/HostLayout";
import { useHostUser } from "@/hooks/use-host";
import { AppBadge, AppToggle, Stat, ago, dateOnly, type AppName } from "@/components/host/hostBits";
import { Users, DollarSign, Clock, AlertTriangle, Search } from "lucide-react";

interface Account { app: AppName; id: number; name: string; email: string | null; plan: string; status: string; trialEndsAt: string | null; periodEnd: string | null; users: number; createdAt: string; lastLogin: string | null; hasStripe: boolean; monthly: number }
interface Resp { summary: { total: number; crm: number; planning: number; byStatus: Record<string, number>; mrr: number }; accounts: Account[] }
interface Price { app: AppName; plan: string; price: number }

const STATUS_CLS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700", trialing: "bg-blue-50 text-blue-700",
  past_due: "bg-red-50 text-red-700", unpaid: "bg-red-50 text-red-700", canceled: "bg-slate-100 text-slate-500", cancelled: "bg-slate-100 text-slate-500",
};
const money = (n: number) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export default function Accounts() {
  const { data: hostUser } = useHostUser();
  const roles: string[] = (hostUser as any)?.roles ?? [];
  const canPrice = roles.includes("admin") || roles.includes("accounting");
  const [app, setApp] = useState<"all" | AppName>("all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const key = `/api/crm/host/accounts?app=${app}&q=${encodeURIComponent(q)}`;
  const { data, isLoading } = useQuery<Resp>({ queryKey: [key] });
  const { data: prices = [] } = useQuery<Price[]>({ queryKey: ["/api/crm/host/plan-prices"] });
  const savePrice = useMutation({
    mutationFn: async (p: Price) => (await apiRequest("PUT", "/api/crm/host/plan-prices", p)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crm/host/plan-prices"] }); queryClient.invalidateQueries({ queryKey: [key] }); },
  });

  const s = data?.summary;
  const rows = (data?.accounts ?? []).filter((a) => status === "all" || a.status === status);
  const atRisk = (s?.byStatus.past_due ?? 0) + (s?.byStatus.unpaid ?? 0);
  const trialing = s?.byStatus.trialing ?? 0;

  return (
    <HostLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold" data-testid="text-accounts-title">Accounts &amp; Billing</h1>
            <p className="text-muted-foreground mt-1">Every registered business and subscriber across Compass Planning and Compass CRM</p>
          </div>
          <AppToggle value={app} onChange={setApp} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat label="Total accounts" value={s?.total ?? "—"} icon={Users} testId="stat-total" />
          <Stat label="Planning / CRM" value={s ? `${s.planning} / ${s.crm}` : "—"} icon={Users} testId="stat-split" />
          <Stat label="Est. monthly revenue" value={s ? money(s.mrr) : "—"} icon={DollarSign} tone="text-emerald-600 bg-emerald-50" testId="stat-mrr" />
          <Stat label="On trial" value={trialing} icon={Clock} tone="text-blue-600 bg-blue-50" testId="stat-trialing" />
          <Stat label="Past due / unpaid" value={atRisk} icon={AlertTriangle} tone={atRisk ? "text-red-600 bg-red-50" : "text-slate-600 bg-slate-100"} testId="stat-pastdue" />
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" data-testid="input-account-search" className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background w-64" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="select-account-status" className="text-sm border border-border rounded-lg px-3 py-2 bg-background">
              <option value="all">All statuses</option>
              {Object.keys(s?.byStatus ?? {}).map((k) => <option key={k} value={k}>{k.replace("_", " ")} ({s!.byStatus[k]})</option>)}
            </select>
          </div>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-no-accounts">No accounts match.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-accounts">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2">App</th><th className="pb-2">Account</th><th className="pb-2">Plan</th><th className="pb-2">Status</th><th className="pb-2">Users</th><th className="pb-2">Trial / renews</th><th className="pb-2">Signed up</th><th className="pb-2">Last login</th><th className="pb-2">Stripe</th></tr></thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={`${a.app}-${a.id}`} className="border-t border-border" data-testid={`row-account-${a.app}-${a.id}`}>
                      <td className="py-2"><AppBadge app={a.app} /></td>
                      <td className="py-2"><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{a.email ?? "—"}</div></td>
                      <td className="py-2">{a.plan}{a.monthly > 0 && <span className="text-xs text-muted-foreground"> · {money(a.monthly)}/mo</span>}</td>
                      <td className="py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[a.status] ?? "bg-slate-100 text-slate-600"}`}>{a.status.replace("_", " ")}</span></td>
                      <td className="py-2">{a.users}</td>
                      <td className="py-2 text-muted-foreground">{a.status === "trialing" ? `ends ${dateOnly(a.trialEndsAt)}` : a.periodEnd ? `renews ${dateOnly(a.periodEnd)}` : "—"}</td>
                      <td className="py-2 text-muted-foreground">{dateOnly(a.createdAt)}</td>
                      <td className="py-2 text-muted-foreground">{ago(a.lastLogin)}</td>
                      <td className="py-2">{a.app === "planning" ? (a.hasStripe ? "Linked" : "—") : "n/a"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border" data-testid="card-plan-prices">
          <h2 className="text-lg font-display font-bold mb-1">Plan prices</h2>
          <p className="text-xs text-muted-foreground mb-3">Monthly price per plan (CAD). Used for the revenue estimate; for annual plans enter the monthly equivalent.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {prices.map((p) => (
              <div key={`${p.app}-${p.plan}`} className="flex items-center justify-between gap-3 border border-border rounded-xl px-3 py-2 text-sm">
                <span><AppBadge app={p.app} /> <span className="ml-2">{p.plan}</span></span>
                <input type="number" min={0} step="0.01" defaultValue={p.price} disabled={!canPrice}
                  data-testid={`input-price-${p.app}-${p.plan}`}
                  onBlur={(e) => { const v = Number(e.target.value); if (v !== p.price && v >= 0) savePrice.mutate({ ...p, price: v }); }}
                  className="w-28 text-right border border-border rounded-lg px-2 py-1 bg-background" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </HostLayout>
  );
}
