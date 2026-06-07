import { useState } from "react";
import { translations, type T } from "../i18n/translations";
import { Receipt, ScrollText, Scale } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubShell } from "./insightled";
import { TaxTab, EstateNotesTab } from "../pages/FinancialPlanning";
import { UsTaxTab } from "../pages/UsTaxTab";

const queryClient = new QueryClient();

interface Props {
  clientId: number;
  client?: any;
  person: "primary" | "spouse" | "combined";
  onPersonChange: (p: "primary" | "spouse" | "combined") => void;
  t?: T;
}

export function TaxEstateHub({ clientId, client, person, onPersonChange, t = translations.en }: Props) {
  const [subtab, setSubtab] = useState<"tax" | "estate">("tax");
  const hasSpouse = !!client?.spouseFirstName;

  return (
    <QueryClientProvider client={queryClient}>
      <HubShell
        icon={Scale}
        title={t.taxEstate.title}
        subtitle={
          <>
            <span>{t.taxEstate.taxPlanning}</span>
            <span>•</span>
            <span>{t.taxEstate.estatePlanning}</span>
          </>
        }
        subtabs={[
          { key: "tax",    label: t.taxEstate.tax,    icon: Receipt,    badgeTone: "amber"  },
          { key: "estate", label: t.taxEstate.estate, icon: ScrollText, badgeTone: "purple" },
        ]}
        activeSubtab={subtab}
        onSubtabChange={(k) => setSubtab(k as "tax" | "estate")}
        personToggle={
          subtab === "tax"
            ? {
                person,
                onPersonChange,
                primaryLabel: client?.firstName ?? t.common.primary,
                spouseLabel: hasSpouse ? client.spouseFirstName : null,
                showCombined: true,
              }
            : undefined
        }
      >
        <div className="p-6">
  {subtab === "tax" && client?.jurisdiction === "US" && (
    <UsTaxTab clientId={clientId} client={client} />
  )}
  {subtab === "tax" && client?.jurisdiction !== "US" && (
    <TaxTab clientId={clientId} client={client} person={person === "combined" ? "primary" : person} t={t} />
  )}
  {subtab === "estate" && (
    <EstateNotesTab clientId={clientId} planId={null} client={client} />
  )}
</div>
      </HubShell>
    </QueryClientProvider>
  );
}
