const BASE = "";

export const token = {
  get: () => localStorage.getItem("fp_token"),
  set: (t: string) => localStorage.setItem("fp_token", t),
  clear: () => localStorage.removeItem("fp_token"),
};

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const t = token.get();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (res.status === 401) { token.clear(); window.location.href = "/"; throw new Error("Unauthorized"); }
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.message ?? `HTTP ${res.status}`); }
  return res.json();
}

export const api = {
  get:    <T>(p: string)               => req<T>(p),
  post:   <T>(p: string, b?: unknown)  => req<T>(p, { method: "POST",   body: JSON.stringify(b) }),
  patch:  <T>(p: string, b?: unknown)  => req<T>(p, { method: "PATCH",  body: JSON.stringify(b) }),
  put:    <T>(p: string, b?: unknown)  => req<T>(p, { method: "PUT",    body: JSON.stringify(b) }),
  delete: <T>(p: string)               => req<T>(p, { method: "DELETE" }),
};
