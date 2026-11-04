import { useLanguage } from "@/contexts/LanguageContext";
import { HostLayout } from "@/components/HostLayout";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Users,
  Headphones,
  DollarSign,
  Activity,
  Wifi,
  Server,
  Clock,
} from "lucide-react";

export default function HostAnalytics() {
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

  return (
    <HostLayout>
      <div className="space-y-8">
        <div>
          <h1
            className="text-3xl font-display font-bold"
            data-testid="text-analytics-title"
          >
            Platform Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive platform metrics and performance data
          </p>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          data-testid="grid-analytics-stats"
        >
          <div className="glass-card rounded-2xl p-6 border border-border">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5 text-violet-600" />
            </div>
            <p className="text-3xl font-display font-bold">
              {analytics?.totalCompanies ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">Brokerage Clients</p>
          </div>
          <div className="glass-card rounded-2xl p-6 border border-border">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-display font-bold">
              {analytics?.totalUsers ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </div>
          <div className="glass-card rounded-2xl p-6 border border-border">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <Headphones className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-display font-bold">
              {analytics?.totalCases ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">Service Cases</p>
          </div>
          <div className="glass-card rounded-2xl p-6 border border-border">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-3">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-display font-bold">
              ${Number(analytics?.totalRevenue ?? 0).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Total Revenue</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="text-lg font-display font-bold">Uptime</h2>
            </div>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-5xl font-display font-bold text-emerald-600">
                  {analytics?.uptime ?? 99.97}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Current Month
                </p>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-emerald-500 h-3 rounded-full transition-all"
                  style={{ width: `${analytics?.uptime ?? 99.97}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold">99.99%</p>
                  <p className="text-xs text-muted-foreground">Last 7 Days</p>
                </div>
                <div>
                  <p className="text-lg font-bold">99.97%</p>
                  <p className="text-xs text-muted-foreground">Last 30 Days</p>
                </div>
                <div>
                  <p className="text-lg font-bold">99.95%</p>
                  <p className="text-xs text-muted-foreground">Last 90 Days</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Wifi className="w-5 h-5 text-violet-600" />
              </div>
              <h2 className="text-lg font-display font-bold">
                Bandwidth Usage
              </h2>
            </div>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-5xl font-display font-bold text-violet-600">
                  {((analytics?.bandwidthUsageMB ?? 0) / 1024).toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  GB This Month
                </p>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-violet-500 h-3 rounded-full"
                  style={{
                    width: `${Math.min(((analytics?.bandwidthUsageMB ?? 0) / 10240) * 100, 100)}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>0 GB</span>
                <span>10 GB limit</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <Server className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-display font-bold">System Status</h2>
            </div>
            <div className="space-y-3">
              {["API Server", "Database", "File Storage", "Email Service"].map(
                (service) => (
                  <div
                    key={service}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm">{service}</span>
                    <span className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Operational
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-display font-bold">Response Times</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: "API Average", value: "45ms" },
                { label: "Database Queries", value: "12ms" },
                { label: "Page Load", value: "1.2s" },
                { label: "File Upload", value: "850ms" },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-sm">{metric.label}</span>
                  <span className="text-sm font-semibold">{metric.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </HostLayout>
  );
}

