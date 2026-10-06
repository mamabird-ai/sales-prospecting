"use client";

import { useStreamPanelStore } from "@/lib/store/stream-panel-store";
import { useStreamTabs } from "@/lib/hooks/use-stream-tabs";
import { useJob } from "@/lib/query/use-job-query";
import { StreamPanelTabs } from "./stream-panel-tabs";
import { useStreamSubscription } from "./use-stream-subscription";
import {
  IconChevronDown,
  IconChevronUp,
  IconClearAll,
  IconPlayerStop,
  IconTerminal2,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function StreamPanelHeader() {
  const toggle = useStreamPanelStore((s) => s.toggle);
  const isOpen = useStreamPanelStore((s) => s.isOpen);
  const activeTabId = useStreamPanelStore((s) => s.activeTabId);

  const { tabs } = useStreamTabs();
  const { killJob, closeTab, clearFinished } = useStreamSubscription();

  // Fetch active job details
  const { data: activeJob } = useJob(activeTabId ?? "", !!activeTabId);

  const runningCount = tabs.filter((t) => t.status === "running" || t.status === "queued").length;
  const finishedCount = tabs.length - runningCount;
  const status =
    runningCount > 0
      ? `${runningCount} running`
      : `${finishedCount} finished job${finishedCount === 1 ? "" : "s"}`;

  // Minimized: one bar that expands when clicked anywhere
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={`Activity, ${status}. Expand panel`}
        className="w-full h-9 shrink-0 border-t border-white/10 bg-zinc-950 flex items-center gap-2 px-3 text-xs text-muted-foreground hover:bg-white/[0.03] hover:text-foreground transition-colors outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <IconTerminal2 className="size-3.5" />
        <span className="font-medium text-foreground">Activity</span>
        <span className="flex items-center gap-1.5">
          {runningCount > 0 && <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />}
          {status}
        </span>
        <span className="flex-1" />
        <kbd className="rounded bg-muted px-1 py-0.5 font-sans text-[10px]">⌘J</kbd>
        <IconChevronUp className="size-4" />
      </button>
    );
  }

  const handleStopCurrent = async () => {
    if (!activeTabId) return;

    if (activeJob?.status === "running" || activeJob?.status === "queued") {
      await killJob(activeTabId);
    }
  };

  return (
    <div className="border-t border-white/10 bg-zinc-950 flex items-center border-b border-white/5 h-9 shrink-0">
      <div className="flex items-center gap-2 px-3 text-xs shrink-0 border-r border-white/5 h-full">
        <IconTerminal2 className="size-3.5 text-muted-foreground" />
        <span className="font-medium">Activity</span>
      </div>

      <div className="flex-1 min-w-0">
        <StreamPanelTabs onCloseTab={(tab) => closeTab(tab, tabs)} />
      </div>

      <div className="flex items-center gap-1 px-2 shrink-0">
        {(activeJob?.status === "running" || activeJob?.status === "queued") && (
          <Button
            variant="ghost"
            size="xs"
            onClick={handleStopCurrent}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <IconPlayerStop />
            Stop
          </Button>
        )}

        {finishedCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => clearFinished(tabs)}
                className="text-muted-foreground"
              >
                <IconClearAll />
                Clear finished
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close the tabs of jobs that are done. Results are kept.</TooltipContent>
          </Tooltip>
        )}

        {runningCount > 0 && (
          <span className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
            {runningCount} running
          </span>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={toggle}
              aria-label="Minimize panel"
              className="text-muted-foreground"
            >
              <IconChevronDown />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Minimize (⌘J)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
