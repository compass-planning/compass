import { useState } from "react";
import { Sparkles, ClipboardList, FileSpreadsheet } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubShell } from "./insightled";
import { FinancialPlanTab } from "./planning/FinancialPlanTab";
import { FinancialPlanningContent } from "../pages/FinancialPlanning";
import { useLanguage } from "@/contexts/LanguageContext";

const queryClient = new QueryClient();

interface Props {
  clientId: number;
  client?: Record<string, unknown>;
}

export function FinancialPlanHub({ clientId, client }: Props) {
  const [subtab, setSubtab] = useState<"summary" | "workflow">("summary");
  const { isFrench } = useLanguage();

  return (
    <QueryClientProvider client={queryClient}>
      <HubShell
        icon={Sparkles}
        title={isFrench ? "Plan financier" : "Financial Plan"}
        subtitle={
          <>
            <span>{isFrench ? "Sommaire du plan" : "Plan summary"}</span>
            <span>•</span>
            <span>{isFrench ? "Flux de travail complet" : "End-to-end planning workflow"}</span>
          </>
        }
        subtabs={[
          { key: "summary",  label: isFrench ? "Sommaire du plan"   : "Plan Summary",      icon: FileSpreadsheet, badgeTone: "cyan"   },
          { key: "workflow", label: isFrench ? "Flux de travail"     : "Detailed Workflow", icon: ClipboardList,   badgeTone: "purple" },
        ]}
        activeSubtab={subtab}
        onSubtabChange={(k) => setSubtab(k as "summary" | "workflow")}
      >
        <div className={subtab === "summary" ? "p-6" : ""}>
          {subtab === "summary" && (
            <FinancialPlanTab clientId={clientId} clientName={client?.firstName} />
          )}
          {subtab === "workflow" && (
            <FinancialPlanningContent initialClientId={clientId} />
          )}
        </div>
      </HubShell>
    </QueryClientProvider>
  );
}
