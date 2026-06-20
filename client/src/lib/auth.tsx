/**
 * client/src/lib/auth.tsx
 * Firebase-based auth context.
 * Firebase handles all auth UI/logic; we sync with our Postgres backend.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  auth,
  onAuthStateChanged,
  signOut,
  type FirebaseUser,
} from "./firebase";
import { api } from "./api";

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
  emailVerified?:     boolean;  // from Firebase
}

interface AuthCtx {
  user:    User | null;
  fbUser:  FirebaseUser | null;
  loading: boolean;
  logout:  () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, fbUser: null, loading: true,
  logout: async () => {}, refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [fbUser,  setFbUser]  = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function syncUser(firebaseUser: FirebaseUser) {
    try {
      const idToken = await firebaseUser.getIdToken(true); // force refresh
      localStorage.setItem("fb_token", idToken);
      
      const profile = await api.get<User>("/api/auth/me");
      setUser({ ...profile, emailVerified: firebaseUser.emailVerified });
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("429") || msg.includes("Too many")) {
        // Rate limited — keep existing state, retry in 30s
        console.warn("[auth] Rate limited — will retry");
        setTimeout(() => syncUser(firebaseUser), 30000);
        return;
      }
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("not found")) {
        // No Postgres record — user needs to complete registration
        // Don't loop — just clear so they go back to login
        setUser(null);
        localStorage.removeItem("fb_token");
        return;
      }
      setUser(null);
      localStorage.removeItem("fb_token");
    }
  }

  async function refresh() {
    if (fbUser) await syncUser(fbUser);
  }

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setFbUser(firebaseUser);
      // Debounce — Firebase fires multiple events during MFA enrollment
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (firebaseUser) {
          await syncUser(firebaseUser);
        } else {
          setUser(null);
          localStorage.removeItem("fb_token");
        }
        setLoading(false);
      }, 800);
    });
    return () => { unsub(); clearTimeout(debounceTimer); };
  }, []);

  // Refresh token before it expires (Firebase tokens last 1hr)
  useEffect(() => {
    if (!fbUser) return;
    const interval = setInterval(async () => {
      const token = await fbUser.getIdToken(true);
      localStorage.setItem("fb_token", token);
    }, 50 * 60 * 1000); // refresh every 50 minutes
    return () => clearInterval(interval);
  }, [fbUser]);

  async function logout() {
    await signOut(auth);
    localStorage.removeItem("fb_token");
    setUser(null);
    setFbUser(null);
  }

  return (
    <Ctx.Provider value={{ user, fbUser, loading, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() { return useContext(Ctx); }
