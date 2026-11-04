/**
 * HouseholdWorkspace.tsx
 * Enters household mode on mount, exits on unmount.
 * Content area driven by navigationStore.activeSection — no internal tabs.
 */
import { useEffect } from "react";
import { useNavigationStore } from "@/store/navigationStore";
import { HouseholdCommandHeader } from "./HouseholdCommandHeader";
import { ScenarioBar } from "./ScenarioBar";
import { usePlanningScenarioStore } from "@/store/planningScenarioStore";

// Planning content
import { NetWorthTab, InsuranceTab, TaxTab, EstateNotesTab } from "@/pages/FinancialPlanning";
import { RetirementTab } from "@/components/planning/RetirementProjectionForm";
import { RetirementWorkspaceCard, NetWorthWorkspaceCard, InsuranceWorkspaceCard, TaxStrategyCard } from "./cards/WorkspaceCards";

interface Props {
  clientId: number;
  client: Record<string, unknown>;
  allClients?: Record<string, unknown>[];
  onEdit?: () => void;
  onPopOut?: () => void;
  ProductsTab:  React.ComponentType<{ clientId: number }>;
  DocumentsTab: React.ComponentType<{ clientId: number }>;
  MeetingsTab:  React.ComponentType<{ clientId: number }>;
  ActivityTab:  React.ComponentType<{ clientId: number }>;
}

export function HouseholdWorkspace({
  clientId, client, allClients: _allClients = [], onEdit, onPopOut,
  ProductsTab: _ProductsTab, DocumentsTab, MeetingsTab, ActivityTab,
}: Props) {
  const { enterHousehold, exitHousehold, activeSection } = useNavigationStore();
  const { activeScenarioId, scenarios, setActiveScenario } = usePlanningScenarioStore();

  const _activeScenario = scenarios.find(s => s.id === activeScenarioId);

  // Enter household mode when this component mounts
  useEffect(() => {
    const name = client.spouseId
      ? `${client.firstName} ${client.lastName} Household`
      : `${client.firstName} ${client.lastName}`;
    enterHousehold({ id: clientId, name, province: client.province ?? undefined });
    return () => exitHousehold();
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Plans id for scenario matrix
  const planId = null; // will be fetched by sub-components as needed

  function renderSection() {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="grid grid-cols-2 gap-4">
            <RetirementWorkspaceCard clientId={clientId} scenario={activeScenarioId} />
            <NetWorthWorkspaceCard   clientId={clientId} />
            <InsuranceWorkspaceCard  clientId={clientId} />
            <TaxStrategyCard         clientId={clientId} client={client} />
          </div>
        );

      case 'retirement':
        return <RetirementTab clientId={clientId} clientName={client.firstName} />;

      case 'networth':
        return <NetWorthTab clientId={clientId} />;

      case 'insurance':
        return <InsuranceTab clientId={clientId} planId={planId} client={client} />;

      case 'tax':
        return <TaxTab clientId={clientId} client={client} />;

      case 'estate':
        return <EstateNotesTab clientId={clientId} planId={planId} />;

      case 'documents':
        return <DocumentsTab clientId={clientId} />;

      case 'meetings':
        return <MeetingsTab clientId={clientId} />;

      case 'activity':
        return <ActivityTab clientId={clientId} />;

      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Command header */}
      <HouseholdCommandHeader client={client} onEdit={onEdit} onPopOut={onPopOut} />

      {/* Scenario bar — only relevant for planning sections */}
      {['overview','retirement','networth','insurance','tax','estate'].includes(activeSection) && (
        <ScenarioBar
          activeScenario={activeScenarioId}
          onScenarioChange={setActiveScenario}
        />
      )}

      {/* Section content — full width, no left panel needed (sidebar drives nav) */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {renderSection()}
      </div>
    </div>
  );
}
