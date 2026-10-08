/**
 * PlanHealthAlerts
 *
 * Auto-generated severity-rated alerts derived from the client's plan data.
 * Ported from Testing Compass's ActionItems component.
 *
 * Usage:
 *   <PlanHealthAlerts clientId={clientId} onNavigate={(tab) => setTab(tab)} />
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Alert {
  id: string;
  severity: "danger" | "warn" | "info";
  title: string;
  detail: string;
  action: string;
  type: string;
}

interface PlanHealthAlertsProps {
  clientId: number;
  /** Optional: called when user clicks an alert's action button. */
  onNavigate?: (tab: string) => void;
}

const SEV_CONFIG = {
  danger: {
    bg: "bg-red-50 border-red-200",
    dot: "bg-red-500",
    badge: "destructive" as const,
    Icon: AlertCircle,
    iconClass: "text-red-500",
  },
  warn: {
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-400",
    badge: "secondary" as const,
    Icon: AlertTriangle,
    iconClass: "text-amber-500",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-400",
    badge: "secondary" as const,
    Icon: Info,
    iconClass: "text-blue-500",
  },
};

// Map alert types to app tab names for navigation
const ALERT_TAB: Record<string, string> = {
  retirement: "retirement",
  retirement_risk: "retirement",
  insurance: "protection",
  goals: "goals",
  goals_behind: "goals",
  high_rate_debt: "debt",
  net_worth: "networth",
};

export function PlanHealthAlerts({ clientId, onNavigate }: PlanHealthAlertsProps) {
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/health-alerts", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/health-alerts/${clientId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load health alerts");
      return res.json();
    },
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000, // 2 min
  });

  const dangerCount = alerts.filter((a) => a.severity === "danger").length;
  const warnCount = alerts.filter((a) => a.severity === "warn").length;

  return (
    <Card data-testid="plan-health-alerts">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-blue-500" />
            Plan health
          </span>
          {!isLoading && alerts.length > 0 && (
            <div className="flex gap-1.5">
              {dangerCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {dangerCount} critical
                </Badge>
              )}
              {warnCount > 0 && (
                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                  {warnCount} warning{warnCount > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Analysing plan…
          </p>
        ) : alerts.length === 0 ? (
          <div
            className="text-sm text-muted-foreground py-6 text-center"
            data-testid="health-alerts-empty"
          >
            No open action items — this plan is in great shape. 🎯
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const cfg = SEV_CONFIG[alert.severity];
              const tab = ALERT_TAB[alert.type];
              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${cfg.bg}`}
                  data-testid={`health-alert-${alert.type}`}
                >
                  <span
                    className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">
                      {alert.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {alert.detail}
                    </div>
                    {onNavigate && tab && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs font-semibold mt-1"
                        onClick={() => onNavigate(tab)}
                      >
                        {alert.action} →
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
