import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Activity } from "@shared/schema";

export function useClientActivities(clientId: number) {
  return useQuery<Activity[]>({
    queryKey: ["/api/crm/clients", "activities"],
    queryFn: async () => {
      const url = buildUrl(api.activities.list.path, { clientId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!clientId});
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: Record<string, unknown> }) => {
      const url = buildUrl(api.activities.create.path, { clientId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create activity");
      return res.json();
    },
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients", ""] });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; clientId: number }) => {
      const url = buildUrl(api.activities.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete activity");
    },
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients", ""] });
    },
  });
}
