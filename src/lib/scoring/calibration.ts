import type { LeadScore, ScoringTier } from "@/lib/tauri/types";

export type ExpectedFit = "good" | "bad";

/** The top two tiers count as a good fit, the bottom two as a bad one */
const GOOD_TIERS: ScoringTier[] = ["hot", "warm"];

export type CheckStatus = "unscored" | "outdated" | "agrees" | "disagrees";

export interface CheckRow {
  leadId: number;
  companyName: string;
  expectedFit: ExpectedFit;
  score: LeadScore | null;
  status: CheckStatus;
}

export interface CheckSummary {
  rows: CheckRow[];
  /** Rows with a score made under the current criteria */
  current: number;
  agrees: number;
  /** Rows that need scoring, either never scored or scored under old criteria */
  needScoring: number[];
}

export function agreesWith(expected: ExpectedFit, tier: ScoringTier): boolean {
  return GOOD_TIERS.includes(tier) === (expected === "good");
}

/**
 * Compare the user's verdicts with the app's scores. A score made before the
 * criteria or the company profile last changed is outdated: it says nothing about the
 * current setup.
 */
export function summarizeCheck(
  expectations: { leadId: number; expectedFit: string }[],
  leads: { id: number; companyName: string; score: LeadScore | null }[],
  criteriaChangedAt: number
): CheckSummary {
  const byId = new Map(leads.map((lead) => [lead.id, lead]));
  const rows: CheckRow[] = [];

  for (const { leadId, expectedFit } of expectations) {
    const lead = byId.get(leadId);
    if (!lead || (expectedFit !== "good" && expectedFit !== "bad")) continue;
    const score = lead.score;
    const status: CheckStatus = !score
      ? "unscored"
      : (score.scoredAt ?? 0) < criteriaChangedAt
        ? "outdated"
        : agreesWith(expectedFit, score.tier)
          ? "agrees"
          : "disagrees";
    rows.push({ leadId, companyName: lead.companyName, expectedFit, score, status });
  }

  const current = rows.filter((row) => row.status === "agrees" || row.status === "disagrees");
  return {
    rows,
    current: current.length,
    agrees: current.filter((row) => row.status === "agrees").length,
    needScoring: rows
      .filter((row) => row.status === "unscored" || row.status === "outdated")
      .map((row) => row.leadId),
  };
}

/** Why the score came out as it did, in a sentence or two */
export function scoreReason(score: LeadScore): string | null {
  if (!score.passesRequirements) {
    const failed = score.requirementResults.filter((result) => !result.passed);
    if (failed.length > 0) {
      return failed.map((result) => `Failed “${result.name}”: ${result.reason}`).join(" ");
    }
  }
  return score.scoringNotes;
}
