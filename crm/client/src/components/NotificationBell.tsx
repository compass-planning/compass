import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useRef, useEffect } from "react";
import { useT } from "@/hooks/useT";
import { Bell, CheckCheck, Users, Cake, Clock } from "lucide-react";
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead } from "@/hooks/use-notifications";
import type { Notification } from "@shared/schema";

function formatTimeAgo(dateStr: string | Date | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "lead_assigned": return <Users className="w-4 h-4 text-violet-500" />;
    case "task_assigned": return <Clock className="w-4 h-4 text-amber-500" />;
    case "reminder_due": return <Clock className="w-4 h-4 text-red-500" />;
    case "birthday": return <Cake className="w-4 h-4 text-pink-500" />;
    default: return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
}

export function NotificationBell() {
  const { isFr } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: notifications = [] } = useNotifications();
  const { data: unreadData } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const unreadCount = unreadData?.count ?? 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2.5 rounded-xl bg-white border border-border/50 text-muted-foreground hover:text-primary hover:shadow-md transition-all duration-200 relative"
        data-testid="button-notification-bell"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-secondary text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white"
            data-testid="badge-unread-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-border/50 z-50 max-h-[480px] flex flex-col" data-testid="dropdown-notifications">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((n: Notification) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border/30 last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${!n.isRead ? "bg-primary/5" : ""}`}
                  onClick={() => {
                    if (!n.isRead) markAsRead.mutate(n.id);
                  }}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.isRead ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-1">{formatTimeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <div className="mt-1.5 flex-shrink-0">
                      <div className="w-2 h-2 bg-secondary rounded-full" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}




