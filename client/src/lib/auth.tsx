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
      const idToken = await firebaseUser.getIdToken();
      localStorage.setItem("fb_token", idToken);
      let profile: User;
      try {
        profile = await api.get<User>("/api/auth/me");
      } catch (e: any) {
        // 429 = rate limited, don't clear user — just wait
        if (e?.message?.includes("429") || e?.message?.includes("Too many")) {
          console.warn("[auth] Rate limited on /me — keeping current state");
          return;
        }
        // No Postgres record yet — create it
        try {
          await api.post("/api/auth/register", {
            idToken,
            firstName: firebaseUser.displayName?.split(" ")[0] ?? "User",
            lastName:  firebaseUser.displayName?.split(" ").slice(1).join(" ") ?? "",
            jurisdiction: "CA",
          });
          profile = await api.get<User>("/api/auth/me");
        } catch (e2: any) {
          // Rate limited on register too — don't clear, retry later
          if (e2?.message?.includes("429") || e2?.message?.includes("Too many")) {
            console.warn("[auth] Rate limited on /register — keeping current state");
            return;
          }
          throw e2;
        }
      }
      setUser({ ...profile, emailVerified: firebaseUser.emailVerified });
    } catch {
      // Only clear user on genuine auth failures, not transient errors
      setUser(null);
    }
  }

  async function refresh() {
    if (fbUser) await syncUser(fbUser);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setFbUser(firebaseUser);
      if (firebaseUser) {
        await syncUser(firebaseUser);
      } else {
        setUser(null);
        localStorage.removeItem("fb_token");
      }
      setLoading(false);
    });
    return unsub;
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
