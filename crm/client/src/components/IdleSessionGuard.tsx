import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { SessionWarningModal } from "@/components/SessionWarningModal";

/**
 * Signs the user out after a period of inactivity (ported from Compass Planning).
 * 15 min idle by default, with a 60 s "Still there?" warning. Override the
 * timeout at build time with VITE_IDLE_TIMEOUT_MINUTES (0 disables).
 */
const MINUTES = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES ?? 15);
const WARN_MS = 60_000;

export function IdleSessionGuard() {
  const { logout } = useAuth();
  const [warning, setWarning] = useState(false);
  const timeoutMs = Number.isFinite(MINUTES) && MINUTES > 0 ? MINUTES * 60_000 : 0;

  const { stay } = useIdleLogout({
    timeoutMs,
    warnMs: WARN_MS,
    enabled: timeoutMs > 0,
    onWarn: () => setWarning(true),
    onIdle: () => { setWarning(false); logout(); },
  });

  if (timeoutMs === 0) return null;
  return (
    <SessionWarningModal
      open={warning}
      seconds={WARN_MS / 1000}
      onStay={() => { setWarning(false); stay(); }}
      onLogout={() => { setWarning(false); logout(); }}
    />
  );
}
