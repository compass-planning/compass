import { useState } from "react";
import { usePlanActionItems, useUpdateActionItem } from "@/hooks/use-plans";
import { CheckCircle, Clock, AlertTriangle, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

const moduleLabels: Record<string, string> = {
  retirement: "Retirement",
  insurance: "Insurance",
  education: "Education",
  debt: "Debt",
  tax: "Tax",
  estate: "Estate",
  cashflow: "Cash Flow",
};

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "text-red-700", bg: "bg-red-100" },
  high: { label: "High", color: "text-orange-700", bg: "bg-orange-100" },
  medium: { label: "Medium", color: "text-yellow-700", bg: "bg-yellow-100" },
  low: { label: "Low", color: "text-green-700", bg: "bg-green-100" },
};

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
  in_progress: { icon: ArrowRight, color: "text-blue-500", label: "In Progress" },
  completed: { icon: CheckCircle, color: "text-green-500", label: "Done" },
  dismissed: { icon: AlertTriangle, color: "text-muted-foreground", label: "Dismissed" },
};

export function ActionItemsPanel({ planId }: { planId: number }) {
  const { data: items = [], isLoading } = usePlanActionItems(planId);
  const updateItem = useUpdateActionItem(planId);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading action items...</div>;

  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const active = items.filter(i => i.status !== "completed" && i.status !== "dismissed")
    .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
  const completed = items.filter(i => i.status === "completed" || i.status === "dismissed");

  const cycleStatus = (currentStatus: string) => {
    const cycle = ["pending", "in_progress", "completed", "dismissed"];
    const idx = cycle.indexOf(currentStatus);
    return cycle[(idx + 1) % cycle.length];
  };

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground" data-testid="empty-action-items">
        <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No action items</p>
        <p className="text-sm mt-1">Action items will appear here after running simulations</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl p-6" data-testid="action-items-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold font-display">Action Items</h3>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{active.length} active</span>
          {completed.length > 0 && (
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="text-primary hover:underline flex items-center gap-1"
              data-testid="button-toggle-completed-items"
            >
              {showCompleted ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {completed.length} resolved
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {active.map(item => {
          const pCfg = priorityConfig[item.priority] || priorityConfig.medium;
          const sCfg = statusConfig[item.status] || statusConfig.pending;
          const StatusIcon = sCfg.icon;
          const isExpanded = expandedId === item.id;

          return (
            <div key={item.id} className="border border-border/50 rounded-xl p-3 hover:bg-muted/30 transition-colors" data-testid={`action-item-${item.id}`}>
              <div className="flex items-start gap-3">
                <button
                  onClick={() => updateItem.mutate({ id: item.id, data: { status: cycleStatus(item.status) } })}
                  className="mt-0.5 shrink-0"
                  data-testid={`button-cycle-status-${item.id}`}
                  title={`Status: ${sCfg.label}. Click to change.`}
                >
                  <StatusIcon className={`w-5 h-5 ${sCfg.color}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{item.title}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pCfg.bg} ${pCfg.color}`}>{pCfg.label}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{moduleLabels[item.module] || item.module}</span>
                  </div>
                  {isExpanded && (
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="shrink-0 p-1 hover:bg-muted rounded"
                  data-testid={`button-expand-item-${item.id}`}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showCompleted && completed.length > 0 && (
        <div className="mt-4 pt-4 border-t space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resolved Items</p>
          {completed.map(item => {
            const pCfg = priorityConfig[item.priority] || priorityConfig.medium;
            const sCfg = statusConfig[item.status] || statusConfig.pending;
            const StatusIcon = sCfg.icon;
            return (
              <div key={item.id} className="border border-border/30 rounded-xl p-3 opacity-60" data-testid={`action-item-completed-${item.id}`}>
                <div className="flex items-center gap-3">
                  <StatusIcon className={`w-4 h-4 ${sCfg.color}`} />
                  <span className="text-sm line-through">{item.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pCfg.bg} ${pCfg.color}`}>{pCfg.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
