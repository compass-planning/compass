import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider, useAuth } from "./lib/auth";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import FPApp from "./pages/App";
import { Toaster } from "./components/ui/toaster";
import "./index.css";
import "./i18n";
import { useInactivityTimeout } from "./hooks/useInactivityTimeout";
import { registerToast } from "./lib/toast";
import { useToast } from "./hooks/use-toast";

type Screen = "landing" | "login";

function Root() {
  const { user, loading, logout } = useAuth();
  const { toast: toastFn } = useToast();
  const [screen, setScreen] = useState<Screen>("landing");

  registerToast(({ title, description, variant }) =>
    toastFn({ title, description, variant })
  );

  useInactivityTimeout(() => { if (user) logout(); });

  if (loading) return (
    <div className="h-screen bg-[#0f0a1e] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
        <span className="text-white/40 text-sm font-medium">Loading…</span>
      </div>
    </div>
  );

  // Authenticated → main app
  if (user) return <FPApp />;

  // Landing → Login flow
  if (screen === "landing") {
    return (
      <LandingPage
        onNavigateToLogin={() => setScreen("login")}
      />
    );
  }

  return (
    <LoginPage
      onNavigateToLanding={() => setScreen("landing")}
    />
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <Toaster />
      <Root />
    </AuthProvider>
  </React.StrictMode>
);
