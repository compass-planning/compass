/**
 * client/src/lib/auth.tsx
 * Self-hosted JWT auth context. No Firebase dependency.
 *
 * Token flow:
 *  - accessToken  (8h)  stored in memory (never localStorage — XSS safe)
 *  - refreshToken (30d) stored in localStorage (used only to get new access tokens)
 *
 * Login flow:
 *  1. POST /api/auth/login → { accessToken, nextStep: "totp-verify" | "totp-setup" }
 *  2. POST /api/auth/totp/verify or /totp/enable → { accessToken, refreshToken }
 *  3. Full access token issued — app loads
 */

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";

export interface User {
  id:                 number;
  email:              string;
  firstName:          string;
  lastName:           string;
  firmName?:          string | null;
  jurisdiction?:      string;
  province?:          string | null;
  subscriptionTier?:  string;
  subscriptionStatus?: string;
  trialEndsAt?:       string | null;
  currentPeriodEnd?:  string | null;
  mustResetPassword?: boolean | null;
  totpEnabledAt?:     string | null;
  emailVerifiedAt?:   string | null;
}

interface AuthCtx {
  user:         User | null;
  loading:      boolean;
  accessToken:  string | null;
  setAccessToken: (token: string | null) => void;
  logout:       () => void;
  refresh:      () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true, accessToken: null,
  setAccessToken: () => {}, logout: () => {}, refresh: async () => {},
});

// In-memory token store — never written to localStorage (XSS protection)
let _memToken: string | null = null;

export function getMemToken(): string | null { return _memToken; }
export function setMemToken(t: string | null) { _memToken = t; }

const REFRESH_KEY = "compass_refresh";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, _setAccessToken] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>();

  function setAccessToken(token: string | null) {
    _memToken = token;
    _setAccessToken(token);
  }

  async function fetchUser(token: string): Promise<User | null> {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  async function doRefresh(): Promise<string | null> {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) return null;
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) { localStorage.removeItem(REFRESH_KEY); return null; }
      const { accessToken: at } = await res.json();
      return at;
    } catch { return null; }
  }

  async function refresh() {
    const at = await doRefresh();
    if (at) {
      setAccessToken(at);
      const u = await fetchUser(at);
      setUser(u);
      scheduleRefresh();
    } else {
      logout();
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer.current);
    // Refresh 10 minutes before the 8h token expires
    refreshTimer.current = setTimeout(refresh, (8 * 60 - 10) * 60 * 1000);
  }

  // On mount — attempt silent re-auth from refresh token
  useEffect(() => {
    (async () => {
      const at = await doRefresh();
      if (at) {
        setAccessToken(at);
        const u = await fetchUser(at);
        setUser(u);
        scheduleRefresh();
      }
      setLoading(false);
    })();
    return () => clearTimeout(refreshTimer.current);
  }, []);

  function logout() {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(REFRESH_KEY);
    clearTimeout(refreshTimer.current);
  }

  // Called by Login.tsx after successful TOTP verification
  function onLogin(at: string, rt?: string | null) {
    setAccessToken(at);
    if (rt) localStorage.setItem(REFRESH_KEY, rt);
    fetchUser(at).then(u => setUser(u));
    scheduleRefresh();
  }

  return (
    <Ctx.Provider value={{ user, loading, accessToken, setAccessToken, logout, refresh }}>
      <LoginCallbackCtx.Provider value={onLogin}>
        {children}
      </LoginCallbackCtx.Provider>
    </Ctx.Provider>
  );
}

// Separate context for the login callback so Login.tsx can call it
const LoginCallbackCtx = createContext<(at: string, rt?: string | null) => void>(() => {});

export function useAuth()          { return useContext(Ctx); }
export function useLoginCallback() { return useContext(LoginCallbackCtx); }
