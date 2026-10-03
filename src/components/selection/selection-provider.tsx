"use client";

import * as React from "react";
import { useSelectionStore, type SelectionEntityType } from "@/lib/store/selection-store";
import { use, useEffect, useMemo } from "react";

interface SelectionContextValue {
  entityType: SelectionEntityType;
  allIds: number[];
  /** Items that can be selected right now, in display order */
  selectableIds: number[];
  /** Items with a queued or running job, mapped to what is happening */
  busy: Map<number, string>;
}

const SelectionContext = React.createContext<SelectionContextValue | null>(null);

export function useSelectionContext() {
  const context = use(SelectionContext);
  if (!context) {
    throw new Error("useSelectionContext must be used within SelectionProvider");
  }
  return context;
}

interface SelectionProviderProps {
  children: React.ReactNode;
  entityType: SelectionEntityType;
  allIds: number[];
  busy: Map<number, string>;
}

export function SelectionProvider({ children, entityType, allIds, busy }: SelectionProviderProps) {
  // Use individual selectors to avoid re-rendering children on selection change
  const setEntityType = useSelectionStore((state) => state.setEntityType);
  const clearAll = useSelectionStore((state) => state.clearAll);
  const selectAll = useSelectionStore((state) => state.selectAll);
  const deselectMany = useSelectionStore((state) => state.deselectMany);

  const selectableIds = useMemo(() => allIds.filter((id) => !busy.has(id)), [allIds, busy]);

  // Set entity type on mount, clear on unmount
  useEffect(() => {
    setEntityType(entityType);
    return () => {
      clearAll();
      setEntityType(null);
    };
  }, [entityType, setEntityType, clearAll]);

  // Items that start a job (from here or elsewhere) can no longer stay selected
  useEffect(() => {
    deselectMany([...busy.keys()]);
  }, [busy, deselectMany]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // Keys pressed inside a dialog or popover belong to it (Esc closes it, not the selection)
      if (target.closest?.('[role="dialog"], [data-radix-popper-content-wrapper]')) {
        return;
      }

      // Cmd+A or Ctrl+A to select all
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        // Don't interfere with input elements
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        selectAll(selectableIds);
      }

      // Escape to clear selection
      if (e.key === "Escape") {
        clearAll();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectableIds, selectAll, clearAll]);

  const value = useMemo(
    () => ({ entityType, allIds, selectableIds, busy }),
    [entityType, allIds, selectableIds, busy]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}
