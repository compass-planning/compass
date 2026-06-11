const BASE = "";

// Firebase token stored by auth.tsx
function getToken(): string | null {
  return localStorage.getItem("fb_token");
}

function notifyError(message: string) {
  window.dispatchEvent(new CustomEvent("api:error", { detail: { message } }));
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const t = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers ?? {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("fb_token");
    window.location.href = "/";
    throw new Error("Unauthorized");
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

// Keep for backward compat with any remaining token.set() calls
export const token = {
  get:   getToken,
  set:   (t: string) => localStorage.setItem("fb_token", t),
  clear: () => localStorage.removeItem("fb_token"),
};
