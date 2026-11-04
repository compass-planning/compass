/**
 * SessionWarningModal
 *
 * Shown by the idle-logout hook when the session is about to expire.
 * Displays a live countdown and two actions: "Stay logged in" / "Sign out now".
 */

import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SessionWarningModalProps {
  open: boolean;
  /** Countdown length in seconds. Default 60. */
  seconds?: number;
  onStay: () => void;
  onLogout: () => void;
}

export function SessionWarningModal({
  open,
  seconds = 60,
  onStay,
  onLogout,
}: SessionWarningModalProps) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (!open) {
      setLeft(seconds);
      return;
    }
    setLeft(seconds);
    const id = setInterval(
      () => setLeft((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => clearInterval(id);
  }, [open, seconds]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onStay()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Still there?
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          You've been inactive for a while. For your security you'll be signed
          out in{" "}
          <span className="font-bold text-red-500" data-testid="session-warning-countdown">
            {left}s
          </span>
          .
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onLogout}
            data-testid="session-warning-logout"
          >
            Sign out now
          </Button>
          <Button onClick={onStay} data-testid="session-warning-stay">
            Stay logged in
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
