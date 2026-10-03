import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ClaudeRateLimitEvent } from "@/lib/types/claude";

export interface UsageWindow {
  /** Fraction of the window used, 0-1 */
  utilization: number;
  /** Unix seconds when the window resets */
  resetsAt: number | null;
}

interface UsageState {
  /** Latest reported windows keyed by name, e.g. "five_hour", "seven_day" */
  windows: Record<string, UsageWindow>;
  /** Unix ms of the last update; the CLI only reports usage while a job runs */
  updatedAt: number | null;
  recordRateLimitEvent: (event: ClaudeRateLimitEvent) => void;
}

export const useUsageStore = create<UsageState>()(
  persist(
    (set) => ({
      windows: {},
      updatedAt: null,

      recordRateLimitEvent: (event) => {
        const reported = event.rate_limit_info?.unifiedWindows;
        if (!reported) return;

        const windows: Record<string, UsageWindow> = {};
        for (const [name, window] of Object.entries(reported)) {
          if (typeof window.utilization !== "number") continue;
          windows[name] = {
            utilization: Math.min(Math.max(window.utilization, 0), 1),
            resetsAt: window.resetsAt ?? null,
          };
        }
        if (Object.keys(windows).length === 0) return;

        set((state) => ({ windows: { ...state.windows, ...windows }, updatedAt: Date.now() }));
      },
    }),
    {
      name: "usage-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * Pick usage updates out of raw stream lines without parsing every line twice
 */
export function captureUsageFromStreamLine(line: string): void {
  if (!line.includes('"rate_limit_event"')) return;
  try {
    const event = JSON.parse(line) as ClaudeRateLimitEvent;
    if (event.type === "rate_limit_event") {
      useUsageStore.getState().recordRateLimitEvent(event);
    }
  } catch {
    // Partial or non-JSON line
  }
}
