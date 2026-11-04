import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type {
  Company,
  PlanDefinition,
  UpdateCompanySettings,
} from "@shared/schema";

export function useCompanySettings() {
  return useQuery<Company>({
    queryKey: ["/api/crm/company/settings"],
  });
}

export function useAvailablePlans() {
  return useQuery<PlanDefinition[]>({
    queryKey: ["/api/crm/company/plans"],
  });
}

export function useUpdateCompanySettings() {
  return useMutation({
    mutationFn: async (data: UpdateCompanySettings) => {
      const res = await apiRequest("PATCH", "/api/crm/company/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/company/settings"] });
    },
  });
}

export function useUpdateCompanyModules() {
  return useMutation({
    mutationFn: async (
      data: Partial<
        Pick<
          Company,
          | "moduleEmail"
          | "moduleCalendar"
          | "moduleInsurance"
          | "moduleMutualFund"
          | "moduleSegFund"
          | "moduleMeetingRecorder"
          | "moduleAnalytics"
          | "modulePipeline"
          | "moduleFinancialPlanning"
        >
      >,
    ) => {
      const res = await apiRequest("PATCH", "/api/crm/company/modules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/company/settings"] });
    },
  });
}
