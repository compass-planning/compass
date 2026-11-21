import { useLanguage } from "@/contexts/LanguageContext";
import { HostLayout } from "@/components/HostLayout";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Building2,
  Users,
  Headphones,
  DollarSign,
  ArrowUpRight,
  Activity,
  Wifi,
} from "lucide-react";
import type { ServiceCase, HostInvoice } from "@shared/schema";

export default function HostDashboard() {
  const { isFrench: isFr } = useLanguage();
  const { data: analytics } = useQuery<{
    totalCompanies: number;
    totalUsers: number;
    totalCases: number;
    totalRevenue: string;
    uptime: number;
    bandwidthUsageMB: number;
  }>({
    queryKey: ["/api/crm/host/analytics"],
  });
  const { data: recentCases } = useQuery<ServiceCase[]>({
    queryKey: ["/api/crm/host/cases"],
  });
  const { data: recentInvoices } = useQuery<HostInvoice[]>({
    queryKey: ["/api/crm/host/invoices"],
  });

  const stats = [
    {
      label: "Business Clients",
      value: analytics?.totalCompanies ?? 0,
      icon: Building2,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "Total Users",
      value: analytics?.totalUsers ?? 0,
      icon: Users,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Active Cases",
      value: analytics?.totalCases ?? 0,
      icon: Headphones,
      color: "text-orange-600 bg-orange-50",
    },
    {
      label: isFr ? "Revenus" : "Revenue",
      value: `$${Number(analytics?.totalRevenue ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-purple-600 bg-purple-50",
    },
  ];

  return (
    <HostLayout>
      <div className="space-y-8">
        <div>
          <h1
            className="text-3xl font-display font-bold"
            data-testid="text-host-title"
          >
            Corporate Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of all platform operations
          </p>
        </div>

        <OverviewStrip />
        <SecurityBanner />

        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          data-testid="grid-host-stats"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="glass-card rounded-2xl p-6 border border-border"
              data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}
                >
                  <stat.icon className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-display font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-bold">
                Platform Health
              </h2>
              <Activity className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Uptime</span>
                <span className="text-sm font-semibold text-emerald-600">
                  {analytics?.uptime ?? 99.97}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${analytics?.uptime ?? 99.97}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Bandwidth Usage
                  </span>
                </div>
                <span className="text-sm font-semibold">
                  {((analytics?.bandwidthUsageMB ?? 0) / 1024).toFixed(1)} GB
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-border">
            <h2 className="text-lg font-display font-bold mb-4">
              Recent Service Cases
            </h2>
            {(recentCases?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No service cases yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentCases?.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    data-testid={`case-row-${c.id}`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{c.caseNumber}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {c.title}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        c.status === "open"
                          ? "bg-red-50 text-red-600"
                          : c.status === "in_progress"
                            ? "bg-yellow-50 text-yellow-600"
                            : c.status === "resolved"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {c.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border">
          <h2 className="text-lg font-display font-bold mb-4">
            Recent Invoices
          </h2>
          {(recentInvoices?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices?.slice(0, 5).map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  data-testid={`invoice-row-${inv.id}`}
                >
                  <div>
                    <p className="text-sm font-semibold">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      ${Number(inv.amount).toLocaleString()}
                    </p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        inv.status === "paid"
                          ? "bg-emerald-50 text-emerald-600"
                          : inv.status === "overdue"
                            ? "bg-red-50 text-red-600"
                            : inv.status === "sent"
                              ? "bg-violet-50 text-violet-600"
                              : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </HostLayout>
  );
}


/** Shows only when something needs attention (lockout, brute-force alert, MFA failure) in the last 24h. Hidden for roles without access. */
function SecurityBanner() {
  const { data } = useQuery<{ counts: Record<string, number>; locked: unknown[] }>({
    queryKey: ["/api/crm/host/security/summary?range=24h"],
    retry: false,
    refetchInterval: 60000,
  });
  if (!data) return null;
  const c = data.counts ?? {};
  const n = (c.account_locked ?? 0) + (c.ip_burst_alert ?? 0) + (c.mfa_failed ?? 0);
  if (n === 0) return null;
  return (
    <Link href="/host/security">
      <div
        className="rounded-2xl border border-red-200 bg-red-50 text-red-800 p-4 flex items-center justify-between cursor-pointer hover:bg-red-100"
        data-testid="banner-dashboard-security"
      >
        <span className="text-sm font-medium">
          {n} security alert{n === 1 ? "" : "s"} in the last 24 hours
          {data.locked?.length ? ` · ${data.locked.length} account${data.locked.length === 1 ? "" : "s"} locked now` : ""}
        </span>
        <span className="text-xs font-semibold">Review →</span>
      </div>
    </Link>
  );
}


/** One-glance status across the whole platform; each chip only shows for roles that can open that page. */
function OverviewStrip() {
  const { data } = useQuery<any>({ queryKey: ["/api/crm/host/overview"], retry: false, refetchInterval: 60000 });
  if (!data) return null;
  const chips: { key: string; label: string; href: string; bad: boolean }[] = [];
  if (data.uptime) chips.push({ key: "uptime", label: data.uptime.status === "up" ? "Systems up" : data.uptime.status === "unknown" ? "Monitoring starting" : `Systems ${data.uptime.status}`, href: "/host/uptime", bad: data.uptime.status === "down" || data.uptime.status === "stale" });
  if (data.security) chips.push({ key: "security", label: `${data.security.alerts} security alert${data.security.alerts === 1 ? "" : "s"} (24h)`, href: "/host/security", bad: data.security.alerts > 0 });
  if (data.issues) chips.push({ key: "issues", label: `${data.issues.open} open client issue${data.issues.open === 1 ? "" : "s"}`, href: "/host/issues", bad: data.issues.open > 0 });
  if (data.privacy) chips.push({ key: "privacy", label: `${data.privacy.open_breaches} open breach${data.privacy.open_breaches === 1 ? "" : "es"} · ${data.privacy.overdue_requests} overdue request${data.privacy.overdue_requests === 1 ? "" : "s"}`, href: "/host/privacy", bad: data.privacy.open_breaches + data.privacy.overdue_requests > 0 });
  if (data.accounts) chips.push({ key: "accounts", label: `${data.accounts.accounts} accounts · ${data.accounts.past_due} past due`, href: "/host/accounts", bad: data.accounts.past_due > 0 });
  if (!chips.length) return null;
  return (
    <div className="flex gap-2 flex-wrap" data-testid="strip-overview">
      {chips.map((c) => (
        <Link key={c.key} href={c.href}>
          <span data-testid={`chip-${c.key}`} className={`cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-full border ${c.bad ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{c.label}</span>
        </Link>
      ))}
    </div>
  );
}
