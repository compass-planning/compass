import type { ReactNode } from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { api, token } from "./api";
import { applyLocaleFromUser } from "../hooks/useLocale";

export interface User {
  id:                number;
  email:             string;
  firstName:         string;
  lastName:          string;
  firmName?:         string | null;
  role:              "ga" | "fa";
  level:             "standard" | "enhanced";
  mustResetPassword: boolean;
  jurisdiction:      "CA" | "US";
  province?:         string | null;
  locale?:           string | null;
}

interface Ctx {
  user:        User | null;
  loading:     boolean;
  login:       (email: string, pw: string) => Promise<void>;
  register:    (d: any) => Promise<void>;
  logout:      () => void;
  refreshUser: () => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  function applyUser(u: User) {
    setUser(u);
    applyLocaleFromUser(u.province, u.locale);
  }

  useEffect(() => {
    if (!token.get()) { setLoading(false); return; }
    api.get<User>("/api/auth/me").then(applyUser).catch(token.clear).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, pw: string) => {
    const r = await api.post<{ token: string; user: User; mfaRequired?: boolean; mfaToken?: string }>(
      "/api/auth/login", { email, password: pw }
    );
    if (r.mfaRequired && r.mfaToken) {
      throw Object.assign(new Error("MFA_REQUIRED"), { mfaToken: r.mfaToken });
    }
    token.set(r.token);
    applyUser(r.user);
  };

  const register = async (d: any) => {
    const r = await api.post<{ token: string; user: User }>("/api/auth/register", d);
    token.set(r.token);
    applyUser(r.user);
  };

  const logout = () => { token.clear(); setUser(null); };

  const refreshUser = async () => {
    const u = await api.get<User>("/api/auth/me");
    applyUser(u);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("No AuthProvider");
  return c;
};
