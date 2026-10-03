import { toast } from "sonner";
import { useStreamPanelStore } from "@/lib/store/stream-panel-store";

/** Open the Activity panel, optionally on a specific job's tab */
export function openActivity(jobId?: string): void {
  const store = useStreamPanelStore.getState();
  if (jobId) store.setActiveTab(jobId);
  store.setOpen(true);
}

/**
 * Confirm that work started, with a shortcut to watch it. The panel no longer
 * opens on its own, so this is how a user gets to the live log in one click.
 */
export function toastJobStarted(message: string, jobId?: string): void {
  toast.success(message, {
    action: { label: "View", onClick: () => openActivity(jobId) },
  });
}
