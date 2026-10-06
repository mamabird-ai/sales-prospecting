"use client";

import type { ReactNode } from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useJobDurations } from "@/lib/hooks/use-job-activity";
import { formatDuration, MAX_CONCURRENT_JOBS } from "@/lib/jobs/job-estimates";
import { MODEL_OPTIONS, useSettingsStore } from "@/lib/store/settings-store";
import type { SelectionEntityType } from "@/lib/store/selection-store";
import type { JobType } from "@/lib/tauri/types";

const HELP_JOB_TYPES: Record<SelectionEntityType, { type: JobType; name: string }[]> = {
  lead: [
    { type: "company_research", name: "Research" },
    { type: "scoring", name: "Scoring" },
  ],
  person: [
    { type: "person_research", name: "Research" },
    { type: "conversation", name: "Talking points" },
  ],
};

export function BulkActionsHelp({ entityType }: { entityType: SelectionEntityType }) {
  const durations = useJobDurations();
  const selectedModel = useSettingsStore((state) => state.selectedModel);
  const modelLabel =
    MODEL_OPTIONS.find((option) => option.value === selectedModel)?.label ?? selectedModel;
  const items = entityType === "lead" ? "company" : "person";
  const jobTypes = HELP_JOB_TYPES[entityType];
  const fromHistory = jobTypes.every(({ type }) => durations[type].fromHistory);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-xs" className="text-muted-foreground">
          <IconInfoCircle />
          <span className="sr-only">How bulk actions work</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <h3 className="mb-2 text-sm font-medium text-foreground">How bulk actions work</h3>
        <dl className="space-y-2 text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">One job per {items}</dt>
            <dd>
              Each selected {items} runs as its own Claude session, so one failure doesn&apos;t
              affect the rest.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">{MAX_CONCURRENT_JOBS} at a time</dt>
            <dd>The rest wait in a queue and start automatically, in the order you picked them.</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Time per job</dt>
            <dd>
              {jobTypes
                .map(({ type, name }) => `${name}: ${formatDuration(durations[type].seconds)}`)
                .join(" · ")}
              <span className="block text-[11px]">
                {fromHistory
                  ? "Based on your recent jobs."
                  : "Typical times. Estimates adjust to your own jobs as they finish."}
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Usage</dt>
            <dd>
              Every job counts toward your Claude plan&apos;s 5-hour and weekly limits, shown in the
              sidebar. Larger models like Opus use more. Current model: {modelLabel}.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Keep working</dt>
            <dd>
              Progress shows in the sidebar. Open Activity to watch or stop a job. Items that are
              queued or running can&apos;t be selected until they finish.
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
          <Kbd>⌘A</Kbd> select all · <Kbd>Shift</Kbd>-click select a range · <Kbd>⌘K</Kbd> actions ·{" "}
          <Kbd>Esc</Kbd> clear
        </p>
      </PopoverContent>
    </Popover>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded bg-muted px-1 py-0.5 font-sans text-[10px]">{children}</kbd>;
}
