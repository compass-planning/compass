import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Task, InsertTask } from "@shared/schema";

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: ["/api/crm/tasks"],
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Omit<InsertTask, "companyId" | "createdByStaffId">,
    ) => {
      const res = await apiRequest("POST", "/api/crm/tasks", data);
      return res.json() as Promise<Task>;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      if (task.clientId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/crm/clients", task.clientId, "activities"],
        });
      }
      if (task.leadId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/crm/leads", task.leadId, "activities"],
        });
      }
    },
  });
}

interface UpdateTaskInput extends Partial<
  Omit<InsertTask, "companyId" | "createdByStaffId">
> {
  id: number;
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTaskInput) => {
      const res = await apiRequest("PUT", `/api/crm/tasks/${id}`, updates);
      return res.json() as Promise<Task>;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      if (task.clientId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/crm/clients", task.clientId, "activities"],
        });
      }
      if (task.leadId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/crm/leads", task.leadId, "activities"],
        });
      }
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/crm/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
    },
  });
}
