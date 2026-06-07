import React from "react";
import { useState } from "react";
import { translations, type T } from "../i18n/translations";
import { PiggyBank, Building2, TrendingUp, TrendingDown, Calendar, Sparkles } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubShell } from "./insightled";
import { RetirementTab } from "./planning/RetirementProjectionForm";
import { ScenarioComparisonPanel } from "./planning/ScenarioComparisonPanel";
import { PensionTab } from "../pages/PensionTab";
import { MeltdownTab } from "../pages/MeltdownTab";
import { RetirementStrategist } from "./planning/RetirementStrategist";


const queryClient = new QueryClient();

type Subtab = "projection" | "pension" | "meltdown" | "strategist";

interface Props {
  clientId: number;
  client?: any;
  person: "primary" | "spouse" | "combined";
  onPersonChange: (p: "primary" | "spouse" | "combined") => void;
  t?: T;
}

export function RetirementHub({ clientId, client, person, onPersonChange, t = translations.en }: Props) {
  const [comparing, setComparing] = React.useState(false);
  const [subtab, setSubtab] = useState<Subtab>("pension");
  const hasSpouse = !!client?.spouseFirstName;
  const isUs = (client?.jurisdiction ?? "CA") === "US";

  const subtabs = [
    { key: "pension",    label: t.retirement.pension,      icon: Building2,    badgeTone: "purple" as const },
    ...(!isUs ? [{ key: "meltdown", label: t.retirement.rrspMeltdown, icon: TrendingDown, badge: "NEW", badgeTone: "cyan" as const }] : []),
    { key: "strategist", label: t.retirement.strategist,   icon: Sparkles,     badge: "AI",  badgeTone: "purple" as const },
    { key: "projection", label: t.retirement.projection,   icon: TrendingUp,   badgeTone: "cyan" as const },
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <HubShell
        icon={PiggyBank}
        title={t.retirement.title}
        subtitle={
          <>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Projection through age 95
            </span>
            <span>•</span>
            <span>Pension, savings & {isUs ? "strategy" : "meltdown strategy"} under one roof</span>
          </>
        }
        subtabs={subtabs}
        activeSubtab={subtab}
        onSubtabChange={(k) => setSubtab(k as Subtab)}
        personToggle={{
          person,
          onPersonChange,
          primaryLabel: client?.firstName ?? t.common.primary,
          spouseLabel: hasSpouse ? client.spouseFirstName : null,
          showCombined: true,
        }}
      >
        <div className="p-6">
          {subtab === "projection" && (
            <>
            <div className="flex justify-end px-6 pt-4">
              <button
                onClick={() => setComparing(true)}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
              >
                ⇄ Compare Scenarios
              </button>
            </div>
            <RetirementTab clientId={clientId} clientName={client?.firstName} person={person} t={t} />
            {comparing && (
              <ScenarioComparisonPanel
                clientId={clientId}
                onClose={() => setComparing(false)}
                t={t}
              />
            )}
          </>
          )}
          {subtab === "pension" && (
            <PensionTab clientId={clientId} client={client} person={person === "combined" ? "primary" : person} t={t} />
          )}
          {subtab === "meltdown" && !isUs && (
            <MeltdownTab clientId={clientId} client={client} person={person} />
          )}
          {subtab === "strategist" && (
            <RetirementStrategist clientId={clientId} client={client} person={person} />
          )}
        </div>
      </HubShell>
    </QueryClientProvider>
  );
}
