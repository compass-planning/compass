import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import FPApp from "./pages/App";
import { Toaster } from "./components/ui/toaster";
import "./index.css";
import "./i18n";
import { useInactivityTimeout } from "./hooks/useInactivityTimeout";
import { registerToast } from "./lib/toast";
import { useToast } from "./hooks/use-toast";

function Root() {
  const { user, fbUser, loading, logout } = useAuth();
  const { toast: toastFn } = useToast();

  registerToast(({ title, description, variant }) =>
    toastFn({ title, description, variant })
  );

  useInactivityTimeout(() => { if (user) logout(); });

  if (loading) return (
    <div className="h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
        <span className="text-slate-400 text-sm font-medium">Loading…</span>
      </div>
    </div>
  );

  // Not authenticated → login
  if (!user || !fbUser) return <Login />;

  // Email not verified → show banner but still allow access
  // Firebase handles re-sending verification emails
  return <FPApp />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <Toaster />
      <Root />
    </AuthProvider>
  </React.StrictMode>
);
