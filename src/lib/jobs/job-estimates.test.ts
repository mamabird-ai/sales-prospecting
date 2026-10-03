import { describe, expect, test } from "bun:test";

import type { Job } from "@/lib/tauri/types";
import {
  estimateBatchSeconds,
  estimateRemainingSeconds,
  formatDuration,
  typicalDurations,
} from "./job-estimates";

function job(overrides: Partial<Job>): Job {
  return {
    id: crypto.randomUUID(),
    jobType: "company_research",
    entityId: 1,
    entityLabel: "Acme",
    status: "completed",
    prompt: "",
    model: null,
    workingDir: "",
    outputPath: null,
    exitCode: 0,
    errorMessage: null,
    createdAt: 0,
    startedAt: null,
    completedAt: null,
    pid: null,
    claudeSessionId: null,
    claudeModel: null,
    lastEventIndex: 0,
    stdoutTruncated: false,
    stderrTruncated: false,
    totalStdoutBytes: 0,
    totalStderrBytes: 0,
    completionState: null,
    ...overrides,
  };
}

describe("typicalDurations", () => {
  test("uses the median of completed jobs and ignores failures", () => {
    const durations = typicalDurations([
      job({ startedAt: 0, completedAt: 100 }),
      job({ startedAt: 0, completedAt: 200 }),
      job({ startedAt: 0, completedAt: 900 }),
      job({ status: "error", startedAt: 0, completedAt: 5 }),
    ]);

    expect(durations.company_research).toEqual({ seconds: 200, fromHistory: true });
  });

  test("falls back to a default without history", () => {
    expect(typicalDurations([]).scoring.fromHistory).toBe(false);
  });
});

describe("estimateRemainingSeconds", () => {
  const durations = typicalDurations([job({ startedAt: 0, completedAt: 300 })]);

  test("spreads queued work across five parallel slots", () => {
    const queued = Array.from({ length: 10 }, () => job({ status: "queued" }));
    // 10 jobs x 300s over 5 slots
    expect(estimateRemainingSeconds(queued, durations, 0)).toBe(600);
  });

  test("counts a partial extra round as a full round of waiting", () => {
    const queued = Array.from({ length: 6 }, () => job({ status: "queued" }));
    // 5 run together, then the sixth runs alone
    expect(estimateRemainingSeconds(queued, durations, 0)).toBe(600);
  });

  test("starts queued jobs as soon as a running job frees its slot", () => {
    const busy = Array.from({ length: 5 }, () => job({ status: "running", startedAt: 0 }));
    // All five slots free at 300s; the queued job runs from 300s to 600s
    expect(estimateRemainingSeconds([...busy, job({ status: "queued" })], durations, 0)).toBe(600);
  });

  test("returns zero when nothing is pending", () => {
    expect(estimateRemainingSeconds([], durations, 0)).toBe(0);
  });

  test("counts only the remaining time of running jobs", () => {
    const running = job({ status: "running", startedAt: 1000 });
    expect(estimateRemainingSeconds([running], durations, 1200)).toBe(100);
  });

  test("never estimates zero for a job running longer than usual", () => {
    const running = job({ status: "running", startedAt: 0 });
    expect(estimateRemainingSeconds([running], durations, 5000)).toBe(30);
  });

  test("adds a new batch on top of existing work", () => {
    expect(estimateBatchSeconds("company_research", 20, [], durations, 0)).toBe(1200);
  });
});

describe("formatDuration", () => {
  test("rounds to friendly units", () => {
    expect(formatDuration(30)).toBe("under a minute");
    expect(formatDuration(250)).toBe("about 4 min");
    expect(formatDuration(4200)).toBe("about 1 hr 10 min");
    expect(formatDuration(3600)).toBe("about 1 hr");
  });
});
