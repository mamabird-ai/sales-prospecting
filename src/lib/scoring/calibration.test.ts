import { describe, expect, test } from "bun:test";

import type { LeadScore, ScoringTier } from "@/lib/tauri/types";
import { agreesWith, scoreReason, summarizeCheck } from "./calibration";

function score(tier: ScoringTier, scoredAt: number, extra: Partial<LeadScore> = {}): LeadScore {
  return {
    id: 1,
    leadId: 1,
    configId: 1,
    passesRequirements: true,
    requirementResults: [],
    totalScore: 70,
    scoreBreakdown: [],
    tier,
    scoringNotes: null,
    scoredAt,
    createdAt: scoredAt,
    ...extra,
  };
}

describe("agreesWith", () => {
  test("good fits belong in the top two tiers, bad fits in the bottom two", () => {
    expect(agreesWith("good", "hot")).toBe(true);
    expect(agreesWith("good", "warm")).toBe(true);
    expect(agreesWith("good", "nurture")).toBe(false);
    expect(agreesWith("bad", "disqualified")).toBe(true);
    expect(agreesWith("bad", "nurture")).toBe(true);
    expect(agreesWith("bad", "hot")).toBe(false);
  });
});

describe("summarizeCheck", () => {
  const changedAt = 1000;
  const leads = [
    { id: 1, companyName: "Acme", score: score("hot", 2000) },
    { id: 2, companyName: "Birch", score: score("hot", 2000) },
    { id: 3, companyName: "Cedar", score: null },
    { id: 4, companyName: "Dune", score: score("disqualified", 500) },
  ];

  test("compares current scores with the user's verdicts", () => {
    const summary = summarizeCheck(
      [
        { leadId: 1, expectedFit: "good" },
        { leadId: 2, expectedFit: "bad" },
        { leadId: 3, expectedFit: "good" },
        { leadId: 4, expectedFit: "bad" },
      ],
      leads,
      changedAt
    );

    expect(summary.rows.map((row) => row.status)).toEqual([
      "agrees",
      "disagrees",
      "unscored",
      // Scored before the criteria changed, so it doesn't count either way
      "outdated",
    ]);
    expect(summary.current).toBe(2);
    expect(summary.agrees).toBe(1);
    expect(summary.needScoring).toEqual([3, 4]);
  });

  test("skips companies that no longer exist", () => {
    const summary = summarizeCheck([{ leadId: 99, expectedFit: "good" }], leads, changedAt);
    expect(summary.rows).toEqual([]);
  });
});

describe("scoreReason", () => {
  test("names failed must-haves before falling back to the notes", () => {
    const failed = score("disqualified", 1, {
      passesRequirements: false,
      requirementResults: [
        { id: "a", name: "Has the problem", passed: false, reason: "No evidence" },
      ],
      scoringNotes: "Notes",
    });
    expect(scoreReason(failed)).toBe("Failed “Has the problem”: No evidence");
    expect(scoreReason(score("warm", 1, { scoringNotes: "Solid fit" }))).toBe("Solid fit");
  });
});
