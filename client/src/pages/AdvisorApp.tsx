/**
 * AdvisorApp — the shell for advisor-tier accounts.
 *
 * Layout: AdvisorSidebar + content area.
 *
 * Top-level tabs (no client needed):
 *   • clients → AdvisorDashboard (client list; advisor is NOT a household)
 *   • setup   → AdvisorSetup    (account info, billing, subscription)
 *
 * Per-client tabs (after selecting a client from the dashboard):
 *   overview, dashboard, networth, goals, debt, retirementhub,
 *   protection, expenses, taxestate, ai, documents, fp, profile
 *   → delegate to FPApp in advisor mode with the selected client pre-loaded.
 */
import { useState } from "react";
import { AdvisorSidebar, type AdvisorTab } from "./AdvisorSidebar";
import { AdvisorDashboard } from "./AdvisorDashboard";
import { AdvisorSetup } from "./AdvisorSetup";
import { useAuth } from "../lib/auth";
import FPApp from "./App";

interface SelectedClient {
  id: number;
  name: string;
}

export default function AdvisorApp() {
  const { user, logout, accessToken } = useAuth();

  const [activeTab, setActiveTab]         = useState<AdvisorTab>("clients");
  const [selectedClient, setSelectedClient] = useState<SelectedClient | null>(null);
  const [locale, setLocale]               = useState<"en" | "fr">("en");

  // Advisor's display name for the sidebar footer
  const advisorName = user
    ? `${(user as any).firstName ?? ""} ${(user as any).lastName ?? ""}`.trim() || user.email
    : undefined;

  // ── Tab handler ───────────────────────────────────────────────────────────
  const handleTab = (tab: AdvisorTab) => {
    // "clients" always clears the active client and returns to the dashboard
    if (tab === "clients") setSelectedClient(null);
    setActiveTab(tab);
  };

  // ── Client selection ──────────────────────────────────────────────────────
  const handleSelectClient = (clientId: number, clientName: string) => {
    setSelectedClient({ id: clientId, name: clientName });
    setActiveTab("overview");
  };

  const handleAddClient = () => {
    setSelectedClient(null);
    setActiveTab("clients");
  };

  // ── Content area ──────────────────────────────────────────────────────────
  let content: React.ReactNode;

  if (selectedClient && activeTab !== "clients" && activeTab !== "setup") {
    // Per-client view: delegate to the existing FPApp with advisor mode on
    content = (
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
    );
  } else if (activeTab === "setup") {
    content = <AdvisorSetup />;
  } else {
    // Default: clients dashboard
    content = (
      <AdvisorDashboard
        onSelectClient={handleSelectClient}
        onAddClient={handleAddClient}
        accessToken={accessToken}
      />
    );
  }

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
      <div className="flex-1 overflow-hidden">
        {content}
      </div>
    </div>
  );
}
