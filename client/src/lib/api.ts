/**
 * client/src/lib/api.ts
 * JWT-based API client. Token stored in memory (not localStorage).
 * Reads token from auth context via getMemToken().
 */

import { getMemToken } from "./auth";

const BASE = "";

let redirectingToLogin = false;

function notifyError(message: string) {
  window.dispatchEvent(new CustomEvent("api:error", { detail: { message } }));
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  if (redirectingToLogin) throw new Error("Unauthorized");

  const t = getMemToken();
  if (!t && path !== "/api/auth/login" && path !== "/api/auth/register"
        && path !== "/api/auth/forgot" && path !== "/api/auth/reset-password"
        && path !== "/api/auth/verify-email" && path !== "/api/auth/refresh") {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers ?? {}),
    },
  });

  if (res.status === 401) {
    if (!redirectingToLogin) {
      redirectingToLogin = true;
      localStorage.removeItem("compass_refresh");
      setTimeout(() => { window.location.href = "/"; }, 100);
    }
    throw new Error("Unauthorized");
  }
  if (res.status === 429) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    const message = b.message ?? `HTTP ${res.status}`;
    notifyError(message);
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  get:    <T>(p: string)              => req<T>(p),
  post:   <T>(p: string, b?: unknown) => req<T>(p, { method: "POST",   body: JSON.stringify(b) }),
  patch:  <T>(p: string, b?: unknown) => req<T>(p, { method: "PATCH",  body: JSON.stringify(b) }),
  put:    <T>(p: string, b?: unknown) => req<T>(p, { method: "PUT",    body: JSON.stringify(b) }),
  delete: <T>(p: string)              => req<T>(p, { method: "DELETE" }),
};

// Public API calls that don't need auth token
export const publicApi = {
  post: <T>(p: string, b?: unknown): Promise<T> =>
    fetch(`${BASE}${p}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    }).then(async res => {
      if (!res.ok) {
        const b2 = await res.json().catch(() => ({}));
        throw new Error(b2.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    }),
};

// Legacy compat
export const token = {
  get:   getMemToken,
  set:   () => {},   // no-op — tokens are in memory now
  clear: () => { localStorage.removeItem("compass_refresh"); },
};
