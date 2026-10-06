"use client";

import { useEffect } from "react";
import { usePanelRef } from "react-resizable-panels";
import { useStreamTabs } from "@/lib/hooks/use-stream-tabs";
import { MIN_PANEL_SIZE, useStreamPanelStore } from "@/lib/store/stream-panel-store";
import { StreamPanel } from "./stream-panel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

const ACTIVITY_PANEL_ID = "activity";
/** Minimized, the panel shrinks to its header bar (h-9) */
const COLLAPSED_SIZE = "36px";

export function StreamPanelWrapper({ children }: { children: React.ReactNode }) {
  const { tabs } = useStreamTabs();
  const hasTabs = tabs.length > 0;

  const isOpen = useStreamPanelStore((s) => s.isOpen);
  const setOpen = useStreamPanelStore((s) => s.setOpen);
  const toggle = useStreamPanelStore((s) => s.toggle);
  const panelSize = useStreamPanelStore((s) => s.panelSize);
  const setPanelSize = useStreamPanelStore((s) => s.setPanelSize);
  const panelRef = usePanelRef();

  // ⌘J / Ctrl+J toggles the panel, as in VS Code
  useEffect(() => {
    if (!hasTabs) return;
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasTabs, toggle]);

  // Apply open/minimized state from the store (button, shortcut, "View" links)
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (isOpen && panel.isCollapsed()) {
      // Read at call time: the saved size is where to restore to, not a reason to resize
      panel.resize(`${useStreamPanelStore.getState().panelSize}%`);
    } else if (!isOpen && !panel.isCollapsed()) {
      panel.collapse();
    }
  }, [isOpen, hasTabs, panelRef]);

  // If no tabs, just render children without resizable panels
  if (!hasTabs) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="vertical"
      className="flex-1"
      onLayoutChanged={(layout) => {
        const size = layout[ACTIVITY_PANEL_ID];
        if (size === undefined) return;
        // Dragging below the minimum minimizes the panel; dragging it up reopens it.
        // Anything under the minimum can only be the collapsed size.
        const collapsed = size < MIN_PANEL_SIZE;
        if (collapsed === useStreamPanelStore.getState().isOpen) setOpen(!collapsed);
        // Remember the expanded height the user dragged to
        if (!collapsed) setPanelSize(size);
      }}
    >
      <ResizablePanel minSize={30}>
        <main className="h-full flex flex-col overflow-hidden">{children}</main>
      </ResizablePanel>

      <ResizableHandle className="h-1 bg-transparent hover:bg-white/20 data-[separator=active]:bg-white/30 transition-colors cursor-row-resize" />

      <ResizablePanel
        id={ACTIVITY_PANEL_ID}
        panelRef={panelRef}
        collapsible
        collapsedSize={COLLAPSED_SIZE}
        minSize={MIN_PANEL_SIZE}
        defaultSize={isOpen ? `${panelSize}%` : COLLAPSED_SIZE}
      >
        <StreamPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
