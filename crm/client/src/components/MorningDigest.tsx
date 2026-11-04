import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Sun } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useBriefing, useDismissDigest } from "@/hooks/use-notifications";
import { useCurrentStaff } from "@/hooks/use-users";
import { useT } from "@/hooks/useT";
import { BriefingSections } from "@/components/BriefingSections";

/**
 * Daily briefing popup: opens once per browser session, right after sign-in, with today's
 * tasks, reminders, assignments and client birthdays. The same content stays available any
 * time on the Daily Briefing page (sidebar).
 */
export function MorningDigest() {
  const { isFr } = useT();
  const [shown, setShown] = useState(false);
  const { data: currentStaff } = useCurrentStaff();
  const { data } = useBriefing();
  const dismissDigest = useDismissDigest();
  // Same query key as the first-run email prompt, so this is a cache hit, not another request.
  const { data: emailConfig, isFetched: emailChecked } = useQuery<{ isActive: boolean }>({ queryKey: ["/api/crm/email/config"] });

  useEffect(() => {
    if (!data || !currentStaff || !emailChecked) return;
    const key = `briefing_shown_${currentStaff.id}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* storage unavailable */ }
    // Don't stack on top of another modal (e.g. the first-run "Connect Your Email" prompt):
    // give it a moment to mount, then wait until it has been closed.
    const blocked = () => !!document.querySelector('[role="dialog"], [data-testid="text-email-setup-title"]');
    const tryOpen = () => {
      if (blocked()) return false;
      try { sessionStorage.setItem(key, "1"); } catch { /* shown once per page load instead */ }
      setShown(true);
      return true;
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      if (!tryOpen()) timer = setInterval(() => { if (tryOpen() && timer) clearInterval(timer); }, 500);
    }, 800);
    return () => { clearTimeout(start); if (timer) clearInterval(timer); };
  }, [data, currentStaff, emailChecked, emailConfig]);

  function close() {
    setShown(false);
    dismissDigest.mutate();
  }

  if (!data) return null;

  return (
    <Dialog open={shown} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-lg" data-testid="modal-morning-digest">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500" />
            {isFr ? "Briefing du matin" : "Daily Briefing"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <BriefingSections data={data} isFr={isFr} />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Link href="/briefing" onClick={close} className="text-sm text-primary hover:underline" data-testid="link-open-briefing">
            {isFr ? "Ouvrir le briefing complet" : "Open full briefing"}
          </Link>
          <Button onClick={close} data-testid="button-dismiss-digest">{isFr ? "Compris" : "Got it"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
