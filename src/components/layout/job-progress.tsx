import { useJobProgress } from "@/lib/hooks/use-job-activity";
import { formatDuration } from "@/lib/jobs/job-estimates";
import { useStreamPanelStore } from "@/lib/store/stream-panel-store";
import { cn } from "@/lib/utils";

/**
 * Overall progress of queued and running jobs, visible from every page.
 * Clicking opens the Activity panel with the full job logs.
 */
export function JobProgress() {
  const progress = useJobProgress();
  const setPanelOpen = useStreamPanelStore((state) => state.setOpen);

  if (progress.idle) return null;

  const { label, total, done, running, queued, failed, etaSeconds, finished } = progress;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const title = finished ? "All jobs finished" : label;

  return (
    <button
      type="button"
      onClick={() => setPanelOpen(true)}
      aria-label={`${title}, ${done} of ${total} done. Open Activity`}
      className="w-full rounded border border-white/10 bg-white/[0.03] p-2 text-left hover:bg-white/[0.06] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-foreground">{title}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {done}/{total}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            finished && failed === 0 ? "bg-green-500" : "bg-primary"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
        {finished ? (
          <p>
            {done - failed} succeeded
            {failed > 0 && <span className="text-red-500"> · {failed} failed</span>}
          </p>
        ) : (
          <>
            <p className="tabular-nums">
              {running} running · {queued} queued
              {failed > 0 && <span className="text-red-500"> · {failed} failed</span>}
            </p>
            <p>{formatDuration(etaSeconds)} left</p>
          </>
        )}
      </div>
    </button>
  );
}
