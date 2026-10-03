"use client";

import * as React from "react";
import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useActiveJobs } from "@/lib/query/use-job-query";
import { useJobDurations } from "@/lib/hooks/use-job-activity";
import { useNow } from "@/lib/hooks/use-now";
import {
  estimateBatchSeconds,
  formatDuration,
  MAX_CONCURRENT_JOBS,
} from "@/lib/jobs/job-estimates";
import { MODEL_OPTIONS, useSettingsStore } from "@/lib/store/settings-store";
import { useSelectionStore, type SelectionEntityType } from "@/lib/store/selection-store";
import { cn } from "@/lib/utils";
import { ActionCommandMenu, type ActionConfig } from "./action-command-menu";
import { BulkActionsHelp } from "./bulk-actions-help";
import { useSelectionContext } from "./selection-provider";
import { countItems } from "./count-items";

interface PendingAction {
  action: ActionConfig;
  ids: number[];
}

interface SelectionToolbarProps {
  actions: ActionConfig[];
  /** Shown when nothing is selected, e.g. filters and summary counts */
  idleContent?: React.ReactNode;
}

export function SelectionToolbar({ actions, idleContent }: SelectionToolbarProps) {
  const { entityType, selectableIds, busy } = useSelectionContext();
  const selectedCount = useSelectionStore((state) => state.selectedIds.size);
  const selectAll = useSelectionStore((state) => state.selectAll);
  const clearAll = useSelectionStore((state) => state.clearAll);
  const [commandMenuOpen, setCommandMenuOpen] = React.useState(false);
  const [pending, setPending] = React.useState<PendingAction | null>(null);

  const hasSelection = selectedCount > 0;
  const allSelected = hasSelection && selectedCount >= selectableIds.length;

  const run = React.useCallback(
    async (action: ActionConfig, ids: number[]) => {
      // Clear right away so the next pick starts fresh while jobs queue up
      clearAll();
      try {
        await action.onExecute(ids);
      } catch (error) {
        console.error(`Failed to execute action ${action.id}:`, error);
      }
    },
    [clearAll]
  );

  const requestAction = React.useCallback(
    (action: ActionConfig) => {
      const ids = useSelectionStore
        .getState()
        .getSelectedIds()
        .filter((id) => !busy.has(id));
      if (ids.length === 0) return;

      const needsConfirm =
        action.confirm &&
        (action.destructive || (action.jobType && ids.length > MAX_CONCURRENT_JOBS));
      if (needsConfirm) {
        setPending({ action, ids });
      } else {
        void run(action, ids);
      }
    },
    [busy, run]
  );

  // Keyboard shortcut to open the action menu
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (hasSelection && (e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandMenuOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasSelection]);

  const primaryActions = actions.filter((action) => !action.destructive);
  const destructiveActions = actions.filter((action) => action.destructive);

  return (
    <>
      <div
        role="toolbar"
        aria-label={hasSelection ? "Bulk actions" : "List tools"}
        className={cn(
          "h-9 shrink-0 border-b border-white/5 flex items-center px-3 gap-2 transition-colors",
          hasSelection && "bg-primary/5"
        )}
      >
        <div className="w-4 shrink-0 flex items-center justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex">
                <Checkbox
                  checked={allSelected ? true : hasSelection ? "indeterminate" : false}
                  disabled={selectableIds.length === 0}
                  onCheckedChange={() => (hasSelection ? clearAll() : selectAll(selectableIds))}
                  aria-label={hasSelection ? "Clear selection" : "Select all"}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start">
              {hasSelection
                ? "Clear selection (Esc)"
                : selectableIds.length === 0
                  ? "Nothing to select while jobs are running"
                  : "Select all (⌘A)"}
            </TooltipContent>
          </Tooltip>
        </div>

        {hasSelection ? (
          <>
            <span className="text-xs font-medium tabular-nums">{selectedCount} selected</span>
            <div className="h-4 w-px bg-border mx-1" />
            {primaryActions.map((action) => (
              <ActionButton key={action.id} action={action} onClick={requestAction} />
            ))}
            {destructiveActions.length > 0 && <div className="h-4 w-px bg-border mx-1" />}
            {destructiveActions.map((action) => (
              <ActionButton key={action.id} action={action} onClick={requestAction} />
            ))}
            <div className="flex-1" />
            <BulkActionsHelp entityType={entityType} />
            <Button variant="ghost" size="xs" onClick={clearAll} className="text-muted-foreground">
              <IconX />
              Clear
            </Button>
          </>
        ) : (
          idleContent
        )}
      </div>

      <ActionCommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        actions={actions}
        onSelectAction={requestAction}
      />

      <ConfirmActionDialog
        pending={pending}
        entityType={entityType}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) void run(pending.action, pending.ids);
          setPending(null);
        }}
      />
    </>
  );
}

function ActionButton({
  action,
  onClick,
}: {
  action: ActionConfig;
  onClick: (action: ActionConfig) => void;
}) {
  const Icon = action.icon;
  return (
    <Button
      variant={action.destructive ? "ghost" : "outline"}
      size="xs"
      onClick={() => onClick(action)}
      className={cn(action.destructive && "text-destructive hover:text-destructive")}
    >
      <Icon />
      {action.label}
    </Button>
  );
}

function ConfirmActionDialog({
  pending,
  entityType,
  onCancel,
  onConfirm,
}: {
  pending: PendingAction | null;
  entityType: SelectionEntityType;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { data: activeJobs = [] } = useActiveJobs();
  const durations = useJobDurations();
  const now = useNow(30_000, pending !== null);
  const selectedModel = useSettingsStore((state) => state.selectedModel);
  const modelLabel =
    MODEL_OPTIONS.find((option) => option.value === selectedModel)?.label ?? selectedModel;

  if (!pending?.action.confirm) return null;
  const { action, ids } = pending;
  const confirm = action.confirm!;
  const count = ids.length;
  const items = countItems(count, entityType);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirm.title(items)}</DialogTitle>
          {confirm.description && <DialogDescription>{confirm.description}</DialogDescription>}
        </DialogHeader>

        {action.jobType && (
          <ul className="space-y-2 text-muted-foreground">
            <li>
              Runs {MAX_CONCURRENT_JOBS} at a time.{" "}
              {count - MAX_CONCURRENT_JOBS === 1
                ? "The other one waits in a queue and starts automatically."
                : `The other ${count - MAX_CONCURRENT_JOBS} wait in a queue and start automatically.`}
              {activeJobs.length > 0 &&
                ` ${activeJobs.length} other job${activeJobs.length === 1 ? " is" : "s are"} already in progress, so some of these will wait longer.`}
            </li>
            <li>
              <span className="text-foreground">
                Estimated time:{" "}
                {formatDuration(
                  estimateBatchSeconds(action.jobType, count, activeJobs, durations, now / 1000)
                )}
              </span>
              {durations[action.jobType].fromHistory
                ? " (based on your recent jobs)"
                : " (typical; gets more accurate as jobs finish)"}
            </li>
            <li>
              Uses {count} Claude sessions on {modelLabel}, which count toward your plan&apos;s
              usage limits.
            </li>
            <li>You can keep working while this runs. Progress shows in the sidebar.</li>
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={action.destructive ? "destructive" : "default"} onClick={onConfirm}>
            {confirm.actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
