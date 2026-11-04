/**
 * PlanningWorkspace.tsx
 * Center workspace — 4 simultaneous planning cards only.
 * Operational records moved to HouseholdContextPanel.
 */
import {
  RetirementWorkspaceCard,
  NetWorthWorkspaceCard,
  InsuranceWorkspaceCard,
  TaxStrategyCard,
} from "./cards/WorkspaceCards";

interface Props {
  clientId: number;
  client: Record<string, unknown>;
  scenario: string;
}

export function PlanningWorkspace({ clientId, client, scenario }: Props) {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="grid grid-cols-2 gap-4">
        <RetirementWorkspaceCard clientId={clientId} scenario={scenario} />
        <NetWorthWorkspaceCard   clientId={clientId} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InsuranceWorkspaceCard clientId={clientId} />
        <TaxStrategyCard        clientId={clientId} client={client} />
      </div>
    </div>
  );
}
