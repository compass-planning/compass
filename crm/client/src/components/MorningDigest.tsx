import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { useT } from "@/hooks/useT";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Cake, Bell, Users, Clock, Sun } from "lucide-react";
import { useDigest, useDismissDigest } from "@/hooks/use-notifications";
import { useCurrentStaff } from "@/hooks/use-users";
import type { Notification } from "@shared/schema";

function getTypeIcon(type: string) {
  switch (type) {
    case "lead_assigned":
      return <Users className="w-4 h-4 text-violet-500" />;
    case "task_assigned":
      return <Clock className="w-4 h-4 text-amber-500" />;
    case "reminder_due":
      return <Clock className="w-4 h-4 text-red-500" />;
    case "birthday":
      return <Cake className="w-4 h-4 text-pink-500" />;
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
}

export function MorningDigest() {
  const { isFr } = useT();
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { data: currentStaff } = useCurrentStaff();
  const { data: digestData } = useDigest();
  const dismissDigest = useDismissDigest();

  const hasContent =
    digestData &&
    (digestData.notifications.length > 0 || digestData.birthdays.length > 0);

  useEffect(() => {
    if (!dismissed && hasContent && currentStaff) {
      const sessionKey = `digest_shown_${currentStaff.id}`;
      if (!sessionStorage.getItem(sessionKey)) {
        setShown(true);
        sessionStorage.setItem(sessionKey, "1");
      }
    }
  }, [hasContent, currentStaff, dismissed]);

  function handleDismiss() {
    setShown(false);
    setDismissed(true);
    dismissDigest.mutate();
  }

  if (!digestData) return null;

  const { notifications, birthdays } = digestData;
  const newAssignments = notifications.filter(
    (n: Notification) =>
      n.type === "lead_assigned" || n.type === "task_assigned",
  );
  const reminders = notifications.filter(
    (n: Notification) => n.type === "reminder_due",
  );
  const otherNotifs = notifications.filter(
    (n: Notification) =>
      n.type !== "lead_assigned" &&
      n.type !== "task_assigned" &&
      n.type !== "reminder_due",
  );

  return (
    <Dialog
      open={shown}
      onOpenChange={(v) => {
        if (!v) handleDismiss();
      }}
    >
      <DialogContent className="max-w-lg" data-testid="modal-morning-digest">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500" />
            Morning Briefing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {newAssignments.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-500" />
                New Assignments ({newAssignments.length})
              </h4>
              <div className="space-y-1.5">
                {newAssignments.map((n: Notification) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2"
                  >
                    {getTypeIcon(n.type)}
                    <div>
                      <p className="font-medium text-foreground">{n.title}</p>
                      {n.message && (
                        <p className="text-xs mt-0.5">{n.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {reminders.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-500" />
                Due Reminders ({reminders.length})
              </h4>
              <div className="space-y-1.5">
                {reminders.map((n: Notification) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2"
                  >
                    {getTypeIcon(n.type)}
                    <div>
                      <p className="font-medium text-foreground">{n.title}</p>
                      {n.message && (
                        <p className="text-xs mt-0.5">{n.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {otherNotifs.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                Other Notifications ({otherNotifs.length})
              </h4>
              <div className="space-y-1.5">
                {otherNotifs.map((n: Notification) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2"
                  >
                    {getTypeIcon(n.type)}
                    <div>
                      <p className="font-medium text-foreground">{n.title}</p>
                      {n.message && (
                        <p className="text-xs mt-0.5">{n.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {birthdays.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Cake className="w-4 h-4 text-pink-500" />
                Upcoming Client Birthdays ({birthdays.length})
              </h4>
              <div className="space-y-1.5">
                {birthdays.map((b) => {
                  const dob = b.dateOfBirth
                    ? new Date(b.dateOfBirth + "T00:00:00")
                    : null;
                  const today = new Date();
                  const isToday =
                    dob &&
                    dob.getMonth() === today.getMonth() &&
                    dob.getDate() === today.getDate();
                  return (
                    <div
                      key={b.id}
                      className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2"
                    >
                      <Cake className="w-4 h-4 text-pink-500 flex-shrink-0" />
                      <span className="font-medium text-foreground">
                        {b.firstName} {b.lastName}
                      </span>
                      {isToday ? (
                        <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-medium">
                          Today!
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {dob
                            ? `${dob.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                            : ""}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {notifications.length === 0 && birthdays.length === 0 && (
            <div className="text-center text-muted-foreground py-4 text-sm">
              Nothing new since your last visit. Have a great day!
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleDismiss} data-testid="button-dismiss-digest">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}




