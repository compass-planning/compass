import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { HostUser } from "@shared/schema";

interface HostMeResponse extends HostUser {
  isHostUser: boolean;
}

export function useHostUser() {
  const { isAuthenticated } = useAuth();
  return useQuery<HostMeResponse>({
    queryKey: ["/api/crm/host/me"],
    enabled: isAuthenticated,
  });
}
