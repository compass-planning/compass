import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { StaffDocument } from "@shared/schema";

export function useStaffDocuments(staffId: number) {
  return useQuery<StaffDocument[]>({
    queryKey: ["/api/crm/staff", staffId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/staff/${staffId}/documents`);
      if (!res.ok) throw new Error("Failed to fetch staff documents");
      return res.json();
    },
    enabled: !!staffId,
  });
}

export function useCreateStaffDocument(staffId: number) {
  return useMutation({
    mutationFn: async (data: {
      title: string;
      documentType: string;
      description?: string;
      fileName?: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/crm/staff/${staffId}/documents`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/crm/staff", staffId, "documents"],
      });
    },
  });
}

export function useDeleteStaffDocument(staffId: number) {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/crm/staff-documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/crm/staff", staffId, "documents"],
      });
    },
  });
}
