import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { CarrierFileType } from "@shared/schema";

interface CarrierCredentialResponse {
  id: number;
  companyId: number;
  carrierId: number;
  credentialType: string;
  label: string;
  isActive: boolean;
  hasCredentials: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface CarrierFileRequestResponse {
  id: number;
  companyId: number;
  clientId: number;
  carrierId: number;
  staffId: number;
  status: string;
  fileTypes: string[];
  errorMessage: string | null;
  requestedAt: string | null;
  completedAt: string | null;
  carrierName: string;
}

interface CarrierFileResponse {
  id: number;
  requestId: number;
  carrierId: number;
  clientId: number;
  companyId: number;
  fileType: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  status: string;
  expiresAt: string | null;
  createdAt: string | null;
  carrierName: string;
}

interface ClientCarrierFilesResponse {
  requests: CarrierFileRequestResponse[];
  files: CarrierFileResponse[];
}

export function useCarrierCredentials() {
  return useQuery<CarrierCredentialResponse[]>({
    queryKey: ["/api/crm/carrier-credentials"],
  });
}

export function useCreateCarrierCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      carrierId: number;
      credentialType: string;
      label: string;
      encryptedCredentials: string;
    }) => {
      const res = await apiRequest("POST", "/api/crm/carrier-credentials", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/carrier-credentials"] });
    },
  });
}

export function useDeleteCarrierCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/crm/carrier-credentials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/carrier-credentials"] });
    },
  });
}

export function useClientCarrierFiles(clientId: number) {
  return useQuery<ClientCarrierFilesResponse>({
    queryKey: ["/api/crm/clients", clientId, "carrier-files"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/clients/${clientId}/carrier-files`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch carrier files");
      return res.json();
    },
    enabled: clientId > 0,
  });
}

export function useRequestCarrierFiles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      clientId: number;
      carrierId: number;
      fileTypes: CarrierFileType[];
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/crm/clients/${data.clientId}/carrier-files/request`,
        { carrierId: data.carrierId, fileTypes: data.fileTypes },
      );
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/crm/clients", variables.clientId, "carrier-files"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/crm/clients", variables.clientId, "documents"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/crm/clients/:clientId/products", variables.clientId],
      });
    },
  });
}

export function useCarrierFileRequestStatus(requestId: number | null) {
  return useQuery({
    queryKey: ["/api/crm/carrier-file-requests", requestId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/carrier-file-requests/${requestId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch request status");
      return res.json();
    },
    enabled: requestId !== null && requestId > 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === "completed" || data.status === "failed")) {
        return false;
      }
      return 2000;
    },
  });
}

export function downloadCarrierFile(fileId: number, fileName: string) {
  const link = document.createElement("a");
  link.href = `/api/crm/carrier-files/${fileId}/download`;
  link.download = fileName;
  link.click();
}
