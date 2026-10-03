import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNow } from "@/lib/hooks/use-now";
import { useUsageStore, type UsageWindow } from "@/lib/store/usage-store";
import { cn } from "@/lib/utils";

const WINDOWS: { key: string; label: string; description: string }[] = [
  { key: "five_hour", label: "5-hour", description: "Rolling 5-hour usage limit" },
  { key: "seven_day", label: "Weekly", description: "Weekly usage limit" },
];

/** Bars turn amber, then red, as a limit gets close */
const WARNING_AT = 0.7;
const CRITICAL_AT = 0.9;

function formatReset(resetsAt: number): string {
  return new Date(resetsAt * 1000).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAgo(timestampMs: number, nowMs: number): string {
  const minutes = Math.round((nowMs - timestampMs) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Claude plan usage, as last reported by the CLI. The CLI only reports usage
 * while a job runs, so the meter appears after the first job and notes how
 * fresh the numbers are.
 */
export function UsageMeter() {
  const windows = useUsageStore((state) => state.windows);
  const updatedAt = useUsageStore((state) => state.updatedAt);
  // Once a minute is enough to notice windows resetting and keep "updated" fresh
  const now = useNow(60_000);

  const rows = WINDOWS.filter(({ key }) => windows[key]);
  if (rows.length === 0 || updatedAt === null) return null;

  return (
    <div>
      <div className="px-2 py-1 text-muted-foreground text-[11px] uppercase tracking-wider font-medium">
        Claude usage
      </div>
      <div className="space-y-1.5 px-2 pb-1">
        {rows.map(({ key, label, description }) => (
          <UsageRow
            key={key}
            label={label}
            description={description}
            window={windows[key]}
            updatedAt={updatedAt}
            now={now}
          />
        ))}
      </div>
    </div>
  );
}

function UsageRow({
  label,
  description,
  window,
  updatedAt,
  now,
}: {
  label: string;
  description: string;
  window: UsageWindow;
  updatedAt: number;
  now: number;
}) {
  // A window that reset since the last report starts over at zero
  const hasReset = window.resetsAt !== null && window.resetsAt * 1000 < now;
  const utilization = hasReset ? 0 : window.utilization;
  const percent = Math.round(utilization * 100);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          className="rounded outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{label}</span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <div
            role="meter"
            aria-label={`${description}: ${percent}% used`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-1 h-1 overflow-hidden rounded-full bg-white/10"
          >
            <div
              className={cn(
                "h-full rounded-full",
                utilization >= CRITICAL_AT
                  ? "bg-red-500"
                  : utilization >= WARNING_AT
                    ? "bg-yellow-500"
                    : "bg-muted-foreground"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="font-medium">
          {description}: {percent}% used
        </p>
        {hasReset ? (
          <p className="text-muted-foreground">Reset since the last update.</p>
        ) : (
          window.resetsAt !== null && (
            <p className="text-muted-foreground">Resets {formatReset(window.resetsAt)}</p>
          )
        )}
        <p className="text-muted-foreground">
          Updated {formatAgo(updatedAt, now)}. Refreshes while jobs run.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
