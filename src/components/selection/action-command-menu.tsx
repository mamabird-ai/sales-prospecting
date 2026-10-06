"use client";

import * as React from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import type { JobType } from "@/lib/tauri/types";
import { cn } from "@/lib/utils";

export interface ActionConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  shortcut?: string;
  destructive?: boolean;
  /** Set when the action queues one Claude job of this type per selected item */
  jobType?: JobType;
  /**
   * Confirmation copy. Destructive actions always confirm; job actions confirm
   * when the batch is bigger than one round of parallel jobs.
   */
  confirm?: {
    /** Receives the counted items, e.g. "20 companies" */
    title: (items: string) => string;
    actionLabel: string;
    description?: string;
  };
  onExecute: (selectedIds: number[]) => void | Promise<void>;
}

interface ActionCommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: ActionConfig[];
  onSelectAction: (action: ActionConfig) => void;
}

export function ActionCommandMenu({
  open,
  onOpenChange,
  actions,
  onSelectAction,
}: ActionCommandMenuProps) {
  // Group actions by category
  const groupedActions = React.useMemo(() => {
    const groups: Record<string, ActionConfig[]> = {};
    actions.forEach((action) => {
      if (!groups[action.group]) {
        groups[action.group] = [];
      }
      groups[action.group].push(action);
    });
    return groups;
  }, [actions]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search actions..." />
      <CommandList>
        <CommandEmpty>No actions found.</CommandEmpty>
        {Object.entries(groupedActions).map(([group, groupActions]) => (
          <CommandGroup key={group} heading={group}>
            {groupActions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.id}
                  onSelect={() => {
                    onOpenChange(false);
                    onSelectAction(action);
                  }}
                  className={cn(
                    action.destructive && "text-destructive data-[selected=true]:text-destructive"
                  )}
                >
                  <Icon className="mr-2 size-4" />
                  <span>{action.label}</span>
                  {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
