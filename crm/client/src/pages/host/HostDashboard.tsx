import { useLanguage } from "@/contexts/LanguageContext";
import { HostLayout } from "@/components/HostLayout";
import { useQuery } from "@tanstack/react-query";
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

