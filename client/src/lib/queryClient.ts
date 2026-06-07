import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

function getToken(): string | null {
  return typeof localStorage !== "undefined" ? localStorage.getItem("fp_token") : null;
}

function authHeaders(): HeadersInit {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export async function apiRequest(method: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(path, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401) {
    localStorage.removeItem("fp_token");
    window.location.href = "/";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res;
}
