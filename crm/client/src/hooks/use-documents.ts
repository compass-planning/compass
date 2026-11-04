import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Document } from "@shared/schema";

export function useClientDocuments(clientId: number) {
  return useQuery<Document[]>({
    queryKey: ["/api/crm/clients", "documents"],
    queryFn: async () => {
      const url = buildUrl(api.documents.list.path, { clientId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !!clientId});
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: Record<string, unknown> }) => {
      const url = buildUrl(api.documents.create.path, { clientId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create document");
      return res.json();
    },
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients", ""] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId, data }: { id: number; clientId: number; data: Record<string, unknown> }) => {
      const url = buildUrl(api.documents.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update document");
      return res.json();
    },
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients", ""] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; clientId: number }) => {
      const url = buildUrl(api.documents.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete document");
    },
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients", ""] });
    },
  });
}
