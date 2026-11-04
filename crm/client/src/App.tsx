import { VoiceProvider } from "./contexts/VoiceContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import "../src/i18n"; // initialise i18next once at root
import { useState, useEffect } from "react";
import { Router, Switch, Route, Redirect } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import {
  QueryClientProvider,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useHostUser } from "@/hooks/use-host";
import {
  WindowManagerProvider,
  useWindowManager,
} from "@/contexts/WindowManagerContext";
import { FloatingWindow } from "@/components/FloatingWindow";
import { WindowDock } from "@/components/WindowDock";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import { EmailSetupModal } from "@/components/EmailSetupModal";
import Briefing from "@/pages/Briefing";
import { IdleSessionGuard } from "@/components/IdleSessionGuard";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import UserManagement from "./pages/UserManagement";
import Email from "./pages/Email";
import Calendar from "./pages/Calendar";
import MeetingRecorder from "./pages/MeetingRecorder";
import Analytics from "./pages/Analytics";
import Pipeline from "./pages/Pipeline";
import SettingsPage from "./pages/SettingsPage";
import CompanySettings from "./pages/CompanySettings";
import Tasks from "./pages/Tasks";
import FinancialPlanning from "./pages/FinancialPlanning";
import HostDashboard from "./pages/host/HostDashboard";
import BusinessClients from "./pages/host/BusinessClients";
import BusinessDetail from "./pages/host/BusinessDetail";
import HostAnalytics from "./pages/host/HostAnalytics";
import Accounting from "./pages/host/Accounting";
import ServiceCases from "./pages/host/ServiceCases";
import HostSettings from "./pages/host/HostSettings";
import HostUsers from "./pages/host/HostUsers";
import HostInbox from "./pages/host/HostInbox";
import HostCalendar from "./pages/host/HostCalendar";

// Public (signed-out) routes: shared Compass landing page + separate auth pages.
function PublicRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      {/* The shared Compass landing page lives at "/" (Compass Planning app). Inside /crm, unknown paths go to sign-in. */}
      <Route><Redirect to="/login" /></Route>
    </Switch>
  );
}

function HostRouter() {
  return (
    <Switch>
      <Route path="/login"><Redirect to="/" /></Route>
      <Route path="/register"><Redirect to="/" /></Route>
      <Route path="/forgot-password"><Redirect to="/" /></Route>
      <Route path="/host" component={HostDashboard} />
      <Route path="/host/inbox" component={HostInbox} />
      <Route path="/host/calendar" component={HostCalendar} />
      <Route path="/host/clients" component={BusinessClients} />
      <Route path="/host/clients/:id" component={BusinessDetail} />
      <Route path="/host/analytics" component={HostAnalytics} />
      <Route path="/host/accounting" component={Accounting} />
      <Route path="/host/service" component={ServiceCases} />
      <Route path="/host/users" component={HostUsers} />
      <Route path="/host/settings" component={HostSettings} />
      <Route path="/" component={HostDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/login"><Redirect to="/" /></Route>
      <Route path="/register"><Redirect to="/" /></Route>
      <Route path="/forgot-password"><Redirect to="/" /></Route>
      <Route path="/" component={Dashboard} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={FinancialPlanning} />
      <Route path="/users" component={UserManagement} />
      <Route path="/email" component={Email} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/meeting-recorder" component={MeetingRecorder} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/briefing" component={Briefing} />
      <Route path="/pipeline" component={Pipeline} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/company-settings" component={CompanySettings} />
      <Route path="/financial-planning" component={FinancialPlanning} />
      <Route component={NotFound} />
    </Switch>
  );
}

function FloatingWindowLayer() {
  const { windows } = useWindowManager();
  if (windows.length === 0) return null;
  return (
    <>
      {windows.map((win) => (
        <FloatingWindow key={win.id} win={win} />
      ))}
      <WindowDock />
    </>
  );
}

function ForcePasswordChangeModal() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const qc = useQueryClient();

  const changeMutation = useMutation({
    mutationFn: async (data: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const res = await apiRequest("POST", "/api/crm/auth/change-password", data);
      return res.json();
    },
    onSuccess: () => {
      qc.setQueryData(["/api/crm/auth/user"], (old: Record<string, unknown>) =>
        old ? { ...old, mustChangePassword: false } : old,
      );
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to change password");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    changeMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold" data-testid="text-force-password-title">
                Change Your Password
              </h2>
              <p className="text-sm text-muted-foreground">
                You must set a new password before continuing.
              </p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4" data-testid="form-force-password">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm" data-testid="text-force-password-error">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">
              Current (Temporary) Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                data-testid="input-force-current-password"
                className="w-full px-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                data-testid="button-toggle-current-password"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                data-testid="input-force-new-password"
                className="w-full px-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                data-testid="button-toggle-new-password"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              data-testid="input-force-confirm-password"
              className="w-full px-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={changeMutation.isPending}
            data-testid="button-force-change-password"
            className="w-full py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
          >
            {changeMutation.isPending ? "Changing..." : "Set New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function EmailSetupCheck() {
  const [showSetup, setShowSetup] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { data: emailConfig } = useQuery<{
    hasConfig: boolean;
    isActive: boolean;
    provider: string | null;
    emailSetupSkipped: boolean;
    staffEmail: string;
  }>({ queryKey: ["/api/crm/email/config"] });

  useEffect(() => {
    if (emailConfig && !emailConfig.isActive && !emailConfig.emailSetupSkipped && !dismissed) {
      setShowSetup(true);
    }
  }, [emailConfig, dismissed]);

  if (!showSetup) return null;

  return (
    <EmailSetupModal
      onClose={() => { setShowSetup(false); setDismissed(true); }}
      onComplete={() => { setShowSetup(false); setDismissed(true); }}
    />
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { data: hostData, isLoading: hostLoading } = useHostUser();

  if (isLoading || (isAuthenticated && hostLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PublicRouter />;
  }

  if (hostData?.isHostUser) {
    return (
      <>
        <IdleSessionGuard />
        <EmailSetupCheck />
        <HostRouter />
      </>
    );
  }

  return (
    <>
      <IdleSessionGuard />
      {user?.mustChangePassword && <ForcePasswordChangeModal />}
      {!user?.mustChangePassword && <EmailSetupCheck />}
      <AuthenticatedRouter />
      <FloatingWindowLayer />
    </>
  );
}

// ── Inner app wrapped by LanguageProvider so useAuth() is available ──────────
function AppWithLanguage() {
  const { user } = useAuth();
  return (
    <LanguageProvider
      userProvince={(user as any)?.province}
      savedLocale={(user as any)?.preferredLanguage}
    >
      <VoiceProvider>
        <TooltipProvider>
          <WindowManagerProvider>
            <Toaster />
            <AppContent />
          </WindowManagerProvider>
        </TooltipProvider>
      </VoiceProvider>
    </LanguageProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* The CRM is served by the Compass server under /crm */}
      <Router base="/crm">
        <AppWithLanguage />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
