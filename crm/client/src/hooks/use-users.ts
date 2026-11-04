import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { StaffMember } from "@shared/schema";

export function useStaffMembers() {
  return useQuery<StaffMember[]>({
    queryKey: ["/api/crm/staff"],
  });
}

export function useCurrentStaff() {
  return useQuery<StaffMember>({
    queryKey: ["/api/crm/staff/me"],
  });
}

export function useStaffMember(id: number) {
  return useQuery<StaffMember>({
    queryKey: ["/api/crm/staff", id],
    enabled: !!id,
  });
}

interface CreateStaffPayload {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isAdmin?: boolean;
  phone?: string;
  personalEmail?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  tempPassword?: string;
  sellsMutualFunds?: boolean;
}

interface UpdateStaffPayload {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  isAdmin?: boolean;
  phone?: string | null;
  personalEmail?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  maritalStatus?: string | null;
  spouseName?: string | null;
  spousePhone?: string | null;
  spouseEmail?: string | null;
  spouseBirthday?: string | null;
  spouseIsEmergencyContact?: boolean;
  anniversary?: string | null;
  contractDate?: string | null;
  linkedClientId?: number | null;
  linkedSpouseClientId?: number | null;
  sellsMutualFunds?: boolean;
}

export function useCreateStaffMember() {
  return useMutation({
    mutationFn: async (data: CreateStaffPayload) => {
      const res = await apiRequest("POST", "/api/crm/staff", data);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.message ?? `Server error ${res.status}`);
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/staff"] });
    },
  });
}

export function useUpdateStaffMember() {
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateStaffPayload) => {
      const res = await apiRequest("PUT", `/api/crm/staff/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/staff/me"] });
    },
  });
}

export function useDeleteStaffMember() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/crm/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/staff"] });
    },
  });
}

export function useAdvisorAssignments() {
  return useQuery({
    queryKey: ["/api/crm/advisor-assignments"],
  });
}

export function useAdvisorsByAdmin(adminId: number) {
  return useQuery<StaffMember[]>({
    queryKey: ["/api/crm/staff", adminId, "advisors"],
    enabled: !!adminId,
  });
}

export function useCreateAdvisorAssignment() {
  return useMutation({
    mutationFn: async (data: { adminId: number; advisorId: number }) => {
      const res = await apiRequest("POST", "/api/crm/advisor-assignments", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/advisor-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/staff"] });
    },
  });
}

export function useDeleteAdvisorAssignment() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/crm/advisor-assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/advisor-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/staff"] });
    },
  });
}
