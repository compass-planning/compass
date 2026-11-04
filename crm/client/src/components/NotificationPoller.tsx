import { useEffect, useRef } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@shared/schema";

export function NotificationPoller() {
  const { data: notifications } = useNotifications();
  const { toast } = useToast();
  const seenIdsRef = useRef<Set<number>>(new Set());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    if (initialLoadRef.current) {
      notifications.forEach((n: Notification) => seenIdsRef.current.add(n.id));
      initialLoadRef.current = false;
      return;
    }

    const newUnread = notifications.filter(
      (n: Notification) => !n.isRead && !seenIdsRef.current.has(n.id),
    );

    for (const n of newUnread) {
      seenIdsRef.current.add(n.id);
      toast({
        title: n.title,
        description: n.message || undefined,
      });
    }
  }, [notifications, toast]);

  return null;
}
