import { useEffect, useRef, useCallback } from "react";

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function useInactivityTimeout(onTimeout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onTimeout, TIMEOUT_MS);
  }, [onTimeout]);

  useEffect(() => {
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // start timer on mount
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reset]);
}