const BASE = "";

// Firebase token stored by auth.tsx
function getToken(): string | null {
  return localStorage.getItem("fb_token");
}

function notifyError(message: string) {
  window.dispatchEvent(new CustomEvent("api:error", { detail: { message } }));
}

// Tracks whether a 401-triggered redirect is already in progress,
// preventing parallel requests from cascading into a redirect loop.
let redirectingToLogin = false;

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  // If a 401 redirect is already in flight, abort immediately rather than
  // firing more unauthenticated requests that will clear the token again.
  if (redirectingToLogin) throw new Error("Unauthorized");

  const t = getToken();

  // If there's no token at all, don't bother making the request.
  // This can happen in the brief window between page load and auth state resolution.
  if (!t) throw new Error("Unauthorized");

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
      ...(opts.headers ?? {}),
    },
  });

  if (res.status === 401) {
    if (!redirectingToLogin) {
      redirectingToLogin = true;
      localStorage.removeItem("fb_token");
      // Small delay lets any in-flight requests settle before redirect
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

// Keep for backward compat with any remaining token.set() calls
export const token = {
  get:   getToken,
  set:   (t: string) => localStorage.setItem("fb_token", t),
  clear: () => localStorage.removeItem("fb_token"),
};
