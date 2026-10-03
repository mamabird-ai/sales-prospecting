"use client";

import { useStreamPanelStore } from "@/lib/store/stream-panel-store";
import { killJob as tauriKillJob } from "@/lib/tauri/commands";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/keys";
import { toast } from "sonner";
import type { StreamTab } from "@/lib/hooks/use-stream-tabs";

const isActiveStatus = (tab: StreamTab) => tab.status === "running" || tab.status === "queued";

export function useStreamSubscription() {
  const clearLogs = useStreamPanelStore((s) => s.clearLogs);
  const setActiveTab = useStreamPanelStore((s) => s.setActiveTab);
  const dismissJobs = useStreamPanelStore((s) => s.dismissJobs);

  // Kill a running job
  const killJob = async (jobId: string) => {
    try {
      await tauriKillJob(jobId);
      toast.success("Job stopped");
      // Invalidate queries to reflect status change
      queryClient.invalidateQueries({ queryKey: queryKeys.jobsRecent(50) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads });
      queryClient.invalidateQueries({ queryKey: queryKeys.people });
    } catch {
      toast.error("Failed to stop job");
    }
  };

  /**
   * Hide tabs from the panel. Running jobs are stopped first. The job records
   * stay in the database so time estimates can learn from them; old history
   * is pruned on startup.
   */
  const closeTabs = async (closing: StreamTab[], allTabs: StreamTab[]) => {
    if (closing.length === 0) return;
    const closingIds = new Set(closing.map((tab) => tab.jobId));

    // Move off the active tab before it disappears (prefer the next tab, then the previous)
    const activeTabId = useStreamPanelStore.getState().activeTabId;
    if (activeTabId && closingIds.has(activeTabId)) {
      const index = allTabs.findIndex((tab) => tab.jobId === activeTabId);
      const remaining = (tabs: StreamTab[]) => tabs.find((tab) => !closingIds.has(tab.jobId));
      const next =
        remaining(allTabs.slice(index + 1)) ?? remaining(allTabs.slice(0, index).reverse());
      setActiveTab(next?.jobId ?? null);
    }

    await Promise.all(
      closing.filter(isActiveStatus).map((tab) => tauriKillJob(tab.jobId).catch(() => undefined))
    );

    dismissJobs([...closingIds]);
    closingIds.forEach((jobId) => clearLogs(jobId));
  };

  const closeTab = (tab: StreamTab, allTabs: StreamTab[]) => closeTabs([tab], allTabs);

  /** Hide every tab whose job has finished, succeeded or not */
  const clearFinished = (allTabs: StreamTab[]) =>
    closeTabs(
      allTabs.filter((tab) => !isActiveStatus(tab)),
      allTabs
    );

  return { killJob, closeTab, clearFinished };
}
