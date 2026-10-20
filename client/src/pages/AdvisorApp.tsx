/**
 * AdvisorApp — the shell for advisor-tier accounts.
 *
 * Layout: sidebar (AdvisorSidebar) + main content area.
 * On first load, shows AdvisorDashboard (client list).
 * When advisor clicks a client → loads the existing per-client
 * view tabs (overview, networth, retirement, etc.) from FPApp's
 * components, routed through the same Tab system as BrokersEdge.
 *
 * This file is intentionally self-contained: it owns tab state and
 * client-selection state. The underlying tab panels (NetWorthHub,
 * RetirementHub, etc.) are imported from the existing app — they
 * don't know or care whether they're in solo or advisor mode.
 */
import { useState } from "react";
import { AdvisorSidebar, type AdvisorTab } from "./AdvisorSidebar";
import { AdvisorDashboard } from "./AdvisorDashboard";
import { useAuth } from "../lib/auth";

// ── Lazy imports from the existing FPApp module system ─────────────────────
// The existing App.tsx already has all these panels wired to a "selected client".
// We re-use the same pattern: maintain selectedClientId + selectedClientName in
// this shell and pass them down.
//
// If your project exports these individually, import them directly.
// For now we dynamically render the inner app and pass the selected client.
import FPApp from "./App";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SelectedClient {
  id: number;
  name: string;
}

// ── AdvisorApp ────────────────────────────────────────────────────────────────
export default function AdvisorApp() {
  const { user, logout, accessToken } = useAuth();

  const [activeTab, setActiveTab] = useState<AdvisorTab>("clients");
  const [selectedClient, setSelectedClient] = useState<SelectedClient | null>(null);
  const [locale, setLocale] = useState<"en" | "fr">("en");

  // When advisor picks a client from the dashboard
  const handleSelectClient = (clientId: number, clientName: string) => {
    setSelectedClient({ id: clientId, name: clientName });
    setActiveTab("overview");
  };

  // When advisor wants to create a new client → go to clients tab with add intent
  const handleAddClient = () => {
    setActiveTab("clients");
    setSelectedClient(null);
  };

  // When advisor clicks "Clients" in sidebar → clear selection, show dashboard
  const handleTab = (tab: AdvisorTab) => {
    if (tab === "clients") {
      setSelectedClient(null);
    }
    setActiveTab(tab);
  };

  const advisorName = user
    ? `${(user as any).firstName ?? ""} ${(user as any).lastName ?? ""}`.trim() || user.email
    : undefined;

  // ── Show client detail panels ─────────────────────────────────────
  // When a client is selected and we're NOT on the "clients" tab,
  // delegate to the existing FPApp with the client pre-selected.
  // FPApp already knows how to render per-client panels.
  //
  // If your FPApp accepts a prop like `initialClientId` or uses a
  // shared context, wire it up here. The simplest integration:
  // render FPApp and let the advisor use its built-in client switcher.
  //
  // For a tighter integration, replace the FPApp render with
  // individual panel imports (NetWorthHub, RetirementHub, etc.)
  // and pass `selectedClient.id` to each.
  if (selectedClient && activeTab !== "clients") {
    return (
      <div className="flex h-screen overflow-hidden">
        <AdvisorSidebar
          activeTab={activeTab}
          onTab={handleTab}
          clientName={selectedClient.name}
          advisorName={advisorName}
          onLogout={logout}
          locale={locale}
          onLocaleChange={setLocale}
        />
        {/* Pass selected client into existing app shell */}
        <div className="flex-1 overflow-hidden">
          <FPApp
            advisorMode
            preSelectedClientId={selectedClient.id}
            activeTab={activeTab as any}
            onTabChange={(t: string) => setActiveTab(t as AdvisorTab)}
            onBackToClients={() => {
              setSelectedClient(null);
              setActiveTab("clients");
            }}
          />
        </div>
      </div>
    );
  }

  // ── Default: client list (dashboard) ──────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      <AdvisorSidebar
        activeTab={activeTab}
        onTab={handleTab}
        clientName={selectedClient?.name}
        advisorName={advisorName}
        onLogout={logout}
        locale={locale}
        onLocaleChange={setLocale}
      />
      <AdvisorDashboard
        onSelectClient={handleSelectClient}
        onAddClient={handleAddClient}
        accessToken={accessToken}
      />
    </div>
  );
}
