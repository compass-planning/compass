import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Lead, LeadActivity, InsertLead } from "@shared/schema";

export function useLeads() {
  return useQuery<Lead[]>({
    queryKey: ["/api/crm/leads"],
    queryFn: async () => {
      const res = await fetch("/api/crm/leads", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });
}

export function useLead(id: number) {
  return useQuery<Lead | null>({
    queryKey: ["/api/crm/leads", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${id}`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch lead");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<InsertLead, "companyId">) => {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create lead");
      return res.json() as Promise<Lead>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
    },
  });
}

interface UpdateLeadInput extends Partial<Omit<InsertLead, "companyId">> {
  id: number;
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateLeadInput) => {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update lead");
      return res.json() as Promise<Lead>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete lead");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
    },
  });
}

export function useLeadActivities(leadId: number) {
  return useQuery<LeadActivity[]>({
    queryKey: ["/api/crm/leads", leadId, "activities"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${leadId}/activities`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch lead activities");
      return res.json();
    },
    enabled: !!leadId,
  });
}

export function useCreateLeadActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leadId,
      ...data
    }: {
      leadId: number;
      type: string;
      title: string;
      description?: string;
    }) => {
      const res = await fetch(`/api/crm/leads/${leadId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create lead activity");
      return res.json() as Promise<LeadActivity>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/crm/leads", variables.leadId, "activities"],
      });
    },
  });
}

export function useClientLead(clientId: number) {
  return useQuery<Lead | null>({
    queryKey: ["/api/crm/clients", clientId, "lead"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/clients/${clientId}/lead`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!clientId,
  });
}
