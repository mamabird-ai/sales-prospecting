"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSelectionStore } from "@/lib/store/selection-store";
import { useSelectionContext } from "./selection-provider";
import { cn } from "@/lib/utils";

interface SelectableRowProps {
  /** Unique ID of the item */
  id: number;
  /** Content to render inside the row */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
}

export function SelectableRow({ id, children, className }: SelectableRowProps) {
  const { selectableIds, busy } = useSelectionContext();
  // Use selectors to prevent full list re-renders on selection change
  const checked = useSelectionStore((state) => state.selectedIds.has(id));
  const toggle = useSelectionStore((state) => state.toggle);
  const selectRange = useSelectionStore((state) => state.selectRange);
  const busyLabel = busy.get(id);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.shiftKey) {
      // Get anchorId at click time, not via subscription (avoids re-renders)
      const anchorId = useSelectionStore.getState().anchorId;
      // Ranges skip busy items because they are left out of selectableIds
      if (anchorId !== null && selectableIds.includes(anchorId)) {
        selectRange(anchorId, id, selectableIds);
        return;
      }
    }
    toggle(id);
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 border-b border-white/5 hover:bg-white/[0.03] transition-colors text-sm",
        checked && "bg-primary/5",
        className
      )}
    >
      <div className="w-4 shrink-0 flex items-center justify-center">
        {busyLabel ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Disabled controls don't fire hover events, so the span carries the tooltip */}
              <span
                tabIndex={0}
                className="flex opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              >
                <Checkbox disabled aria-label={`${busyLabel}, can't be selected`} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              {busyLabel === "Queued"
                ? "Waiting in the queue. You can select it again once it finishes."
                : "A job is running for this item. You can select it again once it finishes."}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Checkbox
            checked={checked}
            onClick={handleCheckboxClick}
            aria-label="Select row"
            className={cn(
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity",
              checked && "opacity-100"
            )}
          />
        )}
      </div>
      {children}
      {busyLabel && (
        <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {busyLabel}
        </span>
      )}
    </div>
  );
}
