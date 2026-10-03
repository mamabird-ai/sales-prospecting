import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { useActiveJobs, useRecentJobs } from "@/lib/query/use-job-query";
import { useNow } from "@/lib/hooks/use-now";
import { estimateRemainingSeconds, typicalDurations } from "@/lib/jobs/job-estimates";
import type { SelectionEntityType } from "@/lib/store/selection-store";
import type { Job, JobType } from "@/lib/tauri/types";

/** Shares the cache entry the Activity panel already keeps fresh */
const RECENT_JOBS_LIMIT = 50;
/** How long the "finished" summary stays visible after a batch completes */
const FINISHED_SUMMARY_MS = 8000;

const ENTITY_JOB_TYPES: Record<SelectionEntityType, JobType[]> = {
  lead: ["company_research", "scoring"],
  person: ["person_research", "conversation"],
};

const RUNNING_LABELS: Record<JobType, string> = {
  company_research: "Researching",
  person_research: "Researching",
  scoring: "Scoring",
  conversation: "Writing topics",
  lead_finder: "Finding leads",
};

const BATCH_LABELS: Record<JobType, string> = {
  company_research: "Researching companies",
  person_research: "Researching people",
  scoring: "Scoring leads",
  conversation: "Writing talking points",
  lead_finder: "Finding leads",
};

export function useJobDurations() {
  const { data: recentJobs = [] } = useRecentJobs(RECENT_JOBS_LIMIT);
  return useMemo(() => typicalDurations(recentJobs), [recentJobs]);
}

/**
 * Entities of the given type with a queued or running job, mapped to a short
 * label explaining what is happening ("Queued", "Researching", ...)
 */
export function useBusyEntities(entityType: SelectionEntityType): Map<number, string> {
  const { data: activeJobs = [] } = useActiveJobs();

  return useMemo(() => {
    const types = ENTITY_JOB_TYPES[entityType];
    const busy = new Map<number, string>();
    for (const job of activeJobs) {
      if (!types.includes(job.jobType)) continue;
      // A running job is more informative than a queued one for the same entity
      if (busy.has(job.entityId) && job.status !== "running") continue;
      busy.set(job.entityId, job.status === "running" ? RUNNING_LABELS[job.jobType] : "Queued");
    }
    return busy;
  }, [activeJobs, entityType]);
}

/**
 * Jobs seen since the current wave of work started, so progress can read
 * "7 of 20" even though finished jobs leave the active list
 */
interface BatchState {
  jobTypes: Map<string, JobType>;
  finishedAt: number | null;
  track: (jobs: Job[]) => void;
  finish: () => void;
  reset: () => void;
}

const useBatchStore = create<BatchState>()((set) => ({
  jobTypes: new Map(),
  finishedAt: null,
  track: (jobs) =>
    set((state) => {
      // Work started after the last batch finished begins a fresh count
      const jobTypes = state.finishedAt === null ? new Map(state.jobTypes) : new Map();
      for (const job of jobs) jobTypes.set(job.id, job.jobType);
      return { jobTypes, finishedAt: null };
    }),
  finish: () => set({ finishedAt: Date.now() }),
  reset: () => set({ jobTypes: new Map(), finishedAt: null }),
}));

export interface JobProgress {
  /** Nothing to show: no active jobs and no recently finished batch */
  idle: boolean;
  label: string;
  total: number;
  done: number;
  running: number;
  queued: number;
  failed: number;
  etaSeconds: number;
  finished: boolean;
}

export function useJobProgress(): JobProgress {
  const { data: activeJobs = [] } = useActiveJobs();
  const { data: recentJobs = [] } = useRecentJobs(RECENT_JOBS_LIMIT);
  const durations = useMemo(() => typicalDurations(recentJobs), [recentJobs]);
  const { jobTypes, finishedAt, track, finish, reset } = useBatchStore();

  // Tick while jobs run so the time estimate counts down
  const now = useNow(5000, activeJobs.length > 0);

  useEffect(() => {
    if (activeJobs.length > 0) {
      track(activeJobs);
    } else if (jobTypes.size > 0 && finishedAt === null) {
      finish();
    }
  }, [activeJobs, jobTypes.size, finishedAt, track, finish]);

  useEffect(() => {
    if (finishedAt === null) return;
    const timer = setTimeout(reset, FINISHED_SUMMARY_MS);
    return () => clearTimeout(timer);
  }, [finishedAt, reset]);

  const failedIds = useMemo(
    () =>
      new Set(
        recentJobs
          .filter((job) => job.status === "error" || job.status === "timeout")
          .map((job) => job.id)
      ),
    [recentJobs]
  );

  const total = jobTypes.size;
  const types = new Set(jobTypes.values());
  const singleType = types.size === 1 ? [...types][0] : null;
  let failed = 0;
  for (const id of jobTypes.keys()) if (failedIds.has(id)) failed++;

  return {
    idle: total === 0,
    label: singleType ? BATCH_LABELS[singleType] : "Running jobs",
    total,
    done: Math.max(total - activeJobs.length, 0),
    running: activeJobs.filter((job) => job.status === "running").length,
    queued: activeJobs.filter((job) => job.status === "queued").length,
    failed,
    etaSeconds: estimateRemainingSeconds(activeJobs, durations, now / 1000),
    finished: finishedAt !== null,
  };
}
