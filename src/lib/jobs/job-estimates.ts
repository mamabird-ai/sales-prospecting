import type { Job, JobType } from "@/lib/tauri/types";

/** Must match MAX_CONCURRENT_JOBS in src-tauri/src/jobs/queue.rs */
export const MAX_CONCURRENT_JOBS = 5;

/** Typical durations used until there is job history to learn from */
const FALLBACK_DURATION_SECONDS: Record<JobType, number> = {
  company_research: 240,
  person_research: 180,
  scoring: 150,
  conversation: 90,
  lead_finder: 300,
};

/** How many recent completed jobs per type feed the typical duration */
const DURATION_SAMPLE_SIZE = 10;

export interface JobDurationEstimate {
  seconds: number;
  /** True when based on the user's own completed jobs rather than a default */
  fromHistory: boolean;
}

export type JobDurations = Record<JobType, JobDurationEstimate>;

const JOB_TYPES = Object.keys(FALLBACK_DURATION_SECONDS) as JobType[];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Typical run time per job type: the median of recent successful jobs,
 * which ignores the occasional stuck or unusually quick run
 */
export function typicalDurations(recentJobs: Job[]): JobDurations {
  const samples = new Map<JobType, number[]>();
  for (const job of recentJobs) {
    if (job.status !== "completed" || job.startedAt == null || job.completedAt == null) continue;
    const duration = job.completedAt - job.startedAt;
    if (duration <= 0) continue;
    const list = samples.get(job.jobType) ?? [];
    if (list.length < DURATION_SAMPLE_SIZE) list.push(duration);
    samples.set(job.jobType, list);
  }

  return Object.fromEntries(
    JOB_TYPES.map((type) => {
      const list = samples.get(type);
      return [
        type,
        list?.length
          ? { seconds: median(list), fromHistory: true }
          : { seconds: FALLBACK_DURATION_SECONDS[type], fromHistory: false },
      ];
    })
  ) as JobDurations;
}

interface PendingWork {
  jobType: JobType;
  status: Job["status"];
  startedAt: number | null;
}

/**
 * Estimated seconds until all given jobs finish. Simulates the queue: running
 * jobs hold a slot for their remaining time, and each queued job takes the
 * next slot to free up, so partial rounds are accounted for.
 */
export function estimateRemainingSeconds(
  jobs: PendingWork[],
  durations: JobDurations,
  nowSeconds: number
): number {
  // Each entry is the time at which that slot becomes free
  const slots: number[] = [];
  const queued: number[] = [];

  for (const job of jobs) {
    const typical = durations[job.jobType].seconds;
    if (job.status === "running" && job.startedAt != null) {
      // A job running longer than usual still needs some time to finish
      slots.push(Math.max(typical - (nowSeconds - job.startedAt), typical * 0.1));
    } else {
      queued.push(typical);
    }
  }
  while (slots.length < MAX_CONCURRENT_JOBS) slots.push(0);

  for (const duration of queued) {
    const next = slots.indexOf(Math.min(...slots));
    slots[next] += duration;
  }

  return Math.max(...slots);
}

/**
 * Estimated seconds to finish `count` new jobs on top of what is already queued
 */
export function estimateBatchSeconds(
  jobType: JobType,
  count: number,
  activeJobs: Job[],
  durations: JobDurations,
  nowSeconds: number
): number {
  const newJobs: PendingWork[] = Array.from({ length: count }, () => ({
    jobType,
    status: "queued",
    startedAt: null,
  }));
  return estimateRemainingSeconds([...activeJobs, ...newJobs], durations, nowSeconds);
}

/** "under a minute", "about 4 min", "about 1 hr 10 min" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `about ${hours} hr ${rest} min` : `about ${hours} hr`;
}
