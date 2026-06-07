import React, { useCallback } from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import FPApp from "./pages/App";
import { Toaster } from "./components/ui/toaster";
import "./index.css";
import "./i18n";
import { useInactivityTimeout } from "./hooks/useInactivityTimeout";
import { registerToast } from "./lib/toast";
import { useToast } from "./hooks/use-toast";

function Root() {
  const { user, loading, logout } = useAuth();
  const { toast: toastFn } = useToast();

  registerToast(({ title, description, variant }) =>
    toastFn({ title, description, variant })
  );

  useInactivityTimeout(useCallback(() => {
    if (user) logout();
  }, [user, logout]));

  if (loading) return (
    <div className="h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-slate-400 text-sm font-medium">Loading…</span>
      </div>
    </div>
  );

  // Authenticated → app
  if (user) return <FPApp />;

  // Route /register to the new standalone registration + plan picker
  const path = window.location.pathname;
  if (path === "/register" || path.startsWith("/register/")) {
    return (
      <Register
        onSuccess={() => { window.location.href = "/app"; }}
        onLogin={() => { window.location.href = "/"; }}
      />
    );
  }

  // Default → login
  return <Login />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <Toaster />
      <Root />
    </AuthProvider>
  </React.StrictMode>
);
