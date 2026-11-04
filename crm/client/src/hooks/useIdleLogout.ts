/**
 * useIdleLogout
 *
 * Fires `onWarn` warnMs before the timeout, then `onIdle` when time is up.
 * While the warning is shown, user activity does NOT reset the timer —
 * the user must explicitly call the returned `stay()` to continue the session.
 *
 * Default: 15 min total, 60 s warning countdown.
 */

import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

interface UseIdleLogoutOptions {
  /** Total idle time in ms before forced logout. */
  timeoutMs: number;
  /** How many ms before timeout to fire onWarn. Default 60 000 (60 s). */
  warnMs?: number;
  onWarn: () => void;
  onIdle: () => void;
  enabled?: boolean;
}

export function useIdleLogout({
  timeoutMs,
  warnMs = 60_000,
  onWarn,
  onIdle,
  enabled = true,
}: UseIdleLogoutOptions): { stay: () => void } {
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warning = useRef(false);
  const startRef = useRef<() => void>(() => {});
  const cbWarn = useRef(onWarn);
  const cbIdle = useRef(onIdle);
  cbWarn.current = onWarn;
  cbIdle.current = onIdle;

  useEffect(() => {
    if (!enabled || !timeoutMs) return;

    const clear = () => {
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };

    const start = () => {
      clear();
      warning.current = false;

      warnTimer.current = setTimeout(() => {
        warning.current = true;
        cbWarn.current();
      }, Math.max(0, timeoutMs - warnMs));

      idleTimer.current = setTimeout(() => {
        cbIdle.current();
      }, timeoutMs);
    };

    startRef.current = start;

    const onActivity = () => {
      if (!warning.current) start();
    };

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );
    start();

    return () => {
      clear();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [enabled, timeoutMs, warnMs]);

  return { stay: () => startRef.current() };
}
