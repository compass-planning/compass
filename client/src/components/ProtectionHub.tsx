import { useEffect, useState } from "react";
import { translations, type T } from "../i18n/translations";
import { Shield, FileHeart, Calendar, Heart, Briefcase } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubShell } from "./insightled";
import { PoliciesTab } from "../pages/PoliciesTab";
import { LTCTab } from "./planning/LTCTab";
import { DITab }  from "./planning/DITab";
import { InsuranceTab as FnaWorksheetTab } from "../pages/FinancialPlanning";
import { api } from "../lib/api";

const queryClient = new QueryClient();

interface Policy {
  id: number;
  type: string;
  insured: string;
  coverageAmount: string;
  premium: string;
  premiumFrequency: string;
}

interface Props {
  clientId: number;
  client?: any;
  person: "primary" | "spouse" | "combined";
  onPersonChange: (p: "primary" | "spouse" | "combined") => void;
  t?: T;
}

const fmt$ = (n: number) =>
  "$" + n.toLocaleString("en-CA", { maximumFractionDigits: 0 });

function annualPremium(p: Policy): number {
  const v = parseFloat(p.premium || "0");
  const mult: Record<string, number> = { Monthly: 12, Quarterly: 4, "Semi-Annual": 2, Annual: 1 };
  return v * (mult[p.premiumFrequency] ?? 12);
}

export function ProtectionHub({ clientId, client, person, onPersonChange, t = translations.en }: Props) {
  const [subtab, setSubtab] = useState<"coverage" | "gap" | "ltc" | "di">("coverage");
  const [policies, setPolicies] = useState<Policy[]>([]);

  useEffect(() => {
    api.get<Policy[]>(`/api/clients/${clientId}/policies`)
      .then(setPolicies)
      .catch(() => setPolicies([]));
  }, [clientId]);

  const totalPremium = policies.reduce((s, p) => s + annualPremium(p), 0);
  const hasSpouse = !!client?.spouseFirstName;
  const spouseLabel = hasSpouse
    ? client.spouseFirstName
    : null;

  return (
    <QueryClientProvider client={queryClient}>
      <HubShell
        icon={Shield}
        title={t.insurance.title}
        subtitle={
          <>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> {policies.length} active {policies.length === 1 ? "policy" : "policies"}
            </span>
            <span>•</span>
            <span>{t.insurance.subtitle} {fmt$(totalPremium)}</span>
          </>
        }
        
        subtabs={[
          {
            key: "coverage",
            label: t.insurance.coverage,
            icon: Shield,
            badge: String(policies.length),
            badgeTone: "cyan",
          },
          {
            key: "gap",
            label: t.insurance.gapAnalysis,
            icon: FileHeart,
            badgeTone: "amber",
          },
          {
            key: "ltc",
            label: t.insurance.ltcPlanning,
            icon: Heart,
            badgeTone: "cyan",
          },
          {
            key: "di",
            label: t.insurance.diPlanning,
            icon: Briefcase,
            badgeTone: "amber",
          },
        ]}
        activeSubtab={subtab}
        onSubtabChange={(k) => setSubtab(k as "coverage" | "gap")}
        personToggle={{
          person,
          onPersonChange,
          primaryLabel: client?.firstName ?? t.common.primary,
          spouseLabel,
          showCombined: false,
        }}
      >
        <div className="p-6">
          {subtab === "coverage" && (
            <PoliciesTab clientId={clientId} client={client} t={t} />
          )}
          {subtab === "gap" && (
            <FnaWorksheetTab clientId={clientId} planId={null} client={client} />
          )}
          {subtab === "ltc" && (
            <LTCTab clientId={clientId} client={client} t={t} />
          )}
          {subtab === "di" && (
            <DITab clientId={clientId} client={client} t={t} />
          )}
        </div>
      </HubShell>
    </QueryClientProvider>
  );
}
