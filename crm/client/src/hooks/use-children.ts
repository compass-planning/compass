import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Child } from "@shared/schema";

export function useClientChildren(clientId: number) {
  return useQuery<Child[]>({
    queryKey: ["/api/crm/clients", "children"],
    queryFn: async () => {
      const url = buildUrl(api.children.list.path, { clientId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch children");
      return res.json();
    },
    enabled: !!clientId});
}

export function useCreateChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: { name: string; dateOfBirth?: string | null; sex?: string | null } }) => {
      const url = buildUrl(api.children.create.path, { clientId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create child");
      return res.json();
    },
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients", ""] });
    },
  });
}

export function useDeleteChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; clientId: number }) => {
      const url = buildUrl(api.children.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete child");
    },
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients", ""] });
    },
  });
}
