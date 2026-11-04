import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  mustChangePassword?: boolean;
}

async function fetchUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/crm/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    // Any other failure (429, 5xx, server still starting) must NOT throw: an errored query
    // that remounts refetches, flips AppContent between spinner and page, and loops forever,
    // hammering the API into 429. Treat it as signed out; the next navigation retries.
    console.warn(`[auth] /api/crm/auth/user returned ${response.status}`);
    return null;
  }

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/crm/auth/user"],
    queryFn: fetchUser,
    retry: false,
    retryOnMount: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/crm/auth/login", credentials);
      return res.json();
    },
    onSuccess: (data: AuthUser | { mfaRequired: true }) => {
      // Accounts with MFA enabled get { mfaRequired: true } and no user yet —
      // stay on the login page so it can show the authenticator-code step.
      if ("mfaRequired" in data && data.mfaRequired) return;
      queryClient.setQueryData(["/api/crm/auth/user"], data);
      // Redirect to root so AuthenticatedRouter lands on a valid route.
      // Without this, logging in from /login leaves the URL at /login which
      // has no route in AuthenticatedRouter, causing a 404.
      window.location.href = "/crm/";
    },
  });

  // MFA step 2a — verify the TOTP code (session already holds the password-verified staffId).
  const verifyMfaMutation = useMutation({
    mutationFn: async (token: string): Promise<{ verified: boolean }> => {
      const res = await apiRequest("POST", "/api/crm/auth/mfa/verify", { token });
      return res.json();
    },
    onSuccess: () => {
      // Full reload so /api/auth/user is re-fetched with the now-verified session
      // (also picks up mustChangePassword, which the verify response doesn't include).
      window.location.href = "/crm/";
    },
  });

  // MFA step 2b — single-use recovery code. No auto-redirect: the caller shows the
  // "re-enrol your authenticator" warning first and then continues to "/".
  const recoverMfaMutation = useMutation({
    mutationFn: async (code: string): Promise<{ verified: boolean; warning?: string }> => {
      const res = await apiRequest("POST", "/api/crm/auth/mfa/recover", { code });
      return res.json();
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: {
      companyName: string;
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }) => {
      const res = await apiRequest("POST", "/api/crm/auth/register", data);
      return res.json();
    },
    onSuccess: (data: AuthUser) => {
      queryClient.setQueryData(["/api/crm/auth/user"], data);
      window.location.href = "/crm/";
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/crm/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/crm/auth/user"], null);
      queryClient.clear();
      window.location.href = "/crm/login";
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    verifyMfa: verifyMfaMutation.mutateAsync,
    verifyMfaError: verifyMfaMutation.error,
    isVerifyingMfa: verifyMfaMutation.isPending,
    recoverMfa: recoverMfaMutation.mutateAsync,
    recoverMfaError: recoverMfaMutation.error,
    isRecoveringMfa: recoverMfaMutation.isPending,
    register: registerMutation.mutateAsync,
    registerError: registerMutation.error,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
