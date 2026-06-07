import { useState } from "react";
import { translations, type T } from "../i18n/translations";
import { Sparkles, ClipboardList, FileSpreadsheet } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubShell } from "./insightled";
import { FinancialPlanTab } from "./planning/FinancialPlanTab";
import { FinancialPlanningContent } from "../pages/FinancialPlanning";

const queryClient = new QueryClient();

interface Props {
  clientId: number;
  client?: any;
  t?: T;
}

export function FinancialPlanHub({ clientId, client, t = translations.en }: Props) {
  const [subtab, setSubtab] = useState<"summary" | "workflow">("summary");

  return (
    <QueryClientProvider client={queryClient}>
      <HubShell
        icon={Sparkles}
        title={t.plan.title}
        subtitle={
          <>
            <span>{t.plan.planSummaryDesc}</span>
            <span>•</span>
            <span>{t.plan.endToEndWorkflow}</span>
          </>
        }
        subtabs={[
          { key: "summary",  label: t.plan.planSummary,     icon: FileSpreadsheet, badgeTone: "cyan"   },
          { key: "workflow", label: t.plan.detailedWorkflow, icon: ClipboardList,   badgeTone: "purple" },
        ]}
        activeSubtab={subtab}
        onSubtabChange={(k) => setSubtab(k as "summary" | "workflow")}
      >
        <div className={subtab === "summary" ? "p-6" : ""}>
          {subtab === "summary" && (
            <FinancialPlanTab t={t} clientId={clientId} clientName={client?.firstName} />
          )}
          {subtab === "workflow" && (
            <FinancialPlanningContent initialClientId={clientId} />
          )}
        </div>
      </HubShell>
    </QueryClientProvider>
  );
}
