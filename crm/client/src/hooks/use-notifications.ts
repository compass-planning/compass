import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ["/api/crm/notifications"],
    refetchInterval: 60000,
  });
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ["/api/crm/notifications/unread-count"],
    refetchInterval: 60000,
  });
}

export function useDigest() {
  return useQuery<{
    notifications: Notification[];
    birthdays: {
      id: number;
      firstName: string;
      lastName: string;
      dateOfBirth: string | null;
    }[];
  }>({
    queryKey: ["/api/crm/notifications/digest"],
    staleTime: 0,
  });
}

export function useMarkAsRead() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PUT", `/api/crm/notifications/${id}/read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/crm/notifications/unread-count"],
      });
    },
  });
}

export function useMarkAllAsRead() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/crm/notifications/read-all");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/crm/notifications/unread-count"],
      });
    },
  });
}

export function useDismissDigest() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crm/notifications/dismiss-digest");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/crm/notifications/digest"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/staff/me"] });
    },
  });
}
