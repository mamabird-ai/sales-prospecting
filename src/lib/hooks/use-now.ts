import { useEffect, useState } from "react";

/**
 * Current time in ms, refreshed every `intervalMs` while `active`.
 * Keeps components pure by reading the clock in state rather than during render.
 */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    // Refresh right away on activation, then on every tick
    const refresh = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(refresh);
      clearInterval(timer);
    };
  }, [intervalMs, active]);

  return now;
}
